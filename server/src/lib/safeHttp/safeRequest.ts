import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupAddress } from "node:dns";
import type { Socket } from "node:net";
import zlib from "node:zlib";
import { checkAddress } from "./ipAddress";
import { classifyNetworkError, SafeHttpError } from "./errors";

/**
 * Outbound HTTP client for user-supplied URLs with SSRF protection:
 *  - only http/https, no credentials in the URL;
 *  - IP-literal hosts are checked before connecting; hostnames are resolved and EVERY returned address must
 *    be allowed, and the connection is pinned to a vetted address (no second lookup → no DNS rebinding);
 *  - the connected socket's remote address is re-checked (defense in depth);
 *  - redirects are followed manually (max 5) and each hop is validated the same way;
 *  - overall timeout and a cap on the decoded response size (protects against decompression bombs);
 *  - environment proxies are never used.
 */

export interface SafeRequestInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface SafeRequestOptions {
  allowLocalhost: boolean;
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  /** Injected for tests; defaults to the OS resolver. */
  lookup?: typeof dns.lookup;
}

export interface SafeResponse {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  bodyBytes: number;
  truncated: boolean;
  contentType: string | null;
  redirects: { status: number; url: string }[];
  remoteAddress: string | null;
  timeMs: number;
}

const REDIRECT = new Set([301, 302, 303, 307, 308]);

/** Parses and validates a URL; IP-literal hosts are checked here (DNS names are checked at lookup time). */
export function validateUrl(raw: string, opts: { allowLocalhost: boolean }): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SafeHttpError("invalid_url", "That isn't a valid URL. Include the scheme, e.g. https://api.example.com/items.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeHttpError("invalid_url", `Only http and https URLs are allowed (got "${url.protocol.replace(":", "")}").`);
  }
  if (url.username || url.password) {
    throw new SafeHttpError("invalid_url", "Credentials in the URL are not allowed. Send them in a header instead (use {{secret:NAME}}).");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // The WHATWG parser has already normalized decimal/octal/hex IPv4 forms (e.g. 2130706433 → 127.0.0.1).
  const verdict = isIpLiteral(host) ? checkAddress(host, opts) : null;
  if (verdict && !verdict.allowed) throw blockedError(url.hostname, host, verdict.reason, verdict.loopback);
  return url;
}

function isIpLiteral(host: string): boolean {
  return /^[\d.]+$/.test(host) || host.includes(":");
}

function blockedError(hostname: string, address: string, reason: string, loopback: boolean): SafeHttpError {
  const where = hostname === address ? address : `${hostname} (${address})`;
  return new SafeHttpError(
    "blocked",
    `Blocked for safety: ${where} is a ${reason} address.` +
      (loopback ? ' Turn on "Allow localhost" in API Studio settings to test a local server.' : " Requests to internal networks are not allowed."),
  );
}

/** A dns.lookup replacement that rejects the hostname if any resolved address is not allowed. */
function guardedLookup(opts: SafeRequestOptions) {
  const resolve = opts.lookup ?? dns.lookup;
  return (
    hostname: string,
    options: dns.LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    resolve(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) return callback(err, "", 0);
      const list = addresses as LookupAddress[];
      if (list.length === 0) return callback(Object.assign(new Error("no addresses"), { code: "ENOTFOUND" }), "", 0);
      for (const a of list) {
        const verdict = checkAddress(a.address, opts);
        if (!verdict.allowed) return callback(blockedError(hostname, a.address, verdict.reason, verdict.loopback), "", 0);
      }
      const wanted = options.family ? list.filter((a) => a.family === options.family) : list;
      const usable = wanted.length ? wanted : list;
      if (options.all) callback(null, usable);
      else callback(null, usable[0]!.address, usable[0]!.family);
    });
  };
}

interface HopResult {
  status: number;
  statusText: string;
  headers: [string, string][];
  location: string | null;
  body: string;
  bodyBytes: number;
  truncated: boolean;
  contentType: string | null;
  remoteAddress: string | null;
}

function decoder(encoding: string | undefined) {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    default:
      return null;
  }
}

function hop(url: URL, method: string, headers: Record<string, string>, body: string | undefined, opts: SafeRequestOptions, deadline: number): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeHttpError("timeout", `No complete response within ${opts.timeoutMs / 1000} s.`));
    const target = { host: url.hostname, port: url.port };
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.destroy();
      reject(classifyNetworkError(err, target));
    };

    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(url, {
      method,
      headers,
      lookup: guardedLookup(opts) as unknown as typeof dns.lookup,
      agent: false, // fresh connection per hop: no socket reuse across differently-validated hosts, no env proxy
    });

    const timer = setTimeout(
      () => fail(new SafeHttpError("timeout", `No complete response from ${url.host} within ${opts.timeoutMs / 1000} s.`)),
      remaining,
    );

    req.on("socket", (socket: Socket) => {
      socket.once("connect", () => {
        const remote = socket.remoteAddress;
        const verdict = remote ? checkAddress(remote, opts) : { allowed: false as const, reason: "unknown", loopback: false };
        if (!verdict.allowed) fail(blockedError(url.hostname, remote ?? "?", verdict.reason, verdict.loopback));
      });
    });

    req.on("error", fail);
    req.on("response", (res) => {
      const status = res.statusCode ?? 0;
      const headerPairs: [string, string][] = [];
      for (let i = 0; i < res.rawHeaders.length; i += 2) headerPairs.push([res.rawHeaders[i]!.toLowerCase(), res.rawHeaders[i + 1]!]);
      const base = {
        status,
        statusText: res.statusMessage ?? "",
        headers: headerPairs,
        location: REDIRECT.has(status) ? (res.headers.location ?? null) : null,
        contentType: res.headers["content-type"] ?? null,
        remoteAddress: res.socket?.remoteAddress ?? null,
      };
      if (base.location) {
        res.resume();
        settled = true;
        clearTimeout(timer);
        return resolve({ ...base, body: "", bodyBytes: 0, truncated: false });
      }

      const decode = decoder(res.headers["content-encoding"]);
      const stream = decode ? res.pipe(decode) : res;
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ...base, body: Buffer.concat(chunks).toString("utf8"), bodyBytes: size, truncated });
      };
      stream.on("data", (chunk: Buffer) => {
        if (truncated) return;
        const room = opts.maxBytes - size;
        if (chunk.length > room) {
          chunks.push(chunk.subarray(0, room));
          size += room;
          truncated = true;
          finish();
          res.destroy();
          return;
        }
        chunks.push(chunk);
        size += chunk.length;
      });
      stream.on("end", finish);
      stream.on("error", (err) =>
        decode ? fail(new SafeHttpError("network", `Couldn't decode the ${res.headers["content-encoding"]} response body.`)) : fail(err),
      );
      res.on("close", () => {
        if (!res.complete && !truncated) fail(Object.assign(new Error("closed early"), { code: "ECONNRESET" }));
      });
    });

    if (body !== undefined) req.write(body);
    req.end();
  });
}

export async function safeRequest(input: SafeRequestInput, opts: SafeRequestOptions): Promise<SafeResponse> {
  const started = performance.now();
  const deadline = Date.now() + opts.timeoutMs;
  const maxRedirects = opts.maxRedirects ?? 5;
  let url = validateUrl(input.url, opts);
  let method = input.method.toUpperCase();
  let body = input.body;
  const headers = { ...input.headers };
  const redirects: SafeResponse["redirects"] = [];

  for (;;) {
    const result = await hop(url, method, headers, body, opts, deadline);
    if (!result.location) {
      const { location: _location, ...rest } = result;
      return { ...rest, redirects, timeMs: Math.round(performance.now() - started) };
    }
    if (redirects.length >= maxRedirects) {
      throw new SafeHttpError("too_many_redirects", `Stopped after ${maxRedirects} redirects (last: ${url.href}).`);
    }
    let next: URL;
    try {
      next = new URL(result.location, url);
    } catch {
      throw new SafeHttpError("invalid_url", `The server redirected to an invalid URL: ${result.location}`);
    }
    next = validateUrl(next.href, opts); // every hop gets the same checks; DNS is checked when connecting
    redirects.push({ status: result.status, url: next.href });
    if (result.status === 303 || ((result.status === 301 || result.status === 302) && method !== "GET" && method !== "HEAD")) {
      method = "GET";
      body = undefined;
      for (const h of Object.keys(headers)) if (/^content-(type|length)$/i.test(h)) delete headers[h];
    }
    if (next.origin !== url.origin) {
      // Never forward credentials to a different origin.
      for (const h of Object.keys(headers)) if (/^(authorization|cookie|proxy-authorization)$/i.test(h)) delete headers[h];
    }
    url = next;
  }
}

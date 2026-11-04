import http from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import dns from "node:dns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkAddress, parseIp } from "../src/lib/safeHttp/ipAddress";
import { safeRequest, validateUrl } from "../src/lib/safeHttp/safeRequest";
import { SafeHttpError } from "../src/lib/safeHttp/errors";

const strict = { allowLocalhost: false };
const local = { allowLocalhost: true };
const blocked = (ip: string, opts = strict) => !checkAddress(ip, opts).allowed;

describe("IP classification", () => {
  it("parses IPv4 and IPv6 forms", () => {
    expect(parseIp("10.1.2.3")).toEqual({ version: 4, bytes: [10, 1, 2, 3] });
    expect(parseIp("::ffff:127.0.0.1")!.bytes.slice(10)).toEqual([0xff, 0xff, 127, 0, 0, 1]);
    expect(parseIp("[fe80::1%eth0]")!.version).toBe(6);
    expect(parseIp("not-an-ip")).toBeNull();
  });

  it("blocks private, loopback, link-local, metadata and reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1", "127.255.0.9", "10.0.0.1", "172.16.5.4", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "169.254.10.10", "100.64.0.1", "100.100.100.200", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    ]) {
      expect(blocked(ip), ip).toBe(true);
    }
    expect(checkAddress("169.254.169.254", strict)).toMatchObject({ reason: "cloud metadata endpoint" });
  });

  it("allows public addresses, including ones next to private ranges", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.255.255", "100.128.0.1", "2606:4700:4700::1111"]) {
      expect(blocked(ip), ip).toBe(false);
    }
  });

  it("blocks private IPv6 and IPv6 forms that embed private IPv4", () => {
    for (const ip of [
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "fd00:ec2::254", "ff02::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:10.0.0.1", "64:ff9b::a9fe:a9fe", "::127.0.0.1",
    ]) {
      expect(blocked(ip), ip).toBe(true);
    }
    expect(blocked("::ffff:8.8.8.8")).toBe(false);
  });

  it("allows only loopback when allowLocalhost is on", () => {
    expect(blocked("127.0.0.1", local)).toBe(false);
    expect(blocked("::1", local)).toBe(false);
    expect(blocked("::ffff:127.0.0.1", local)).toBe(false);
    expect(blocked("10.0.0.1", local)).toBe(true);
    expect(blocked("169.254.169.254", local)).toBe(true);
    expect(blocked("192.168.0.10", local)).toBe(true);
  });
});

describe("validateUrl", () => {
  const kind = (url: string, opts = strict) => {
    try {
      validateUrl(url, opts);
      return "ok";
    } catch (e) {
      return (e as SafeHttpError).kind;
    }
  };

  it("accepts http(s) URLs with hostnames", () => {
    expect(kind("https://api.example.com/v1?x=1")).toBe("ok");
  });

  it("rejects other schemes, malformed URLs and credentials", () => {
    expect(kind("file:///etc/passwd")).toBe("invalid_url");
    expect(kind("ftp://example.com")).toBe("invalid_url");
    expect(kind("gopher://127.0.0.1:6379/_")).toBe("invalid_url");
    expect(kind("not a url")).toBe("invalid_url");
    expect(kind("https://user:pass@example.com")).toBe("invalid_url");
  });

  it("blocks IP literals in every notation the URL parser accepts", () => {
    for (const url of [
      "http://127.0.0.1/", "http://2130706433/", "http://0x7f.0.0.1/", "http://0177.0.0.1/", "http://127.1/",
      "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/latest/meta-data/", "http://[fd00:ec2::254]/",
      "http://0.0.0.0:8080/", "http://10.0.0.1:6379/",
    ]) {
      expect(kind(url), url).toBe("blocked");
    }
    expect(kind("http://127.0.0.1:3000/", local)).toBe("ok");
    expect(kind("http://169.254.169.254/", local)).toBe("blocked");
  });

  it("explains how to allow localhost in the message", () => {
    expect(() => validateUrl("http://127.0.0.1/", strict)).toThrow(/Allow localhost/);
    expect(() => validateUrl("http://169.254.169.254/", strict)).toThrow(/cloud metadata endpoint/);
  });
});

/** Fake resolver: maps hostnames to fixed addresses so DNS-based checks can be tested offline. */
function fakeLookup(map: Record<string, string[]>): typeof dns.lookup {
  return ((hostname: string, _opts: unknown, cb: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => {
    const ips = map[hostname];
    if (!ips) return cb(Object.assign(new Error("not found"), { code: "ENOTFOUND" }), []);
    cb(null, ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
  }) as unknown as typeof dns.lookup;
}

describe("safeRequest", () => {
  let server: http.Server;
  let port = 0;
  let lastHost = "";

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      lastHost = req.headers.host ?? "";
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname === "/json") {
        res.setHeader("content-type", "application/json");
        res.setHeader("set-cookie", "session=abc");
        return res.end(JSON.stringify({ ok: true, auth: req.headers.authorization ?? null }));
      }
      if (url.pathname === "/echo") {
        let body = "";
        req.on("data", (c) => (body += c));
        return req.on("end", () => res.end(JSON.stringify({ method: req.method, body, auth: req.headers.authorization ?? null })));
      }
      if (url.pathname === "/redirect") {
        res.statusCode = Number(url.searchParams.get("code") ?? 302);
        res.setHeader("location", url.searchParams.get("to") ?? "/json");
        return res.end();
      }
      if (url.pathname === "/loop") {
        res.statusCode = 302;
        res.setHeader("location", "/loop");
        return res.end();
      }
      if (url.pathname === "/slow") return setTimeout(() => res.end("late"), 2000);
      if (url.pathname === "/big") return res.end("x".repeat(5000));
      if (url.pathname === "/gzip-bomb") {
        res.setHeader("content-encoding", "gzip");
        return res.end(zlib.gzipSync(Buffer.alloc(1_000_000, 0x61)));
      }
      res.statusCode = 404;
      res.end("nope");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const opts = (extra: object = {}) => ({ allowLocalhost: true, timeoutMs: 1500, maxBytes: 1024, ...extra });
  const base = () => `http://127.0.0.1:${port}`;
  const errorKind = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (e) {
      return e instanceof SafeHttpError ? e.kind : `unexpected: ${String(e)}`;
    }
  };

  it("performs a request and reports status, headers, time and connected address", async () => {
    const r = await safeRequest({ method: "GET", url: `${base()}/json`, headers: {} }, opts());
    expect(r).toMatchObject({ status: 200, contentType: "application/json", truncated: false, remoteAddress: "127.0.0.1" });
    expect(JSON.parse(r.body)).toEqual({ ok: true, auth: null });
    expect(r.headers).toContainEqual(["set-cookie", "session=abc"]);
    expect(r.timeMs).toBeGreaterThanOrEqual(0);
  });

  it("blocks loopback when allowLocalhost is off", async () => {
    expect(await errorKind(safeRequest({ method: "GET", url: `${base()}/json`, headers: {} }, opts({ allowLocalhost: false })))).toBe("blocked");
  });

  it("checks every DNS answer and pins the connection to it", async () => {
    const lookup = fakeLookup({ "api.test": ["127.0.0.1"], "evil.test": ["93.184.216.34", "169.254.169.254"], "meta.test": ["169.254.169.254"] });
    const ok = await safeRequest({ method: "GET", url: `http://api.test:${port}/json`, headers: {} }, opts({ lookup }));
    expect(ok.status).toBe(200);
    expect(lastHost).toBe(`api.test:${port}`); // Host header keeps the hostname even though the IP is pinned
    expect(await errorKind(safeRequest({ method: "GET", url: `http://meta.test/`, headers: {} }, opts({ lookup })))).toBe("blocked");
    // One bad record among good ones is enough to block (defeats round-robin rebinding tricks).
    expect(await errorKind(safeRequest({ method: "GET", url: `http://evil.test/`, headers: {} }, opts({ lookup })))).toBe("blocked");
    expect(await errorKind(safeRequest({ method: "GET", url: `http://api.test:${port}/json`, headers: {} }, opts({ lookup, allowLocalhost: false })))).toBe("blocked");
  });

  it("validates every redirect hop", async () => {
    const toMeta = encodeURIComponent("http://169.254.169.254/latest/meta-data/");
    expect(await errorKind(safeRequest({ method: "GET", url: `${base()}/redirect?to=${toMeta}`, headers: {} }, opts()))).toBe("blocked");
    const toFile = encodeURIComponent("file:///etc/passwd");
    expect(await errorKind(safeRequest({ method: "GET", url: `${base()}/redirect?to=${toFile}`, headers: {} }, opts()))).toBe("invalid_url");
    const lookup = fakeLookup({ "internal.test": ["10.0.0.5"] });
    const toInternal = encodeURIComponent("http://internal.test/admin");
    expect(await errorKind(safeRequest({ method: "GET", url: `${base()}/redirect?to=${toInternal}`, headers: {} }, opts({ lookup })))).toBe("blocked");
  });

  it("follows safe redirects, switches POST to GET on 303 and limits the chain", async () => {
    const r = await safeRequest({ method: "POST", url: `${base()}/redirect?code=303&to=/echo`, headers: { "content-type": "application/json" }, body: "{}" }, opts());
    expect(JSON.parse(r.body)).toMatchObject({ method: "GET", body: "" });
    expect(r.redirects).toEqual([{ status: 303, url: `${base()}/echo` }]);
    const kept = await safeRequest({ method: "POST", url: `${base()}/redirect?code=307&to=/echo`, headers: {}, body: "hi" }, opts());
    expect(JSON.parse(kept.body)).toMatchObject({ method: "POST", body: "hi" });
    expect(await errorKind(safeRequest({ method: "GET", url: `${base()}/loop`, headers: {} }, opts()))).toBe("too_many_redirects");
  });

  it("drops credentials when a redirect changes origin", async () => {
    const lookup = fakeLookup({ "other.test": ["127.0.0.1"] });
    const to = encodeURIComponent(`http://other.test:${port}/echo`);
    const r = await safeRequest({ method: "GET", url: `${base()}/redirect?to=${to}`, headers: { authorization: "Bearer s3cret" } }, opts({ lookup }));
    expect(JSON.parse(r.body).auth).toBeNull();
    const same = await safeRequest({ method: "GET", url: `${base()}/redirect?to=/echo`, headers: { authorization: "Bearer s3cret" } }, opts());
    expect(JSON.parse(same.body).auth).toBe("Bearer s3cret");
  });

  it("times out slow responses", async () => {
    expect(await errorKind(safeRequest({ method: "GET", url: `${base()}/slow`, headers: {} }, opts({ timeoutMs: 300 })))).toBe("timeout");
  });

  it("caps the response size, including decompressed bodies", async () => {
    const big = await safeRequest({ method: "GET", url: `${base()}/big`, headers: {} }, opts({ maxBytes: 1000 }));
    expect(big).toMatchObject({ truncated: true, bodyBytes: 1000 });
    const bomb = await safeRequest({ method: "GET", url: `${base()}/gzip-bomb`, headers: {} }, opts({ maxBytes: 2000 }));
    expect(bomb).toMatchObject({ truncated: true, bodyBytes: 2000 });
  });

  it("gives clear errors for refused connections and DNS failures", async () => {
    const closed = http.createServer();
    await new Promise<void>((r) => closed.listen(0, "127.0.0.1", r));
    const deadPort = (closed.address() as AddressInfo).port;
    await new Promise<void>((r) => closed.close(() => r()));
    const refused = safeRequest({ method: "GET", url: `http://127.0.0.1:${deadPort}/`, headers: {} }, opts());
    await expect(refused).rejects.toMatchObject({ kind: "refused", message: expect.stringContaining("Is the server running?") });
    const lookup = fakeLookup({});
    await expect(safeRequest({ method: "GET", url: "http://no-such-host.test/", headers: {} }, opts({ lookup }))).rejects.toMatchObject({
      kind: "dns",
      message: expect.stringContaining('couldn\'t resolve "no-such-host.test"'),
    });
  });
});

import net from "node:net";

/**
 * IP address classification for SSRF protection. Addresses are parsed to bytes and compared with
 * CIDR ranges directly, including IPv4-mapped / -compatible / NAT64 IPv6 forms that embed an IPv4 address.
 */

type Bytes = number[];

export interface ParsedIp {
  version: 4 | 6;
  bytes: Bytes;
}

export function parseIp(input: string): ParsedIp | null {
  const address = input.replace(/^\[|\]$/g, "").replace(/%.*$/, ""); // strip brackets and IPv6 zone id
  const version = net.isIP(address);
  if (version === 4) return { version: 4, bytes: address.split(".").map(Number) };
  if (version !== 6) return null;

  // Expand "::" and a trailing dotted IPv4 part into 8 hextets.
  let text = address.toLowerCase();
  const v4Tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (v4Tail) {
    const [a, b, c, d] = v4Tail[1]!.split(".").map(Number) as [number, number, number, number];
    text = text.slice(0, -v4Tail[1]!.length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.includes("::") ? text.split("::") : [text, undefined];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - headParts.length - tailParts.length;
  const hextets = [...headParts, ...Array(tail === undefined ? 0 : missing).fill("0"), ...tailParts].map((h) => parseInt(h, 16));
  const bytes = hextets.flatMap((h) => [(h >> 8) & 0xff, h & 0xff]);
  return { version: 6, bytes };
}

interface Range {
  bytes: Bytes;
  prefix: number;
  label: string;
}

function cidr(spec: string, label: string): Range {
  const [addr, prefix] = spec.split("/");
  const parsed = parseIp(addr!);
  if (!parsed) throw new Error(`Bad CIDR ${spec}`);
  return { bytes: parsed.bytes, prefix: Number(prefix), label };
}

function inRange(bytes: Bytes, range: Range): boolean {
  if (bytes.length !== range.bytes.length) return false;
  let bits = range.prefix;
  for (let i = 0; bits > 0; i++, bits -= 8) {
    const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
    if ((bytes[i]! & mask) !== (range.bytes[i]! & mask)) return false;
  }
  return true;
}

export const LOOPBACK = "loopback";

const IPV4_BLOCKED: Range[] = [
  cidr("169.254.169.254/32", "cloud metadata endpoint"),
  cidr("100.100.100.200/32", "cloud metadata endpoint"),
  cidr("0.0.0.0/8", "unspecified / \"this network\""),
  cidr("10.0.0.0/8", "private network"),
  cidr("100.64.0.0/10", "carrier-grade NAT (shared) network"),
  cidr("127.0.0.0/8", LOOPBACK),
  cidr("169.254.0.0/16", "link-local"),
  cidr("172.16.0.0/12", "private network"),
  cidr("192.0.0.0/24", "IETF protocol assignments"),
  cidr("192.0.2.0/24", "documentation range"),
  cidr("192.88.99.0/24", "6to4 relay"),
  cidr("192.168.0.0/16", "private network"),
  cidr("198.18.0.0/15", "benchmarking range"),
  cidr("198.51.100.0/24", "documentation range"),
  cidr("203.0.113.0/24", "documentation range"),
  cidr("224.0.0.0/4", "multicast"),
  cidr("240.0.0.0/4", "reserved"),
];

const IPV6_BLOCKED: Range[] = [
  cidr("::/128", "unspecified"),
  cidr("::1/128", LOOPBACK),
  cidr("fd00:ec2::254/128", "cloud metadata endpoint"),
  cidr("fc00::/7", "unique local (private) network"),
  cidr("fe80::/10", "link-local"),
  cidr("fec0::/10", "site-local (deprecated)"),
  cidr("ff00::/8", "multicast"),
  cidr("2001:db8::/32", "documentation range"),
  cidr("2001::/32", "Teredo tunnel"),
  cidr("2002::/16", "6to4 tunnel"),
  cidr("100::/64", "discard-only range"),
];

/** IPv6 ranges whose last 32 bits are an IPv4 address that must be checked as IPv4. */
const IPV6_EMBEDDING_V4: Range[] = [
  cidr("::ffff:0:0/96", "IPv4-mapped"),
  cidr("::/96", "IPv4-compatible"),
  cidr("64:ff9b::/96", "NAT64"),
  cidr("64:ff9b:1::/48", "NAT64 local"),
];

export type AddressVerdict = { allowed: true } | { allowed: false; reason: string; loopback: boolean };

/** Decides whether a connection to `address` is allowed. Loopback is allowed only when `allowLocalhost` is set. */
export function checkAddress(address: string, opts: { allowLocalhost: boolean }): AddressVerdict {
  const parsed = parseIp(address);
  if (!parsed) return { allowed: false, reason: "not a valid IP address", loopback: false };

  let { bytes } = parsed;
  let ranges = parsed.version === 4 ? IPV4_BLOCKED : IPV6_BLOCKED;
  if (parsed.version === 6) {
    const embedding = IPV6_EMBEDDING_V4.find((r) => inRange(bytes, r));
    // "::" and "::1" sit inside ::/96 but are IPv6 special addresses, not embedded IPv4.
    const isSpecial = IPV6_BLOCKED.slice(0, 2).some((r) => inRange(bytes, r));
    if (embedding && !isSpecial) {
      bytes = bytes.slice(12);
      ranges = IPV4_BLOCKED;
    }
  }

  const hit = ranges.find((r) => inRange(bytes, r));
  if (!hit) return { allowed: true };
  if (hit.label === LOOPBACK && opts.allowLocalhost) return { allowed: true };
  return { allowed: false, reason: hit.label, loopback: hit.label === LOOPBACK };
}

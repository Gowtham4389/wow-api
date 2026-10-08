import { isIP } from 'node:net';

/** Convert a dotted-quad string into a 32 bit unsigned integer. */
function ipv4ToLong(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** CIDR blocks that must never be reachable through the proxy. */
const BLOCKED_V4 = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local + cloud metadata (169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
].map(([base, bits]) => ({
  base: ipv4ToLong(base),
  mask: bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0,
}));

export function isPrivateIPv4(ip) {
  const value = ipv4ToLong(ip);
  if (value === null) return true; // unparseable -> treat as unsafe
  return BLOCKED_V4.some((range) => (value & range.mask) >>> 0 === range.base);
}

/** Expand an IPv6 address to its eight 16-bit groups. */
function expandIPv6(ip) {
  let address = ip.trim().toLowerCase();
  const zone = address.indexOf('%');
  if (zone !== -1) address = address.slice(0, zone);

  // IPv4-mapped / IPv4-compatible tail, e.g. ::ffff:127.0.0.1
  let tail = [];
  const lastColon = address.lastIndexOf(':');
  const maybeV4 = address.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    if (isIP(maybeV4) !== 4) return null;
    const value = ipv4ToLong(maybeV4);
    if (value === null) return null;
    tail = [(value >>> 16) & 0xffff, value & 0xffff];
    address = address.slice(0, lastColon + 1) + '0:0';
  }

  const [head, rest, extra] = address.split('::');
  if (extra !== undefined) return null;
  const toGroups = (segment) =>
    segment && segment.length
      ? segment.split(':').filter((s) => s.length > 0).map((s) => Number.parseInt(s, 16))
      : [];

  let groups;
  if (rest === undefined) {
    groups = toGroups(head);
  } else {
    const left = toGroups(head);
    const right = toGroups(rest);
    const fill = 8 - left.length - right.length;
    if (fill < 0) return null;
    groups = [...left, ...Array.from({ length: fill }, () => 0), ...right];
  }

  if (tail.length) groups = [...groups.slice(0, 6), ...tail];
  if (groups.length !== 8 || groups.some((g) => !Number.isFinite(g) || g < 0 || g > 0xffff)) {
    return null;
  }
  return groups;
}

export function isPrivateIPv6(ip) {
  const groups = expandIPv6(ip);
  if (!groups) return true; // unparseable -> treat as unsafe

  const isZero = groups.every((g) => g === 0); // ::
  if (isZero) return true;
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1

  const [g0, g1] = groups;
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x0100 && g1 === 0x0000) return true; // 100::/64 discard-only

  // Embedded IPv4 forms must be validated against the IPv4 rules.
  const asV4 = (hi, lo) =>
    [(hi >>> 8) & 0xff, hi & 0xff, (lo >>> 8) & 0xff, lo & 0xff].join('.');

  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (IPv4-compatible)
  if (groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    return isPrivateIPv4(asV4(groups[6], groups[7]));
  }
  // 64:ff9b::/96 NAT64
  if (g0 === 0x0064 && g1 === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    return isPrivateIPv4(asV4(groups[6], groups[7]));
  }
  // 2002::/16 6to4 embeds the IPv4 address in groups 1-2
  if (g0 === 0x2002) {
    return isPrivateIPv4(asV4(groups[1], groups[2]));
  }
  return false;
}

/** True when the address must not be contacted by the proxy. */
export function isBlockedAddress(ip) {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

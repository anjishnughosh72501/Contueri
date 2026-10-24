/**
 * SSRF and private IP protection for the proxy gateway.
 * Blocks loopback, private RFC1918, link-local, CGNAT, internal domains, and non-standard ports.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const n = Number(parts[i]);
    if (isNaN(n) || n < 0 || n > 255 || !/^\d+$/.test(parts[i])) return null;
    num = (num << 8) + n;
  }
  return num >>> 0;
}

function inRange(ipNum: number, cidrBase: string, maskBits: number): boolean {
  const baseNum = ipv4ToInt(cidrBase);
  if (baseNum === null) return false;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

export function isBlockedUrl(urlString: string): { blocked: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { blocked: true, reason: 'Invalid URL format' };
  }

  // 1. Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { blocked: true, reason: 'Protocol must be http or https' };
  }

  // 2. Port check: only 80 and 443 (or default empty)
  const port = parsed.port;
  if (port && port !== '80' && port !== '443') {
    return { blocked: true, reason: `Port ${port} is not allowed (only 80 and 443)` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 3. Domain suffix check
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0'
  ) {
    return { blocked: true, reason: 'Internal or local domain is blocked' };
  }

  // 4. IPv4 check
  // Check if hostname looks like IPv4 or dotted notation
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    const ipNum = ipv4ToInt(hostname);
    if (ipNum === null) {
      return { blocked: true, reason: 'Invalid IP address format' };
    }

    // 0.0.0.0/8
    if (inRange(ipNum, '0.0.0.0', 8)) return { blocked: true, reason: 'Reserved 0.0.0.0/8 is blocked' };
    // 127.0.0.0/8 (Loopback)
    if (inRange(ipNum, '127.0.0.0', 8)) return { blocked: true, reason: 'Loopback 127.0.0.0/8 is blocked' };
    // 10.0.0.0/8 (Private)
    if (inRange(ipNum, '10.0.0.0', 8)) return { blocked: true, reason: 'Private 10.0.0.0/8 is blocked' };
    // 172.16.0.0/12 (Private)
    if (inRange(ipNum, '172.16.0.0', 12)) return { blocked: true, reason: 'Private 172.16.0.0/12 is blocked' };
    // 192.168.0.0/16 (Private)
    if (inRange(ipNum, '192.168.0.0', 16)) return { blocked: true, reason: 'Private 192.168.0.0/16 is blocked' };
    // 169.254.0.0/16 (Link-local / cloud metadata e.g. 169.254.169.254)
    if (inRange(ipNum, '169.254.0.0', 16)) return { blocked: true, reason: 'Link-local 169.254.0.0/16 is blocked' };
    // 100.64.0.0/10 (CGNAT)
    if (inRange(ipNum, '100.64.0.0', 10)) return { blocked: true, reason: 'Carrier-grade NAT 100.64.0.0/10 is blocked' };
    // 255.255.255.255 (Broadcast)
    if (ipNum === 0xffffffff) return { blocked: true, reason: 'Broadcast IP is blocked' };
  }

  // 5. IPv6 check (enclosed in brackets e.g. [::1])
  const cleanIpv6 = hostname.replace(/^\[|\]$/g, '');
  if (
    cleanIpv6 === '::1' ||
    cleanIpv6 === '::' ||
    cleanIpv6.startsWith('fe80:') ||
    cleanIpv6.startsWith('fe8') ||
    cleanIpv6.startsWith('fe9') ||
    cleanIpv6.startsWith('fea') ||
    cleanIpv6.startsWith('feb') ||
    cleanIpv6.startsWith('fc') ||
    cleanIpv6.startsWith('fd') ||
    cleanIpv6.includes('::ffff:127.') ||
    cleanIpv6.includes('::ffff:10.') ||
    cleanIpv6.includes('::ffff:192.168.') ||
    cleanIpv6.includes('::ffff:169.254.')
  ) {
    return { blocked: true, reason: 'IPv6 loopback or private range is blocked' };
  }

  return { blocked: false };
}

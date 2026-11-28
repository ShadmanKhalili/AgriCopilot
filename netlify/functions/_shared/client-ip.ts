import { isIP } from 'node:net';

/**
 * Strict parse of a client IP address.
 *
 * Returns the address only when it is a literal IPv4 or IPv6 address, with
 * nothing else attached: no path, query, port, brackets or whitespace
 * inside. Anything else returns null, so the value is safe to place in a
 * URL path segment. An IPv4-mapped IPv6 address (`::ffff:1.2.3.4`) is
 * reduced to its IPv4 form.
 */
export function parseIpLiteral(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.trim();
  if (!value || value.length > 45 || value.includes('%')) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) value = mapped[1];
  return isIP(value) ? value : null;
}

/** True for loopback, private, link-local and other non-routable addresses. */
export function isNonPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc') ||
    lower.startsWith('fd')
  );
}

/**
 * The client's IP from a Netlify function event's headers: Netlify's own
 * `x-nf-client-connection-ip` first, then the first `x-forwarded-for` entry.
 * Returns null when neither holds a valid public IP literal.
 */
export function clientIpFromHeaders(
  headers: Record<string, string | undefined> | undefined | null
): string | null {
  if (!headers) return null;
  const lower: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') lower[key.toLowerCase()] = value;
  }
  const candidates: unknown[] = [lower['x-nf-client-connection-ip']];
  const forwarded = lower['x-forwarded-for'];
  if (forwarded) candidates.push(forwarded.split(',')[0]);
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === '') continue;
    const ip = parseIpLiteral(candidate);
    // An invalid value is not silently skipped over to a later header: the
    // first header that is present decides.
    return ip && !isNonPublicIp(ip) ? ip : null;
  }
  return null;
}

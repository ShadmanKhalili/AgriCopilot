/**
 * Shared SSRF hardening for outbound fetches.
 *
 * The Netlify functions are the production path (see `netlify.toml`, which
 * rewrites `/api/*` to `/.netlify/functions/:splat`). The Express server in
 * `server.ts` is the dev/self-hosted path. Both used to carry their own URL
 * checks and they drifted: `server.ts` grew a hardened validator while the
 * shipped Netlify function kept a four-entry host blocklist, so the code that
 * actually protects users was the code that never ran.
 *
 * This module is the single implementation both paths use. It rejects:
 *   - non-HTTP(S) schemes
 *   - loopback, private (RFC 1918), link-local (RFC 3927), carrier-grade NAT
 *     and IPv6 private address space, including IPv4-mapped IPv6 forms
 *   - cloud metadata hosts (AWS/GCP/Azure)
 *   - internal-only DNS suffixes
 *   - hostnames that resolve to any of the above
 *
 * Redirects are followed manually so every hop is re-validated — otherwise a
 * public URL can 302 straight to `169.254.169.254`.
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import type { LookupAddress } from 'node:dns';

/** Whole-request budget for a single outbound request (ms). */
export const SAFE_FETCH_TIMEOUT_MS = 8000;
/** Maximum redirect hops that will be followed. */
export const SAFE_FETCH_MAX_REDIRECTS = 3;
/** Hard cap on the response body we will buffer (1 MB). */
export const SAFE_FETCH_MAX_BYTES = 1024 * 1024;

export interface UrlValidation {
  safe: boolean;
  error?: string;
  url?: URL;
}

const BLOCKED_EXACT_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::',
  '::1',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
  '169.254.169.254',
]);

const BLOCKED_HOST_SUFFIXES = ['.internal', '.local', '.localdomain', '.corp', '.home.arpa'];

/** RFC 1918 / RFC 3927 / RFC 6598 / 0.0.0.0 / 127.0.0.0/8 in dotted-quad form. */
export function isPrivateIpv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18/15
  return false;
}

/** IPv6 loopback, unique-local (fc00::/7), link-local (fe80::/10) and IPv4-mapped forms. */
export function isPrivateIpv6(host: string): boolean {
  const bare = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (bare === '::' || bare === '::1') return true;
  if (bare.startsWith('fe80:')) return true;
  if (bare.startsWith('fc') || bare.startsWith('fd')) return true;
  // ::ffff:127.0.0.1 and ::ffff:7f00:1 both reach IPv4 loopback.
  const mappedDotted = bare.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedDotted) return isPrivateIpv4(mappedDotted[1]);
  const mappedHex = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    const octets = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff];
    return isPrivateIpv4(octets.join('.'));
  }
  return false;
}

/** True when the literal address is in a range we must never reach. */
export function isPrivateAddress(host: string): boolean {
  const bare = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (net.isIPv4(bare)) return isPrivateIpv4(bare);
  if (net.isIPv6(bare)) return isPrivateIpv6(bare);
  return false;
}

/**
 * Validate a URL that the server is about to fetch.
 *
 * The hostname is resolved and every returned address is checked, so a name
 * such as `127.0.0.1.nip.io` (or an attacker-controlled DNS record) is
 * rejected even though the literal string looks harmless.
 */
export async function validateOutboundUrl(rawUrl: string): Promise<UrlValidation> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, error: 'Invalid URL format' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { safe: false, error: 'Only HTTP and HTTPS protocols are permitted' };
  }

  // A trailing dot ("metadata.google.internal.") resolves to the same host but
  // defeats suffix checks, so normalise it away before comparing.
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '').trim();
  if (!hostname) {
    return { safe: false, error: 'Invalid URL format' };
  }

  if (BLOCKED_EXACT_HOSTS.has(hostname)) {
    return { safe: false, error: 'Access to loopback or cloud metadata endpoints is prohibited' };
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { safe: false, error: 'Access to internal domain spaces is prohibited' };
  }
  if (isPrivateAddress(hostname)) {
    return { safe: false, error: 'Access to private address space is prohibited' };
  }

  // Literal addresses are already covered above; only resolve real hostnames.
  if (!net.isIP(hostname.replace(/^\[/, '').replace(/\]$/, ''))) {
    let addresses: LookupAddress[];
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch {
      return { safe: false, error: 'Host could not be resolved' };
    }
    if (addresses.length === 0) {
      return { safe: false, error: 'Host could not be resolved' };
    }
    for (const { address } of addresses) {
      if (isPrivateAddress(address)) {
        return { safe: false, error: 'Access to private address space is prohibited' };
      }
    }
  }

  return { safe: true, url };
}

/**
 * Fetch a URL that the user supplied, with every redirect hop re-validated,
 * a hard timeout and no unbounded response buffering.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let target = rawUrl;

  for (let hop = 0; hop <= SAFE_FETCH_MAX_REDIRECTS; hop++) {
    const validation = await validateOutboundUrl(target);
    if (!validation.safe || !validation.url) {
      throw new Error(validation.error || 'Forbidden URL destination');
    }

    const response = await fetch(validation.url, {
      ...init,
      // Follow redirects by hand so each hop is validated above.
      redirect: 'manual',
      signal: init.signal ?? AbortSignal.timeout(SAFE_FETCH_TIMEOUT_MS),
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      try {
        await response.body?.cancel();
      } catch {
        // Body may already be consumed; ignore.
      }
      try {
        target = new URL(location, validation.url).toString();
      } catch {
        throw new Error('Invalid redirect target');
      }
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects');
}

/**
 * Read a response body as text, refusing anything above `limit` bytes.
 * `response.text()` has no cap, so a hostile server could stream gigabytes
 * into the function's memory.
 */
export async function readTextWithLimit(response: Response, limit: number = SAFE_FETCH_MAX_BYTES): Promise<string> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > limit) {
    throw new Error('Response too large');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      try {
        await reader.cancel();
      } catch {
        // Ignore.
      }
      throw new Error('Response too large');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

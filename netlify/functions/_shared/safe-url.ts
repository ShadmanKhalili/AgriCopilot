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
 *
 * DNS rebinding: validating a hostname and then letting `fetch()` resolve it
 * again leaves a gap in which a hostile DNS server can answer with a public
 * address for the check and `127.0.0.1` for the connection. `safeFetch` closes
 * the gap by resolving the hostname once per hop, validating every address,
 * and connecting to that validated address through a custom `lookup` (node:http
 * / node:https), keeping the original hostname for the Host header, SNI and
 * certificate check.
 */

import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { PassThrough, Readable, Transform, pipeline } from 'node:stream';
import zlib from 'node:zlib';
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
  /** The addresses the host resolved to, every one of them checked. */
  addresses?: LookupAddress[];
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

/** Resolves a hostname to every address it currently points at. */
export type HostResolver = (hostname: string) => Promise<LookupAddress[]>;

const defaultResolver: HostResolver = (hostname) => dns.lookup(hostname, { all: true });

/**
 * Validate a URL that the server is about to fetch.
 *
 * The hostname is resolved and every returned address is checked, so a name
 * such as `127.0.0.1.nip.io` (or an attacker-controlled DNS record) is
 * rejected even though the literal string looks harmless. The validated
 * addresses are returned so a caller can connect to exactly those.
 */
export async function validateOutboundUrl(
  rawUrl: string,
  resolver: HostResolver = defaultResolver
): Promise<UrlValidation> {
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
  const bareHost = hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (net.isIP(bareHost)) {
    return { safe: true, url, addresses: [{ address: bareHost, family: net.isIPv6(bareHost) ? 6 : 4 }] };
  }

  let addresses: LookupAddress[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return { safe: false, error: 'Host could not be resolved' };
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return { safe: false, error: 'Host could not be resolved' };
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      return { safe: false, error: 'Access to private address space is prohibited' };
    }
  }

  return { safe: true, url, addresses };
}

/**
 * A `lookup` function for node:http(s) that only ever answers with the address
 * that was already validated for `hostname`. It is asked again by the socket
 * layer (and again for each address family attempt), so it re-checks both the
 * name and the address every time: a different hostname, or an address in a
 * private range, is an error and no connection is made.
 */
export function createPinnedLookup(hostname: string, pinned: LookupAddress) {
  const expected = hostname.toLowerCase().replace(/\.$/, '');
  return (
    requested: string,
    options: any,
    callback?: (err: Error | null, address?: any, family?: number) => void
  ): void => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? {} : options || {};
    if (!cb) return;
    if (String(requested || '').toLowerCase().replace(/\.$/, '') !== expected) {
      cb(new Error('Pinned lookup was asked for a different host'));
      return;
    }
    if (isPrivateAddress(pinned.address)) {
      cb(new Error('Access to private address space is prohibited'));
      return;
    }
    if (opts.all) {
      cb(null, [{ address: pinned.address, family: pinned.family }]);
    } else {
      cb(null, pinned.address, pinned.family);
    }
  };
}

/** The minimal slice of a node:http client request the fetcher uses. */
export interface PinnedRequestLike {
  on(event: string, listener: (...args: any[]) => void): unknown;
  end(): unknown;
  destroy(error?: Error): unknown;
}

/** Makes the actual request. Swappable so tests need no network. */
export type PinnedTransport = (
  protocol: 'http:' | 'https:',
  options: http.RequestOptions & https.RequestOptions,
  onResponse: (res: http.IncomingMessage) => void
) => PinnedRequestLike;

const defaultTransport: PinnedTransport = (protocol, options, onResponse) =>
  (protocol === 'https:' ? https : http).request(options, onResponse);

export interface SafeFetchOptions {
  /** Largest body that will be delivered (after any decompression). */
  maxBytes?: number;
  /** Whole-request budget in ms. */
  timeoutMs?: number;
  /** Hostname resolution. Called once per hop. */
  resolver?: HostResolver;
  /** The request implementation. */
  transport?: PinnedTransport;
}

const headersToRecord = (headers: RequestInit['headers']): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!headers) return out;
  const add = (key: string, value: string) => {
    out[key.toLowerCase()] = value;
  };
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, key) => add(key, value));
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) add(key, value);
  } else {
    for (const [key, value] of Object.entries(headers as Record<string, string>)) add(key, String(value));
  }
  return out;
};

/** Ends the body with an error once it grows past `limit` bytes. */
const byteLimit = (limit: number): Transform => {
  let seen = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      seen += chunk.length;
      if (seen > limit) {
        callback(new Error('Response too large'));
        return;
      }
      callback(null, chunk);
    },
  });
};

/**
 * One request to an already-validated address. Resolves with a web `Response`
 * whose body is capped at `maxBytes`.
 */
function requestPinned(
  target: URL,
  address: LookupAddress,
  init: RequestInit,
  options: Required<Pick<SafeFetchOptions, 'maxBytes' | 'timeoutMs'>> & { transport: PinnedTransport }
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const protocol = target.protocol === 'https:' ? 'https:' : 'http:';
    const method = (init.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      reject(new Error('Only GET requests are permitted'));
      return;
    }
    const hostname = target.hostname.replace(/^\[/, '').replace(/\]$/, '');
    const isLiteral = net.isIP(hostname) !== 0;
    const headers = headersToRecord(init.headers);
    // Node does not decompress, and an unexpected encoding would defeat the
    // size cap, so ask for none; any encoding that comes back is handled below.
    if (!headers['accept-encoding']) headers['accept-encoding'] = 'identity';

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const requestOptions: http.RequestOptions & https.RequestOptions = {
      method,
      hostname,
      port: target.port || (protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers,
      // A fresh connection per request: no pooled socket from an earlier,
      // differently-resolved lookup is ever reused.
      agent: false,
      // Connect to the address that was validated, whatever DNS says now.
      lookup: createPinnedLookup(hostname, address) as any,
      ...(protocol === 'https:' && !isLiteral ? { servername: hostname } : {}),
    };

    const req = options.transport(protocol, requestOptions, (res) => {
      const status = res.statusCode || 0;
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(res.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((v) => responseHeaders.append(key, v));
        else responseHeaders.set(key, String(value));
      }

      const declared = Number(responseHeaders.get('content-length'));
      const noBody = method === 'HEAD' || status === 204 || status === 205 || status === 304;
      if (!noBody && Number.isFinite(declared) && declared > options.maxBytes) {
        res.destroy();
        req.destroy();
        finish(() => reject(new Error('Response too large')));
        return;
      }

      const encoding = String(res.headers['content-encoding'] || '').toLowerCase().trim();
      let source: Readable = res;
      const stages: Array<NodeJS.ReadWriteStream> = [];
      if (encoding === 'gzip' || encoding === 'x-gzip') stages.push(zlib.createGunzip());
      else if (encoding === 'deflate') stages.push(zlib.createInflate());
      else if (encoding === 'br') stages.push(zlib.createBrotliDecompress());
      else if (encoding && encoding !== 'identity') {
        res.destroy();
        req.destroy();
        finish(() => reject(new Error('Unsupported content encoding')));
        return;
      }
      if (stages.length) {
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');
      }

      const limited = byteLimit(options.maxBytes);
      const body = new PassThrough();
      pipeline([source, ...stages, limited, body] as any, () => {
        // Errors surface on the web stream; nothing else to do here.
      });
      body.on('close', () => {
        if (timer) clearTimeout(timer);
        try {
          req.destroy();
        } catch {
          // Already finished.
        }
      });

      finish(() =>
        resolve(
          new Response(noBody ? null : (Readable.toWeb(body) as unknown as ReadableStream), {
            status,
            headers: responseHeaders,
          })
        )
      );
      if (noBody) body.destroy();
    });

    timer = setTimeout(() => {
      const error = new Error('Request timed out');
      try {
        req.destroy(error);
      } catch {
        // Ignore.
      }
      finish(() => reject(error));
    }, options.timeoutMs);

    req.on('error', (error: Error) => {
      if (timer) clearTimeout(timer);
      finish(() => reject(error));
    });

    const signal = init.signal;
    if (signal) {
      const onAbort = () => {
        try {
          req.destroy(new Error('Aborted'));
        } catch {
          // Ignore.
        }
        finish(() => reject(new Error('Aborted')));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    req.end();
  });
}

/**
 * Fetch a URL that the user supplied, with every redirect hop re-validated,
 * the validated address pinned for the connection, a hard timeout and a cap on
 * the body.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  const maxBytes = options.maxBytes ?? SAFE_FETCH_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const transport = options.transport ?? defaultTransport;
  let target = rawUrl;

  for (let hop = 0; hop <= SAFE_FETCH_MAX_REDIRECTS; hop++) {
    const validation = await validateOutboundUrl(target, options.resolver);
    if (!validation.safe || !validation.url || !validation.addresses?.length) {
      throw new Error(validation.error || 'Forbidden URL destination');
    }

    // Prefer an IPv4 address when the host has both; the first one otherwise.
    const address = validation.addresses.find((a) => a.family === 4) ?? validation.addresses[0];
    const response = await requestPinned(validation.url, address, init, { maxBytes, timeoutMs, transport });

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

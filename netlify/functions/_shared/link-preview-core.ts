/**
 * The link-preview request handler, shared by the Netlify function and the
 * Express dev server.
 *
 * The URL comes from the browser, so this endpoint fetches an arbitrary web
 * address on the caller's behalf. It is therefore:
 *
 *   - GET only;
 *   - limited per IP address;
 *   - open to any public host only for a signed-in account (a guest account
 *     counts: the app creates one the first time a farmer uses a feature).
 *     A signed-out caller can still preview the official Bangladesh sites the
 *     scheme pages link to (`PUBLIC_PREVIEW_HOSTS`), so the scheme list works
 *     before anyone has signed in;
 *   - fetched through `safeFetch`, which pins the validated IP address (no DNS
 *     rebinding), re-validates every redirect hop, and caps time and size;
 *   - generic in its errors.
 */

import { extractBearerTokenFromHeader, verifyIdToken } from './auth.ts';
import { checkIpRateLimit } from './ip-limit.ts';
import { readTextWithLimit, safeFetch, validateOutboundUrl } from './safe-url.ts';

/** Largest page that is read (the meta tags are at the top of the document). */
export const LINK_PREVIEW_MAX_BYTES = 512 * 1024;
const MAX_URL_LENGTH = 2048;

/**
 * Hosts any visitor may preview, signed in or not: the government and bank
 * sites the seeded scheme data links to. A host matches when it equals an
 * entry or is a subdomain of one. More can be added with
 * `LINK_PREVIEW_PUBLIC_HOSTS` (comma-separated).
 */
export const PUBLIC_PREVIEW_HOSTS = [
  'gov.bd',
  'bb.org.bd',
  'krishibank.org.bd',
  'idcol.org',
  'bdnews24.com',
];

export const isPublicPreviewHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const extra = (process.env.LINK_PREVIEW_PUBLIC_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9.-]+$/.test(h));
  return [...PUBLIC_PREVIEW_HOSTS, ...extra].some((entry) => host === entry || host.endsWith(`.${entry}`));
};

/** Per-minute ceiling per IP (`LINK_PREVIEW_MAX_CALLS_PER_IP_PER_MINUTE`, default 30). */
export const linkPreviewCallsPerIpPerMinute = (): number => {
  const raw = Number(process.env.LINK_PREVIEW_MAX_CALLS_PER_IP_PER_MINUTE);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(1000, Math.trunc(raw));
};

export interface LinkPreviewInput {
  method: string;
  /** The `url` query parameter. */
  url: string | undefined;
  /** The Authorization header, when the browser sent one. */
  authorization?: string | null;
  /** The caller's IP address, when known. */
  ip: string | null;
}

export interface LinkPreviewOutput {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface LinkPreviewDeps {
  fetchPage?: typeof safeFetch;
  verifyToken?: typeof verifyIdToken;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const reply = (status: number, body: Record<string, unknown>, extra: Record<string, string> = {}): LinkPreviewOutput => ({
  status,
  headers: { ...JSON_HEADERS, ...extra },
  body,
});

const clip = (value: string | null | undefined, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const handleLinkPreview = async (
  input: LinkPreviewInput,
  deps: LinkPreviewDeps = {}
): Promise<LinkPreviewOutput> => {
  if (input.method !== 'GET') {
    return reply(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  const ipLimit = checkIpRateLimit(input.ip, linkPreviewCallsPerIpPerMinute(), 'link-preview');
  if (!ipLimit.allowed) {
    return reply(
      429,
      { error: 'Too many requests. Please try again in a moment.', retryAfterSeconds: ipLimit.retryAfterSeconds },
      { 'Retry-After': String(ipLimit.retryAfterSeconds) }
    );
  }

  const url = input.url;
  if (!url || typeof url !== 'string') {
    return reply(400, { error: 'URL is required' });
  }
  if (url.length > MAX_URL_LENGTH) {
    return reply(400, { error: 'Invalid URL' });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return reply(400, { error: 'Invalid URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return reply(400, { error: 'Invalid URL' });
  }
  const hostForDisplay = parsed.hostname;

  // A signed-in account may preview any public site; anyone else only the
  // official sites in the allow-list. A bad or expired token counts as
  // signed out rather than as an error.
  if (!isPublicPreviewHost(hostForDisplay)) {
    const token = extractBearerTokenFromHeader(input.authorization);
    const user = token ? await (deps.verifyToken ?? verifyIdToken)(token) : null;
    if (!user) {
      return reply(401, { error: 'Sign in to preview this link.' });
    }
  }

  const validation = await validateOutboundUrl(url);
  if (!validation.safe || !validation.url) {
    // The client shows a "site cannot be opened" note for an unresolvable
    // host; every other refusal is deliberately vague.
    const unresolved = validation.error === 'Host could not be resolved';
    return reply(403, { error: unresolved ? 'Host could not be resolved' : 'This link cannot be previewed.' });
  }
  const urlObj = validation.url;

  try {
    const response = await (deps.fetchPage ?? safeFetch)(
      urlObj.toString(),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
        },
      },
      { maxBytes: LINK_PREVIEW_MAX_BYTES }
    );

    const contentType = response.headers.get('content-type') || '';

    if (response.status === 403 || response.status === 404 || !contentType.includes('text/html')) {
      // Only HTML is ever read; drop the connection without the body.
      try {
        await response.body?.cancel();
      } catch {
        // Ignore.
      }
      return reply(200, {
        title: response.status === 404 ? 'Portal Not Found' : 'Portal Access Restricted',
        description:
          !contentType.includes('text/html') && response.status === 200
            ? 'This link leads to a document or secure portal. Click below to view it directly.'
            : 'This portal requires a direct visit for security verification. Please use the link below to access the official website.',
        siteName: urlObj.hostname,
        url,
        isRestricted: true,
      });
    }

    const html = await readTextWithLimit(response, LINK_PREVIEW_MAX_BYTES);

    const getMeta = (property: string): string | null => {
      const key = escapeRegExp(property);
      const match = html.match(new RegExp(`<meta [^>]*property=["']${key}["'] [^>]*content=["']([^"']*)["']`, 'i'));
      if (match) return match[1];
      const byName = html.match(new RegExp(`<meta [^>]*name=["']${key}["'] [^>]*content=["']([^"']*)["']`, 'i'));
      return byName ? byName[1] : null;
    };

    const title = getMeta('og:title') || getMeta('title') || html.match(/<title>([^<]*)<\/title>/i)?.[1];
    const description = getMeta('og:description') || getMeta('description');
    const siteName = getMeta('og:site_name');

    // Resolve relative image paths and upgrade insecure http:// images to
    // https://: the app is served over HTTPS, so the browser blocks http://
    // images as mixed content. Anything that is not a web address is dropped.
    let image: string | undefined;
    const rawImage = getMeta('og:image') || getMeta('twitter:image');
    if (rawImage) {
      try {
        const imageUrl = new URL(rawImage, urlObj);
        if (imageUrl.protocol === 'http:') imageUrl.protocol = 'https:';
        if (imageUrl.protocol === 'https:') image = clip(imageUrl.toString(), 2048);
      } catch {
        // Not a usable address: leave the image out.
      }
    }

    return reply(200, {
      title: clip(title, 300),
      description: clip(description, 600),
      image,
      siteName: clip(siteName, 120),
      url,
    });
  } catch {
    // Unreachable host, DNS failure, refused redirect, oversize page or
    // timeout: the same safe fallback, with no detail.
    return reply(200, {
      title: 'Portal Access Restricted',
      description:
        'This portal requires a direct visit to view its content. Click the link below to access the official website.',
      siteName: hostForDisplay || urlObj.hostname,
      url,
      isRestricted: true,
    });
  }
};

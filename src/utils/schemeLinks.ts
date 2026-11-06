/**
 * Corrections for scheme links we know are wrong.
 *
 * Scheme records live in Firestore and some were written by the AI search, so
 * an old record can keep a bad address long after the code is fixed. Every link
 * passes through here on its way to the screen, and on its way into the
 * database when the catalogue is refreshed.
 *
 * Each host below was checked by hand on 6 November 2026.
 */
const REPLACEMENTS: Record<string, string> = {
  // The host no longer resolves. The ministry's main site does.
  'service.moa.gov.bd': 'https://moa.gov.bd/',
  // Stops at a redirect that leads nowhere.
  'krishi.gov.bd': 'https://dae.gov.bd/',
  // Bapex is the state petroleum company, unrelated to any farm scheme.
  'www.bapex.com.bd': 'https://dae.gov.bd/',
  'bapex.com.bd': 'https://dae.gov.bd/',
};

/** These answer directly on https without the `www`. */
const CANONICAL_HOSTS: Record<string, string> = {
  'www.moa.gov.bd': 'moa.gov.bd',
  'www.badc.gov.bd': 'badc.gov.bd',
  'www.dae.gov.bd': 'dae.gov.bd',
  'bb.org.bd': 'www.bb.org.bd',
};

export const fixSchemeLink = (raw: string): string => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not a URL: leave it for safeExternalUrl to refuse.
    return raw;
  }
  const host = url.hostname.toLowerCase();
  if (REPLACEMENTS[host]) return REPLACEMENTS[host];
  const canonical = CANONICAL_HOSTS[host];
  if (!canonical) return raw;
  url.hostname = canonical;
  url.protocol = 'https:';
  return url.toString();
};

/** Corrects a scheme's links and drops the duplicates a correction can create. */
export const fixSchemeLinks = (links: readonly string[] | null | undefined): string[] =>
  Array.from(new Set((links || []).map(fixSchemeLink)));

/**
 * Client-Side Application Security & Sanitization Utilities
 * Protects against XSS, Prototype Pollution, and Malicious Prompt Injections.
 */

// 1. HTML & Special Character Entity Escaping for XSS Prevention
export function sanitizeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// 2. Safe String Truncation to prevent Denial of Client Memory
export function sanitizeString(val: unknown, maxLength: number = 2000): string {
  if (typeof val !== 'string') {
    if (val === null || val === undefined) return '';
    return String(val).slice(0, maxLength);
  }
  return val.trim().slice(0, maxLength);
}

// 3. Prompt Injection Guard for AI Inputs
// Detects and neutralizes jailbreak attempts, system override phrases, and delimiter breakouts
const SUSPICIOUS_PROMPT_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|directives|prompts)/i,
  /system\s*:\s*you\s+are\s+now/i,
  /act\s+as\s+a\s+(dan|jailbreak|unrestricted)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+rules|api\s*key)/i,
  /bypass\s+(safety|content\s+policy|rules)/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[INST\]/i
];

export function sanitizePromptInput(userInput: string, maxChars: number = 4000): { sanitized: string; isFlagged: boolean } {
  const bounded = sanitizeString(userInput, maxChars);
  let isFlagged = false;

  for (const pattern of SUSPICIOUS_PROMPT_PATTERNS) {
    if (pattern.test(bounded)) {
      isFlagged = true;
      break;
    }
  }

  // Strip control characters while preserving valid newlines, tabs, and Unicode (Bangla/English)
  const sanitized = bounded.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  return { sanitized, isFlagged };
}

// 5. Safe external links
//
// Scheme links that a farmer is invited to open are a phishing surface: an
// `https://evil.example` link rendered as "Government Subsidy Portal" sends
// the farmer — and any reputation the portal has earned — somewhere else.
// Only real web addresses are ever turned into an anchor target, and the
// hostname is shown so the destination is visible before the tap.

const SAFE_EXTERNAL_PROTOCOLS = ['http:', 'https:'];

/**
 * Return the URL if it is a safe external destination, otherwise null.
 *
 * Rejects `javascript:`, `data:`, `vbscript:`, `blob:` and every other
 * scheme, as well as anything that does not parse as a URL.
 */
export function safeExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!SAFE_EXTERNAL_PROTOCOLS.includes(parsed.protocol)) return null;
  // A hostname has to exist; `https://` alone is not a destination.
  if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
  return parsed.toString();
}

/**
 * The hostname of an external URL, for display next to the link so the
 * destination is obvious. Returns an empty string for anything unsafe.
 */
export function externalHostLabel(url: unknown): string {
  const safe = safeExternalUrl(url);
  if (!safe) return '';
  try {
    return new URL(safe).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// 4. Safe LocalStorage with Prototype Pollution Guard
export const safeStorage = {
  getItem<T = any>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      
      const parsed = JSON.parse(raw);
      // Guard against Prototype Pollution.
      // NOTE: use Object.hasOwn (own-property check) — the `in` operator also matches
      // inherited Object.prototype members ('__proto__', 'constructor', 'prototype'),
      // which are present on every object and made this check always true.
      if (parsed && typeof parsed === 'object') {
        if (Object.hasOwn(parsed, '__proto__') || Object.hasOwn(parsed, 'constructor') || Object.hasOwn(parsed, 'prototype')) {
          console.warn(`[Security Alert] Prototype pollution detected in localStorage key: ${key}`);
          return fallback;
        }
      }
      return parsed;
    } catch {
      return fallback;
    }
  },

  setItem(key: string, value: any): boolean {
    try {
      // Ensure no circular or prototype pollution
      const serialized = JSON.stringify(value, (k, v) => {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
          return undefined;
        }
        return v;
      });
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      console.warn(`[Security Alert] Failed to set localStorage key: ${key}`, e);
      return false;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
};

import { Handler } from "@netlify/functions";
import { extractClientIpFromHeaders } from "./_shared/ip-limit.ts";
import { handleLinkPreview } from "./_shared/link-preview-core.ts";

/**
 * Netlify link-preview function.
 *
 * The URL arrives from the browser, so this endpoint is a request proxy: it
 * must never be usable to reach the function's own network, and it must not be
 * an open relay. The rules (GET only, per-IP limit, sign-in or an allow-listed
 * host, pinned-IP fetch with re-validated redirects, size and time caps,
 * generic errors) live in `_shared/link-preview-core.ts`, which the Express
 * server in `server.ts` also calls.
 *
 * The browser calls this same-origin (`/api/link-preview?url=...`), so no
 * permissive CORS header is sent: a wildcard would let any website drive this
 * proxy from a visitor's browser.
 */
export const handler: Handler = async (event) => {
  const headers = event.headers as Record<string, string | undefined> | undefined;
  const result = await handleLinkPreview({
    method: event.httpMethod,
    url: event.queryStringParameters?.url,
    authorization: headers?.authorization || headers?.Authorization,
    ip: extractClientIpFromHeaders(headers),
  });
  return {
    statusCode: result.status,
    headers: result.headers,
    body: JSON.stringify(result.body),
  };
};

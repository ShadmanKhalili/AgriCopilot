import { Handler } from "@netlify/functions";
import { validateOutboundUrl, safeFetch, readTextWithLimit } from "./_shared/safe-url.ts";

/**
 * Netlify link-preview function.
 *
 * The URL arrives from the browser, so this endpoint is a request proxy: it
 * must never be usable to reach the function's own network. All SSRF
 * protections live in `_shared/safe-url.ts`, which the Express server in
 * `server.ts` also uses — the two used to drift, and the weaker copy shipped.
 *
 * The browser calls this same-origin (`/api/link-preview?url=...`), so no
 * permissive CORS header is sent: a wildcard would let any website drive this
 * proxy from a visitor's browser.
 */
export const handler: Handler = async (event) => {
  const { url } = event.queryStringParameters || {};
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "URL is required" }) };
  }

  let hostForDisplay = "";
  try {
    hostForDisplay = new URL(url).hostname;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid URL" }) };
  }

  const validation = await validateOutboundUrl(url);
  if (!validation.safe || !validation.url) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: validation.error || "Forbidden URL destination" }),
    };
  }
  const urlObj = validation.url;

  try {
    const response = await safeFetch(urlObj.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;'
      }
    });

    const contentType = response.headers.get('content-type') || '';

    if (response.status === 403 || response.status === 404 || !contentType.includes('text/html')) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: response.status === 404 ? "Portal Not Found" : "Portal Access Restricted",
          description: !contentType.includes('text/html') && response.status === 200
            ? "This link leads to a document or secure portal. Click below to view it directly."
            : "This portal requires a direct visit for security verification. Please use the link below to access the official website.",
          siteName: urlObj.hostname,
          url: url,
          isRestricted: true
        })
      };
    }

    const html = await readTextWithLimit(response);

    const getMeta = (property: string) => {
      const regex = new RegExp(`<meta [^>]*property=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      if (match) return match[1];

      const regexName = new RegExp(`<meta [^>]*name=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
      const matchName = html.match(regexName);
      return matchName ? matchName[1] : null;
    };

    const title = getMeta('og:title') || getMeta('title') || html.match(/<title>([^<]*)<\/title>/i)?.[1];
    const description = getMeta('og:description') || getMeta('description');
    const siteName = getMeta('og:site_name');

    // Resolve relative image paths and upgrade insecure http:// images to https://.
    // Our page is served over HTTPS, so the browser blocks http:// images as mixed content.
    const rawImage = getMeta('og:image') || getMeta('twitter:image');
    let image: string | null = rawImage;
    if (image) {
      try {
        const imageUrl = new URL(image, urlObj);
        if (imageUrl.protocol === 'http:') imageUrl.protocol = 'https:';
        image = imageUrl.toString();
      } catch {
        // Keep the original value if it cannot be parsed.
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title?.trim(),
        description: description?.trim(),
        image: image,
        siteName: siteName,
        url: url
      })
    };

  } catch (error: any) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Portal Access Restricted",
        description: "This portal requires a direct visit to view its content. Click the link below to access the official website.",
        siteName: hostForDisplay || urlObj.hostname,
        url: url,
        isRestricted: true
      })
    };
  }
};

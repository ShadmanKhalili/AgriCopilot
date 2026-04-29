import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  const { url } = event.queryStringParameters || {};
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: "URL is required" }) };
  }

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid URL" }) };
  }

  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
  if (blockedHosts.includes(urlObj.hostname) || urlObj.hostname.startsWith('192.168.') || urlObj.hostname.startsWith('10.')) {
    return { statusCode: 403, body: JSON.stringify({ error: "Access to internal resources is prohibited" }) };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    
    if (response.status === 403 || response.status === 404 || !contentType.includes('text/html')) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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

    const html = await response.text();

    const getMeta = (property: string) => {
      const regex = new RegExp(`<meta [^>]*property=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
      const match = html.match(regex);
      if (match) return match[1];
      
      const regexName = new RegExp(`<meta [^>]*name=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
      const matchName = html.match(regexName);
      return matchName ? matchName[1] : null;
    };

    const title = getMeta('og:title') || getMeta('title') || html.match(/<title>([^<]*)<\\/title>/i)?.[1];
    const description = getMeta('og:description') || getMeta('description');
    const image = getMeta('og:image') || getMeta('twitter:image');
    const siteName = getMeta('og:site_name');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        title: "Portal Access Restricted",
        description: "This portal requires a direct visit to view its content. Click the link below to access the official website.",
        siteName: urlObj.hostname,
        url: url,
        isRestricted: true
      })
    };
  }
};

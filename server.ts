import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AdSense & Bot verification
  app.get("/ads.txt", (req, res) => {
    res.type("text/plain");
    res.send("google.com, pub-8294149074042302, DIRECT, f08c47fec0942fa0");
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nAllow: /");
  });

  // Sentinel Hub Proxy
  app.post("/.netlify/functions/sentinel", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const rawClientId = process.env.SENTINEL_HUB_CLIENT_ID || "";
      const rawClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET || "";
      
      // Clean up credentials (remove accidental spaces or quotes)
      const clientId = rawClientId.trim().replace(/^["']|["']$/g, '');
      const clientSecret = rawClientSecret.trim().replace(/^["']|["']$/g, '');

      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: "Sentinel Hub credentials not configured" });
      }

      // 1. Get OAuth Token (Try CDSE first, fallback to Classic Sentinel Hub)
      let accessToken = "";
      let processEndpoint = "";

      try {
        const authResponse = await axios.post(
          "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
          new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        accessToken = authResponse.data.access_token;
        processEndpoint = "https://sh.dataspace.copernicus.eu/api/v1/process";
      } catch (cdseError: any) {
        console.log("CDSE Auth failed, trying classic Sentinel Hub...");
        const authResponse = await axios.post(
          "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
          new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        accessToken = authResponse.data.access_token;
        processEndpoint = "https://services.sentinel-hub.com/api/v1/process";
      }

      // 2. Fetch NDVI & NDMI via Statistical API
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const offset = 0.001; // ~100m
      const bbox = [lngNum - offset, latNum - offset, lngNum + offset, latNum + offset];

      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - 30); // Look back 30 days
      
      // CDSE expects strict ISO 8601 without milliseconds
      const toDateStr = toDate.toISOString().split('.')[0] + 'Z';
      const fromDateStr = fromDate.toISOString().split('.')[0] + 'Z';

      const statsEndpoint = processEndpoint.replace('/process', '/statistics');

      const processResponse = await axios.post(
        statsEndpoint,
        {
          input: {
            bounds: {
              bbox: bbox
            },
            data: [{ 
              type: "sentinel-2-l2a",
              dataFilter: {
                timeRange: {
                  from: fromDateStr,
                  to: toDateStr
                },
                maxCloudCoverage: 30
              }
            }]
          },
          aggregation: {
            timeRange: {
              from: fromDateStr,
              to: toDateStr
            },
            aggregationInterval: {
              of: "P30D"
            },
            evalscript: `
              //VERSION=3
              function setup() {
                return {
                  input: ["B04", "B08", "B11", "SCL", "dataMask"],
                  output: [
                    { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
                    { id: "ndmi", bands: 1, sampleType: "FLOAT32" },
                    { id: "dataMask", bands: 1 }
                  ]
                };
              }
              function evaluatePixel(sample) {
                // SCL: 3=Cloud shadow, 8=Cloud medium prob, 9=Cloud high prob, 10=Thin cirrus
                let isCloud = [3, 8, 9, 10].includes(sample.SCL);
                let valid = sample.dataMask === 1 && !isCloud;

                let ndvi = 0;
                let ndmi = 0;

                if (valid) {
                  let ndviDenom = sample.B08 + sample.B04;
                  ndvi = ndviDenom === 0 ? 0 : (sample.B08 - sample.B04) / ndviDenom;
                  
                  let ndmiDenom = sample.B08 + sample.B11;
                  ndmi = ndmiDenom === 0 ? 0 : (sample.B08 - sample.B11) / ndmiDenom;
                }

                return {
                  ndvi: [ndvi],
                  ndmi: [ndmi],
                  dataMask: [valid ? 1 : 0]
                };
              }
            `,
            resx: 10,
            resy: 10
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          }
        }
      );

      // Extract the mean NDVI and NDMI
      let ndviValue = 0;
      let ndmiValue = 0;
      try {
        const statsNdvi = processResponse.data.data[0].outputs.ndvi.bands.B0.stats;
        ndviValue = statsNdvi.mean;
        
        const statsNdmi = processResponse.data.data[0].outputs.ndmi.bands.B0.stats;
        ndmiValue = statsNdmi.mean;
      } catch (e) {
        console.warn("Could not parse mean values from stats response", e);
      }
      
      return res.json({ ndvi: ndviValue, ndmi: ndmiValue });

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error?.message || errorData?.message || error.message;
      console.error("Sentinel Hub Error:", JSON.stringify(errorData, null, 2) || error.message);
      return res.status(500).json({ error: errorMessage, details: errorData });
    }
  });

  // Proxy for IP Geolocation fallback
  app.get("/api/ip-location", async (req, res) => {
    try {
      const response = await axios.get('https://get.geojs.io/v1/ip/geo.json', { timeout: 5000 });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Reverse Geocoding
  app.get("/api/loc-lookup", async (req, res) => {
    try {
      const response = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client`, {
        params: req.query
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Weather API
  app.get("/api/daily-forecast", async (req, res) => {
    try {
      console.log(`Proxying Weather request to Open-Meteo for lat: ${req.query.latitude}, lng: ${req.query.longitude}`);
      const response = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
        params: req.query,
        timeout: 10000 // 10s timeout
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Weather Proxy Error:", error.message);
      res.status(500).json({ 
        error: "Failed to fetch weather data from Open-Meteo",
        details: error.message
      });
    }
  });

  // Proxy for Climate API
  app.get("/api/historical-data", async (req, res) => {
    try {
      console.log(`Proxying Climate request to Open-Meteo for lat: ${req.query.latitude}, lng: ${req.query.longitude}`);
      const response = await axios.get(`https://archive-api.open-meteo.com/v1/archive`, {
        params: req.query,
        timeout: 15000 // 15s timeout
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Climate Proxy Error:", error.message);
      res.status(500).json({ 
        error: "Failed to fetch historical climate data from Open-Meteo",
        details: error.message 
      });
    }
  });

  // Proxy for Soil API
  app.get("/api/soil-properties", async (req, res) => {
    try {
      console.log(`Proxying Soil request to ISRIC for lat: ${req.query.lat}, lng: ${req.query.lon}`);
      const params = new URLSearchParams();
      for (const key in req.query) {
        const value = req.query[key];
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v as string));
        } else {
          params.append(key, value as string);
        }
      }
      const response = await axios.get(`https://rest.isric.org/soilgrids/v2.0/properties/query?${params.toString()}`, {
        timeout: 20000 // 20s timeout (SoilGrids is slow)
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Soil Proxy Error:", error.message);
      res.status(500).json({ 
        error: "Failed to fetch soil properties from ISRIC SoilGrids",
        details: error.message 
      });
    }
  });

  // Proxy for World Bank API
  app.get("/api/wb-indicators", async (req, res) => {
    try {
      const { country, ind, ...rest } = req.query;
      
      if (!country || !ind) {
        return res.status(400).json({ error: "Missing country or indicator parameter" });
      }

      const url = `https://api.worldbank.org/v2/country/${country}/indicator/${ind}`;
      console.log(`Proxying World Bank request to: ${url}`);

      const response = await axios.get(url, {
        params: {
          ...rest,
          format: 'json'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 20000 // Increased to 20s
      });
      
      res.json(response.data);
    } catch (error: any) {
      console.error("World Bank Proxy Error:", error.message);
      if (error.response) {
        console.error("World Bank API Response Error:", error.response.status, error.response.data);
      }
      res.status(error.response?.status || 500).json({ 
        error: error.message,
        details: error.response?.data 
      });
    }
  });

  // Link Preview Helper
  app.get("/api/link-preview", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL is required" });
    }

    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    try {
      console.log(`Fetching link preview for: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Referer': urlObj.origin + '/'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        timeout: 10000,
        maxRedirects: 10,
        validateStatus: (status) => status < 500
      });

      const contentType = response.headers['content-type'] || '';
      
      if (response.status === 403 || response.status === 404 || !contentType.includes('text/html')) {
        return res.json({
          title: response.status === 404 ? "Portal Not Found" : "Portal Access Restricted",
          description: !contentType.includes('text/html') && response.status === 200 
            ? "This link leads to a document or secure portal. Click below to view it directly."
            : "This portal requires a direct visit for security verification. Please use the link below to access the official website.",
          siteName: urlObj.hostname,
          url: url,
          isRestricted: true
        });
      }

      const html = typeof response.data === 'string' ? response.data : '';
      
      // Basic meta tag extraction via regex (simple and effective for most OG sites)
      const getMeta = (property: string) => {
        const regex = new RegExp(`<meta [^>]*property=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
        const match = html.match(regex);
        if (match) return match[1];
        
        // Try fallback for name attribute
        const regexName = new RegExp(`<meta [^>]*name=["']${property}["'] [^>]*content=["']([^"']*)["']`, 'i');
        const matchName = html.match(regexName);
        return matchName ? matchName[1] : null;
      };

      const title = getMeta('og:title') || getMeta('title') || html.match(/<title>([^<]*)<\/title>/i)?.[1];
      const description = getMeta('og:description') || getMeta('description');
      const image = getMeta('og:image') || getMeta('twitter:image');
      const siteName = getMeta('og:site_name');

      res.json({
        title: title?.trim(),
        description: description?.trim(),
        image: image,
        siteName: siteName,
        url: url
      });

    } catch (error: any) {
      const statusCode = error.response?.status;
      const statusText = error.response?.statusText || error.message;
      
      // Silence logs for expected restricted states
      if (statusCode !== 403 && statusCode !== 404) {
        console.error(`Link Preview Error [${statusCode || 'NETWORK'}]:`, statusText);
      }
      
      // Secondary fallback in case validateStatus was bypassed or something else threw
      if (statusCode === 403 || statusCode === 404) {
        return res.json({
          title: statusCode === 404 ? "Portal Not Found" : "Portal Access Restricted",
          description: "This portal requires a direct visit to view its content. Click the link below to access the official website.",
          siteName: urlObj.hostname,
          url: url,
          isRestricted: true
        });
      }
      
      res.status(500).json({ error: "Failed to fetch link preview" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

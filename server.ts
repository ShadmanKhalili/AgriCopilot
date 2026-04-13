import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  // Proxy for Reverse Geocoding
  app.get("/api/reverse-geocode", async (req, res) => {
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
  app.get("/api/weather", async (req, res) => {
    try {
      const response = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
        params: req.query
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Climate API
  app.get("/api/climate", async (req, res) => {
    try {
      const response = await axios.get(`https://archive-api.open-meteo.com/v1/archive`, {
        params: req.query
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Soil API
  app.get("/api/soil", async (req, res) => {
    try {
      // Axios handles array params like property=phh2o&property=nitrogen correctly if passed as an array
      // However, req.query might already be parsed correctly by Express
      const params = new URLSearchParams();
      for (const key in req.query) {
        const value = req.query[key];
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v as string));
        } else {
          params.append(key, value as string);
        }
      }
      const response = await axios.get(`https://rest.isric.org/soilgrids/v2.0/properties/query?${params.toString()}`);
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for World Bank API
  app.get("/api/worldbank", async (req, res) => {
    try {
      const { country, indicator, ...rest } = req.query;
      const response = await axios.get(`https://api.worldbank.org/v2/country/${country}/indicator/${indicator}`, {
        params: rest
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

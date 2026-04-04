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

  // Sentinel Hub Proxy (matching Netlify function path for local dev)
  app.post("/.netlify/functions/sentinel", async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const rawClientId = process.env.SENTINEL_HUB_CLIENT_ID || "";
      const rawClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET || "";
      
      // Clean up credentials (remove accidental spaces or quotes)
      const clientId = rawClientId.trim().replace(/^["']|["']$/g, '');
      const clientSecret = rawClientSecret.trim().replace(/^["']|["']$/g, '');

      console.log("--- AUTH DEBUG INFO ---");
      console.log(`Client ID length: ${clientId.length}`);
      console.log(`Client ID starts with: ${clientId.substring(0, 4)}...`);
      console.log(`Client Secret length: ${clientSecret.length}`);
      console.log("-----------------------");

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

      // 2. Fetch NDVI via Statistical API
      // We define a small BBox around the point
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const offset = 0.001; // ~100m
      const bbox = [lngNum - offset, latNum - offset, lngNum + offset, latNum + offset];

      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - 30); // Look back 30 days for a clear image
      
      // CDSE expects strict ISO 8601 without milliseconds in some cases
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
                }
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
                  input: ["B04", "B08", "B11", "dataMask"],
                  output: [
                    { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
                    { id: "ndmi", bands: 1, sampleType: "FLOAT32" },
                    { id: "dataMask", bands: 1 }
                  ]
                };
              }
              function evaluatePixel(sample) {
                let ndviDenom = sample.B08 + sample.B04;
                let ndvi = ndviDenom === 0 ? 0 : (sample.B08 - sample.B04) / ndviDenom;
                
                let ndmiDenom = sample.B08 + sample.B11;
                let ndmi = ndmiDenom === 0 ? 0 : (sample.B08 - sample.B11) / ndmiDenom;

                return {
                  ndvi: [ndvi],
                  ndmi: [ndmi],
                  dataMask: [sample.dataMask]
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

      // Extract the mean NDVI and NDMI from the Statistical API response
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
      
      res.json({ ndvi: ndviValue, ndmi: ndmiValue });

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error?.message || errorData?.message || error.message;
      console.error("Sentinel Hub Error:", JSON.stringify(errorData, null, 2) || error.message);
      res.status(500).json({ error: errorMessage, details: errorData });
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

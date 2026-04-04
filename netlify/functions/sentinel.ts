import { Handler } from '@netlify/functions';
import axios from 'axios';

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { lat, lng } = body;

    const rawClientId = process.env.SENTINEL_HUB_CLIENT_ID || "";
    const rawClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET || "";
    
    // Clean up credentials (remove accidental spaces or quotes)
    const clientId = rawClientId.trim().replace(/^["']|["']$/g, '');
    const clientSecret = rawClientSecret.trim().replace(/^["']|["']$/g, '');

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Sentinel Hub credentials not configured" })
      };
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
    
    return {
      statusCode: 200,
      body: JSON.stringify({ ndvi: ndviValue, ndmi: ndmiValue })
    };

  } catch (error: any) {
    const errorData = error.response?.data;
    const errorMessage = errorData?.error?.message || errorData?.message || error.message;
    console.error("Sentinel Hub Error:", JSON.stringify(errorData, null, 2) || error.message);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage, details: errorData })
    };
  }
};

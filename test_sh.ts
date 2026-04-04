import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const clientId = process.env.SENTINEL_HUB_CLIENT_ID?.trim().replace(/^["']|["']$/g, '') || '';
    const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET?.trim().replace(/^["']|["']$/g, '') || '';

    const authResponse = await axios.post(
      "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const accessToken = authResponse.data.access_token;
    console.log("Got token");

    const processResponse = await axios.post(
      "https://sh.dataspace.copernicus.eu/api/v1/statistics",
      {
        input: {
          bounds: {
            bbox: [12.44693, 41.89025, 12.45693, 41.90025]
          },
          data: [{ 
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: {
                from: "2024-01-01T00:00:00Z",
                to: "2024-02-01T00:00:00Z"
              }
            }
          }]
        },
        aggregation: {
          timeRange: {
            from: "2024-01-01T00:00:00Z",
            to: "2024-02-01T00:00:00Z"
          },
          aggregationInterval: {
            of: "P30D"
          },
          evalscript: `
            //VERSION=3
            function setup() {
              return {
                input: ["B04", "B08", "dataMask"],
                output: [
                  { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
                  { id: "dataMask", bands: 1 }
                ]
              };
            }
            function evaluatePixel(sample) {
              let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
              return {
                ndvi: [ndvi],
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
    console.log("Success:", JSON.stringify(processResponse.data, null, 2));
  } catch (e: any) {
    console.error("Error:", JSON.stringify(e.response ? e.response.data : e.message, null, 2));
  }
}
test();

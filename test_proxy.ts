import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/wb-data?country=BGD&ind=NV.AGR.TOTL.ZS&per_page=30');
    console.log("Status:", res.status);
    console.log("Data length:", res.data.length);
    console.log("Data[0]:", res.data[0]);
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.response) console.error("Response:", e.response.status, e.response.data);
  }
}
test();

import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/weather?latitude=23.8103&longitude=90.4125&current=temperature_2m');
    console.log("Status:", res.status);
    console.log("Data:", res.data);
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.response) console.error("Response:", e.response.status, e.response.data);
  }
}
test();

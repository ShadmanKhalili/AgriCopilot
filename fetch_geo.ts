import fs from 'fs';
import https from 'https';

const fetchJson = (url: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
};

async function main() {
  const districtsUrl = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/districts/districts.json';
  const upazilasUrl = 'https://raw.githubusercontent.com/nuhil/bangladesh-geocode/master/upazilas/upazilas.json';

  const dData = await fetchJson(districtsUrl);
  const uData = await fetchJson(upazilasUrl);

  const districts = dData[2].data;
  const upazilas = uData[2].data;

  const geoData: any = {};

  for (const d of districts) {
    geoData[d.id] = {
      id: d.id,
      name: d.name,
      bn_name: d.bn_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      upazilas: []
    };
  }

  for (const u of upazilas) {
    if (geoData[u.district_id]) {
      geoData[u.district_id].upazilas.push({
        id: u.id,
        name: u.name,
        bn_name: u.bn_name,
        lat: parseFloat(u.lat) || geoData[u.district_id].lat, // Fallback to district lat/lng if missing
        lng: parseFloat(u.lon) || geoData[u.district_id].lng
      });
    }
  }

  const sortedDistricts = Object.values(geoData).sort((a: any, b: any) => a.name.localeCompare(b.name));
  sortedDistricts.forEach((d: any) => {
    d.upazilas.sort((a: any, b: any) => a.name.localeCompare(b.name));
  });

  const fileContent = `export interface Upazila {
  id: string;
  name: string;
  bn_name: string;
  lat: number;
  lng: number;
}

export interface District {
  id: string;
  name: string;
  bn_name: string;
  lat: number;
  lng: number;
  upazilas: Upazila[];
}

export const geoData: District[] = ${JSON.stringify(sortedDistricts, null, 2)};
`;

  fs.writeFileSync('src/utils/geoData.ts', fileContent);
  console.log('Successfully generated src/utils/geoData.ts');
}

main();

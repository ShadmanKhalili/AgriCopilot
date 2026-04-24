import fs from 'fs';
let text = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

text = text.replace(
  '{geoData.map(d => (\n                      <option value="">{lang === \'bn\' ? \'জেলা নির্বাচন করুন (ঐচ্ছিক)\' : \'Select District (Optional)\'}</option>\n                        <option key={d.id} value={d.id}>{lang === \'bn\' ? d.bn_name : d.name}</option>\n                    ))}',
  '<option value="">{lang === \'bn\' ? \'জেলা নির্বাচন করুন (ঐচ্ছিক)\' : \'Select District (Optional)\'}</option>\n                    {geoData.map(d => (\n                      <option key={d.id} value={d.id}>{lang === \'bn\' ? d.bn_name : d.name}</option>\n                    ))}'
);

text = text.replace(
  '{activeDistrict?.upazilas.map(u => (\n                      <option value="">{lang === \'bn\' ? \'উপজেলা নির্বাচন করুন (ঐচ্ছিক)\' : \'Select Upazila (Optional)\'}</option>\n                        <option key={u.id} value={u.id}>{lang === \'bn\' ? u.bn_name : u.name}</option>\n                    ))}',
  '<option value="">{lang === \'bn\' ? \'উপজেলা নির্বাচন করুন (ঐচ্ছিক)\' : \'Select Upazila (Optional)\'}</option>\n                    {activeDistrict?.upazilas.map(u => (\n                      <option key={u.id} value={u.id}>{lang === \'bn\' ? u.bn_name : u.name}</option>\n                    ))}'
);

fs.writeFileSync('src/components/AgriCopilot.tsx', text);

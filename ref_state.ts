import * as fs from 'fs';

let content = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

// Change default states
content = content.replace(
  "const [cropStage, setCropStage] = useState(persistedCropStage || 'vegetative');",
  "const [cropStage, setCropStage] = useState(persistedCropStage || '');"
);

content = content.replace(
  "const [crop, setCrop] = useState(persistedCrop || CROPS[0]);",
  "const [crop, setCrop] = useState(persistedCrop || '');"
);

content = content.replace(
  "const [analysisType, setAnalysisType] = useState(persistedAnalysisType || 'disease');",
  "const [analysisType, setAnalysisType] = useState(persistedAnalysisType || '');"
);

content = content.replace(
  "const [selectedDistrict, setSelectedDistrict] = useState(geoData[0].id);",
  "const [selectedDistrict, setSelectedDistrict] = useState('');"
);

content = content.replace(
  "const [selectedUpazila, setSelectedUpazila] = useState(geoData[0].upazilas[0]?.id || '');",
  "const [selectedUpazila, setSelectedUpazila] = useState('');"
);

// Add empty option to crop
content = content.replace(
  '{CROPS.map(c => (',
  '<option value="">{lang === \'bn\' ? \'স্বয়ংক্রিয় সনাক্তকরণ\' : \'Auto detect\'}</option>\n                  {CROPS.map(c => ('
);

// Add empty option to crop stage
content = content.replace(
  '{Object.keys(translations.en.stages).map(s => (',
  '<option value="">{lang === \'bn\' ? \'স্বয়ংক্রিয় সনাক্তকরণ\' : \'Auto detect\'}</option>\n                  {Object.keys(translations.en.stages).map(s => ('
);

// Add empty option to analysis type
content = content.replace(
  '<option value="disease">{t.analysisDisease}</option>',
  '<option value="">{lang === \'bn\' ? \'সাধারণ বিশ্লেষণ\' : \'General Analysis\'}</option>\n                  <option value="disease">{t.analysisDisease}</option>'
);

// Add empty option to district
const districtStart = content.indexOf('<option key={d.id} value={d.id}>');
content = content.substring(0, districtStart) + '<option value="">{lang === \'bn\' ? \'জেলা নির্বাচন করুন (ঐচ্ছিক)\' : \'Select District (Optional)\'}</option>\n                        ' + content.substring(districtStart);

// Add empty option to upazila
const upazilaStart = content.indexOf('<option key={u.id} value={u.id}>');
content = content.substring(0, upazilaStart) + '<option value="">{lang === \'bn\' ? \'উপজেলা নির্বাচন করুন (ঐচ্ছিক)\' : \'Select Upazila (Optional)\'}</option>\n                        ' + content.substring(upazilaStart);

// Handle the case where they are empty when calling AI:
// If crop is empty, AI should detect. The prompt currently says: `A user uploaded an image of a ${crop} plant at the ${cropStage} stage. They are looking for a deep analysis regarding ${analysisType}.`
// We need to pass "Unknown " or adjust ai prompt or just say "crop". Let's handle this in ai.ts or just rely on Gemini. It usually figures it out if we say "" or "Unknown".

fs.writeFileSync('src/components/AgriCopilot.tsx', content);
console.log('States refactored');

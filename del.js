import fs from 'fs';
const text = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');
const lines = text.split('\n');
lines.splice(745, 1); // remove line 746 (index 745)
fs.writeFileSync('src/components/AgriCopilot.tsx', lines.join('\n'));

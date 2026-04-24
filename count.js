import fs from 'fs';
const text = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf-8');
const openCount = (text.match(/<motion\.div/g) || []).length;
const closeCount = (text.match(/<\/motion\.div>/g) || []).length;
console.log('Open:', openCount, 'Close:', closeCount);

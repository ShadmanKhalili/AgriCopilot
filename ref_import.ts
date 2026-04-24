import * as fs from 'fs';

let content = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

// Add Bug and Activity to the import
content = content.replace("ThumbsDown } from 'lucide-react';", "ThumbsDown, Bug, Activity } from 'lucide-react';");

fs.writeFileSync('src/components/AgriCopilot.tsx', content);
console.log('Imports updated');

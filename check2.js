import fs from 'fs';

const html = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

// The easiest way to fix formatting is to run it through prettier? We don't have it installed.
// The typescript compiler at 747 said: Expected corresponding JSX closing tag for 'motion.div'.
// Let's just output lines 740-755 from the file.

console.log(html.split('\n').slice(730, 755).map((l, i) => (i+731) + ': ' + l).join('\n'));

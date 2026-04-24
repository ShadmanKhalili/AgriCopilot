import fs from 'fs';

const html = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

let stack = [];
let lines = html.split('\n');

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // A very naive heuristic to find tag mismatches
  // Look for `<motion.div` and `</motion.div>`
  let openMatches = line.match(/<motion\.div[^>]*>/g) || [];
  let closeMatches = line.match(/<\/motion\.div>/g) || [];
  
  for (let match of openMatches) { stack.push(`motion.div:${i+1}`); }
  for (let match of closeMatches) { 
    if (stack.length > 0 && stack[stack.length-1].startsWith('motion.div')) {
      stack.pop();
    } else {
      console.log('Unmatched close at line', i+1);
    }
  }
}
console.log('Unmatched opens:', stack);

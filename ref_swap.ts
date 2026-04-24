import * as fs from 'fs';

let content = fs.readFileSync('src/components/AgriCopilot.tsx', 'utf8');

// The deep analysis block starts with `{deepDiagnosis ? (` up to `)}`
// We need to find the Chatbot section from ` <div className="mt-8">\n  {/* Chatbot Section` up to ` {/* 4. Chat with Expert (Search DAE) - Indicative */}`
const chatbotStart = content.indexOf('<div className="mt-8">\n  {/* Chatbot Section (Moved to Left Column) */}');
const chatbotEnd = content.indexOf('{/* 4. Chat with Expert (Search DAE) - Indicative */}');

if (chatbotStart === -1 || chatbotEnd === -1) throw new Error("Could not find chatbot section boundaries");

const chatbotBlock = content.substring(chatbotStart, chatbotEnd);

// Remove chatbotBlock from current position
content = content.substring(0, chatbotStart) + content.substring(chatbotEnd);

// Find where to insert it: RIGHT BEFORE deep diagnosis section which starts at `<div className="mt-8 pt-8 border-t border-gray-100">\n                          <div className="flex items-center space-x-3 mb-6">\n                            <div className="bg-blue-100 p-2.5 rounded-xl">\n                              <Globe` wait. Let's find "Deep Analysis Button"
const deepStartStr = '{deepDiagnosis ? (';
let deepStartIndex = content.indexOf(deepStartStr);

if (deepStartIndex !== -1) {
    // let's insert it before the container of deep analysis or right before it.
    content = content.substring(0, deepStartIndex) + chatbotBlock + '\n                          ' + content.substring(deepStartIndex);
} else {
    throw new Error('Could not find deep start');
}

fs.writeFileSync('src/components/AgriCopilot.tsx', content);
console.log('Swapped Chatbot and Deep Analysis!');

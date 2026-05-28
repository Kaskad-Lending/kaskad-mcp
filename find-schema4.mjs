import { readFileSync } from 'fs';

const src = readFileSync('C:/Users/jackb/AppData/Roaming/npm/node_modules/openclaw/dist/protocol-C6T5DFc8.js', 'utf8');

// Find the MessageAction schema
const idx = src.indexOf('MessageAction');
console.log(src.slice(Math.max(0, idx - 100), idx + 1500));

import { readFileSync } from 'fs';

const src = readFileSync('C:/Users/jackb/AppData/Roaming/npm/node_modules/openclaw/dist/server.impl-GQ72oJBa.js', 'utf8');

// Find message.action handler definition
const idx = src.indexOf('message.action');
console.log(src.slice(Math.max(0, idx-200), idx+1000));

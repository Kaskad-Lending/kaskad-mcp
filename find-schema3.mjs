import { readFileSync } from 'fs';

const src = readFileSync('C:/Users/jackb/AppData/Roaming/npm/node_modules/openclaw/dist/server.impl-GQ72oJBa.js', 'utf8');

// Find validateMessageActionParams to see the schema
const idx = src.indexOf('validateMessageActionParams');
console.log(src.slice(Math.max(0, idx - 50), idx + 2000));

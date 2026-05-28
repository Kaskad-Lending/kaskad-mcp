import { readFileSync } from 'fs';

const src = readFileSync('C:/Users/jackb/AppData/Roaming/npm/node_modules/openclaw/dist/server.impl-GQ72oJBa.js', 'utf8');

// Find where message.action is handled (the handler function)
let idx = 0;
let count = 0;
while (count < 5) {
  idx = src.indexOf('message.action', idx + 1);
  if (idx < 0) break;
  count++;
  console.log(`\n=== occurrence ${count} at ${idx} ===`);
  console.log(src.slice(Math.max(0, idx - 100), idx + 600));
}

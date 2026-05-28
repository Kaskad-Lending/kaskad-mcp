import { readFileSync } from 'fs';

// Search all dist files for the message send method registration
import { readdirSync } from 'fs';
import { join } from 'path';

const distDir = 'C:/Users/jackb/AppData/Roaming/npm/node_modules/openclaw/dist';
const files = readdirSync(distDir).filter(f => f.endsWith('.js'));

const patterns = [
  'method:"message"', 
  "method:'message'", 
  '"message.action"',
  'registerMethod',
  'channel.action',
  'sendMessage',
  '"channels.message"',
];

for (const file of files) {
  const path = join(distDir, file);
  try {
    const src = readFileSync(path, 'utf8');
    for (const p of patterns) {
      if (src.includes(p)) {
        const idx = src.indexOf(p);
        console.log(`\n=== ${file} (${p}) ===`);
        console.log(src.slice(Math.max(0, idx-100), idx+300));
        break;
      }
    }
  } catch {}
}

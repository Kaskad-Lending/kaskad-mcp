import { readFileSync } from 'fs';

const src = readFileSync('C:/Users/jackb/AppData/Roaming/npm/node_modules/openclaw/dist/subsystem-Cgmckbux.js', 'utf8');

// Find method registrations
const patterns = ['message.send', 'channel.message', 'send.message', 'action.message', 'channels.send'];
for (const p of patterns) {
  const idx = src.indexOf(p);
  if (idx > -1) console.log(`Found "${p}":`, src.slice(Math.max(0,idx-100), idx+200));
}

// Also look at line 153 which the log showed sends messages
const lines = src.split('\n');
for (let i = 145; i < 165; i++) {
  console.log(`L${i+1}:`, lines[i]?.slice(0,200));
}

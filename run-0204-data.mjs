import { spawn } from 'child_process';

function mcpCall(method, params) {
  return new Promise((resolve) => {
    const child = spawn('node', ['dist/index.js'], {
      cwd: 'C:/Users/jackb/.openclaw/workspace/research/kaskad-mcp',
      stdio: ['pipe','pipe','pipe']
    });
    let buf = '';
    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: params } }) + '\n';
    child.stdin.write(req);
    child.stdout.on('data', d => buf += d.toString());
    child.stderr.on('data', () => {});
    const done = () => {
      const lines = buf.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try { const p = JSON.parse(line); if (p.result) { resolve(p.result); return; } } catch {}
      }
      resolve(null);
    };
    setTimeout(() => { child.kill(); done(); }, 25000);
    child.on('close', done);
  });
}

const ADDR = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

console.log('Calling checkHealthFactor...');
const hf = await mcpCall('checkHealthFactor', { address: ADDR, threshold: 1.8 });
console.log('===HF==='); console.log(JSON.stringify(hf));

console.log('Calling getPosition...');
const pos = await mcpCall('getPosition', { address: ADDR });
console.log('===POS==='); console.log(JSON.stringify(pos));

console.log('Calling getMarkets...');
const mkt = await mcpCall('getMarkets', {});
console.log('===MKT==='); console.log(JSON.stringify(mkt));

console.log('Calling getGovernanceParams...');
const gov = await mcpCall('getGovernanceParams', {});
console.log('===GOV==='); console.log(JSON.stringify(gov));

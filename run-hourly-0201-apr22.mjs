import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { createPrivateKey, createPublicKey, sign } from 'crypto';

// ── MCP stdio call ────────────────────────────────────────────────────────────
function mcpCall(method, params) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['dist/index.js'], {
      cwd: 'C:/Users/jackb/.openclaw/workspace/research/kaskad-mcp',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let buf = '';
    let resolved = false;

    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: method, arguments: params } }) + '\n';
    child.stdin.write(req);

    child.stdout.on('data', (d) => { buf += d.toString(); });
    child.stderr.on('data', () => {});

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        // Try to parse whatever we got
        try {
          const lines = buf.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.result) { resolve(parsed.result); return; }
            } catch {}
          }
        } catch {}
        resolve(null);
      }
    }, 20000);

    child.on('close', () => {
      if (resolved) return;
      resolved = true;
      try {
        const lines = buf.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.result) { resolve(parsed.result); return; }
            if (parsed.error) { reject(new Error(JSON.stringify(parsed.error))); return; }
          } catch {}
        }
        resolve(null);
      } catch(e) { reject(e); }
    });
  });
}

async function main() {
  const ADDR = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

  console.log('Calling MCP tools...');

  const [hfResult, posResult, mktResult, govResult] = await Promise.all([
    mcpCall('checkHealthFactor', { address: ADDR, threshold: 1.8 }),
    mcpCall('getPosition', { address: ADDR }),
    mcpCall('getMarkets', {}),
    mcpCall('getGovernanceParams', {}),
  ]);

  console.log('HF:', JSON.stringify(hfResult)?.slice(0, 300));
  console.log('POS:', JSON.stringify(posResult)?.slice(0, 300));
  console.log('MKT:', JSON.stringify(mktResult)?.slice(0, 300));
  console.log('GOV:', JSON.stringify(govResult)?.slice(0, 300));
}

main().catch(e => { console.error(e.message); process.exit(1); });

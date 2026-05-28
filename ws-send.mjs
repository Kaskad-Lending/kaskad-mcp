import WebSocket from 'ws';

const msg = `\`\`\`
[06:01] Kaskad Agent — Hourly Check
HF: ∞ ✅  |  Collateral: $242,348  |  Debt: $0  |  Available: $161,258
APY snapshot: IGRA 57.86%  |  USDC 52.95%  |  WBTC borrow 2.41%
Net yield: $38,945/yr  |  Net APY: 16.07%  |  Monthly: $3,245/mo
KSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 12
Action: Borrow WBTC (~$30K at 2.41%) to capture borrower-share emissions — HF stays >> 1.8. No KSKD rewards pending.
\`\`\``;

const ws = new WebSocket('ws://127.0.0.1:18789');

ws.on('open', () => {
  console.log('connected');
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'message',
      arguments: {
        action: 'send',
        channel: 'discord',
        to: 'channel:1489251680687231167',
        message: msg,
        silent: true,
      }
    }
  });
  ws.send(payload);
});

ws.on('message', (data) => {
  console.log('recv:', data.toString().slice(0, 500));
  ws.close();
});

ws.on('error', (err) => {
  console.error('ws error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('closed');
  process.exit(0);
});

setTimeout(() => {
  console.error('timeout');
  process.exit(1);
}, 20000);

import http from 'http';

const message = "```\n[11:12] Kaskad Agent — Hourly Check\nHF: ∞ ✅  |  Collateral: $243,840  |  Debt: $0  |  Available: $162,080\nAPY snapshot: IGRA 55.51%  |  KSKD 64.71%  |  WBTC borrow 2.41%\nNet yield: $38,502/yr  |  Net APY: 15.79%  |  Monthly: $3,208/mo\nKSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 13\nAction: No KSKD rewards to claim. Borrower eligible but debt=0 — borrow WBTC (~$113K at 2.41%) to capture borrower-share emissions, HF stays >> 1.8.\n```";

const body = JSON.stringify({
  action: 'send',
  channel: 'discord',
  to: 'channel:1489251680687231167',
  message,
  silent: true
});

const req = http.request(
  { hostname: 'localhost', port: 18789, path: '/message', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
  res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => console.log(res.statusCode, d));
  }
);
req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();

import http from 'http';

const message = "```\n[12:01] Kaskad Agent — Hourly Check\nHF: ∞ ✅  |  Collateral: $242,169  |  Debt: $0  |  Available: $161,018\nAPY snapshot: KSKD 64.70%  |  IGRA 55.81%  |  WBTC borrow 2.41%\nNet yield: $38,432/yr  |  Net APY: 15.87%  |  Monthly: $3,203/mo\nKSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 13\nAction: Borrow WBTC (~$25K at 2.41%) to activate borrower-share emissions — HF remains >> 1.8. No KSKD rewards to claim.\n```";

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
req.on('error', e => console.error('ERR', e.message));
req.write(body);
req.end();

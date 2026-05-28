import http from 'http';

const message = "```\n[02:04] Kaskad Agent — Hourly Check\nHF: ∞ ✅  |  Collateral: $243,081  |  Debt: $0  |  Available: $161,795\nAPY snapshot: IGRA 59.76%  |  KSKD 63.55%  |  WBTC borrow 2.41%\nNet yield: $39,160/yr  |  Net APY: 16.11%  |  Monthly: $3,263/mo\nKSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 13\nAction: Borrow WBTC (~$30K at 2.41%) to activate borrower-share emissions — HF remains >> 1.8. No KSKD rewards to claim.\n```";

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
req.write(body);
req.end();

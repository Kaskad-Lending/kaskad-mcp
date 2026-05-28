import { spawnSync } from 'child_process';

const msg = `\`\`\`
[06:01] Kaskad Agent — Hourly Check
HF: ∞ ✅  |  Collateral: $242,348  |  Debt: $0  |  Available: $161,258
APY snapshot: IGRA 57.86%  |  USDC 52.95%  |  WBTC borrow 2.41%
Net yield: $38,945/yr  |  Net APY: 16.07%  |  Monthly: $3,245/mo
KSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 12
Action: Borrow WBTC (~$30K at 2.41%) to capture borrower-share emissions — HF stays >> 1.8. No KSKD rewards pending.
\`\`\``;

const result = spawnSync('node', [
  'C:\\Users\\jackb\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\index.js',
  'message', 'send',
  '--channel', 'discord',
  '--target', 'channel:1489251680687231167',
  '--message', msg,
  '--silent'
], { encoding: 'utf8', timeout: 25000 });

console.log('stdout:', result.stdout);
console.log('stderr:', result.stderr?.slice(0, 500));
console.log('status:', result.status);

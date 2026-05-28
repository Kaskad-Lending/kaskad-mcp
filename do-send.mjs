import { spawn } from 'child_process';

const msg = "```\n[17:01] Kaskad Agent \u2014 Hourly Check\nHF: \u221e \u2705  |  Collateral: $241,277  |  Debt: $0  |  Available: $160,449\nAPY snapshot: KSKD 64.71%  |  IGRA 56.99%  |  USDC 52.15%\nNet yield: $38,580/yr  |  Net APY: 15.99%  |  Monthly: $3,215/mo\nKSKD Eligibility: Supplier \u2705  |  Borrower \u2705  |  Epoch 12\nAction: Borrow WBTC ~$37.6k (2.41% APY, cheapest asset) to activate borrower-share KSKD emissions \u2014 HF remains ~5.36 post-borrow, well above floor.\n```";

const proc = spawn('node', [
  'C:\\Users\\jackb\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\index.js',
  'message', 'send',
  '--channel', 'discord',
  '--target', 'channel:1489251680687231167',
  '--message', msg,
  '--silent',
  '--json'
], { stdio: ['ignore', 'pipe', 'pipe'] });

let out = '';
let err = '';
proc.stdout.on('data', d => { out += d; process.stdout.write(d); });
proc.stderr.on('data', d => { err += d; process.stderr.write(d); });
proc.on('close', code => {
  console.log('\nExit:', code);
});

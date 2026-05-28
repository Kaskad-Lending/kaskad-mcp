import { spawn } from 'child_process';

const msg = "```\n[06:01] Kaskad Agent \u2014 Hourly Check\nHF: \u221e \u2705  |  Collateral: $242,278  |  Debt: $0  |  Available: $161,115\nAPY snapshot: IGRA 55.80%  |  KSKD 64.50%  |  WBTC borrow 2.41%\nNet yield: $40,678/yr  |  Net APY: 15.85%  |  Monthly: $3,390/mo\nKSKD Eligibility: Supplier \u2705  |  Borrower \u2705  |  Epoch 13\nAction: Borrow WBTC (~$30K at 2.41%) to activate borrower-share emissions \u2014 HF remains >> 1.8. No KSKD rewards to claim.\n```";

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

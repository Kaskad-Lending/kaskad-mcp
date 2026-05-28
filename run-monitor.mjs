// Live monitor script — calls kaskad-mcp tools directly
// Node ESM, run with: node run-monitor.mjs

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load compiled dist
const { checkHealthFactor } = await import('./dist/tools/checkHealthFactor.js');
const { getPosition } = await import('./dist/tools/getPosition.js');
const { getMarkets } = await import('./dist/tools/getMarkets.js');
const { getGovernanceParams } = await import('./dist/tools/getGovernanceParams.js');

const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';
const THRESHOLD = 1.8;

console.log('=== KASKAD AGENT MONITOR ===');

let hfResult, posResult, marketsResult, govResult;

try {
  console.log('\n[1] checkHealthFactor...');
  hfResult = await checkHealthFactor(WALLET, THRESHOLD);
  console.log(JSON.stringify(hfResult, null, 2));
} catch (e) {
  console.error('checkHealthFactor error:', e.message);
  hfResult = { error: e.message };
}

try {
  console.log('\n[2] getPosition...');
  posResult = await getPosition(WALLET);
  console.log(JSON.stringify(posResult, null, 2));
} catch (e) {
  console.error('getPosition error:', e.message);
  posResult = { error: e.message };
}

try {
  console.log('\n[3] getMarkets...');
  marketsResult = await getMarkets();
  console.log(JSON.stringify(marketsResult, null, 2));
} catch (e) {
  console.error('getMarkets error:', e.message);
  marketsResult = { error: e.message };
}

try {
  console.log('\n[4] getGovernanceParams...');
  govResult = await getGovernanceParams();
  console.log(JSON.stringify(govResult, null, 2));
} catch (e) {
  console.error('getGovernanceParams error:', e.message);
  govResult = { error: e.message };
}

console.log('\n=== DONE ===');
console.log('RESULTS_JSON_START');
console.log(JSON.stringify({ hfResult, posResult, marketsResult, govResult }));
console.log('RESULTS_JSON_END');

'use strict';
/**
 * QA Flow 4 — Supply only. Writes status to stdout as it progresses.
 */
const { supplyAsset } = require('./dist/tools/executeTransaction.js');
const { getPosition } = require('./dist/tools/getPosition.js');

const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

async function main() {
  console.log('[0] Getting baseline position...');
  const pre = await getPosition(WALLET);
  const preUSDC = pre.positions.find(p => p.asset === 'USDC');
  console.log('[1] Pre-supply USDC:', preUSDC.suppliedUSD);

  console.log('[2] Sending supply tx...');
  const result = await supplyAsset({ asset: 'USDC', amount: 50 });
  console.log('[3] Supply result:', JSON.stringify(result));

  console.log('[4] Getting post-supply position...');
  await new Promise(r => setTimeout(r, 3000));
  const post = await getPosition(WALLET);
  const postUSDC = post.positions.find(p => p.asset === 'USDC');
  console.log('[5] Post-supply USDC:', postUSDC.suppliedUSD);
  console.log('[6] Delta:', postUSDC.suppliedUSD - preUSDC.suppliedUSD);
  console.log('[DONE]');
}

main().then(() => process.exit(0)).catch(e => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});

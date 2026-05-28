import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';
import { getMarkets } from './dist/tools/getMarkets.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const [hf, markets] = await Promise.all([
  checkHealthFactor({ walletAddress: wallet }),
  getMarkets(),
]);

console.log('=== POSITION ===');
console.log(JSON.stringify(hf, null, 2));
console.log('=== IKAS MARKET ===');
const ikas = markets.markets.find(m => m.asset === 'IKAS');
console.log(JSON.stringify(ikas, null, 2));
const usdc = markets.markets.find(m => m.asset === 'USDC');
console.log('=== USDC MARKET ===');
console.log(JSON.stringify(usdc, null, 2));

import { supplyAsset, borrowAsset } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Step 1: Supply 36 USDC → brings total supply to ~$100
console.log('Step 1: Supplying 36 USDC...');
const supply = await supplyAsset({ asset: 'USDC', amount: 36 });
console.log(JSON.stringify(supply, null, 2));
if (supply.status !== 'success') { console.error('Supply failed'); process.exit(1); }

await new Promise(r => setTimeout(r, 3000));

// Step 2: Borrow 2 USDC → brings LTV from 12.4% to ~15%+
console.log('\nStep 2: Borrowing 2 USDC...');
const borrow = await borrowAsset({ asset: 'USDC', amount: 2 });
console.log(JSON.stringify(borrow, null, 2));
if (borrow.status !== 'success') { console.error('Borrow failed'); process.exit(1); }

await new Promise(r => setTimeout(r, 3000));

// Step 3: Final position check
console.log('\nStep 3: Final position...');
const pos = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(pos, null, 2));

const ltv = pos.totalDebtUSD / pos.totalCollateralUSD * 100;
console.log(`\nLTV: ${ltv.toFixed(2)}%`);
console.log(`Supply: $${pos.totalCollateralUSD.toFixed(2)} (need >= $100)`);
console.log(`Condition 1 (supply >= $100): ${pos.totalCollateralUSD >= 100 ? '✅' : '❌'}`);
console.log(`Condition 3 (LTV >= 15%): ${ltv >= 15 ? '✅' : '❌'}`);
console.log(`Condition 2 & 4 (uptime): ⏳ accumulating once ActivityTracker initializes`);

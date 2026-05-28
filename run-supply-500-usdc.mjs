import { supplyAsset, borrowAsset } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Current state: $46 USDC supplied, $10 USDC debt, collateral $64.72 (iKAS isolated)
// Target: +$500 USDC supply, then adjust borrow to keep LTV >= 15%
// New total supply: ~$546 USDC
// New collateral base (still iKAS isolated): $64.72
// LTV = debt / iKAS_collateral → need debt >= 15% of $64.72 = $9.71
// Current debt $10.01 already >= 15%, but adding $500 supply doesn't change LTV
// (USDC supply is not collateral in isolation mode)
// LTV is purely: USDC_debt / iKAS_collateral = need >= 15% of $64.72 = $9.71 ✅ already passing

// Actually let's re-read position first
console.log('Reading current position...');
const pos = await checkHealthFactor({ walletAddress: wallet });
console.log(`Collateral: $${pos.totalCollateralUSD} | Debt: $${pos.totalDebtUSD} | HF: ${pos.healthFactor}`);

// Step 1: Supply 500 USDC
console.log('\nSupplying 500 USDC...');
const supply = await supplyAsset({ asset: 'USDC', amount: 500 });
console.log(JSON.stringify(supply, null, 2));
if (supply.status !== 'success') { console.error('Supply failed'); process.exit(1); }

await new Promise(r => setTimeout(r, 3000));

// Step 2: Check if LTV still passes after supply
// LTV = totalDebt / totalCollateral — but USDC supply (collateral=false) doesn't change denominator
// So LTV is unchanged. Just verify.
const pos2 = await checkHealthFactor({ walletAddress: wallet });
const ltv = pos2.totalDebtUSD / pos2.totalCollateralUSD * 100;
console.log(`\nPost-supply: collateral $${pos2.totalCollateralUSD} | debt $${pos2.totalDebtUSD} | LTV ${ltv.toFixed(2)}% | HF ${pos2.healthFactor}`);
console.log(`LTV condition (>= 15%): ${ltv >= 15 ? '✅ PASS' : '❌ FAIL'}`);

if (ltv < 15) {
  const neededDebt = (0.15 * pos2.totalCollateralUSD) - pos2.totalDebtUSD;
  console.log(`\nBorrowing additional $${neededDebt.toFixed(2)} USDC to restore LTV...`);
  const borrow = await borrowAsset({ asset: 'USDC', amount: Math.ceil(neededDebt * 10) / 10 });
  console.log(JSON.stringify(borrow, null, 2));
  await new Promise(r => setTimeout(r, 3000));
  const pos3 = await checkHealthFactor({ walletAddress: wallet });
  const ltv3 = pos3.totalDebtUSD / pos3.totalCollateralUSD * 100;
  console.log(`Final: LTV ${ltv3.toFixed(2)}% | HF ${pos3.healthFactor}`);
} else {
  console.log('LTV already above 15% — no borrow adjustment needed.');
}

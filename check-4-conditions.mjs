import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Current position
const position = await checkHealthFactor({ walletAddress: wallet });

const collateralUSD = position.totalCollateralUSD;
const debtUSD = position.totalDebtUSD;
const ltv = collateralUSD > 0 ? (debtUSD / collateralUSD) * 100 : 0;

// Defaults from governance params bounds (deploy defaults, epoch 0)
const MIN_SUPPLY_USD = 100;       // param 1 default
const MIN_SUPPLY_UPTIME_BPS = 9000; // param 2 default = 90%
const MIN_BORROW_LTV_BPS = 1500;  // param 3 default = 15%
const MIN_BORROW_UPTIME_BPS = 5500; // param 4 default = 55%

console.log('=== KSKD Emission Eligibility Check ===\n');

// Condition 1: Supply >= $100
const c1 = collateralUSD >= MIN_SUPPLY_USD;
console.log(`1. Supply USD >= $${MIN_SUPPLY_USD}`);
console.log(`   Current: $${collateralUSD.toFixed(2)} → ${c1 ? '✅ PASS' : '❌ FAIL — need $' + (MIN_SUPPLY_USD - collateralUSD).toFixed(2) + ' more'}`);

// Condition 2: Supply uptime >= 90% — can't read from tracker yet, but we just entered this epoch
console.log(`\n2. Supply uptime >= ${MIN_SUPPLY_UPTIME_BPS / 100}% of epoch`);
console.log(`   ActivityTracker not initialized yet — uptime clock starts once it's live`);
console.log(`   Status: ⏳ PENDING (supply is active, will accumulate from tracker init)`);

// Condition 3: Borrow LTV >= 15%
const c3 = ltv >= (MIN_BORROW_LTV_BPS / 100);
console.log(`\n3. Borrow LTV >= ${MIN_BORROW_LTV_BPS / 100}%`);
console.log(`   Current: $${debtUSD.toFixed(2)} debt / $${collateralUSD.toFixed(2)} collateral = ${ltv.toFixed(2)}% → ${c3 ? '✅ PASS' : '❌ FAIL — need $' + ((MIN_BORROW_LTV_BPS / 10000 * collateralUSD) - debtUSD).toFixed(2) + ' more debt'}`);

// Condition 4: Borrow uptime >= 55% — same as supply uptime
console.log(`\n4. Borrow uptime >= ${MIN_BORROW_UPTIME_BPS / 100}% of epoch`);
console.log(`   ActivityTracker not initialized yet — uptime clock starts once it's live`);
console.log(`   Status: ⏳ PENDING (borrow is active, will accumulate from tracker init)`);

console.log('\n=== Summary ===');
console.log(`Supply:  $${collateralUSD.toFixed(2)} collateral, $${debtUSD.toFixed(2)} debt, LTV ${ltv.toFixed(2)}%`);
console.log(`HF:      ${position.healthFactor}`);

if (!c1) {
  const needed = MIN_SUPPLY_USD - collateralUSD;
  console.log(`\n⚠️  Need $${needed.toFixed(2)} more supply to hit the $100 minimum.`);
  console.log(`   Easiest fix: supply ~${Math.ceil(needed)} more USDC.`);
}
if (!c3) {
  const neededDebt = (MIN_BORROW_LTV_BPS / 10000 * collateralUSD) - debtUSD;
  console.log(`\n⚠️  LTV at ${ltv.toFixed(2)}% — need $${neededDebt.toFixed(2)} more debt to hit 15%.`);
  console.log(`   Borrow ~${Math.ceil(neededDebt * 10) / 10} more USDC (HF stays well above 4).`);
}

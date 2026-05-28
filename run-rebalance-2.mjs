import { withdrawNativeIKAS, borrowAsset, setCollateral } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Check current state first
console.log('Current position...');
const pos0 = await checkHealthFactor({ walletAddress: wallet });
console.log(`Collateral: $${pos0.totalCollateralUSD} | Debt: $${pos0.totalDebtUSD} | HF: ${pos0.healthFactor}`);

// Step 2: Withdraw all iKAS (may already be done — will error gracefully if 0 balance)
console.log('\nWithdrawing all iKAS...');
const withdraw = await withdrawNativeIKAS({ amount: -1 });
console.log(JSON.stringify(withdraw, null, 2));
await new Promise(r => setTimeout(r, 3000));

// Step 3: Re-enable USDC as collateral
console.log('\nRe-enabling USDC as collateral...');
const enableUsdc = await setCollateral({ asset: 'USDC', useAsCollateral: true });
console.log(JSON.stringify(enableUsdc, null, 2));
await new Promise(r => setTimeout(r, 3000));

// Step 4: Check position
const pos1 = await checkHealthFactor({ walletAddress: wallet });
console.log(`\nPost-switch: Collateral $${pos1.totalCollateralUSD} | Debt $${pos1.totalDebtUSD} | HF ${pos1.healthFactor}`);

// Step 5: Borrow 250 USDC
console.log('\nBorrowing 250 USDC...');
const borrow = await borrowAsset({ asset: 'USDC', amount: 250 });
console.log(JSON.stringify(borrow, null, 2));
await new Promise(r => setTimeout(r, 3000));

// Final
const final = await checkHealthFactor({ walletAddress: wallet });
const ltv = final.totalCollateralUSD > 0 ? (final.totalDebtUSD / final.totalCollateralUSD * 100).toFixed(2) : 'n/a';
console.log(`\nFinal: Collateral $${final.totalCollateralUSD} | Debt $${final.totalDebtUSD} | LTV ${ltv}% | HF ${final.healthFactor}`);

import { repayAsset, withdrawNativeIKAS, borrowAsset, setCollateral } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Step 1: Repay all USDC debt (-1 = full repay)
console.log('Step 1: Repaying all USDC debt...');
const repay = await repayAsset({ asset: 'USDC', amount: -1 });
console.log(JSON.stringify(repay, null, 2));
if (repay.status !== 'success') { console.error('Repay failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Step 2: Withdraw all iKAS (-1 = withdraw all)
console.log('\nStep 2: Withdrawing all iKAS...');
const withdraw = await withdrawNativeIKAS({ amount: -1 });
console.log(JSON.stringify(withdraw, null, 2));
if (withdraw.status !== 'success') { console.error('Withdraw failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Step 3: Re-enable USDC as collateral (currently disabled from isolation mode)
console.log('\nStep 3: Re-enabling USDC as collateral...');
const enableUsdc = await setCollateral({ asset: 'USDC', useAsCollateral: true });
console.log(JSON.stringify(enableUsdc, null, 2));
if (enableUsdc.status !== 'success') { console.error('setCollateral failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Step 4: Check position — USDC should now be the collateral
console.log('\nStep 4: Position after re-enabling USDC collateral...');
const pos = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(pos, null, 2));

// Step 5: Borrow 250 USDC
console.log('\nStep 5: Borrowing 250 USDC...');
const borrow = await borrowAsset({ asset: 'USDC', amount: 250 });
console.log(JSON.stringify(borrow, null, 2));
if (borrow.status !== 'success') { console.error('Borrow failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Final position
console.log('\nFinal position:');
const final = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(final, null, 2));
const ltv = final.totalDebtUSD / final.totalCollateralUSD * 100;
console.log(`LTV: ${ltv.toFixed(2)}% | HF: ${final.healthFactor}`);

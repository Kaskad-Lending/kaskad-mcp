import { setCollateral, borrowAsset } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Step 1: Disable USDC as collateral
console.log('Step 1: Disabling USDC as collateral...');
const disableResult = await setCollateral({ asset: 'USDC', useAsCollateral: false });
console.log(JSON.stringify(disableResult, null, 2));
if (disableResult.status !== 'success') { console.error('Failed'); process.exit(1); }

await new Promise(r => setTimeout(r, 3000));

// Step 2: Enable IKAS as collateral
console.log('\nStep 2: Enabling IKAS as collateral...');
const enableResult = await setCollateral({ asset: 'IKAS', useAsCollateral: true });
console.log(JSON.stringify(enableResult, null, 2));
if (enableResult.status !== 'success') { console.error('Failed'); process.exit(1); }

await new Promise(r => setTimeout(r, 3000));

// Step 3: Check position — should now show WiKAS collateral
console.log('\nStep 3: Position after collateral switch...');
const hf1 = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(hf1, null, 2));

// Step 4: Borrow 8 USDC (targets HF ~4.2)
console.log('\nStep 4: Borrowing 8 USDC...');
const borrowResult = await borrowAsset({ asset: 'USDC', amount: 8 });
console.log(JSON.stringify(borrowResult, null, 2));

await new Promise(r => setTimeout(r, 3000));

// Step 5: Final HF check
console.log('\nStep 5: Final position...');
const hfFinal = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(hfFinal, null, 2));

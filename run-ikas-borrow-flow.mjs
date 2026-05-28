import { supplyNativeIKAS, borrowAsset } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Step 1: Supply 2000 native iKAS
console.log('Step 1: Supplying 2000 native iKAS...');
const supplyResult = await supplyNativeIKAS({ amount: 2000 });
console.log(JSON.stringify(supplyResult, null, 2));

if (supplyResult.status !== 'success') {
  console.error('Supply failed, aborting.');
  process.exit(1);
}

// Brief pause for indexing
await new Promise(r => setTimeout(r, 3000));

// Step 2: Check position
console.log('\nStep 2: Checking position after supply...');
const hfAfterSupply = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(hfAfterSupply, null, 2));

// Step 3: Borrow 8 USDC — targets HF ~4.2
console.log('\nStep 3: Borrowing 8 USDC...');
const borrowResult = await borrowAsset({ asset: 'USDC', amount: 8 });
console.log(JSON.stringify(borrowResult, null, 2));

// Step 4: Final HF check
await new Promise(r => setTimeout(r, 3000));
console.log('\nStep 4: Final position check...');
const hfFinal = await checkHealthFactor({ walletAddress: wallet });
console.log(JSON.stringify(hfFinal, null, 2));

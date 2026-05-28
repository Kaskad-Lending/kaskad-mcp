import { supplyAsset, setCollateral, borrowAsset } from './dist/tools/executeTransaction.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Step 1: Supply 0.1 USDC to set the bitmap (MCP version works, raw pool.supply() was reverting)
console.log('Supplying 0.1 USDC to initialize bitmap...');
const sup = await supplyAsset({ asset: 'USDC', amount: 0.1 });
console.log(JSON.stringify(sup, null, 2));
if (sup.status !== 'success') { console.error('Supply failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Step 2: Enable USDC as collateral
console.log('\nEnabling USDC as collateral...');
const col = await setCollateral({ asset: 'USDC', useAsCollateral: true });
console.log(JSON.stringify(col, null, 2));
if (col.status !== 'success') { console.error('setCollateral failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Check position
const pos = await checkHealthFactor({ walletAddress: wallet });
console.log(`\nCollateral: $${pos.totalCollateralUSD} | Available: $${pos.availableBorrowsUSD} | HF: ${pos.healthFactor}`);
if (pos.totalCollateralUSD < 100) { console.error('Collateral still too low'); process.exit(1); }

// Step 3: Borrow 250 USDC
console.log('\nBorrowing 250 USDC...');
const bor = await borrowAsset({ asset: 'USDC', amount: 250 });
console.log(JSON.stringify(bor, null, 2));
if (bor.status !== 'success') { console.error('Borrow failed'); process.exit(1); }
await new Promise(r => setTimeout(r, 3000));

// Final
const final = await checkHealthFactor({ walletAddress: wallet });
const ltv = final.totalCollateralUSD > 0 ? (final.totalDebtUSD / final.totalCollateralUSD * 100).toFixed(2) : 'n/a';
console.log(`\n✅ Final: Collateral $${final.totalCollateralUSD} | Debt $${final.totalDebtUSD} | LTV ${ltv}% | HF ${final.healthFactor}`);

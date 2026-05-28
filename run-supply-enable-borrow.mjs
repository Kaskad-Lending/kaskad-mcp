import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';
import fs from 'fs';
import path from 'path';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creds = JSON.parse(fs.readFileSync(path.resolve('credentials/wallet.json'), 'utf8'));
const signer = new ethers.Wallet(creds.privateKey, provider);
const GAS_PRICE = ethers.parseUnits('2000', 'gwei');

const ERC20_ABI = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];
const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
  'function getUserConfiguration(address) view returns (uint256)',
];

const usdc = new ethers.Contract(TOKENS.USDC, ERC20_ABI, signer);
const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, signer);

const pollReceipt = async (hash, label) => {
  process.stdout.write(`Polling ${label}...`);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await provider.getTransactionReceipt(hash);
    if (r) { console.log(` block ${r.blockNumber} status ${r.status}`); return r; }
    process.stdout.write('.');
  }
  console.log(' TIMEOUT');
  return null;
};

const dec = Number(await usdc.decimals());

// Check current bitmap
const bitmap = await pool.getUserConfiguration(signer.address);
console.log('Current bitmap:', bitmap.toString());

// Step 1: Approve pool for 1 USDC (use max to avoid repeated approvals)
const amt1 = ethers.parseUnits('1', dec);
const allowance = await usdc.allowance(signer.address, CONTRACTS.poolProxy);
if (allowance < amt1) {
  console.log('\nApproving USDC...');
  const appTx = await usdc.approve(CONTRACTS.poolProxy, ethers.MaxUint256, { gasPrice: GAS_PRICE, gasLimit: 200000n });
  await pollReceipt(appTx.hash, 'approve');
}

// Step 2: Supply 1 USDC — this should set the bitmap bit
console.log('\nSupplying 1 USDC to set bitmap...');
const supTx = await pool.supply(TOKENS.USDC, amt1, signer.address, 0, { gasPrice: GAS_PRICE, gasLimit: 800000n });
console.log('supply tx:', supTx.hash);
const supR = await pollReceipt(supTx.hash, 'supply');
if (!supR || supR.status === 0) { console.error('Supply failed'); process.exit(1); }

// Check bitmap after supply
const bitmap2 = await pool.getUserConfiguration(signer.address);
console.log('Bitmap after supply:', bitmap2.toString());

// Step 3: setUserUseReserveAsCollateral
console.log('\nsetUserUseReserveAsCollateral(USDC, true)...');
const colTx = await pool.setUserUseReserveAsCollateral(TOKENS.USDC, true, { gasPrice: GAS_PRICE, gasLimit: 500000n });
console.log('setCollateral tx:', colTx.hash);
const colR = await pollReceipt(colTx.hash, 'setCollateral');
if (!colR || colR.status === 0) { console.error('setCollateral failed'); process.exit(1); }

// Check account data
const acct = await pool.getUserAccountData(signer.address);
const collateral = Number(ethers.formatUnits(acct[0], 8));
const avail = Number(ethers.formatUnits(acct[2], 8));
console.log(`\nCollateral: $${collateral.toFixed(2)} | Available borrows: $${avail.toFixed(2)}`);

if (collateral < 100) { console.error('Collateral too low'); process.exit(1); }

// Step 4: Borrow 250 USDC
const borrowAmt = ethers.parseUnits('250', dec);
console.log('\nBorrowing 250 USDC...');
const borTx = await pool.borrow(TOKENS.USDC, borrowAmt, 2, 0, signer.address, { gasPrice: GAS_PRICE, gasLimit: 700000n });
console.log('borrow tx:', borTx.hash);
console.log('Explorer:', `https://explorer.igralabs.com/tx/${borTx.hash}`);
const borR = await pollReceipt(borTx.hash, 'borrow');
if (!borR || borR.status === 0) { console.error('Borrow failed'); process.exit(1); }

// Final state
const final = await pool.getUserAccountData(signer.address);
const col2 = Number(ethers.formatUnits(final[0], 8));
const debt2 = Number(ethers.formatUnits(final[1], 8));
const hf = Number(ethers.formatUnits(final[5], 18));
const ltv = col2 > 0 ? (debt2 / col2 * 100).toFixed(2) : 'n/a';
console.log(`\n✅ Final: Collateral $${col2.toFixed(2)} | Debt $${debt2.toFixed(2)} | LTV ${ltv}% | HF ${hf.toFixed(4)}`);

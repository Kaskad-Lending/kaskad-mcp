import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';
import fs from 'fs';
import path from 'path';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creds = JSON.parse(fs.readFileSync(path.resolve('credentials/wallet.json'), 'utf8'));
const signer = new ethers.Wallet(creds.privateKey, provider);
const GAS_PRICE = ethers.parseUnits('2000', 'gwei');

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];
const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function getUserAccountData(address user) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
];

const usdc = new ethers.Contract(TOKENS.USDC, ERC20_ABI, signer);
const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, signer);

const dec = await usdc.decimals();
const walletBal = await usdc.balanceOf(signer.address);
console.log('Wallet USDC balance:', ethers.formatUnits(walletBal, dec));

const pollReceipt = async (hash) => {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await provider.getTransactionReceipt(hash);
    if (r) return r;
    process.stdout.write('.');
  }
  return null;
};

// Step 1: Supply 1 USDC to refresh the position
const amt = ethers.parseUnits('1', dec);
console.log('\nApproving 1 USDC...');
const approveTx = await usdc.approve(CONTRACTS.poolProxy, amt, { gasPrice: GAS_PRICE, gasLimit: 200000n });
console.log('Approve tx:', approveTx.hash);
const appR = await pollReceipt(approveTx.hash);
console.log('Confirmed block', appR.blockNumber);

console.log('\nSupplying 1 USDC...');
const supplyTx = await pool.supply(TOKENS.USDC, amt, signer.address, 0, { gasPrice: GAS_PRICE, gasLimit: 500000n });
console.log('Supply tx:', supplyTx.hash);
const supR = await pollReceipt(supplyTx.hash);
console.log('Confirmed block', supR.blockNumber, '| status', supR.status);

// Step 2: Enable USDC as collateral
console.log('\nEnabling USDC as collateral...');
const colTx = await pool.setUserUseReserveAsCollateral(TOKENS.USDC, true, { gasPrice: GAS_PRICE, gasLimit: 500000n });
console.log('setCollateral tx:', colTx.hash);
const colR = await pollReceipt(colTx.hash);
console.log('Confirmed block', colR.blockNumber, '| status', colR.status);

// Check state
const acct = await pool.getUserAccountData(signer.address);
console.log('\nCollateral USD:', ethers.formatUnits(acct[0], 8));
console.log('Available borrows:', ethers.formatUnits(acct[2], 8));

// Step 3: Borrow 250 USDC
const borrowAmt = ethers.parseUnits('250', dec);
console.log('\nBorrowing 250 USDC...');
const borrowTx = await pool.borrow(TOKENS.USDC, borrowAmt, 2, 0, signer.address, { gasPrice: GAS_PRICE, gasLimit: 700000n });
console.log('Borrow tx:', borrowTx.hash);
console.log('Explorer:', `https://explorer.igralabs.com/tx/${borrowTx.hash}`);
const borR = await pollReceipt(borrowTx.hash);
console.log('Confirmed block', borR.blockNumber, '| status', borR.status);

// Final state
const final = await pool.getUserAccountData(signer.address);
const collateral = Number(ethers.formatUnits(final[0], 8));
const debt = Number(ethers.formatUnits(final[1], 8));
const hf = Number(ethers.formatUnits(final[5], 18));
const ltv = collateral > 0 ? (debt / collateral * 100).toFixed(2) : 'n/a';
console.log(`\nFinal: Collateral $${collateral.toFixed(2)} | Debt $${debt.toFixed(2)} | LTV ${ltv}% | HF ${hf.toFixed(4)}`);

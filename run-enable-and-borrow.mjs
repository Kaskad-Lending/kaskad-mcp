import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';
import fs from 'fs';
import path from 'path';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creds = JSON.parse(fs.readFileSync(path.resolve('credentials/wallet.json'), 'utf8'));
const signer = new ethers.Wallet(creds.privateKey, provider);
const GAS_PRICE = ethers.parseUnits('2000', 'gwei');

const POOL_ABI = [
  'function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function getUserAccountData(address user) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
  'function getUserConfiguration(address user) external view returns (uint256)',
];
const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, signer);

// Check current account data
const acct = await pool.getUserAccountData(signer.address);
console.log('totalCollateralBase:', ethers.formatUnits(acct[0], 8), 'USD');
console.log('totalDebtBase:', ethers.formatUnits(acct[1], 8), 'USD');
console.log('availableBorrows:', ethers.formatUnits(acct[2], 8), 'USD');
console.log('ltv:', acct[4].toString(), 'bps');

// Try setUserUseReserveAsCollateral for USDC
console.log('\nCalling setUserUseReserveAsCollateral(USDC, true)...');
try {
  // Estimate gas first to get revert reason
  await pool.setUserUseReserveAsCollateral.estimateGas(TOKENS.USDC, true);
  const tx = await pool.setUserUseReserveAsCollateral(TOKENS.USDC, true, { gasPrice: GAS_PRICE, gasLimit: 500000n });
  console.log('Tx:', tx.hash);
  // Poll for receipt
  let receipt = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    receipt = await provider.getTransactionReceipt(tx.hash);
    if (receipt) { console.log('Confirmed block', receipt.blockNumber, '| status', receipt.status); break; }
    process.stdout.write('.');
  }
} catch (e) {
  console.error('setCollateral error:', e.message.slice(0, 300));
  // Try static call to get revert data
  try {
    await pool.setUserUseReserveAsCollateral.staticCall(TOKENS.USDC, true, { from: signer.address });
  } catch(e2) {
    console.error('Static call revert:', e2.message.slice(0, 300));
  }
}

// Check updated state
const acct2 = await pool.getUserAccountData(signer.address);
console.log('\nAfter setCollateral:');
console.log('totalCollateralBase:', ethers.formatUnits(acct2[0], 8), 'USD');

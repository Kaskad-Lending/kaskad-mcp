'use strict';
/**
 * Manual tx send + poll for confirmation (avoids tx.wait() hang)
 */
const { ethers } = require('ethers');

const RPC = 'https://galleon-testnet.igralabs.com:8545';
const WALLET_KEY = 'eda228e120390b4875bcafb92cd85f6426753468e370ad7c618364bf398683b7';
const POOL = '0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24';
const USDC = '0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2';
const GAS_PRICE = ethers.parseUnits('2000', 'gwei');

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];
const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
];

async function pollForReceipt(provider, hash, maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(WALLET_KEY, provider);
  const token = new ethers.Contract(USDC, ERC20_ABI, wallet);
  const pool = new ethers.Contract(POOL, POOL_ABI, wallet);
  
  const decimals = await token.decimals();
  const amount = ethers.parseUnits('50', decimals);
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log('Nonce:', nonce, '| Amount:', ethers.formatUnits(amount, decimals), 'USDC');

  // Step 1: Approve
  console.log('Sending approve...');
  const approveTx = await token.approve(POOL, amount, { gasPrice: GAS_PRICE, gasLimit: 200000n, nonce });
  console.log('Approve hash:', approveTx.hash);
  
  console.log('Polling for approve confirmation...');
  const approveReceipt = await pollForReceipt(provider, approveTx.hash, 120000);
  if (!approveReceipt) {
    console.log('\nApprove tx not confirmed after 120s. Checking if dropped...');
    const newNonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log('Pending nonce now:', newNonce);
    if (newNonce === nonce) {
      console.log('TX DROPPED - nonce unchanged. Testnet write issue confirmed.');
    }
    return;
  }
  console.log('\nApprove confirmed! Status:', approveReceipt.status, 'Block:', approveReceipt.blockNumber);

  // Step 2: Supply
  const supplyNonce = nonce + 1;
  console.log('Sending supply...');
  const supplyTx = await pool.supply(USDC, amount, wallet.address, 0, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce: supplyNonce });
  console.log('Supply hash:', supplyTx.hash);
  
  console.log('Polling for supply confirmation...');
  const supplyReceipt = await pollForReceipt(provider, supplyTx.hash, 120000);
  if (!supplyReceipt) {
    console.log('\nSupply tx dropped or not confirmed.');
    return;
  }
  console.log('\nSupply confirmed! Status:', supplyReceipt.status, 'Block:', supplyReceipt.blockNumber);
  console.log('Supply tx hash:', supplyTx.hash);
}

main().then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

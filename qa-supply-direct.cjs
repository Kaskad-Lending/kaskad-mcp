'use strict';
const { ethers } = require('ethers');
const { getPosition } = require('./dist/tools/getPosition.js');

const RPC = 'https://galleon-testnet.igralabs.com:8545';
const WALLET_KEY = 'eda228e120390b4875bcafb92cd85f6426753468e370ad7c618364bf398683b7';
const POOL = '0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24';
const USDC = '0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2';
const GAS_PRICE = ethers.parseUnits('2000', 'gwei');
const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const POOL_ABI = ['function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external'];

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
  const pool = new ethers.Contract(POOL, POOL_ABI, wallet);
  
  const amount = ethers.parseUnits('50', 6); // USDC 6 decimals
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log('Nonce:', nonce);

  console.log('Sending supply (50 USDC)...');
  const tx = await pool.supply(USDC, amount, wallet.address, 0, {
    gasPrice: GAS_PRICE,
    gasLimit: 1700000n,
    nonce
  });
  console.log('Supply hash:', tx.hash);
  
  console.log('Polling...');
  const receipt = await pollForReceipt(provider, tx.hash, 120000);
  if (!receipt) {
    console.log('\nDROPPED - checking mempool nonce...');
    const pending = await provider.getTransactionCount(wallet.address, 'pending');
    console.log('Pending nonce:', pending);
    return;
  }
  console.log('\nConfirmed! Status:', receipt.status, 'Block:', receipt.blockNumber);
  console.log('TX HASH:', tx.hash);
  
  // Check position
  await new Promise(r => setTimeout(r, 3000));
  const pos = await getPosition(WALLET);
  const usdc = pos.positions.find(p => p.asset === 'USDC');
  console.log('Post-supply USDC supplied USD:', usdc.suppliedUSD);
}

main().then(() => process.exit(0)).catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

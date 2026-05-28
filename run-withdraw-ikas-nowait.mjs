import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS } from './dist/config.js';
import fs from 'fs';
import path from 'path';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creds = JSON.parse(fs.readFileSync(path.resolve('credentials/wallet.json'), 'utf8'));
const signer = new ethers.Wallet(creds.privateKey, provider);

const GAS_PRICE = ethers.parseUnits('2000', 'gwei');
const POOL_ADDRESS = CONTRACTS.poolProxy;
const GATEWAY = CONTRACTS.wrappedTokenGateway;
const IKAS_ADDR = '0x17Ec7E1768c813E2a3a9b0f94A35605CA520C242';

const POOL_ABI = ['function getReserveData(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)'];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)'];
const GATEWAY_ABI = ['function withdrawETH(address, uint256 amount, address to) external'];

const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
const rd = await pool.getReserveData(IKAS_ADDR);
const aIKAS_ADDR = rd[8];
console.log('aIKAS:', aIKAS_ADDR);

const aToken = new ethers.Contract(aIKAS_ADDR, ERC20_ABI, signer);
const bal = await aToken.balanceOf(signer.address);
console.log('aIKAS balance:', ethers.formatEther(bal));

if (bal === 0n) { console.log('Already zero — nothing to withdraw.'); process.exit(0); }

// Approve if needed
const allowance = await aToken.allowance(signer.address, GATEWAY);
if (allowance < bal) {
  console.log('Approving gateway...');
  const nonce = await provider.getTransactionCount(signer.address, 'latest');
  const approveTx = await aToken.approve(GATEWAY, bal, { gasPrice: GAS_PRICE, gasLimit: 200000n, nonce });
  console.log('Approve tx:', approveTx.hash);
  // Poll for receipt manually
  let appReceipt = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    appReceipt = await provider.getTransactionReceipt(approveTx.hash);
    if (appReceipt) { console.log('Approve confirmed block', appReceipt.blockNumber); break; }
    process.stdout.write('.');
  }
  if (!appReceipt) { console.error('Approve not confirmed in time'); process.exit(1); }
}

// Withdraw
const gateway = new ethers.Contract(GATEWAY, GATEWAY_ABI, signer);
const nonce2 = await provider.getTransactionCount(signer.address, 'latest');
console.log('Sending withdrawETH...');
const tx = await gateway.withdrawETH(POOL_ADDRESS, bal, signer.address, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce: nonce2 });
console.log('Withdraw tx:', tx.hash);
console.log('Explorer:', `https://explorer.igralabs.com/tx/${tx.hash}`);

// Poll for receipt manually
let receipt = null;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 2000));
  receipt = await provider.getTransactionReceipt(tx.hash);
  if (receipt) { console.log('Confirmed block', receipt.blockNumber, '| status', receipt.status); break; }
  process.stdout.write('.');
}
if (!receipt) { console.log('Not confirmed yet — tx is in flight, check explorer.'); process.exit(0); }
if (receipt.status === 0) { console.error('Transaction REVERTED'); process.exit(1); }
console.log('Withdraw SUCCESS');

import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS } from './dist/config.js';
import fs from 'fs';
import path from 'path';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const creds = JSON.parse(fs.readFileSync(path.resolve('credentials/wallet.json'), 'utf8'));
const wallet = new ethers.Wallet(creds.privateKey, provider);

const GAS_PRICE = ethers.parseUnits('2000', 'gwei');

// Check aIKAS balance
const POOL_ABI = ['function getReserveData(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)'];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];

const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);
const IKAS_ADDR = '0x17Ec7E1768c813E2a3a9b0f94A35605CA520C242';
const rd = await pool.getReserveData(IKAS_ADDR);
const aIKAS = rd[8];
console.log('aIKAS token:', aIKAS);

const aToken = new ethers.Contract(aIKAS, ERC20_ABI, wallet);
const bal = await aToken.balanceOf(wallet.address);
console.log('aIKAS balance:', ethers.formatEther(bal));

if (bal === 0n) { console.log('Already withdrawn — nothing to do.'); process.exit(0); }

// Approve gateway to spend aIKAS (needed for withdrawETH)
const GATEWAY_ABI = ['function withdrawETH(address to, uint256 amount) external'];
const gateway = new ethers.Contract(CONTRACTS.wrappedTokenGateway, GATEWAY_ABI, wallet);

console.log('Approving gateway to spend aIKAS...');
const approveTx = await aToken.approve(CONTRACTS.wrappedTokenGateway, bal, { gasPrice: GAS_PRICE, gasLimit: 200000n });
console.log('Approve tx sent:', approveTx.hash);
const appReceipt = await approveTx.wait();
console.log('Approve confirmed at block', appReceipt.blockNumber);

// Withdraw all
console.log('Withdrawing all iKAS...');
const tx = await gateway.withdrawETH(wallet.address, bal, { gasPrice: GAS_PRICE, gasLimit: 1700000n });
console.log('Withdraw tx sent:', tx.hash);
const receipt = await tx.wait();
console.log('Withdraw confirmed at block', receipt.blockNumber, '| status:', receipt.status);
console.log('Explorer:', `https://explorer.igralabs.com/tx/${receipt.hash}`);

import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const POOL_ABI = [
  'function getUserConfiguration(address) view returns (uint256)',
  'function getReservesList() view returns (address[])',
  'function getReserveData(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)',
  'function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)',
];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'];

const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);
const [userConfig, reserves, acctData] = await Promise.all([
  pool.getUserConfiguration(wallet),
  pool.getReservesList(),
  pool.getUserAccountData(wallet),
]);

console.log('=== Account Data ===');
console.log('totalCollateralBase:', ethers.formatUnits(acctData[0], 8), 'USD');
console.log('totalDebtBase:', ethers.formatUnits(acctData[1], 8), 'USD');
console.log('availableBorrows:', ethers.formatUnits(acctData[2], 8), 'USD');
console.log('Raw bitmap:', userConfig.toString());
console.log('Reserves list:', reserves);

console.log('\n=== Per-Reserve Status ===');
for (let i = 0; i < reserves.length; i++) {
  const rd = await pool.getReserveData(reserves[i]);
  const aToken = new ethers.Contract(rd[8], ERC20_ABI, provider);
  const [bal, sym] = await Promise.all([aToken.balanceOf(wallet), aToken.symbol().catch(() => '?')]);
  const bitCollateral = (userConfig >> BigInt(i * 2 + 1)) & 1n;
  const bitBorrow = (userConfig >> BigInt(i * 2)) & 1n;
  console.log(`Reserve ${i} (${reserves[i]}): aToken=${sym} balance=${ethers.formatUnits(bal, 6)} | collateral=${bitCollateral} borrow=${bitBorrow}`);
}

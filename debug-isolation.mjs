import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const POOL_ABI = [
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function getUserConfiguration(address user) view returns (uint256)',
  'function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)',
];

const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);

const [accountData, userConfig] = await Promise.all([
  pool.getUserAccountData(wallet),
  pool.getUserConfiguration(wallet),
]);

console.log('=== Account Data ===');
console.log('totalCollateralBase:', ethers.formatUnits(accountData[0], 8), 'USD');
console.log('availableBorrowsBase:', ethers.formatUnits(accountData[2], 8), 'USD');
console.log('ltv:', accountData[4].toString(), 'bps');
console.log('healthFactor:', accountData[5] === 115792089237316195423570985008687907853269984665640564039457584007913129639935n ? '∞' : ethers.formatEther(accountData[5]));

console.log('\n=== User Config (bitmap) ===');
console.log('raw bitmap:', userConfig.toString(16));

// Get reserve IDs for USDC and IKAS
const [rdUSDC, rdIKAS] = await Promise.all([
  pool.getReserveData(TOKENS.USDC),
  pool.getReserveData(TOKENS.IKAS),
]);
const usdcId = Number(rdUSDC[7]);
const ikasId = Number(rdIKAS[7]);
console.log('USDC reserve id:', usdcId);
console.log('IKAS reserve id:', ikasId);

// In Aave v3 userConfig bitmap: for each reserve id i, bit 2*i = borrow, bit 2*i+1 = collateral
const bitmap = userConfig;
const usdcCollateral = (bitmap >> BigInt(2 * usdcId + 1)) & 1n;
const usdcBorrow = (bitmap >> BigInt(2 * usdcId)) & 1n;
const ikasCollateral = (bitmap >> BigInt(2 * ikasId + 1)) & 1n;
const ikasBorrow = (bitmap >> BigInt(2 * ikasId)) & 1n;

console.log('\nUSDC — collateral:', usdcCollateral === 1n, '| borrow:', usdcBorrow === 1n);
console.log('IKAS — collateral:', ikasCollateral === 1n, '| borrow:', ikasBorrow === 1n);

// Check IKAS isolation mode debt ceiling
const ikasConfig = rdIKAS[0];
const debtCeilingRaw = Number((ikasConfig >> 212n) & 0xFFFFFFFFFn);
console.log('\nIKAS debt ceiling (raw):', debtCeilingRaw, '(×100 USD =', debtCeilingRaw / 100, 'USD max isolation borrow)');
console.log('IKAS isolation mode total debt:', ethers.formatUnits(rdIKAS[14], 2), 'USD');

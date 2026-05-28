import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Get iKAS price from oracle
const ORACLE_ABI = ['function getAssetPrice(address asset) view returns (uint256)'];
const POOL_ABI = ['function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'];

const oracle = new ethers.Contract(CONTRACTS.priceOracle, ORACLE_ABI, provider);
const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);

const [ikasPrice, accountData] = await Promise.all([
  oracle.getAssetPrice(TOKENS.IKAS),
  pool.getUserAccountData(wallet),
]);

const ikasPriceUSD = Number(ikasPrice) / 1e8;
console.log('iKAS price (USD):', ikasPriceUSD);
console.log('2000 iKAS value (USD):', (2000 * ikasPriceUSD).toFixed(2));

// getUserAccountData returns values in base currency (USD with 8 decimals)
console.log('\n=== Raw account data ===');
console.log('totalCollateralBase:', ethers.formatUnits(accountData[0], 8), 'USD');
console.log('totalDebtBase:', ethers.formatUnits(accountData[1], 8), 'USD');
console.log('availableBorrowsBase:', ethers.formatUnits(accountData[2], 8), 'USD');
console.log('currentLiquidationThreshold:', accountData[3].toString(), 'bps');
console.log('ltv:', accountData[4].toString(), 'bps');
console.log('healthFactor:', accountData[5] === 115792089237316195423570985008687907853269984665640564039457584007913129639935n ? '∞' : ethers.formatEther(accountData[5]));

// Calculate: for HF > 4 with 2000 iKAS collateral
// HF = (collateral_USD * liqThreshold) / debt_USD
// debt_USD = (collateral_USD * liqThreshold) / HF_target
const collateralUSD = 2000 * ikasPriceUSD;
// WiKAS isolated mode liq threshold — let's get it
const POOL_DATA_ABI = ['function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)'];
const poolData = new ethers.Contract(CONTRACTS.poolProxy, POOL_DATA_ABI, provider);
const rd = await poolData.getReserveData(TOKENS.IKAS);
// configuration word contains LTV (bits 0-15), liqThreshold (bits 16-31)
const config = rd[0];
const ltv = Number(config & 0xFFFFn) / 100;
const liqThreshold = Number((config >> 16n) & 0xFFFFn) / 100;
console.log('\n=== WiKAS reserve config ===');
console.log('LTV:', ltv, '%');
console.log('Liq Threshold:', liqThreshold, '%');

const maxBorrowForHF4 = (collateralUSD * liqThreshold / 100) / 4;
console.log('\n=== Borrow calc for HF > 4 ===');
console.log('Collateral (2000 iKAS):', collateralUSD.toFixed(2), 'USD');
console.log('Liq threshold:', liqThreshold, '%');
console.log('Max borrow at HF=4:', maxBorrowForHF4.toFixed(2), 'USD');
console.log('Safe borrow (HF~4.2):', (maxBorrowForHF4 * 0.95).toFixed(2), 'USD');

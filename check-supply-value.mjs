import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// Get actual aToken balances (= supplied amounts regardless of collateral flag)
const POOL_ABI = ['function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)'];
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
const ORACLE_ABI = ['function getAssetPrice(address) view returns (uint256)'];

const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);
const oracle = new ethers.Contract(CONTRACTS.priceOracle, ORACLE_ABI, provider);

const assets = { USDC: TOKENS.USDC, IKAS: TOKENS.IKAS };
let totalSupplyUSD = 0;

for (const [sym, addr] of Object.entries(assets)) {
  const rd = await pool.getReserveData(addr);
  const aToken = new ethers.Contract(rd[8], ERC20_ABI, provider); // aTokenAddress
  const [bal, dec, price] = await Promise.all([
    aToken.balanceOf(wallet),
    aToken.decimals(),
    oracle.getAssetPrice(addr),
  ]);
  const balHuman = Number(ethers.formatUnits(bal, dec));
  const priceUSD = Number(price) / 1e8;
  const valueUSD = balHuman * priceUSD;
  totalSupplyUSD += valueUSD;
  console.log(`${sym}: ${balHuman.toFixed(4)} aTokens @ $${priceUSD.toFixed(4)} = $${valueUSD.toFixed(2)}`);
}

console.log(`\nTotal supplied value: $${totalSupplyUSD.toFixed(2)}`);
console.log(`Condition 1 (>= $100): ${totalSupplyUSD >= 100 ? '✅ PASS' : '❌ FAIL — $' + (100 - totalSupplyUSD).toFixed(2) + ' short'}`);

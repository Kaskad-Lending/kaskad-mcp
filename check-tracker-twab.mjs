import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS, TOKENS } from './dist/config.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ABI = require('./src/abi/KaskadActivityTracker.json');

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';
const tracker = new ethers.Contract(CONTRACTS.activityTracker, ABI, provider);

const safe = async (label, fn) => {
  try { const v = await fn(); return `${label}: ${v.toString()}`; }
  catch (e) { return `${label}: ERROR — ${e.message.slice(0, 100)}`; }
};

// Get aToken addresses for USDC and IKAS (needed for tracker calls)
const POOL_ABI = ['function getReserveData(address) view returns (uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)'];
const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);
const [rdUSDC, rdIKAS] = await Promise.all([
  pool.getReserveData(TOKENS.USDC),
  pool.getReserveData(TOKENS.IKAS),
]);
const aUSDC = rdUSDC[8]; // aTokenAddress
const aIKAS = rdIKAS[8];
console.log('aUSDC:', aUSDC);
console.log('aIKAS:', aIKAS);

const results = await Promise.all([
  safe('current epoch', () => tracker.current()),
  safe('START_TIMESTAMP', () => tracker.START_TIMESTAMP()),
  safe('DURATION', () => tracker.DURATION()),
  safe('hasTwapHistory', () => tracker.hasTwapHistory()),
  safe('getTwapTVL', () => tracker.getTwapTVL()),
  safe('lastTvlValue', () => tracker.lastTvlValue()),
  safe('tvlCumulative', () => tracker.tvlCumulative()),
  // Per-user TWAB for current epoch (0)
  safe('getUserTwabForEpoch(wallet, aUSDC, 0)', () => tracker.getUserTwabForEpoch(wallet, aUSDC, 0)),
  safe('getUserTwabForEpoch(wallet, aIKAS, 0)', () => tracker.getUserTwabForEpoch(wallet, aIKAS, 0)),
  safe('userTwabLastUpdate(wallet, aUSDC)', () => tracker.userTwabLastUpdate(wallet, aUSDC)),
  safe('userTwabLastUpdate(wallet, aIKAS)', () => tracker.userTwabLastUpdate(wallet, aIKAS)),
  safe('userBalTimeCumulative(wallet, aUSDC)', () => tracker.userBalTimeCumulative(wallet, aUSDC)),
  safe('userBalTimeCumulative(wallet, aIKAS)', () => tracker.userBalTimeCumulative(wallet, aIKAS)),
  safe('getTotalSupplyTwabForEpoch(aUSDC, 0)', () => tracker.getTotalSupplyTwabForEpoch(aUSDC, 0)),
  safe('getTotalSupplyTwabForEpoch(aIKAS, 0)', () => tracker.getTotalSupplyTwabForEpoch(aIKAS, 0)),
]);

results.forEach(r => console.log(r));

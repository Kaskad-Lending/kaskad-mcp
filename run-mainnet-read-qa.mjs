import { getMarkets } from './dist/tools/getMarkets.js';
import { getProtocolInfo } from './dist/tools/getProtocolInfo.js';
import { getGovernanceParams } from './dist/tools/getGovernanceParams.js';
import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';
import { getStakingInfo } from './dist/tools/manageStaking.js';
import { getEmissions } from './dist/tools/getTokenomics.js';

const wallet = process.env.KASKAD_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';

const run = async (name, fn) => {
  try {
    const r = await fn();
    return { tool: name, ok: true, result: r };
  } catch (e) {
    return { tool: name, ok: false, error: e.message };
  }
};

const results = await Promise.all([
  run('getProtocolInfo', getProtocolInfo),
  run('getMarkets', getMarkets),
  run('getGovernanceParams', getGovernanceParams),
  run('getStakingInfo', getStakingInfo),
  run('getEmissions', getEmissions),
  run('checkHealthFactor', () => checkHealthFactor({ walletAddress: wallet })),
]);

console.log(JSON.stringify(results, null, 2));

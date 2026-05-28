const { checkHealthFactor } = require('./dist/tools/checkHealthFactor.js');
const { getPosition } = require('./dist/tools/getPosition.js');
const { getMarkets } = require('./dist/tools/getMarkets.js');
const { getGovernanceParams } = require('./dist/tools/getGovernanceParams.js');
const { getUserRewards } = require('./dist/tools/getTokenomics.js');
const { claimKSKDRewards } = require('./dist/tools/claimRewards.js');
const { supplyAsset } = require('./dist/tools/executeTransaction.js');
const { getStakingInfo } = require('./dist/tools/manageStaking.js');
const { ethers } = require('ethers');
const { RPC_URL } = require('./dist/contracts.js');

const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';
const privateKey = '0xeda228e120390b4875bcafb92cd85f6426753468e370ad7c618364bf398683b7';

function round2(n) { return Math.round(n * 100) / 100; }

(async () => {
  process.env.MCP_WALLET_KEY = privateKey;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const [hf, position, markets, gov, rewards, staking, nativeBal] = await Promise.all([
    checkHealthFactor(wallet, 1.8),
    getPosition(wallet),
    getMarkets(),
    getGovernanceParams(),
    getUserRewards({ address: wallet }),
    getStakingInfo({ address: wallet }),
    provider.getBalance(wallet),
  ]);

  let action = 'No action';
  let postPosition = position;
  let postRewards = rewards;
  const notes = [];

  if (!('error' in rewards) && rewards.accruedKSKD > 0) {
    const claimRes = await claimKSKDRewards({});
    notes.push({ claimRes });
    const restakeAmount = rewards.accruedKSKD;
    if (restakeAmount > 0) {
      const supplyRes = await supplyAsset({ asset: 'KSKD', amount: restakeAmount });
      notes.push({ supplyRes });
      action = `Claimed ${round2(rewards.accruedKSKD)} KSKD and re-supplied it`;
      postPosition = await getPosition(wallet);
      postRewards = await getUserRewards({ address: wallet });
    }
  }

  console.log(JSON.stringify({ hf, position, markets, gov, rewards, staking, nativeBal: Number(ethers.formatEther(nativeBal)), postPosition, postRewards, action, notes }, null, 2));
})().catch(err => {
  console.error(err);
  process.exit(1);
});

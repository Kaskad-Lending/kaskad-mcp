import { CONTRACTS, TOKENS } from "../contracts.js";
import { safeCall } from "../rpc.js";
import { isAddress } from "ethers";
import {
  EmissionManagerContract,
  EmissionVaultContract,
  RewardsControllerContract,
  ActivityTrackerContract,
  ERC20Contract,
} from "../typed-contracts.js";

const WAD = 10n ** 18n;

const emissionManager = new EmissionManagerContract(CONTRACTS.emissionManager);
const emissionVault = new EmissionVaultContract(CONTRACTS.emissionVault);
const rewardsController = new RewardsControllerContract(CONTRACTS.rewardsController);
const activityTracker = new ActivityTrackerContract(CONTRACTS.activityTracker);

/** Format bigint token amount (18 decimals) to human number */
function formatWad(val: bigint): number {
  return Math.round(Number((val * 1_000_000n) / WAD)) / 1_000_000;
}

export async function getEmissions() {
  return safeCall(async () => {
    const [currentEpoch, emissionPool, remaining, emittedTotal] = await Promise.all([
      emissionManager.current(),
      emissionVault.emissionPool(),
      emissionVault.remainingEmissions(),
      emissionVault.emittedTotal(),
    ]);

    const epoch = Number(currentEpoch);

    // Epoch timing
    const [epochStart, epochEnd, splitBps, distributed] = await Promise.all([
      emissionManager.start(epoch),
      emissionManager.end(epoch),
      emissionManager.emissionSplitBps(),
      emissionManager.isEpochDistributed(epoch),
    ]);

    // Current epoch emission amount
    let currentEpochEmission = 0n;
    try {
      currentEpochEmission = await emissionVault.epochEmission(epoch);
    } catch { /* may not be set yet */ }

    // Previous epoch emission for comparison
    let prevEpochEmission = 0n;
    if (epoch > 0) {
      try {
        prevEpochEmission = await emissionVault.epochEmission(epoch - 1);
      } catch { /* ignore */ }
    }

    // TVL data from activity tracker
    let twapTVL = 0n;
    let lastTvlValue = 0n;
    let hasTwap = false;
    try {
      [twapTVL, lastTvlValue, hasTwap] = await Promise.all([
        activityTracker.getTwapTVL(),
        activityTracker.lastTvlValue(),
        activityTracker.hasTwapHistory(),
      ]);
    } catch { /* activity tracker may not be initialized */ }

    const totalPool = formatWad(emissionPool);
    const totalRemaining = formatWad(remaining);
    const depletionPct = totalPool > 0
      ? Math.round((1 - totalRemaining / totalPool) * 10_000) / 100
      : 0;

    return {
      emission: {
        currentEpoch: epoch,
        epochStart: new Date(Number(epochStart) * 1000).toISOString(),
        epochEnd: new Date(Number(epochEnd) * 1000).toISOString(),
        isDistributed: distributed,
        emissionSplitBps: splitBps,
        emissionSplitNote: `${(splitBps / 100).toFixed(1)}% to suppliers, ${(100 - splitBps / 100).toFixed(1)}% to borrowers`,
        currentEpochEmission: formatWad(currentEpochEmission),
        prevEpochEmission: formatWad(prevEpochEmission),
      },
      vault: {
        totalPool,
        emittedTotal: formatWad(emittedTotal),
        remaining: totalRemaining,
        depletionPct,
        note: "39% of 1B KSKD total supply. When depleted, KSKD emissions stop entirely.",
      },
      tvl: {
        twapTVL: formatWad(twapTVL),
        lastTvlValue: formatWad(lastTvlValue),
        hasTwapHistory: hasTwap,
        note: "TWAL (time-weighted average liquidity) — used for emission weighting and milestone validation.",
      },
    };
  });
}

export async function getUserRewards(params: { address: string }) {
  const { address } = params;
  if (!isAddress(address)) {
    return { error: "Invalid Ethereum address", details: address };
  }

  return safeCall(async () => {
    // Get all aToken addresses for rewards query — rewards are tracked per aToken/debtToken, not underlying
    // We need reserve data to get aToken addresses, but we can use a simpler approach:
    // getAllUserRewards with the known token addresses as assets
    const assetAddresses = Object.values(TOKENS);

    const { rewardsList, claimableAmounts } = await rewardsController.getClaimableRewards(
      assetAddresses,
      address
    );

    const rewards = rewardsList.map((rewardToken, i) => ({
      rewardToken,
      claimable: formatWad(claimableAmounts[i]),
    })).filter(r => r.claimable > 0);

    // Also get accrued KSKD specifically
    let accruedKSKD = 0n;
    try {
      accruedKSKD = await rewardsController.getUserAccruedRewards(address, TOKENS.KSKD);
    } catch { /* ignore */ }

    return {
      address,
      rewards,
      accruedKSKD: formatWad(accruedKSKD),
      note: "Claimable rewards from KSKD emission incentives. Eligibility requires meeting uptime and minimum position thresholds per epoch.",
    };
  });
}

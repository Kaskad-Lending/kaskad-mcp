import { GovernorContract, StrategyContract } from "../typed-contracts.js";

// Correct addresses for Galleon Testnet (chain 38836) — source: setup.json key "38836"
const GOVERNOR = "0xE89b59a211C4645150830Bc63c112d01eE47e888";
const STRATEGY = "0x895016f79282D9A5C8faEA7FcB935310042fF836";

// Decision enum indices (from DecisionParams.sol)
const DECISION_NAMES: Record<number, string> = {
  1:  "TVL_MIN_SUPPLY_USD",
  2:  "TVL_MIN_SUPPLY_UPTIME_BPS",
  3:  "BORROWER_MIN_LTV_BPS",
  4:  "BORROWER_MIN_UPTIME_BPS",
  5:  "EMISSION_SUPPLIERS_SHARE_BPS",
  6:  "UNDISTRIBUTED_TO_NEXT_EPOCH_BPS",
  7:  "DAO_TVL_INCENTIVES_SHARE_BPS",
  8:  "DAO_BURN_SHARE_BPS",
  9:  "DAO_KASPA_CORE_SHARE_BPS",
  10: "MILESTONE_TVL_VS_VESTED_SHARE_BPS",
};

// Bounds from DecisionParams.sol (immutable)
const BOUNDS: Record<number, { min: number; max: number; unit: string; default: number }> = {
  1:  { min: 85,   max: 115,  unit: "USD", default: 100  },
  2:  { min: 8750, max: 9250, unit: "bps", default: 9000 },
  3:  { min: 1500, max: 2000, unit: "bps", default: 1500 },
  4:  { min: 5000, max: 5500, unit: "bps", default: 5500 },
  5:  { min: 4000, max: 6000, unit: "bps", default: 5000 },
  6:  { min: 3500, max: 6500, unit: "bps", default: 5000 },
  7:  { min: 5000, max: 8000, unit: "bps", default: 5000 },
  8:  { min: 1500, max: 2000, unit: "bps", default: 1500 },
  9:  { min: 500,  max: 750,  unit: "bps", default: 500  },
  10: { min: 3500, max: 6500, unit: "bps", default: 5000 },
};

const governor = new GovernorContract(GOVERNOR);
const strategy = new StrategyContract(STRATEGY);

export async function getGovernanceParams() {
  const currentEpoch = Number(await governor.currentEpoch());

  // Walk back from currentEpoch-1 to find the last finalized epoch
  // Per Yuliya's guide: finalizeEpoch() is called by a bot after voting window closes.
  // applyDecision() runs INSIDE finalizeEpoch() — no separate exec step needed.
  let lastFinalizedEpoch = -1;
  for (let e = currentEpoch - 1; e >= 0; e--) {
    try {
      const finalized = await governor.epochFinalized(e);
      if (finalized) { lastFinalizedEpoch = e; break; }
    } catch { break; }
  }

  // Read voted params from last finalized epoch (if any)
  const votedParams: Record<string, { value: number; pct?: string; min: number; max: number; unit: string; default: number }> = {};
  if (lastFinalizedEpoch >= 0) {
    for (const [dStr, name] of Object.entries(DECISION_NAMES)) {
      const d = Number(dStr);
      const b = BOUNDS[d];
      try {
        const val = await governor.epochDecision(lastFinalizedEpoch, d);
        votedParams[name] = {
          value: val,
          ...(b.unit === "bps" ? { pct: (val / 100).toFixed(1) + "%" } : {}),
          min: b.min,
          max: b.max,
          unit: b.unit,
          default: b.default,
        };
      } catch {
        votedParams[name] = { value: -1, min: b.min, max: b.max, unit: b.unit, default: b.default };
      }
    }
  }

  // Read currently-applied params from Strategy contract (ground truth for what's live)
  const appliedParams = await strategy.getAppliedParams();

  // Epoch 8 (currentEpoch-1) status
  const prevEpoch = currentEpoch - 1;
  let prevEpochStatus = "unknown";
  try {
    const finalized = await governor.epochFinalized(prevEpoch);
    prevEpochStatus = finalized ? "finalized" : "voting_open_or_pending_finalization";
  } catch { /* ignore */ }

  return {
    governor: GOVERNOR,
    strategy: STRATEGY,
    currentEpoch,
    prevEpochStatus,
    lastFinalizedEpoch,
    note: lastFinalizedEpoch >= 0
      ? `Governance params from epoch ${lastFinalizedEpoch} (last finalized). Strategy contract reflects these values on-chain. applyDecision() runs inside finalizeEpoch() — no separate execution step.`
      : `No finalized epochs found yet. Strategy is using deploy defaults.`,
    votedParams: lastFinalizedEpoch >= 0 ? votedParams : null,
    appliedParams,
  };
}

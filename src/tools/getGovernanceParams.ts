import { GovernorContract } from "../typed-contracts.js";

// KaskadGovernor — reads live DAO-voted parameters via epochDecision(epoch, decision)
const GOVERNOR = "0xE89b59a211C4645150830Bc63c112d01eE47e888";

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

// Bounds from DecisionParams.sol (immutable contract constants)
const BOUNDS: Record<number, { min: number; max: number; unit: string }> = {
  1:  { min: 85,   max: 115,  unit: "USD" },
  2:  { min: 8750, max: 9250, unit: "bps" },
  3:  { min: 1500, max: 2000, unit: "bps" },
  4:  { min: 5000, max: 5500, unit: "bps" },
  5:  { min: 4000, max: 6000, unit: "bps" },
  6:  { min: 3500, max: 6500, unit: "bps" },
  7:  { min: 5000, max: 8000, unit: "bps" },
  8:  { min: 1500, max: 2000, unit: "bps" },
  9:  { min: 500,  max: 750,  unit: "bps" },
  10: { min: 3500, max: 6500, unit: "bps" },
};

const governor = new GovernorContract(GOVERNOR);

export async function getGovernanceParams() {
  const currentEpoch = Number(await governor.currentEpoch());
  const queryEpoch = currentEpoch > 0 ? currentEpoch - 1 : 0;

  const params: Record<string, { value: number; pct?: string; min: number; max: number; unit: string }> = {};

  for (const [dStr, name] of Object.entries(DECISION_NAMES)) {
    const d = Number(dStr);
    const b = BOUNDS[d];
    try {
      const val = await governor.epochDecision(queryEpoch, d);
      params[name] = {
        value: val,
        ...(b.unit === "bps" ? { pct: (val / 100).toFixed(1) + "%" } : {}),
        min: b.min,
        max: b.max,
        unit: b.unit,
      };
    } catch {
      params[name] = { value: -1, min: b.min, max: b.max, unit: b.unit };
    }
  }

  // Detect if all values are -1 (0 from contract) — means vote concluded but executeProposal() not yet called
  const allUnset = Object.values(params).every(p => p.value === -1 || p.value === 0);
  const govNote = allUnset
    ? `Epoch ${queryEpoch} vote concluded but executeProposal() not yet called — params pending on-chain execution. Bounds are set; voted values will appear after execution.`
    : "Live DAO-voted parameters. EMISSION_SUPPLIERS_SHARE_BPS = supplier share of KSKD emissions (borrowers get remainder). All values are on-chain and reflect last finalized epoch vote.";

  return {
    governor: GOVERNOR,
    currentEpoch,
    paramsFromEpoch: queryEpoch,
    note: govNote,
    pendingExecution: allUnset,
    params,
  };
}

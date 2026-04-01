import * as fs from "fs";
import * as path from "path";
import { CONTRACTS, TOKENS, RPC_URL, CHAIN_ID } from "../contracts.js";

export function getProtocolInfo() {
  // Embed AGENTS.md so any agent calling getProtocolInfo gets full strategy context upfront
  let agentsGuide = "";
  try {
    // Resolve relative to project root (two levels up from dist/tools/)
    const agentsPath = path.resolve(process.cwd(), "AGENTS.md");
    agentsGuide = fs.readFileSync(agentsPath, "utf8");
  } catch {
    agentsGuide = "AGENTS.md not found — refer to https://testnet.kaskad.live for protocol documentation.";
  }

  return {
    protocol: "Kaskad Protocol",
    version: "v1.0 (Aave v3 fork)",
    network: "Igra Galleon Testnet",
    chainId: CHAIN_ID,
    rpc: RPC_URL,
    contracts: {
      poolProxy:             CONTRACTS.poolProxy,
      poolAddressesProvider: CONTRACTS.poolAddressesProvider,
      priceOracle:           CONTRACTS.priceOracle,
      uiPoolDataProvider:    CONTRACTS.uiPoolDataProvider,
      rewardsController:     CONTRACTS.rewardsController,
      activityTracker:       CONTRACTS.activityTracker,
    },
    supportedAssets: Object.entries(TOKENS).map(([symbol, address]) => ({
      symbol,
      address,
    })),
    documentation: "https://docs.kaskad.live",
    dapp: "https://testnet.kaskad.live",
    explorer: "https://explorer.galleon-testnet.igralabs.com",
    agentsGuide,
    agentsGuideNote: "Full integration guide — read before strategizing. Covers emission schedule, eligibility rules, governance params, gas requirements, and KSKD incentive mechanics. For live voted params, call getGovernanceParams().",
  };
}

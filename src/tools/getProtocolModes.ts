/**
 * getProtocolModes.ts
 * Returns live per-asset configuration for all Kaskad reserves:
 * isolation mode, eMode, collateral constraints, and behavioral rules.
 *
 * This is the primary orientation tool for new agents connecting to the MCP.
 * It answers: "how should I behave with each asset?"
 */

import { ethers } from "ethers";
import { RPC_URL, CONTRACTS } from "../contracts.js";

const POOL_ABI = [
  "function getReservesList() view returns (address[])",
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)",
  "function getEModeCategoryData(uint8 id) view returns (uint16 ltv, uint16 liquidationThreshold, uint16 liquidationBonus, address priceSource, string label)",
  "function getUserEMode(address user) view returns (uint256)",
];
const ERC20_ABI = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];

// Decode Aave v3 reserve configuration bitmap
function decodeReserveConfig(config: bigint) {
  return {
    ltv:                   Number((config) & 0xFFFFn),           // bits 0-15
    liquidationThreshold:  Number((config >> 16n) & 0xFFFFn),   // bits 16-31
    liquidationBonus:      Number((config >> 32n) & 0xFFFFn),   // bits 32-47
    decimals:              Number((config >> 48n) & 0xFFn),     // bits 48-55
    active:                Boolean((config >> 56n) & 1n),        // bit 56
    frozen:                Boolean((config >> 57n) & 1n),        // bit 57
    borrowingEnabled:      Boolean((config >> 58n) & 1n),        // bit 58
    stableBorrowEnabled:   Boolean((config >> 59n) & 1n),        // bit 59
    paused:                Boolean((config >> 60n) & 1n),        // bit 60
    borrowableInIsolation: Boolean((config >> 61n) & 1n),        // bit 61
    siloedBorrowing:       Boolean((config >> 62n) & 1n),        // bit 62
    flashLoanEnabled:      Boolean((config >> 63n) & 1n),        // bit 63
    reserveFactor:         Number((config >> 64n) & 0xFFFFn),   // bits 64-79
    eModeCategory:         Number((config >> 168n) & 0xFFn),    // bits 168-175
    unbackedMintCap:       Number((config >> 176n) & 0x3FFFFFFFFFFn), // bits 176-211
    debtCeiling:           Number((config >> 212n) & 0x3FFFFFFFFFFn), // bits 212-251 (in USD * 100)
  };
}

// Generate behavioral rules for an asset based on its config
function generateBehavioralRules(symbol: string, cfg: ReturnType<typeof decodeReserveConfig>, debtCeilingUSD: number): string[] {
  const rules: string[] = [];
  const isIsolated = debtCeilingUSD > 0;

  if (isIsolated) {
    rules.push(`ISOLATION MODE: ${symbol} has a debt ceiling of $${debtCeilingUSD.toLocaleString()} USD total protocol-wide.`);
    rules.push(`If ${symbol} is your collateral, you are in isolation mode. You CANNOT enable any other asset as collateral simultaneously.`);
    rules.push(`In isolation mode, you can only borrow assets flagged as 'borrowableInIsolation' (typically stablecoins).`);
    rules.push(`Other supplied assets (e.g. USDC) still earn yield but their collateral flag is automatically disabled.`);
    rules.push(`To exit isolation mode: repay all debt → withdraw ${symbol} → re-supply any non-isolated asset → call setUserUseReserveAsCollateral on the new asset.`);
    rules.push(`After exiting isolation mode, the user configuration bitmap resets to 0. A fresh supply transaction is required to re-register the asset in the bitmap before setUserUseReserveAsCollateral can succeed.`);
  }

  if (cfg.borrowableInIsolation) {
    rules.push(`${symbol} can be borrowed by wallets in isolation mode.`);
  } else if (!isIsolated) {
    rules.push(`${symbol} CANNOT be borrowed by wallets in isolation mode.`);
  }

  if (cfg.siloedBorrowing) {
    rules.push(`SILOED BORROWING: If ${symbol} is borrowed, no other assets can be borrowed simultaneously.`);
  }

  if (cfg.eModeCategory > 0) {
    rules.push(`${symbol} is in eMode category ${cfg.eModeCategory}. Within this category, LTV and liquidation thresholds are enhanced.`);
  }

  if (!cfg.active) rules.push(`⚠️ ${symbol} is INACTIVE on this network.`);
  if (cfg.frozen) rules.push(`⚠️ ${symbol} is FROZEN — no new supply or borrow allowed.`);
  if (cfg.paused) rules.push(`⚠️ ${symbol} is PAUSED — all operations suspended.`);
  if (!cfg.borrowingEnabled) rules.push(`${symbol} borrowing is DISABLED.`);

  return rules;
}

export async function getProtocolModes(): Promise<object> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const pool = new ethers.Contract(CONTRACTS.poolProxy, POOL_ABI, provider);

  const reserves = await pool.getReservesList() as string[];

  const assetModes: object[] = [];
  const eModeCategories: Record<number, object> = {};

  for (const reserveAddr of reserves) {
    const rd = await pool.getReserveData(reserveAddr);
    const cfg = decodeReserveConfig(rd[0] as bigint);

    // Get symbol from ERC20
    const token = new ethers.Contract(reserveAddr, ERC20_ABI, provider);
    const symbol = await token.symbol().catch(() => reserveAddr.slice(0, 8));

    const debtCeilingUSD = cfg.debtCeiling > 0 ? cfg.debtCeiling / 100 : 0;
    const isolationModeTotalDebt = Number(ethers.formatUnits(rd[14], 2)); // stored as USD*100 cents

    // Fetch eMode category data if applicable
    if (cfg.eModeCategory > 0 && !eModeCategories[cfg.eModeCategory]) {
      try {
        const eModeData = await pool.getEModeCategoryData(cfg.eModeCategory);
        eModeCategories[cfg.eModeCategory] = {
          id: cfg.eModeCategory,
          label: eModeData[4],
          ltv: eModeData[0],
          liquidationThreshold: eModeData[1],
          liquidationBonus: eModeData[2],
        };
      } catch {
        // eMode may not be configured
      }
    }

    assetModes.push({
      symbol,
      address: reserveAddr,
      aTokenAddress: rd[8],
      // Collateral parameters
      ltv: cfg.ltv,
      ltv_pct: (cfg.ltv / 100).toFixed(2) + "%",
      liquidationThreshold: cfg.liquidationThreshold,
      liquidationThreshold_pct: (cfg.liquidationThreshold / 100).toFixed(2) + "%",
      liquidationBonus: cfg.liquidationBonus,
      // Status flags
      active: cfg.active,
      frozen: cfg.frozen,
      paused: cfg.paused,
      borrowingEnabled: cfg.borrowingEnabled,
      flashLoanEnabled: cfg.flashLoanEnabled,
      // Mode configuration
      eModeCategory: cfg.eModeCategory,
      // Isolation mode
      isolationMode: debtCeilingUSD > 0,
      debtCeiling_USD: debtCeilingUSD,
      isolationModeTotalDebt_USD: isolationModeTotalDebt,
      isolationModeCapacityUsed_pct: debtCeilingUSD > 0
        ? ((isolationModeTotalDebt / debtCeilingUSD) * 100).toFixed(2) + "%"
        : "N/A",
      borrowableInIsolation: cfg.borrowableInIsolation,
      siloedBorrowing: cfg.siloedBorrowing,
      reserveFactor_pct: (cfg.reserveFactor / 100).toFixed(2) + "%",
      // Plain-English behavioral rules for agents
      behavioralRules: generateBehavioralRules(symbol, cfg, debtCeilingUSD),
    });
  }

  // Protocol-level mode summary
  const isolatedAssets = assetModes.filter((a: any) => a.isolationMode).map((a: any) => a.symbol);
  const siloedAssets = assetModes.filter((a: any) => a.siloedBorrowing).map((a: any) => a.symbol);
  const borrowableInIsolation = assetModes.filter((a: any) => a.borrowableInIsolation).map((a: any) => a.symbol);
  const eModeAssets = assetModes.filter((a: any) => a.eModeCategory > 0).map((a: any) => `${a.symbol} (cat ${a.eModeCategory})`);

  return {
    summary: {
      isolatedAssets,
      siloedAssets,
      borrowableInIsolation,
      eModeAssets,
      eModeCategories: Object.values(eModeCategories),
      keyRules: [
        "A wallet can only be in ONE isolation mode at a time. Enabling an isolated asset as collateral automatically disables all other collateral.",
        "Isolated asset collateral can only borrow assets listed in borrowableInIsolation.",
        "Exiting isolation mode (withdrawing isolated collateral) resets the user bitmap to 0. A fresh supply of any asset is required before setUserUseReserveAsCollateral can succeed.",
        "KSKD emission eligibility is based on TWAB (time-weighted average balance) from supply/borrow activity — NOT on stKSKD holdings.",
        "Governance voting requires BOTH an active supply/borrow position AND stKSKD holdings simultaneously. Neither alone is sufficient. stKSKD has no effect on emission eligibility.",
        "Emission eligibility thresholds: supply >= $100 USD, supply uptime >= 90% of epoch, borrow LTV >= 15%, borrow uptime >= 55% of epoch.",
      ],
    },
    assets: assetModes,
  };
}

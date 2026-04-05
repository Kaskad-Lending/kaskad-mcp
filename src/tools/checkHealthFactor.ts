import { getPosition } from "./getPosition.js";
import { isAddress } from "ethers";

export interface HealthFactorResult {
  address: string;
  healthFactor: number | string;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  liquidationThreshold: number;
  alert: boolean;
  alertLevel: "safe" | "warning" | "danger" | "critical" | "no_position";
  message: string;
  threshold: number;
  recommendedAction: string | null;
}

/**
 * Check whether a wallet's health factor is below a given threshold.
 * Designed for agent monitoring loops — call on a cron/interval and act on alert:true.
 *
 * Alert levels:
 *   safe     — HF >= threshold (all clear)
 *   warning  — HF < threshold but >= 1.2 (monitor closely)
 *   danger   — HF < 1.2 but >= 1.05 (consider repaying)
 *   critical — HF < 1.05 (liquidation imminent)
 *   no_position — no debt, HF is infinite
 */
export async function checkHealthFactor(
  input: string | { walletAddress?: string; address?: string; threshold?: number },
  thresholdArg: number = 1.5
): Promise<HealthFactorResult | { error: string; details?: any }> {
  const userAddress = typeof input === "string" ? input : (input.walletAddress ?? input.address ?? "");
  const threshold = typeof input === "string" ? thresholdArg : (input.threshold ?? thresholdArg);

  if (!isAddress(userAddress)) {
    return { error: "Invalid Ethereum address", details: typeof input === "string" ? userAddress : input };
  }
  if (threshold <= 1.0 || threshold > 10) {
    return { error: "Threshold must be between 1.0 and 10.0", details: `Got: ${threshold}` };
  }

  const position = await getPosition(userAddress);
  if ("error" in position) {
    return position;
  }

  const totalDebtUSD = position.totalDebtUSD;
  const totalCollateralUSD = position.totalCollateralUSD;
  const availableBorrowsUSD = position.availableBorrowsUSD;
  const liquidationThreshold = position.liquidationThreshold;
  const hf = position.healthFactor;

  // No debt — position is safe, HF is infinite
  if (totalDebtUSD === 0) {
    return {
      address: userAddress,
      healthFactor: "∞",
      totalCollateralUSD: Math.round(totalCollateralUSD * 100) / 100,
      totalDebtUSD: 0,
      availableBorrowsUSD: Math.round(availableBorrowsUSD * 100) / 100,
      liquidationThreshold,
      alert: false,
      alertLevel: "no_position" as const,
      message: "No outstanding debt. Health factor is infinite.",
      threshold,
      recommendedAction: null,
    };
  }

  const hfNum = typeof hf === "number" ? hf : 999;
  const alert = hfNum < threshold;

  let alertLevel: HealthFactorResult["alertLevel"] = "safe";
  let message = `Health factor ${hfNum.toFixed(4)} is above threshold ${threshold}. Position is safe.`;
  let recommendedAction: string | null = null;

  if (hfNum < 1.05) {
    alertLevel = "critical";
    message = `CRITICAL: Health factor ${hfNum.toFixed(4)} — liquidation imminent (threshold 1.05). Repay debt immediately.`;
    recommendedAction = `Repay borrowed assets immediately to avoid liquidation. Use repay(asset, -1) to clear full debt.`;
  } else if (hfNum < 1.2) {
    alertLevel = "danger";
    message = `DANGER: Health factor ${hfNum.toFixed(4)} — high liquidation risk. Repay debt or add collateral urgently.`;
    recommendedAction = `Repay a portion of borrowed assets or supply additional collateral to bring HF above 1.5.`;
  } else if (hfNum < threshold) {
    alertLevel = "warning";
    message = `WARNING: Health factor ${hfNum.toFixed(4)} is below your threshold of ${threshold}.`;
    recommendedAction = `Monitor closely. Consider repaying some debt or adding collateral to restore a safe margin.`;
  }

  return {
    address: userAddress,
    healthFactor: hfNum,
    totalCollateralUSD: Math.round(totalCollateralUSD * 100) / 100,
    totalDebtUSD: Math.round(totalDebtUSD * 100) / 100,
    availableBorrowsUSD: Math.round(availableBorrowsUSD * 100) / 100,
    liquidationThreshold,
    alert,
    alertLevel,
    message,
    threshold,
    recommendedAction,
  };
}

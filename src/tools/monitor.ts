/**
 * Kaskad DeFi Agent — Yield Optimizer & Health Monitor
 *
 * Strategy:
 *   - Maximize yield on supplied assets
 *   - Keep HF ≥ 1.8 (target), floor 1.5
 *   - Maintain KSKD emission eligibility (stay above uptime threshold)
 *   - Strategize based on current governance params
 *   - Never borrow to supply the same asset (circular risk)
 *   - Never borrow if post-action HF < 1.8
 *   - Always keep ≥ 10,000 iKAS in wallet as reserve
 *
 * Reports every run to Discord regardless of action taken.
 */

import { checkHealthFactor } from "./checkHealthFactor.js";
import { getPosition } from "./getPosition.js";
import { getMarkets } from "./getMarkets.js";
import { getGovernanceParams } from "./getGovernanceParams.js";

const WALLET = process.env.WALLET_ADDRESS ?? "";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_MCP_LIVE ?? "";
const HF_TARGET = 1.8;
const HF_FLOOR = 1.5;
const IKAS_RESERVE = 10_000;

// ── Discord reporter ──────────────────────────────────────────────────────────

async function postToDiscord(content: string): Promise<void> {
  if (!DISCORD_WEBHOOK) {
    console.log("[Discord] No webhook configured — logging to stdout only");
    console.log(content);
    return;
  }
  try {
    const { default: https } = await import("https");
    const body = JSON.stringify({ content });
    await new Promise<void>((resolve, reject) => {
      const url = new URL(DISCORD_WEBHOOK);
      const req = https.request(
        { hostname: url.hostname, path: url.pathname + url.search, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
        (res) => { res.resume(); resolve(); }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } catch (e) {
    console.error("[Discord] Failed to post:", e);
  }
}

// ── Strategy engine ───────────────────────────────────────────────────────────

interface StrategyDecision {
  action: "none" | "rebalance" | "repay" | "supply_more" | "borrow_more";
  reason: string;
  details?: string;
}

async function evaluateStrategy(
  position: Awaited<ReturnType<typeof getPosition>>,
  markets: Awaited<ReturnType<typeof getMarkets>>,
  govParams: Awaited<ReturnType<typeof getGovernanceParams>>,
  hfResult: Awaited<ReturnType<typeof checkHealthFactor>>
): Promise<StrategyDecision> {
  if ("error" in position || "error" in markets || "error" in hfResult) {
    return { action: "none", reason: "Data fetch error — skipping strategy evaluation" };
  }
  if ("error" in govParams) {
    return { action: "none", reason: "Governance params unavailable — skipping strategy" };
  }

  const hf = typeof hfResult.healthFactor === "number" ? hfResult.healthFactor : 999;

  // 1. HF emergency — repay immediately
  if (hf < HF_FLOOR) {
    return {
      action: "repay",
      reason: `HF ${hf.toFixed(4)} below floor ${HF_FLOOR} — emergency repay required`,
      details: hfResult.recommendedAction ?? undefined,
    };
  }

  // 2. HF warning — no new borrows
  if (hf < HF_TARGET) {
    return {
      action: "none",
      reason: `HF ${hf.toFixed(4)} below target ${HF_TARGET} — holding, no new borrows until HF recovers`,
    };
  }

  // 3. Check best supply APY opportunity
  if (!("error" in markets)) {
    const sortedByAPY = [...markets.markets].sort((a, b) => b.supplyAPY - a.supplyAPY);
    const bestMarket = sortedByAPY[0];
    const currentPositions = !("error" in position) ? position.positions : [];
    const currentBest = currentPositions.reduce(
      (best: { asset: string; apy: number } | null, p) => {
        const mk = markets.markets.find((m) => m.asset.toUpperCase() === p.asset.toUpperCase());
        if (!mk || p.suppliedUSD <= 0) return best;
        if (!best || mk.supplyAPY > best.apy) return { asset: p.asset, apy: mk.supplyAPY };
        return best;
      },
      null
    );

    if (bestMarket && currentBest && bestMarket.supplyAPY > currentBest.apy + 0.5) {
      return {
        action: "rebalance",
        reason: `Better yield available: ${bestMarket.asset} at ${bestMarket.supplyAPY.toFixed(2)}% vs current best ${currentBest.asset} at ${currentBest.apy.toFixed(2)}%`,
        details: `Consider moving supply to ${bestMarket.asset} — ${(bestMarket.supplyAPY - currentBest.apy).toFixed(2)}% APY gain`,
      };
    }
  }

  return { action: "none", reason: "Position optimal — no rebalancing needed" };
}

// ── Report builder ────────────────────────────────────────────────────────────

function buildReport(
  timestamp: string,
  hfResult: Awaited<ReturnType<typeof checkHealthFactor>>,
  position: Awaited<ReturnType<typeof getPosition>>,
  markets: Awaited<ReturnType<typeof getMarkets>>,
  decision: StrategyDecision
): string {
  const hf = !("error" in hfResult) ? hfResult.healthFactor : "N/A";
  const hfIcon = !("error" in hfResult) && typeof hf === "number"
    ? hf >= HF_TARGET ? "✅" : hf >= HF_FLOOR ? "⚠️" : "🚨"
    : "❓";

  const posLine = !("error" in position)
    ? `Collateral: $${position.totalCollateralUSD.toLocaleString()} | Debt: $${position.totalDebtUSD.toLocaleString()} | Available: $${position.availableBorrowsUSD.toLocaleString()}`
    : "Position data unavailable";

  const apyLine = !("error" in markets)
    ? markets.markets
        .filter((m) => m.liquidityAvailableUSD > 0)
        .slice(0, 5)
        .map((m) => `${m.asset} ${m.supplyAPY.toFixed(1)}%`)
        .join(" | ")
    : "Market data unavailable";

  const eligLine = !("error" in position) && position.eligibility
    ? `Supplier ${position.eligibility.isSupplierEligible ? "✅" : "❌"} | Borrower ${position.eligibility.isBorrowerEligible ? "✅" : "❌"} | Epoch ${position.eligibility.currentEpoch}`
    : "";

  const actionIcon = decision.action === "none" ? "—" :
    decision.action === "repay" ? "🚨 REPAY" :
    decision.action === "rebalance" ? "🔄 REBALANCE" : "📈 OPTIMIZE";

  return [
    `**[${timestamp}] Kaskad Agent — Hourly Check**`,
    `HF: **${hf}** ${hfIcon} | ${posLine}`,
    `Supply APY snapshot: ${apyLine}`,
    eligLine ? `KSKD Eligibility: ${eligLine}` : null,
    `Action: **${actionIcon}** — ${decision.reason}`,
    decision.details ? `> ${decision.details}` : null,
  ].filter(Boolean).join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runMonitorCycle(): Promise<void> {
  const timestamp = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  });

  console.log(`[${timestamp}] Running monitor cycle for ${WALLET}`);

  if (!WALLET) {
    await postToDiscord("❌ Monitor error: WALLET_ADDRESS not configured");
    return;
  }

  const [hfResult, positionResult, marketsResult, govResult] = await Promise.allSettled([
    checkHealthFactor(WALLET, HF_TARGET),
    getPosition(WALLET),
    getMarkets(),
    getGovernanceParams(),
  ]);

  const hf = hfResult.status === "fulfilled" ? hfResult.value : { error: "fetch failed" };
  const position = positionResult.status === "fulfilled" ? positionResult.value : { error: "fetch failed" };
  const markets = marketsResult.status === "fulfilled" ? marketsResult.value : { error: "fetch failed" };
  const gov = govResult.status === "fulfilled" ? govResult.value : { error: "fetch failed" };

  const decision = await evaluateStrategy(position as any, markets as any, gov as any, hf as any);
  const report = buildReport(timestamp, hf as any, position as any, markets as any, decision);

  await postToDiscord(report);
  console.log(report);
}

// Run immediately if called directly
if (process.argv[1]?.endsWith("monitor.js") || process.argv[1]?.endsWith("monitor.ts")) {
  runMonitorCycle().catch(console.error);
}

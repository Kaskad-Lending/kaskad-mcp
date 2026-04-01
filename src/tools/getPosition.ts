import { CONTRACTS, TOKEN_SYMBOLS, DEAD_POOL_ADDRESSES } from "../contracts.js";
import { getMarkets } from "./getMarkets.js";
import { safeCall } from "../rpc.js";
import { isAddress } from "ethers";
import { PoolContract, OracleContract, ERC20Contract } from "../typed-contracts.js";

const WAD = 10n ** 18n;
const BASE_DECIMALS = 8; // Aave oracle: base currency USD with 8 decimals

interface PositionEntry {
  asset: string;
  address: string;
  supplied: number;
  borrowed: number;
  suppliedUSD: number;
  borrowedUSD: number;
}

interface PositionResult {
  address: string;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  availableBorrowsUSD: number;
  healthFactor: number | string;
  ltv: number;
  liquidationThreshold: number;
  avgSupplyAPY: number;
  netPositionAPY: number;
  positions: PositionEntry[];
}

/** Convert base-8 Aave value → human USD */
export function baseToUSD(val: bigint): number {
  return Number((val * 1_000_000n) / 10n ** BigInt(BASE_DECIMALS)) / 1_000_000;
}

/** Convert WAD healthFactor → number (capped at 999 for "infinite") */
export function wadToHF(val: bigint): number | string {
  if (val === 0n) return "N/A";
  if (val > 10n ** 30n) return "∞";
  return Math.round(Number((val * 10_000n) / WAD)) / 10_000;
}

const pool = new PoolContract(CONTRACTS.poolProxy);
const oracle = new OracleContract(CONTRACTS.priceOracle);

export async function getPosition(
  userAddress: string
): Promise<PositionResult | { error: string; details?: string; rpc?: string }> {
  if (!isAddress(userAddress)) {
    return { error: "Invalid Ethereum address", details: userAddress };
  }

  return safeCall(async () => {
    const accountData = await pool.getUserAccountData(userAddress);

    const addresses = await pool.getReservesList();
    const priceList = await oracle.getAssetsPrices(addresses);

    const positions: PositionEntry[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      if (DEAD_POOL_ADDRESSES.has(addr.toLowerCase())) continue;
      const price = priceList[i] ?? 0n;

      // Fetch actual decimals from the underlying token (USDC=6, WBTC=8, others=18)
      const erc20 = new ERC20Contract(addr);
      let decimals = 18;
      try {
        decimals = await erc20.decimals();
      } catch { /* default 18 */ }

      let rd;
      try {
        rd = await pool.getReserveData(addr);
      } catch {
        continue;
      }

      const aToken = new ERC20Contract(rd.aTokenAddress);
      const varDebtToken = new ERC20Contract(rd.variableDebtTokenAddress);

      let aBalance = 0n;
      let debtBalance = 0n;

      try { aBalance = await aToken.balanceOf(userAddress); } catch { /* ignore */ }
      try { debtBalance = await varDebtToken.balanceOf(userAddress); } catch { /* ignore */ }

      if (aBalance === 0n && debtBalance === 0n) continue;

      const denom = 10n ** BigInt(decimals);
      const suppliedUSD = Number((aBalance * price * 1_000_000n) / (denom * 10n ** 8n)) / 1_000_000;
      const borrowedUSD = Number((debtBalance * price * 1_000_000n) / (denom * 10n ** 8n)) / 1_000_000;

      // Resolve symbol: use whitelist first, fall back to on-chain symbol()
      let symbol = TOKEN_SYMBOLS[addr.toLowerCase()];
      if (!symbol) {
        try {
          symbol = await erc20.symbol();
        } catch {
          symbol = addr.slice(0, 8);
        }
      }

      positions.push({
        asset: symbol,
        address: addr,
        supplied: Math.round(suppliedUSD * 100) / 100,
        borrowed: Math.round(borrowedUSD * 100) / 100,
        suppliedUSD: Math.round(suppliedUSD * 100) / 100,
        borrowedUSD: Math.round(borrowedUSD * 100) / 100,
      });
    }

    // Read stKSKD vault position
    const stKSKDToken = new ERC20Contract(CONTRACTS.stKSKDVault);
    let stakedKSKD = 0;
    try {
      const stShares = await stKSKDToken.balanceOf(userAddress);
      stakedKSKD = Math.round(Number((stShares * 1_000_000n) / WAD)) / 1_000_000;
    } catch { /* ignore */ }

    // Compute APY metrics
    let netPositionAPY = 0;
    let avgSupplyAPY = 0;
    try {
      const marketsData = await getMarkets();
      if ("error" in marketsData) throw new Error("markets unavailable");
      const marketMap: Record<string, { supplyAPY: number; borrowAPY: number }> = {};
      marketsData.markets.forEach((mk) => {
        marketMap[mk.asset.toUpperCase()] = mk;
      });

      let totalSupplyYieldUSD = 0;
      let totalBorrowCostUSD = 0;
      let totalSuppliedUSD = 0;
      const totalCollateralUSD = baseToUSD(accountData.totalCollateralBase);

      for (const pos of positions) {
        const mk = marketMap[pos.asset?.toUpperCase()];
        if (!mk) continue;
        totalSupplyYieldUSD += pos.suppliedUSD * (mk.supplyAPY / 100);
        totalBorrowCostUSD += pos.borrowedUSD * (mk.borrowAPY / 100);
        totalSuppliedUSD += pos.suppliedUSD;
      }

      avgSupplyAPY = totalSuppliedUSD > 0
        ? Math.round((totalSupplyYieldUSD / totalSuppliedUSD) * 10000) / 100
        : 0;

      if (totalCollateralUSD > 0) {
        netPositionAPY = Math.round(((totalSupplyYieldUSD - totalBorrowCostUSD) / totalCollateralUSD) * 10000) / 100;
      }
    } catch { /* net APY is best-effort */ }

    return {
      address: userAddress,
      totalCollateralUSD: Math.round(baseToUSD(accountData.totalCollateralBase) * 100) / 100,
      totalDebtUSD: Math.round(baseToUSD(accountData.totalDebtBase) * 100) / 100,
      availableBorrowsUSD: Math.round(baseToUSD(accountData.availableBorrowsBase) * 100) / 100,
      healthFactor: wadToHF(accountData.healthFactor),
      ltv: Number(accountData.ltv) / 100,
      liquidationThreshold: Number(accountData.currentLiquidationThreshold) / 100,
      avgSupplyAPY,
      netPositionAPY,
      positions,
      staking: {
        stKSKDVault: CONTRACTS.stKSKDVault,
        stakedKSKD,
        note: "stKSKD grants governance eligibility (isEligibleBorrower/isEligibleSupplier). Use stake()/unstake() to manage.",
      },
    };
  });
}

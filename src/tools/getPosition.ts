import { CONTRACTS, POOL_ABI, ORACLE_ABI, TOKEN_SYMBOLS, ERC20_ABI, DEAD_POOL_ADDRESSES } from "../contracts.js";
import { getMarkets } from "./getMarkets.js";
import { callFunction, safeCall } from "../rpc.js";
import { isAddress } from "ethers";

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
function baseToUSD(val: bigint): number {
  return Number((val * 1_000_000n) / 10n ** BigInt(BASE_DECIMALS)) / 1_000_000;
}

/** Convert WAD healthFactor → number (capped at 999 for "infinite") */
function wadToHF(val: bigint): number | string {
  if (val === 0n) return "N/A";
  // Max uint256 / 2 ≈ infinity → return ∞
  if (val > 10n ** 30n) return "∞";
  return Math.round(Number((val * 10_000n) / WAD)) / 10_000;
}

export async function getPosition(
  userAddress: string
): Promise<PositionResult | { error: string; details?: string; rpc?: string }> {
  if (!isAddress(userAddress)) {
    return { error: "Invalid Ethereum address", details: userAddress };
  }

  return safeCall(async () => {
    // 1. getUserAccountData
    const accountData = await callFunction(
      POOL_ABI,
      CONTRACTS.poolProxy,
      "getUserAccountData",
      [userAddress]
    );

    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      healthFactor,
    ] = accountData as bigint[];

    // 2. Get reserves to find individual positions
    const [reserveAddresses] = await callFunction(
      POOL_ABI,
      CONTRACTS.poolProxy,
      "getReservesList",
      []
    );
    const addresses = reserveAddresses as string[];

    // 3. Get prices
    const [prices] = await callFunction(
      ORACLE_ABI,
      CONTRACTS.priceOracle,
      "getAssetsPrices",
      [addresses]
    );
    const priceList = prices as bigint[];

    // 4. Check aToken and debtToken balances for each reserve
    const positions: PositionEntry[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      // Skip dead pools (deprecated testnet deploys — stranded funds, no dApp support)
      if (DEAD_POOL_ADDRESSES.has(addr.toLowerCase())) continue;
      const price = priceList[i] ?? 0n;

      // Fetch actual decimals from the underlying token (USDC=6, WBTC=8, others=18)
      let decimals = 18;
      try {
        const [dec] = await callFunction(ERC20_ABI, addr, "decimals", []);
        decimals = Number(dec);
      } catch { /* default 18 */ }

      let reserveResult: unknown[];
      try {
        reserveResult = await callFunction(
          POOL_ABI,
          CONTRACTS.poolProxy,
          "getReserveData",
          [addr]
        );
      } catch {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rd = reserveResult[0] as any;
      const aTokenAddr: string = rd.aTokenAddress;
      const varDebtAddr: string = rd.variableDebtTokenAddress;

      let aBalance = 0n;
      let debtBalance = 0n;

      try {
        const [b] = await callFunction(
          ["function balanceOf(address) view returns (uint256)"],
          aTokenAddr,
          "balanceOf",
          [userAddress]
        );
        aBalance = b as bigint;
      } catch { /* ignore */ }

      try {
        const [b] = await callFunction(
          ["function balanceOf(address) view returns (uint256)"],
          varDebtAddr,
          "balanceOf",
          [userAddress]
        );
        debtBalance = b as bigint;
      } catch { /* ignore */ }

      if (aBalance === 0n && debtBalance === 0n) continue;

      // Convert to USD
      const denom = 10n ** BigInt(decimals);
      const suppliedUSD = Number((aBalance * price * 1_000_000n) / (denom * 10n ** 8n)) / 1_000_000;
      const borrowedUSD = Number((debtBalance * price * 1_000_000n) / (denom * 10n ** 8n)) / 1_000_000;

      // Resolve symbol: use whitelist first, fall back to on-chain symbol()
      let symbol = TOKEN_SYMBOLS[addr.toLowerCase()];
      if (!symbol) {
        try {
          const [onChainSym] = await callFunction(ERC20_ABI, addr, "symbol", []);
          symbol = onChainSym as string;
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

    // 5. Read stKSKD vault position
    let stakedKSKD = 0;
    try {
      const [stShares] = await callFunction(
        ["function balanceOf(address) view returns (uint256)"],
        CONTRACTS.stKSKDVault,
        "balanceOf",
        [userAddress]
      );
      stakedKSKD = Math.round(Number((stShares as bigint) * 1_000_000n / WAD)) / 1_000_000;
    } catch { /* ignore */ }

    // Compute APY metrics
    let netPositionAPY = 0;
    let avgSupplyAPY = 0;
    try {
      const marketsData = await getMarkets();
      if ("error" in marketsData) throw new Error("markets unavailable");
      const marketMap: Record<string, { supplyAPY: number; borrowAPY: number }> = {};
      marketsData.markets.forEach((mk: { asset: string; supplyAPY: number; borrowAPY: number }) => {
        marketMap[mk.asset.toUpperCase()] = mk;
      });

      let totalSupplyYieldUSD = 0;
      let totalBorrowCostUSD = 0;
      let totalSuppliedUSD = 0;
      const totalCollateralUSD = baseToUSD(totalCollateralBase);

      for (const pos of positions) {
        const mk = marketMap[pos.asset?.toUpperCase()];
        if (!mk) continue;
        totalSupplyYieldUSD += pos.suppliedUSD * (mk.supplyAPY / 100);
        totalBorrowCostUSD += pos.borrowedUSD * (mk.borrowAPY / 100);
        totalSuppliedUSD += pos.suppliedUSD;
      }

      // avgSupplyAPY: weighted average of supply APY across supplied assets (matches dApp "Avg APY" in Supply card)
      avgSupplyAPY = totalSuppliedUSD > 0
        ? Math.round((totalSupplyYieldUSD / totalSuppliedUSD) * 10000) / 100
        : 0;

      // netPositionAPY: (supply yield - borrow cost) / total collateral — true net yield
      if (totalCollateralUSD > 0) {
        netPositionAPY = Math.round(((totalSupplyYieldUSD - totalBorrowCostUSD) / totalCollateralUSD) * 10000) / 100;
      }


    } catch { /* ignore — net APY is best-effort */ }

    return {
      address: userAddress,
      totalCollateralUSD: Math.round(baseToUSD(totalCollateralBase) * 100) / 100,
      totalDebtUSD: Math.round(baseToUSD(totalDebtBase) * 100) / 100,
      availableBorrowsUSD: Math.round(baseToUSD(availableBorrowsBase) * 100) / 100,
      healthFactor: wadToHF(healthFactor),
      ltv: Number(ltv) / 100,
      liquidationThreshold: Number(currentLiquidationThreshold) / 100,
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

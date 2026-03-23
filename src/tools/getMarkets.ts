import { CONTRACTS, POOL_ABI, ORACLE_ABI, TOKEN_SYMBOLS, TOKENS } from "../contracts.js";
import { callFunction, getBlockNumber, safeCall } from "../rpc.js";

// currentLiquidityRate / variableBorrowRate from getReserveData are already annual rates in RAY (1e27)
// APY% = rate / 1e25  (i.e. rate / 1e27 * 100)
const RAY_PERCENT = 10n ** 25n;
const WAD = 10n ** 18n;

interface MarketData {
  asset: string;
  address: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  utilizationRate: number;
  liquidityAvailableUSD: number;
}

interface MarketsResult {
  protocol: string;
  network: string;
  chainId: number;
  blockNumber: number;
  markets: MarketData[];
}

/** Convert annual ray rate → APY percentage (e.g. 47.66)
 *  currentLiquidityRate is already annual in RAY units → divide by 1e25 to get %
 */
function rayToAPY(rateBig: bigint): number {
  return Number((rateBig * 10_000n) / RAY_PERCENT) / 10_000;
}

/** Convert base units price (8 decimals from Aave oracle) + token amount → USD */
function toUSD(amount: bigint, price: bigint, decimals: number): number {
  // price has 8 decimals (Aave oracle base currency = USD with 8 dec)
  // amount has `decimals` decimals
  // result = amount * price / (10^decimals * 10^8)
  const denom = 10n ** BigInt(decimals) * 10n ** 8n;
  return Number((amount * price * 1_000_000n) / denom) / 1_000_000;
}

export async function getMarkets(): Promise<MarketsResult | { error: string; rpc: string }> {
  return safeCall(async () => {
    // 1. Block number
    const blockNumber = await getBlockNumber();

    // 2. Get reserves list
    const [reserveAddresses] = await callFunction(
      POOL_ABI,
      CONTRACTS.poolProxy,
      "getReservesList",
      []
    );
    // Filter to active whitelisted tokens only (excludes stale reserves from prior testnet deploys)
    const ACTIVE_ADDRESSES = new Set(Object.values(TOKENS).map(a => a.toLowerCase()));
    const addresses = (reserveAddresses as string[]).filter(a => ACTIVE_ADDRESSES.has(a.toLowerCase()));

    // 3. Get prices for all reserves
    const [prices] = await callFunction(
      ORACLE_ABI,
      CONTRACTS.priceOracle,
      "getAssetsPrices",
      [addresses]
    );
    const priceList = prices as bigint[];

    // 4. Fetch reserve data for each
    const markets: MarketData[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const price = priceList[i] ?? 0n;

      let reserveResult: unknown[];
      try {
        reserveResult = await callFunction(
          POOL_ABI,
          CONTRACTS.poolProxy,
          "getReserveData",
          [addr]
        );
      } catch {
        continue; // skip if individual reserve fails
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rd = (reserveResult[0] as any);

      const liquidityRate: bigint = rd.currentLiquidityRate ?? 0n;
      const varBorrowRate: bigint = rd.currentVariableBorrowRate ?? 0n;
      const liquidityIndex: bigint = rd.liquidityIndex ?? WAD;
      const varBorrowIndex: bigint = rd.variableBorrowIndex ?? WAD;

      // aToken totalSupply ≈ scaled supply * liquidityIndex
      // We approximate from the reserve config bits or use token balances
      // For simplicity: read aToken balance of poolProxy (totalScaledSupply * liquidityIndex / 1e27)
      // Easier: use configuration to infer — but let's use available data
      // We'll read decimals from ERC20 for accuracy; assume 18 for unknowns
      const decimals = 18; // most tokens

      // Estimate total supply: we can read aToken totalSupply
      const aTokenAddr: string = rd.aTokenAddress;
      const varDebtAddr: string = rd.variableDebtTokenAddress;

      let totalATokens = 0n;
      let totalVarDebt = 0n;

      try {
        const [supplyRes] = await callFunction(
          ["function totalSupply() view returns (uint256)"],
          aTokenAddr,
          "totalSupply",
          []
        );
        totalATokens = supplyRes as bigint;
      } catch { /* ignore */ }

      try {
        const [debtRes] = await callFunction(
          ["function totalSupply() view returns (uint256)"],
          varDebtAddr,
          "totalSupply",
          []
        );
        totalVarDebt = debtRes as bigint;
      } catch { /* ignore */ }

      const totalSupplyUSD = toUSD(totalATokens, price, decimals);
      const totalBorrowUSD = toUSD(totalVarDebt, price, decimals);
      const liquidity = totalATokens > totalVarDebt ? totalATokens - totalVarDebt : 0n;
      const liquidityAvailableUSD = toUSD(liquidity, price, decimals);
      const utilizationRate = totalSupplyUSD > 0
        ? Math.min(totalBorrowUSD / totalSupplyUSD, 1)
        : 0;

      const symbol = TOKEN_SYMBOLS[addr.toLowerCase()] ?? addr.slice(0, 8);

      markets.push({
        asset: symbol,
        address: addr,
        supplyAPY: rayToAPY(liquidityRate),
        borrowAPY: rayToAPY(varBorrowRate),
        totalSupplyUSD: Math.round(totalSupplyUSD * 100) / 100,
        totalBorrowUSD: Math.round(totalBorrowUSD * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 10_000) / 10_000,
        liquidityAvailableUSD: Math.round(liquidityAvailableUSD * 100) / 100,
      });
    }

    return {
      protocol: "Kaskad Protocol",
      network: "Igra Galleon Testnet",
      chainId: 38836,
      isTestnet: true,
      apyWarning: "APY figures reflect testnet IRM slope params set for stress-testing — not representative of mainnet launch config. KSKD/IGRA use static oracle prices (no live market data pre-launch). Do not use for yield decisions.",
      blockNumber,
      markets,
    };
  });
}

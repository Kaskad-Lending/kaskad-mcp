import { CONTRACTS, TOKEN_SYMBOLS, TOKENS, DEAD_POOL_ADDRESSES } from "../contracts.js";
import { getBlockNumber, safeCall } from "../rpc.js";
import { PoolContract, OracleContract, ERC20Contract } from "../typed-contracts.js";

// currentLiquidityRate / variableBorrowRate from getReserveData are already annual rates in RAY (1e27)
// APY% = rate / 1e25  (i.e. rate / 1e27 * 100)
const RAY_PERCENT = 10n ** 25n;

export interface MarketData {
  asset: string;
  address: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  utilizationRate: number;
  liquidityAvailableUSD: number;
}

export interface MarketsResult {
  protocol: string;
  network: string;
  chainId: number;
  blockNumber: number;
  markets: MarketData[];
}

/** Convert annual ray rate → APY percentage (e.g. 47.66)
 *  currentLiquidityRate is already annual in RAY units → divide by 1e25 to get %
 */
export function rayToAPY(rateBig: bigint): number {
  return Number((rateBig * 10_000n) / RAY_PERCENT) / 10_000;
}

/** Convert base units price (8 decimals from Aave oracle) + token amount → USD */
export function toUSD(amount: bigint, price: bigint, decimals: number): number {
  // price has 8 decimals (Aave oracle base currency = USD with 8 dec)
  // amount has `decimals` decimals
  // result = amount * price / (10^decimals * 10^8)
  const denom = 10n ** BigInt(decimals) * 10n ** 8n;
  return Number((amount * price * 1_000_000n) / denom) / 1_000_000;
}

const pool = new PoolContract(CONTRACTS.poolProxy);
const oracle = new OracleContract(CONTRACTS.priceOracle);

export async function getMarkets(): Promise<MarketsResult | { error: string; rpc: string }> {
  return safeCall(async () => {
    const blockNumber = await getBlockNumber();

    const allAddresses = await pool.getReservesList();

    // Filter to active whitelisted tokens only (excludes stale reserves from prior testnet deploys)
    const ACTIVE_ADDRESSES = new Set(Object.values(TOKENS).map(a => a.toLowerCase()));
    const addresses = allAddresses.filter(
      a => ACTIVE_ADDRESSES.has(a.toLowerCase()) && !DEAD_POOL_ADDRESSES.has(a.toLowerCase())
    );

    const priceList = await oracle.getAssetsPrices(addresses);

    const markets: MarketData[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const price = priceList[i] ?? 0n;

      let rd;
      try {
        rd = await pool.getReserveData(addr);
      } catch {
        continue;
      }

      const liquidityRate = rd.currentLiquidityRate ?? 0n;
      const varBorrowRate = rd.currentVariableBorrowRate ?? 0n;

      // Fetch actual decimals from underlying token (USDC=6, WBTC=8, others=18)
      const erc20 = new ERC20Contract(addr);
      let decimals = 18;
      try {
        decimals = await erc20.decimals();
      } catch { /* default 18 */ }

      const aToken = new ERC20Contract(rd.aTokenAddress);
      const varDebtToken = new ERC20Contract(rd.variableDebtTokenAddress);

      let totalATokens = 0n;
      let totalVarDebt = 0n;

      try { totalATokens = await aToken.totalSupply(); } catch { /* ignore */ }
      try { totalVarDebt = await varDebtToken.totalSupply(); } catch { /* ignore */ }

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
      apyWarning: "Testnet environment — APY figures reflect real on-chain IRM state but testnet liquidity/utilization is not representative of mainnet. KSKD and IGRA use static oracle prices (no live market data pre-TGE). Treat as indicative only.",
      blockNumber,
      markets,
    };
  });
}

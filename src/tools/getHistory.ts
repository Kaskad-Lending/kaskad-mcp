import { SUBGRAPH_URL, ACTIVE_ASSETS } from '../contracts.js';

const RAY = 10n ** 27n;
const RAY_PERCENT = 10n ** 25n;

function rayToAPY(rayStr: string): number {
  const big = BigInt(rayStr);
  return Number((big * 10_000n) / RAY_PERCENT) / 100;
}

async function subgraphQuery(query: string): Promise<any> {
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json() as { errors?: Array<{message: string}>; data?: any };
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export async function getHistory(args: { address?: string; limit?: number }) {
  const limit = Math.min(args.limit ?? 10, 50);
  const address = args.address?.toLowerCase();

  const result: Record<string, any> = {
    subgraph: SUBGRAPH_URL,
    isTestnet: true,
  };

  // 1. Reserve APY snapshots — filter to active whitelisted addresses only
  const activeAddrs = Object.values(ACTIVE_ASSETS).map((a: string) => a.toLowerCase());
  const reserveQuery = `{
    reserves(where: { underlyingAsset_in: ${JSON.stringify(activeAddrs)} }) {
      symbol
      underlyingAsset
      utilizationRate
      liquidityRate
      variableBorrowRate
      totalCurrentVariableDebt
      availableLiquidity
      lastUpdateTimestamp
    }
  }`;

  const reserveData = await subgraphQuery(reserveQuery);
  result.marketSnapshot = reserveData.reserves.map((r: any) => ({
    asset: r.symbol,
    supplyAPY: rayToAPY(r.liquidityRate),
    borrowAPY: rayToAPY(r.variableBorrowRate),
    utilizationRate: parseFloat(r.utilizationRate),
    lastUpdated: new Date(parseInt(r.lastUpdateTimestamp) * 1000).toISOString(),
  }));

  // 2. Recent liquidations
  const liqQuery = `{
    liquidationCalls(first: ${limit}, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      principalAmount
      collateralAmount
      principalReserve { symbol decimals }
      collateralReserve { symbol decimals }
      user { id }
      liquidator
    }
  }`;
  const liqData = await subgraphQuery(liqQuery);
  result.recentLiquidations = liqData.liquidationCalls.map((l: any) => ({
    timestamp: new Date(parseInt(l.timestamp) * 1000).toISOString(),
    user: l.user.id,
    liquidator: l.liquidator,
    debtRepaid: {
      asset: l.principalReserve.symbol,
      amount: (Number(l.principalAmount) / 10 ** l.principalReserve.decimals).toFixed(4),
    },
    collateralSeized: {
      asset: l.collateralReserve.symbol,
      amount: (Number(l.collateralAmount) / 10 ** l.collateralReserve.decimals).toFixed(4),
    },
  }));

  // 3. User history (if address provided)
  if (address) {
    const userQuery = `{
      user(id: "${address}") {
        id
        borrowedReservesCount
        reserves {
          reserve { symbol decimals }
          currentATokenBalance
          currentTotalDebt
          lastUpdateTimestamp
        }
        supplyHistory: supplyHistory(first: ${limit}, orderBy: timestamp, orderDirection: desc) {
          amount
          timestamp
          reserve { symbol decimals }
        }
        borrowHistory: borrowHistory(first: ${limit}, orderBy: timestamp, orderDirection: desc) {
          amount
          timestamp
          reserve { symbol decimals }
        }
        repayHistory: repayHistory(first: ${limit}, orderBy: timestamp, orderDirection: desc) {
          amount
          timestamp
          reserve { symbol decimals }
        }
      }
    }`;

    try {
      const userData = await subgraphQuery(userQuery);
      if (userData.user) {
        const u = userData.user;
        result.userHistory = {
          address,
          activePositions: u.reserves
            .filter((r: any) => r.currentATokenBalance !== '0' || r.currentTotalDebt !== '0')
            .map((r: any) => ({
              asset: r.reserve.symbol,
              supplied: (Number(r.currentATokenBalance) / 10 ** r.reserve.decimals).toFixed(4),
              debt: (Number(r.currentTotalDebt) / 10 ** r.reserve.decimals).toFixed(4),
            })),
          recentSupplies: (u.supplyHistory || []).map((h: any) => ({
            asset: h.reserve.symbol,
            amount: (Number(h.amount) / 10 ** h.reserve.decimals).toFixed(4),
            timestamp: new Date(parseInt(h.timestamp) * 1000).toISOString(),
          })),
          recentBorrows: (u.borrowHistory || []).map((h: any) => ({
            asset: h.reserve.symbol,
            amount: (Number(h.amount) / 10 ** h.reserve.decimals).toFixed(4),
            timestamp: new Date(parseInt(h.timestamp) * 1000).toISOString(),
          })),
          recentRepays: (u.repayHistory || []).map((h: any) => ({
            asset: h.reserve.symbol,
            amount: (Number(h.amount) / 10 ** h.reserve.decimals).toFixed(4),
            timestamp: new Date(parseInt(h.timestamp) * 1000).toISOString(),
          })),
        };
      } else {
        result.userHistory = { address, note: 'No activity found for this address' };
      }
    } catch (e: any) {
      result.userHistory = { address, error: e.message };
    }
  }

  return result;
}

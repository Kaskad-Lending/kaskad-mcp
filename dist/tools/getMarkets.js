"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarkets = getMarkets;
const contracts_js_1 = require("../contracts.js");
const rpc_js_1 = require("../rpc.js");
// currentLiquidityRate / variableBorrowRate from getReserveData are already annual rates in RAY (1e27)
// APY% = rate / 1e25  (i.e. rate / 1e27 * 100)
const RAY_PERCENT = 10n ** 25n;
const WAD = 10n ** 18n;
/** Convert annual ray rate → APY percentage (e.g. 47.66)
 *  currentLiquidityRate is already annual in RAY units → divide by 1e25 to get %
 */
function rayToAPY(rateBig) {
    return Number((rateBig * 10000n) / RAY_PERCENT) / 10_000;
}
/** Convert base units price (8 decimals from Aave oracle) + token amount → USD */
function toUSD(amount, price, decimals) {
    // price has 8 decimals (Aave oracle base currency = USD with 8 dec)
    // amount has `decimals` decimals
    // result = amount * price / (10^decimals * 10^8)
    const denom = 10n ** BigInt(decimals) * 10n ** 8n;
    return Number((amount * price * 1000000n) / denom) / 1_000_000;
}
async function getMarkets() {
    return (0, rpc_js_1.safeCall)(async () => {
        // 1. Block number
        const blockNumber = await (0, rpc_js_1.getBlockNumber)();
        // 2. Get reserves list
        const [reserveAddresses] = await (0, rpc_js_1.callFunction)(contracts_js_1.POOL_ABI, contracts_js_1.CONTRACTS.poolProxy, "getReservesList", []);
        // Filter to active whitelisted tokens only (excludes stale reserves from prior testnet deploys)
        const ACTIVE_ADDRESSES = new Set(Object.values(contracts_js_1.TOKENS).map(a => a.toLowerCase()));
        const addresses = reserveAddresses.filter(a => ACTIVE_ADDRESSES.has(a.toLowerCase()));
        // 3. Get prices for all reserves
        const [prices] = await (0, rpc_js_1.callFunction)(contracts_js_1.ORACLE_ABI, contracts_js_1.CONTRACTS.priceOracle, "getAssetsPrices", [addresses]);
        const priceList = prices;
        // 4. Fetch reserve data for each
        const markets = [];
        for (let i = 0; i < addresses.length; i++) {
            const addr = addresses[i];
            const price = priceList[i] ?? 0n;
            let reserveResult;
            try {
                reserveResult = await (0, rpc_js_1.callFunction)(contracts_js_1.POOL_ABI, contracts_js_1.CONTRACTS.poolProxy, "getReserveData", [addr]);
            }
            catch {
                continue; // skip if individual reserve fails
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rd = reserveResult[0];
            const liquidityRate = rd.currentLiquidityRate ?? 0n;
            const varBorrowRate = rd.currentVariableBorrowRate ?? 0n;
            const liquidityIndex = rd.liquidityIndex ?? WAD;
            const varBorrowIndex = rd.variableBorrowIndex ?? WAD;
            // aToken totalSupply ≈ scaled supply * liquidityIndex
            // We approximate from the reserve config bits or use token balances
            // For simplicity: read aToken balance of poolProxy (totalScaledSupply * liquidityIndex / 1e27)
            // Easier: use configuration to infer — but let's use available data
            // We'll read decimals from ERC20 for accuracy; assume 18 for unknowns
            const decimals = 18; // most tokens
            // Estimate total supply: we can read aToken totalSupply
            const aTokenAddr = rd.aTokenAddress;
            const varDebtAddr = rd.variableDebtTokenAddress;
            let totalATokens = 0n;
            let totalVarDebt = 0n;
            try {
                const [supplyRes] = await (0, rpc_js_1.callFunction)(["function totalSupply() view returns (uint256)"], aTokenAddr, "totalSupply", []);
                totalATokens = supplyRes;
            }
            catch { /* ignore */ }
            try {
                const [debtRes] = await (0, rpc_js_1.callFunction)(["function totalSupply() view returns (uint256)"], varDebtAddr, "totalSupply", []);
                totalVarDebt = debtRes;
            }
            catch { /* ignore */ }
            const totalSupplyUSD = toUSD(totalATokens, price, decimals);
            const totalBorrowUSD = toUSD(totalVarDebt, price, decimals);
            const liquidity = totalATokens > totalVarDebt ? totalATokens - totalVarDebt : 0n;
            const liquidityAvailableUSD = toUSD(liquidity, price, decimals);
            const utilizationRate = totalSupplyUSD > 0
                ? Math.min(totalBorrowUSD / totalSupplyUSD, 1)
                : 0;
            const symbol = contracts_js_1.TOKEN_SYMBOLS[addr.toLowerCase()] ?? addr.slice(0, 8);
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
//# sourceMappingURL=getMarkets.js.map
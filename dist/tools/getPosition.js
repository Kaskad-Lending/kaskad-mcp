"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosition = getPosition;
const contracts_js_1 = require("../contracts.js");
const rpc_js_1 = require("../rpc.js");
const ethers_1 = require("ethers");
const WAD = 10n ** 18n;
const BASE_DECIMALS = 8; // Aave oracle: base currency USD with 8 decimals
/** Convert base-8 Aave value → human USD */
function baseToUSD(val) {
    return Number((val * 1000000n) / 10n ** BigInt(BASE_DECIMALS)) / 1_000_000;
}
/** Convert WAD healthFactor → number (capped at 999 for "infinite") */
function wadToHF(val) {
    if (val === 0n)
        return "N/A";
    // Max uint256 / 2 ≈ infinity → return ∞
    if (val > 10n ** 30n)
        return "∞";
    return Math.round(Number((val * 10000n) / WAD)) / 10_000;
}
async function getPosition(userAddress) {
    if (!(0, ethers_1.isAddress)(userAddress)) {
        return { error: "Invalid Ethereum address", details: userAddress };
    }
    return (0, rpc_js_1.safeCall)(async () => {
        // 1. getUserAccountData
        const accountData = await (0, rpc_js_1.callFunction)(contracts_js_1.POOL_ABI, contracts_js_1.CONTRACTS.poolProxy, "getUserAccountData", [userAddress]);
        const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor,] = accountData;
        // 2. Get reserves to find individual positions
        const [reserveAddresses] = await (0, rpc_js_1.callFunction)(contracts_js_1.POOL_ABI, contracts_js_1.CONTRACTS.poolProxy, "getReservesList", []);
        const addresses = reserveAddresses;
        // 3. Get prices
        const [prices] = await (0, rpc_js_1.callFunction)(contracts_js_1.ORACLE_ABI, contracts_js_1.CONTRACTS.priceOracle, "getAssetsPrices", [addresses]);
        const priceList = prices;
        // 4. Check aToken and debtToken balances for each reserve
        const positions = [];
        for (let i = 0; i < addresses.length; i++) {
            const addr = addresses[i];
            // Skip dead pools (deprecated testnet deploys — stranded funds, no dApp support)
            if (contracts_js_1.DEAD_POOL_ADDRESSES.has(addr.toLowerCase()))
                continue;
            const price = priceList[i] ?? 0n;
            // Fetch actual decimals from the underlying token (USDC=6, WBTC=8, others=18)
            let decimals = 18;
            try {
                const [dec] = await (0, rpc_js_1.callFunction)(contracts_js_1.ERC20_ABI, addr, "decimals", []);
                decimals = Number(dec);
            }
            catch { /* default 18 */ }
            let reserveResult;
            try {
                reserveResult = await (0, rpc_js_1.callFunction)(contracts_js_1.POOL_ABI, contracts_js_1.CONTRACTS.poolProxy, "getReserveData", [addr]);
            }
            catch {
                continue;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rd = reserveResult[0];
            const aTokenAddr = rd.aTokenAddress;
            const varDebtAddr = rd.variableDebtTokenAddress;
            let aBalance = 0n;
            let debtBalance = 0n;
            try {
                const [b] = await (0, rpc_js_1.callFunction)(["function balanceOf(address) view returns (uint256)"], aTokenAddr, "balanceOf", [userAddress]);
                aBalance = b;
            }
            catch { /* ignore */ }
            try {
                const [b] = await (0, rpc_js_1.callFunction)(["function balanceOf(address) view returns (uint256)"], varDebtAddr, "balanceOf", [userAddress]);
                debtBalance = b;
            }
            catch { /* ignore */ }
            if (aBalance === 0n && debtBalance === 0n)
                continue;
            // Convert to USD
            const denom = 10n ** BigInt(decimals);
            const suppliedUSD = Number((aBalance * price * 1000000n) / (denom * 10n ** 8n)) / 1_000_000;
            const borrowedUSD = Number((debtBalance * price * 1000000n) / (denom * 10n ** 8n)) / 1_000_000;
            // Resolve symbol: use whitelist first, fall back to on-chain symbol()
            let symbol = contracts_js_1.TOKEN_SYMBOLS[addr.toLowerCase()];
            if (!symbol) {
                try {
                    const [onChainSym] = await (0, rpc_js_1.callFunction)(contracts_js_1.ERC20_ABI, addr, "symbol", []);
                    symbol = onChainSym;
                }
                catch {
                    symbol = addr.slice(0, 8);
                }
            }
            positions.push({
                asset: symbol,
                address: addr,
                supplied: Math.round(suppliedUSD * 100) / 100,
                borrowed: Math.round(borrowedUSD * 100) / 100,
            });
        }
        // 5. Read stKSKD vault position
        let stakedKSKD = 0;
        try {
            const [stShares] = await (0, rpc_js_1.callFunction)(["function balanceOf(address) view returns (uint256)"], contracts_js_1.CONTRACTS.stKSKDVault, "balanceOf", [userAddress]);
            stakedKSKD = Math.round(Number(stShares * 1000000n / WAD)) / 1_000_000;
        }
        catch { /* ignore */ }
        return {
            address: userAddress,
            totalCollateralUSD: Math.round(baseToUSD(totalCollateralBase) * 100) / 100,
            totalDebtUSD: Math.round(baseToUSD(totalDebtBase) * 100) / 100,
            availableBorrowsUSD: Math.round(baseToUSD(availableBorrowsBase) * 100) / 100,
            healthFactor: wadToHF(healthFactor),
            ltv: Number(ltv) / 100,
            liquidationThreshold: Number(currentLiquidationThreshold) / 100,
            positions,
            staking: {
                stKSKDVault: contracts_js_1.CONTRACTS.stKSKDVault,
                stakedKSKD,
                note: "stKSKD grants governance eligibility (isEligibleBorrower/isEligibleSupplier). Use stake()/unstake() to manage.",
            },
        };
    });
}
//# sourceMappingURL=getPosition.js.map
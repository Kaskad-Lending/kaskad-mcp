"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProtocolInfo = getProtocolInfo;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const contracts_js_1 = require("../contracts.js");
function getProtocolInfo() {
    // Embed AGENTS.md so any agent calling getProtocolInfo gets full strategy context upfront
    let agentsGuide = "";
    try {
        // Resolve relative to project root (two levels up from dist/tools/)
        const agentsPath = path.resolve(process.cwd(), "AGENTS.md");
        agentsGuide = fs.readFileSync(agentsPath, "utf8");
    }
    catch {
        agentsGuide = "AGENTS.md not found — refer to https://testnet.kaskad.live for protocol documentation.";
    }
    return {
        protocol: "Kaskad Protocol",
        version: "v1.0 (Aave v3 fork)",
        network: "Igra Galleon Testnet",
        chainId: contracts_js_1.CHAIN_ID,
        rpc: contracts_js_1.RPC_URL,
        contracts: {
            poolProxy: contracts_js_1.CONTRACTS.poolProxy,
            poolAddressesProvider: contracts_js_1.CONTRACTS.poolAddressesProvider,
            priceOracle: contracts_js_1.CONTRACTS.priceOracle,
            uiPoolDataProvider: contracts_js_1.CONTRACTS.uiPoolDataProvider,
            rewardsController: contracts_js_1.CONTRACTS.rewardsController,
            activityTracker: contracts_js_1.CONTRACTS.activityTracker,
        },
        supportedAssets: Object.entries(contracts_js_1.TOKENS).map(([symbol, address]) => ({
            symbol,
            address,
        })),
        documentation: "https://docs.kaskad.live",
        dapp: "https://testnet.kaskad.live",
        explorer: "https://explorer.galleon-testnet.igralabs.com",
        agentsGuide,
        agentsGuideNote: "Full integration guide — read before strategizing. Covers emission schedule, eligibility rules, governance params, gas requirements, and KSKD incentive mechanics. For live voted params, call getGovernanceParams().",
    };
}
//# sourceMappingURL=getProtocolInfo.js.map
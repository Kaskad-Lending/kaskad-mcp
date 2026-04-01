"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const getMarkets_js_1 = require("./tools/getMarkets.js");
const getPosition_js_1 = require("./tools/getPosition.js");
const getProtocolInfo_js_1 = require("./tools/getProtocolInfo.js");
const getHistory_js_1 = require("./tools/getHistory.js");
const getGovernanceParams_js_1 = require("./tools/getGovernanceParams.js");
const executeTransaction_js_1 = require("./tools/executeTransaction.js");
// ─── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
    {
        name: "supply",
        description: "Supply (deposit) an asset into the Kaskad Protocol lending pool. Earns supply APY. " +
            "Trust boundary: max 10% of wallet balance per asset per action. Testnet only.",
        inputSchema: {
            type: "object",
            properties: {
                asset: { type: "string", description: "Asset symbol: IGRA, USDC, WETH, WBTC, IKAS, WIKAS, KSKD" },
                amount: { type: "number", description: "Amount to supply (in token units, not wei)" },
            },
            required: ["asset", "amount"],
        },
    },
    {
        name: "borrow",
        description: "Borrow an asset from the Kaskad Protocol lending pool. Requires sufficient collateral. " +
            "Uses variable rate by default. Trust boundary: max 10% of available borrows per action. Testnet only.",
        inputSchema: {
            type: "object",
            properties: {
                asset: { type: "string", description: "Asset symbol: IGRA, USDC, WETH, WBTC, IKAS, WIKAS, KSKD" },
                amount: { type: "number", description: "Amount to borrow (in token units, not wei)" },
                interestRateMode: { type: "number", description: "1 = stable, 2 = variable (default)" },
            },
            required: ["asset", "amount"],
        },
    },
    {
        name: "repay",
        description: "Repay a borrowed asset on Kaskad Protocol. Pass amount=-1 to repay full debt. Testnet only.",
        inputSchema: {
            type: "object",
            properties: {
                asset: { type: "string", description: "Asset symbol" },
                amount: { type: "number", description: "Amount to repay. Use -1 to repay full debt." },
                interestRateMode: { type: "number", description: "1 = stable, 2 = variable (default)" },
            },
            required: ["asset", "amount"],
        },
    },
    {
        name: "withdraw",
        description: "Withdraw a supplied asset from the Kaskad Protocol lending pool. Pass amount=-1 to withdraw all. Testnet only.",
        inputSchema: {
            type: "object",
            properties: {
                asset: { type: "string", description: "Asset symbol" },
                amount: { type: "number", description: "Amount to withdraw. Use -1 to withdraw all." },
            },
            required: ["asset", "amount"],
        },
    },
    {
        name: "getMarkets",
        description: "Returns the current state of all Kaskad Protocol lending markets on the Igra Galleon Testnet. " +
            "Includes supply/borrow APY, total supply/borrow in USD, utilization rate, and available liquidity for each asset.",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "getPosition",
        description: "Returns a wallet's current lending/borrowing position on Kaskad Protocol. " +
            "Includes total collateral, total debt, available borrows, health factor, and per-asset breakdown.",
        inputSchema: {
            type: "object",
            properties: {
                address: {
                    type: "string",
                    description: "Ethereum wallet address (0x...)",
                },
            },
            required: ["address"],
        },
    },
    {
        name: "getGovernanceParams",
        description: "Returns live DAO-voted governance parameters from KaskadGovernor (last finalized epoch). " +
            "Includes: EMISSION_SUPPLIERS_SHARE_BPS (supplier vs borrower KSKD split), eligibility thresholds, " +
            "treasury allocation ratios, and undistributed emission recycling rate. " +
            "ALWAYS call this before strategizing positions — these params directly affect KSKD emission yield.",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "getProtocolInfo",
        description: "Returns static metadata about Kaskad Protocol: network info, contract addresses, supported assets, documentation links, " +
            "and the full AGENTS.md integration guide (includes emission schedule, eligibility rules, gas requirements, and strategy context).",
        inputSchema: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "getHistory",
        description: "Returns historical data from the Kaskad Protocol subgraph: recent liquidations, current market APY snapshots, " +
            "and optionally a user's transaction history (supplies, borrows, repays) and active positions over time. " +
            "Pass an address to get user-specific history.",
        inputSchema: {
            type: "object",
            properties: {
                address: {
                    type: "string",
                    description: "Optional wallet address (0x...) to fetch user transaction history",
                },
                limit: {
                    type: "number",
                    description: "Number of historical records to return (default 10, max 50)",
                },
            },
            required: [],
        },
    },
];
// ─── Server setup ──────────────────────────────────────────────────────────────
const SERVER_NAME = "kaskad-mcp";
const SERVER_VERSION = "1.0.0";
const server = new index_js_1.Server({
    name: SERVER_NAME,
    version: SERVER_VERSION,
}, {
    capabilities: {
        tools: {},
    },
});
// List tools handler
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
});
// Call tool handler
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        let result;
        switch (name) {
            case "getMarkets": {
                result = await (0, getMarkets_js_1.getMarkets)();
                break;
            }
            case "getPosition": {
                const { address } = (args ?? {});
                if (!address) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ error: "Missing required parameter: address" }),
                            },
                        ],
                    };
                }
                result = await (0, getPosition_js_1.getPosition)(address);
                break;
            }
            case "getGovernanceParams": {
                result = await (0, getGovernanceParams_js_1.getGovernanceParams)();
                break;
            }
            case "getProtocolInfo": {
                result = (0, getProtocolInfo_js_1.getProtocolInfo)();
                break;
            }
            case "getHistory": {
                const { address, limit } = (args ?? {});
                result = await (0, getHistory_js_1.getHistory)({ address, limit });
                break;
            }
            case "supply": {
                const { asset, amount } = (args ?? {});
                // Route native iKAS through WrappedTokenGateway, ERC20s through standard pool
                if (asset.toUpperCase() === "IKAS") {
                    result = await (0, executeTransaction_js_1.supplyNativeIKAS)({ amount });
                }
                else {
                    result = await (0, executeTransaction_js_1.supplyAsset)({ asset, amount });
                }
                break;
            }
            case "borrow": {
                const { asset, amount, interestRateMode } = (args ?? {});
                result = await (0, executeTransaction_js_1.borrowAsset)({ asset, amount, interestRateMode });
                break;
            }
            case "repay": {
                const { asset, amount, interestRateMode } = (args ?? {});
                result = await (0, executeTransaction_js_1.repayAsset)({ asset, amount, interestRateMode });
                break;
            }
            case "withdraw": {
                const { asset, amount } = (args ?? {});
                if (asset.toUpperCase() === "IKAS") {
                    result = await (0, executeTransaction_js_1.withdrawNativeIKAS)({ amount });
                }
                else {
                    result = await (0, executeTransaction_js_1.withdrawAsset)({ asset, amount });
                }
                break;
            }
            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
                        },
                    ],
                    isError: true,
                };
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: message }),
                },
            ],
            isError: true,
        };
    }
});
// ─── Health endpoint (HTTP server) ────────────────────────────────────────────
const http_1 = __importDefault(require("http"));
const HEALTH_PORT = process.env.MCP_HEALTH_PORT ? parseInt(process.env.MCP_HEALTH_PORT, 10) : 3001;
const healthServer = http_1.default.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }
    const url = new URL(req.url || "", `http://localhost:${HEALTH_PORT}`);
    // GET /health — returns server status
    if (url.pathname === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "ok",
            server: SERVER_NAME,
            version: SERVER_VERSION,
            timestamp: new Date().toISOString(),
            transport: "stdio",
            capabilities: {
                tools: TOOLS.map(t => t.name),
            },
        }));
        return;
    }
    // GET /mcp/health — alias for /health (Claude Code compatible)
    if (url.pathname === "/mcp/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            status: "ok",
            server: SERVER_NAME,
            version: SERVER_VERSION,
            timestamp: new Date().toISOString(),
            transport: "stdio",
            capabilities: {
                tools: TOOLS.map(t => t.name),
            },
        }));
        return;
    }
    // GET / — root info
    if (url.pathname === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            name: SERVER_NAME,
            version: SERVER_VERSION,
            description: "MCP server for Kaskad Protocol — reads live on-chain state from Igra Galleon",
            endpoints: {
                health: "/health or /mcp/health",
                mcp: "stdio (primary)",
            },
        }));
        return;
    }
    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
});
// ─── Start ─────────────────────────────────────────────────────────────────────
async function main() {
    // Start health HTTP server (non-blocking)
    healthServer.listen(HEALTH_PORT, () => {
        process.stderr.write(`[${SERVER_NAME}] Health endpoint running on http://localhost:${HEALTH_PORT}/health\n`);
    });
    // Start MCP stdio server
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[${SERVER_NAME}] MCP server started on stdio\n`);
}
main().catch((err) => {
    process.stderr.write(`[${SERVER_NAME}] Fatal error: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
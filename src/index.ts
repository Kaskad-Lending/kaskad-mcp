import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { getMarkets } from "./tools/getMarkets.js";
import { getPosition } from "./tools/getPosition.js";
import { getProtocolInfo } from "./tools/getProtocolInfo.js";
import { getHistory } from "./tools/getHistory.js";
import { getGovernanceParams } from "./tools/getGovernanceParams.js";
import { supplyAsset, borrowAsset, repayAsset, withdrawAsset, supplyNativeIKAS, withdrawNativeIKAS } from "./tools/executeTransaction.js";
import { getEmissions, getUserRewards } from "./tools/getTokenomics.js";
import { stakeKSKD, unstakeKSKD, getStakingInfo } from "./tools/manageStaking.js";
import { checkHealthFactor } from "./tools/checkHealthFactor.js";

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "supply",
    description:
      "Supply (deposit) an asset into the Kaskad Protocol lending pool. Earns supply APY. " +
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
    description:
      "Borrow an asset from the Kaskad Protocol lending pool. Requires sufficient collateral. " +
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
    description:
      "Repay a borrowed asset on Kaskad Protocol. Pass amount=-1 to repay full debt. Testnet only.",
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
    description:
      "Withdraw a supplied asset from the Kaskad Protocol lending pool. Pass amount=-1 to withdraw all. Testnet only.",
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
    description:
      "Returns the current state of all Kaskad Protocol lending markets on the Igra Galleon Testnet. " +
      "Includes supply/borrow APY, total supply/borrow in USD, utilization rate, and available liquidity for each asset.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getPosition",
    description:
      "Returns a wallet's current lending/borrowing position on Kaskad Protocol. " +
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
    description:
      "Returns live DAO-voted governance parameters from KaskadGovernor (last finalized epoch). " +
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
    description:
      "Returns static metadata about Kaskad Protocol: network info, contract addresses, supported assets, documentation links, " +
      "and the full AGENTS.md integration guide (includes emission schedule, eligibility rules, gas requirements, and strategy context).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getHistory",
    description:
      "Returns historical data from the Kaskad Protocol subgraph: recent liquidations, current market APY snapshots, " +
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
  {
    name: "getEmissions",
    description:
      "Returns KSKD emission state: current epoch, emission vault balance (remaining vs total), " +
      "epoch timing, supplier/borrower split, and TWAL TVL from activity tracker. " +
      "Use this to understand current emission APY context and vault depletion trajectory.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getUserRewards",
    description:
      "Returns claimable KSKD rewards for a wallet address. Shows accrued and claimable amounts " +
      "from emission incentives. Eligibility requires meeting uptime and minimum position thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Wallet address (0x...) to check rewards for",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "stakeKSKD",
    description: "Stake KSKD tokens into the stKSKD vault (1:1). Grants governance eligibility (isEligibleSupplier / isEligibleBorrower). Requires MCP_WALLET_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Amount of KSKD to stake (human units, e.g. 100 = 100 KSKD)",
        },
      },
      required: ["amount"],
    },
  },
  {
    name: "unstakeKSKD",
    description: "Unstake stKSKD shares back to KSKD (1:1). Warning: if balance drops to 0, governance eligibility resets. Requires MCP_WALLET_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        shares: {
          type: "number",
          description: "Number of stKSKD shares to redeem (human units, e.g. 100 = 100 stKSKD)",
        },
      },
      required: ["shares"],
    },
  },
  {
    name: "getStakingInfo",
    description: "Get stKSKD vault state for a wallet: stKSKD balance, KSKD wallet balance, holding duration.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Wallet address (0x...) to check staking info for",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "checkHealthFactor",
    description:
      "Check a wallet's health factor against a threshold. Returns alert:true if HF is below threshold. " +
      "Use in agent monitoring loops: call on a cron interval and trigger repay() or supply() when alert:true. " +
      "Alert levels: safe | warning (below threshold) | danger (HF < 1.2) | critical (HF < 1.05, liquidation imminent).",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Wallet address (0x...) to monitor",
        },
        threshold: {
          type: "number",
          description: "Health factor threshold to alert below. Default: 1.5. Must be between 1.0 and 10.0.",
        },
      },
      required: ["address"],
    },
  },
];

// ─── Server setup ──────────────────────────────────────────────────────────────

const SERVER_NAME = "kaskad-mcp";
const SERVER_VERSION = "1.0.0";

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "getMarkets": {
        result = await getMarkets();
        break;
      }

      case "getPosition": {
        const { address } = (args ?? {}) as { address?: string };
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
        result = await getPosition(address);
        break;
      }

      case "getGovernanceParams": {
        result = await getGovernanceParams();
        break;
      }

      case "getProtocolInfo": {
        result = getProtocolInfo();
        break;
      }

      case "getHistory": {
        const { address, limit } = (args ?? {}) as { address?: string; limit?: number };
        result = await getHistory({ address, limit });
        break;
      }

      case "getEmissions": {
        result = await getEmissions();
        break;
      }

      case "getUserRewards": {
        const { address } = (args ?? {}) as { address?: string };
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
        result = await getUserRewards({ address });
        break;
      }

      case "stakeKSKD": {
        const { amount } = (args ?? {}) as { amount?: number };
        if (!amount) return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required parameter: amount" }) }] };
        result = await stakeKSKD({ amount });
        break;
      }

      case "unstakeKSKD": {
        const { shares } = (args ?? {}) as { shares?: number };
        if (!shares) return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required parameter: shares" }) }] };
        result = await unstakeKSKD({ shares });
        break;
      }

      case "getStakingInfo": {
        const { address } = (args ?? {}) as { address?: string };
        if (!address) return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required parameter: address" }) }] };
        result = await getStakingInfo({ address });
        break;
      }

      case "checkHealthFactor": {
        const { address, threshold } = (args ?? {}) as { address?: string; threshold?: number };
        if (!address) return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required parameter: address" }) }] };
        result = await checkHealthFactor(address, threshold ?? 1.5);
        break;
      }

      case "supply": {
        const { asset, amount } = (args ?? {}) as { asset: string; amount: number };
        // Route native iKAS through WrappedTokenGateway, ERC20s through standard pool
        if (asset.toUpperCase() === "IKAS") {
          result = await supplyNativeIKAS({ amount });
        } else {
          result = await supplyAsset({ asset, amount });
        }
        break;
      }

      case "borrow": {
        const { asset, amount, interestRateMode } = (args ?? {}) as { asset: string; amount: number; interestRateMode?: number };
        result = await borrowAsset({ asset, amount, interestRateMode });
        break;
      }

      case "repay": {
        const { asset, amount, interestRateMode } = (args ?? {}) as { asset: string; amount: number; interestRateMode?: number };
        result = await repayAsset({ asset, amount, interestRateMode });
        break;
      }

      case "withdraw": {
        const { asset, amount } = (args ?? {}) as { asset: string; amount: number };
        if (asset.toUpperCase() === "IKAS") {
          result = await withdrawNativeIKAS({ amount });
        } else {
          result = await withdrawAsset({ asset, amount });
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
  } catch (err) {
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

import http from "http";

const HEALTH_PORT = process.env.MCP_HEALTH_PORT ? parseInt(process.env.MCP_HEALTH_PORT, 10) : 3001;

const healthServer = http.createServer(async (req, res) => {
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[${SERVER_NAME}] MCP server started on stdio\n`);
}

main().catch((err) => {
  process.stderr.write(`[${SERVER_NAME}] Fatal error: ${err}\n`);
  process.exit(1);
});
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

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
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
    name: "getProtocolInfo",
    description:
      "Returns static metadata about Kaskad Protocol: network info, contract addresses, supported assets, and documentation links.",
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
];

// ─── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "kaskad-mcp",
    version: "1.0.0",
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

      case "getProtocolInfo": {
        result = getProtocolInfo();
        break;
      }

      case "getHistory": {
        const { address, limit } = (args ?? {}) as { address?: string; limit?: number };
        result = await getHistory({ address, limit });
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

// ─── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers communicate via stdio — no console output expected
  process.stderr.write("[kaskad-mcp] Server started on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`[kaskad-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});

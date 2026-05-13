/**
 * config.ts
 * Network-aware configuration for Kaskad MCP server.
 *
 * Set KASKAD_NETWORK=mainnet to point at mainnet contracts.
 * Defaults to testnet (Igra Galleon) if unset or set to "testnet".
 *
 * All contract addresses, token addresses, RPC URL, chain ID, and
 * subgraph URL are environment-driven. No hardcoded switching logic
 * outside this file.
 *
 * Mainnet values are intentionally left as empty strings — fill them
 * in via environment variables once mainnet is deployed.
 */

export type NetworkName = "testnet" | "mainnet";

export const NETWORK: NetworkName =
  process.env.KASKAD_NETWORK === "mainnet" ? "mainnet" : "testnet";

// ─── Testnet defaults (Igra Galleon, chain ID 38836) ────────────────────────

const TESTNET = {
  CHAIN_ID: 38836,
  RPC_URL: "https://galleon-testnet.igralabs.com:8545",
  SUBGRAPH_URL:
    "https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3",
  DAPP_URL: "https://testnet.kaskad.live",
  EXPLORER_URL: "https://explorer.galleon-testnet.igralabs.com",
  DOCS_URL: "https://docs.kaskad.live",

  CONTRACTS: {
    priceOracle:           "0xc1198A9d400306a0406fD3E3Ad67140b3D059f48",
    poolProxy:             "0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24",
    poolAddressesProvider: "0x9DB9797733FE5F734724Aa05D29Fa39563563Af5",
    uiPoolDataProvider:    "0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b",
    rewardsController:     "0x0eB9dc7DD4eDc2226a20093Ca0515D84b7529468",
    activityTracker:       "0xa11FbfB7E69c3D8443335d30c5E6271bEE78b128",
    kaskadStrategy:        "0x895016f79282D9A5C8faEA7FcB935310042fF836",
    stKSKDVault:           "0xbA98cd5cC5E99058834072B3428de126b433d594",
    governor:              "0xE89b59a211C4645150830Bc63c112d01eE47e888",
    emissionManager:       "0xcbcb1c3be7f32bf718b702f7b1700c36058edd8b",
    emissionVault:         "0x18E5d69862E088B1ca326ACf48615875DF1763Af",
    wrappedTokenGateway:   "0xaeb50b9b0340f760ab7c17eafcde90971083b4f9",
  },

  TOKENS: {
    KSKD: "0x2d17780a59044D49FeEf0AA9cEaB1B6e3161aFf7",
    USDC: "0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2",
    WBTC: "0x9dAc4c79bE2C541BE3584CE5244F3942554D6355",
    WETH: "0xB4129cEBD85bDEcdD775f539Ec8387619a0f1FAC",
    IKAS: "0xA7CEd4eFE5C3aE0e5C26735559A77b1e38950a14",
    IGRA: "0x04443457b050BBaa195bb71Ef6CCDb519CcB1f0f",
  },

  // Dead pool addresses (deprecated testnet deploys — no UI support, stranded funds)
  DEAD_POOL_ADDRESSES: new Set([
    "0x700b6a60ce7eaaea56f065753d8dcb9653dbad35",
    "0xa15bb66138824a1c7167f5e85b957d04dd34e468",
    "0xb19b36b1456e65e3a6d514d3f715f204bd59f431",
    "0x8ce361602b935680e8dec218b820ff5056beb7af",
    "0x328731d9731b1822fdb4d45d28a554fc471bece1",
    "0xd8fc8640ebc5e84519c52f61fff531d92764e780",
    "0x9c68fb08f127a263eb685ee25a68bed704d6b2de",
  ]),
};

// ─── Mainnet overrides — populated via env vars after mainnet deploy ─────────
// Required env vars (mainnet only):
//   KASKAD_CHAIN_ID, KASKAD_RPC_URL, KASKAD_SUBGRAPH_URL
//   KASKAD_CONTRACT_<NAME> for each contract key
//   KASKAD_TOKEN_<SYMBOL> for each token symbol

const MAINNET = {
  CHAIN_ID: parseInt(process.env.KASKAD_CHAIN_ID ?? "0", 10),
  RPC_URL: process.env.KASKAD_RPC_URL ?? "",
  SUBGRAPH_URL: process.env.KASKAD_SUBGRAPH_URL ?? "",
  DAPP_URL: process.env.KASKAD_DAPP_URL ?? "https://app.kaskad.live",
  EXPLORER_URL: process.env.KASKAD_EXPLORER_URL ?? "",
  DOCS_URL: process.env.KASKAD_DOCS_URL ?? "https://docs.kaskad.live",

  CONTRACTS: {
    priceOracle:           process.env.KASKAD_CONTRACT_PRICE_ORACLE           ?? "",
    poolProxy:             process.env.KASKAD_CONTRACT_POOL_PROXY             ?? "",
    poolAddressesProvider: process.env.KASKAD_CONTRACT_POOL_ADDRESSES_PROVIDER ?? "",
    uiPoolDataProvider:    process.env.KASKAD_CONTRACT_UI_POOL_DATA_PROVIDER  ?? "",
    rewardsController:     process.env.KASKAD_CONTRACT_REWARDS_CONTROLLER     ?? "",
    activityTracker:       process.env.KASKAD_CONTRACT_ACTIVITY_TRACKER       ?? "",
    kaskadStrategy:        process.env.KASKAD_CONTRACT_KASKAD_STRATEGY        ?? "",
    stKSKDVault:           process.env.KASKAD_CONTRACT_ST_KSKD_VAULT          ?? "",
    governor:              process.env.KASKAD_CONTRACT_GOVERNOR               ?? "",
    emissionManager:       process.env.KASKAD_CONTRACT_EMISSION_MANAGER       ?? "",
    emissionVault:         process.env.KASKAD_CONTRACT_EMISSION_VAULT         ?? "",
    wrappedTokenGateway:   process.env.KASKAD_CONTRACT_WRAPPED_TOKEN_GATEWAY  ?? "",
  },

  TOKENS: {
    KSKD: process.env.KASKAD_TOKEN_KSKD ?? "",
    USDC: process.env.KASKAD_TOKEN_USDC ?? "",
    WBTC: process.env.KASKAD_TOKEN_WBTC ?? "",
    WETH: process.env.KASKAD_TOKEN_WETH ?? "",
    IKAS: process.env.KASKAD_TOKEN_IKAS ?? "",
    IGRA: process.env.KASKAD_TOKEN_IGRA ?? "",
  },

  DEAD_POOL_ADDRESSES: new Set<string>(),
};

// ─── Active config export ────────────────────────────────────────────────────

const _cfg = NETWORK === "mainnet" ? MAINNET : TESTNET;

export const CHAIN_ID = _cfg.CHAIN_ID;
export const RPC_URL = _cfg.RPC_URL;
export const SUBGRAPH_URL = _cfg.SUBGRAPH_URL;
export const DAPP_URL = _cfg.DAPP_URL;
export const EXPLORER_URL = _cfg.EXPLORER_URL;
export const DOCS_URL = _cfg.DOCS_URL;
export const CONTRACTS = _cfg.CONTRACTS;
export const TOKENS: Record<string, string> = _cfg.TOKENS;
export const DEAD_POOL_ADDRESSES: Set<string> = _cfg.DEAD_POOL_ADDRESSES;

// Reverse mapping: address → symbol
export const TOKEN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([sym, addr]) => [addr.toLowerCase(), sym])
);

// Active assets map — used for subgraph filtering
export const ACTIVE_ASSETS: Record<string, string> = TOKENS;

// ─── Startup validation (mainnet only) ───────────────────────────────────────

if (NETWORK === "mainnet") {
  const missing: string[] = [];

  if (!CHAIN_ID) missing.push("KASKAD_CHAIN_ID");
  if (!RPC_URL)  missing.push("KASKAD_RPC_URL");

  for (const [key, val] of Object.entries(CONTRACTS)) {
    if (!val) missing.push(`KASKAD_CONTRACT_${key.toUpperCase()}`);
  }
  for (const [sym, val] of Object.entries(TOKENS)) {
    if (!val) missing.push(`KASKAD_TOKEN_${sym}`);
  }

  if (missing.length > 0) {
    console.error(
      `[kaskad-mcp] FATAL: KASKAD_NETWORK=mainnet but missing env vars:\n  ${missing.join("\n  ")}`
    );
    process.exit(1);
  }
}

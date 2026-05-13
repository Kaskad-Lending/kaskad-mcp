/**
 * contracts.ts
 * Re-exports all network config from config.ts for backward compatibility.
 * All address and RPC constants are now defined in config.ts and are
 * environment-driven. Do not add new constants here — use config.ts.
 */

export {
  NETWORK,
  CHAIN_ID,
  RPC_URL,
  SUBGRAPH_URL,
  DAPP_URL,
  EXPLORER_URL,
  DOCS_URL,
  CONTRACTS,
  TOKENS,
  TOKEN_SYMBOLS,
  ACTIVE_ASSETS,
  DEAD_POOL_ADDRESSES,
} from "./config.js";

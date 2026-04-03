// Contract addresses — Igra Galleon Testnet (chain ID 38836)
export const CHAIN_ID = 38836;
export const RPC_URL = "https://galleon-testnet.igralabs.com:8545";
export const SUBGRAPH_URL = "https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3";

export const CONTRACTS = {
  priceOracle:           "0xc1198A9d400306a0406fD3E3Ad67140b3D059f48",
  // New deployment (synced from testnet.kaskad.live bundle 2026-04-03)
  poolProxy:             "0x44e8Eeb3602e34aBc8eC05358A2EdD1d95Ec6b1A",
  poolAddressesProvider: "0x9B78803558F9Ea56F4f0a966322C8dD9B2fBebc0",
  uiPoolDataProvider:    "0x6A643eebEC9A1aA87943A223A616EF434A0520Cc",
  rewardsController:     "0x5946c50AB77a2d85F917123E48C4C678A657d6B2",
  activityTracker:       "0xc1aFae4Bb794985E8aDd8e669e1164E374A1554D",
  kaskadStrategy:        "0xEcB673E8eeFa5b5cd027f364189Acc24C56800e0",
  // Kaskad staking vault — stake/unstake KSKD, grants governance eligibility
  stKSKDVault:           "0x72f21814db9AC28367DD5289020B9053844Fb2Bb",
  governor:              "0xcF9fE13F74B6C933636EdFbB150892f53A73545b",
  // Tokenomics — emission system (emissionVault/Manager not in new bundle yet, keep old)
  emissionManager:       "0xcbcb1c3be7f32bf718b702f7b1700c36058edd8b",
  emissionVault:         "0x18E5d69862E088B1ca326ACf48615875DF1763Af",
} as const;

// Dead pool underlying addresses (old testnet deploys — still on-chain but 0% APY, no UI support)
// Funds in these pools are stranded in deprecated token contracts and cannot be migrated via dApp.
export const DEAD_POOL_ADDRESSES = new Set([
  "0x700b6a60ce7eaaea56f065753d8dcb9653dbad35", // USDC v1
  "0xa15bb66138824a1c7167f5e85b957d04dd34e468", // WBTC v1
  "0xb19b36b1456e65e3a6d514d3f715f204bd59f431", // WETH v1
  "0x8ce361602b935680e8dec218b820ff5056beb7af", // WIKAS v1
  "0x328731d9731b1822fdb4d45d28a554fc471bece1", // IGRA v1
  "0xd8fc8640ebc5e84519c52f61fff531d92764e780", // KSKD v1
  "0x9c68fb08f127a263eb685ee25a68bed704d6b2de", // KSKD v2
]);

// Token addresses — new deploy (synced from testnet.kaskad.live bundle 2026-04-03)
export const TOKENS: Record<string, string> = {
  KSKD:  "0xd884991BbaB6d5644fFE29000088bbB359AD5e9e",  // updated in new deploy
  USDC:  "0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2",
  WBTC:  "0x9dAc4c79bE2C541BE3584CE5244F3942554D6355",
  WETH:  "0xB4129cEBD85bDEcdD775f539Ec8387619a0f1FAC",
  IKAS:  "0xA7CEd4eFE5C3aE0e5C26735559A77b1e38950a14",  // WIKAS on-chain, IKAS in UI
  IGRA:  "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35",  // updated in new deploy
};

// Reverse mapping: address → symbol
export const TOKEN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([sym, addr]) => [addr.toLowerCase(), sym])
);

// Active assets map — used for subgraph filtering
export const ACTIVE_ASSETS: Record<string, string> = TOKENS;

// ABI fragments are now sourced from Foundry artifacts in src/abi/*.json
// Typed wrappers in src/typed-contracts.ts provide type-safe contract access

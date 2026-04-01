// Contract addresses — Igra Galleon Testnet (chain ID 38836)
export const CHAIN_ID = 38836;
export const RPC_URL = "https://galleon-testnet.igralabs.com:8545";
export const SUBGRAPH_URL = "https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3";

export const CONTRACTS = {
  priceOracle:           "0xc1198A9d400306a0406fD3E3Ad67140b3D059f48",
  poolProxy:             "0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24",
  poolAddressesProvider: "0x9DB9797733FE5F734724Aa05D29Fa39563563Af5",
  uiPoolDataProvider:    "0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b",
  rewardsController:     "0x0eB9dc7DD4eDc2226a20093Ca0515D84b7529468",
  activityTracker:       "0xa11FbfB7E69c3D8443335d30c5E6271bEE78b128",
  // Kaskad staking vault — stake/unstake KSKD, grants governance eligibility
  stKSKDVault:           "0xbA98cd5cC5E99058834072B3428de126b433d594",
  // Tokenomics — emission system
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

// Token addresses — current deploy (updated from bundle index-DSNj_0fi.js, Mar 23 2026)
export const TOKENS: Record<string, string> = {
  KSKD:  "0x2d17780a59044D49FeEf0AA9cEaB1B6e3161aFf7",
  USDC:  "0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2",
  WBTC:  "0x9dAc4c79bE2C541BE3584CE5244F3942554D6355",
  WETH:  "0xB4129cEBD85bDEcdD775f539Ec8387619a0f1FAC",
  IKAS:  "0xA7CEd4eFE5C3aE0e5C26735559A77b1e38950a14",  // WIKAS on-chain, IKAS in UI
  IGRA:  "0x04443457b050BBaa195bb71Ef6CCDb519CcB1f0f",
};

// Reverse mapping: address → symbol
export const TOKEN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([sym, addr]) => [addr.toLowerCase(), sym])
);

// Active assets map — used for subgraph filtering
export const ACTIVE_ASSETS: Record<string, string> = TOKENS;

// ABI fragments are now sourced from Foundry artifacts in src/abi/*.json
// Typed wrappers in src/typed-contracts.ts provide type-safe contract access

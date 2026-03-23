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
} as const;

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

// Aave v3 Pool — minimal ABI fragments used for encoding/decoding
export const POOL_ABI = [
  // getReservesList() → address[]
  "function getReservesList() view returns (address[])",
  // getReserveData(address asset) → ReserveData struct
  "function getReserveData(address asset) view returns (tuple(tuple(uint256 data) configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
  // getUserAccountData(address user) → (totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor)
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
] as const;

// Aave v3 Price Oracle — getAssetPrice
export const ORACLE_ABI = [
  "function getAssetPrice(address asset) view returns (uint256)",
  "function getAssetsPrices(address[] assets) view returns (uint256[])",
] as const;

// ERC-20 minimal ABI
export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

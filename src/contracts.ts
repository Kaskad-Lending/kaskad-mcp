// Contract addresses — Igra Galleon Testnet (chain ID 38836)
export const CHAIN_ID = 38836;
export const RPC_URL = "https://galleon-testnet.igralabs.com:8545";

export const CONTRACTS = {
  priceOracle:           "0x4f29f479D3e6c41aD3fC8C7c8D6f423Cb2784b8e",
  poolProxy:             "0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24",
  poolAddressesProvider: "0x9DB9797733FE5F734724Aa05D29Fa39563563Af5",
  uiPoolDataProvider:    "0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b",
  rewardsController:     "0x0eB9dc7DD4eDc2226a20093Ca0515D84b7529468",
  activityTracker:       "0xa11FbfB7E69c3D8443335d30c5E6271bEE78b128",
} as const;

export const TOKENS: Record<string, string> = {
  KSKD:  "0xd884991BbaB6d5644fFE29000088bbB359AD5e9e",
  USDC:  "0xb19b36b1456E65E3A6D514D3F715f204BD59f431",
  WBTC:  "0xA7CEd4eFE5C3aE0e5C26735559A77b1e38950a14",
  WETH:  "0xe1Aa25618fA0c7A1CFDab5d6B456af611873b629",
  IKAS:  "0xe1DA8919f262Ee86f9BE05059C9280142CF23f48",  // WIKAS on-chain, IKAS in UI
  IGRA:  "0x700b6A60ce7EaaEA56F065753d8dcB9653dbAD35",
};

// Reverse mapping: address → symbol
export const TOKEN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([sym, addr]) => [addr.toLowerCase(), sym])
);

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

export declare const CHAIN_ID = 38836;
export declare const RPC_URL = "https://galleon-testnet.igralabs.com:8545";
export declare const SUBGRAPH_URL = "https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3";
export declare const CONTRACTS: {
    readonly priceOracle: "0xc1198A9d400306a0406fD3E3Ad67140b3D059f48";
    readonly poolProxy: "0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24";
    readonly poolAddressesProvider: "0x9DB9797733FE5F734724Aa05D29Fa39563563Af5";
    readonly uiPoolDataProvider: "0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b";
    readonly rewardsController: "0x0eB9dc7DD4eDc2226a20093Ca0515D84b7529468";
    readonly activityTracker: "0xa11FbfB7E69c3D8443335d30c5E6271bEE78b128";
    readonly stKSKDVault: "0xbA98cd5cC5E99058834072B3428de126b433d594";
};
export declare const DEAD_POOL_ADDRESSES: Set<string>;
export declare const TOKENS: Record<string, string>;
export declare const TOKEN_SYMBOLS: Record<string, string>;
export declare const ACTIVE_ASSETS: Record<string, string>;
export declare const POOL_ABI: readonly ["function getReservesList() view returns (address[])", "function getReserveData(address asset) view returns (tuple(tuple(uint256 data) configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))", "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"];
export declare const ORACLE_ABI: readonly ["function getAssetPrice(address asset) view returns (uint256)", "function getAssetsPrices(address[] assets) view returns (uint256[])"];
export declare const ERC20_ABI: readonly ["function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"];
//# sourceMappingURL=contracts.d.ts.map
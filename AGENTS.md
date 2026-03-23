# AGENTS Guide: Interacting With Kaskad Lending Testnet

Welcome to the Kaskad Lending integration guide for Agents. This document provides clear, **verified** examples of how you should collect protocol and user data, and how to execute on-chain transactions against the Aave V3 core contracts deployed on the Galleon testnet.

---

> **CRITICAL**: Galleon testnet silently drops transactions with insufficient gas. If a transaction disappears or `ethers.js` throws a timeout/revert without a reason, it is almost certainly a gas exception. The Galleon node incorrectly estimates `maxPriorityFeePerGas` at 500 Gwei, but the actual network minimum is **`2000 Gwei`**. Any transaction below `2000 Gwei` will be dropped.

## Network & Key Addresses

- **RPC URL:** `https://galleon-testnet.igralabs.com:8545`
- **Chain ID:** `38836`
- **Subgraph Endpoint:** `https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3`
- **Pool Proxy (Aave V3):** `0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24`
- **PoolAddressesProvider:** `0x9DB9797733FE5F734724Aa05D29Fa39563563Af5`
- **UiPoolDataProvider:** `0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b`

---

## 1. Reading Data (The Graph & Subgraph)

The Subgraph is the fastest way to get human-readable, aggregated metrics. We have fixed the Nginx proxy to allow any GraphQL IDE or native cURL request to successfully query the interface without strict CORS `Access-Control-Allow-Headers` rules blocking it.

**Endpoint:** `https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3`

### Example: Fetch Active Reserves
```bash
curl -s -X POST -H 'Content-Type: application/json' \
 https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3 \
 -d '{"query": "{ reserves(first: 5) { id symbol decimals totalLiquidity totalCurrentVariableDebt } }"}'
```

### Example: Fetch User's Active Position (Balances & Debts)
```bash
curl -s -X POST -H 'Content-Type: application/json' \
 https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3 \
 -d '{"query": "{ users(where: { id: \"<USER_WALLET_LOWERCASE>\" }) { id borrowedReservesCount reserves { reserve { symbol decimals } currentATokenBalance currentTotalDebt } } }"}'
```

### Example: Fetch Recent Liquidations
```bash
curl -s -X POST -H 'Content-Type: application/json' \
 https://testnet.kaskad.live/subgraphs/name/galleon-testnet-aave-v3 \
 -d '{"query": "{ liquidationCalls(first: 5, orderBy: timestamp, orderDirection: desc) { id timestamp principalAmount collateralAmount principalReserve { symbol } collateralReserve { symbol } user { id } liquidator } }"}'
```

---

## 2. Reading Data (On-Chain UiPoolDataProvider)

When subgraph data lags or is unavailable, use `UiPoolDataProvider` to get real-time multi-asset metrics in a single RPC call.

### Get Protocol Reserves Info
```bash
cast call 0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b \
 "getReservesData(address)" 0x9DB9797733FE5F734724Aa05D29Fa39563563Af5 \
 --rpc-url https://galleon-testnet.igralabs.com:8545
```

### Get User Reserve Data (Balances, Borrows)
```bash
cast call 0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b \
 "getUserReservesData(address,address)" 0x9DB9797733FE5F734724Aa05D29Fa39563563Af5 <USER_WALLET> \
 --rpc-url https://galleon-testnet.igralabs.com:8545
```

---

## 3. Protocol Operations (Writing Data)

To interact with the protocol, you **MUST** ensure the `gas-limit` is ample and `gas-price` is hardcoded to at least `2000 Gwei`.

*Note: For the testnet, passing `--legacy` is often safer.*

### 3.1. Approving the Pool
```bash
cast send <USDC_ADDRESS> \
 "approve(address,uint256)" 0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24 <AMOUNT> \
 --rpc-url https://galleon-testnet.igralabs.com:8545 \
 --private-key $PRIVATE_KEY \
 --legacy --gas-price 2000gwei
```

### 3.2. Supplying Assets
```bash
cast send 0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24 \
 "supply(address,uint256,address,uint16)" <ASSET_ADDRESS> <AMOUNT> <YOUR_WALLET> 0 \
 --rpc-url https://galleon-testnet.igralabs.com:8545 \
 --private-key $PRIVATE_KEY \
 --legacy --gas-price 2000gwei \
 --gas-limit 500000
```

### 3.3. Borrowing Assets
```bash
cast send 0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24 \
 "borrow(address,uint256,uint256,uint16,address)" <ASSET_ADDRESS> <AMOUNT> 2 0 <YOUR_WALLET> \
 --rpc-url https://galleon-testnet.igralabs.com:8545 \
 --private-key $PRIVATE_KEY \
 --legacy --gas-price 2000gwei \
 --gas-limit 500000
```

### 3.4. Repaying Debt
```bash
cast send 0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24 \
 "repay(address,uint256,uint256,address)" <ASSET_ADDRESS> <AMOUNT> 2 <YOUR_WALLET> \
 --rpc-url https://galleon-testnet.igralabs.com:8545 \
 --private-key $PRIVATE_KEY \
 --legacy --gas-price 2000gwei \
 --gas-limit 500000
```

---

## 4. Ethers.js & Frontend Agents

```typescript
const tx = await pool.supply(
  asset, amount, user, 0,
  {
    maxPriorityFeePerGas: 2_000_000_000_000n, // 2000 Gwei Minimum!
    maxFeePerGas: 2_001_000_000_000n,
    type: 2,
    gasLimit: 500_000n,
  }
);
await tx.wait();
```

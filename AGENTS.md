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
 --gas-limit 1700000
```

### 3.3. Borrowing Assets
```bash
cast send 0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24 \
 "borrow(address,uint256,uint256,uint16,address)" <ASSET_ADDRESS> <AMOUNT> 2 0 <YOUR_WALLET> \
 --rpc-url https://galleon-testnet.igralabs.com:8545 \
 --private-key $PRIVATE_KEY \
 --legacy --gas-price 2000gwei \
 --gas-limit 1700000
```

### 3.4. Repaying Debt
```bash
cast send 0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24 \
 "repay(address,uint256,uint256,address)" <ASSET_ADDRESS> <AMOUNT> 2 <YOUR_WALLET> \
 --rpc-url https://galleon-testnet.igralabs.com:8545 \
 --private-key $PRIVATE_KEY \
 --legacy --gas-price 2000gwei \
 --gas-limit 1700000
```

---

## 5. Tokenomics Context for Agents

APY on Kaskad = **real yield** (borrower interest) + **KSKD emission incentives**. Without understanding the emission schedule and eligibility rules, agents will systematically misread yield signals.

---

### 5.1 KSKD Token Basics
- **Total supply:** 1,000,000,000 KSKD (fixed at deployment — no future minting)
- **FDV at launch:** $12.5M | **Day 1 price:** $0.0125
- **Testnet address:** `0x2d17780a59044D49FeEf0AA9cEaB1B6e3161aFf7`
- **Oracle (pre-TGE):** Static price — do not use for yield calculations. APYs involving KSKD are indicative only.
- **Oracle (post-TGE):** Live price feed (Kaskad Oracle V1 — median of 6 sources).
- **Supported launch assets:** USDC, WETH, USDT, WBTC, stETH. **KSKD is NOT listed at TGE** (thin liquidity risk). Do not recommend KSKD as supply collateral at launch.

---

### 5.2 Emission Schedule (Immutable)
- **Emission vault:** 39% of total supply = 390,000,000 KSKD — hardcoded at deployment, **not governance-adjustable**
- **Epoch length:** 30 days (mainnet) / 4 days (testnet)

| Phase | Duration | Allocation (% of total supply) | Monthly rate |
|-------|----------|-------------------------------|--------------|
| Phase 1 | 0–6 months | 2% | ~0.33%/month |
| Phase 2 | 6–12 months | 4% | ~0.66%/month |
| Phase 3 | 12–18 months | 6% | ~1%/month |
| Phase 4 | 18–35 months | 27% | ~1.59%/month |

**Critical for agents:** Emission APY is highest in Phase 3–4 but the vault depletes. By month 36, emissions stop entirely. Yield recommendations must account for this decay — "high APY now" ≠ "high APY in 18 months."

---

### 5.3 Emission Split (Governance-Adjustable)
- **Bounded range:** 40–60% to suppliers / 40–60% to borrowers (cannot go outside this range)
- **Formula:** `E_t = E_sup(r_t) + E_bor(1 - r_t)` where `r_t ∈ [0.4, 0.6]`
- **Borrower emissions** are weighted by per-asset utilization: `E_bor,i ∝ TWAL_i / Cap_i`
- **Effect:** Underutilized assets receive reduced emissions. Unallocated borrower emissions are redirected to the DAO Treasury.

---

### 5.4 Eligibility Rules (What qualifies for emissions)

**Suppliers must:**
- Maintain minimum position ≥ $100 (adjustable ±15%, floor is $100 — never lower)
- Maintain ≥ 90% uptime per epoch (adjustable ±2.5%, floor is 80%)
- Sustain position for full epoch — mid-epoch entry/exit reduces proportional allocation

**Borrowers must:**
- Maintain LTV ≥ 15% (floor, not adjustable below this)
- Maintain ≥ 50% uptime per epoch (floor, not adjustable below this)

**Agent implication:** Recommend opening positions at epoch start, not end. Partial-epoch participation yields proportionally less. Closing a supply position mid-epoch forfeits remaining emission allocation for that epoch.

---

### 5.5 Voter Eligibility (Governance Access)
To participate in governance, a user must **simultaneously**:
1. Hold an active supply or borrow position qualifying as a TVL Participant
2. Hold liquid-staked KSKD (staking is non-withdrawable during active voting epochs)
3. Have a history of validated votes (increases Loyalty Score over time)

**Voting power formula:** `Vp = λ1 · TVL_p,t + λ2 · (Stake_p,t + φ · ΣVotes_p)`

**Agent implication:** Staking KSKD for governance does NOT yield financial returns — it only confers governance influence. Do not model staking as yield.

---

### 5.6 Treasury Routing (Immutable)
- **65% of all protocol fees** → DAO Treasury Pool (governed by voters)
- **35%** → Operational Treasury (infrastructure, audits — no user distributions)
- Protocol revenue is **not** automatically recycled to LPs. DAO vote required for any allocation.

**DAO Treasury sub-allocations (governance-adjustable within bounds):**
- Incentives Distributor: min 50%, adjustable up to 80%
- Supply Adjustment Mechanism: min 15%, adjustable up to 20%
- Kaspa Core Funding Wallet: min 5%, adjustable up to 7.5%
- Epoch outflow cap: max 85% of DAO balance per epoch

---

### 5.7 Undistributed Emissions Recycling
When borrower utilization is below the active cap, unused emissions go to the DAO Treasury. Voters decide (within 35–65% bounds) to either:
- Recycle to next epoch's incentive distributor (boosts future APY)
- Send to Supply Adjustment Mechanism (removes from circulation)

---

### 5.8 Milestone Incentives (User Onboarding Phase — 18 months)
TVL milestone unlocks release additional non-KSKD incentives from a Growth Pool:

| Level | TVL Threshold | Allocation (% of Reserved Budget) |
|-------|--------------|-----------------------------------|
| 1 | $1M | 1.4% (one time) |
| 2 | $3M | 1.4% (one time) |
| 3 | $5M | 1.4% (one time) |
| 4 | $10M | 2.8% (one time) |
| 5 | $20M | 2.8% (one time) |
| 6 | $50M | 2.8% (one time) |
| 7 | $100M | 2.8% (one time) |

Milestones use TWAL/TWAP validation (time-weighted — no flash TVL manipulation), with cooldown periods and challenge windows. Distribution requires DAO vote after milestone verification.

---

### 5.9 Bounded Governance Parameters (Complete — sourced from DecisionParams.sol + Whitepaper V1)
All parameters below are adjustable by DAO vote within the stated bounds only:

| Parameter | Source (DecisionParams.sol) | Floor | Ceiling | Current default |
|-----------|----------------------------|-------|---------|----------------|
| Emission split (supplier %) | `EMISSION_SUPPLIERS_SHARE_BPS` | 40% | 60% | ~60% |
| Supplier min uptime | `TVL_MIN_SUPPLY_UPTIME_BPS` | 87.5% | 92.5% | 90% |
| Borrower min uptime | `BORROWER_MIN_UPTIME_BPS` | 50% | 55% | 50% |
| Borrower min LTV | `BORROWER_MIN_LTV_BPS` | 15% | 20% | 15% |
| Supplier min deposit (USD) | `TVL_MIN_SUPPLY_USD` | $85 | $115 | $100 |
| Undistributed emissions → next epoch | `UNDISTRIBUTED_TO_NEXT_EPOCH_BPS` | 35% | 65% | governance |
| DAO revenue → TVL incentives | `DAO_TVL_INCENTIVES_SHARE_BPS` | 50% | 80% | 50% |
| DAO revenue → Supply Adjustment | `DAO_BURN_SHARE_BPS` | 15% | 20% | 15% |
| DAO revenue → Kaspa Core Funding | `DAO_KASPA_CORE_SHARE_BPS` | 5% | 7.5% | 5% |
| Milestone bonus split (TVL vs vested) | `MILESTONE_TVL_VS_VESTED_SHARE_BPS` | 35% | 65% | governance |
| DAO epoch outflow cap | — | — | 85% of DAO balance | 85% |
| Supply Adjustment size cap | — | 5% | 5% of 30d avg vol | 5% |

**What governance CANNOT do:**
- Modify the 65/35 treasury split (hardcoded in routing contracts)
- Change the 39% emission vault allocation (immutable at deployment)
- Reduce any parameter below its contract-enforced floor
- Distribute treasury assets without: governance proposal → 48h timelock → 24h challenge window → execution

**stKSKD note (planned, not live):** Future roadmap includes option to borrow against staked KSKD (stKSKD) as collateral. Not in current contract deployment — do not model this as available functionality.

---

### 5.10 Token Distribution (for context)

| Category | Allocation |
|----------|-----------|
| Activity Incentives (emission vault) | min 39% |
| Ecosystem Liquidity (10% DEX + 8% listings) | 18% |
| Community & Ecosystem Dev Phase 1 | up to 20% |
| Team | 12.5% (0% at TGE, 9-month cliff, 36-month vesting) |
| Advisors | up to 3% |
| Community Phase 2 | up to 3.26% |
| Institutional Participation | 3% |
| Commitment Incentives | 1.24% |

---

## 4. Ethers.js & Frontend Agents

```typescript
const tx = await pool.supply(
  asset, amount, user, 0,
  {
    maxPriorityFeePerGas: 2_000_000_000_000n, // 2000 Gwei Minimum!
    maxFeePerGas: 2_001_000_000_000n,
    type: 2,
    gasLimit: 1_700_000n, // 500K is insufficient — Galleon requires ~1.7M for pool ops
  }
);
await tx.wait();
```

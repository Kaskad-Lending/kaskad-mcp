# kaskad-mcp

MCP (Model Context Protocol) server for **Kaskad Protocol** — reads live on-chain state from the Igra Galleon Testnet and executes transactions via 7 tools.

## Tools

| Tool | Description |
|------|-------------|
| `getMarkets` | Live APY, utilization, liquidity for all active reserves |
| `getPosition` | Wallet collateral, debt, health factor, supplied/borrowed positions, staking balance |
| `getGovernanceParams` | Live DAO-voted parameters from KaskadGovernor (supplier/borrower emission split, eligibility thresholds, treasury ratios) |
| `getProtocolInfo` | Static metadata + full AGENTS.md integration guide |
| `supply` | Supply an asset into the lending pool |
| `borrow` | Borrow an asset against collateral |
| `repay` | Repay outstanding debt |
| `withdraw` | Withdraw supplied assets |

## Quick Start

```bash
git clone <repo>
cd kaskad-mcp
npm install
npm run build
```

## Wallet Setup

The server needs a wallet private key to sign transactions. Three options (in priority order):

**Option 1 — Environment variable (recommended for CI/server)**
```bash
export MCP_WALLET_KEY=0xYOUR_PRIVATE_KEY
node dist/index.js
```

**Option 2 — Local credentials file**
```bash
mkdir credentials
echo '{"privateKey":"0xYOUR_PRIVATE_KEY"}' > credentials/wallet.json
# credentials/ is gitignored — never commit this
node dist/index.js
```

**Option 3 — Home directory**
```bash
mkdir ~/.kaskad-mcp
echo '{"privateKey":"0xYOUR_PRIVATE_KEY"}' > ~/.kaskad-mcp/wallet.json
node dist/index.js
```

> **Trust boundary:** The server enforces a minimum 10,000 iKAS reserve in the wallet at all times. Max 10% of wallet balance per asset per supply action.

## MCP Client Config

Add to your MCP client (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kaskad": {
      "command": "node",
      "args": ["/path/to/kaskad-mcp/dist/index.js"],
      "env": {
        "MCP_WALLET_KEY": "0xYOUR_PRIVATE_KEY"
      }
    }
  }
}
```

## Network

| Property | Value |
|----------|-------|
| Chain ID | 38836 |
| Network | Igra Galleon Testnet |
| RPC | `https://galleon-testnet.igralabs.com:8545` |
| Explorer | `https://explorer.galleon-testnet.igralabs.com` |
| dApp | `https://testnet.kaskad.live` |

> **Gas note:** Igra Galleon requires a minimum 2000 Gwei gas price and ~1.7M gas for all pool operations. `eth_estimateGas` severely underestimates — all transactions use a static `gasLimit: 1_700_000n`.

## Contract Addresses (current deploy)

| Contract | Address |
|----------|---------|
| Pool | `0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24` |
| PoolAddressesProvider | `0x9DB9797733FE5F734724Aa05D29Fa39563563Af5` |
| PriceOracle | `0xc1198A9d400306a0406fD3E3Ad67140b3D059f48` |
| UIPoolDataProvider | `0xbe38809914b552f295cD3e8dF2e77b3DA69cBC8b` |
| RewardsController | `0x0eB9dc7DD4eDc2226a20093Ca0515D84b7529468` |
| ActivityTracker | `0xa11FbfB7E69c3D8443335d30c5E6271bEE78b128` |
| KaskadGovernor | `0xE89b59a211C4645150830Bc63c112d01eE47e888` |
| stKSKD Vault | `0xbA98cd5cC5E99058834072B3428de126b433d594` |
| WrappedTokenGateway | `0xaeb50b9b0340f760ab7c17eafcde90971083b4f9` |

| Token | Address |
|-------|---------|
| USDC | `0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2` |
| WETH | `0xB4129cEBD85bDEcdD775f539Ec8387619a0f1FAC` |
| WBTC | `0x9dAc4c79bE2C541BE3584CE5244F3942554D6355` |
| IGRA | `0x04443457b050BBaa195bb71Ef6CCDb519CcB1f0f` |
| WIKAS (iKAS) | `0xA7CEd4eFE5C3aE0e5C26735559A77b1e38950a14` |
| KSKD | `0x2d17780a59044D49FeEf0AA9cEaB1B6e3161aFf7` |

> **Address maintenance:** After any testnet redeploy, re-extract token addresses from `/assets/index-*.js` in the dApp bundle and update `src/contracts.ts`. Bundle filename changes each deploy.

## Governance Parameters

Call `getGovernanceParams` to read live DAO-voted values. Key param:

- `EMISSION_SUPPLIERS_SHARE_BPS` — current split between supplier and borrower KSKD emissions (epoch 7: 4581 bps = 45.8% to suppliers, 54.2% to borrowers)

Always call this before building a yield strategy — the emission split directly affects optimal positioning.

## Maintenance Notes

- **APY formula:** `currentLiquidityRate` from `getReserveData` is in RAY (1e27). `rate / 1e25 = APY%`. Do NOT multiply by seconds_per_year.
- **Dead pools:** 7 deprecated reserve addresses exist on-chain from prior deploys. These are filtered from all output. Funds in those pools are stranded and non-migratable via dApp.
- **iKAS:** Native gas token. Balance read via `provider.getBalance()`, not ERC20. WIKAS is the wrapped form used internally by the pool — wallets never hold WIKAS directly.

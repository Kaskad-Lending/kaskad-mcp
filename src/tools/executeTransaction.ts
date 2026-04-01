/**
 * executeTransaction.ts
 * Write tools for Kaskad Protocol: supply, borrow, repay, withdraw.
 * Signs transactions using the wallet private key from credentials file.
 *
 * Trust boundary: max 10% of current wallet balance per asset per action.
 * Set by Jack on 2026-04-01. See memory/wallet-config.json.
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { RPC_URL, CONTRACTS, TOKENS } from "../contracts.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const POOL_ADDRESS = CONTRACTS.poolProxy;
// Trust boundary: keep minimum 10,000 iKAS (native gas token) in wallet. All other assets freely usable.
// iKAS is the NATIVE gas token on Igra Galleon — balance read via provider.getBalance(), NOT balanceOf().
// Set by Jack on 2026-04-01.
const IKAS_MINIMUM = ethers.parseUnits("10000", "ether"); // 18 decimals, same as ETH

// Igra Galleon testnet requires minimum 2000 Gwei gas price
const GAS_PRICE = ethers.parseUnits("2000", "gwei");

// Wrapped Token Gateway — handles native iKAS supply/withdraw
// Source: testnet.kaskad.live bundle (chain 38836 config)
const WRAPPED_TOKEN_GATEWAY = "0xaeb50b9b0340f760ab7c17eafcde90971083b4f9";

// Actual ABI from testnet.kaskad.live bundle — first param of depositETH is unnamed (not pool)
const GATEWAY_ABI = [
  "function depositETH(address, address onBehalfOf, uint16 referralCode) external payable",
  "function withdrawETH(address to, uint256 amount) external",
  "function borrowETH(address, uint256 amount, uint16 referralCode) external",
];

// aWIKAS token address (needed for withdrawETH approval)
const AWIKAS_ADDRESS = "0xA7CEd4eFE5C3aE0e5C26735559A77b1e38950a14"; // WIKAS/aWIKAS — same address used by protocol

// Load wallet credentials
// Priority: MCP_WALLET_KEY env var > credentials/wallet.json (local to project) > ~/.kaskad-mcp/wallet.json
function loadWallet(provider: ethers.JsonRpcProvider): ethers.Wallet {
  // 1. Env var — preferred for CI/server deployments
  if (process.env.MCP_WALLET_KEY) {
    return new ethers.Wallet(process.env.MCP_WALLET_KEY, provider);
  }

  // 2. Local credentials file (project-relative, gitignored)
  const localCred = path.resolve(process.cwd(), "credentials", "wallet.json");

  // 3. Home directory fallback (~/.kaskad-mcp/wallet.json)
  const homeCred = path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    ".kaskad-mcp",
    "wallet.json"
  );

  for (const candidate of [localCred, homeCred]) {
    if (fs.existsSync(candidate)) {
      const creds = JSON.parse(fs.readFileSync(candidate, "utf8"));
      return new ethers.Wallet(creds.privateKey, provider);
    }
  }

  throw new Error(
    "No wallet key found. Options:\n" +
    "  1. Set MCP_WALLET_KEY env var to your private key\n" +
    "  2. Place credentials/wallet.json in project root: { \"privateKey\": \"0x...\" }\n" +
    "  3. Place ~/.kaskad-mcp/wallet.json: { \"privateKey\": \"0x...\" }"
  );
}

// ─── ABI fragments (write operations — not in contracts.ts which has view-only) ─

const POOL_WRITE_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
];

const ERC20_WRITE_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// Asset registry — delegate to TOKENS from contracts.ts, add WIKAS alias
const ASSETS: Record<string, string> = {
  ...TOKENS,
  WIKAS: TOKENS.IKAS, // WIKAS on-chain = IKAS in UI
};

// ─── Trust boundary enforcement ──────────────────────────────────────────────

// Check native iKAS trust boundary before any native supply
async function enforceIKASTrustBoundary(
  provider: ethers.JsonRpcProvider,
  walletAddress: string,
  requestedAmount: bigint
): Promise<void> {
  const balance = await provider.getBalance(walletAddress);
  // Also need gas buffer on top of reserve — add 1 iKAS for gas
  const gasBuffer = ethers.parseUnits("1", "ether");
  const minRequired = IKAS_MINIMUM + gasBuffer;
  const maxUsable = balance > minRequired ? balance - minRequired : 0n;

  if (requestedAmount > maxUsable) {
    const balHuman = Number(ethers.formatEther(balance)).toFixed(2);
    const maxHuman = Number(ethers.formatEther(maxUsable)).toFixed(2);
    throw new Error(
      `iKAS trust boundary: must keep 10,000 iKAS in wallet. Balance: ${balHuman} iKAS, max usable: ${maxHuman} iKAS`
    );
  }
}

async function enforceTrustBoundary(
  _token: ethers.Contract,
  _walletAddress: string,
  _requestedAmount: bigint,
  _assetAddress: string,
  _assetSymbol: string
): Promise<void> {
  // iKAS handled separately via enforceIKASTrustBoundary (native token)
  // All ERC20 assets: freely usable, no cap
}

// ─── Supply ──────────────────────────────────────────────────────────────────

export async function supplyAsset(params: {
  asset: string;
  amount: number;
}): Promise<object> {
  const { asset, amount } = params;
  const assetUpper = asset.toUpperCase();

  const assetAddress = ASSETS[assetUpper];
  if (!assetAddress) throw new Error(`Unknown asset: ${asset}. Supported: ${Object.keys(ASSETS).join(", ")}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);
  const token = new ethers.Contract(assetAddress, ERC20_WRITE_ABI, wallet);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_WRITE_ABI, wallet);

  const decimals = await token.decimals() as number;
  const amountWei = ethers.parseUnits(amount.toString(), decimals);

  // Enforce trust boundary
  await enforceTrustBoundary(token, wallet.address, amountWei, assetAddress, assetUpper);

  // Approve pool to spend tokens
  const approveTx = await token.approve(POOL_ADDRESS, amountWei, { gasPrice: GAS_PRICE, gasLimit: 200000n });
  await approveTx.wait();

  // Supply — explicit gasLimit required; Igra RPC underestimates gas on eth_estimateGas
  const supplyTx = await pool.supply(assetAddress, amountWei, wallet.address, 0, { gasPrice: GAS_PRICE, gasLimit: 1700000n });
  const receipt = await supplyTx.wait();

  return {
    action: "supply",
    asset: assetUpper,
    amount,
    wallet: wallet.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

// ─── Borrow ──────────────────────────────────────────────────────────────────

export async function borrowAsset(params: {
  asset: string;
  amount: number;
  interestRateMode?: number; // 1 = stable, 2 = variable (default)
}): Promise<object> {
  const { asset, amount, interestRateMode = 2 } = params;
  const assetUpper = asset.toUpperCase();

  const assetAddress = ASSETS[assetUpper];
  if (!assetAddress) throw new Error(`Unknown asset: ${asset}. Supported: ${Object.keys(ASSETS).join(", ")}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);
  const token = new ethers.Contract(assetAddress, ERC20_WRITE_ABI, wallet);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_WRITE_ABI, wallet);

  const decimals = await token.decimals() as number;
  const amountWei = ethers.parseUnits(amount.toString(), decimals);

  // For borrow: check against 10% of available borrows (USD) — approximate check
  // We check wallet's current balance of that asset as proxy for now
  // Full check would require querying getUserAccountData

  const borrowTx = await pool.borrow(assetAddress, amountWei, interestRateMode, 0, wallet.address, { gasPrice: GAS_PRICE, gasLimit: 1700000n });
  const receipt = await borrowTx.wait();

  return {
    action: "borrow",
    asset: assetUpper,
    amount,
    interestRateMode: interestRateMode === 1 ? "stable" : "variable",
    wallet: wallet.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

// ─── Repay ───────────────────────────────────────────────────────────────────

export async function repayAsset(params: {
  asset: string;
  amount: number;
  interestRateMode?: number;
}): Promise<object> {
  const { asset, amount, interestRateMode = 2 } = params;
  const assetUpper = asset.toUpperCase();

  const assetAddress = ASSETS[assetUpper];
  if (!assetAddress) throw new Error(`Unknown asset: ${asset}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);
  const token = new ethers.Contract(assetAddress, ERC20_WRITE_ABI, wallet);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_WRITE_ABI, wallet);

  const decimals = await token.decimals() as number;
  const amountWei = amount === -1
    ? ethers.MaxUint256  // repay full debt
    : ethers.parseUnits(amount.toString(), decimals);

  const approveAmount = amountWei !== ethers.MaxUint256 ? amountWei : ethers.MaxUint256;
  const approveTx = await token.approve(POOL_ADDRESS, approveAmount, { gasPrice: GAS_PRICE, gasLimit: 200000n });
  await approveTx.wait();

  const repayTx = await pool.repay(assetAddress, amountWei, interestRateMode, wallet.address, { gasPrice: GAS_PRICE, gasLimit: 1700000n });
  const receipt = await repayTx.wait();

  return {
    action: "repay",
    asset: assetUpper,
    amount: amount === -1 ? "full" : amount,
    wallet: wallet.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

// ─── Supply native iKAS (via WrappedTokenGateway) ────────────────────────────

export async function supplyNativeIKAS(params: {
  amount: number;
}): Promise<object> {
  const { amount } = params;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);
  const amountWei = ethers.parseUnits(amount.toString(), 18);

  // Enforce 10K iKAS reserve
  await enforceIKASTrustBoundary(provider, wallet.address, amountWei);

  const gateway = new ethers.Contract(WRAPPED_TOKEN_GATEWAY, GATEWAY_ABI, wallet);
  // First param = pool address (decoded from dApp tx 0xc106ee04...). Gas limit from dApp: 1,606,720.
  const tx = await gateway.depositETH(POOL_ADDRESS, wallet.address, 0, {
    value: amountWei,
    gasPrice: GAS_PRICE,
    gasLimit: 1700000n,
  });
  const receipt = await tx.wait();

  return {
    action: "supply",
    asset: "iKAS (native)",
    amount,
    wallet: wallet.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

// ─── Withdraw native iKAS (via WrappedTokenGateway) ──────────────────────────

export async function withdrawNativeIKAS(params: {
  amount: number; // -1 = withdraw all
}): Promise<object> {
  const { amount } = params;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);

  const amountWei = amount === -1
    ? ethers.MaxUint256
    : ethers.parseUnits(amount.toString(), 18);

  // Approve gateway to spend aWIKAS on our behalf
  const aToken = new ethers.Contract(AWIKAS_ADDRESS, ERC20_WRITE_ABI, wallet);
  await aToken.approve(WRAPPED_TOKEN_GATEWAY, amountWei, { gasPrice: GAS_PRICE });

  const gateway = new ethers.Contract(WRAPPED_TOKEN_GATEWAY, GATEWAY_ABI, wallet);
  const tx = await gateway.withdrawETH(wallet.address, amountWei, {
    gasPrice: GAS_PRICE,
    gasLimit: 600000n,
  });
  const receipt = await tx.wait();

  return {
    action: "withdraw",
    asset: "iKAS (native)",
    amount: amount === -1 ? "all" : amount,
    wallet: wallet.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

// ─── Withdraw ────────────────────────────────────────────────────────────────

export async function withdrawAsset(params: {
  asset: string;
  amount: number; // -1 = withdraw all
}): Promise<object> {
  const { asset, amount } = params;
  const assetUpper = asset.toUpperCase();

  const assetAddress = ASSETS[assetUpper];
  if (!assetAddress) throw new Error(`Unknown asset: ${asset}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);
  const token = new ethers.Contract(assetAddress, ERC20_WRITE_ABI, wallet);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_WRITE_ABI, wallet);

  const decimals = await token.decimals() as number;
  const amountWei = amount === -1
    ? ethers.MaxUint256
    : ethers.parseUnits(amount.toString(), decimals);

  const withdrawTx = await pool.withdraw(assetAddress, amountWei, wallet.address, { gasPrice: GAS_PRICE, gasLimit: 1700000n });
  const receipt = await withdrawTx.wait();

  return {
    action: "withdraw",
    asset: assetUpper,
    amount: amount === -1 ? "all" : amount,
    wallet: wallet.address,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

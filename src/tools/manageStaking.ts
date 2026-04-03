import { CONTRACTS, TOKENS } from "../contracts.js";
import { ethers } from "ethers";

const GAS_PRICE = ethers.parseUnits("2000", "gwei");
const GAS_LIMIT = 300000n;
const APPROVE_GAS = 200000n;

const VAULT_ABI = [
  "function stake(uint256 amount) returns (uint256 shares)",
  "function unstake(uint256 shares) returns (uint256 assets)",
  "function balanceOf(address) view returns (uint256)",
  "function holdingDuration(address) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
];

function getProvider() {
  return new ethers.JsonRpcProvider(
    process.env.RPC_URL ?? "https://galleon-testnet.igralabs.com:8545"
  );
}

async function getSigner() {
  const provider = getProvider();
  // Try env var first, then wallet.json (same pattern as executeTransaction.ts)
  const key = process.env.MCP_WALLET_KEY;
  if (key) return new ethers.Wallet(key, provider);
  try {
    const fs = await import("fs");
    const path = await import("path");
    const walletPath = path.resolve(process.cwd(), "credentials/wallet.json");
    const creds = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    return new ethers.Wallet(creds.privateKey, provider);
  } catch {
    throw new Error("No wallet key found. Set MCP_WALLET_KEY or place credentials/wallet.json");
  }
}

export async function stakeKSKD(params: { amount: number }) {
  const { amount } = params;
  if (!amount || amount <= 0) return { error: "amount must be > 0" };

  const signer = await getSigner();
  const vault = new ethers.Contract(CONTRACTS.stKSKDVault, VAULT_ABI, signer);
  const kskd = new ethers.Contract(TOKENS.KSKD, ERC20_ABI, signer);

  const amountWei = ethers.parseEther(amount.toString());
  const balance = await kskd.balanceOf(signer.address);
  if (balance < amountWei)
    return {
      error: `Insufficient KSKD balance. Have: ${ethers.formatEther(balance)}, need: ${amount}`,
    };

  // Approve if needed
  const allowance = await kskd.allowance(signer.address, CONTRACTS.stKSKDVault);
  if (allowance < amountWei) {
    const appTx = await kskd.approve(CONTRACTS.stKSKDVault, ethers.MaxUint256, {
      gasPrice: GAS_PRICE,
      gasLimit: APPROVE_GAS,
    });
    await appTx.wait();
  }

  const tx = await vault.stake(amountWei, { gasPrice: GAS_PRICE, gasLimit: GAS_LIMIT });
  const receipt = await tx.wait();

  const newStBal = await vault.balanceOf(signer.address);
  return {
    action: "stake",
    amountStaked: amount,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    newStKSKDBalance: Number(ethers.formatEther(newStBal)),
    note: "stKSKD is 1:1 with KSKD. Holding grants governance eligibility (isEligibleSupplier / isEligibleBorrower). Use unstake to redeem.",
  };
}

export async function unstakeKSKD(params: { shares: number }) {
  const { shares } = params;
  if (!shares || shares <= 0) return { error: "shares must be > 0" };

  const signer = await getSigner();
  const vault = new ethers.Contract(CONTRACTS.stKSKDVault, VAULT_ABI, signer);

  const sharesWei = ethers.parseEther(shares.toString());
  const balance = await vault.balanceOf(signer.address);
  if (balance < sharesWei)
    return {
      error: `Insufficient stKSKD balance. Have: ${ethers.formatEther(balance)}, need: ${shares}`,
    };

  const holdingSecs = await vault.holdingDuration(signer.address);
  const tx = await vault.unstake(sharesWei, { gasPrice: GAS_PRICE, gasLimit: GAS_LIMIT });
  const receipt = await tx.wait();

  const newStBal = await vault.balanceOf(signer.address);
  return {
    action: "unstake",
    sharesRedeemed: shares,
    kskdReceived: shares, // 1:1
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    holdingDurationSeconds: Number(holdingSecs),
    newStKSKDBalance: Number(ethers.formatEther(newStBal)),
    note: "KSKD returned 1:1. If stKSKD balance drops to 0, governance eligibility resets.",
  };
}

export async function getStakingInfo(params: { address: string }) {
  const { address } = params;
  if (!ethers.isAddress(address)) return { error: "Invalid Ethereum address" };

  const provider = getProvider();
  const vault = new ethers.Contract(CONTRACTS.stKSKDVault, VAULT_ABI, provider);
  const kskd = new ethers.Contract(TOKENS.KSKD, ERC20_ABI, provider);

  const [stBal, kskdBal, holdingSecs] = await Promise.all([
    vault.balanceOf(address),
    kskd.balanceOf(address),
    vault.holdingDuration(address),
  ]);

  return {
    address,
    stKSKDBalance: Number(ethers.formatEther(stBal)),
    kskdWalletBalance: Number(ethers.formatEther(kskdBal)),
    holdingDurationSeconds: Number(holdingSecs),
    holdingDurationDays: Math.floor(Number(holdingSecs) / 86400),
    vaultAddress: CONTRACTS.stKSKDVault,
    note: "stKSKD is 1:1 with KSKD. Stake to earn governance eligibility. Unstake to reclaim KSKD.",
  };
}

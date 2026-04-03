/**
 * claimRewards.ts
 * Claim accrued KSKD rewards from the RewardsController.
 * Uses claimAllRewards(assets, to) — claims all pending KSKD for the wallet.
 *
 * Standard Aave v3 IRewardsController interface.
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { RPC_URL, CONTRACTS, TOKENS } from "../contracts.js";
import RewardsControllerABI from "../abi/KaskadRewardsController.json";

const GAS_PRICE = ethers.parseUnits("2000", "gwei");
const WAD = 10n ** 18n;

function formatWad(val: bigint): number {
  return Math.round(Number((val * 1_000_000n) / WAD)) / 1_000_000;
}

function loadWallet(provider: ethers.JsonRpcProvider): ethers.Wallet {
  if (process.env.MCP_WALLET_KEY) {
    return new ethers.Wallet(process.env.MCP_WALLET_KEY, provider);
  }
  const localCred = path.resolve(process.cwd(), "credentials", "wallet.json");
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
  throw new Error("No wallet key found. Set MCP_WALLET_KEY env var.");
}

export async function claimKSKDRewards(params: {
  address?: string; // optional — defaults to MCP wallet address
}): Promise<object> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);

  // Claim to wallet address by default; allow override for read-only wallets watching another address
  const toAddress = params.address ?? wallet.address;

  // Asset list: all reserve tokens (rewards accrue on aTokens/debtTokens, but
  // RewardsController accepts underlying addresses and resolves internally)
  const assetAddresses = Object.values(TOKENS);

  const rewardsController = new ethers.Contract(
    CONTRACTS.rewardsController,
    RewardsControllerABI,
    wallet
  );

  // First: check claimable amount so we can report it
  let claimableBefore = 0n;
  try {
    const { claimableAmounts } = await rewardsController.getClaimableRewards(
      assetAddresses,
      toAddress
    );
    claimableBefore = (claimableAmounts as bigint[]).reduce((a, b) => a + b, 0n);
  } catch { /* non-critical */ }

  if (claimableBefore === 0n) {
    return {
      action: "claimRewards",
      wallet: wallet.address,
      claimable: 0,
      status: "skipped",
      note: "No claimable KSKD rewards at this time. Rewards require meeting epoch uptime and minimum position thresholds.",
    };
  }

  // Execute claimAllRewards
  const tx = await rewardsController.claimAllRewards(assetAddresses, toAddress, {
    gasPrice: GAS_PRICE,
    gasLimit: 1_700_000n,
  });
  const receipt = await tx.wait();

  return {
    action: "claimRewards",
    wallet: wallet.address,
    claimedEstimate: formatWad(claimableBefore),
    asset: "KSKD",
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status === 1 ? "success" : "failed",
    explorerUrl: `https://explorer.galleon-testnet.igralabs.com/tx/${receipt.hash}`,
  };
}

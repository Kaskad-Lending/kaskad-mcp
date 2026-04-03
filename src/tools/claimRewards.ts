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

export async function claimKSKDRewards(_params: Record<string, never> = {}): Promise<object> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = loadWallet(provider);

  // Always claim to the MCP wallet itself — it is both the signer and the position holder
  const toAddress = wallet.address;

  const rewardsController = new ethers.Contract(
    CONTRACTS.rewardsController,
    RewardsControllerABI,
    wallet
  );

  // Fetch aToken addresses from pool — rewards are tracked per aToken, not underlying
  const poolABI = ["function getReservesList() view returns (address[])", "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)"];
  const poolContract = new ethers.Contract(CONTRACTS.poolProxy, poolABI, provider);
  const reserves: string[] = await poolContract.getReservesList();
  const aTokenAddresses: string[] = [];
  for (const reserve of reserves) {
    try {
      const rd = await poolContract.getReserveData(reserve);
      if (rd.aTokenAddress && rd.aTokenAddress !== "0x0000000000000000000000000000000000000000") {
        aTokenAddresses.push(rd.aTokenAddress);
      }
    } catch { /* skip dead reserves */ }
  }

  // Check claimable amount using getClaimableRewards with aToken addresses (accurate on-chain amount)
  let claimableBefore = 0n;
  try {
    const result = await rewardsController.getClaimableRewards(aTokenAddresses, toAddress);
    const claimableAmounts = result[1] as bigint[];
    claimableBefore = claimableAmounts.reduce((a: bigint, b: bigint) => a + b, 0n);
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

  // Execute claimAllRewards with aToken addresses
  const tx = await rewardsController.claimAllRewards(aTokenAddresses, toAddress, {
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

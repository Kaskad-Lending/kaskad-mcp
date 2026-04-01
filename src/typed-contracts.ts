/**
 * Typed contract wrappers — replaces `as any` casts with proper return types.
 * ABI sourced from Foundry artifacts in src/abi/*.json.
 * Each wrapper calls through rpc.ts callFunction and decodes into typed results.
 */

import { callFunction } from "./rpc.js";
import { InterfaceAbi } from "ethers";

// JSON ABI fragments extracted from Foundry artifacts (src/abi/*.json)
import PoolABI from "./abi/Pool.json";
import OracleABI from "./abi/AaveOracle.json";
import ERC20ABI from "./abi/ERC20.json";
import GovernorABI from "./abi/KaskadGovernor.json";
import RewardsControllerABI from "./abi/KaskadRewardsController.json";
import ActivityTrackerABI from "./abi/KaskadActivityTracker.json";
import EmissionManagerABI from "./abi/EmissionManager.json";
import EmissionVaultABI from "./abi/KSKDEmissionVault.json";

// ─── Return types ────────────────────────────────────────────────────────────

export interface ReserveData {
  configuration: { data: bigint };
  liquidityIndex: bigint;
  currentLiquidityRate: bigint;
  variableBorrowIndex: bigint;
  currentVariableBorrowRate: bigint;
  currentStableBorrowRate: bigint;
  lastUpdateTimestamp: bigint;
  id: bigint;
  aTokenAddress: string;
  stableDebtTokenAddress: string;
  variableDebtTokenAddress: string;
  interestRateStrategyAddress: string;
  accruedToTreasury: bigint;
  unbacked: bigint;
  isolationModeTotalDebt: bigint;
}

export interface UserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

export interface RewardsData {
  index: bigint;
  emissionPerSecond: bigint;
  lastUpdateTimestamp: bigint;
  distributionEnd: bigint;
}

// ─── ABI fragments (passed directly to ethers Interface via callFunction) ────

const POOL_ABI: InterfaceAbi = PoolABI;
const ORACLE_ABI: InterfaceAbi = OracleABI;
const ERC20_FRAG: InterfaceAbi = ERC20ABI;
const GOVERNOR_ABI: InterfaceAbi = GovernorABI;
const REWARDS_ABI: InterfaceAbi = RewardsControllerABI;
const ACTIVITY_ABI: InterfaceAbi = ActivityTrackerABI;
const EMISSION_MGR_ABI: InterfaceAbi = EmissionManagerABI;
const EMISSION_VAULT_ABI: InterfaceAbi = EmissionVaultABI;

// ─── Pool ────────────────────────────────────────────────────────────────────

export class PoolContract {
  constructor(private address: string) {}

  async getReservesList(): Promise<string[]> {
    const [list] = await callFunction(POOL_ABI, this.address, "getReservesList", []);
    return list as string[];
  }

  async getReserveData(asset: string): Promise<ReserveData> {
    const [data] = await callFunction(POOL_ABI, this.address, "getReserveData", [asset]);
    return data as ReserveData;
  }

  async getUserAccountData(user: string): Promise<UserAccountData> {
    const result = await callFunction(POOL_ABI, this.address, "getUserAccountData", [user]);
    return {
      totalCollateralBase: result[0] as bigint,
      totalDebtBase: result[1] as bigint,
      availableBorrowsBase: result[2] as bigint,
      currentLiquidationThreshold: result[3] as bigint,
      ltv: result[4] as bigint,
      healthFactor: result[5] as bigint,
    };
  }
}

// ─── Oracle ──────────────────────────────────────────────────────────────────

export class OracleContract {
  constructor(private address: string) {}

  async getAssetPrice(asset: string): Promise<bigint> {
    const [price] = await callFunction(ORACLE_ABI, this.address, "getAssetPrice", [asset]);
    return price as bigint;
  }

  async getAssetsPrices(assets: string[]): Promise<bigint[]> {
    const [prices] = await callFunction(ORACLE_ABI, this.address, "getAssetsPrices", [assets]);
    return prices as bigint[];
  }
}

// ─── ERC20 ───────────────────────────────────────────────────────────────────

export class ERC20Contract {
  constructor(private address: string) {}

  async balanceOf(account: string): Promise<bigint> {
    const [bal] = await callFunction(ERC20_FRAG, this.address, "balanceOf", [account]);
    return bal as bigint;
  }

  async decimals(): Promise<number> {
    const [dec] = await callFunction(ERC20_FRAG, this.address, "decimals", []);
    return Number(dec);
  }

  async symbol(): Promise<string> {
    const [sym] = await callFunction(ERC20_FRAG, this.address, "symbol", []);
    return sym as string;
  }

  async totalSupply(): Promise<bigint> {
    const [supply] = await callFunction(ERC20_FRAG, this.address, "totalSupply", []);
    return supply as bigint;
  }
}

// ─── Governor ────────────────────────────────────────────────────────────────

export class GovernorContract {
  constructor(private address: string) {}

  async currentEpoch(): Promise<bigint> {
    const [epoch] = await callFunction(GOVERNOR_ABI, this.address, "currentEpoch", []);
    return epoch as bigint;
  }

  async epochDecision(epoch: bigint | number, decision: number): Promise<number> {
    const [val] = await callFunction(GOVERNOR_ABI, this.address, "epochDecision", [epoch, decision]);
    return Number(val);
  }
}

// ─── Rewards Controller ──────────────────────────────────────────────────────

export class RewardsControllerContract {
  constructor(private address: string) {}

  async getUserRewards(assets: string[], user: string, reward: string): Promise<bigint> {
    const [val] = await callFunction(REWARDS_ABI, this.address, "getUserRewards", [assets, user, reward]);
    return val as bigint;
  }

  async getUserAccruedRewards(user: string, reward: string): Promise<bigint> {
    const [val] = await callFunction(REWARDS_ABI, this.address, "getUserAccruedRewards", [user, reward]);
    return val as bigint;
  }

  async getRewardsData(asset: string, reward: string): Promise<RewardsData> {
    const result = await callFunction(REWARDS_ABI, this.address, "getRewardsData", [asset, reward]);
    return {
      index: result[0] as bigint,
      emissionPerSecond: result[1] as bigint,
      lastUpdateTimestamp: result[2] as bigint,
      distributionEnd: result[3] as bigint,
    };
  }

  async getAllUserRewards(assets: string[], user: string): Promise<{ rewardsList: string[]; unclaimedAmounts: bigint[] }> {
    const result = await callFunction(REWARDS_ABI, this.address, "getAllUserRewards", [assets, user]);
    return {
      rewardsList: result[0] as string[],
      unclaimedAmounts: result[1] as bigint[],
    };
  }

  async getClaimableRewards(assets: string[], user: string): Promise<{ rewardsList: string[]; claimableAmounts: bigint[] }> {
    const result = await callFunction(REWARDS_ABI, this.address, "getClaimableRewards", [assets, user]);
    return {
      rewardsList: result[0] as string[],
      claimableAmounts: result[1] as bigint[],
    };
  }
}

// ─── Activity Tracker ────────────────────────────────────────────────────────

export class ActivityTrackerContract {
  constructor(private address: string) {}

  async getTwapTVL(): Promise<bigint> {
    const [val] = await callFunction(ACTIVITY_ABI, this.address, "getTwapTVL", []);
    return val as bigint;
  }

  async hasTwapHistory(): Promise<boolean> {
    const [val] = await callFunction(ACTIVITY_ABI, this.address, "hasTwapHistory", []);
    return val as boolean;
  }

  async lastTvlValue(): Promise<bigint> {
    const [val] = await callFunction(ACTIVITY_ABI, this.address, "lastTvlValue", []);
    return val as bigint;
  }

  async lastTvlUpdateTime(): Promise<bigint> {
    const [val] = await callFunction(ACTIVITY_ABI, this.address, "lastTvlUpdateTime", []);
    return val as bigint;
  }

  async tvlCumulative(): Promise<bigint> {
    const [val] = await callFunction(ACTIVITY_ABI, this.address, "tvlCumulative", []);
    return val as bigint;
  }
}

// ─── Emission Manager ────────────────────────────────────────────────────────

export class EmissionManagerContract {
  constructor(private address: string) {}

  async current(): Promise<bigint> {
    const [val] = await callFunction(EMISSION_MGR_ABI, this.address, "current", []);
    return val as bigint;
  }

  async start(epochId: bigint | number): Promise<bigint> {
    const [val] = await callFunction(EMISSION_MGR_ABI, this.address, "start", [epochId]);
    return val as bigint;
  }

  async end(epochId: bigint | number): Promise<bigint> {
    const [val] = await callFunction(EMISSION_MGR_ABI, this.address, "end", [epochId]);
    return val as bigint;
  }

  async emissionSplitBps(): Promise<number> {
    const [val] = await callFunction(EMISSION_MGR_ABI, this.address, "emissionSplitBps", []);
    return Number(val);
  }

  async isEpochDistributed(epoch: bigint | number): Promise<boolean> {
    const [val] = await callFunction(EMISSION_MGR_ABI, this.address, "isEpochDistributed", [epoch]);
    return val as boolean;
  }
}

// ─── Emission Vault ──────────────────────────────────────────────────────────

export class EmissionVaultContract {
  constructor(private address: string) {}

  async emissionPool(): Promise<bigint> {
    const [val] = await callFunction(EMISSION_VAULT_ABI, this.address, "emissionPool", []);
    return val as bigint;
  }

  async remainingEmissions(): Promise<bigint> {
    const [val] = await callFunction(EMISSION_VAULT_ABI, this.address, "remainingEmissions", []);
    return val as bigint;
  }

  async emittedTotal(): Promise<bigint> {
    const [val] = await callFunction(EMISSION_VAULT_ABI, this.address, "emittedTotal", []);
    return val as bigint;
  }

  async epochEmission(epoch: bigint | number): Promise<bigint> {
    const [val] = await callFunction(EMISSION_VAULT_ABI, this.address, "epochEmission", [epoch]);
    return val as bigint;
  }

  async current(): Promise<bigint> {
    const [val] = await callFunction(EMISSION_VAULT_ABI, this.address, "current", []);
    return val as bigint;
  }
}

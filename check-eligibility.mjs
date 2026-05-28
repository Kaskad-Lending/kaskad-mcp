import { ethers } from 'ethers';
import { RPC_URL, CONTRACTS } from './dist/config.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

// ActivityTracker ABI — key eligibility functions
const TRACKER_ABI = [
  'function isEligibleSupplier(address user) view returns (bool)',
  'function isEligibleBorrower(address user) view returns (bool)',
  'function getSupplierUptime(address user) view returns (uint256)',
  'function getBorrowerUptime(address user) view returns (uint256)',
  'function getSupplierTWAL(address user) view returns (uint256)',
  'function getBorrowerLTV(address user) view returns (uint256)',
  'function minSupplyUSD() view returns (uint256)',
  'function minSupplyUptimeBps() view returns (uint256)',
  'function minBorrowerLTVBps() view returns (uint256)',
  'function minBorrowerUptimeBps() view returns (uint256)',
];

// stKSKD vault ABI
const VAULT_ABI = ['function balanceOf(address) view returns (uint256)'];

const tracker = new ethers.Contract(CONTRACTS.activityTracker, TRACKER_ABI, provider);
const stVault = new ethers.Contract(CONTRACTS.stKSKDVault, VAULT_ABI, provider);

// Try each call, gracefully handle if not live yet
const safe = async (label, fn) => {
  try { return { label, value: await fn() }; }
  catch (e) { return { label, error: e.message.slice(0, 80) }; }
};

const results = await Promise.all([
  safe('isEligibleSupplier', () => tracker.isEligibleSupplier(wallet)),
  safe('isEligibleBorrower', () => tracker.isEligibleBorrower(wallet)),
  safe('supplierUptime', () => tracker.getSupplierUptime(wallet)),
  safe('borrowerUptime', () => tracker.getBorrowerUptime(wallet)),
  safe('supplierTWAL', () => tracker.getSupplierTWAL(wallet)),
  safe('borrowerLTV', () => tracker.getBorrowerLTV(wallet)),
  safe('minSupplyUSD', () => tracker.minSupplyUSD()),
  safe('minSupplyUptimeBps', () => tracker.minSupplyUptimeBps()),
  safe('minBorrowerLTVBps', () => tracker.minBorrowerLTVBps()),
  safe('minBorrowerUptimeBps', () => tracker.minBorrowerUptimeBps()),
  safe('stKSKD balance', () => stVault.balanceOf(wallet)),
]);

results.forEach(r => {
  if (r.error) console.log(`${r.label}: ERROR — ${r.error}`);
  else console.log(`${r.label}:`, r.value?.toString());
});

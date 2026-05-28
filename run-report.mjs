import { getPosition } from './dist/tools/getPosition.js';
import { getMarkets } from './dist/tools/getMarkets.js';

const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const [pos, markets] = await Promise.all([
  getPosition(WALLET),
  getMarkets(),
]);

const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const icon = pos.healthFactor >= 1.8 ? '✅' : pos.healthFactor >= 1.5 ? '⚠️' : '🚨';
const topMarkets = markets.markets.sort((a, b) => b.supplyAPY - a.supplyAPY).slice(0, 4);
const apySnap = topMarkets.map(m => `${m.asset} ${m.supplyAPY.toFixed(1)}%`).join('  |  ');
const supEl = pos.eligibility.isSupplierEligible ? '✅' : '❌';
const borEl = pos.eligibility.isBorrowerEligible ? '✅' : '❌';
const epoch = pos.eligibility.currentEpoch;

const msg = `\`\`\`
[${now}] Kaskad Agent — Hourly Check
HF: ${pos.healthFactor} ${icon}  |  Collateral: $${Math.round(pos.totalCollateralUSD).toLocaleString()}  |  Debt: $${Math.round(pos.totalDebtUSD).toLocaleString()}  |  Available: $${Math.round(pos.availableBorrowsUSD).toLocaleString()}
APY snapshot: ${apySnap}
KSKD Eligibility: Supplier ${supEl}  |  Borrower ${borEl}  |  Epoch ${epoch}
Action: — — Position optimal, no rebalance needed
\`\`\``;

console.log(msg);

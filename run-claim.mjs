import { claimKSKDRewards } from './dist/tools/claimRewards.js';
import { getPosition } from './dist/tools/getPosition.js';

const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

try {
  console.log('Claiming KSKD rewards...');
  const claimResult = await claimKSKDRewards();
  console.log('=== CLAIM RESULT ===');
  console.log(JSON.stringify(claimResult, null, 2));
} catch(e) {
  console.error('CLAIM ERROR:', e.message);
  console.error(e.stack);
}

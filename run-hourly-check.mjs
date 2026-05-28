import { checkHealthFactor } from './dist/tools/checkHealthFactor.js';
import { getPosition } from './dist/tools/getPosition.js';
import { getMarkets } from './dist/tools/getMarkets.js';
import { getGovernanceParams } from './dist/tools/getGovernanceParams.js';

const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

try {
  const [hf, pos, markets, gov] = await Promise.all([
    checkHealthFactor(WALLET, 1.8),
    getPosition(WALLET),
    getMarkets(),
    getGovernanceParams(),
  ]);

  console.log('=== HF ===');
  console.log(JSON.stringify(hf, null, 2));
  console.log('=== POSITION ===');
  console.log(JSON.stringify(pos, null, 2));
  console.log('=== MARKETS ===');
  console.log(JSON.stringify(markets, null, 2));
  console.log('=== GOV ===');
  console.log(JSON.stringify(gov, null, 2));
} catch(e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
}

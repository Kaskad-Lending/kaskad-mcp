// Direct tool calls bypassing MCP server (same runtime, no port conflict)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// We need to import from the tools directly since the server is already running
// Import the individual compiled tool modules
const { checkHealthFactor } = await import('./dist/tools/checkHealthFactor.js').catch(() => ({}));
const { getPosition } = await import('./dist/tools/getPosition.js').catch(() => ({}));
const { getMarkets } = await import('./dist/tools/getMarkets.js').catch(() => ({}));
const { getGovernanceParams } = await import('./dist/tools/getGovernanceParams.js').catch(() => ({}));

const ADDR = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const [hf, pos, mkt, gov] = await Promise.all([
  checkHealthFactor ? checkHealthFactor(ADDR, 1.8) : null,
  getPosition ? getPosition(ADDR) : null,
  getMarkets ? getMarkets() : null,
  getGovernanceParams ? getGovernanceParams() : null,
]);

const result = { hf, pos, mkt, gov };
process.stdout.write(JSON.stringify(result) + '\n');

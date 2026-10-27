const test = require('node:test');
const assert = require('node:assert/strict');

test('mainnet history without a configured subgraph is explicit and makes no request', async () => {
  const previousNetwork = process.env.KASKAD_NETWORK;
  const previousSubgraph = process.env.KASKAD_SUBGRAPH_URL;
  process.env.KASKAD_NETWORK = 'mainnet';
  delete process.env.KASKAD_SUBGRAPH_URL;
  const { getHistory } = require('../dist/tools/getHistory.js');
  const originalFetch = global.fetch;
  global.fetch = () => { throw new Error('Unexpected network request'); };
  try {
    const result = await getHistory({ limit: 3 });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.isTestnet, false);
    assert.equal(result.subgraph, null);
    assert.match(result.reason, /mainnet history subgraph is not configured/);
  } finally {
    global.fetch = originalFetch;
    if (previousNetwork === undefined) delete process.env.KASKAD_NETWORK; else process.env.KASKAD_NETWORK = previousNetwork;
    if (previousSubgraph === undefined) delete process.env.KASKAD_SUBGRAPH_URL; else process.env.KASKAD_SUBGRAPH_URL = previousSubgraph;
  }
});

test('write tools reject a missing environment key without wallet-file fallback', async () => {
  const previous = process.env.MCP_WALLET_KEY;
  delete process.env.MCP_WALLET_KEY;
  const { JsonRpcProvider } = require('ethers');
  const { loadWallet } = require('../dist/wallet.js');
  try {
    assert.throws(() => loadWallet(new JsonRpcProvider('http://127.0.0.1:8545')), /No valid MCP_WALLET_KEY supplied/);
  } finally {
    if (previous === undefined) delete process.env.MCP_WALLET_KEY; else process.env.MCP_WALLET_KEY = previous;
  }
});

const fs = require('node:fs');
const path = require('node:path');

test('all write tools use the shared environment-only wallet loader', () => {
  for (const file of ['executeTransaction.ts', 'claimRewards.ts', 'manageStaking.ts']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'tools', file), 'utf8');
    assert.match(source, /import { loadWallet } from "\.\.\/wallet\.js"/);
    assert.doesNotMatch(source, /wallet\.json/);
  }
});

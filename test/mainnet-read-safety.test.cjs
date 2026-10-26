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
  const { supplyAsset } = require('../dist/tools/executeTransaction.js');
  try {
    await assert.rejects(() => supplyAsset({ asset: 'USDC', amount: 1 }), /No valid MCP_WALLET_KEY supplied/);
  } finally {
    if (previous === undefined) delete process.env.MCP_WALLET_KEY; else process.env.MCP_WALLET_KEY = previous;
  }
});

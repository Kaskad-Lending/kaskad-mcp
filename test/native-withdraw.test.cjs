const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Interface, parseEther } = require('ethers');

test('native withdrawal uses the Aave V3 gateway three-argument calldata', () => {
  const abi = ['function withdrawETH(address pool, uint256 amount, address to) external'];
  const iface = new Interface(abi);
  const pool = '0x0000000000000000000000000000000000000001';
  const recipient = '0x0000000000000000000000000000000000000002';
  const amount = parseEther('1');
  const encoded = iface.encodeFunctionData('withdrawETH', [pool, amount, recipient]);
  const decoded = iface.decodeFunctionData('withdrawETH', encoded);
  assert.equal(decoded.pool, pool);
  assert.equal(decoded.amount, amount);
  assert.equal(decoded.to, recipient);
});

test('native withdrawal resolves the aToken from the active pool and waits for approval', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'tools', 'executeTransaction.ts'), 'utf8');
  assert.match(source, /getReserveData\(TOKENS\.IKAS\)/);
  assert.match(source, /reserveData\[8\]/);
  assert.match(source, /await approveTx\.wait\(\)/);
  assert.match(source, /withdrawETH\(POOL_ADDRESS, amountWei, wallet\.address/);
  assert.doesNotMatch(source, /AWIKAS_ADDRESS/);
});

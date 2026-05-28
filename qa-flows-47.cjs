'use strict';
/**
 * QA flows 4-7: Supply, Borrow, Repay, Withdraw
 * Using poll-based confirmation (avoids tx.wait() hang)
 */
const { ethers } = require('ethers');
const { getPosition } = require('./dist/tools/getPosition.js');

const RPC = 'https://galleon-testnet.igralabs.com:8545';
const WALLET_KEY = 'eda228e120390b4875bcafb92cd85f6426753468e370ad7c618364bf398683b7';
const POOL = '0xA1D84fc43f7F2D803a2d64dbBa4A90A9A79E3F24';
const USDC = '0x32F59763c4b7F385DFC1DBB07742DaD4eeEccdb2';
const IGRA = '0x04443457b050BBaa195bb71Ef6CCDb519CcB1f0f';
const GAS_PRICE = ethers.parseUnits('2000', 'gwei');
const WALLET = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
];
const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
];

async function pollReceipt(provider, hash, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await provider.getTransactionReceipt(hash);
    if (r) return r;
    await new Promise(res => setTimeout(res, 2000));
    process.stdout.write('.');
  }
  return null;
}

async function getBalanceAndDecimals(token) {
  const [bal, dec] = await Promise.all([token.balanceOf(WALLET), token.decimals()]);
  return { bal, dec, human: Number(ethers.formatUnits(bal, dec)) };
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(WALLET_KEY, provider);
  const pool = new ethers.Contract(POOL, POOL_ABI, wallet);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, wallet);
  const igra = new ethers.Contract(IGRA, ERC20_ABI, wallet);
  
  const results = {};

  // ─── FLOW 4: Supply USDC ───────────────────────────────────────────────────
  console.log('\n=== FLOW 4: SUPPLY USDC ===');
  const prePosS = await getPosition(WALLET);
  const preUSDC_S = prePosS.positions.find(p => p.asset === 'USDC');
  console.log('Pre-supply USDC supplied USD:', preUSDC_S.suppliedUSD);
  
  const usdcInfo = await getBalanceAndDecimals(usdc);
  const supplyAmount = Math.min(40, Math.floor(usdcInfo.human)); // supply 40 or all if < 40
  console.log('USDC wallet balance:', usdcInfo.human, '| Supplying:', supplyAmount);
  
  if (supplyAmount < 1) {
    console.log('SKIP: Insufficient USDC balance');
    results.flow4 = { result: 'SKIP', notes: 'USDC balance < 1' };
  } else {
    const supplyWei = ethers.parseUnits(supplyAmount.toString(), usdcInfo.dec);
    let nonce = await provider.getTransactionCount(wallet.address);
    
    // Check and approve if needed
    const allowance = await usdc.allowance(WALLET, POOL);
    if (allowance < supplyWei) {
      console.log('Approving USDC...');
      const approveTx = await usdc.approve(POOL, supplyWei, { gasPrice: GAS_PRICE, gasLimit: 200000n, nonce });
      console.log('Approve hash:', approveTx.hash);
      const approveReceipt = await pollReceipt(provider, approveTx.hash);
      console.log('\nApprove status:', approveReceipt ? approveReceipt.status : 'DROPPED');
      if (!approveReceipt || approveReceipt.status !== 1) {
        results.flow4 = { result: 'FAIL', notes: 'Approve failed' };
        return results;
      }
      nonce++;
    } else {
      console.log('Allowance already sufficient:', ethers.formatUnits(allowance, usdcInfo.dec));
    }
    
    // Static call check
    try {
      await pool.supply.staticCall(USDC, supplyWei, WALLET, 0);
    } catch(e) {
      console.log('Static call revert:', e.message.slice(0, 150));
      results.flow4 = { result: 'FAIL', notes: 'Static call revert: ' + e.message.slice(0, 100) };
    }
    
    if (!results.flow4) {
      console.log('Sending supply tx...');
      const supplyTx = await pool.supply(USDC, supplyWei, WALLET, 0, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce });
      console.log('Supply hash:', supplyTx.hash);
      const supplyReceipt = await pollReceipt(provider, supplyTx.hash);
      console.log('\nSupply status:', supplyReceipt ? supplyReceipt.status : 'DROPPED');
      
      if (supplyReceipt && supplyReceipt.status === 1) {
        await new Promise(r => setTimeout(r, 3000));
        const postPos = await getPosition(WALLET);
        const postUSDC = postPos.positions.find(p => p.asset === 'USDC');
        const delta = postUSDC.suppliedUSD - preUSDC_S.suppliedUSD;
        console.log('Post-supply USDC USD:', postUSDC.suppliedUSD, '| delta:', delta);
        results.flow4 = {
          result: delta > supplyAmount * 0.8 ? 'PASS' : 'PARTIAL',
          txHash: supplyTx.hash,
          notes: `USDC supplied +$${delta.toFixed(2)}`
        };
      } else {
        results.flow4 = { result: 'FAIL', notes: supplyReceipt ? 'status 0 (revert)' : 'tx dropped' };
      }
    }
  }
  console.log('Flow 4:', JSON.stringify(results.flow4));

  // ─── FLOW 5: Borrow IGRA ───────────────────────────────────────────────────
  console.log('\n=== FLOW 5: BORROW IGRA ===');
  const prePosB = await getPosition(WALLET);
  const preIGRA_B = prePosB.positions.find(p => p.asset === 'IGRA');
  const preHF = prePosB.healthFactor;
  console.log('Pre-borrow HF:', preHF.toFixed ? preHF.toFixed(4) : preHF, '| IGRA borrowed USD:', preIGRA_B.borrowedUSD);
  
  const borrowWei = ethers.parseUnits('100', 18); // IGRA is 18 decimals
  
  try {
    await pool.borrow.staticCall(IGRA, borrowWei, 2, 0, WALLET);
    console.log('Borrow static call: OK');
  } catch(e) {
    console.log('Borrow static call revert:', e.message.slice(0, 150));
    results.flow5 = { result: 'FAIL', notes: 'Static revert: ' + e.message.slice(0, 100) };
  }
  
  if (!results.flow5) {
    let nonce = await provider.getTransactionCount(wallet.address);
    const borrowTx = await pool.borrow(IGRA, borrowWei, 2, 0, WALLET, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce });
    console.log('Borrow hash:', borrowTx.hash);
    const borrowReceipt = await pollReceipt(provider, borrowTx.hash);
    console.log('\nBorrow status:', borrowReceipt ? borrowReceipt.status : 'DROPPED');
    
    if (borrowReceipt && borrowReceipt.status === 1) {
      await new Promise(r => setTimeout(r, 3000));
      const postPos = await getPosition(WALLET);
      const postIGRA = postPos.positions.find(p => p.asset === 'IGRA');
      const postHF = postPos.healthFactor;
      console.log('Post-borrow IGRA borrowed USD:', postIGRA.borrowedUSD, '| HF:', postHF.toFixed ? postHF.toFixed(4) : postHF);
      results.flow5 = {
        result: postIGRA.borrowedUSD > preIGRA_B.borrowedUSD ? 'PASS' : 'PARTIAL',
        txHash: borrowTx.hash,
        notes: `IGRA borrowed $${postIGRA.borrowedUSD.toFixed(2)}, HF: ${postHF.toFixed ? postHF.toFixed(4) : postHF}`
      };
    } else {
      results.flow5 = { result: 'FAIL', notes: borrowReceipt ? 'status 0' : 'tx dropped' };
    }
  }
  console.log('Flow 5:', JSON.stringify(results.flow5));

  // ─── FLOW 6: Repay IGRA ───────────────────────────────────────────────────
  console.log('\n=== FLOW 6: REPAY IGRA ===');
  if (results.flow5.result !== 'PASS') {
    results.flow6 = { result: 'SKIP', notes: 'Borrow failed, nothing to repay' };
    console.log('SKIP (borrow failed)');
  } else {
    const prePosR = await getPosition(WALLET);
    const preIGRA_R = prePosR.positions.find(p => p.asset === 'IGRA');
    console.log('Pre-repay IGRA borrowed USD:', preIGRA_R.borrowedUSD);
    
    const igraInfo = await getBalanceAndDecimals(igra);
    const repayAmount = Math.min(100, Math.floor(igraInfo.human * 0.9));
    console.log('IGRA balance:', igraInfo.human, '| Repaying:', repayAmount);
    
    const repayWei = ethers.parseUnits(repayAmount.toString(), igraInfo.dec);
    let nonce = await provider.getTransactionCount(wallet.address);
    
    // Approve
    const igAllow = await igra.allowance(WALLET, POOL);
    if (igAllow < repayWei) {
      console.log('Approving IGRA...');
      const approveTx = await igra.approve(POOL, repayWei, { gasPrice: GAS_PRICE, gasLimit: 200000n, nonce });
      const approveReceipt = await pollReceipt(provider, approveTx.hash);
      console.log('\nApprove status:', approveReceipt?.status);
      nonce++;
    }
    
    const repayTx = await pool.repay(IGRA, repayWei, 2, WALLET, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce });
    console.log('Repay hash:', repayTx.hash);
    const repayReceipt = await pollReceipt(provider, repayTx.hash);
    console.log('\nRepay status:', repayReceipt ? repayReceipt.status : 'DROPPED');
    
    if (repayReceipt && repayReceipt.status === 1) {
      await new Promise(r => setTimeout(r, 3000));
      const postPos = await getPosition(WALLET);
      const postIGRA = postPos.positions.find(p => p.asset === 'IGRA');
      console.log('Post-repay IGRA borrowed USD:', postIGRA.borrowedUSD);
      results.flow6 = {
        result: postIGRA.borrowedUSD < preIGRA_R.borrowedUSD ? 'PASS' : 'PARTIAL',
        txHash: repayTx.hash,
        notes: `IGRA debt $${preIGRA_R.borrowedUSD.toFixed(2)} → $${postIGRA.borrowedUSD.toFixed(2)}`
      };
    } else {
      results.flow6 = { result: 'FAIL', notes: repayReceipt ? 'status 0' : 'tx dropped' };
    }
  }
  console.log('Flow 6:', JSON.stringify(results.flow6));

  // ─── FLOW 7: Withdraw USDC ────────────────────────────────────────────────
  console.log('\n=== FLOW 7: WITHDRAW USDC ===');
  const prePosW = await getPosition(WALLET);
  const preUSDC_W = prePosW.positions.find(p => p.asset === 'USDC');
  console.log('Pre-withdraw USDC supplied USD:', preUSDC_W.suppliedUSD);
  
  // Withdraw same amount we supplied (or less if position didn't update)
  const suppliedAmount = results.flow4.result === 'PASS' ? 40 : 0;
  if (suppliedAmount < 1) {
    results.flow7 = { result: 'SKIP', notes: 'No new supply to withdraw (supply failed)' };
    console.log('SKIP');
  } else {
    const withdrawWei = ethers.parseUnits(suppliedAmount.toString(), 6);
    
    try {
      await pool.withdraw.staticCall(USDC, withdrawWei, WALLET);
      console.log('Withdraw static call: OK');
    } catch(e) {
      console.log('Withdraw static revert:', e.message.slice(0, 150));
      results.flow7 = { result: 'FAIL', notes: 'Static revert: ' + e.message.slice(0, 100) };
    }
    
    if (!results.flow7) {
      let nonce = await provider.getTransactionCount(wallet.address);
      const withdrawTx = await pool.withdraw(USDC, withdrawWei, WALLET, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce });
      console.log('Withdraw hash:', withdrawTx.hash);
      const withdrawReceipt = await pollReceipt(provider, withdrawTx.hash);
      console.log('\nWithdraw status:', withdrawReceipt ? withdrawReceipt.status : 'DROPPED');
      
      if (withdrawReceipt && withdrawReceipt.status === 1) {
        await new Promise(r => setTimeout(r, 3000));
        const postPos = await getPosition(WALLET);
        const postUSDC = postPos.positions.find(p => p.asset === 'USDC');
        const delta = preUSDC_W.suppliedUSD - postUSDC.suppliedUSD;
        console.log('Post-withdraw USDC USD:', postUSDC.suppliedUSD, '| delta:', delta);
        results.flow7 = {
          result: delta > suppliedAmount * 0.8 ? 'PASS' : 'PARTIAL',
          txHash: withdrawTx.hash,
          notes: `USDC withdrawn $${delta.toFixed(2)}`
        };
      } else {
        results.flow7 = { result: 'FAIL', notes: withdrawReceipt ? 'status 0' : 'tx dropped' };
      }
    }
  }
  console.log('Flow 7:', JSON.stringify(results.flow7));

  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

main().then(() => process.exit(0)).catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

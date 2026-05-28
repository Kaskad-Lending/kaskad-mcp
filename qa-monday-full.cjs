'use strict';
/**
 * QA Full Audit — Monday 2026-04-13
 * Flows 1-10: Markets, Gov, Position, Supply, Borrow, Repay, Withdraw, Gov Bounds, HF, iKAS
 */
const { ethers } = require('ethers');
const { getPosition } = require('./dist/tools/getPosition.js');
const { getMarkets } = require('./dist/tools/getMarkets.js');
const { getGovernanceParams } = require('./dist/tools/getGovernanceParams.js');

const RPC = 'https://galleon-testnet.igralabs.com:8545';
const WALLET_KEY = process.env.MCP_WALLET_KEY;
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

async function pollReceipt(provider, hash, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await provider.getTransactionReceipt(hash);
    if (r) return r;
    await new Promise(res => setTimeout(res, 2000));
    process.stdout.write('.');
  }
  return null;
}

async function getTokenInfo(token) {
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

  // ─── FLOW 1: Markets Readable ─────────────────────────────────────────────
  console.log('\n=== FLOW 1: MARKETS READABLE ===');
  try {
    const markets = await getMarkets();
    const list = Array.isArray(markets) ? markets : (markets.markets || []);
    console.log('Markets count:', list.length);
    const expectedAssets = ['IGRA', 'USDC', 'WBTC', 'WETH', 'IKAS', 'KSKD'];
    const found = expectedAssets.filter(a => list.some(m => m.asset === a || m.symbol === a));
    console.log('Found assets:', found.join(', '));
    const allValid = list.every(m => m.supplyAPY >= 0 && m.borrowAPY >= 0);
    if (list.length >= 6 && found.length >= 6 && allValid) {
      results.flow1 = { result: 'PASS', notes: `${list.length} markets, all fields valid` };
    } else {
      results.flow1 = { result: 'FAIL', notes: `Markets: ${list.length}, found: ${found.join(',')}, valid: ${allValid}` };
    }
  } catch(e) {
    results.flow1 = { result: 'FAIL', notes: 'RPC error: ' + e.message.slice(0, 100) };
  }
  console.log('Flow 1:', JSON.stringify(results.flow1));

  // ─── FLOW 2: Governance Params ─────────────────────────────────────────────
  console.log('\n=== FLOW 2: GOVERNANCE PARAMS ===');
  try {
    const gov = await getGovernanceParams();
    console.log('Gov params keys:', Object.keys(gov).join(', '));
    const epoch = gov.currentEpoch || gov.epoch || 0;
    const hasShare = gov.EMISSION_SUPPLIERS_SHARE_BPS !== undefined;
    console.log('Current epoch:', epoch, '| Has share BPS:', hasShare);
    if (epoch > 0) {
      results.flow2 = { result: 'PASS', notes: `Epoch ${epoch}, params present` };
    } else {
      results.flow2 = { result: 'PARTIAL', notes: `Epoch = ${epoch}, check returned: ${JSON.stringify(gov).slice(0,100)}` };
    }
  } catch(e) {
    results.flow2 = { result: 'FAIL', notes: 'RPC error: ' + e.message.slice(0, 100) };
  }
  console.log('Flow 2:', JSON.stringify(results.flow2));

  // ─── FLOW 3: Position Readable ─────────────────────────────────────────────
  console.log('\n=== FLOW 3: POSITION READABLE ===');
  try {
    const pos = await getPosition(WALLET);
    const hf = pos.healthFactor;
    const positions = pos.positions || [];
    const totalCollateral = pos.totalCollateralUSD;
    const netAPY = pos.netPositionAPY;
    console.log('HF:', hf, '| Collateral USD:', totalCollateral, '| netAPY:', netAPY);
    console.log('Positions:', positions.map(p => p.asset).join(', '));
    if (hf && hf > 0 && positions.length >= 4) {
      results.flow3 = { result: 'PASS', notes: `HF: ${typeof hf === 'number' ? hf.toFixed(4) : hf}, ${positions.length} positions, collateral $${totalCollateral}` };
    } else {
      results.flow3 = { result: 'PARTIAL', notes: `HF: ${hf}, positions: ${positions.length}` };
    }
  } catch(e) {
    results.flow3 = { result: 'FAIL', notes: 'Error: ' + e.message.slice(0, 100) };
  }
  console.log('Flow 3:', JSON.stringify(results.flow3));

  // ─── FLOW 4: Supply USDC ───────────────────────────────────────────────────
  console.log('\n=== FLOW 4: SUPPLY USDC ===');
  const prePosS = await getPosition(WALLET);
  const preUSDC_S = prePosS.positions.find(p => p.asset === 'USDC');
  console.log('Pre-supply USDC supplied USD:', preUSDC_S?.suppliedUSD);

  const usdcInfo = await getTokenInfo(usdc);
  // Use at most 80% of balance to avoid exactly-balance issues, cap at 40
  const safeSupply = Math.min(40, Math.floor(usdcInfo.human * 0.8));
  console.log('USDC wallet balance:', usdcInfo.human, '| Safe supply amount:', safeSupply);

  if (safeSupply < 1) {
    results.flow4 = { result: 'SKIP', notes: 'USDC balance too low' };
    console.log('SKIP: insufficient USDC');
  } else {
    const supplyWei = ethers.parseUnits(safeSupply.toString(), usdcInfo.dec);
    let nonce = await provider.getTransactionCount(wallet.address);

    // Approve if needed
    const allowance = await usdc.allowance(WALLET, POOL);
    console.log('Current allowance:', ethers.formatUnits(allowance, usdcInfo.dec));
    if (allowance < supplyWei) {
      console.log('Approving USDC for', safeSupply, '...');
      const approveTx = await usdc.approve(POOL, supplyWei, { gasPrice: GAS_PRICE, gasLimit: 200000n, nonce });
      console.log('Approve hash:', approveTx.hash);
      const approveReceipt = await pollReceipt(provider, approveTx.hash);
      console.log('\nApprove status:', approveReceipt?.status);
      if (!approveReceipt || approveReceipt.status !== 1) {
        results.flow4 = { result: 'FAIL', notes: 'Approve failed' };
      } else {
        nonce++;
      }
    } else {
      console.log('Allowance sufficient:', ethers.formatUnits(allowance, usdcInfo.dec));
    }

    if (!results.flow4) {
      // Static call check
      try {
        await pool.supply.staticCall(USDC, supplyWei, WALLET, 0);
        console.log('Supply static call: OK');
      } catch(e) {
        console.log('Static call revert:', e.message.slice(0, 200));
        results.flow4 = { result: 'FAIL', notes: 'Static call revert: ' + e.message.slice(0, 100) };
      }

      if (!results.flow4) {
        console.log('Sending supply tx (', safeSupply, 'USDC)...');
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
            result: delta > safeSupply * 0.8 ? 'PASS' : 'PARTIAL',
            txHash: supplyTx.hash,
            notes: `USDC supplied +$${delta.toFixed(2)}`
          };
        } else {
          const reason = supplyReceipt ? 'status 0 (revert)' : 'tx dropped';
          results.flow4 = { result: 'FAIL', notes: reason, txHash: supplyTx.hash };
        }
      }
    }
  }
  console.log('Flow 4:', JSON.stringify(results.flow4));

  // ─── FLOW 5: Borrow IGRA ───────────────────────────────────────────────────
  console.log('\n=== FLOW 5: BORROW IGRA ===');
  const prePosB = await getPosition(WALLET);
  const preIGRA_B = prePosB.positions.find(p => p.asset === 'IGRA');
  const preHF = prePosB.healthFactor;
  console.log('Pre-borrow HF:', typeof preHF === 'number' ? preHF.toFixed(4) : preHF);
  console.log('IGRA borrowed USD:', preIGRA_B?.borrowedUSD);

  const borrowWei = ethers.parseUnits('100', 18);
  try {
    await pool.borrow.staticCall(IGRA, borrowWei, 2, 0, WALLET);
    console.log('Borrow static call: OK');
  } catch(e) {
    console.log('Borrow static call revert:', e.message.slice(0, 200));
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
      console.log('Post-borrow IGRA borrowed USD:', postIGRA?.borrowedUSD, '| HF:', typeof postHF === 'number' ? postHF.toFixed(4) : postHF);
      results.flow5 = {
        result: postIGRA.borrowedUSD > preIGRA_B.borrowedUSD ? 'PASS' : 'PARTIAL',
        txHash: borrowTx.hash,
        notes: `IGRA borrow $${postIGRA.borrowedUSD?.toFixed(2)}, HF: ${typeof postHF === 'number' ? postHF.toFixed(4) : postHF}`
      };
    } else {
      results.flow5 = { result: 'FAIL', notes: borrowReceipt ? 'status 0' : 'tx dropped', txHash: borrowTx.hash };
    }
  }
  console.log('Flow 5:', JSON.stringify(results.flow5));

  // ─── FLOW 6: Repay IGRA ───────────────────────────────────────────────────
  console.log('\n=== FLOW 6: REPAY IGRA ===');
  if (results.flow5.result !== 'PASS') {
    results.flow6 = { result: 'SKIP', notes: 'Borrow did not PASS, skipping repay' };
  } else {
    const prePosR = await getPosition(WALLET);
    const preIGRA_R = prePosR.positions.find(p => p.asset === 'IGRA');
    console.log('Pre-repay IGRA borrowed USD:', preIGRA_R?.borrowedUSD);

    const igraInfo = await getTokenInfo(igra);
    const repayAmount = Math.min(100, Math.floor(igraInfo.human * 0.95));
    console.log('IGRA balance:', igraInfo.human, '| Repaying:', repayAmount);

    if (repayAmount < 1) {
      results.flow6 = { result: 'SKIP', notes: 'IGRA balance insufficient for repay' };
    } else {
      const repayWei = ethers.parseUnits(repayAmount.toString(), igraInfo.dec);
      let nonce = await provider.getTransactionCount(wallet.address);

      const igAllow = await igra.allowance(WALLET, POOL);
      if (igAllow < repayWei) {
        console.log('Approving IGRA...');
        const approveTx = await igra.approve(POOL, repayWei, { gasPrice: GAS_PRICE, gasLimit: 200000n, nonce });
        const approveReceipt = await pollReceipt(provider, approveTx.hash);
        console.log('\nApprove status:', approveReceipt?.status);
        if (approveReceipt?.status === 1) nonce++;
      }

      const repayTx = await pool.repay(IGRA, repayWei, 2, WALLET, { gasPrice: GAS_PRICE, gasLimit: 1700000n, nonce });
      console.log('Repay hash:', repayTx.hash);
      const repayReceipt = await pollReceipt(provider, repayTx.hash);
      console.log('\nRepay status:', repayReceipt ? repayReceipt.status : 'DROPPED');

      if (repayReceipt && repayReceipt.status === 1) {
        await new Promise(r => setTimeout(r, 3000));
        const postPos = await getPosition(WALLET);
        const postIGRA = postPos.positions.find(p => p.asset === 'IGRA');
        console.log('Post-repay IGRA borrowed USD:', postIGRA?.borrowedUSD);
        results.flow6 = {
          result: postIGRA.borrowedUSD < preIGRA_R.borrowedUSD ? 'PASS' : 'PARTIAL',
          txHash: repayTx.hash,
          notes: `IGRA debt $${preIGRA_R.borrowedUSD?.toFixed(2)} → $${postIGRA.borrowedUSD?.toFixed(2)}`
        };
      } else {
        results.flow6 = { result: 'FAIL', notes: repayReceipt ? 'status 0' : 'tx dropped', txHash: repayTx.hash };
      }
    }
  }
  console.log('Flow 6:', JSON.stringify(results.flow6));

  // ─── FLOW 7: Withdraw USDC ────────────────────────────────────────────────
  console.log('\n=== FLOW 7: WITHDRAW USDC ===');
  if (results.flow4.result !== 'PASS') {
    results.flow7 = { result: 'SKIP', notes: 'Supply failed, skipping withdraw' };
  } else {
    const prePosW = await getPosition(WALLET);
    const preUSDC_W = prePosW.positions.find(p => p.asset === 'USDC');
    console.log('Pre-withdraw USDC supplied USD:', preUSDC_W?.suppliedUSD);

    const withdrawAmount = safeSupply; // withdraw what we supplied
    const withdrawWei = ethers.parseUnits(withdrawAmount.toString(), 6);

    try {
      await pool.withdraw.staticCall(USDC, withdrawWei, WALLET);
      console.log('Withdraw static call: OK');
    } catch(e) {
      console.log('Withdraw static revert:', e.message.slice(0, 200));
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
          result: delta > withdrawAmount * 0.8 ? 'PASS' : 'PARTIAL',
          txHash: withdrawTx.hash,
          notes: `USDC withdrawn $${delta.toFixed(2)}`
        };
      } else {
        results.flow7 = { result: 'FAIL', notes: withdrawReceipt ? 'status 0' : 'tx dropped', txHash: withdrawTx.hash };
      }
    }
  }
  console.log('Flow 7:', JSON.stringify(results.flow7));

  // ─── FLOW 8: Governance Bounds Check ─────────────────────────────────────
  console.log('\n=== FLOW 8: GOVERNANCE BOUNDS ===');
  try {
    const gov = await getGovernanceParams();
    const supShare = gov.EMISSION_SUPPLIERS_SHARE_BPS || 0;
    const borShare = gov.EMISSION_BORROWERS_SHARE_BPS || 0;
    const daoTVL = gov.DAO_TVL_INCENTIVES_SHARE_BPS || 0;
    const daoBurn = gov.DAO_BURN_SHARE_BPS || 0;
    const daoKaspa = gov.DAO_KASPA_CORE_SHARE_BPS || 0;
    const emissionSum = supShare + borShare;
    const daoSum = daoTVL + daoBurn + daoKaspa;
    console.log('Emission shares sum (BPS):', emissionSum, '(expect ~10000)');
    console.log('DAO shares sum (BPS):', daoSum, '(expect <=10000)');
    const withinBounds = emissionSum <= 10100 && daoSum <= 10000;
    results.flow8 = {
      result: withinBounds ? 'PASS' : 'FAIL',
      notes: `Emission sum: ${emissionSum} BPS, DAO sum: ${daoSum} BPS`
    };
  } catch(e) {
    results.flow8 = { result: 'FAIL', notes: 'Error: ' + e.message.slice(0, 100) };
  }
  console.log('Flow 8:', JSON.stringify(results.flow8));

  // ─── FLOW 9: Health Factor Safety ─────────────────────────────────────────
  console.log('\n=== FLOW 9: HEALTH FACTOR SAFETY ===');
  try {
    const pos = await getPosition(WALLET);
    const hf = pos.healthFactor;
    const avail = pos.availableBorrowsUSD;
    console.log('HF:', hf, '| Available borrows USD:', avail);
    const hfNum = typeof hf === 'string' ? parseFloat(hf) : hf;
    if (hfNum >= 1.5) {
      results.flow9 = { result: 'PASS', notes: `HF: ${hfNum?.toFixed(4)}, avail borrows: $${avail?.toFixed(2)}` };
    } else if (hfNum >= 1.2) {
      results.flow9 = { result: 'PARTIAL', notes: `WARNING: HF ${hfNum?.toFixed(4)} < 1.5 — liquidation risk approaching` };
    } else {
      results.flow9 = { result: 'FAIL', notes: `CRITICAL: HF ${hfNum?.toFixed(4)} < 1.2 — liquidation imminent` };
    }
  } catch(e) {
    results.flow9 = { result: 'FAIL', notes: 'Error: ' + e.message.slice(0, 100) };
  }
  console.log('Flow 9:', JSON.stringify(results.flow9));

  // ─── FLOW 10: iKAS Reserve Check ──────────────────────────────────────────
  console.log('\n=== FLOW 10: IKAS RESERVE ===');
  try {
    const ikas = await provider.getBalance(WALLET);
    const ikasFloat = Number(ethers.formatEther(ikas));
    console.log('iKAS balance:', ikasFloat);
    if (ikasFloat >= 10000) {
      results.flow10 = { result: 'PASS', notes: `iKAS: ${ikasFloat.toFixed(2)} (${(ikasFloat - 10000).toFixed(2)} buffer above minimum)` };
    } else {
      results.flow10 = { result: 'FAIL', notes: `CRITICAL: iKAS ${ikasFloat.toFixed(2)} < 10,000 minimum — all writes blocked` };
    }
  } catch(e) {
    results.flow10 = { result: 'FAIL', notes: 'Error: ' + e.message.slice(0, 100) };
  }
  console.log('Flow 10:', JSON.stringify(results.flow10));

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────────
  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

main().then(() => process.exit(0)).catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

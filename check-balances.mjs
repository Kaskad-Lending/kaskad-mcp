import { ethers } from 'ethers';
import { RPC_URL, TOKENS } from './dist/config.js';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = '0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094';
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];

const ikas = new ethers.Contract(TOKENS.IKAS, ERC20_ABI, provider);
const usdc = new ethers.Contract(TOKENS.USDC, ERC20_ABI, provider);

const [ikasBal, usdcBal, ikasDec, usdcDec, nativeBal] = await Promise.all([
  ikas.balanceOf(wallet),
  usdc.balanceOf(wallet),
  ikas.decimals(),
  usdc.decimals(),
  provider.getBalance(wallet),
]);

console.log('iKAS:', ethers.formatUnits(ikasBal, ikasDec));
console.log('USDC:', ethers.formatUnits(usdcBal, usdcDec));
console.log('native iKAS (gas):', ethers.formatEther(nativeBal));

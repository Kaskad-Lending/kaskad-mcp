import { supplyAsset } from './dist/tools/executeTransaction.js';

console.log('Supplying 10 USDC to Kaskad mainnet...');
const result = await supplyAsset({ asset: 'USDC', amount: 10 });
console.log(JSON.stringify(result, null, 2));

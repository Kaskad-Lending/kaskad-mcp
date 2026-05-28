import { supplyNativeIKAS } from './dist/tools/executeTransaction.js';

console.log('Supplying 100 native iKAS to Kaskad mainnet...');
const result = await supplyNativeIKAS({ amount: 100 });
console.log(JSON.stringify(result, null, 2));

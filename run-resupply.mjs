import pkg from './dist/tools/executeTransaction.js';
const { supplyAsset } = pkg;

// Re-supply the 1.600865 KSKD just claimed
// KSKD address: 0x2d17780a59044D49FeEf0AA9cEaB1B6e3161aFf7
try {
  console.log('Re-supplying 1.600865 KSKD...');
  const result = await supplyAsset({ asset: 'KSKD', amount: 1.600865 });
  console.log('=== SUPPLY RESULT ===');
  console.log(JSON.stringify(result, null, 2));
} catch(e) {
  console.error('SUPPLY ERROR:', e.message);
  console.error(e.stack);
}

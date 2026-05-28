import { getStakingInfo } from './dist/tools/manageStaking.js';

const r1 = await getStakingInfo();
console.log('no params:', JSON.stringify(r1));

const r2 = await getStakingInfo({ address: '0x0000000000000000000000000000000000000000' });
console.log('zero addr:', JSON.stringify(r2));

const r3 = await getStakingInfo({ address: 'notanaddress' });
console.log('bad addr:', JSON.stringify(r3));

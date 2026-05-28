import { getGovernanceParams } from './dist/tools/getGovernanceParams.js';
const result = await getGovernanceParams();
console.log(JSON.stringify(result, null, 2));

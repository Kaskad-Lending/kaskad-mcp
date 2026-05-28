const path = require('path');
process.chdir(path.resolve(process.argv[2]));
const { spawn } = require('child_process');
const child = spawn(process.execPath, ['dist/index.js'], { stdio: ['pipe','pipe','pipe'] });
let buf='';
child.stdout.on('data', d => { buf += d.toString(); });
child.stderr.on('data', d => { process.stderr.write(d.toString()); });
function send(msg){ child.stdin.write(JSON.stringify(msg)+'\n'); }
function waitLine(){ return new Promise(resolve => {
  const check=()=>{ const i=buf.indexOf('\n'); if(i>=0){ const line=buf.slice(0,i); buf=buf.slice(i+1); resolve(line); } else setTimeout(check, 25); };
  check();
 }); }
(async()=>{
  send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'oc',version:'1.0'}}});
  await waitLine();
  send({jsonrpc:'2.0',method:'notifications/initialized'});
  const calls = [
    ['checkHealthFactor',{walletAddress:'0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094', threshold:1.8}],
    ['getPosition',{walletAddress:'0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094'}],
    ['getMarkets',{}],
    ['getGovernanceParams',{}],
    ['getUserRewards',{walletAddress:'0xFcBD0dA4428c7697EA06b705Cea9F6A8858d6094'}]
  ];
  const out={}; let id=10;
  for (const [name,args] of calls){ send({jsonrpc:'2.0',id:id++,method:'tools/call',params:{name,arguments:args}}); out[name]=JSON.parse(await waitLine()); }
  console.log(JSON.stringify(out));
  child.kill();
})();
import WebSocket from 'ws';
import { readFileSync } from 'fs';
import { createPublicKey, sign, createPrivateKey } from 'crypto';

const deviceJson = JSON.parse(readFileSync('C:/Users/jackb/.openclaw/identity/device.json', 'utf8'));
const deviceAuthJson = JSON.parse(readFileSync('C:/Users/jackb/.openclaw/identity/device-auth.json', 'utf8'));

const DEVICE_ID = deviceJson.deviceId;
const PRIVATE_KEY_PEM = deviceJson.privateKeyPem;
const PUBLIC_KEY_PEM = deviceJson.publicKeyPem;
const OPERATOR_TOKEN = deviceAuthJson.tokens.operator.token;

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function publicKeyRawBase64Url(pem) {
  const spki = createPublicKey(pem).export({ type: 'spki', format: 'der' });
  let raw;
  if (spki.length === ED25519_SPKI_PREFIX.length + 32 &&
      spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    raw = spki.subarray(ED25519_SPKI_PREFIX.length);
  } else {
    raw = spki;
  }
  return raw.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}

function signPayload(privateKeyPem, payload) {
  const key = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(payload, 'utf8'), key).toString('base64url');
}

const msg = `\`\`\`
[17:01] Kaskad Agent — Hourly Check
HF: ∞ ✅  |  Collateral: $250,234  |  Debt: $0  |  Available: $166,531
APY snapshot: KSKD 64.71%  |  IGRA 54.71%  |  WBTC borrow 2.42%
Net yield: $38,661/yr  |  Net APY: 15.45%  |  Monthly: $3,222/mo
KSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 14
Action: Borrow WBTC (~$39K at 2.42%) to activate borrower-share emissions — HF stays ~5.4, well above 1.8. No KSKD rewards to claim.
\`\`\``;

const ws = new WebSocket('ws://127.0.0.1:18789');
let reqId = 1;
let connected = false;

ws.on('message', (raw) => {
  let data;
  try { data = JSON.parse(raw.toString()); } catch(e) { return; }

  if (data.type === 'event' && data.event === 'connect.challenge') {
    const nonce = data.payload.nonce;
    const signedAtMs = Date.now();
    const role = 'operator';
    const scopes = ['operator.admin','operator.approvals','operator.pairing','operator.read','operator.write'];
    const scopesStr = scopes.join(',');
    const clientId = 'cli';
    const clientMode = 'cli';
    const platform = 'win32';
    const deviceFamily = '';
    const payloadStr = ['v3',DEVICE_ID,clientId,clientMode,role,scopesStr,String(signedAtMs),OPERATOR_TOKEN,nonce,platform,deviceFamily].join('|');
    const signature = signPayload(PRIVATE_KEY_PEM, payloadStr);
    const pubKeyB64Url = publicKeyRawBase64Url(PUBLIC_KEY_PEM);

    ws.send(JSON.stringify({
      type: 'req', id: String(reqId++), method: 'connect',
      params: {
        minProtocol: 3, maxProtocol: 3,
        client: { id: clientId, version: '2026.4.15', platform, mode: clientMode },
        caps: [], auth: { token: OPERATOR_TOKEN }, role, scopes,
        device: { id: DEVICE_ID, publicKey: pubKeyB64Url, signature, signedAt: signedAtMs, nonce }
      }
    }));
    return;
  }

  if (!connected && data.type === 'res' && !data.error) {
    connected = true;
    ws.send(JSON.stringify({
      type: 'req', id: String(reqId++), method: 'message.action',
      params: {
        channel: 'discord', action: 'send',
        idempotencyKey: 'keal-hourly-1701-20260422',
        params: { to: 'channel:1489251680687231167', message: msg, silent: true }
      }
    }));
    return;
  }

  if (connected && data.type === 'res') {
    console.log('sent:', JSON.stringify(data).slice(0, 200));
    ws.close();
    process.exit(0);
  }

  if (data.error) {
    console.error('error:', JSON.stringify(data.error));
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => { console.error('ws error:', err.message); process.exit(1); });
ws.on('close', (code) => { if (!connected) { console.error('closed early', code); process.exit(1); } });
setTimeout(() => { console.error('timeout'); process.exit(1); }, 25000);

import WebSocket from 'ws';
// crypto imported below
import { readFileSync } from 'fs';

const deviceJson = JSON.parse(readFileSync('C:/Users/jackb/.openclaw/identity/device.json', 'utf8'));
const deviceAuthJson = JSON.parse(readFileSync('C:/Users/jackb/.openclaw/identity/device-auth.json', 'utf8'));

const DEVICE_ID = deviceJson.deviceId;
const PRIVATE_KEY_PEM = deviceJson.privateKeyPem;
const PUBLIC_KEY_PEM = deviceJson.publicKeyPem;
const OPERATOR_TOKEN = deviceAuthJson.tokens.operator.token;

import { createPublicKey } from 'crypto';

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

import { sign, createPrivateKey } from 'crypto';

function signPayload(privateKeyPem, payload) {
  const key = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(payload, 'utf8'), key).toString('base64url');
}

const msg = `\`\`\`
[06:01] Kaskad Agent — Hourly Check
HF: ∞ ✅  |  Collateral: $242,348  |  Debt: $0  |  Available: $161,258
APY snapshot: IGRA 57.86%  |  USDC 52.95%  |  WBTC borrow 2.41%
Net yield: $38,945/yr  |  Net APY: 16.07%  |  Monthly: $3,245/mo
KSKD Eligibility: Supplier ✅  |  Borrower ✅  |  Epoch 12
Action: Borrow WBTC (~$30K at 2.41%) to capture borrower-share emissions — HF stays >> 1.8. No KSKD rewards pending.
\`\`\``;

const ws = new WebSocket('ws://127.0.0.1:18789');
let reqId = 1;
let nonce = null;
let connected = false;

ws.on('open', () => {
  console.log('ws opened');
});

ws.on('message', (raw) => {
  let data;
  try { data = JSON.parse(raw.toString()); } catch(e) { console.error('parse err'); return; }

  console.log('recv full:', JSON.stringify(data).slice(0,400));

  if (data.type === 'event' && data.event === 'connect.challenge') {
    nonce = data.payload.nonce;
    const signedAtMs = Date.now();
    const role = 'operator';
    const scopes = ['operator.admin','operator.approvals','operator.pairing','operator.read','operator.write'];
    const scopesStr = scopes.join(',');
    const clientId = 'cli';
    const clientMode = 'cli';

    // Build device auth payload v3
    const platform = 'win32';
    const deviceFamily = '';
    const payloadStr = [
      'v3',
      DEVICE_ID,
      clientId,
      clientMode,
      role,
      scopesStr,
      String(signedAtMs),
      OPERATOR_TOKEN,
      nonce,
      platform,
      deviceFamily
    ].join('|');

    const signature = signPayload(PRIVATE_KEY_PEM, payloadStr);
    const pubKeyB64Url = publicKeyRawBase64Url(PUBLIC_KEY_PEM);

    const connectPayload = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: '2026.4.15',
        platform,
        mode: clientMode,
      },
      caps: [],
      auth: {
        token: OPERATOR_TOKEN,
      },
      role,
      scopes,
      device: {
        id: DEVICE_ID,
        publicKey: pubKeyB64Url,
        signature,
        signedAt: signedAtMs,
        nonce,
      }
    };

    ws.send(JSON.stringify({ type: 'req', id: String(reqId++), method: 'connect', params: connectPayload }));
    return;
  }

  // Connected OK — now send the message
  if (!connected && data.type === 'res' && !data.error) {
    console.log('auth ok, sending message...');
    connected = true;
    const msgId = String(reqId++);
    ws.send(JSON.stringify({
      type: 'req',
      id: msgId,
      method: 'message.action',
      params: {
        channel: 'discord',
        action: 'send',
        idempotencyKey: 'keal-hourly-' + Date.now(),
        params: {
          to: 'channel:1489251680687231167',
          message: msg,
          silent: true,
        }
      }
    }));
    return;
  }

  if (connected && data.type === 'res') {
    console.log('message result:', JSON.stringify(data).slice(0, 500));
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
ws.on('close', (code, reason) => { console.log('closed', code, reason?.toString()); });

setTimeout(() => { console.error('timeout'); process.exit(1); }, 25000);

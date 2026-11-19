// Campfire token server — the only backend Campfire needs.
//
// Why it exists: Nexconn access tokens are issued by the Nexconn Server API,
// and every Server API request is signed with the App Secret
// (Signature = SHA1(AppSecret + Nonce + Timestamp)). The App Secret must
// never ship to a browser, so this tiny server holds it and exposes:
//
//   GET  /health  -> { ok, appKeyConfigured }
//   POST /token   -> { userId, token }        body: { userId, name, avatarUrl? }
//   POST /seed    -> creates the Campfire rooms (group channels) and joins
//                    the demo personas to them. Safe to call more than once;
//                    per-room API results are returned so you can see errors.
//
// Zero dependencies: Node 18+ built-ins only (http, crypto, fetch).
//
// Run:
//   NEXCONN_APP_KEY=xxxx NEXCONN_APP_SECRET=yyyy node server/token-server.mjs
// or copy .env.example values into your host's environment settings.

import { createHash, randomInt } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const APP_KEY = process.env.NEXCONN_APP_KEY ?? '';
const APP_SECRET = process.env.NEXCONN_APP_SECRET ?? '';
// Base URL of the Nexconn Server API for your app's data center.
// Singapore (the default data center) per the official docs examples:
const API_BASE = (process.env.NEXCONN_API_BASE ?? 'https://api.sg-light-api.com').replace(/\/$/, '');

const ROOMS = [
  { id: 'campfire-general', name: '🔥 Campfire General' },
  { id: 'show-and-tell', name: '🎨 Show & Tell' },
  { id: 'help-circle', name: '🤝 Help Circle' },
  { id: 'weekend-plans', name: '🥾 Weekend Plans' },
];
const PERSONA_IDS = ['ava', 'ben', 'chen', 'dina'];

function signHeaders() {
  const nonce = String(randomInt(1_000_000, 9_999_999_999));
  const timestamp = String(Date.now());
  const signature = createHash('sha1').update(APP_SECRET + nonce + timestamp).digest('hex');
  return {
    'App-Key': APP_KEY,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    'Content-Type': 'application/json',
  };
}

async function nexconn(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: signHeaders(),
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: resp.status, json };
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, appKeyConfigured: Boolean(APP_KEY && APP_SECRET), apiBase: API_BASE });
    }

    if (!APP_KEY || !APP_SECRET) {
      return send(res, 500, { error: 'Server is missing NEXCONN_APP_KEY / NEXCONN_APP_SECRET environment variables.' });
    }

    if (req.method === 'POST' && url.pathname === '/token') {
      const { userId, name, avatarUrl } = await readBody(req);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId ?? '')) {
        return send(res, 400, { error: 'userId must be 1-64 chars of letters, numbers, - or _' });
      }
      const { status, json } = await nexconn('/v4/auth/access-token/issue', {
        userId,
        name: (name ?? userId).slice(0, 64),
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      const token = json?.result?.accessToken;
      if (status !== 200 || json?.code !== 0 || !token) {
        return send(res, 502, { error: 'Nexconn token issue failed', nexconnStatus: status, nexconn: json });
      }
      return send(res, 200, { userId, token });
    }

    if (req.method === 'POST' && url.pathname === '/seed') {
      const results = [];
      for (const room of ROOMS) {
        const created = await nexconn('/v4/group-channel/create', {
          channelId: room.id,
          name: room.name,
          owner: PERSONA_IDS[0],
        });
        const joined = await nexconn('/v4/group-channel/join', {
          channelId: room.id,
          owner: PERSONA_IDS[0],
        });
        results.push({ room: room.id, create: created.json, join: joined.json });
      }
      return send(res, 200, { seeded: true, results });
    }

    return send(res, 404, { error: 'Not found. Endpoints: GET /health, POST /token, POST /seed' });
  } catch (err) {
    return send(res, 500, { error: String(err?.message ?? err) });
  }
});

server.listen(PORT, () => {
  console.log(`Campfire token server listening on :${PORT}`);
  console.log(`Nexconn API base: ${API_BASE}`);
  console.log(`App Key configured: ${Boolean(APP_KEY)} (secret ${APP_SECRET ? 'set' : 'MISSING'})`);
});

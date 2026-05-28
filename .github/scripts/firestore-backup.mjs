// 用 service account JWT + Firestore REST API 抓全部資料
// 寫到 backup-out/backup-<ts>.json 與 backup-out/latest.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createSign } from 'node:crypto';
import https from 'node:https';

const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || (process.env.RUNNER_TEMP + '/sa.json');
const SA = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const PROJECT = SA.project_id;
const COLLECTIONS = ['settings', 'templates', 'tasks', 'shifts'];

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function makeJwt(scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: SA.private_key_id };
  const payload = { iss: SA.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const enc = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const s = createSign('RSA-SHA256'); s.update(enc);
  return enc + '.' + b64url(s.sign(SA.private_key));
}
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
function decode(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) {
    const o = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = decode(x);
    return o;
  }
  return null;
}

async function getToken() {
  const jwt = makeJwt('https://www.googleapis.com/auth/datastore');
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await request({
    method: 'POST', hostname: 'oauth2.googleapis.com', path: '/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  if (res.status !== 200) throw new Error(`token ${res.status}: ${res.body}`);
  return JSON.parse(res.body).access_token;
}

async function listCollection(token, coll) {
  const out = {};
  let pageToken = null;
  do {
    let path = `/v1/projects/${PROJECT}/databases/(default)/documents/${coll}?pageSize=300`;
    if (pageToken) path += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await request({
      method: 'GET', hostname: 'firestore.googleapis.com', path,
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status !== 200) throw new Error(`${coll} ${res.status}: ${res.body}`);
    const data = JSON.parse(res.body);
    (data.documents || []).forEach(d => {
      const id = d.name.split('/').pop();
      const obj = {};
      for (const [k, v] of Object.entries(d.fields || {})) obj[k] = decode(v);
      out[id] = obj;
    });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function main() {
  console.log(`[backup] project: ${PROJECT}`);
  console.log('[backup] 取 access token…');
  const token = await getToken();
  console.log('[backup] ✓ token OK');

  const out = {
    version: 1,
    project: PROJECT,
    exportedAt: new Date().toISOString(),
    collections: {}
  };

  for (const coll of COLLECTIONS) {
    console.log(`[backup] 抓 ${coll}…`);
    out.collections[coll] = await listCollection(token, coll);
    console.log(`[backup]   ${coll}: ${Object.keys(out.collections[coll]).length} 筆`);
  }

  mkdirSync('backup-out', { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const filename = `backup-${ts}.json`;
  const json = JSON.stringify(out, null, 2);
  writeFileSync(`backup-out/${filename}`, json);
  writeFileSync('backup-out/latest.json', json);
  console.log(`[backup] ✓ 寫入 backup-out/${filename}（${(json.length / 1024).toFixed(1)} KB）`);
}

main().catch(err => {
  console.error('[backup] FAIL:', err);
  process.exit(1);
});

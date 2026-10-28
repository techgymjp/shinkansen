// GitHub Actions の iOS 自動アップロード用: App Store 配布用のプロビジョニングプロファイルを用意する。
// App Store Connect API で、登録した配布用証明書と Bundle ID の入ったプロファイルを探し、なければ作る。
// 必要な環境変数: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (.p8), CERT_SHA1 (キーチェーンに入れた証明書), BUNDLE_ID
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, CERT_SHA1, BUNDLE_ID } = process.env;
const PROFILE_NAME = `${BUNDLE_ID} App Store (GitHub Actions)`;
const API = 'https://api.appstoreconnect.apple.com';

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: fs.readFileSync(ASC_KEY_PATH), dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64url')}`;
}
const jwt = token();

async function api(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

const sha1 = (b64) => crypto.createHash('sha1').update(Buffer.from(b64, 'base64')).digest('hex').toUpperCase();

async function main() {
  const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=200`);
  const bundle = bundles.data.find((b) => b.attributes.identifier === BUNDLE_ID);
  if (!bundle) throw new Error(`Bundle ID ${BUNDLE_ID} が Apple Developer に登録されていません`);

  const certs = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200');
  const cert = certs.data.find((c) => sha1(c.attributes.certificateContent) === CERT_SHA1.toUpperCase());
  if (!cert) throw new Error('Secrets の配布用証明書 (.p12) が、このチームの有効な配布用証明書に見つかりません');

  // 前回作ったプロファイルが使えるならそれを使う (毎回作り直さない)
  let profile = null;
  const found = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&include=bundleId,certificates&limit=50`);
  for (const p of found.data) {
    const rel = p.relationships;
    const ok = p.attributes.profileState === 'ACTIVE'
      && rel.bundleId.data && rel.bundleId.data.id === bundle.id
      && rel.certificates.data.some((c) => c.id === cert.id);
    if (ok && !profile) profile = p;
    else await api('DELETE', `/v1/profiles/${p.id}`); // 期限切れや証明書の変わった古いもの
  }
  if (!profile) {
    profile = (await api('POST', '/v1/profiles', {
      data: {
        type: 'profiles',
        attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundle.id } },
          certificates: { data: [{ type: 'certificates', id: cert.id }] },
        },
      },
    })).data;
    console.log('created a new provisioning profile');
  } else {
    console.log('reusing the existing provisioning profile');
  }

  const { uuid, profileContent } = profile.attributes;
  // Xcode のバージョンによって探す場所が違うので両方に置く
  for (const dir of [
    path.join(os.homedir(), 'Library/MobileDevice/Provisioning Profiles'),
    path.join(os.homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${uuid}.mobileprovision`), Buffer.from(profileContent, 'base64'));
  }
  console.log(`profile uuid: ${uuid}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `uuid=${uuid}\n`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

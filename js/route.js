// 線路の中心線と沿線データへのアクセス
import { ROUTE } from './route-data.js';
import { TUNNELS, WATER, MOUNTAINS, TEA, VIADUCT, SNOW, BRIDGE_LEN, TRUSS_BRIDGES } from './scenery-data.js';

const XY = ROUTE.xy;
const STEP = ROUTE.stepM;
const N = XY.length / 2;

export const TOTAL_KM = ROUTE.totalKm;
export const STATIONS = ROUTE.stations;
export const LANDMARKS = ROUTE.landmarks;
export const SOURCE = ROUTE.source;

// 経路座標 (x: 東, y: 北) → three.js (x: 東, z: 南)
function raw(i) {
  i = Math.max(0, Math.min(N - 1, i));
  return [XY[i * 2], -XY[i * 2 + 1]];
}

// Catmull-Rom 補間で km 位置の座標と接線を返す
export function sample(km, out = {}) {
  const f = Math.max(0, Math.min((N - 1) - 1e-6, (km * 1000) / STEP));
  const i = Math.floor(f);
  const t = f - i;
  const p0 = raw(i - 1), p1 = raw(i), p2 = raw(i + 1), p3 = raw(i + 2);
  const t2 = t * t, t3 = t2 * t;
  const cr = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  const dcr = (a, b, c, d) =>
    0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
  out.x = cr(p0[0], p1[0], p2[0], p3[0]);
  out.z = cr(p0[1], p1[1], p2[1], p3[1]);
  let tx = dcr(p0[0], p1[0], p2[0], p3[0]);
  let tz = dcr(p0[1], p1[1], p2[1], p3[1]);
  const l = Math.hypot(tx, tz) || 1;
  out.tx = tx / l;
  out.tz = tz / l;
  // 進行方向左の法線 (y 上向き): left = up × forward
  out.lx = out.tz;
  out.lz = -out.tx;
  return out;
}

// 曲率 (1/m, 左カーブが正)
export function curvature(km) {
  const a = sample(km - 0.05), b = sample(km + 0.05);
  let d = Math.atan2(-b.tz, b.tx) - Math.atan2(-a.tz, a.tx);
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d / 100;
}

export function density(km) {
  const d = ROUTE.density;
  const f = Math.max(0, Math.min(d.length - 1.001, km * 2));
  const i = Math.floor(f);
  return d[i] + (d[i + 1] - d[i]) * (f - i);
}

function inRanges(ranges, km) {
  for (const r of ranges) if (km >= r[0] && km <= r[1]) return r;
  return null;
}

// 名前付きトンネル + 山間部の短いトンネル (決定的な乱数で生成)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { rng };

const ALL_TUNNELS = (() => {
  const list = TUNNELS.map(([a, b, name]) => ({ a, b, name }));
  const r = rng(20251018);
  // 山陽新幹線は約半分がトンネル。山地区間に無名の短いトンネルを補う
  for (let km = 560; km < 1060; km += 1) {
    if (density(km) > 4) continue;
    if (!inRanges(MOUNTAINS, km)) continue;
    if (r() < 0.22) {
      const len = 0.25 + r() * 1.4;
      const a = km, b = km + len;
      const clash = list.some((t) => a < t.b + 0.6 && b > t.a - 0.6) ||
        STATIONS.some((s) => Math.abs(s.km - a) < 1.5 || Math.abs(s.km - b) < 1.5);
      if (!clash) list.push({ a, b, name: null });
      km += len + 1;
    }
  }
  list.sort((p, q) => p.a - q.a);
  return list;
})();
export const TUNNEL_LIST = ALL_TUNNELS;

export function tunnelAt(km) {
  for (const t of ALL_TUNNELS) {
    if (t.a > km) return null;
    if (km <= t.b) return t;
  }
  return null;
}
export function tunnelsBetween(a, b) {
  return ALL_TUNNELS.filter((t) => t.b >= a && t.a <= b);
}

export function waterAt(km) { return inRanges(WATER, km); }
export function waterBetween(a, b) { return WATER.filter((w) => w[1] >= a && w[0] <= b); }
export function mountainSides(km) {
  let L = false, R = false;
  for (const m of MOUNTAINS) {
    if (km >= m[0] && km <= m[1]) {
      if (m[2] !== 'R') L = true;
      if (m[2] !== 'L') R = true;
    }
  }
  return { L, R };
}
export function isTea(km) { return !!inRanges(TEA, km); }
export function isSnow(km) { return !!inRanges(SNOW, km); }

export function nearStation(km, dist = 0.6) {
  for (const s of STATIONS) if (Math.abs(s.km - km) < dist) return s;
  return null;
}

// 線路の高さ (高架) : 市街地・駅付近・川の上は高架
const RIVERS = LANDMARKS.filter((l) => l.type === 'river').map((r) => ({
  ...r,
  len: BRIDGE_LEN[r.name] || 0.25,
  truss: TRUSS_BRIDGES.includes(r.name),
}));
export const RIVER_LIST = RIVERS;
// km 付近の川 (橋の両端から margin km 以内)
export function riverNear(km, margin = 0) {
  for (const r of RIVERS) if (Math.abs(r.km - km) < r.len / 2 + margin) return r;
  return null;
}
export function viaductLevel(km) {
  if (tunnelAt(km)) return 0;
  let h = 0;
  if (inRanges(VIADUCT, km)) h = 1;
  const d = density(km);
  if (d > 12) h = 1;
  else if (d > 6) h = Math.max(h, (d - 6) / 6);
  const s = nearStation(km, 1.2);
  if (s) h = Math.max(h, 1 - Math.max(0, Math.abs(s.km - km) - 0.6) / 0.6);
  const r = riverNear(km, 0.4);
  if (r) h = Math.max(h, 1 - Math.max(0, Math.abs(r.km - km) - r.len / 2) / 0.4);
  return Math.min(1, h);
}
export const VIADUCT_HEIGHT = 9;
export function trackHeight(km) {
  // 0.1km 刻みで平滑化してから返す
  const a = viaductLevel(Math.floor(km * 10) / 10);
  const b = viaductLevel(Math.floor(km * 10) / 10 + 0.1);
  const t = km * 10 - Math.floor(km * 10);
  const s = t * t * (3 - 2 * t);
  return (a + (b - a) * s) * VIADUCT_HEIGHT;
}

export function nextStation(km) {
  for (const s of STATIONS) if (s.km > km + 0.001) return s;
  return null;
}
export function prevStation(km) {
  let p = STATIONS[0];
  for (const s of STATIONS) if (s.km <= km) p = s;
  return p;
}

// ミニマップ用に間引いた座標
export function overview(step = 2) {
  const pts = [];
  for (let km = 0; km <= TOTAL_KM; km += step) {
    const p = sample(km);
    pts.push([p.x, p.z]);
  }
  return pts;
}

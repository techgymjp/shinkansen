// 沿線の3D世界 (チャンク単位で生成・破棄する)
import * as THREE from '../vendor/three.module.min.js';
import {
  sample, density, tunnelAt, tunnelsBetween, waterBetween, mountainSides, isTea, isSnow,
  STATIONS, LANDMARKS, RIVER_LIST, trackHeight, TOTAL_KM, rng,
} from './route.js';
import {
  makePagoda, makeTemple, makeCastle, makeKofun, makeFuji, makeMountain, makeTokyoTower,
  makeKyotoTower, makeHighrise, makeTorii, buildingTex, signTex, mat, canvasTex,
} from './models.js';

export const LANE_OFF = 2.15; // 複線の軌道中心間隔 4.3m の半分。下り線(左) = +, 上り線(右) = -
export const RAIL_Y = 0.35; // 路盤上面からレール面までの高さ
const CHUNK_KM = 0.5;
const AHEAD_KM = 7.5;
const BEHIND_KM = 1.0;

// ---------------- ジオメトリ補助 ----------------
// samples に沿って断面 section(s) を掃引する。color(s, k) で頂点色を指定可能
export function sweep(samples, section, base, color) {
  const pos = [], col = [], idx = [];
  let n = 0;
  const c = new THREE.Color();
  for (let j = 0; j < samples.length; j++) {
    const s = samples[j];
    const sec = section(s, j);
    n = sec.length;
    for (let k = 0; k < n; k++) {
      const [off, y] = sec[k];
      pos.push(s.x + s.lx * off - base.x, y, s.z + s.lz * off - base.z);
      if (color) {
        c.set(color(s, k, off, y));
        col.push(c.r, c.g, c.b);
      }
    }
  }
  for (let j = 0; j < samples.length - 1; j++) {
    for (let k = 0; k < n - 1; k++) {
      const a = j * n + k, b = a + n;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function samplesBetween(a, b, step) {
  const out = [];
  const n = Math.max(1, Math.ceil((b - a) / step));
  for (let i = 0; i <= n; i++) {
    const km = a + ((b - a) * i) / n;
    const s = sample(km);
    s.km = km;
    s.h = trackHeight(km);
    out.push(s);
  }
  return out;
}

// 簡易な非インデックスジオメトリ結合
function merge(geos) {
  const pos = [], nor = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _sc = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
function placeMatrix(x, y, z, yaw, sx = 1, sy = 1, sz = 1) {
  _q.setFromAxisAngle(_up, yaw);
  _v.set(x, y, z);
  _sc.set(sx, sy, sz);
  return _m.compose(_v, _q, _sc);
}
// 線路の向き (+Z を進行方向に合わせる回転角)
export function yawOf(s) { return Math.atan2(s.tx, s.tz); }

function instanced(geo, material, items, colorFn) {
  if (!items.length) return null;
  const im = new THREE.InstancedMesh(geo, material, items.length);
  const c = new THREE.Color();
  items.forEach((it, i) => {
    im.setMatrixAt(i, placeMatrix(it[0], it[1], it[2], it[3], it[4], it[5], it[6]));
    if (colorFn) { c.set(colorFn(i, it)); im.setColorAt(i, c); }
  });
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}

// ---------------- 共通アセット ----------------
const G = {};
function assets() {
  if (G.ready) return G;
  G.ready = true;
  G.ground = new THREE.MeshLambertMaterial({ vertexColors: true });
  const DS = { side: THREE.DoubleSide };
  G.concrete = mat(0xb9b6ae, DS);
  G.concreteDark = mat(0x8f8c86);
  G.slab = mat(0x7d7b77, DS);
  G.ballast = mat(0x7a7268, DS);
  G.rail = new THREE.MeshPhongMaterial({ color: 0xc9ccd0, shininess: 90, specular: 0xffffff, side: THREE.DoubleSide });
  G.pole = mat(0x9aa0a6);
  G.wire = new THREE.LineBasicMaterial({ color: 0x2b2b2b });
  G.tunnel = new THREE.MeshLambertMaterial({ color: 0x6b6862, side: THREE.DoubleSide });
  G.lamp = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  G.water = new THREE.MeshPhongMaterial({ color: 0x3f7fa8, shininess: 80, specular: 0x88aacc });
  G.sea = new THREE.MeshPhongMaterial({ color: 0x2f6e9e, shininess: 100, specular: 0x99bbdd });
  G.girder = mat(0x6f8f9b, DS);
  G.truss = mat(0x5f7f8a);
  G.platform = mat(0xd9d4c8, DS);
  G.roof = mat(0x6d7884, DS);
  G.white = mat(0xf2f2f2);
  G.boxGeo = new THREE.BoxGeometry(1, 1, 1);
  G.boxGeo0 = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // 底面原点
  const roofG = new THREE.CylinderGeometry(0.02, 0.75, 1, 4, 1);
  roofG.rotateY(Math.PI / 4);
  roofG.scale(1.25, 1, 0.85);
  roofG.translate(0, 0.5, 0);
  G.roofGeo = roofG;
  G.treeGeo = new THREE.IcosahedronGeometry(1, 0).translate(0, 1, 0);
  G.coneTreeGeo = new THREE.ConeGeometry(0.55, 2.4, 6).translate(0, 1.2, 0);
  G.treeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  G.houseMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  G.bldMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: buildingTex() });
  G.fieldGeo = new THREE.BoxGeometry(1, 0.15, 1).translate(0, 0.08, 0);
  G.fieldMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  G.teaGeo = new THREE.CylinderGeometry(0.7, 0.8, 1, 6, 1).rotateX(Math.PI / 2).translate(0, 0.45, 0);
  G.hillMat = new THREE.MeshLambertMaterial({ color: 0x46683f, flatShading: true });
  G.hillMatSnow = new THREE.MeshLambertMaterial({ color: 0xe8edf2, flatShading: true });
  // 架線柱 (左側用。右側は鏡像)
  const pole = new THREE.BoxGeometry(0.4, 8.5, 0.4).translate(0, 4.25, 0);
  const arm = new THREE.BoxGeometry(5.6, 0.25, 0.25).translate(-2.8, 7.6, 0);
  const brace = new THREE.BoxGeometry(0.15, 1.4, 0.15).translate(-1.2, 6.9, 0);
  G.poleGeoL = merge([pole, arm, brace]);
  G.poleGeoR = G.poleGeoL.clone().scale(-1, 1, 1);
  G.poleGeoR.computeVertexNormals();
  G.pierGeo = new THREE.BoxGeometry(5.5, 1, 1.8).translate(0, 0.5, 0);
  G.lampGeo = new THREE.BoxGeometry(0.15, 0.2, 0.7);
  return G;
}

// 山の裾野が線路にかからないか確かめる: 中心 (wx, wz) から線路中心線までの最短距離 (m)
// 置いた地点では離れていても、線路が曲がって先で山にぶつかることがあるため前後を広く調べる
export function trackClearance(wx, wz, kmCenter, spanKm) {
  let best = Infinity;
  const step = spanKm > 6 ? 0.2 : 0.1;
  for (let km = Math.max(0, kmCenter - spanKm); km <= Math.min(TOTAL_KM, kmCenter + spanKm); km += step) {
    const p = sample(km);
    const d = Math.hypot(p.x - wx, p.z - wz);
    if (d < best) best = d;
  }
  return best;
}
// 頂点のゆらぎ (最大 +12.5%) と線路脇の余裕を見込んだ必要距離
const MOUNTAIN_MARGIN = (R) => R * 1.15 + 80;

// ---------------- 地面の色 ----------------
const COL = {
  field: [0x6f9a45, 0x7aa64c, 0x86ad55, 0x93b05a],
  city: 0x9a9890,
  suburb: 0x86926a,
  water: 0x2f6e9e,
  snow: 0xe9eef3,
  sand: 0xcbbf9a,
};

function waterSideAt(waters, km, off) {
  for (const w of waters) {
    if (km < w[0] || km > w[1]) continue;
    if (w[2] === 'B' && Math.abs(off) >= 70) return true;
    if (w[2] === 'L' && off >= 85) return true;
    if (w[2] === 'R' && off <= -85) return true;
  }
  return false;
}

// 名所の配置 (小さな名所は車窓から見える距離に寄せる。左右は実際の位置を維持)
const SMALL_TYPES = new Set(['castle', 'pagoda', 'temple', 'kofun', 'tower', 'tower2']);
const FOOTPRINT = { castle: 90, pagoda: 45, temple: 70, kofun: 230, tower: 70, tower2: 60, highrise: 60 };
export const PLACED_LANDMARKS = LANDMARKS.filter((l) => l.type !== 'river' && l.type !== 'lake').map((l) => {
  let off = l.off;
  if (SMALL_TYPES.has(l.type)) {
    const sgn = off === 0 ? 1 : Math.sign(off);
    const minOff = l.type === 'kofun' ? 260 : 90;
    const maxOff = l.type === 'kofun' ? 650 : l.type === 'tower' ? 1400 : 600;
    off = sgn * Math.min(maxOff, Math.max(minOff, Math.abs(off)));
  }
  return { ...l, off, foot: FOOTPRINT[l.type] || 0 };
});

// トンネル上の尾根の形
// 断面: [左右位置 (尾根幅に対する割合, 左が正), 高さの割合]。中央付近 (±12m) は常に最高点
const RIDGE_PROFILE = [[-1, 0], [-0.7, 0.35], [-0.4, 0.72], [-0.15, 0.95], [-0.01, 1], [0.01, 1], [0.15, 0.95], [0.4, 0.72], [0.7, 0.35], [1, 0]];
function ridgeShape(u) {
  // 中心からの割合 u (0..1) での高さの割合 (RIDGE_PROFILE の右半分を補間)
  const pts = RIDGE_PROFILE.slice(5).map(([k, f]) => [Math.abs(k), f]);
  for (let i = 0; i < pts.length - 1; i++) {
    if (u <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (u - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
  }
  return 0;
}
// 尾根の高さ (m): 坑口で16m、中へ入るほど高くなり、ゆるやかに起伏する
function ridgeHeight(t, km) {
  const seed = (t.a * 997) % 1;
  const hMax = (t.b - t.a < 1.2 ? 45 : 90) + seed * 180;
  const dp = Math.min(km - t.a, t.b - km);
  const ramp = Math.min(1, Math.max(0, dp) / 0.35);
  const wave = 0.75 + 0.18 * Math.sin(km * 6.1 + seed * 20) + 0.07 * Math.sin(km * 17.3 + seed * 7);
  return 16 + (hMax * wave - 16) * ramp * ramp * (3 - 2 * ramp);
}
const ridgeWidth = (hs) => 110 + hs * 2.3;
// 左右で尾根の張り出しを変えて自然に見せる
function ridgeSkew(t, km, side) { return 0.8 + 0.35 * (0.5 + 0.5 * Math.sin(km * 3.7 + side * 2.1 + t.a)); }

// ---------------- チャンク生成 ----------------
function buildChunk(index) {
  assets();
  const a = index * CHUNK_KM;
  const b = Math.min(TOTAL_KM + 2, a + CHUNK_KM);
  const grp = new THREE.Group();
  const base = sample(a);
  const r = rng(index * 7919 + 13);
  const S = samplesBetween(a, b, 0.01);
  const tunnels = tunnelsBetween(a - 0.3, b + 0.3);
  const waters = waterBetween(a - 0.1, b + 0.1);
  const midKm = (a + b) / 2;
  const dens = density(midKm);
  const snow = isSnow(midKm);
  const inTunnel = (km) => tunnels.some((t) => km > t.a && km < t.b);
  const nearTunnel = (km, m) => tunnels.some((t) => km > t.a - m && km < t.b + m);
  const station = STATIONS.find((s) => s.km > a - 0.3 && s.km < b + 0.3);
  const river = RIVER_LIST.find((rv) => rv.km + rv.len / 2 > a - 0.05 && rv.km - rv.len / 2 < b + 0.05);
  const onRiver = (km) => river && Math.abs(km - river.km) < river.len / 2;
  const nearStationKm = (km, m) => STATIONS.some((s) => Math.abs(s.km - km) < m);

  // --- 地面 ---
  const OFFS = [-4000, -2200, -1200, -650, -350, -180, -90, -40, -14, 14, 40, 90, 180, 350, 650, 1200, 2200, 4000];
  const S25 = S.filter((_, j) => j % 5 === 0 || j === S.length - 1);
  // 線路の真下は路盤と重ならないよう少し下げる
  const groundGeo = sweep(S25, (s) => OFFS.map((o) => [o, waterSideAt(waters, s.km, o) ? -0.6 : Math.abs(o) <= 14 ? -0.15 : 0]), base, (s, k, off) => {
    if (waterSideAt(waters, s.km, off)) return COL.water;
    if (snow) return COL.snow;
    const d = density(s.km);
    const near = Math.abs(off) < 700;
    if (d > 14 && near) return COL.city;
    if (d > 6 && near) return COL.suburb;
    const h = Math.abs(Math.sin(s.km * 37.1 + off * 0.013)) * 4;
    return COL.field[Math.floor(h) % 4];
  });
  grp.add(new THREE.Mesh(groundGeo, G.ground));

  // 川 (橋の下の水面・河原・堤防)。ローカル座標の +Z が線路方向、X が川の流れ方向
  if (river) {
    const s0 = sample(river.km);
    const len = river.len * 1000;
    const holder = new THREE.Group();
    holder.position.set(s0.x - base.x, 0, s0.z - base.z);
    holder.rotation.y = yawOf(s0) + (r() - 0.5) * 0.3;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(9000, len * 0.8), G.water);
    w.rotation.x = -Math.PI / 2;
    w.position.y = 0.15;
    holder.add(w);
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(9000, len), mat(snow ? COL.snow : COL.sand));
    bank.rotation.x = -Math.PI / 2;
    bank.position.y = 0.08;
    holder.add(bank);
    for (const sgn of [-1, 1]) {
      const levee = new THREE.Mesh(new THREE.BoxGeometry(9000, 6, 16), mat(snow ? COL.snow : 0x6f9a45));
      levee.position.set(0, 2.4, sgn * (len / 2 + 8));
      holder.add(levee);
    }
    grp.add(holder);
  }

  // --- 路盤・高架 ---
  const deckTop = (s) => s.h;
  const deck = sweep(S, (s) => {
    const h = deckTop(s);
    const wide = station && Math.abs(s.km - station.km) < 0.25 ? 8.5 : 0;
    const halfW = 6 + wide;
    const bot = h > 1.6 ? h - 1.6 : -0.5;
    return [[halfW + 0.3, bot], [halfW + 0.3, h + 1.6], [halfW, h + 1.6], [halfW, h], [-halfW, h], [-halfW, h + 1.6], [-halfW - 0.3, h + 1.6], [-halfW - 0.3, bot]];
  }, base);
  grp.add(new THREE.Mesh(deck, G.concrete));
  // 盛土 (低いところ)
  const emb = sweep(S, (s) => {
    const h = s.h;
    const top = Math.min(h, 2.2) - 0.12;
    return [[6.3 + top * 1.6, -0.3], [6.3, top], [-6.3, top], [-6.3 - top * 1.6, -0.3]];
  }, base);
  grp.add(new THREE.Mesh(emb, snow ? mat(COL.snow, { side: THREE.DoubleSide }) : G.ballast));
  // 軌道スラブ
  for (const lane of [LANE_OFF, -LANE_OFF]) {
    const slab = sweep(S, (s) => [[lane + 1.4, s.h + 0.02], [lane + 1.3, s.h + 0.2], [lane - 1.3, s.h + 0.2], [lane - 1.4, s.h + 0.02]], base);
    grp.add(new THREE.Mesh(slab, G.slab));
    for (const g of [0.7175, -0.7175]) {
      const o = lane + g;
      const rail = sweep(S, (s) => [[o + 0.04, s.h + 0.2], [o + 0.035, s.h + RAIL_Y], [o - 0.035, s.h + RAIL_Y], [o - 0.04, s.h + 0.2]], base);
      grp.add(new THREE.Mesh(rail, G.rail));
    }
  }
  // 高架橋脚
  const piers = [];
  for (let j = 0; j < S.length; j += 3) {
    const s = S[j];
    if (s.h < 2.5 || inTunnel(s.km)) continue;
    const hgt = s.h - 1.5 + (onRiver(s.km) ? 0.6 : 0);
    piers.push([s.x - base.x, onRiver(s.km) ? -0.6 : 0, s.z - base.z, yawOf(s), onRiver(s.km) ? 1.3 : 1, hgt, onRiver(s.km) ? 2 : 1]);
  }
  const pi = instanced(G.pierGeo, G.concreteDark, piers);
  if (pi) grp.add(pi);

  // 橋梁の桁・トラス
  if (river) {
    const ra = Math.max(a, river.km - river.len / 2), rb = Math.min(b, river.km + river.len / 2);
    if (rb > ra) {
      const SB = samplesBetween(ra, rb, 0.01);
      for (const sgn of [1, -1]) {
        const gird = sweep(SB, (s) => [[sgn * 6.6, s.h - 2.6], [sgn * 6.6, s.h + 1.2], [sgn * 6.35, s.h + 1.2], [sgn * 6.35, s.h - 2.6]], base);
        grp.add(new THREE.Mesh(gird, G.girder));
        // 手すり
        const rail = sweep(SB, (s) => [[sgn * 6.5, s.h + 2.3], [sgn * 6.5, s.h + 2.45], [sgn * 6.4, s.h + 2.45]], base);
        grp.add(new THREE.Mesh(rail, G.girder));
      }
      if (river.truss) {
        // 下路ワーレントラス: 上弦材・斜材・横構
        const members = [];
        const panel = 0.012; // 12m 間隔
        let up = false;
        for (let km = ra; km < rb - 1e-6; km += panel) {
          const s0 = sample(km), s1 = sample(Math.min(rb, km + panel));
          const h = trackHeight(km);
          for (const sgn of [1, -1]) {
            const x0 = s0.x + s0.lx * sgn * 6.5 - base.x, z0 = s0.z + s0.lz * sgn * 6.5 - base.z;
            const x1 = s1.x + s1.lx * sgn * 6.5 - base.x, z1 = s1.z + s1.lz * sgn * 6.5 - base.z;
            const yaw = Math.atan2(x1 - x0, z1 - z0);
            const len = Math.hypot(x1 - x0, z1 - z0);
            // 斜材
            const tilt = Math.atan2(len, 11) * (up ? 1 : -1);
            members.push({ x: (x0 + x1) / 2, y: h + 1 + 5.5, z: (z0 + z1) / 2, yaw, tilt, l: Math.hypot(len, 11), w: 0.5 });
            // 上弦材
            members.push({ x: (x0 + x1) / 2, y: h + 12, z: (z0 + z1) / 2, yaw, tilt: Math.PI / 2, l: len, w: 0.7 });
          }
          // 上横構
          members.push({ x: s0.x - base.x, y: h + 12, z: s0.z - base.z, yaw: yawOf(s0) + Math.PI / 2, tilt: Math.PI / 2, l: 13, w: 0.4 });
          up = !up;
        }
        const im = new THREE.InstancedMesh(G.boxGeo, G.truss, members.length);
        const e = new THREE.Euler();
        members.forEach((mm, i) => {
          e.set(0, mm.yaw, 0, 'YXZ');
          _q.setFromEuler(e);
          const qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), mm.tilt);
          _q.multiply(qt);
          _v.set(mm.x, mm.y, mm.z);
          _sc.set(mm.w, mm.l, mm.w);
          im.setMatrixAt(i, _m.compose(_v, _q, _sc));
        });
        im.frustumCulled = false;
        grp.add(im);
      }
    }
  }

  // --- 架線柱・架線 ---
  const polesL = [], polesR = [];
  const wirePts = [];
  for (let j = 0; j < S.length; j++) {
    const s = S[j];
    const tun = inTunnel(s.km);
    if (j % 5 === 0 && !tun) {
      const yaw = yawOf(s);
      polesL.push([s.x + s.lx * 5.6 - base.x, s.h, s.z + s.lz * 5.6 - base.z, yaw]);
      polesR.push([s.x - s.lx * 5.6 - base.x, s.h, s.z - s.lz * 5.6 - base.z, yaw]);
    }
    if (j < S.length - 1) {
      const t = S[j + 1];
      for (const lane of [LANE_OFF, -LANE_OFF]) {
        for (const [dy, dd] of [[5.3, 0], [6.6, 0.0]]) {
          wirePts.push(s.x + s.lx * (lane + dd) - base.x, s.h + RAIL_Y + dy, s.z + s.lz * (lane + dd) - base.z);
          wirePts.push(t.x + t.lx * (lane + dd) - base.x, t.h + RAIL_Y + dy, t.z + t.lz * (lane + dd) - base.z);
        }
      }
    }
  }
  const pl = instanced(G.poleGeoL, G.pole, polesL); if (pl) grp.add(pl);
  const pr = instanced(G.poleGeoR, G.pole, polesR); if (pr) grp.add(pr);
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  grp.add(new THREE.LineSegments(wg, G.wire));

  // --- トンネル ---
  for (const t of tunnels) {
    const ta = Math.max(a, t.a), tb = Math.min(b, t.b);
    if (tb > ta) {
      const ST = samplesBetween(ta, tb, 0.02);
      const arc = [];
      arc.push([5.8, 0.03], [6.8, 0.03]);
      for (let k = 0; k <= 12; k++) {
        const th = (k / 12) * Math.PI;
        arc.push([Math.cos(th) * 6.8, 2.2 + Math.sin(th) * 6.6]);
      }
      arc.push([-6.8, 0.03], [-5.8, 0.03]);
      grp.add(new THREE.Mesh(sweep(ST, (s) => arc.map(([o, y]) => [o, y + s.h]), base), G.tunnel));
      const lamps = [];
      for (let km = Math.ceil(ta / 0.04) * 0.04; km < tb; km += 0.04) {
        const s = sample(km);
        for (const sgn of [1, -1]) lamps.push([s.x + s.lx * sgn * 6.3 - base.x, trackHeight(km) + 3.6, s.z + s.lz * sgn * 6.3 - base.z, yawOf(s)]);
      }
      const li = instanced(G.lampGeo, G.lamp, lamps);
      if (li) grp.add(li);
    }
    // 坑口と山
    for (const [pk, dir] of [[t.a, 1], [t.b, -1]]) {
      if (pk < a || pk >= b) continue;
      const s = sample(pk);
      const yaw = yawOf(s);
      const portal = new THREE.Group();
      const pm = G.concrete;
      const left = new THREE.Mesh(new THREE.BoxGeometry(10, 16, 2), pm); left.position.set(11.8, 8, 0);
      const right = new THREE.Mesh(new THREE.BoxGeometry(10, 16, 2), pm); right.position.set(-11.8, 8, 0);
      const top = new THREE.Mesh(new THREE.BoxGeometry(33.6, 7.2, 2), pm); top.position.set(0, 12.4, 0);
      portal.add(left, right, top);
      // 緩衝工 (フード)
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 18, 16, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshLambertMaterial({ color: 0xa8a59e, side: THREE.DoubleSide }));
      hood.rotation.x = -Math.PI / 2;
      hood.position.set(0, 2.2, -9);
      portal.add(hood);
      portal.position.set(s.x - base.x, s.h, s.z - base.z);
      portal.rotation.y = yaw + (dir === 1 ? 0 : Math.PI);
      grp.add(portal);
    }
  }
  // トンネルを覆う山: 線路に沿って断面を掃引した尾根。トンネルの上は常に16m以上の高さを保つ
  // (円錐の山だと、裾野がトンネル内の線路にかかって山肌がトンネルを突き抜けて見えるため)
  for (const t of tunnels) {
    const ta = Math.max(a, t.a), tb = Math.min(b, t.b);
    if (tb > ta) {
      const SR = samplesBetween(ta, tb, 0.025);
      const offsK = RIDGE_PROFILE.map(([k]) => k);
      grp.add(new THREE.Mesh(sweep(SR, (s) => {
        const hs = ridgeHeight(t, s.km);
        const w = ridgeWidth(hs);
        return RIDGE_PROFILE.map(([k, f], idx) => {
          const side = k < 0 ? -1 : 1;
          const off = Math.abs(k) < 0.05 ? side * 12 : k * w * ridgeSkew(t, s.km, side);
          return [off, hs * f * (idx === 0 || idx === offsK.length - 1 ? 0 : 1) - 0.3];
        });
      }, base), snow ? G.hillMatSnow : G.hillMat));
      // 尾根の木
      const trees = [];
      const n = Math.round((tb - ta) * 140);
      for (let i = 0; i < n; i++) {
        const km = ta + r() * (tb - ta);
        const hs = ridgeHeight(t, km), w = ridgeWidth(hs);
        const side = r() < 0.5 ? -1 : 1;
        const u = 0.08 + r() * 0.8; // 尾根の中心からの割合
        const off = side * u * w * ridgeSkew(t, km, side);
        const y = hs * ridgeShape(u) - 0.8;
        const ps = sample(km);
        const sc = 5 + r() * 4;
        trees.push([ps.x + ps.lx * off - base.x, y, ps.z + ps.lz * off - base.z, 0, sc, sc * 1.2, sc]);
      }
      const ti = instanced(G.treeGeo, G.treeMat, trees, () => (snow ? 0xdfe6ea : 0x2e5527));
      if (ti) grp.add(ti);
    }
    // 坑口側の断面をふさぐ (トンネルの口の形に穴をあける)
    for (const [pk, dir] of [[t.a, 1], [t.b, -1]]) {
      if (pk < a || pk >= b) continue;
      const hs = ridgeHeight(t, pk);
      const w = ridgeWidth(hs);
      const shape = new THREE.Shape();
      RIDGE_PROFILE.forEach(([k, f], idx) => {
        const side = k < 0 ? -1 : 1;
        const off = Math.abs(k) < 0.05 ? side * 12 : k * w * ridgeSkew(t, pk, side);
        const y = idx === 0 || idx === RIDGE_PROFILE.length - 1 ? -0.3 : hs * f - 0.3;
        if (idx === 0) shape.moveTo(off, y); else shape.lineTo(off, y);
      });
      shape.closePath();
      const hole = new THREE.Path();
      hole.moveTo(6.8, -0.3);
      for (let k = 0; k <= 12; k++) {
        const th = (k / 12) * Math.PI;
        hole.lineTo(Math.cos(th) * 6.8, 2.2 + Math.sin(th) * 6.6);
      }
      hole.lineTo(-6.8, -0.3);
      hole.closePath();
      shape.holes.push(hole);
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: snow ? 0xe8edf2 : 0x46683f, side: THREE.DoubleSide }));
      const s = sample(pk);
      cap.position.set(s.x - base.x, 0, s.z - base.z);
      // シェイプの +x は回転後に線路の左方向 (off の正の向き) になる
      cap.rotation.y = yawOf(s);
      grp.add(cap);
    }
  }

  // --- 駅 ---
  if (station) {
    const pa = Math.max(a, station.km - 0.205), pb = Math.min(b, station.km + 0.205);
    if (pb > pa) {
      const SP = samplesBetween(pa, pb, 0.01);
      for (const sgn of [1, -1]) {
        // 待避線
        const po = sgn * 7.0;
        for (const g of [0.7175, -0.7175]) {
          grp.add(new THREE.Mesh(sweep(SP, (s) => [[po + g + 0.04, s.h + 0.2], [po + g, s.h + RAIL_Y], [po + g - 0.04, s.h + 0.2]], base), G.rail));
        }
        // ホーム
        grp.add(new THREE.Mesh(sweep(SP, (s) => [[sgn * 9.0, -0.3], [sgn * 9.0, s.h + 1.25], [sgn * 14.5, s.h + 1.25], [sgn * 14.5, -0.3]], base), G.platform));
        // 黄色い点字ブロック
        grp.add(new THREE.Mesh(sweep(SP, (s) => [[sgn * 9.6, s.h + 1.27], [sgn * 10.0, s.h + 1.27]], base), mat(0xf2c200, { side: THREE.DoubleSide })));
        // 屋根
        grp.add(new THREE.Mesh(sweep(SP, (s) => [[sgn * 8.6, s.h + 6.0], [sgn * 11.5, s.h + 6.8], [sgn * 15.0, s.h + 6.0]], base), G.roof));
        // 柱・駅名標
        const cols = [];
        for (let j = 0; j < SP.length; j += 2) {
          const s = SP[j];
          cols.push([s.x + s.lx * sgn * 12 - base.x, s.h + 1.25, s.z + s.lz * sgn * 12 - base.z, yawOf(s), 0.4, 5.2, 0.4]);
        }
        const ci = instanced(G.boxGeo0, G.white, cols); if (ci) grp.add(ci);
        const tex = signTex(station.name, station.kana + '  ' + station.en);
        for (let j = 3; j < SP.length; j += 9) {
          const s = SP[j];
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
          sign.position.set(s.x + s.lx * sgn * 9.6 - base.x, s.h + 3.6, s.z + s.lz * sgn * 9.6 - base.z);
          sign.rotation.y = yawOf(s) - Math.PI / 2 * sgn;
          grp.add(sign);
        }
      }
      // 駅ビル
      const sc = sample(station.km);
      if (station.km >= a && station.km < b) {
        const big = density(station.km) > 12;
        const bh = big ? 30 + r() * 40 : 14;
        const bld = new THREE.Mesh(G.boxGeo0, G.bldMat);
        bld.scale.set(40, bh, big ? 160 : 80);
        bld.position.set(sc.x - sc.lx * 34 - base.x, 0, sc.z - sc.lz * 34 - base.z);
        bld.rotation.y = yawOf(sc);
        grp.add(bld);
      }
    }
  }

  // --- 沿線の建物・田畑・木 ---
  const houses = [], roofs = [], blds = [], fields = [], trees = [], tea = [];
  const lms = PLACED_LANDMARKS.filter((l) => l.foot && Math.abs(l.km - midKm) < 1);
  const tooClose = (km, off) => {
    if (Math.abs(off) < 16) return true;
    for (const l of lms) if (Math.abs((km - l.km) * 1000) < l.foot && Math.abs(off - l.off) < l.foot) return true;
    if (nearStationKm(km, 0.3) && Math.abs(off) < 40) return true;
    if (river && Math.abs(km - river.km) < river.len / 2 + 0.08) return true;
    if (nearTunnel(km, 0.45)) return true;
    return waterSideAt(waters, km, off);
  };
  // 名所と線路の間に高い建物を建てない
  const blocksView = (km, off) => {
    for (const l of lms) {
      if (Math.abs(km - l.km) < 0.45 && Math.sign(off) === Math.sign(l.off) && Math.abs(off) < Math.abs(l.off) + l.foot) return true;
    }
    return false;
  };
  const putAt = (km, off) => {
    const s = sample(km);
    return [s.x + s.lx * off - base.x, s.z + s.lz * off - base.z, yawOf(s)];
  };
  const nHouse = Math.min(320, Math.round(8 + dens * 14));
  for (let i = 0; i < nHouse; i++) {
    const km = a + r() * CHUNK_KM;
    const side = r() < 0.5 ? 1 : -1;
    const off = side * (18 + r() ** 1.6 * (dens > 10 ? 900 : 450));
    if (tooClose(km, off)) continue;
    const [x, z, yaw] = putAt(km, off);
    const w = 7 + r() * 5, d = 7 + r() * 4, h = 5 + r() * 2.5;
    houses.push([x, 0, z, yaw + (r() < 0.3 ? Math.PI / 2 : 0), w, h, d]);
    roofs.push([x, h, z, houses[houses.length - 1][3], w, 2.4 + r(), d]);
  }
  const localDens = dens + (station ? Math.min(10, dens * 0.6) : 0);
  if (localDens > 7) {
    const nB = Math.min(220, Math.round((localDens - 7) * 9));
    for (let i = 0; i < nB; i++) {
      const km = a + r() * CHUNK_KM;
      const side = r() < 0.5 ? 1 : -1;
      const off = side * (22 + r() ** 1.3 * 1100);
      if (tooClose(km, off) || blocksView(km, off)) continue;
      const [x, z, yaw] = putAt(km, off);
      let h = 10 + r() ** 2.2 * (localDens * 4 + (station && Math.abs(km - station.km) < 0.6 ? 90 : 10));
      if (km > 470 && km < 483) h = Math.min(h, 31); // 京都市の高さ規制
      blds.push([x, 0, z, yaw, 14 + r() * 26, h, 14 + r() * 26]);
    }
  }
  const teaZone = isTea(midKm);
  if (dens < 12 && !snow) {
    for (let side of [1, -1]) {
      for (let km = a; km < b; km += 0.045) {
        for (let o = 20; o < 420; o += 35 + r() * 15) {
          const off = side * o;
          if (tooClose(km, off) || r() < 0.18) continue;
          const [x, z, yaw] = putAt(km + 0.02, off + side * 15);
          if (teaZone && r() < 0.7) {
            for (let k = 0; k < 5; k++) {
              const [tx, tz] = putAt(km + 0.02, off + side * (k * 4));
              tea.push([tx, 0, tz, yaw, 1.0, 1, 34]);
            }
          } else {
            fields.push([x, 0, z, yaw + (r() - 0.5) * 0.08, 30 + r() * 10, 1, 38 + r() * 6]);
          }
        }
      }
    }
  }
  const nTree = 70 + Math.round((20 - Math.min(dens, 20)) * 6);
  for (let i = 0; i < nTree; i++) {
    const km = a + r() * CHUNK_KM;
    const side = r() < 0.5 ? 1 : -1;
    const off = side * (16 + r() ** 1.2 * 1500);
    if (tooClose(km, off)) continue;
    const [x, z] = putAt(km, off);
    const sc = 2.5 + r() * 2.5;
    trees.push([x, 0, z, r() * 6, sc, sc * (1 + r() * 0.5), sc]);
  }
  // 鎮守の森 (林のかたまり)
  if (r() < 0.5) {
    const km0 = a + r() * CHUNK_KM, off0 = (r() < 0.5 ? 1 : -1) * (60 + r() * 500);
    if (!tooClose(km0, off0)) {
      for (let i = 0; i < 25; i++) {
        const [x, z] = putAt(km0 + (r() - 0.5) * 0.06, off0 + (r() - 0.5) * 50);
        const sc = 4 + r() * 3;
        trees.push([x, 0, z, 0, sc, sc * 1.4, sc]);
      }
      if (r() < 0.6) {
        const tor = makeTorii(1);
        const [x, z, yaw] = putAt(km0, off0 - Math.sign(off0) * 30);
        tor.position.set(x, 0, z);
        tor.rotation.y = yaw + Math.PI / 2;
        grp.add(tor);
      }
    }
  }
  const houseColors = [0xf1ece0, 0xe6e1d6, 0xd9d2c3, 0xf6f4ef, 0xc9c1b0, 0xe0d7c6];
  const roofColors = [0x3b4249, 0x2f3540, 0x5a4a3c, 0x46566a, 0x6b3a2e, 0x55595e];
  const hi = instanced(G.boxGeo0, G.houseMat, houses, () => houseColors[Math.floor(r() * houseColors.length)]); if (hi) grp.add(hi);
  const ro = instanced(G.roofGeo, G.houseMat, roofs, () => roofColors[Math.floor(r() * roofColors.length)]); if (ro) grp.add(ro);
  const bi = instanced(G.boxGeo0, G.bldMat, blds, () => [0xd8dadf, 0xc8c3b8, 0xb5bcc6, 0xe3e1da, 0xa9a59c][Math.floor(r() * 5)]); if (bi) grp.add(bi);
  const fieldCols = snow ? [0xe9eef3] : [0x5f9a3a, 0x6aa443, 0x7cad4a, 0x8fb653, 0xb9b45a, 0xc9b766, 0x7a6a4a, 0x5a8f6a];
  const fi = instanced(G.fieldGeo, G.fieldMat, fields, () => fieldCols[Math.floor(r() * fieldCols.length)]); if (fi) grp.add(fi);
  const te = instanced(G.teaGeo, G.fieldMat, tea, () => 0x2f6a2a); if (te) grp.add(te);
  const tr = instanced(r() < 0.5 ? G.treeGeo : G.coneTreeGeo, G.treeMat, trees, () => (snow ? 0xd8e0e4 : [0x2e5a2a, 0x3a6b30, 0x2a4f26, 0x47703a][Math.floor(r() * 4)])); if (tr) grp.add(tr);

  // --- 寺・古墳 (地域の特徴に合わせてランダム配置) ---
  const placeFeature = (obj, minOff, maxOff, footprint) => {
    for (let tries = 0; tries < 6; tries++) {
      const km = a + 0.05 + r() * (CHUNK_KM - 0.1);
      const side = r() < 0.5 ? 1 : -1;
      const off = side * (minOff + r() * (maxOff - minOff));
      if (tooClose(km, off) || tooClose(km, off - side * footprint)) continue;
      const [x, z, yaw] = putAt(km, off);
      obj.position.set(x, 0, z);
      obj.rotation.y = yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.6;
      grp.add(obj);
      return true;
    }
    return false;
  };
  if (dens > 3 && r() < 0.16) placeFeature(makeTemple(0.8 + r() * 0.5), 60, 500, 30);
  if (dens > 6 && r() < 0.04) placeFeature(makePagoda(30 + r() * 15), 100, 600, 15);
  const kofunRegion = (midKm > 440 && midKm < 530) || (midKm > 640 && midKm < 700) || (midKm > 1035 && midKm < 1062) || (midKm > 360 && midKm < 380);
  if (kofunRegion && r() < 0.22) placeFeature(makeKofun(60 + r() * 110), 120, 700, 90);

  // --- 近景の山並み ---
  const ms = mountainSides(midKm);
  for (const [flag, side] of [[ms.L, 1], [ms.R, -1]]) {
    if (!flag) continue;
    for (let i = 0; i < 2; i++) {
      const H = 120 + r() * 380;
      const R = H * (2 + r());
      const off = side * (R + 120 + r() * 900);
      const km = a + r() * CHUNK_KM;
      if (waterSideAt(waters, km, off)) continue;
      const [x, z] = putAt(km, off);
      if (trackClearance(x + base.x, z + base.z, km, ((Math.abs(off) + R * 1.2) / 1000) * 2 + 2) < MOUNTAIN_MARGIN(R)) continue;
      const m = makeMountain(H, R, index * 31 + i, snow ? 0xdde4ea : 0x45663d);
      m.position.set(x, -2, z);
      grp.add(m);
    }
  }

  grp.userData.base = base;
  return grp;
}

// ---------------- 遠景・名所 ----------------
function buildFar(index) {
  // 5km 単位の遠景の山並み
  const grp = new THREE.Group();
  const a = index * 5;
  const base = sample(a);
  const r = rng(index * 104729 + 7);
  const waters = waterBetween(a - 1, a + 6);
  // 関東平野・濃尾平野・大阪平野の中心部では遠くの山を減らす
  const plain = (a < 45) || (a > 300 && a < 370) || (a > 495 && a < 530);
  for (let i = 0; i < (plain ? 1 : 6); i++) {
    const km = a + r() * 5;
    const side = r() < 0.5 ? 1 : -1;
    const dist = 7000 + r() * 9000;
    if (side < 0 && km > 95 && km < 165) continue; // 富士山の方角は空けておく
    if (waters.some((w) => w[2] === 'B' || (w[2] === 'L' && side > 0) || (w[2] === 'R' && side < 0))) continue;
    const s = sample(km);
    const H = 300 + r() * 900;
    const R = H * (3 + r() * 2);
    const wx = s.x + s.lx * side * dist, wz = s.z + s.lz * side * dist;
    if (trackClearance(wx, wz, km, ((dist + R * 1.2) / 1000) * 2 + 2) < MOUNTAIN_MARGIN(R)) continue;
    const m = makeMountain(H, R, index * 7 + i, 0x5b7360);
    m.position.set(s.x + s.lx * side * dist - base.x, -5, s.z + s.lz * side * dist - base.z);
    grp.add(m);
  }
  grp.userData.base = base;
  return grp;
}

function landmarkObject(l) {
  switch (l.type) {
    case 'fuji': return { obj: makeFuji(), range: [130, 60] };
    case 'mountain': {
      const big = l.name.includes('伊吹') ? 1377 : l.name.includes('箱根') ? 1438 : l.name.includes('愛鷹') ? 850 : 432;
      return { obj: makeMountain(big, big * 3.2, l.km * 10, 0x4f6a52, false), range: [45, 20] };
    }
    case 'mountaincastle': {
      const g = new THREE.Group();
      g.add(makeMountain(329, 1100, 77, 0x3f5f3a));
      const c = makeCastle(3);
      c.position.y = 300;
      g.add(c);
      return { obj: g, range: [25, 10] };
    }
    case 'castle': return { obj: makeCastle(l.name.includes('姫路') ? 2.0 : 1.3, l.name.includes('岡山')), range: [9, 3] };
    case 'pagoda': return { obj: makePagoda(l.name.includes('東寺') ? 55 : 34), range: [8, 3] };
    case 'temple': return { obj: makeTemple(1.4), range: [7, 3] };
    case 'kofun': return { obj: makeKofun(l.name.includes('造山') ? 350 : l.name.includes('今城塚') ? 190 : l.name.includes('両宮山') ? 206 : l.name.includes('作山') ? 286 : l.name.includes('太田茶臼山') ? 226 : 150), range: [7, 3] };
    case 'tower': return { obj: makeTokyoTower(), range: [12, 4] };
    case 'tower2': return { obj: makeKyotoTower(), range: [8, 3] };
    case 'highrise': return { obj: makeHighrise(296), range: [20, 8] };
    default: return null;
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.origin = new THREE.Vector3();
    this.chunks = new Map();
    this.far = new Map();
    this.landmarks = PLACED_LANDMARKS.map((l) => ({ ...l, obj: null }));
  }

  setOrigin(x, z) {
    this.origin.set(x, 0, z);
    for (const g of this.chunks.values()) this._position(g);
    for (const g of this.far.values()) this._position(g);
    for (const l of this.landmarks) if (l.obj) this._placeLandmark(l);
  }

  _position(g) {
    const b = g.userData.base;
    g.position.set(b.x - this.origin.x, 0, b.z - this.origin.z);
  }

  // 山の名所が線路にかかる場合は縮小する (0 なら置かない)
  _landmarkFit(l) {
    const R = l.type === 'fuji' ? 19400 : l.type === 'mountaincastle' ? 1100
      : l.type === 'mountain' ? (l.name.includes('伊吹') ? 1377 : l.name.includes('箱根') ? 1438 : l.name.includes('愛鷹') ? 850 : 432) * 3.2 : 0;
    if (!R) return 1;
    const s = sample(l.km);
    const d = trackClearance(s.x + s.lx * l.off, s.z + s.lz * l.off, l.km, ((Math.abs(l.off) + R) / 1000) * 2 + 2);
    const need = MOUNTAIN_MARGIN(R);
    if (d >= need) return 1;
    const f = (d - 80) / (R * 1.15);
    return f < 0.25 ? 0 : f;
  }

  _placeLandmark(l) {
    const s = sample(l.km);
    l.obj.position.set(s.x + s.lx * l.off - this.origin.x, l.type === 'kofun' ? 0 : 0, s.z + s.lz * l.off - this.origin.z);
  }

  // km: プレイヤー位置。maxBuild: 1フレームで生成するチャンク数
  update(km, maxBuild = 1) {
    const i0 = Math.floor((km - BEHIND_KM) / CHUNK_KM);
    const i1 = Math.floor((km + AHEAD_KM) / CHUNK_KM);
    for (const [i, g] of this.chunks) {
      if (i < i0 - 1 || i > i1 + 1) {
        this.scene.remove(g);
        disposeTree(g);
        this.chunks.delete(i);
      }
    }
    let built = 0;
    for (let i = Math.max(0, Math.floor(km / CHUNK_KM)); i <= i1 && built < maxBuild; i++) {
      if (!this.chunks.has(i) && i * CHUNK_KM <= TOTAL_KM + 1) {
        const g = buildChunk(i);
        this._position(g);
        this.scene.add(g);
        this.chunks.set(i, g);
        built++;
      }
    }
    for (let i = Math.max(0, i0); i < Math.floor(km / CHUNK_KM) && built < maxBuild; i++) {
      if (!this.chunks.has(i)) {
        const g = buildChunk(i);
        this._position(g);
        this.scene.add(g);
        this.chunks.set(i, g);
        built++;
      }
    }
    // 遠景
    const f0 = Math.floor((km - 10) / 5), f1 = Math.floor((km + 25) / 5);
    for (const [i, g] of this.far) {
      if (i < f0 || i > f1) { this.scene.remove(g); disposeTree(g); this.far.delete(i); }
    }
    for (let i = Math.max(0, f0); i <= f1; i++) {
      if (!this.far.has(i) && i * 5 <= TOTAL_KM) {
        const g = buildFar(i);
        this._position(g);
        this.scene.add(g);
        this.far.set(i, g);
        break;
      }
    }
    // 名所
    for (const l of this.landmarks) {
      if (!l.range) {
        const def = landmarkObject(l);
        l.range = def ? def.range : [0, 0];
        if (def) disposeTree(def.obj);
      }
      const visible = km > l.km - l.range[0] && km < l.km + l.range[1];
      if (visible && !l.obj && l.fit === undefined) l.fit = this._landmarkFit(l);
      if (visible && !l.obj && l.fit > 0) {
        const def = landmarkObject(l);
        l.obj = def.obj;
        if (l.fit < 1) l.obj.scale.setScalar(l.fit);
        const s = sample(l.km);
        l.obj.rotation.y = yawOf(s) + (l.off > 0 ? -Math.PI / 2 : Math.PI / 2);
        this._placeLandmark(l);
        this.scene.add(l.obj);
      } else if (!visible && l.obj) {
        this.scene.remove(l.obj);
        disposeTree(l.obj);
        l.obj = null;
      }
    }
  }

  ready(km) {
    const i1 = Math.floor((km + AHEAD_KM) / CHUNK_KM);
    for (let i = Math.max(0, Math.floor((km - BEHIND_KM) / CHUNK_KM)); i <= i1; i++) {
      if (!this.chunks.has(i) && i * CHUNK_KM <= TOTAL_KM + 1) return false;
    }
    return true;
  }

  clear() {
    for (const g of this.chunks.values()) { this.scene.remove(g); disposeTree(g); }
    for (const g of this.far.values()) { this.scene.remove(g); disposeTree(g); }
    for (const l of this.landmarks) if (l.obj) { this.scene.remove(l.obj); disposeTree(l.obj); l.obj = null; }
    this.chunks.clear();
    this.far.clear();
  }
}

const shared = new Set();
function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !isShared(o.geometry)) o.geometry.dispose();
    if (o.isInstancedMesh) o.dispose();
  });
}
function isShared(g) {
  if (!shared.size && G.ready) {
    for (const k of Object.keys(G)) if (G[k] && G[k].isBufferGeometry) shared.add(G[k]);
  }
  return shared.has(g);
}
export { buildChunk, buildFar };

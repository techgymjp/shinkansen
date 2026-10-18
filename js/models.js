// 列車・建物・名所などの3Dモデル (すべてプロシージャル生成)
import * as THREE from '../vendor/three.module.min.js';

const texCache = new Map();
function canvasTex(key, w, h, draw, opts = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  texCache.set(key, t);
  return t;
}
export { canvasTex };

// ---------- 新幹線 (N700系風) ----------
export const CAR_LEN = 25;
export const NOSE_LEN = 10.5;
const CAR_W = 3.38;
const CAR_H = 3.6;
const CAR_BOTTOM = 0.55;

function carTexture(lead) {
  return canvasTex('car' + (lead ? 'L' : 'M'), 1024, 160, (g, w, h) => {
    const y = (m) => h - (m / (CAR_H + 0.2)) * h; // 高さ(m) → px
    g.fillStyle = '#f3f5f7';
    g.fillRect(0, 0, w, h);
    // 窓帯の下の青帯
    g.fillStyle = '#0b3c9c';
    g.fillRect(0, y(1.55), w, y(1.25) - y(1.55));
    g.fillStyle = '#1d5fd1';
    g.fillRect(0, y(1.12), w, y(1.04) - y(1.12));
    // 床下
    g.fillStyle = '#9aa3ab';
    g.fillRect(0, y(0.35), w, h - y(0.35));
    const px = (m) => (m / CAR_LEN) * w;
    const start = lead ? NOSE_LEN + 2.5 : 2.2;
    // 客室窓
    g.fillStyle = '#1b2330';
    for (let m = start; m < CAR_LEN - 2.5; m += 1.04) {
      g.fillRect(px(m), y(2.75), px(0.66), y(2.05) - y(2.75));
    }
    // ドア
    g.strokeStyle = '#b9c0c8';
    g.lineWidth = 2;
    for (const m of [lead ? NOSE_LEN + 0.6 : 0.6, CAR_LEN - 1.6]) {
      g.strokeRect(px(m), y(3.0), px(0.95), y(0.7) - y(3.0));
    }
    if (lead) {
      // 運転台窓
      g.fillStyle = '#0d141c';
      g.beginPath();
      g.moveTo(px(4.2), y(2.2));
      g.lineTo(px(8.6), y(3.25));
      g.lineTo(px(9.8), y(3.2));
      g.lineTo(px(9.6), y(2.2));
      g.closePath();
      g.fill();
    }
  });
}

// 断面 (スーパー楕円) を長手方向に掃引して車体を作る。
// 車体の前方は +Z。lead=true のとき前端が流線形のノーズになる。
function carGeometry(lead) {
  const ringN = 28;
  const zs = [];
  if (lead) {
    for (let i = 0; i <= 18; i++) zs.push(CAR_LEN / 2 - NOSE_LEN + (NOSE_LEN * i) / 18);
  }
  const bodyEnd = lead ? CAR_LEN / 2 - NOSE_LEN : CAR_LEN / 2;
  const bodyZs = [-CAR_LEN / 2, -CAR_LEN / 2 + 0.4, bodyEnd - 0.4, bodyEnd];
  const all = [...bodyZs, ...zs.slice(1)];
  const pos = [], uv = [], idx = [];
  for (let r = 0; r < all.length; r++) {
    const z = all[r];
    let hw = CAR_W / 2, top = CAR_H, bottom = CAR_BOTTOM, n = 5;
    if (z < -CAR_LEN / 2 + 0.4 || (!lead && z > CAR_LEN / 2 - 0.4)) { hw *= 0.96; top -= 0.08; }
    if (lead && z > bodyEnd) {
      const u = (z - bodyEnd) / NOSE_LEN; // 0..1
      hw = (CAR_W / 2) * Math.sqrt(Math.max(0.02, 1 - u ** 2.4)) * (1 - 0.15 * u);
      top = bottom + (CAR_H - bottom) * Math.max(0.12, 1 - u ** 0.85 * 0.88);
      if (u > 0.98) { hw *= 0.6; top = bottom + 0.55; }
      n = 3.2;
    }
    const cy = (top + bottom) / 2, hh = (top - bottom) / 2;
    for (let k = 0; k <= ringN; k++) {
      const a = (k / ringN) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const x = hw * Math.sign(c) * Math.abs(c) ** (2 / n);
      const y = cy + hh * Math.sign(s) * Math.abs(s) ** (2 / (s < 0 ? 8 : n));
      pos.push(x, y, z);
      uv.push((CAR_LEN / 2 - z) / CAR_LEN, y / (CAR_H + 0.2));
    }
  }
  for (let r = 0; r < all.length - 1; r++) {
    for (let k = 0; k < ringN; k++) {
      const a = r * (ringN + 1) + k, b = a + ringN + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // 端面をふさぐ
  const cap = (r, flip) => {
    const center = pos.length / 3;
    const z = all[r];
    pos.push(0, (CAR_H + CAR_BOTTOM) / 2, z);
    uv.push(0.5, 0.5);
    for (let k = 0; k < ringN; k++) {
      const a = r * (ringN + 1) + k;
      if (flip) idx.push(center, a + 1, a); else idx.push(center, a, a + 1);
    }
  };
  cap(0, false);
  cap(all.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let carGeoLead, carGeoMid, carMatLead, carMatMid, bogieGeo, bogieMat, pantoGeo;
function ensureCarAssets() {
  if (carGeoLead) return;
  carGeoLead = carGeometry(true);
  carGeoMid = carGeometry(false);
  carMatLead = new THREE.MeshPhongMaterial({ map: carTexture(true), shininess: 60, specular: 0x666666 });
  carMatMid = new THREE.MeshPhongMaterial({ map: carTexture(false), shininess: 60, specular: 0x666666 });
  bogieGeo = new THREE.BoxGeometry(2.6, 0.7, 3.2);
  bogieMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  pantoGeo = new THREE.BoxGeometry(1.6, 0.5, 0.25);
}

const glowTex = () => canvasTex('glow', 128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,240,0.8)');
  gr.addColorStop(1, 'rgba(255,255,200,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});
export { glowTex };

// 1両分のメッシュ。kind: 'lead' | 'mid' | 'tail' (tail はノーズが後ろ向き)
export function makeCar(kind) {
  ensureCarAssets();
  const grp = new THREE.Group();
  const lead = kind !== 'mid';
  const body = new THREE.Mesh(lead ? carGeoLead : carGeoMid, lead ? carMatLead : carMatMid);
  if (kind === 'tail') body.rotation.y = Math.PI;
  grp.add(body);
  for (const z of [-CAR_LEN / 2 + 3, CAR_LEN / 2 - 3]) {
    const b = new THREE.Mesh(bogieGeo, bogieMat);
    b.position.set(0, 0.45, z);
    grp.add(b);
  }
  return grp;
}

// 編成 (16両)。返り値の cars[i] を外部から線路に沿って配置する。
export function makeTrain(oncoming) {
  const grp = new THREE.Group();
  const cars = [];
  for (let i = 0; i < 16; i++) {
    const car = makeCar(i === 0 ? 'lead' : i === 15 ? 'tail' : 'mid');
    if ((i === 4 || i === 12)) {
      const p = new THREE.Mesh(pantoGeo, bogieMat);
      p.position.set(0, CAR_H + 0.3, 0);
      car.add(p);
    }
    grp.add(car);
    cars.push(car);
  }
  // 前照灯 / 尾灯
  const mk = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
    }));
    s.scale.set(size, size, 1);
    return s;
  };
  const head = mk(0xfff6d0, 4);
  head.position.set(0, 1.2, CAR_LEN / 2 + 0.1);
  cars[0].add(head);
  const tail = mk(0xff2020, 3);
  tail.position.set(0, 1.2, -CAR_LEN / 2 - 0.1);
  cars[15].add(tail);
  grp.userData = { cars, head, tail, oncoming };
  return grp;
}

// ---------- 建物・名所 ----------
const M = {};
function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!M[k]) M[k] = new THREE.MeshLambertMaterial({ color, ...opts });
  return M[k];
}
export { mat };

// 寄棟屋根 (四角錐台)
function hipRoof(w, d, h, color, overhang = 1.25) {
  const g = new THREE.CylinderGeometry(0.15, Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  const m = new THREE.Mesh(g, mat(color));
  m.scale.set(w * overhang, h, d * overhang);
  return m;
}

// 五重塔
export function makePagoda(height = 55) {
  const grp = new THREE.Group();
  const s = height / 55;
  let y = 0;
  const base = new THREE.Mesh(new THREE.BoxGeometry(16 * s, 1.5 * s, 16 * s), mat(0x9a948a));
  base.position.y = 0.75 * s;
  grp.add(base);
  y = 1.5 * s;
  for (let i = 0; i < 5; i++) {
    const w = (11 - i * 1.2) * s;
    const h = 4.6 * s;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(i % 2 ? 0x7a3b22 : 0x8a4428));
    body.position.y = y + h / 2;
    grp.add(body);
    const roof = hipRoof(w * 1.55, w * 1.55, 2.0 * s, 0x2e3236, 1.0);
    roof.position.y = y + h + 1.0 * s;
    grp.add(roof);
    y += h + 2.0 * s;
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 12 * s, 6), mat(0x8a7a3a));
  spire.position.y = y + 6 * s;
  grp.add(spire);
  for (let i = 0; i < 9; i++) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.1 * s, 0.3 * s, 8), mat(0x8a7a3a));
    ring.position.y = y + 1.5 * s + i * 1.0 * s;
    grp.add(ring);
  }
  return grp;
}

// 寺の本堂 + 山門
export function makeTemple(scale = 1) {
  const grp = new THREE.Group();
  const s = scale;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(30 * s, 1.2 * s, 22 * s), mat(0xa8a296));
  plinth.position.y = 0.6 * s;
  grp.add(plinth);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(22 * s, 8 * s, 15 * s), mat(0x8b5a35));
  hall.position.y = 5.2 * s;
  grp.add(hall);
  const roof = hipRoof(24 * s, 17 * s, 9 * s, 0x33383d, 1.35);
  roof.position.y = 13.5 * s;
  grp.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(14 * s, 0.9 * s, 0.9 * s), mat(0x2a2e33));
  ridge.position.y = 17.6 * s;
  grp.add(ridge);
  // 山門
  const gate = new THREE.Group();
  for (const x of [-4, 4]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1 * s, 7 * s, 1 * s), mat(0x9c3a1f));
    p.position.set(x * s, 3.5 * s, 0);
    gate.add(p);
  }
  const groof = hipRoof(10 * s, 4 * s, 3 * s, 0x33383d, 1.3);
  groof.position.y = 8.2 * s;
  gate.add(groof);
  gate.position.set(0, 0, 26 * s);
  grp.add(gate);
  // 境内の木
  for (const [x, z] of [[-18, -6], [18, -4], [-14, 16], [15, 18], [-22, 8]]) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(4 * s, 7, 5), mat(0x2f5d2a));
    t.position.set(x * s, 6 * s, z * s);
    t.scale.y = 1.3;
    grp.add(t);
  }
  return grp;
}

// 天守閣
export function makeCastle(scale = 1, black = false) {
  const grp = new THREE.Group();
  const s = scale;
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(15 * s, 21 * s, 12 * s, 4, 1), mat(0x8c867a));
  stone.rotation.y = Math.PI / 4;
  stone.position.y = 6 * s;
  grp.add(stone);
  let y = 12 * s;
  const wall = black ? 0x2a2a2a : 0xf4f2ec;
  for (let i = 0; i < 5; i++) {
    const w = (19 - i * 3) * s, d = (15 - i * 2.4) * s, h = 5 * s;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wall));
    body.position.y = y + h / 2;
    grp.add(body);
    const roof = hipRoof(w, d, 2.6 * s, 0x3d4a52, 1.28);
    roof.position.y = y + h + 1.1 * s;
    grp.add(roof);
    if (i % 2 === 0) {
      const gable = new THREE.Mesh(new THREE.ConeGeometry(2.6 * s, 2.4 * s, 3), mat(0x3d4a52));
      gable.rotation.x = Math.PI / 2;
      gable.position.set(0, y + h + 0.6 * s, d / 2 + 0.8 * s);
      grp.add(gable);
    }
    y += h + 1.6 * s;
  }
  for (const x of [-2.6, 2.6]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 1.4 * s, 0.6 * s), mat(0xd4af37, { emissive: 0x3a2a00 }));
    sh.position.set(x * s, y + 0.4 * s, 0);
    grp.add(sh);
  }
  return grp;
}

// 前方後円墳 (長さ length m)。+Z 側が前方部
export function makeKofun(length = 300) {
  const grp = new THREE.Group();
  const s = length / 300;
  // 周濠
  const moatShape = new THREE.Shape();
  moatShape.absarc(0, -40 * s, 115 * s, 0, Math.PI * 2, false);
  const moat1 = new THREE.Mesh(new THREE.CircleGeometry(118 * s, 40), mat(0x3d6f86));
  moat1.rotation.x = -Math.PI / 2;
  moat1.position.set(0, 0.3, -45 * s);
  grp.add(moat1);
  const moat2 = new THREE.Mesh(new THREE.PlaneGeometry(200 * s, 170 * s), mat(0x3d6f86));
  moat2.rotation.x = -Math.PI / 2;
  moat2.position.set(0, 0.32, 75 * s);
  grp.add(moat2);
  // 後円部
  const round = new THREE.Mesh(new THREE.SphereGeometry(95 * s, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2f5a2a));
  round.scale.y = 0.3;
  round.position.set(0, 0, -45 * s);
  grp.add(round);
  // 前方部 (台形)
  const g = new THREE.CylinderGeometry(70 * s, 100 * s, 22 * s, 4, 1);
  g.rotateY(Math.PI / 4);
  const front = new THREE.Mesh(g, mat(0x2f5a2a));
  front.scale.set(1.25, 1, 1.2);
  front.position.set(0, 11 * s, 75 * s);
  grp.add(front);
  // 墳丘の木々
  const tg = new THREE.SphereGeometry(7 * s, 6, 4);
  const tm = mat(0x24481f);
  const trees = new THREE.InstancedMesh(tg, tm, 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    let x, z, y;
    if (i < 55) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 85 * s;
      x = Math.cos(a) * r; z = -45 * s + Math.sin(a) * r;
      y = 28.5 * s * Math.sqrt(Math.max(0, 1 - (r / (95 * s)) ** 2));
    } else {
      x = (Math.random() - 0.5) * 140 * s; z = 30 * s + Math.random() * 100 * s;
      y = 20 * s;
    }
    m4.makeTranslation(x, y + 3 * s, z);
    trees.setMatrixAt(i, m4);
  }
  grp.add(trees);
  return grp;
}

// 富士山 (実寸: 標高3776m)
export function makeFuji() {
  const pts = [];
  const H = 3776, R = 19000;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = R * (1 - t) ** 1.9 + 380 * (1 - t);
    pts.push(new THREE.Vector2(Math.max(r, t < 1 ? 350 : 0), H * t));
  }
  pts.push(new THREE.Vector2(0, H - 30));
  const g = new THREE.LatheGeometry(pts, 64);
  const col = [];
  const p = g.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const ang = Math.atan2(p.getZ(i), p.getX(i));
    const snowLine = 2500 + Math.sin(ang * 9) * 260 + Math.sin(ang * 23) * 120;
    if (y > snowLine) c.set(0xf6f9ff);
    else c.set(0x5d6f8c).lerp(new THREE.Color(0x6f8a72), Math.max(0, 1 - y / 1200));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }));
}

// 一般の山 (ギザギザの円錐)
export function makeMountain(height, radius, seed = 1, color = 0x41603c, fog = true) {
  const g = new THREE.ConeGeometry(radius, height, 14, 5, true);
  const p = g.attributes.position;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(1) + ',' + p.getY(i).toFixed(1) + ',' + p.getZ(i).toFixed(1);
    let j = cache.get(key);
    if (!j) { j = [(rnd() - 0.5) * radius * 0.25, (rnd() - 0.5) * height * 0.15]; cache.set(key, j); }
    const top = p.getY(i) > height / 2 - 1;
    p.setX(i, p.getX(i) + (top ? 0 : j[0]));
    p.setZ(i, p.getZ(i) + (top ? 0 : j[0] * 0.7));
    p.setY(i, p.getY(i) + (top ? 0 : j[1]) + height / 2);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, flatShading: true, fog }));
  return m;
}

// 東京タワー
export function makeTokyoTower() {
  const grp = new THREE.Group();
  const segs = [[0, 80, 45, 18], [80, 150, 18, 9], [150, 250, 9, 3], [250, 333, 3, 0.6]];
  let i = 0;
  for (const [y0, y1, r0, r1] of segs) {
    const n = Math.max(2, Math.round((y1 - y0) / 20));
    for (let k = 0; k < n; k++) {
      const a = y0 + ((y1 - y0) * k) / n, b = y0 + ((y1 - y0) * (k + 1)) / n;
      const ra = r0 + ((r1 - r0) * k) / n, rb = r0 + ((r1 - r0) * (k + 1)) / n;
      const g = new THREE.CylinderGeometry(rb, ra, b - a, 4, 1, true);
      g.rotateY(Math.PI / 4);
      const m = new THREE.Mesh(g, mat(i++ % 2 ? 0xffffff : 0xe8431f, { side: THREE.DoubleSide, wireframe: k % 2 === 0 && y0 < 150 }));
      m.position.y = (a + b) / 2;
      grp.add(m);
    }
  }
  for (const [y, w] of [[150, 24], [250, 12]]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(w, 8, w), mat(0xdddddd));
    d.position.y = y;
    grp.add(d);
  }
  return grp;
}

export function makeKyotoTower() {
  const grp = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(70, 31, 40), mat(0xd8d8d0));
  b.position.y = 15.5;
  grp.add(b);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 60, 16), mat(0xf6f6f6));
  t.position.y = 61;
  grp.add(t);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 10, 16), mat(0xf0f0f0));
  deck.position.y = 95;
  grp.add(deck);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 3, 25, 12), mat(0xe33b2e));
  top.position.y = 112;
  grp.add(top);
  return grp;
}

export function makeHighrise(h = 296) {
  const grp = new THREE.Group();
  const tex = buildingTex();
  const m = new THREE.Mesh(new THREE.BoxGeometry(60, h, 60), new THREE.MeshLambertMaterial({ color: 0xc8ccd2, map: tex }));
  m.position.y = h / 2;
  grp.add(m);
  return grp;
}

// 名所の橋・鳥居
export function makeTorii(s = 1) {
  const g = new THREE.Group();
  const red = mat(0xd2391f);
  for (const x of [-4, 4]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.6 * s, 9 * s, 8), red);
    p.position.set(x * s, 4.5 * s, 0);
    g.add(p);
  }
  const k = new THREE.Mesh(new THREE.BoxGeometry(12 * s, 0.9 * s, 1 * s), mat(0x222222));
  k.position.y = 9.2 * s;
  g.add(k);
  const n = new THREE.Mesh(new THREE.BoxGeometry(10 * s, 0.6 * s, 0.7 * s), red);
  n.position.y = 7.6 * s;
  g.add(n);
  return g;
}

// 窓模様のビルテクスチャ
export function buildingTex() {
  return canvasTex('bld', 128, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 14) {
      for (let x = 6; x < w; x += 16) {
        const v = 60 + Math.floor(Math.random() * 60);
        g.fillStyle = `rgb(${v},${v + 10},${v + 25})`;
        g.fillRect(x, y, 10, 8);
      }
    }
  }, { repeat: true });
}

export function signTex(text, sub, bg = '#ffffff', fg = '#111111') {
  return canvasTex('sign:' + text + sub + bg, 512, 160, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0b3c9c';
    g.fillRect(0, h - 26, w, 10);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.font = 'bold 72px "Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif';
    g.fillText(text, w / 2, 82);
    g.font = '28px sans-serif';
    g.fillText(sub, w / 2, 122);
  });
}

// 暴走新幹線 — メイン
import * as THREE from '../vendor/three.module.min.js';
import {
  sample, trackHeight, tunnelAt, waterAt, STATIONS, LANDMARKS, RIVER_LIST, TUNNEL_LIST,
  TOTAL_KM, nextStation, overview, riverNear,
} from './route.js';
import { WATER } from './scenery-data.js';
import { World, LANE_OFF, RAIL_Y } from './world.js';
import { Traffic, CROSS_WINDOW } from './trains.js';
import { Sound } from './audio.js';
import { Explosion } from './effects.js';
import { canvasTex } from './models.js';

const MAX_KMH = 603;
const $ = (id) => document.getElementById(id);

// ---------------- three.js 基本設定 ----------------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const SKY = new THREE.Color(0xb3cde6);
const DARK = new THREE.Color(0x050505);
scene.background = SKY.clone();
scene.fog = new THREE.FogExp2(SKY.clone(), 0.00011);
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 90000);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x5b6b45, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
scene.add(sun);
scene.add(sun.target);

// 空 (グラデーションの球) と雲
const skyGeo = new THREE.SphereGeometry(80000, 32, 16);
{
  const col = [];
  const p = skyGeo.attributes.position;
  const top = new THREE.Color(0x3d78c4), hor = new THREE.Color(0xc9dcee), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 80000;
    c.copy(hor).lerp(top, Math.min(1, Math.max(0, y * 2.2)));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -10;
scene.add(sky);
const cloudTex = canvasTex('cloud', 256, 128, (g, w, h) => {
  for (let i = 0; i < 14; i++) {
    const x = 40 + Math.random() * 176, y = 50 + Math.random() * 40, r = 20 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }
});
const clouds = new THREE.Group();
for (let i = 0; i < 26; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
  const a = Math.random() * Math.PI * 2, r = 25000 + Math.random() * 30000;
  s.position.set(Math.cos(a) * r, 2500 + Math.random() * 4000, Math.sin(a) * r);
  const sc = 6000 + Math.random() * 9000;
  s.scale.set(sc, sc / 2, 1);
  clouds.add(s);
}
scene.add(clouds);
// 遠方の地面 (チャンクの外側)
const farGround = new THREE.Mesh(new THREE.CircleGeometry(85000, 48), new THREE.MeshLambertMaterial({ color: 0x6d8a55 }));
farGround.rotation.x = -Math.PI / 2;
farGround.position.y = -1.2;
scene.add(farGround);

const world = new World(scene);
const traffic = new Traffic(scene, world);
const sound = new Sound();

// ---------------- ゲーム状態 ----------------
const P = {
  km: 0, v: 0, lat: LANE_OFF, accel: false, pending: null, changing: null,
  booms: 0, time: 0, passed: 0, maxV: 0,
};
let state = 'title'; // title | loading | countdown | run | crash | finish | pause
let view = 'front';
let course = { from: 0, to: STATIONS.length - 1, startKm: 0, goalKm: TOTAL_KM };
let timeScale = 1;
let explosions = [];
let crashT = 0, crashPos = new THREE.Vector3();
let countT = 0;
let lastKm = 0;
let announced = new Set();
let tunnelFactor = 0;
let wasInTunnel = false;
let warnCool = 0;

// ---------------- タイトル画面 ----------------
const selFrom = $('sel-from'), selTo = $('sel-to');
STATIONS.forEach((s, i) => {
  selFrom.add(new Option(`${s.name}（${s.km.toFixed(1)}km）`, i));
  selTo.add(new Option(`${s.name}（${s.km.toFixed(1)}km）`, i));
});
selFrom.value = 0;
selTo.value = STATIONS.length - 1;
const recordKey = () => `bousou:${selFrom.value}-${selTo.value}:x${$('sel-scale').value}`;
function loadBest() {
  try {
    const r = JSON.parse(localStorage.getItem(recordKey()) || 'null');
    $('best').textContent = r ? `この区間の最速記録: ${fmtTime(r.time)}（大爆発 ${r.booms}回）` : '';
  } catch { $('best').textContent = ''; }
}
for (const el of [selFrom, selTo, $('sel-scale')]) el.addEventListener('change', loadBest);
loadBest();

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', () => { $('result').hidden = true; startGame(); });
$('btn-title').addEventListener('click', toTitle);
$('btn-quit').addEventListener('click', toTitle);
$('btn-resume').addEventListener('click', togglePause);
$('btn-pause').addEventListener('click', togglePause);
$('btn-mute').addEventListener('click', toggleMute);

function toTitle() {
  state = 'title';
  for (const id of ['result', 'pause', 'crash', 'countdown']) $(id).hidden = true;
  $('hud').hidden = true;
  $('touch').hidden = true;
  $('title').hidden = false;
  loadBest();
}

function startGame() {
  let from = +selFrom.value, to = +selTo.value;
  if (to <= from) {
    if (from === STATIONS.length - 1) { from = 0; }
    to = STATIONS.length - 1;
    selFrom.value = from; selTo.value = to;
  }
  timeScale = +$('sel-scale').value;
  course = { from, to, startKm: STATIONS[from].km, goalKm: STATIONS[to].km };
  const q = new URLSearchParams(location.search);
  const dbgStart = parseFloat(q.get('start'));
  sound.init();
  sound.voice = $('chk-voice').checked;
  Object.assign(P, { km: isNaN(dbgStart) ? course.startKm : dbgStart, v: +(q.get('speed') || 0), lat: LANE_OFF, accel: false, pending: null, changing: null, booms: 0, time: 0, passed: 0, maxV: 0 });
  lastKm = P.km;
  announced = new Set();
  for (const e of explosions) e.dispose();
  explosions = [];
  world.clear();
  const s = sample(P.km);
  world.setOrigin(s.x, s.z);
  traffic.reset(P.km, course.goalKm);
  $('hud-course').textContent = `${STATIONS[from].name} → ${STATIONS[to].name}`;
  $('title').hidden = true;
  $('loading').textContent = '';
  state = 'loading';
  setView('front');
}

// ---------------- 入力 ----------------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.repeat && !['ArrowUp', 'KeyW', 'Space'].includes(e.code)) return;
  keys.add(e.code);
  switch (e.code) {
    case 'ArrowRight': case 'KeyD': requestLane(-1); break;
    case 'ArrowLeft': case 'KeyA': requestLane(1); break;
    case 'KeyZ': setView('left'); break;
    case 'KeyX': setView('front'); break;
    case 'KeyC': setView('right'); break;
    case 'KeyV': setView(view === 'front' ? 'left' : view === 'left' ? 'right' : 'front'); break;
    case 'KeyH': sound.horn(); break;
    case 'KeyM': toggleMute(); break;
    case 'KeyP': case 'Escape': togglePause(); break;
    case 'Enter': if (state === 'title') startGame(); break;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
let touchAccel = false;
const tAccel = $('t-accel');
tAccel.addEventListener('pointerdown', (e) => { touchAccel = true; tAccel.classList.add('on'); e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) tAccel.addEventListener(ev, () => { touchAccel = false; tAccel.classList.remove('on'); });
$('t-left').addEventListener('pointerdown', (e) => { requestLane(1); e.preventDefault(); });
$('t-right').addEventListener('pointerdown', (e) => { requestLane(-1); e.preventDefault(); });
document.querySelectorAll('#viewtabs button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
const isTouch = matchMedia('(pointer: coarse)').matches;

function setView(v) {
  view = v;
  $('frame').className = v;
  document.querySelectorAll('#viewtabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  camera.fov = v === 'front' ? 62 : 52;
  camera.updateProjectionMatrix();
}
function toggleMute() {
  sound.setMuted(!sound.muted);
  $('btn-mute').textContent = sound.muted ? '🔇' : '🔊';
  if (sound.muted && window.speechSynthesis) speechSynthesis.cancel();
}
let pausedFrom = null;
function togglePause() {
  if (state === 'pause') { state = pausedFrom; $('pause').hidden = true; }
  else if (['run', 'countdown', 'crash'].includes(state)) { pausedFrom = state; state = 'pause'; $('pause').hidden = false; sound.update(0, false, 0); }
}

const laneSign = () => (P.changing ? P.changing.toSign : P.pending ? P.pending.toSign : Math.sign(P.lat));
function requestLane(toSign) {
  if (state !== 'run') return;
  if (laneSign() === toSign || P.changing || P.pending) return;
  const c = traffic.nextCrossover(P.km);
  const d = c ? c.km - P.km : 99;
  if (!c || d > CROSS_WINDOW) {
    flashAlert(d < 0.6 ? 'まだ早い!' : 'ポイントがありません', false, 700);
    sound.beep();
    return;
  }
  if (d < -0.06) { flashAlert('間に合わない!', false, 700); return; }
  P.pending = { c, toSign };
  flashAlert(toSign < 0 ? 'ポイント切替 ▶ 上り線へ' : '◀ 下り線へ ポイント切替', true, 900);
}

// ---------------- HUD ----------------
let alertTimer = 0;
function flashAlert(text, good, ms = 1200) {
  const a = $('alert');
  a.textContent = text;
  a.className = 'show' + (good ? ' good' : '');
  alertTimer = ms / 1000;
}
let telopTimer = 0;
function telop(sub, main, en) {
  const t = $('telop');
  $('telop-sub').textContent = sub;
  $('telop-main').textContent = main;
  $('telop-en').textContent = en || '';
  t.className = '';
  void t.offsetWidth;
  t.className = 'show';
  telopTimer = 3.8;
}
const annQueue = [];
let annTimer = 0;
function announce(text, voice) {
  annQueue.push({ text, voice });
}

const speedo = $('speedo').getContext('2d');
function drawSpeedo(v, accel) {
  const g = speedo, W = 360, cx = W / 2, cy = W / 2, R = 160;
  g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(10,16,24,0.82)';
  g.beginPath(); g.arc(cx, cy, R + 14, 0, Math.PI * 2); g.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, vmax = 650;
  const ang = (x) => a0 + (a1 - a0) * (x / vmax);
  g.lineWidth = 10;
  g.strokeStyle = '#26303b';
  g.beginPath(); g.arc(cx, cy, R - 8, a0, a1); g.stroke();
  g.strokeStyle = '#ff3b2f';
  g.beginPath(); g.arc(cx, cy, R - 8, ang(MAX_KMH), a1); g.stroke();
  g.strokeStyle = '#ffb020';
  g.beginPath(); g.arc(cx, cy, R - 8, a0, ang(v)); g.stroke();
  g.fillStyle = '#cfd8e3';
  g.font = '20px DotGothic16, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let x = 0; x <= vmax; x += 25) {
    const a = ang(x), big = x % 100 === 0;
    g.strokeStyle = big ? '#fff' : '#7c8896';
    g.lineWidth = big ? 3 : 1.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22));
    g.lineTo(cx + Math.cos(a) * (R - (big ? 40 : 30)), cy + Math.sin(a) * (R - (big ? 40 : 30)));
    g.stroke();
    if (big) g.fillText(String(x), cx + Math.cos(a) * (R - 60), cy + Math.sin(a) * (R - 60));
  }
  // のぞみ 300km/h マーク
  const an = ang(300);
  g.fillStyle = '#7fe0ff';
  g.beginPath(); g.arc(cx + Math.cos(an) * (R + 4), cy + Math.sin(an) * (R + 4), 5, 0, Math.PI * 2); g.fill();
  const a = ang(v);
  g.strokeStyle = accel ? '#ff5a3a' : '#ffffff';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx - Math.cos(a) * 16, cy - Math.sin(a) * 16);
  g.lineTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
  g.stroke();
  g.fillStyle = '#444';
  g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
}

// ミニマップ (実際の路線形状)
const mm = $('minimap').getContext('2d');
const ov = overview(2);
let mmT = null;
const mmBg = document.createElement('canvas');
mmBg.width = 320; mmBg.height = 220;
{
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [x, z] of ov) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const sc = Math.min(296 / (maxX - minX), 180 / (maxZ - minZ));
  const ox = 12 + (296 - (maxX - minX) * sc) / 2, oz = 26 + (180 - (maxZ - minZ) * sc) / 2;
  mmT = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
  const g = mmBg.getContext('2d');
  g.lineWidth = 3;
  g.strokeStyle = '#3c6fd8';
  g.beginPath();
  ov.forEach(([x, z], i) => { const [px, py] = mmT(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.stroke();
  g.fillStyle = '#fff';
  for (const s of STATIONS) {
    const p = sample(s.km);
    const [px, py] = mmT(p.x, p.z);
    g.beginPath(); g.arc(px, py, 2.2, 0, Math.PI * 2); g.fill();
  }
  g.font = 'bold 13px sans-serif';
  g.fillStyle = '#cfd8e3';
  for (const n of ['東京', '名古屋', '新大阪', '広島', '博多']) {
    const s = STATIONS.find((x) => x.name === n);
    const p = sample(s.km);
    const [px, py] = mmT(p.x, p.z);
    g.fillText(n, px - 14, py + (n === '東京' || n === '名古屋' ? -8 : 16));
  }
}
function drawMinimap() {
  mm.clearRect(0, 0, 320, 220);
  mm.drawImage(mmBg, 0, 0);
  const p = sample(P.km);
  const [px, py] = mmT(p.x, p.z);
  mm.fillStyle = '#ff3b2f';
  mm.beginPath(); mm.arc(px, py, 6, 0, Math.PI * 2); mm.fill();
  mm.strokeStyle = '#fff'; mm.lineWidth = 2; mm.stroke();
  // 進捗バー
  const t = (P.km - course.startKm) / (course.goalKm - course.startKm);
  mm.fillStyle = '#26303b';
  mm.fillRect(12, 8, 296, 8);
  mm.fillStyle = '#ffb020';
  mm.fillRect(12, 8, 296 * Math.max(0, Math.min(1, t)), 8);
}

const laneTrains = $('lane-trains'), lanePoints = $('lane-points'), laneMe = $('lane-me');
function updateHud() {
  $('hud-speed').textContent = Math.round(P.v);
  $('hud-notch').textContent = P.accel ? 'P5' : 'N';
  $('hud-dist').textContent = (P.km - course.startKm).toFixed(1);
  $('hud-remain').textContent = Math.max(0, course.goalKm - P.km).toFixed(1);
  const ns = nextStation(P.km);
  if (ns) { $('hud-next').textContent = ns.name; $('hud-nextd').textContent = (ns.km - P.km).toFixed(1) + 'km'; }
  $('hud-time').textContent = fmtTime(P.time);
  const clock = 6 * 3600 + P.time;
  $('hud-clock').textContent = `${String(Math.floor(clock / 3600) % 24).padStart(2, '0')}:${String(Math.floor(clock / 60) % 60).padStart(2, '0')}`;
  $('hud-boom').textContent = P.booms;
  drawSpeedo(P.v, P.accel && P.v < MAX_KMH);
  drawMinimap();

  // ポイント情報
  const c = traffic.nextCrossover(P.km);
  const arrow = $('pb-arrow');
  if (c) {
    const d = c.km - P.km;
    $('pb-dist').textContent = d > 0 ? `${Math.round(d * 1000)}m` : '通過中';
    arrow.textContent = laneSign() > 0 ? '▶' : '◀';
    arrow.className = d <= CROSS_WINDOW && d > -0.06 ? 'go' : d < 0.6 ? 'near' : '';
    $('pb-bar').firstElementChild.style.width = `${Math.max(0, Math.min(100, (1 - d / 1.2) * 100))}%`;
  }
  // 自分の線路上の列車
  const ln = traffic.nearestOnLane(P.km, Math.sign(P.lat) || 1);
  const pt = $('pb-train');
  if (ln && ln.dist < 6) {
    const onc = ln.train.dir < 0;
    pt.innerHTML = onc ? `<span class="danger">対向列車 ${ln.dist.toFixed(1)}km</span>` : `先行のぞみ ${ln.dist.toFixed(1)}km`;
  } else pt.textContent = '';

  // 線路図
  const x = 32 + (LANE_OFF - P.lat) / (2 * LANE_OFF) * 56;
  laneMe.setAttribute('x', x - 10);
  let svg = '';
  for (const t of traffic.trains) {
    const tail = t.dir > 0 ? t.s - 0.4 : t.s;
    const d = tail - P.km;
    if (d < -0.5 || d > 3.2) continue;
    const y0 = 110 - (d / 3) * 110;
    const h = (0.4 / 3) * 110;
    const tx = t.lane > 0 ? 22 : 78;
    svg += `<rect x="${tx}" y="${(y0 - h).toFixed(1)}" width="20" height="${h.toFixed(1)}" rx="4" fill="${t.dir > 0 ? '#e8eef5' : '#ff4a3a'}"/>`;
  }
  laneTrains.innerHTML = svg;
  let ps = '';
  for (const cc of traffic.crossovers) {
    const d = cc.km - P.km;
    if (d < -0.3 || d > 3) continue;
    const y = 110 - (d / 3) * 110;
    ps += `<path d="M32 ${y.toFixed(1)} L88 ${(y - 7).toFixed(1)} M88 ${y.toFixed(1)} L32 ${(y - 7).toFixed(1)}" stroke="#ffd23a" stroke-width="3"/>`;
  }
  lanePoints.innerHTML = ps;
}

// ---------------- 沿線案内 (車掌放送) ----------------
const EVENTS = [];
for (const s of STATIONS) EVENTS.push({ km: s.km - 2.0, key: 'near:' + s.name, fn: () => announce(`まもなく ${s.name} を通過します`, `まもなく、${s.kana}を、通過します`), st: s });
for (const l of LANDMARKS) {
  if (l.type === 'river') continue;
  if (l.type === 'lake') { EVENTS.push({ km: l.km - 1.2, key: 'lm:' + l.name, fn: () => announce(`両側に ${l.name} が広がります`, `両側に、${l.name}が広がります`) }); continue; }
  const side = l.off > 0 ? '左手' : '右手';
  const lead = l.type === 'fuji' ? 22 : l.type === 'mountain' || l.type === 'mountaincastle' ? 4 : 0.9;
  EVENTS.push({ km: l.km - lead, key: 'lm:' + l.name, fn: () => announce(`${side}に ${l.name} が見えます`, `${side}に、${l.name.replace(/（.*?）/, '')}が見えます`) });
}
for (const w of WATER) {
  const side = w[2] === 'L' ? '左手' : w[2] === 'R' ? '右手' : '両側';
  EVENTS.push({ km: w[0] + 0.3, key: 'w:' + w[3], fn: () => announce(`${side}に ${w[3]}`, null) });
}
for (const r of RIVER_LIST) {
  EVENTS.push({ km: r.km - r.len / 2 - 0.05, key: 'r:' + r.name, fn: () => announce(`${r.name}橋梁　${Math.round(r.len * 1000).toLocaleString()}m${r.truss ? '（トラス橋）' : ''}`, null) });
}
for (const t of TUNNEL_LIST) {
  if (!t.name) continue;
  EVENTS.push({ km: t.a - 0.02, key: 't:' + t.name, fn: () => announce(`${t.name}　${Math.round((t.b - t.a) * 1000).toLocaleString()}m`, null) });
}
EVENTS.sort((a, b) => a.km - b.km);

function checkEvents(prev, cur) {
  for (const e of EVENTS) {
    if (e.km > cur) break;
    if (e.km > prev && !announced.has(e.key)) {
      announced.add(e.key);
      if (e.st && (e.st.km <= course.startKm || e.st.km > course.goalKm)) continue;
      e.fn();
    }
  }
  // 駅通過テロップ
  for (const s of STATIONS) {
    if (s.km > prev && s.km <= cur && s.km > course.startKm && s.km < course.goalKm) {
      telop(`東京から ${s.km.toFixed(1)}km　${$('hud-clock').textContent} 通過`, s.name, s.en);
      sound.chime();
    }
  }
}

// ---------------- 更新 ----------------
const tmp = { };
function accelRate(v) { return Math.max(3.5, 24 - v * 0.034); } // km/h/s

function stepRun(dt) {
  P.accel = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space') || touchAccel;
  if (P.accel) P.v = Math.min(MAX_KMH, P.v + accelRate(P.v) * dt);
  P.maxV = Math.max(P.maxV, P.v);
  const prev = P.km;
  P.km = Math.min(course.goalKm + 0.5, P.km + (P.v / 3600) * dt);
  P.time += dt;

  // 線路切替
  if (P.pending && P.km >= P.pending.c.km) {
    const c = P.pending.c;
    P.changing = { from: P.lat, toSign: P.pending.toSign, a: P.km, b: Math.max(P.km + 0.08, c.km + c.len) };
    P.pending = null;
    sound.clack();
  }
  if (P.pending && P.km > P.pending.c.km + P.pending.c.len) P.pending = null;
  if (P.changing) {
    const ch = P.changing;
    const t = Math.min(1, (P.km - ch.a) / (ch.b - ch.a));
    const s = t * t * (3 - 2 * t);
    P.lat = ch.from + (ch.toSign * LANE_OFF - ch.from) * s;
    if (t >= 1) { P.lat = ch.toSign * LANE_OFF; P.changing = null; sound.clack(); }
  }
  traffic.update(dt, P.km);
  if (!P.changing && !P.pending) traffic.ensureEscape(P.km, P.v, P.lat);
  for (const e of traffic.passEvents(P.km, P.lat)) {
    sound.passBy();
    if (e === 'same') P.passed++;
  }
  const hit = traffic.collide(P.km, P.lat);
  if (hit) { crash(hit); return; }
  checkEvents(prev, P.km);
  if (P.km >= course.goalKm) finish();
}

function crash(train) {
  state = 'crash';
  crashT = 0;
  P.booms++;
  const s = sample(P.km);
  const h = trackHeight(P.km);
  crashPos.set(s.x + s.lx * P.lat - world.origin.x, h + RAIL_Y, s.z + s.lz * P.lat - world.origin.z);
  explosions.push(new Explosion(scene, crashPos, new THREE.Vector3(s.tx, 0, s.tz)));
  traffic.remove(train);
  traffic.clearAround(P.km);
  sound.explosion();
  $('crash').hidden = false;
  $('crash-sub').textContent = `${P.booms}回目の大破　速度 ${Math.round(P.v)}km/h で衝突`;
  $('flash').style.transition = 'none';
  $('flash').style.opacity = 1;
  requestAnimationFrame(() => { $('flash').style.transition = 'opacity 1.5s'; $('flash').style.opacity = 0; });
  P.v = 0;
  P.accel = false;
  P.pending = null;
  P.changing = null;
  if (window.speechSynthesis) speechSynthesis.cancel();
}

function respawn() {
  P.lat = LANE_OFF;
  P.v = 0;
  traffic.clearAround(P.km);
  $('crash').hidden = true;
  state = 'countdown';
  countT = 2.2;
  $('countdown').hidden = false;
  $('countdown').textContent = '再出発!';
}

function finish() {
  state = 'finish';
  P.km = course.goalKm;
  const st = STATIONS[course.to];
  telop(`${fmtTime(P.time)}　大爆発 ${P.booms}回`, `${st.name} 到着`, st.en);
  sound.chime();
  sound.say(`${st.kana}に到着しました`);
  let rec = null;
  try { rec = JSON.parse(localStorage.getItem(recordKey()) || 'null'); } catch {}
  const debugRun = /[?&](start|speed)=/.test(location.search);
  const better = !debugRun && (!rec || P.time < rec.time);
  if (better) { try { localStorage.setItem(recordKey(), JSON.stringify({ time: P.time, booms: P.booms })); } catch {} }
  setTimeout(() => {
    $('res-title').textContent = `${st.name} 到着!`;
    $('res-course').textContent = `${STATIONS[course.from].name} → ${st.name}（${(course.goalKm - course.startKm).toFixed(1)}km）`;
    $('res-time').textContent = fmtTime(P.time);
    $('res-boom').textContent = `${P.booms} 回`;
    $('res-pass').textContent = `${P.passed} 本`;
    $('res-max').textContent = `${Math.round(P.maxV)} km/h`;
    $('res-record').textContent = better ? '★ 最速記録更新!' : rec ? `最速記録: ${fmtTime(rec.time)}` : '';
    $('result').hidden = false;
    $('hud').hidden = true;
    $('touch').hidden = true;
  }, 2500);
}

// ---------------- カメラ ----------------
const lookTarget = new THREE.Vector3();
let lookInit = false;
function updateCamera(dt) {
  const o = world.origin;
  if (state === 'crash') {
    const a = crashT * 0.35 + 0.6;
    const r = 70 + crashT * 12;
    camera.position.set(crashPos.x + Math.cos(a) * r, crashPos.y + 22 + crashT * 4, crashPos.z + Math.sin(a) * r);
    camera.lookAt(crashPos.x, crashPos.y + 6, crashPos.z);
    return;
  }
  const shake = Math.min(1, P.v / 600) * 0.03;
  if (view === 'front') {
    const ek = P.km - 0.008;
    const s = sample(ek);
    const h = trackHeight(ek);
    camera.position.set(s.x + s.lx * P.lat - o.x, h + RAIL_Y + 3.0 + (Math.random() - 0.5) * shake, s.z + s.lz * P.lat - o.z);
    const tk = P.km + 0.15;
    const t = sample(tk);
    const th = trackHeight(tk);
    let latT = P.lat;
    if (P.changing) latT = P.changing.toSign * LANE_OFF * 0.6 + P.lat * 0.4;
    const target = new THREE.Vector3(t.x + t.lx * latT - o.x, th + RAIL_Y + 1.8, t.z + t.lz * latT - o.z);
    if (!lookInit) { lookTarget.copy(target); lookInit = true; }
    lookTarget.lerp(target, Math.min(1, dt * 8));
    camera.lookAt(lookTarget);
  } else {
    const side = view === 'left' ? 1 : -1;
    const ek = P.km - 0.06;
    const s = sample(ek);
    const h = trackHeight(ek);
    camera.position.set(s.x + s.lx * (P.lat + side * 1.0) - o.x, h + RAIL_Y + 2.3 + (Math.random() - 0.5) * shake * 0.5, s.z + s.lz * (P.lat + side * 1.0) - o.z);
    const ang = 0.22;
    const dx = s.lx * side * Math.cos(ang) + s.tx * Math.sin(ang);
    const dz = s.lz * side * Math.cos(ang) + s.tz * Math.sin(ang);
    camera.lookAt(camera.position.x + dx * 100, camera.position.y - 6, camera.position.z + dz * 100);
    lookInit = false;
  }
}

function updateEnvironment(dt) {
  const camKm = view === 'front' ? P.km - 0.008 : P.km - 0.06;
  const t = state === 'crash' ? null : tunnelAt(camKm);
  let target = 0;
  if (t) target = Math.min(1, Math.min(camKm - t.a, t.b - camKm) * 1000 / 25);
  tunnelFactor += (target - tunnelFactor) * Math.min(1, dt * 10);
  if (t && !wasInTunnel) sound.tunnelIn();
  wasInTunnel = !!t;
  scene.background.copy(SKY).lerp(DARK, tunnelFactor);
  scene.fog.color.copy(SKY).lerp(DARK, tunnelFactor);
  scene.fog.density = 0.00011 + tunnelFactor * 0.006;
  hemi.intensity = 1.6 - tunnelFactor * 1.2;
  sun.intensity = 2.2 * (1 - tunnelFactor);
  sky.visible = clouds.visible = tunnelFactor < 0.6;
  sky.position.copy(camera.position);
  farGround.position.set(camera.position.x, -1.2, camera.position.z);
  farGround.visible = tunnelFactor < 0.6;
  clouds.position.set(camera.position.x, 0, camera.position.z);
  sun.position.set(camera.position.x + 3000, 6000, camera.position.z + 4000);
  sun.target.position.copy(camera.position);
  $('speedlines').style.opacity = view === 'front' && state === 'run' ? Math.max(0, (P.v - 380) / 223) * 0.9 : 0;
}

// ---------------- メインループ ----------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state === 'title' || state === 'pause') {
    if (state === 'title') renderTitle(dt);
    renderer.render(scene, camera);
    return;
  }
  if (state === 'loading') {
    world.update(P.km, 6);
    const total = Math.ceil((8.5) / 0.5);
    const have = world.chunks.size;
    $('countdown').hidden = false;
    $('countdown').style.fontSize = '28px';
    $('countdown').textContent = `線路を敷設中… ${Math.min(100, Math.round((have / total) * 100))}%`;
    if (world.ready(P.km)) {
      $('countdown').style.fontSize = '';
      state = 'countdown';
      countT = 3.6;
      $('hud').hidden = false;
      $('touch').hidden = !isTouch;
      const st = STATIONS[course.from];
      telop(`${STATIONS[course.to].name}ゆき　暴走新幹線`, `${st.name} 出発`, st.en);
      sound.say(`この電車は、暴走新幹線、${STATIONS[course.to].kana}ゆきです`);
    }
    updateCamera(dt);
    updateEnvironment(dt);
    renderer.render(scene, camera);
    return;
  }

  const simDt = dt * timeScale;
  if (state === 'countdown') {
    countT -= dt;
    const n = Math.ceil(countT - 0.6);
    $('countdown').textContent = $('countdown').textContent === '再出発!' && countT > 0.6 ? '再出発!' : n > 0 ? String(n) : '出発進行!';
    if (countT <= 0) { $('countdown').hidden = true; state = 'run'; }
    traffic.update(simDt, P.km);
  } else if (state === 'run') {
    const steps = Math.ceil(simDt / 0.04);
    for (let i = 0; i < steps && state === 'run'; i++) stepRun(simDt / steps);
  } else if (state === 'crash') {
    crashT += dt;
    traffic.update(simDt, P.km);
    if (crashT > 4) respawn();
  } else if (state === 'finish') {
    P.v = Math.max(0, P.v - 120 * dt);
    traffic.update(simDt, P.km);
  }
  explosions = explosions.filter((e) => { const alive = e.update(dt); if (!alive) e.dispose(); return alive; });

  // 原点の付け替え (浮動小数点誤差対策)
  const sp = sample(P.km);
  if (state !== 'crash' && Math.hypot(sp.x - world.origin.x, sp.z - world.origin.z) > 2500 && !explosions.length) {
    world.setOrigin(sp.x, sp.z);
    traffic.reposition();
  }
  world.update(P.km, timeScale > 2 ? 2 : 1);
  updateCamera(dt);
  traffic._layout(P.km, camera.position);
  updateEnvironment(dt);
  sound.update(state === 'run' || state === 'finish' ? P.v : 0, P.accel && P.v < MAX_KMH, tunnelFactor);

  // 警告
  warnCool -= dt;
  if (state === 'run') {
    const ln = traffic.nearestOnLane(P.km, Math.sign(P.lat) || 1);
    if (ln && !P.changing) {
      const onc = ln.train.dir < 0;
      const closing = onc ? (P.v + 300) / 3600 : (P.v - 300) / 3600;
      const tti = closing > 0 ? ln.dist / closing : 99;
      if (tti < 9 && ln.dist < 4) {
        if (alertTimer <= 0) { $('alert').textContent = onc ? '⚠ 対向列車接近!' : '⚠ のぞみ接近!'; $('alert').className = 'show'; }
        if (warnCool <= 0) { sound.warn(); warnCool = tti < 4 ? 0.4 : 1.0; }
      } else if (alertTimer <= 0) $('alert').className = '';
    } else if (alertTimer <= 0) $('alert').className = '';
  }
  if (alertTimer > 0) { alertTimer -= dt; if (alertTimer <= 0) $('alert').className = ''; }
  if (telopTimer > 0) { telopTimer -= dt; if (telopTimer <= 0) $('telop').className = 'hide'; }
  if (annTimer > 0) { annTimer -= dt; if (annTimer <= 0) $('announce').className = ''; }
  else if (annQueue.length) {
    const a = annQueue.shift();
    $('announce').textContent = '🎙 ' + a.text;
    $('announce').className = 'show';
    annTimer = 3.2;
    if (a.voice) sound.say(a.voice);
  }
  hudT -= dt;
  if (hudT <= 0 && !$('hud').hidden) { updateHud(); hudT = 1 / 20; }
  lastKm = P.km;
  renderer.render(scene, camera);
}

// タイトル画面の背景: 東京駅付近をゆっくり流す
let titleKm = 1.0;
function renderTitle(dt) {
  titleKm += dt * 0.02;
  if (titleKm > 6) titleKm = 1.0;
  P.km = titleKm;
  P.lat = LANE_OFF;
  const sp = sample(P.km);
  if (Math.hypot(sp.x - world.origin.x, sp.z - world.origin.z) > 2500 || world.chunks.size === 0) world.setOrigin(sp.x, sp.z);
  world.update(P.km, 2);
  view = 'front';
  updateCamera(dt);
  updateEnvironment(dt);
}

window.__dbg = { P, traffic, world, camera, get state() { return state; } };
requestAnimationFrame(frame);

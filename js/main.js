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
import { isNative, onBackButton, exitApp, shareNative, canShareNative } from './native.js';
import { Ads } from './ads.js';
import { t, apply as applyLang, setLang, onLangChange, nameOf, stationName, getLang } from './i18n.js';

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
let resumed = false;
let autosaveT = 0;

// ---------------- タイトル画面 ----------------
const selFrom = $('sel-from'), selTo = $('sel-to');
STATIONS.forEach((s, i) => {
  selFrom.add(new Option('', i));
  selTo.add(new Option('', i));
});
function labelStations() {
  STATIONS.forEach((s, i) => {
    const label = t('station.opt', { name: stationName(s), km: s.km.toFixed(1) });
    selFrom.options[i].text = label;
    selTo.options[i].text = label;
  });
}
selFrom.value = 0;
selTo.value = STATIONS.length - 1;
// 記録は2部門: タイム部門 (大爆発1回につき +3分) と 無事故部門 (大爆発0回のみ)
const PENALTY_SEC = 180;
const totalTime = () => P.time + P.booms * PENALTY_SEC;
const recordKey = (cat) => `bousou2:${selFrom.value}-${selTo.value}:x${$('sel-scale').value}:${cat}`;
function readRecord(cat) {
  try { return JSON.parse(localStorage.getItem(recordKey(cat)) || 'null'); } catch { return null; }
}
function loadBest() {
  const tr = readRecord('time'), c = readRecord('clean');
  const parts = [];
  if (tr) parts.push(t('best.time', { t: fmtTime(tr.time), n: tr.booms }));
  if (c) parts.push(t('best.clean', { t: fmtTime(c.time) }));
  $('best').textContent = parts.length ? t('best.prefix') + parts.join('　') : '';
}
for (const el of [selFrom, selTo, $('sel-scale')]) el.addEventListener('change', loadBest);
loadBest();

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

$('btn-start').addEventListener('click', () => startGame());
$('btn-continue').addEventListener('click', continueGame);
$('btn-save').addEventListener('click', () => { saveGame(); toTitle(); });
// 「もう一度」は 2 回に 1 回、全画面広告を挟む (アプリのみ)
let retries = 0;
$('btn-again').addEventListener('click', async () => {
  retries++;
  if (retries % 2 === 0) await Ads.showInterstitial();
  $('result').hidden = true;
  startGame();
});
// 結果画面の「タイトルへ」でも全画面広告を挟む (アプリのみ)
$('btn-title').addEventListener('click', async () => {
  await Ads.showInterstitial();
  toTitle();
});
$('btn-quit').addEventListener('click', () => { clearSave(); toTitle(); });
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
  showContinue();
  Ads.showBanner();
}

// ---------------- 中断セーブ ----------------
// セーブは1つだけ。続きから再開すると消える (危ない場面の前のセーブ・ロードのやり直しを防ぐ)
const SAVE_KEY = 'bousou2:save';
const PLAYING = ['run', 'countdown', 'crash', 'pause', 'loading'];
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}
function saveGame() {
  if (!PLAYING.includes(state) || /[?&](start|speed)=/.test(location.search)) return;
  const data = {
    v: 1, from: course.from, to: course.to, scale: timeScale, voice: sound.voice,
    km: P.km, time: P.time, booms: P.booms, passed: P.passed, maxV: P.maxV, savedAt: Date.now(),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}
function showContinue() {
  const d = readSave();
  $('btn-continue').hidden = !d;
  if (!d) return;
  const near = STATIONS.reduce((a, b) => (Math.abs(b.km - d.km) < Math.abs(a.km - d.km) ? b : a));
  $('continue-info').textContent =
    t('cont.info', { from: stationName(STATIONS[d.from]), to: stationName(STATIONS[d.to]), near: stationName(near), km: d.km.toFixed(1), t: fmtTime(d.time + d.booms * PENALTY_SEC) });
}
function continueGame() {
  const d = readSave();
  if (!d) { showContinue(); return; }
  clearSave();
  selFrom.value = d.from;
  selTo.value = d.to;
  $('sel-scale').value = d.scale;
  $('chk-voice').checked = d.voice !== false;
  startGame(d);
}
window.addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGame();
    // 別アプリに切り替えたら自動で一時停止し、音も止める
    if (['run', 'countdown', 'crash'].includes(state) && !Ads.showing) togglePause();
    sound.suspend();
  } else if (!Ads.showing) {
    sound.resume();
  }
});
showContinue();

function startGame(resume) {
  closeAdOffer();
  Ads.hideBanner();
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
  Object.assign(P, { km: isNaN(dbgStart) ? course.startKm : dbgStart, v: +(q.get('speed') || 0), lat: LANE_OFF, accel: false, pending: null, changing: null, booms: 0, time: 0, passed: 0, maxV: 0, rewardUsed: false });
  // 続きから: 位置と記録を戻し、速度0から再出発 (周りの列車は配置し直す)
  if (resume) Object.assign(P, { km: resume.km, v: 0, booms: resume.booms, time: resume.time, passed: resume.passed, maxV: resume.maxV });
  resumed = !!resume;
  lastKm = P.km;
  announced = new Set();
  for (const e of explosions) e.dispose();
  explosions = [];
  world.clear();
  const s = sample(P.km);
  world.setOrigin(s.x, s.z);
  traffic.setPlayer(P);
  traffic.reset(P.km, course.goalKm);
  $('hud-course').textContent = `${stationName(STATIONS[from])} → ${stationName(STATIONS[to])}`;
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
const isTouch = matchMedia('(pointer: coarse)').matches || isNative;
document.body.classList.toggle('touchmode', isTouch);

// 戻るボタン (アプリ): プレイ中は一時停止、一時停止中は再開、タイトルや結果画面ではアプリを終了
onBackButton(() => {
  if (Ads.showing) return;
  if (adOffer) { declineAd(); return; }
  if (['run', 'countdown', 'crash', 'pause'].includes(state)) togglePause();
  else if (state === 'title' || state === 'finish') exitApp();
});

// 広告表示中はゲームの音を止める
Ads.setHooks({
  suspend: () => sound.suspend(),
  resume: () => sound.resume(),
  // バナーの高さだけ画面の下に余白を取り、ボタンと重ならないようにする
  bannerHeight: (h) => document.documentElement.style.setProperty('--banner-h', `${h}px`),
});
Ads.showBanner(); // 起動時はタイトル画面

// タイトル画面のビルド番号と「広告の設定」(EU など同意が必要な地域のみ)
$('build-info').textContent = window.APP_VERSION && window.APP_VERSION !== 'dev' ? window.APP_VERSION + '｜' : '';
Ads.initDone.then(() => { $('ad-privacy').hidden = !Ads.privacyOptionsRequired; });
$('ad-privacy-link').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });

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
  if (sound.muted) sound.stopVoice();
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
    flashAlert(d < 0.6 ? t('alert.early') : t('alert.noPoint'), false, 700);
    sound.beep();
    return;
  }
  if (d < -0.06) { flashAlert(t('alert.late'), false, 700); return; }
  P.pending = { c, toSign };
  flashAlert(toSign < 0 ? t('alert.toUp') : t('alert.toDown'), true, 900);
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
  const tel = $('telop');
  $('telop-sub').textContent = sub;
  $('telop-main').textContent = main;
  $('telop-en').textContent = en || '';
  tel.className = '';
  void tel.offsetWidth;
  tel.className = 'show';
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
}
// ミニマップの主要駅名 (言語を切り替えたら描き直す)
const mmBase = document.createElement('canvas');
mmBase.width = 320; mmBase.height = 220;
mmBase.getContext('2d').drawImage(mmBg, 0, 0);
function labelMinimap() {
  const g = mmBg.getContext('2d');
  g.clearRect(0, 0, 320, 220);
  g.drawImage(mmBase, 0, 0);
  g.font = 'bold 13px sans-serif';
  g.fillStyle = '#cfd8e3';
  for (const n of ['東京', '名古屋', '新大阪', '広島', '博多']) {
    const s = STATIONS.find((x) => x.name === n);
    const p = sample(s.km);
    const [px, py] = mmT(p.x, p.z);
    const label = stationName(s);
    const w = g.measureText(label).width;
    const x = Math.min(320 - w - 2, Math.max(2, px - w / 2));
    g.fillText(label, x, py + (n === '東京' || n === '名古屋' ? -8 : 16));
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
  if (ns) { $('hud-next').textContent = stationName(ns); $('hud-nextd').textContent = (ns.km - P.km).toFixed(1) + 'km'; }
  $('hud-time').textContent = fmtTime(totalTime());
  $('hud-pen').textContent = P.booms ? t('hud.pen', { n: P.booms * 3 }) : '';
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
    $('pb-dist').textContent = d > 0 ? `${Math.round(d * 1000)}m` : t('hud.passing');
    arrow.textContent = laneSign() > 0 ? '▶' : '◀';
    arrow.className = d <= CROSS_WINDOW && d > -0.06 ? 'go' : d < 0.6 ? 'near' : '';
    $('pb-bar').firstElementChild.style.width = `${Math.max(0, Math.min(100, (1 - d / 1.2) * 100))}%`;
  }
  // 自分の線路上の列車
  const ln = traffic.nearestOnLane(P.km, Math.sign(P.lat) || 1);
  const pt = $('pb-train');
  if (ln && ln.dist < 6) {
    const onc = ln.train.dir < 0;
    pt.innerHTML = onc ? `<span class="danger">${t('hud.onc', { d: ln.dist.toFixed(1) })}</span>` : t('hud.ahead', { d: ln.dist.toFixed(1) });
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
const plainName = (n) => n.replace(/[（(].*?[）)]/, '').trim();
const voiceLang = () => t('voice.lang');
for (const s of STATIONS) {
  EVENTS.push({ km: s.km - 2.0, key: 'near:' + s.name, st: s, fn: () => announce(t('ann.near', { st: stationName(s) }), t('voice.near', { kana: s.kana, name: s.en })) });
}
for (const l of LANDMARKS) {
  if (l.type === 'river') continue;
  if (l.type === 'lake') {
    EVENTS.push({ km: l.km - 1.2, key: 'lm:' + l.name, fn: () => announce(t('ann.lake', { name: nameOf(l.name) }), t('voice.lake', { name: plainName(nameOf(l.name)) })) });
    continue;
  }
  const side = l.off > 0 ? 'L' : 'R';
  const lead = l.type === 'fuji' ? 22 : l.type === 'mountain' || l.type === 'mountaincastle' ? 4 : 0.9;
  EVENTS.push({ km: l.km - lead, key: 'lm:' + l.name, fn: () => announce(t('ann.see', { side: t('side.' + side), name: nameOf(l.name) }), t('voice.see', { side: t('side.' + side), name: plainName(nameOf(l.name)) })) });
}
for (const w of WATER) {
  EVENTS.push({ km: w[0] + 0.3, key: 'w:' + w[3], fn: () => announce(t('ann.water', { side: t('side.' + w[2]), name: nameOf(w[3]) }), null) });
}
for (const r of RIVER_LIST) {
  EVENTS.push({ km: r.km - r.len / 2 - 0.05, key: 'r:' + r.name, fn: () => announce(t('ann.bridge', { name: nameOf(r.name), m: Math.round(r.len * 1000).toLocaleString() }) + (r.truss ? t('ann.truss') : ''), null) });
}
for (const tn of TUNNEL_LIST) {
  if (!tn.name) continue;
  EVENTS.push({ km: tn.a - 0.02, key: 't:' + tn.name, fn: () => announce(t('ann.tunnel', { name: nameOf(tn.name), m: Math.round((tn.b - tn.a) * 1000).toLocaleString() }), null) });
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
      telop(t('telop.pass', { km: s.km.toFixed(1), clock: $('hud-clock').textContent }), stationName(s), getLang() === 'en' ? s.name : s.en);
      sound.chime();
    }
  }
}

// ---------------- 更新 ----------------
const tmp = { };
function accelRate(v) { return Math.max(3.5, 24 - v * 0.034); } // km/h/s
// アクセルを離すと惰行でゆっくり減速する (ブレーキはない)
function coastRate(v) { return 1.5 + v * 0.006; } // km/h/s

function stepRun(dt) {
  P.accel = keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space') || touchAccel;
  if (P.accel) P.v = Math.min(MAX_KMH, P.v + accelRate(P.v) * dt);
  else P.v = Math.max(0, P.v - coastRate(P.v) * dt);
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
  saveGame(); // 大破を記録してから保存 (閉じて読み込み直しても大破は消えない)
  const s = sample(P.km);
  const h = trackHeight(P.km);
  crashPos.set(s.x + s.lx * P.lat - world.origin.x, h + RAIL_Y, s.z + s.lz * P.lat - world.origin.z);
  explosions.push(new Explosion(scene, crashPos, new THREE.Vector3(s.tx, 0, s.tz)));
  traffic.remove(train);
  traffic.clearAround(P.km);
  sound.explosion();
  $('crash').hidden = false;
  $('crash-sub').textContent = t('crash.sub', { n: P.booms, v: Math.round(P.v) });
  $('flash').style.transition = 'none';
  $('flash').style.opacity = 1;
  requestAnimationFrame(() => { $('flash').style.transition = 'opacity 1.5s'; $('flash').style.opacity = 0; });
  P.v = 0;
  P.accel = false;
  P.pending = null;
  P.changing = null;
  sound.stopVoice();
}

// 大破のあと、広告を見れば 300km/h から再出発できる (アプリのみ・1 回の運転で 1 回)
let adOffer = null;
function offerAd() {
  if (!Ads.available || P.rewardUsed) return false;
  adOffer = { t: 10, waiting: false };
  $('crash').hidden = true;
  $('ac-note').textContent = '';
  $('ac-count').textContent = '10';
  $('ac-watch').disabled = false;
  $('adcont').hidden = false;
  return true;
}
function tickAdOffer(dt) {
  if (adOffer.waiting) return;
  adOffer.t -= dt;
  $('ac-count').textContent = String(Math.max(0, Math.ceil(adOffer.t)));
  if (adOffer.t <= 0) declineAd();
}
function closeAdOffer() {
  adOffer = null;
  $('adcont').hidden = true;
}
function declineAd() {
  closeAdOffer();
  respawn();
}
$('ac-skip').addEventListener('click', () => { if (adOffer && !adOffer.waiting) declineAd(); });
$('ac-watch').addEventListener('click', async () => {
  if (!adOffer || adOffer.waiting) return;
  adOffer.waiting = true;
  $('ac-watch').disabled = true;
  $('ac-note').textContent = t('ac.loading');
  const r = await Ads.showRewarded();
  if (r === 'rewarded') {
    P.rewardUsed = true;
    closeAdOffer();
    respawn(300);
  } else {
    adOffer.waiting = false;
    $('ac-watch').disabled = r === 'unavailable';
    $('ac-note').textContent = r === 'unavailable' ? t('ac.fail') : t('ac.skipped');
  }
});

function respawn(speed = 0) {
  P.lat = LANE_OFF;
  P.v = speed;
  traffic.clearAround(P.km);
  $('crash').hidden = true;
  state = 'countdown';
  countT = 2.2;
  $('countdown').hidden = false;
  $('countdown').textContent = t('cd.restart');
}

function finish() {
  state = 'finish';
  clearSave();
  P.km = course.goalKm;
  const st = STATIONS[course.to];
  telop(t('telop.arrive', { t: fmtTime(totalTime()), n: P.booms }), t('telop.arriveMain', { st: stationName(st) }), getLang() === 'en' ? st.name : st.en);
  sound.chime();
  sound.say(t('voice.arrive', { kana: st.kana, name: st.en }), voiceLang());
  const debugRun = /[?&](start|speed)=/.test(location.search);
  const total = totalTime();
  const recT = readRecord('time'), recC = readRecord('clean');
  const newT = !debugRun && (!recT || total < recT.time);
  const newC = !debugRun && P.booms === 0 && (!recC || P.time < recC.time);
  try {
    if (newT) localStorage.setItem(recordKey('time'), JSON.stringify({ time: total, booms: P.booms }));
    if (newC) localStorage.setItem(recordKey('clean'), JSON.stringify({ time: P.time }));
  } catch {}
  setTimeout(() => {
    $('res-title').textContent = t('res.title', { st: stationName(st) });
    $('res-course').textContent = t('res.courseV', { from: stationName(STATIONS[course.from]), to: stationName(st), km: (course.goalKm - course.startKm).toFixed(1) });
    $('res-run').textContent = fmtTime(P.time);
    $('res-boom').textContent = t('res.boomV', { n: P.booms, p: fmtTime(P.booms * PENALTY_SEC) });
    $('res-time').textContent = fmtTime(total);
    $('res-pass').textContent = t('res.passV', { n: P.passed });
    $('res-max').textContent = `${Math.round(P.maxV)} km/h`;
    const lines = [];
    lines.push(newT ? t('res.newTime') : recT ? t('res.recTime', { t: fmtTime(recT.time) }) : '');
    if (P.booms === 0) lines.push(newC ? t('res.newClean') : recC ? t('res.recClean', { t: fmtTime(recC.time) }) : '');
    else lines.push(t('res.cleanNote'));
    $('res-record').innerHTML = lines.filter(Boolean).map((l) => `<div>${l}</div>`).join('');
    setupShare(stationName(st), total);
    $('result').hidden = false;
    Ads.showBanner();
    $('hud').hidden = true;
    $('touch').hidden = true;
  }, 2500);
}

// ---------------- 結果のシェア ----------------
const SHARE_URL = 'https://techgym.jp/column/claude-code-game-shinkansen/';
let shareText = '';
function setupShare(goalName, total) {
  const from = stationName(STATIONS[course.from]);
  const boom = P.booms === 0 ? t('share.boomZero') : t('share.boomN', { n: P.booms });
  shareText = t('share.text', { from, to: goalName, km: (course.goalKm - course.startKm).toFixed(1), t: fmtTime(total), boom, v: Math.round(P.maxV) });
  const txt = encodeURIComponent(shareText), u = encodeURIComponent(SHARE_URL);
  $('share-x').href = `https://twitter.com/intent/tweet?text=${txt}&url=${u}`;
  $('share-line').href = `https://social-plugins.line.me/lineit/share?url=${u}&text=${txt}`;
  $('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
  $('share-text').value = `${shareText} ${SHARE_URL}`;
  // アプリでは Android の共有メニューを使う
  $('share-native').hidden = !canShareNative();
  $('share-native').textContent = isNative ? t('share.native') : t('share.other');
  for (const id of ['share-x', 'share-line', 'share-fb']) $(id).hidden = isNative;
  $('share-copy').textContent = t('share.copy');
}
$('share-native').addEventListener('click', () => {
  shareNative({ title: t('share.appTitle'), text: shareText, url: SHARE_URL, dialogTitle: t('share.title') });
});
$('share-copy').addEventListener('click', () => {
  const text = $('share-text').value;
  const done = () => { $('share-copy').textContent = t('share.copied'); };
  const fallback = () => { $('share-text').select(); try { document.execCommand('copy'); done(); } catch { $('share-copy').textContent = t('share.selected'); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
});

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
    $('countdown').textContent = t('cd.loading', { p: Math.min(100, Math.round((have / total) * 100)) });
    if (world.ready(P.km)) {
      $('countdown').style.fontSize = '';
      state = 'countdown';
      countT = 3.6;
      $('hud').hidden = false;
      $('touch').hidden = !isTouch;
      const st = STATIONS[course.from];
      if (resumed) {
        const near = STATIONS.reduce((a, b) => (Math.abs(b.km - P.km) < Math.abs(a.km - P.km) ? b : a));
        telop(t('telop.resume', { to: stationName(STATIONS[course.to]), km: P.km.toFixed(1) }), t('telop.resumeMain'), getLang() === 'en' ? `${near.name}付近` : `near ${near.en}`);
        sound.say(t('voice.resume', { kana: STATIONS[course.to].kana, name: STATIONS[course.to].en }), voiceLang());
      } else {
        telop(t('telop.depart', { to: stationName(STATIONS[course.to]) }), t('telop.departMain', { st: stationName(st) }), getLang() === 'en' ? st.name : st.en);
        sound.say(t('voice.depart', { kana: STATIONS[course.to].kana, name: STATIONS[course.to].en }), voiceLang());
      }
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
    $('countdown').textContent = $('countdown').textContent === t('cd.restart') && countT > 0.6 ? t('cd.restart') : n > 0 ? String(n) : t('cd.depart');
    if (countT <= 0) { $('countdown').hidden = true; state = 'run'; }
    traffic.update(simDt, P.km);
  } else if (state === 'run') {
    autosaveT += dt;
    if (autosaveT > 20) { autosaveT = 0; saveGame(); }
    const steps = Math.ceil(simDt / 0.04);
    for (let i = 0; i < steps && state === 'run'; i++) stepRun(simDt / steps);
  } else if (state === 'crash') {
    crashT += dt;
    traffic.update(simDt, P.km);
    if (adOffer) tickAdOffer(dt);
    else if (crashT > 4 && !offerAd()) respawn();
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
        if (alertTimer <= 0) { $('alert').textContent = onc ? t('alert.onc') : t('alert.ahead'); $('alert').className = 'show'; }
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
    if (a.voice) sound.say(a.voice, voiceLang());
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

// 表示言語
function refreshLang() {
  applyLang();
  labelStations();
  labelMinimap();
  loadBest();
  showContinue();
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
onLangChange(refreshLang);
refreshLang();

window.__dbg = { P, traffic, world, camera, get state() { return state; } };
requestAnimationFrame(frame);

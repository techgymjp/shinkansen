// 先行のぞみ・対向のぞみ・渡り線(ポイント)の管理と衝突判定
import * as THREE from '../vendor/three.module.min.js';
import { sample, trackHeight, TOTAL_KM, STATIONS, rng } from './route.js';
import { makeTrain, CAR_LEN, glowTex, canvasTex } from './models.js';
import { LANE_OFF, RAIL_Y, sweep, samplesBetween, yawOf } from './world.js';

export const NOZOMI_KMH = 300;
export const TRAIN_KM = 0.4; // 16両 = 400m
const CROSS_LEN = 0.2; // 渡り線の長さ (km)
export const CROSS_WINDOW = 0.22; // この距離手前から操作を受け付ける (km)

const crossMat = new THREE.MeshPhongMaterial({ color: 0xf0d050, emissive: 0x403000, shininess: 80, side: THREE.DoubleSide });
const signalMat = new THREE.MeshLambertMaterial({ color: 0x333a40 });

function arrowTex() {
  return canvasTex('arrows', 256, 128, (g, w, h) => {
    g.fillStyle = '#101418';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd23a';
    g.font = 'bold 96px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('⇄', w / 2, h / 2 + 6);
  });
}

export class Traffic {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.trains = [];
    this.crossovers = [];
    this.pool = { same: [], onc: [] };
    this.r = rng(42);
  }

  reset(km, goalKm) {
    for (const t of this.trains) this._release(t);
    for (const c of this.crossovers) this._removeCross(c);
    this.trains = [];
    this.crossovers = [];
    this.goalKm = goalKm;
    this.r = rng(Math.floor(km * 1000) + 99);
    this.nextSame = km + 2.6;
    this.nextOnc = km + 5 + this.r() * 3;
    this.nextCross = km + 0.9;
    this.update(0, km);
  }

  _acquire(oncoming) {
    const list = oncoming ? this.pool.onc : this.pool.same;
    const m = list.pop() || makeTrain(oncoming);
    m.visible = true;
    this.scene.add(m);
    return m;
  }
  _release(t) {
    this.scene.remove(t.mesh);
    (t.dir < 0 ? this.pool.onc : this.pool.same).push(t.mesh);
  }

  _spawn(dir, km) {
    const t = {
      dir,
      s: km,
      lane: dir > 0 ? LANE_OFF : -LANE_OFF,
      v: (NOZOMI_KMH / 3600) * dir,
      mesh: this._acquire(dir < 0),
      passed: false,
    };
    this.trains.push(t);
    return t;
  }

  _addCross(km) {
    const c = { km, len: CROSS_LEN, mesh: new THREE.Group() };
    const S = samplesBetween(km, km + CROSS_LEN, 0.01);
    const sm = (t) => t * t * (3 - 2 * t);
    const base = sample(km);
    for (const [o0, o1] of [[LANE_OFF, -LANE_OFF], [-LANE_OFF, LANE_OFF]]) {
      for (const g of [0.7175, -0.7175]) {
        const geo = sweep(S, (s) => {
          const t = sm((s.km - km) / CROSS_LEN);
          const o = o0 + (o1 - o0) * t + g;
          return [[o + 0.05, s.h + 0.2], [o, s.h + RAIL_Y + 0.02], [o - 0.05, s.h + 0.2]];
        }, base);
        c.mesh.add(new THREE.Mesh(geo, crossMat));
      }
    }
    // ポイント予告の信号門 (渡り線の手前)
    const sk = sample(km - 0.03);
    const h = trackHeight(km - 0.03);
    const gantry = new THREE.Group();
    for (const x of [-6.2, 6.2]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), signalMat);
      p.position.set(x, 4.5, 0);
      gantry.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.5, 0.5), signalMat);
    beam.position.y = 9;
    gantry.add(beam);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: arrowTex() }));
    panel.position.set(0, 10.4, 0.3);
    panel.rotation.y = Math.PI;
    gantry.add(panel);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc830, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.set(6, 6, 1);
    glow.position.set(0, 10.4, -0.4);
    gantry.add(glow);
    gantry.userData.glow = glow;
    gantry.position.set(sk.x - base.x, h, sk.z - base.z);
    gantry.rotation.y = yawOf(sk);
    c.mesh.add(gantry);
    c.glow = glow;
    c.base = base;
    this.scene.add(c.mesh);
    this._placeCross(c);
    this.crossovers.push(c);
  }
  _placeCross(c) {
    const o = this.world.origin;
    c.mesh.position.set(c.base.x - o.x, 0, c.base.z - o.z);
  }
  _removeCross(c) {
    this.scene.remove(c.mesh);
    c.mesh.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
  }

  reposition() {
    for (const c of this.crossovers) this._placeCross(c);
  }

  // 次の渡り線 (前方)
  nextCrossover(km) {
    for (const c of this.crossovers) if (c.km + c.len * 0.4 > km) return c;
    return null;
  }

  // 同じ線路上で前方にいる列車 (lane: 現在のオフセット)
  nearestOnLane(km, laneSign) {
    let best = null, bd = 1e9;
    for (const t of this.trains) {
      if (Math.sign(t.lane) !== laneSign) continue;
      const tail = t.dir > 0 ? t.s - TRAIN_KM : t.s;
      const d = tail - km;
      if (d > -0.02 && d < bd) { bd = d; best = t; }
    }
    return best ? { train: best, dist: bd } : null;
  }

  update(dt, km, camPos) {
    const r = this.r;
    for (const t of this.trains) t.s += t.v * dt;
    // 生成
    while (this.nextSame < km + 22) {
      if (this.nextSame < this.goalKm + 1) this._spawn(1, this.nextSame);
      this.nextSame += 4 + r() * 6;
    }
    // 対向列車は前方の見えない所から生成
    if (this.nextOnc < km + 6) this.nextOnc = km + 6 + r() * 2;
    while (this.nextOnc < km + 22) {
      if (this.nextOnc < TOTAL_KM - 0.3) this._spawn(-1, this.nextOnc);
      this.nextOnc += 3.2 + r() * 6;
    }
    while (this.nextCross < km + 12) {
      const k = this.nextCross;
      const nearSt = STATIONS.some((s) => k > s.km - 0.45 && k < s.km + 0.35);
      if (!nearSt && k < this.goalKm - 0.5) this._addCross(k);
      this.nextCross += 0.9 + r() * 1.3;
    }
    // 破棄
    this.trains = this.trains.filter((t) => {
      const rear = t.dir > 0 ? t.s - TRAIN_KM : t.s + TRAIN_KM;
      const gone = (t.dir > 0 ? rear < km - 3 || t.s > TOTAL_KM + 2 : rear < km - 3) ;
      if (gone) this._release(t);
      return !gone;
    });
    this.crossovers = this.crossovers.filter((c) => {
      const gone = c.km + c.len < km - 0.6;
      if (gone) this._removeCross(c);
      return !gone;
    });
    this._layout(km, camPos);
  }

  _layout(km, camPos) {
    const o = this.world.origin;
    for (const t of this.trains) {
      const near = Math.abs(t.s - km) < 9;
      t.mesh.visible = near;
      if (!near) continue;
      const cars = t.mesh.userData.cars;
      for (let i = 0; i < cars.length; i++) {
        const d = (i * CAR_LEN + CAR_LEN / 2) / 1000;
        const ck = t.dir > 0 ? t.s - d : t.s + d;
        const s = sample(ck);
        const h = trackHeight(ck);
        cars[i].position.set(s.x + s.lx * t.lane - o.x, h + RAIL_Y, s.z + s.lz * t.lane - o.z);
        cars[i].rotation.y = yawOf(s) + (t.dir > 0 ? 0 : Math.PI);
      }
      if (camPos) {
        const head = t.mesh.userData.head;
        const dist = cars[0].position.distanceTo(camPos);
        const sc = Math.min(60, Math.max(3, dist * 0.012));
        head.scale.set(sc, sc, 1);
        const tail = t.mesh.userData.tail;
        const dt = cars[15].position.distanceTo(camPos);
        const st = Math.min(30, Math.max(2, dt * 0.006));
        tail.scale.set(st, st, 1);
      }
    }
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 120);
    for (const c of this.crossovers) {
      const d = c.km - km;
      const sc = (d > 0 ? Math.min(40, Math.max(5, d * 1000 * 0.01)) : 5) * (d < CROSS_WINDOW && d > -0.05 ? pulse * 1.4 : 1);
      c.glow.scale.set(sc, sc, 1);
    }
  }

  // 衝突判定: 自列車の先頭 (前頭部 20m) と他列車
  collide(km, lat) {
    for (const t of this.trains) {
      if (Math.abs(lat - t.lane) > 3.3) continue;
      const lo = t.dir > 0 ? t.s - TRAIN_KM : t.s;
      const hi = t.dir > 0 ? t.s : t.s + TRAIN_KM;
      if (km >= lo && km - 0.02 <= hi) return t;
    }
    return null;
  }

  remove(t) {
    this._release(t);
    this.trains = this.trains.filter((x) => x !== t);
  }

  // 大破後の再出発のために周囲を空ける
  clearAround(km) {
    this.trains = this.trains.filter((t) => {
      let kill = false;
      if (t.dir > 0) kill = t.s > km - 12 && t.s - TRAIN_KM < km + 2.5;
      else kill = t.s < km + 7 && t.s + TRAIN_KM > km - 0.5;
      if (kill) this._release(t);
      return !kill;
    });
    if (this.nextOnc < km + 7) this.nextOnc = km + 7;
  }

  // すれ違い・追い越しイベント (効果音用)
  passEvents(km, lat) {
    const ev = [];
    for (const t of this.trains) {
      const rel = t.s - km;
      if (t.dir < 0 && !t.passed && rel < 0) { t.passed = true; if (Math.abs(lat - t.lane) > 2) ev.push('onc'); }
      if (t.dir > 0 && !t.passed && t.s - TRAIN_KM / 2 < km) { t.passed = true; if (Math.abs(lat - t.lane) > 2) ev.push('same'); }
    }
    return ev;
  }
}

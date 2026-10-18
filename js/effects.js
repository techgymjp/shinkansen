// 大爆発エフェクト
import * as THREE from '../vendor/three.module.min.js';
import { canvasTex, mat } from './models.js';

const fireTex = () => canvasTex('fire', 128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,220,1)');
  gr.addColorStop(0.25, 'rgba(255,200,60,0.95)');
  gr.addColorStop(0.55, 'rgba(240,80,10,0.6)');
  gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});
const smokeTex = () => canvasTex('smoke', 128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(60,55,50,0.9)');
  gr.addColorStop(0.6, 'rgba(50,45,40,0.5)');
  gr.addColorStop(1, 'rgba(40,40,40,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});

export class Explosion {
  constructor(scene, pos, dir) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.t = 0;
    this.parts = [];
    const fm = new THREE.SpriteMaterial({ map: fireTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    const sm = new THREE.SpriteMaterial({ map: smokeTex(), depthWrite: false, transparent: true });
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(fm.clone());
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4 + 0.2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(8 + Math.random() * 30);
      v.addScaledVector(dir, 10);
      s.position.set((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4);
      this.group.add(s);
      this.parts.push({ s, v, kind: 'fire', life: 1.2 + Math.random() * 1.5, size: 6 + Math.random() * 10 });
    }
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(sm.clone());
      const v = new THREE.Vector3((Math.random() - 0.5) * 8, 6 + Math.random() * 10, (Math.random() - 0.5) * 8);
      s.position.set((Math.random() - 0.5) * 6, 3, (Math.random() - 0.5) * 6);
      s.material.opacity = 0;
      this.group.add(s);
      this.parts.push({ s, v, kind: 'smoke', life: 5 + Math.random() * 3, delay: 0.2 + Math.random() * 1.0, size: 10 + Math.random() * 14 });
    }
    const dm = [mat(0xf3f5f7), mat(0x0b3c9c), mat(0x30343a), mat(0x9aa3ab)];
    const dg = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(dg, dm[i % 4]);
      m.scale.set(0.5 + Math.random() * 3, 0.2 + Math.random() * 1.5, 0.5 + Math.random() * 4);
      m.position.set((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3);
      const v = new THREE.Vector3((Math.random() - 0.5) * 50, 10 + Math.random() * 35, (Math.random() - 0.5) * 50).addScaledVector(dir, 25);
      this.group.add(m);
      this.parts.push({ s: m, v, kind: 'debris', life: 99, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10) });
    }
    this.light = new THREE.PointLight(0xffaa44, 50, 600, 1.2);
    this.light.position.set(0, 8, 0);
    this.group.add(this.light);
    scene.add(this.group);
  }

  update(dt) {
    this.t += dt;
    this.light.intensity = Math.max(0, 50 * (1 - this.t / 2.5));
    for (const p of this.parts) {
      if (p.kind === 'fire') {
        const k = Math.min(1, this.t / p.life);
        p.s.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(1 - dt * 1.5);
        p.v.y += dt * 4;
        const sz = p.size * (0.4 + k * 2.2);
        p.s.scale.set(sz, sz, 1);
        p.s.material.opacity = Math.max(0, 1 - k);
      } else if (p.kind === 'smoke') {
        const t = this.t - p.delay;
        if (t < 0) continue;
        const k = Math.min(1, t / p.life);
        p.s.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(1 - dt * 0.3);
        const sz = p.size * (0.6 + k * 3);
        p.s.scale.set(sz, sz, 1);
        p.s.material.opacity = Math.min(0.8, t * 2) * (1 - k);
      } else {
        if (p.s.position.y > 0.3) {
          p.v.y -= 30 * dt;
          p.s.position.addScaledVector(p.v, dt);
          p.s.rotation.x += p.spin.x * dt;
          p.s.rotation.y += p.spin.y * dt;
        } else {
          p.s.position.y = 0.3;
        }
      }
    }
    return this.t < 8;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.material && o.isSprite) o.material.dispose(); });
  }
}

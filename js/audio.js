// WebAudio による走行音・効果音 (すべて合成)
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w; // ブラウンノイズ寄り
      d[i] = w * 0.5 + b * 3;
    }
    this.noiseBuf = buf;
    const noise = () => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };
    // 転動音
    this.roll = ctx.createBiquadFilter();
    this.roll.type = 'lowpass';
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    noise().connect(this.roll).connect(this.rollGain).connect(this.master);
    // 風切り音
    this.wind = ctx.createBiquadFilter();
    this.wind.type = 'bandpass';
    this.wind.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise().connect(this.wind).connect(this.windGain).connect(this.master);
    // モーター (VVVFインバータ風)
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    const mf = ctx.createBiquadFilter();
    mf.type = 'bandpass';
    mf.frequency.value = 900;
    mf.Q.value = 0.8;
    this.motorGain.connect(this.master);
    mf.connect(this.motorGain);
    this.motors = [1, 1.5, 2.02].map((k, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'square';
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.12;
      o.connect(g).connect(mf);
      o.start();
      return { o, k };
    });
    this.tunnel = 0;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  // speed: km/h, accel: 力行中か, tunnel: 0..1
  update(speed, accel, tunnel) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = speed / 600;
    this.roll.frequency.setTargetAtTime(180 + v * 900 + tunnel * 300, t, 0.1);
    this.rollGain.gain.setTargetAtTime(Math.min(1, v * 1.2) * (0.25 + tunnel * 0.35), t, 0.1);
    this.wind.frequency.setTargetAtTime(500 + v * 2500, t, 0.1);
    this.windGain.gain.setTargetAtTime(v * v * (0.18 + tunnel * 0.25), t, 0.1);
    // VVVF: 低速域では音階的に上昇
    const f = speed < 60 ? 220 + speed * 18 : 60 + speed * 2.4;
    for (const m of this.motors) m.o.frequency.setTargetAtTime(f * m.k, t, 0.05);
    this.motorGain.gain.setTargetAtTime((accel ? 0.05 : 0.012) * Math.min(1, speed / 20 + 0.2) * (speed > 0.5 ? 1 : 0), t, 0.15);
  }

  _burst(dur, freq, q, gain, type = 'lowpass', sweepTo) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.15, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.1);
  }

  passBy() { this._burst(1.6, 2500, 0.7, 0.9, 'bandpass', 400); }
  tunnelIn() { this._burst(0.8, 300, 0.5, 1.2, 'lowpass', 120); }
  clack() {
    for (let i = 0; i < 2; i++) setTimeout(() => this._burst(0.12, 1800, 1.5, 0.6, 'bandpass'), i * 90);
  }

  explosion() {
    if (!this.ctx) return;
    this._burst(3.5, 1200, 0.3, 2.5, 'lowpass', 60);
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(25, t + 1.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 2.1);
  }

  tone(freqs, dur = 0.5, type = 'sine', gain = 0.25, gap = 0.28) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * gap;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }
  chime() { this.tone([784, 659, 523, 659, 784, 1046], 0.6, 'sine', 0.18, 0.22); }
  beep() { this.tone([1200], 0.08, 'square', 0.08); }
  warn() { this.tone([880, 880], 0.12, 'square', 0.1, 0.16); }
  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [466, 587]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      g.gain.setValueAtTime(0.12, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.2);
    }
  }

  // 車内放送 (音声合成)
  say(text) {
    if (this.muted || !this.voice || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

// audio.js — procedural WebAudio only: no samples, every sound is built
// from oscillators and filtered noise at play time. Engine hum follows the
// player's speed, police sirens wail two-tone, and UI events get short stings.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenNodes = [];
    this.lastShot = 0;
  }

  // Must be called from a user gesture at least once.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.startEngine();
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(m ? 0 : 0.55, this.ctx.currentTime);
  }

  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 28;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    this.engineOsc.connect(this.engineFilter);
    sub.connect(subGain); subGain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start(); sub.start();
    this.engineSub = sub;
  }

  // speedRatio 0..1, active only while the player is driving.
  engine(speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = driving ? 0.05 + speedRatio * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.09);
    const f = 52 + speedRatio * 165;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06);
    if (this.engineSub) this.engineSub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(280 + speedRatio * 900, t, 0.08);
  }

  blip(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, freq, q = 1, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  gunshot() {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastShot < 45) return;
    this.lastShot = now;
    this.noise(0.14, 0.5, 900, 0.6);
    this.blip(160, 0.1, 'square', 0.22, 45);
  }

  melee() { this.noise(0.07, 0.25, 500, 1.2); }
  crash(hard) { this.noise(hard ? 0.3 : 0.15, hard ? 0.5 : 0.28, 300, 0.7); this.blip(90, 0.18, 'triangle', 0.25, 40); }
  honk() { this.blip(370, 0.16, 'square', 0.1); this.blip(466, 0.16, 'square', 0.08); }
  pickup() { this.blip(880, 0.09, 'sine', 0.22); this.blip(1318, 0.14, 'sine', 0.22, null, 0.08); }
  cash() { this.blip(1046, 0.08, 'triangle', 0.2); this.blip(1568, 0.16, 'triangle', 0.2, null, 0.07); }
  sting(win) {
    if (win) { this.blip(523, 0.14, 'triangle', 0.22); this.blip(659, 0.14, 'triangle', 0.22, null, 0.12); this.blip(784, 0.3, 'triangle', 0.24, null, 0.24); }
    else { this.blip(392, 0.2, 'triangle', 0.22); this.blip(311, 0.34, 'triangle', 0.22, null, 0.16); }
  }
  busted() { this.blip(220, 0.3, 'sawtooth', 0.16, 110); this.blip(220, 0.4, 'sawtooth', 0.16, 82, 0.28); }
  door() { this.blip(140, 0.07, 'square', 0.12, 90); }

  // One wailing siren voice; the police system keeps as many alive as needed.
  sirenStart() {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.65;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    o.frequency.value = 830;
    o.connect(g); g.connect(this.master);
    o.start(); lfo.start();
    const node = { o, g, lfo };
    this.sirenNodes.push(node);
    return node;
  }
  sirenSet(node, vol) {
    if (!node || !this.ctx) return;
    node.g.gain.setTargetAtTime(Math.min(0.06, vol), this.ctx.currentTime, 0.2);
  }
  sirenStop(node) {
    if (!node) return;
    try { node.o.stop(); node.lfo.stop(); } catch (err) { /* already stopped */ }
    const i = this.sirenNodes.indexOf(node);
    if (i >= 0) this.sirenNodes.splice(i, 1);
  }
}

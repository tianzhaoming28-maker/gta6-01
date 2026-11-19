// Coral Vice - synthesized sound with WebAudio. No audio files:
// every effect is an oscillator/noise recipe, and the music is a
// small procedural loop in a sun-bleached minor groove.
'use strict';

CV.Audio = {
  ctx: null,
  master: null,
  musicGain: null,
  muted: false,
  musicTimer: null,
  step: 0,

  // Must be called from a user gesture at least once.
  init: function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.startMusic();
  },

  toggleMute: function () {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },

  // Short enveloped tone.
  tone: function (freq, dur, type, vol, slideTo, dest) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest || this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  // Filtered noise burst, for hits, shots and crashes.
  noise: function (dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    var buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buffer;
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    var g = this.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  },

  shoot: function () {
    this.noise(0.09, 0.30, 2600);
    this.tone(160, 0.08, 'square', 0.12, 60);
  },

  punch: function () {
    this.noise(0.06, 0.22, 700);
    this.tone(90, 0.07, 'sine', 0.25, 45);
  },

  hurt: function () {
    this.tone(220, 0.12, 'sawtooth', 0.14, 110);
  },

  crash: function (hard) {
    this.noise(hard ? 0.30 : 0.15, hard ? 0.4 : 0.22, 900);
    this.tone(70, 0.2, 'triangle', 0.2, 35);
  },

  cash: function () {
    var self = this;
    this.tone(880, 0.09, 'square', 0.14);
    setTimeout(function () { self.tone(1318, 0.14, 'square', 0.14); }, 70);
  },

  honk: function () {
    this.tone(370, 0.15, 'square', 0.09);
    this.tone(466, 0.15, 'square', 0.07);
  },

  pickup: function () {
    var self = this;
    this.tone(1046, 0.07, 'sine', 0.16);
    setTimeout(function () { self.tone(1568, 0.10, 'sine', 0.16); }, 55);
  },

  door: function () {
    this.tone(320, 0.06, 'triangle', 0.15, 210);
    this.noise(0.05, 0.08, 1500);
  },

  sirenBlip: function () {
    this.tone(660, 0.12, 'triangle', 0.06, 990);
  },

  missionDone: function () {
    var self = this;
    var notes = [523, 659, 784, 1046];
    notes.forEach(function (n, i) {
      setTimeout(function () { self.tone(n, 0.16, 'square', 0.13); }, i * 95);
    });
  },

  missionFail: function () {
    var self = this;
    var notes = [392, 330, 262];
    notes.forEach(function (n, i) {
      setTimeout(function () { self.tone(n, 0.18, 'sawtooth', 0.10); }, i * 120);
    });
  },

  // ---- Procedural music loop -------------------------------------------
  // A 16-step pattern: bass line in A minor with a soft lead sparkle.
  BASS: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0],
  LEAD: [440, 0, 0, 523, 0, 0, 659, 0, 587, 0, 0, 523, 0, 494, 0, 0],

  startMusic: function () {
    if (!this.ctx || this.musicTimer) return;
    var self = this;
    this.musicTimer = setInterval(function () {
      if (self.muted || !self.ctx) return;
      var i = self.step % 16;
      var b = self.BASS[i];
      if (b) self.tone(b, 0.22, 'triangle', 0.5, null, self.musicGain);
      var l = self.LEAD[i];
      if (l && self.step % 32 < 16) self.tone(l, 0.18, 'sine', 0.20, null, self.musicGain);
      // Soft hat on off-beats.
      if (i % 4 === 2) self.noiseHat();
      self.step++;
    }, 150);
  },

  noiseHat: function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * 0.03);
    var buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    var src = this.ctx.createBufferSource();
    src.buffer = buffer;
    var filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    var g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(t);
  }
};

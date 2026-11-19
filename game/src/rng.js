// Coral Vice - deterministic seeded random number generator.
// A mulberry32 core: tiny, fast and perfectly reproducible, which is
// what makes screenshot scenes and city layouts deterministic.
'use strict';

CV.Rng = function (seed) {
  this.state = (seed >>> 0) || 1;
};

CV.Rng.prototype.next = function () {
  // mulberry32 step
  this.state = (this.state + 0x6D2B79F5) >>> 0;
  var t = this.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

CV.Rng.prototype.range = function (min, max) {
  return min + this.next() * (max - min);
};

CV.Rng.prototype.int = function (min, max) {
  // inclusive on both ends
  return min + Math.floor(this.next() * (max - min + 1));
};

CV.Rng.prototype.pick = function (arr) {
  return arr[Math.floor(this.next() * arr.length)];
};

CV.Rng.prototype.chance = function (p) {
  return this.next() < p;
};

// Shuffle in place using this generator, returns the array.
CV.Rng.prototype.shuffle = function (arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(this.next() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
};

// A stable hash of a string, used to seed per-block variation.
CV.hashString = function (str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Clamp / lerp helpers shared everywhere.
CV.clamp = function (v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
};

CV.lerp = function (a, b, t) {
  return a + (b - a) * t;
};

// Shortest-path angle interpolation, angles in radians.
CV.angleLerp = function (a, b, t) {
  var d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

CV.dist2 = function (ax, ay, bx, by) {
  var dx = ax - bx;
  var dy = ay - by;
  return dx * dx + dy * dy;
};

CV.dist = function (ax, ay, bx, by) {
  return Math.sqrt(CV.dist2(ax, ay, bx, by));
};

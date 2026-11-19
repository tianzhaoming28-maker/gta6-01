// Coral Vice - game state, main loop and the glue between systems.
// Owns the wanted system, day/night cycle, camera, damage/death,
// banners and toasts, saving, and the start/pause/wasted flow.
'use strict';

CV.Game = {
  state: 'menu',        // menu | play | paused | wasted
  time: 0,
  seed: 20261119,
  rng: null,
  canvas: null,
  ctx: null,
  player: null,
  camera: { x: 0, y: 0 },
  cameraLift: 6,
  cash: 120,
  crimePoints: 0,
  stars: 0,
  bullets: [],
  recentShotT: 0,
  muzzleT: 0,
  shake: 0,
  hurtFlash: 0,
  banner: null,
  toast: null,
  dayT: 0.42,           // 0..1, fraction of a 24h day
  nightAmount: 0,
  duskAmount: 0,
  landmarks: null,
  stats: null,
  menuRects: [],
  showHelp: false,
  autosaveT: 0,
  wastedT: 0,
  shotMode: null,
  lastCrimeSeen: false,

  DAY_LENGTH: 320,      // seconds per full day

  init: function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    CV.Input.attach(canvas);
    this.resetStats();

    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    this.buildWorld(this.seed);
    if (shot && CV.Shots.names.indexOf(shot) >= 0) {
      this.shotMode = shot;
      this.runShot(shot);
      return;
    }
    this.state = 'menu';
    this.startLoop();
  },

  resetStats: function () {
    this.stats = { earned: 0, stolen: 0, shots: 0, time: 0, copsDown: 0 };
  },

  // (Re)build the whole world from a seed and place the player.
  buildWorld: function (seed) {
    this.rng = new CV.Rng(seed);
    CV.World.generate(seed);
    CV.Traffic.init(this.rng, CV.World);
    CV.Pedestrians.init(this.rng, CV.World);
    CV.Police.reset();
    this.bullets = [];
    this.pickups = [];
    this.crimePoints = 0;
    this.stars = 0;

    var spawn = CV.Traffic.nodePos(4, 5);
    this.player = CV.Player.create(spawn.x - CV.ROAD / 2 + 6, spawn.y + 30);
    this.landmarks = {
      cafe: { x: CV.World.roadCenterX(CV.COLS - 1), y: CV.World.roadCenterY(2) },
      garage: { x: CV.World.roadCenterX(2), y: CV.World.roadCenterY(6) },
      marina: { x: CV.World.roadCenterX(1), y: CV.World.roadCenterY(CV.ROWS - 1) },
      motel: { x: CV.World.roadCenterX(5), y: CV.World.roadCenterY(2) },
      pier: { x: CV.World.roadCenterX(CV.COLS), y: CV.World.roadCenterY(CV.ROWS - 1) },
      hospital: { x: CV.World.roadCenterX(3), y: CV.World.roadCenterY(3) }
    };
    this.snapCamera();
    this.updateDayNight();
  },

  newGame: function () {
    CV.Save.clear();
    this.resetStats();
    this.cash = 120;
    this.buildWorld(this.seed);
    CV.Missions.init(this, 0, false);
    this.state = 'play';
    this.showBanner('Coral Vice', 'Mari Vega owes the Flamingo Syndicate $9,000. Time to work.', 5);
  },

  continueGame: function () {
    var data = CV.Save.read();
    if (!data) {
      this.newGame();
      return;
    }
    this.resetStats();
    this.cash = data.cash || 0;
    this.stats.earned = data.totalEarned || 0;
    this.stats.stolen = data.carsStolen || 0;
    this.stats.shots = data.shotsFired || 0;
    this.stats.time = data.timePlayed || 0;
    this.buildWorld(data.seed || this.seed);
    if (typeof data.playerX === 'number') {
      this.player.x = CV.clamp(data.playerX, 10, CV.WORLD_W - 10);
      this.player.y = CV.clamp(data.playerY, 10, CV.WORLD_H - 10);
      this.snapCamera();
    }
    CV.Missions.init(this, data.missionIndex || 0, !!data.storyDone);
    this.state = 'play';
    this.showToast('Welcome back, Mari. Cash $' + this.cash + '.');
  },

  // ---- Wanted system -------------------------------------------------------
  witnessesAt: function (x, y) {
    var peds = CV.Pedestrians.list;
    for (var i = 0; i < peds.length; i++) {
      if (peds[i].state !== 'down' && CV.dist(x, y, peds[i].x, peds[i].y) < 150) return true;
    }
    var units = CV.Police.units;
    for (var j = 0; j < units.length; j++) {
      var ref = units[j].kind === 'car' ? units[j].car : units[j];
      if (ref && CV.dist(x, y, ref.x, ref.y) < 330) return true;
    }
    return false;
  },

  addCrime: function (points, x, y) {
    if (this.state !== 'play') return;
    var seen = this.witnessesAt(x, y);
    this.crimePoints += seen ? points : points * 0.4;
    this.crimePoints = Math.min(this.crimePoints, CV.STAR_POINTS * 5 + 10);
    this.lastCrimeSeen = seen;
    this.updateStars();
  },

  updateStars: function () {
    var s = Math.floor(this.crimePoints / CV.STAR_POINTS);
    this.stars = CV.clamp(s, 0, 5);
  },

  policeNear: function (dist) {
    var units = CV.Police.units;
    for (var i = 0; i < units.length; i++) {
      var ref = units[i].kind === 'car' ? units[i].car : units[i];
      if (ref && !units[i].dead &&
          CV.dist(this.player.x, this.player.y, ref.x, ref.y) < dist) return true;
    }
    return false;
  },

  updateWanted: function (dt) {
    // Decay only while nobody in uniform is watching.
    if (!this.policeNear(300) && this.recentShotT <= 0) {
      this.crimePoints = Math.max(0, this.crimePoints - CV.WANTED_DECAY * 2.4 * dt);
    } else {
      this.crimePoints = Math.max(0, this.crimePoints - CV.WANTED_DECAY * 0.3 * dt);
    }
    this.updateStars();
  },

  // ---- Events from other systems -------------------------------------------
  onPlayerCrash: function (impact) {
    this.shake = Math.min(15, impact * 0.055);
    if (this.player.mode === 'car' && impact > 165) {
      this.damagePlayer((impact - 150) * 0.10);
    }
    if (impact > 130) {
      this.addCrime(CV.CRIME_HIT_CAR, this.player.x, this.player.y);
    }
  },

  onPunchLanded: function (ped) {
    this.shake = Math.max(this.shake, 2);
  },

  onEnterCar: function (car) {
    this.showToast(car.type.name + ' - ' + (car.parked ? 'hot-wired' : 'jacked'));
  },

  damagePlayer: function (amount) {
    if (this.state !== 'play' || this.player.hp <= 0) return;
    this.player.hp -= amount;
    this.hurtFlash = 1;
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.state = 'wasted';
      this.wastedT = 2.4;
      CV.Audio.missionFail();
    }
  },

  respawn: function () {
    var p = this.player;
    if (p.mode === 'car' && p.car) {
      p.car.driver = null;
      p.car.parked = true;
      p.car = null;
      p.mode = 'foot';
    }
    var bill = Math.min(this.cash, Math.max(25, Math.floor(this.cash * 0.12)));
    this.cash -= bill;
    p.hp = CV.PLAYER_MAX_HP;
    p.x = this.landmarks.hospital.x;
    p.y = this.landmarks.hospital.y;
    this.crimePoints = 0;
    this.stars = 0;
    CV.Police.reset();
    this.snapCamera();
    this.state = 'play';
    this.showBanner('Discharged', 'Hospital bill: $' + bill + '. The Syndicate still waits.', 4);
    CV.Save.write(this);
  },

  // Used by traffic AI: is a pedestrian in the braking zone?
  pedInFront: function (car, dist) {
    var fx = Math.cos(car.angle);
    var fy = Math.sin(car.angle);
    var peds = CV.Pedestrians.list;
    for (var i = 0; i < peds.length; i++) {
      var ped = peds[i];
      if (ped.state === 'down') continue;
      var dx = ped.x - car.x;
      var dy = ped.y - car.y;
      var fwd = dx * fx + dy * fy;
      var side = Math.abs(dx * -fy + dy * fx);
      if (fwd > 2 && fwd < dist && side < 11) return true;
    }
    return false;
  },

  // ---- UI helpers ------------------------------------------------------------
  showBanner: function (title, sub, dur) {
    this.banner = { title: title, sub: sub, t: dur || 4 };
  },

  showToast: function (text) {
    this.toast = { text: text, t: 3.2 };
  },

  clockText: function () {
    var mins = Math.floor(this.dayT * 24 * 60);
    var hh = Math.floor(mins / 60);
    var mm = mins % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  },

  updateDayNight: function () {
    var hour = this.dayT * 24;
    // Smooth night curve: full night 21:00-05:00, full day 08:00-17:30.
    var n;
    if (hour < 5) n = 1;
    else if (hour < 8) n = 1 - (hour - 5) / 3;
    else if (hour < 17.5) n = 0;
    else if (hour < 21) n = (hour - 17.5) / 3.5;
    else n = 1;
    this.nightAmount = CV.clamp(n, 0, 1);
    // Dusk glow near sunrise/sunset.
    var dusk = 0;
    if (hour > 17 && hour < 20) dusk = 1 - Math.abs(hour - 18.5) / 1.5;
    if (hour > 5.5 && hour < 8) dusk = 1 - Math.abs(hour - 6.75) / 1.25;
    this.duskAmount = CV.clamp(dusk, 0, 1);
  },

  snapCamera: function () {
    this.camera.x = CV.clamp(this.player.x - CV.VIEW_W / 2, 0, Math.max(0, CV.WORLD_W - CV.VIEW_W));
    this.camera.y = CV.clamp(this.player.y - CV.VIEW_H / 2, 0, Math.max(0, CV.WORLD_H - CV.VIEW_H));
  },

  updateCamera: function (dt) {
    var p = this.player;
    var leadX = 0;
    var leadY = 0;
    if (p.mode === 'car' && p.car) {
      leadX = p.car.vx * 0.45;
      leadY = p.car.vy * 0.45;
    }
    var tx = CV.clamp(p.x + leadX - CV.VIEW_W / 2, 0, Math.max(0, CV.WORLD_W - CV.VIEW_W));
    var ty = CV.clamp(p.y + leadY - CV.VIEW_H / 2, 0, Math.max(0, CV.WORLD_H - CV.VIEW_H));
    var k = this.shotMode ? 1 : CV.clamp(dt * 5, 0, 1);
    this.camera.x = CV.lerp(this.camera.x, tx, k);
    this.camera.y = CV.lerp(this.camera.y, ty, k);
  },

  // ---- Main update -------------------------------------------------------------
  update: function (dt) {
    this.time += dt;
    if (this.banner && this.banner.t > 0) this.banner.t -= dt;
    if (this.toast && this.toast.t > 0) this.toast.t -= dt;
    if (this.recentShotT > 0) this.recentShotT -= dt;
    if (this.muzzleT > 0) this.muzzleT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);

    if (this.state === 'menu') {
      this.updateMenu();
      // Idle city life behind the menu.
      CV.Traffic.update(dt, this);
      CV.Pedestrians.update(dt, this);
      this.updateCamera(dt);
      return;
    }
    if (this.state === 'wasted') {
      this.wastedT -= dt;
      if (this.wastedT <= 0) this.respawn();
      return;
    }
    if (this.state === 'paused') {
      if (CV.Input.hit('KeyP') || CV.Input.hit('Escape')) this.state = 'play';
      return;
    }
    if (this.state !== 'play') return;

    if (CV.Input.hit('KeyP') || CV.Input.hit('Escape')) {
      this.state = 'paused';
      CV.Save.write(this);
      return;
    }
    if (CV.Input.hit('KeyM')) {
      this.showToast(CV.Audio.toggleMute() ? 'Sound off' : 'Sound on');
    }

    this.stats.time += dt;
    this.dayT = (this.dayT + dt / this.DAY_LENGTH) % 1;
    this.updateDayNight();

    CV.Player.update(dt, this);
    CV.Traffic.update(dt, this);
    // Car vs car collisions across the whole fleet.
    var cars = CV.Traffic.cars;
    for (var i = 0; i < cars.length; i++) {
      for (var j = i + 1; j < cars.length; j++) {
        CV.carVsCar(cars[i], cars[j]);
      }
    }
    CV.Pedestrians.update(dt, this);
    CV.Pedestrians.checkCarHits(this);
    CV.Police.update(dt, this);
    CV.Player.updateProjectiles(dt, this);
    this.updateThugs(dt);
    CV.Missions.update(dt, this);
    this.updateWanted(dt);
    this.updateCamera(dt);

    // Slow health regen when calm and unhurt for a while.
    if (this.stars === 0 && this.player.hp > 0 && this.player.hp < CV.PLAYER_MAX_HP) {
      this.player.hp = Math.min(CV.PLAYER_MAX_HP, this.player.hp + dt * 1.6);
    }

    this.autosaveT += dt;
    if (this.autosaveT > 20) {
      this.autosaveT = 0;
      CV.Save.write(this);
    }
  },

  // Mission collectors shoot back.
  updateThugs: function (dt) {
    var peds = CV.Pedestrians.list;
    var p = this.player;
    for (var i = 0; i < peds.length; i++) {
      var t = peds[i];
      if (!t.hostile || t.state === 'down') continue;
      var d = CV.dist(t.x, t.y, p.x, p.y);
      t.fireCd = (t.fireCd || 1) - dt;
      if (d > 130) {
        var a = Math.atan2(p.y - t.y, p.x - t.x);
        CV.Pedestrians.move(t, a, 74, dt);
      } else {
        t.angle = Math.atan2(p.y - t.y, p.x - t.x);
      }
      if (d < 215 && t.fireCd <= 0) {
        t.fireCd = this.rng.range(0.6, 1.2);
        var a2 = Math.atan2(p.y - t.y, p.x - t.x);
        var spread = (this.rng.next() - 0.5) * 0.16;
        this.bullets.push({
          x: t.x + Math.cos(a2) * 12,
          y: t.y + Math.sin(a2) * 12,
          vx: Math.cos(a2 + spread) * 540,
          vy: Math.sin(a2 + spread) * 540,
          life: 0.5,
          from: 'police',
          dmg: 9
        });
        CV.Audio.shoot();
      }
    }
  },

  updateMenu: function () {
    if (CV.Input.mouseClicked && this.menuRects) {
      CV.Audio.init();
      for (var i = 0; i < this.menuRects.length; i++) {
        var r = this.menuRects[i];
        if (CV.Input.mouseX >= r.x && CV.Input.mouseX <= r.x + r.w &&
            CV.Input.mouseY >= r.y && CV.Input.mouseY <= r.y + r.h) {
          if (r.key === 'continue') {
            if (CV.Save.has()) this.continueGame();
            else this.newGame();
          } else if (r.key === 'new') {
            this.newGame();
          } else if (r.key === 'help') {
            this.showHelp = !this.showHelp;
          }
          return;
        }
      }
    }
    if (CV.Input.hit('Enter')) {
      CV.Audio.init();
      if (CV.Save.has()) this.continueGame();
      else this.newGame();
    }
  },

  // ---- Loop ---------------------------------------------------------------------
  startLoop: function () {
    var self = this;
    var last = 0;
    var acc = 0;
    function frame(ts) {
      window.requestAnimationFrame(frame);
      if (!last) last = ts;
      var dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      acc += dt;
      while (acc >= CV.TICK) {
        self.update(CV.TICK);
        CV.Input.postTick();
        acc -= CV.TICK;
      }
      CV.Render.draw(self.ctx, self);
      CV.Hud.draw(self.ctx, self);
    }
    window.requestAnimationFrame(frame);
  },

  // ---- Screenshot mode -------------------------------------------------------------
  runShot: function (name) {
    CV.Missions.init(this, 0, false);
    CV.Shots.setup(this, name);
    var ticks = CV.Shots.ticks[name] || 30;
    for (var i = 0; i < ticks; i++) {
      this.update(CV.TICK);
      CV.Input.postTick();
    }
    this.updateCamera(1);
    CV.Render.draw(this.ctx, this);
    CV.Hud.draw(this.ctx, this);
    window.__shotReady = true;
    document.title = 'coral-vice-shot-' + name;
  }
};

// Boot when the page loads.
window.addEventListener('load', function () {
  var canvas = document.getElementById('game');
  if (canvas) CV.Game.init(canvas);
});

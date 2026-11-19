// Coral Vice - pedestrians.
// Civilians stroll the sidewalks between waypoints, chat in pairs,
// flee from gunfire and speeding cars, and fall when hit or shot.
// A few are mission targets or story characters (flagged, not walked
// by this generic update).
'use strict';

CV.Pedestrians = {
  list: [],
  targetCount: 26,

  init: function (rng, world) {
    this.list = [];
    for (var i = 0; i < this.targetCount; i++) {
      this.list.push(this.spawn(rng, world, null));
    }
  },

  spawn: function (rng, world, near) {
    var spot;
    if (near) {
      spot = { x: near.x + rng.range(-160, 160), y: near.y + rng.range(-160, 160) };
      spot.x = CV.clamp(spot.x, 10, CV.WORLD_W - 10);
      spot.y = CV.clamp(spot.y, 10, CV.WORLD_H - 10);
      if (world.pointInBuilding(spot.x, spot.y, 4)) {
        spot = rng.pick(world.spawnPoints);
      }
    } else {
      spot = rng.pick(world.spawnPoints);
    }
    var ped = {
      x: spot.x, y: spot.y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(34, 58),
      color: rng.pick(CV.PED_COLORS),
      skin: rng.pick(['#f1c27d', '#e0ac69', '#8d5524', '#ffdbac', '#c68642']),
      name: rng.pick(CV.PED_NAMES),
      hp: 30,
      state: 'walk',          // walk | flee | down | chat
      tx: spot.x, ty: spot.y, // walk target
      waitT: 0,
      fleeT: 0,
      panicX: 0, panicY: 0,
      special: null,          // mission role id, if any
      dead: false,
      fallT: 0
    };
    this.pickTarget(rng, ped);
    return ped;
  },

  pickTarget: function (rng, ped) {
    // Walk to a nearby sidewalk point, biased along the same street.
    var world = CV.World;
    var spot = rng.pick(world.spawnPoints);
    var guard = 0;
    while (CV.dist(ped.x, ped.y, spot.x, spot.y) > 420 && guard < 8) {
      spot = rng.pick(world.spawnPoints);
      guard++;
    }
    ped.tx = spot.x + rng.range(-8, 8);
    ped.ty = spot.y + rng.range(-8, 8);
  },

  update: function (dt, game) {
    var rng = game.rng;
    var player = game.player;
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      if (p.special === 'story') continue; // placed by missions, static
      if (p.state === 'down') {
        p.fallT += dt;
        if (p.fallT > 20 && !p.special) this.list.splice(i, 1);
        continue;
      }

      // Fear: run from the thing that scared them.
      if (p.state === 'flee') {
        p.fleeT -= dt;
        var fa = Math.atan2(p.y - p.panicY, p.x - p.panicX);
        this.move(p, fa, p.speed * 2.1, dt);
        if (p.fleeT <= 0) {
          p.state = 'walk';
          this.pickTarget(rng, p);
        }
        continue;
      }

      // Notice danger: a fast car close by, or the player waving a gun.
      var threat = this.senseThreat(p, game);
      if (threat) {
        p.state = 'flee';
        p.fleeT = rng.range(1.2, 2.6);
        p.panicX = threat.x;
        p.panicY = threat.y;
        continue;
      }

      if (p.waitT > 0) {
        p.waitT -= dt;
        continue;
      }

      var d = CV.dist(p.x, p.y, p.tx, p.ty);
      if (d < 6) {
        if (rng.chance(0.18)) p.waitT = rng.range(0.6, 2.4); // pause, check phone
        this.pickTarget(rng, p);
        continue;
      }
      var a = Math.atan2(p.ty - p.y, p.tx - p.x);
      this.move(p, a, p.speed, dt);
    }

    // Keep the streets populated near the player.
    if (this.list.length < this.targetCount && rng.chance(0.05)) {
      this.list.push(this.spawn(rng, CV.World, player));
    }
  },

  senseThreat: function (p, game) {
    var pl = game.player;
    if (pl.mode === 'car' && pl.car) {
      var sp = Math.abs(pl.car.speed);
      if (sp > 120 && CV.dist(p.x, p.y, pl.car.x, pl.car.y) < 64) {
        return pl.car;
      }
    }
    if (game.recentShotT > 0 && CV.dist(p.x, p.y, pl.x, pl.y) < 190) {
      return pl;
    }
    if (pl.punchT > 0 && CV.dist(p.x, p.y, pl.x, pl.y) < 46) {
      return pl;
    }
    return null;
  },

  move: function (p, angle, speed, dt) {
    p.angle = CV.angleLerp(p.angle, angle, 0.25);
    var nx = p.x + Math.cos(angle) * speed * dt;
    var ny = p.y + Math.sin(angle) * speed * dt;
    nx = CV.clamp(nx, 6, CV.WORLD_W - 6);
    ny = CV.clamp(ny, 6, CV.WORLD_H - 6);
    var hit = CV.World.collideCircle(nx, ny, 7);
    if (hit) {
      nx = hit.x;
      ny = hit.y;
    }
    p.x = nx;
    p.y = ny;
    p.walkPhase = (p.walkPhase || 0) + dt * speed * 0.11;
  },

  // Damage a pedestrian; returns true if they went down.
  hurt: function (p, amount, game, byPlayer) {
    p.hp -= amount;
    if (p.hp <= 0 && p.state !== 'down') {
      p.state = 'down';
      p.dead = true;
      p.fallT = 0;
      if (byPlayer) game.addCrime(CV.CRIME_KILL, p.x, p.y);
      return true;
    }
    if (p.state !== 'down') {
      p.state = 'flee';
      p.fleeT = 2;
      p.panicX = game.player.x;
      p.panicY = game.player.y;
      if (byPlayer) game.addCrime(CV.CRIME_PUNCH, p.x, p.y);
    }
    return false;
  },

  // Cars running people over.
  checkCarHits: function (game) {
    var cars = CV.Traffic.cars;
    for (var ci = 0; ci < cars.length; ci++) {
      var car = cars[ci];
      if (Math.abs(car.speed) < 55) continue;
      for (var pi = 0; pi < this.list.length; pi++) {
        var p = this.list[pi];
        if (p.state === 'down') continue;
        if (CV.dist(p.x, p.y, car.x, car.y) < 17) {
          var byPlayer = car.driver === 'player';
          p.hp = 0;
          p.state = 'down';
          p.dead = true;
          p.fallT = 0;
          CV.Audio.crash(false);
          if (byPlayer) game.addCrime(CV.CRIME_HIT_PED, p.x, p.y);
          if (car.ai) car.ai.panic = 3;
        }
      }
    }
  }
};

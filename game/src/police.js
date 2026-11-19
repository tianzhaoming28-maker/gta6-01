// Coral Vice - Coral Bay Police Department.
// Wanted stars decide how many units respond. Cars chase with a
// pursuit steering model and try to box the player in; officers on
// foot chase and shoot when close. Units far behind quietly despawn
// so the chase always stays near the action.
'use strict';

CV.Police = {
  units: [],       // {kind:'car', car} | {kind:'foot', x,y,hp,...}
  spawnCd: 0,
  sirenT: 0,

  reset: function () {
    // Remove police cars from the traffic list.
    for (var i = 0; i < this.units.length; i++) {
      var u = this.units[i];
      if (u.kind === 'car' && u.car) CV.Traffic.remove(u.car);
    }
    this.units = [];
    this.spawnCd = 0;
  },

  desiredUnits: function (game) {
    var stars = game.stars;
    return {
      cars: stars <= 0 ? 0 : Math.min(1 + stars, 5),
      foot: (stars >= 2 && game.player.mode === 'foot') ? Math.min(stars, 4) : 0
    };
  },

  countKind: function (kind) {
    var n = 0;
    for (var i = 0; i < this.units.length; i++) {
      if (this.units[i].kind === kind && !this.units[i].dead) n++;
    }
    return n;
  },

  update: function (dt, game) {
    var want = this.desiredUnits(game);
    this.spawnCd -= dt;

    if (this.spawnCd <= 0) {
      if (this.countKind('car') < want.cars) {
        // At 3+ stars, every third unit cuts the player off from ahead.
        this.spawnSeq = (this.spawnSeq || 0) + 1;
        var cutOff = game.stars >= 3 && this.spawnSeq % 3 === 0 &&
                     game.player.mode === 'car';
        this.spawnCar(game, cutOff);
        this.spawnCd = 1.4;
      } else if (this.countKind('foot') < want.foot) {
        this.spawnFoot(game);
        this.spawnCd = 1.1;
      }
    }

    // Siren ambience while any unit is active.
    if (this.units.length > 0) {
      this.sirenT -= dt;
      if (this.sirenT <= 0) {
        this.sirenT = 0.9;
        CV.Audio.sirenBlip();
      }
    }

    for (var i = this.units.length - 1; i >= 0; i--) {
      var u = this.units[i];
      if (u.kind === 'car') this.updateCar(dt, game, u);
      else this.updateFoot(dt, game, u);
      // Despawn: dead for a while, or hopelessly far with no heat.
      var ref = u.kind === 'car' ? u.car : u;
      var d = CV.dist(ref.x, ref.y, game.player.x, game.player.y);
      if ((u.dead && u.deadT > 14) || (d > 900 && game.stars === 0) ||
          (d > 1500)) {
        if (u.kind === 'car') CV.Traffic.remove(u.car);
        this.units.splice(i, 1);
      }
    }
  },

  // Spawn on a road node a few blocks from the player.
  spawnPos: function (game, distMin, distMax) {
    var rng = game.rng;
    var p = game.player;
    for (var tries = 0; tries < 12; tries++) {
      var a = rng.range(0, Math.PI * 2);
      var d = rng.range(distMin, distMax);
      var x = CV.clamp(p.x + Math.cos(a) * d, 20, CV.WORLD_W - 20);
      var y = CV.clamp(p.y + Math.sin(a) * d, 20, CV.WORLD_H - 20);
      // Snap to the nearest road centre intersection.
      var ni = Math.round((x - CV.ROAD / 2) / CV.PITCH);
      var nj = Math.round((y - CV.ROAD / 2) / CV.PITCH);
      ni = CV.clamp(ni, 0, CV.COLS);
      nj = CV.clamp(nj, 0, CV.ROWS);
      var pos = CV.Traffic.nodePos(ni, nj);
      if (CV.dist(pos.x, pos.y, p.x, p.y) > distMin * 0.7) return pos;
    }
    return CV.Traffic.nodePos(0, 0);
  },

  spawnCar: function (game, ahead) {
    var pos;
    if (ahead && game.player.car) {
      // Spawn on the road grid in front of the player's heading.
      var p = game.player;
      var ax = CV.clamp(p.x + p.car.vx * 2.1, 20, CV.WORLD_W - 20);
      var ay = CV.clamp(p.y + p.car.vy * 2.1, 20, CV.WORLD_H - 20);
      var ni = CV.clamp(Math.round((ax - CV.ROAD / 2) / CV.PITCH), 0, CV.COLS);
      var nj = CV.clamp(Math.round((ay - CV.ROAD / 2) / CV.PITCH), 0, CV.ROWS);
      pos = CV.Traffic.nodePos(ni, nj);
      if (CV.dist(pos.x, pos.y, p.x, p.y) < 200) pos = this.spawnPos(game, 330, 520);
    } else {
      pos = this.spawnPos(game, 330, 520);
    }
    var car = CV.makeCar(game.rng, pos.x, pos.y, 0, {
      driver: 'police',
      color: '#f5f6fa',
      type: 1
    });
    car.parked = false;
    car.driver = 'police';
    car.police = true;
    CV.Traffic.cars.push(car);
    this.units.push({ kind: 'car', car: car, dead: false, deadT: 0, stuckT: 0 });
  },

  spawnFoot: function (game) {
    var pos = this.spawnPos(game, 200, 320);
    this.units.push({
      kind: 'foot',
      x: pos.x, y: pos.y,
      angle: 0,
      hp: 46,
      speed: 128,
      fireCd: game.rng.range(0.4, 1.2),
      dead: false, deadT: 0,
      walkPhase: 0
    });
  },

  updateCar: function (dt, game, u) {
    var car = u.car;
    if (car.hp <= 0) {
      u.dead = true;
      u.deadT += dt;
      CV.stepCar(car, dt, 0, 0);
      return;
    }
    var p = game.player;
    // Pursuit target: the player, led slightly by their velocity.
    var tx = p.x;
    var ty = p.y;
    if (p.mode === 'car' && p.car) {
      tx += p.car.vx * 0.35;
      ty += p.car.vy * 0.35;
    }
    var want = Math.atan2(ty - car.y, tx - car.x);
    var diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var steer = CV.clamp(diff * 2.6, -1, 1);
    var d = CV.dist(car.x, car.y, p.x, p.y);

    var wantSpeed = car.type.topSpeed * (0.82 + game.stars * 0.045);
    // Ramming run: lined up behind a fleeing driver, close the gap hard.
    if (p.mode === 'car' && Math.abs(diff) < 0.3 && d > 50 && d < 200) {
      wantSpeed *= 1.15;
    }
    // Match speed when alongside to squeeze, not overshoot.
    if (p.mode === 'car' && d < 46) wantSpeed = Math.min(wantSpeed, Math.abs(p.car ? p.car.speed : 0) + 26);
    var throttle = 0;
    if (Math.abs(diff) > 2.4 && d < 60) {
      throttle = -0.7; // reverse out of a bad angle at close range
      steer = -steer;
    } else if (car.speed < wantSpeed) {
      throttle = 1;
    }
    // Ease off when right on top of an on-foot player: try to block,
    // not run them down (that is the foot units' arrest fantasy).
    if (p.mode === 'foot' && d < 42) throttle = Math.min(throttle, 0.25);

    CV.stepCar(car, dt, throttle, steer);

    // Stuck detection: barely moving while throttling -> wiggle free.
    if (Math.abs(car.speed) < 8 && throttle > 0) {
      u.stuckT += dt;
      if (u.stuckT > 1.1) {
        CV.stepCar(car, dt, -1, steer > 0 ? -1 : 1);
        if (u.stuckT > 1.7) u.stuckT = 0;
      }
    } else {
      u.stuckT = 0;
    }

    car.siren = (car.siren + dt * 7) % (Math.PI * 2);
  },

  updateFoot: function (dt, game, u) {
    if (u.dead) {
      u.deadT += dt;
      return;
    }
    var p = game.player;
    var d = CV.dist(u.x, u.y, p.x, p.y);
    u.fireCd -= dt;

    if (d > 26) {
      var a = Math.atan2(p.y - u.y, p.x - u.x);
      u.angle = CV.angleLerp(u.angle, a, 0.3);
      var nx = u.x + Math.cos(a) * u.speed * dt;
      var ny = u.y + Math.sin(a) * u.speed * dt;
      var hit = CV.World.collideCircle(nx, ny, 8);
      if (hit) { nx = hit.x; ny = hit.y; }
      u.x = CV.clamp(nx, 6, CV.WORLD_W - 6);
      u.y = CV.clamp(ny, 6, CV.WORLD_H - 6);
      u.walkPhase += dt * 10;
    } else {
      u.angle = Math.atan2(p.y - u.y, p.x - u.x);
      // Shove the player: small damage, big annoyance.
      if (u.fireCd <= 0) {
        u.fireCd = 0.8;
        game.damagePlayer(4);
        CV.Audio.punch();
      }
    }

    // Shooting range.
    if (d < 230 && d > 30 && u.fireCd <= 0 && game.stars >= 2) {
      u.fireCd = game.rng.range(0.55, 1.05);
      var a2 = Math.atan2(p.y - u.y, p.x - u.x);
      var spread = (game.rng.next() - 0.5) * 0.13;
      game.bullets.push({
        x: u.x + Math.cos(a2) * 12,
        y: u.y + Math.sin(a2) * 12,
        vx: Math.cos(a2 + spread) * 560,
        vy: Math.sin(a2 + spread) * 560,
        life: 0.5,
        from: 'police',
        dmg: 11
      });
      CV.Audio.shoot();
      game.muzzleT = 0.05;
    }
  },

  hurt: function (u, amount, game) {
    if (u.dead) return;
    u.hp -= amount;
    game.addCrime(CV.CRIME_SHOOT + 8, u.x, u.y);
    if (u.hp <= 0) {
      u.dead = true;
      u.deadT = 0;
      game.addCrime(CV.CRIME_KILL, u.x, u.y);
      game.stats.copsDown++;
    }
  }
};

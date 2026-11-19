// Coral Vice - the player: Marina "Mari" Vega, ex-getaway driver.
// On foot she walks, sprints, punches and shoots with mouse aim; in a
// car she drives it. Also owns bullets and car entry/exit.
'use strict';

CV.Player = {
  create: function (x, y) {
    return {
      x: x, y: y,
      angle: -Math.PI / 2,
      hp: CV.PLAYER_MAX_HP,
      mode: 'foot',           // 'foot' | 'car'
      car: null,
      punchT: 0,
      punchCd: 0,
      fireCd: 0,
      walkPhase: 0,
      moving: false,
      ammo: Infinity,
      deadT: 0,
      name: 'Mari Vega'
    };
  },

  update: function (dt, game) {
    var p = game.player;
    var input = CV.Input;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.punchT > 0) p.punchT -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;

    if (p.mode === 'car' && p.car) {
      this.updateDriving(dt, game);
    } else {
      this.updateOnFoot(dt, game);
    }

    // Enter / exit vehicles with E.
    if (input.hit('KeyE')) {
      if (p.mode === 'car') this.exitCar(game);
      else this.tryEnterCar(game);
    }
  },

  updateOnFoot: function (dt, game) {
    var p = game.player;
    var input = CV.Input;
    var axis = input.moveAxis();
    var sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    var speed = sprint ? CV.PLAYER_SPRINT : CV.PLAYER_SPEED;
    p.moving = axis.x !== 0 || axis.y !== 0;

    if (p.moving) {
      var len = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
      var nx = p.x + (axis.x / len) * speed * dt;
      var ny = p.y + (axis.y / len) * speed * dt;
      nx = CV.clamp(nx, 8, CV.WORLD_W - 8);
      ny = CV.clamp(ny, 8, CV.WORLD_H - 8);
      var hit = CV.World.collideCircle(nx, ny, CV.PLAYER_RADIUS);
      if (hit) { nx = hit.x; ny = hit.y; }
      p.x = nx;
      p.y = ny;
      p.walkPhase += dt * (sprint ? 13 : 9);
      // Face movement unless aiming with the mouse while firing.
      if (!input.mouseDown) {
        p.angle = Math.atan2(axis.y, axis.x);
      }
    }

    // Aim: face the mouse cursor in world space.
    var cam = game.camera;
    var wx = cam.x + input.mouseX;
    var wy = cam.y + input.mouseY;
    if (input.mouseDown || input.down('KeyJ')) {
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }

    // Punch: F key or Space.
    if ((input.hit('KeyF') || input.hit('Space')) && p.punchCd <= 0) {
      p.punchCd = 0.34;
      p.punchT = 0.18;
      CV.Audio.punch();
      this.punchHit(game);
    }

    // Shoot: hold left mouse.
    if (input.mouseDown && p.fireCd <= 0) {
      p.fireCd = 0.21;
      this.shoot(game, wx, wy);
    }
  },

  punchHit: function (game) {
    var p = game.player;
    var hx = p.x + Math.cos(p.angle) * 20;
    var hy = p.y + Math.sin(p.angle) * 20;
    var peds = CV.Pedestrians.list;
    for (var i = 0; i < peds.length; i++) {
      var ped = peds[i];
      if (ped.state !== 'down' && CV.dist(hx, hy, ped.x, ped.y) < 17) {
        CV.Audio.hurt();
        CV.Pedestrians.hurt(ped, 12, game, true);
        game.onPunchLanded(ped);
        return;
      }
    }
    var cops = CV.Police.units;
    for (var j = 0; j < cops.length; j++) {
      var cop = cops[j];
      if (cop.kind === 'foot' && !cop.dead && CV.dist(hx, hy, cop.x, cop.y) < 17) {
        CV.Audio.hurt();
        CV.Police.hurt(cop, 12, game);
        return;
      }
    }
  },

  shoot: function (game, wx, wy) {
    var p = game.player;
    var a = Math.atan2(wy - p.y, wx - p.x);
    var spread = (game.rng.next() - 0.5) * 0.045;
    game.bullets.push({
      x: p.x + Math.cos(a) * 14,
      y: p.y + Math.sin(a) * 14,
      vx: Math.cos(a + spread) * 640,
      vy: Math.sin(a + spread) * 640,
      life: 0.55,
      from: 'player',
      dmg: 16
    });
    game.recentShotT = 1.2;
    game.stats.shots++;
    CV.Audio.shoot();
    game.muzzleT = 0.05;
  },

  updateDriving: function (dt, game) {
    var p = game.player;
    var car = p.car;
    var input = CV.Input;
    var throttle = 0;
    var steer = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) throttle = 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle = -1;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer = -1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer = 1;
    if (input.down('Space')) {
      // Handbrake: strong drag, sharper steering.
      car.speed = CV.lerp(car.speed, 0, CV.clamp(dt * 3.2, 0, 1));
      steer *= 1.5;
    }
    car.brake = throttle < 0 || input.down('Space');
    // Horn: H startles nearby pedestrians out of the road.
    if (input.hit('KeyH') && car.honkCd <= 0) {
      car.honkCd = 0.45;
      CV.Audio.honk();
      var peds = CV.Pedestrians.list;
      for (var i = 0; i < peds.length; i++) {
        var ped = peds[i];
        if (ped.state !== 'down' && CV.dist(ped.x, ped.y, car.x, car.y) < 74) {
          ped.state = 'flee';
          ped.fleeT = Math.max(ped.fleeT, 0.7);
          ped.panicX = car.x;
          ped.panicY = car.y;
        }
      }
    }
    if (car.hp <= 0) throttle = 0;
    CV.stepCar(car, dt, throttle, steer);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Collateral: the car itself can run people down (checked globally).
  },

  tryEnterCar: function (game) {
    var p = game.player;
    var car = CV.Traffic.nearestCar(p.x, p.y, 34, false);
    if (!car) return;
    var wasTraffic = car.driver === 'traffic';
    var wasParked = car.parked;
    car.driver = 'player';
    car.parked = false;
    car.ai = null;
    p.mode = 'car';
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    CV.Audio.door();
    if (wasTraffic) {
      // Dragging a driver out is very much a crime.
      game.addCrime(CV.CRIME_CARJACK, car.x, car.y);
      game.stats.stolen++;
      var peds = CV.Pedestrians.list;
      for (var i = 0; i < peds.length; i++) {
        if (CV.dist(peds[i].x, peds[i].y, car.x, car.y) < 90) {
          peds[i].state = 'flee';
          peds[i].fleeT = 2;
          peds[i].panicX = car.x;
          peds[i].panicY = car.y;
        }
      }
    } else if (wasParked) {
      game.addCrime(4, car.x, car.y); // hot-wiring is quieter, not legal
      game.stats.stolen++;
    }
    game.onEnterCar(car);
  },

  exitCar: function (game) {
    var p = game.player;
    var car = p.car;
    if (!car) return;
    // Step out on the left side of the car.
    var sx = car.x + Math.cos(car.angle - Math.PI / 2) * 20;
    var sy = car.y + Math.sin(car.angle - Math.PI / 2) * 20;
    var hit = CV.World.collideCircle(sx, sy, CV.PLAYER_RADIUS);
    if (hit) { sx = hit.x; sy = hit.y; }
    p.x = CV.clamp(sx, 8, CV.WORLD_W - 8);
    p.y = CV.clamp(sy, 8, CV.WORLD_H - 8);
    if (Math.abs(car.speed) < 12) {
      car.speed = 0;
      car.driver = null;
      car.parked = true;
    } else {
      // Bailing out of a rolling car: it coasts on driverless.
      car.driver = null;
      car.parked = false;
      car.ai = null;
      car.ghostT = 2.5;
    }
    p.mode = 'foot';
    p.car = null;
    CV.Audio.door();
  },

  // Driverless coasting cars and all bullets live here so player.js
  // owns everything that can hurt someone.
  updateProjectiles: function (dt, game) {
    var bullets = game.bullets;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      var remove = b.life <= 0;
      if (!remove && CV.World.pointInBuilding(b.x, b.y, 0)) remove = true;
      if (!remove) remove = this.bulletHit(b, game);
      if (remove) bullets.splice(i, 1);
    }
    // Ghost cars coast to a stop.
    var cars = CV.Traffic.cars;
    for (var c = 0; c < cars.length; c++) {
      var car = cars[c];
      if (car.ghostT > 0) {
        car.ghostT -= dt;
        CV.stepCar(car, dt, 0, 0);
        if (car.ghostT <= 0) car.parked = true;
      }
    }
  },

  bulletHit: function (b, game) {
    var i, target;
    if (b.from === 'player') {
      // vs pedestrians
      var peds = CV.Pedestrians.list;
      for (i = 0; i < peds.length; i++) {
        target = peds[i];
        if (target.state !== 'down' && CV.dist(b.x, b.y, target.x, target.y) < 9) {
          CV.Pedestrians.hurt(target, b.dmg, game, true);
          game.addCrime(CV.CRIME_SHOOT, target.x, target.y);
          return true;
        }
      }
      // vs police
      var cops = CV.Police.units;
      for (i = 0; i < cops.length; i++) {
        target = cops[i];
        if (target.kind === 'foot' && !target.dead &&
            CV.dist(b.x, b.y, target.x, target.y) < 9) {
          CV.Police.hurt(target, b.dmg, game);
          return true;
        }
        if (target.kind === 'car' && target.car &&
            CV.dist(b.x, b.y, target.car.x, target.car.y) < 17) {
          CV.damageCar(target.car, b.dmg * 0.6);
          game.addCrime(CV.CRIME_SHOOT, target.car.x, target.car.y);
          return true;
        }
      }
      // vs cars generally
      var cars = CV.Traffic.cars;
      for (i = 0; i < cars.length; i++) {
        target = cars[i];
        if (CV.dist(b.x, b.y, target.x, target.y) < 16) {
          CV.damageCar(target, b.dmg * 0.6);
          if (target.driver === 'traffic' && target.ai) target.ai.panic = 3;
          return true;
        }
      }
    } else {
      // Police bullets vs the player.
      var p = game.player;
      if (p.mode === 'foot' && CV.dist(b.x, b.y, p.x, p.y) < 10) {
        game.damagePlayer(b.dmg * 0.55);
        return true;
      }
      if (p.mode === 'car' && p.car && CV.dist(b.x, b.y, p.car.x, p.car.y) < 17) {
        CV.damageCar(p.car, b.dmg * 0.5);
        if (game.rng.chance(0.4)) game.damagePlayer(b.dmg * 0.22);
        return true;
      }
    }
    return false;
  }
};

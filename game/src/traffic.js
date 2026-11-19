// Coral Vice - traffic AI and parked cars.
// Traffic cars travel node to node along the road grid, keeping to the
// right-hand lane. At each intersection they pick a new heading, and
// they slow for cars ahead and stop (mostly) for crossing trouble.
'use strict';

CV.Traffic = {
  cars: [],        // all cars in the world, any driver
  parkedCount: 26,
  movingCount: 14,

  init: function (rng, world) {
    this.cars = [];
    this.spawnParked(rng, world);
    this.spawnMoving(rng, world);
  },

  // A random intersection node index pair.
  randNode: function (rng) {
    return {
      i: rng.int(0, CV.COLS),
      j: rng.int(0, CV.ROWS)
    };
  },

  nodePos: function (i, j) {
    return { x: CV.World.roadCenterX(i), y: CV.World.roadCenterY(j) };
  },

  spawnParked: function (rng, world) {
    var tries = 0;
    var placed = 0;
    while (placed < this.parkedCount && tries < 400) {
      tries++;
      // Park along a random road edge, parallel to it.
      var vertical = rng.chance(0.5);
      var node = this.randNode(rng);
      var along = rng.range(30, CV.PITCH - 30);
      var x, y, angle;
      if (vertical) {
        x = CV.World.roadCenterX(node.i) + (rng.chance(0.5) ? -CV.ROAD / 2 + 7 : CV.ROAD / 2 - 7);
        y = node.j * CV.PITCH + along;
        angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = node.i * CV.PITCH + along;
        y = CV.World.roadCenterY(node.j) + (rng.chance(0.5) ? -CV.ROAD / 2 + 7 : CV.ROAD / 2 - 7);
        angle = rng.chance(0.5) ? 0 : Math.PI;
      }
      if (world.pointInBuilding(x, y, 6)) continue;
      var car = CV.makeCar(rng, x, y, angle, {});
      car.parked = true;
      car.driver = null;
      this.cars.push(car);
      placed++;
    }
  },

  spawnMoving: function (rng, world) {
    for (var n = 0; n < this.movingCount; n++) {
      var node = this.randNode(rng);
      var pos = this.nodePos(node.i, node.j);
      var car = CV.makeCar(rng, pos.x, pos.y, 0, { driver: 'traffic' });
      car.parked = false;
      car.driver = 'traffic';
      car.ai = this.newAi(rng, node);
      this.applyAiPose(car);
      this.cars.push(car);
    }
  },

  // Traffic AI state: drive from node (i,j) toward node (ni,nj).
  newAi: function (rng, fromNode) {
    var dirs = this.openDirs(fromNode.i, fromNode.j, -1);
    var d = rng.pick(dirs);
    return {
      i: fromNode.i, j: fromNode.j,
      ni: fromNode.i + d.x, nj: fromNode.j + d.y,
      dirX: d.x, dirY: d.y,
      speedWanted: rng.range(85, 130),
      panic: 0
    };
  },

  openDirs: function (i, j, avoidBack) {
    var all = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
    ];
    var out = [];
    for (var k = 0; k < all.length; k++) {
      var d = all[k];
      var ni = i + d.x;
      var nj = j + d.y;
      if (ni < 0 || nj < 0 || ni > CV.COLS || nj > CV.ROWS) continue;
      if (avoidBack === k) continue;
      out.push(d);
    }
    return out.length ? out : all;
  },

  // Position a traffic car on its current leg, in the right lane.
  applyAiPose: function (car) {
    var ai = car.ai;
    var from = this.nodePos(ai.i, ai.j);
    var off = CV.World.laneOffset(ai.dirX, ai.dirY);
    car.x = from.x + off.x;
    car.y = from.y + off.y;
    car.angle = Math.atan2(ai.dirY, ai.dirX);
  },

  update: function (dt, game) {
    var rng = game.rng;
    for (var idx = 0; idx < this.cars.length; idx++) {
      var car = this.cars[idx];
      if (car.driver !== 'traffic') continue;
      var ai = car.ai;
      var target = this.nodePos(ai.ni, ai.nj);
      var off = CV.World.laneOffset(ai.dirX, ai.dirY);
      var tx = target.x + off.x;
      var ty = target.y + off.y;
      var d = CV.dist(car.x, car.y, tx, ty);

      if (d < 12) {
        // Arrived: choose the next leg (rarely a U-turn).
        var backIdx = ai.dirX === 1 ? 1 : ai.dirX === -1 ? 0 : ai.dirY === 1 ? 3 : 2;
        var dirs = this.openDirs(ai.ni, ai.nj, rng.chance(0.85) ? backIdx : -1);
        var nd = rng.pick(dirs);
        ai.i = ai.ni;
        ai.j = ai.nj;
        ai.ni += nd.x;
        ai.nj += nd.y;
        ai.dirX = nd.x;
        ai.dirY = nd.y;
        continue;
      }

      // Desired heading toward the lane point of the target node.
      var want = Math.atan2(ty - car.y, tx - car.x);
      var diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      var steer = CV.clamp(diff * 2.2, -1, 1);

      // Slow down for a car ahead in our lane.
      var wantSpeed = ai.speedWanted;
      var ahead = this.carAhead(car, 52);
      if (ahead) wantSpeed = Math.min(wantSpeed, Math.max(0, ahead.speed - 6));
      // Brake for a pedestrian crossing ahead.
      if (game.pedInFront(car, 40)) wantSpeed = Math.min(wantSpeed, 20);
      // Intersection courtesy: ease off when cross traffic is inside
      // the junction we are about to enter.
      if (d < 74 && this.crossTraffic(car, target)) {
        wantSpeed = Math.min(wantSpeed, 34);
      }
      if (ai.panic > 0) {
        ai.panic -= dt;
        wantSpeed = car.type.topSpeed * 0.95;
      }

      var throttle = 0;
      if (car.speed < wantSpeed) throttle = 0.75;
      else if (car.speed > wantSpeed + 12) throttle = -0.6;
      if (car.hp <= 0) throttle = 0;
      car.brake = throttle < 0 || wantSpeed < car.speed - 6;

      // Blocked drivers lean on the horn.
      if (ahead && Math.abs(car.speed) < 9 && car.hp > 0) {
        car.honkT += dt;
        if (car.honkT > 1.7 && car.honkCd <= 0) {
          CV.Audio.honk();
          car.honkCd = rng.range(2.5, 6);
          car.honkT = 0;
        }
      } else {
        car.honkT = Math.max(0, car.honkT - dt);
      }
      CV.stepCar(car, dt, throttle, steer);
    }
  },

  // Is another car inside the junction at (node) travelling across us?
  crossTraffic: function (car, node) {
    for (var i = 0; i < this.cars.length; i++) {
      var o = this.cars[i];
      if (o === car || o.parked) continue;
      if (CV.dist(o.x, o.y, node.x, node.y) < CV.ROAD * 0.75) {
        // Crossing if its heading is roughly perpendicular to ours.
        var dot = Math.cos(o.angle) * Math.cos(car.angle) +
                  Math.sin(o.angle) * Math.sin(car.angle);
        if (Math.abs(dot) < 0.45) return true;
      }
    }
    return false;
  },

  carAhead: function (car, dist) {
    var fx = Math.cos(car.angle);
    var fy = Math.sin(car.angle);
    var best = null;
    var bestD = dist;
    for (var i = 0; i < this.cars.length; i++) {
      var o = this.cars[i];
      if (o === car) continue;
      var dx = o.x - car.x;
      var dy = o.y - car.y;
      var fwd = dx * fx + dy * fy;
      var side = Math.abs(dx * -fy + dy * fx);
      if (fwd > 4 && fwd < bestD && side < 13) {
        best = o;
        bestD = fwd;
      }
    }
    // The player's car counts too (it lives in this list when driven).
    return best;
  },

  // Remove a car from the world entirely.
  remove: function (car) {
    var i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  },

  nearestCar: function (x, y, maxDist, onlyFree) {
    var best = null;
    var bestD = maxDist;
    for (var i = 0; i < this.cars.length; i++) {
      var c = this.cars[i];
      if (onlyFree && c.driver === 'player') continue;
      var d = CV.dist(x, y, c.x, c.y);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }
};

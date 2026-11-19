// Coral Vice - vehicles: creation, arcade physics and drawing data.
// A car is a plain object; who drives it (player, traffic AI, police)
// decides which update runs, but they all share this physics step.
'use strict';

CV.CarTypes = [
  { name: 'Cayo Compact', accel: 150, topSpeed: 175, grip: 5.2, weight: 1.0 },
  { name: 'Palmetto Sedan', accel: 165, topSpeed: 205, grip: 5.6, weight: 1.1 },
  { name: 'Flamingo Coupe', accel: 205, topSpeed: 265, grip: 6.4, weight: 1.0 },
  { name: 'Bayside Pickup', accel: 140, topSpeed: 180, grip: 4.6, weight: 1.35 },
  { name: 'Solana Van', accel: 120, topSpeed: 160, grip: 4.2, weight: 1.5 },
  { name: 'Neon Roadster', accel: 240, topSpeed: 305, grip: 7.0, weight: 0.9 }
];

CV.makeCar = function (rng, x, y, angle, opts) {
  opts = opts || {};
  var type = opts.type !== undefined ? CV.CarTypes[opts.type] : rng.pick(CV.CarTypes);
  return {
    x: x,
    y: y,
    angle: angle || 0,
    vx: 0,
    vy: 0,
    speed: 0,               // signed forward speed, px/s
    steer: 0,
    type: type,
    color: opts.color || rng.pick(CV.CAR_COLORS),
    hp: CV.CAR_MAX_HP,
    driver: null,           // 'player' | 'traffic' | 'police' | null (parked)
    parked: !opts.driver,
    locked: false,
    siren: 0,               // police light phase
    honkCd: 0,
    smoke: 0,
    brake: false,           // brake lights on (set by whoever drives)
    honkT: 0,               // how long the driver has been blocked
    // traffic AI state
    ai: null,
    // damage flash timer for rendering
    flash: 0
  };
};

// Arcade car physics. throttle in [-1,1], steerIn in [-1,1].
CV.stepCar = function (car, dt, throttle, steerIn) {
  var t = car.type;
  var maxF = t.topSpeed;
  var maxR = t.topSpeed * 0.35;

  if (throttle > 0) {
    car.speed += t.accel * throttle * dt;
  } else if (throttle < 0) {
    // Brake first, then reverse.
    if (car.speed > 4) car.speed -= 320 * dt;
    else car.speed += t.accel * 0.6 * throttle * dt;
  } else {
    // Engine drag and rolling resistance.
    car.speed -= car.speed * 0.55 * dt;
    if (Math.abs(car.speed) < 1.5) car.speed = 0;
  }
  car.speed = CV.clamp(car.speed, -maxR, maxF);

  // Steering only bites when moving; sharper at low speed.
  var steerAuthority = CV.clamp(Math.abs(car.speed) / 60, 0, 1);
  var targetSteer = steerIn * 0.62 * steerAuthority;
  car.steer = CV.lerp(car.steer, targetSteer, CV.clamp(dt * 8, 0, 1));
  var dirSign = car.speed < 0 ? -1 : 1;
  car.angle += car.steer * dirSign * (Math.abs(car.speed) / 34) * dt * (t.grip / 5.4);

  var fx = Math.cos(car.angle);
  var fy = Math.sin(car.angle);
  car.vx = fx * car.speed;
  car.vy = fy * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // World bounds.
  car.x = CV.clamp(car.x, 14, CV.WORLD_W - 14);
  car.y = CV.clamp(car.y, 14, CV.WORLD_H - 14);

  // Buildings stop cars hard.
  var hit = CV.World.collideCircle(car.x, car.y, 13);
  if (hit) {
    var impact = Math.abs(car.speed);
    car.x = hit.x;
    car.y = hit.y;
    if (impact > 90) {
      car.hp -= (impact - 80) * 0.12;
      car.flash = 0.15;
      if (car.driver === 'player') {
        CV.Audio.crash(impact > 170);
        CV.Game.onPlayerCrash(impact);
      } else if (impact > 150) {
        CV.Audio.crash(false);
      }
    }
    car.speed *= -0.25;
  }
  if (car.flash > 0) car.flash -= dt;
  if (car.honkCd > 0) car.honkCd -= dt;
  car.smoke = car.hp < 35 ? Math.min(1, car.smoke + dt) : Math.max(0, car.smoke - dt);
  if (car.hp <= 0 && car.speed !== 0) {
    // A wrecked car rolls to a stop and will not accelerate again.
    car.speed = CV.lerp(car.speed, 0, CV.clamp(dt * 2, 0, 1));
  }
};

// Damage a car; returns true when this hit wrecked it.
CV.damageCar = function (car, amount) {
  car.hp -= amount;
  car.flash = 0.12;
  return car.hp <= 0;
};

// Simple circle collision between two cars; pushes both apart.
CV.carVsCar = function (a, b) {
  var dx = b.x - a.x;
  var dy = b.y - a.y;
  var d2 = dx * dx + dy * dy;
  var min = 26;
  if (d2 >= min * min || d2 === 0) return false;
  var d = Math.sqrt(d2);
  var push = (min - d) / 2;
  var nx = dx / d;
  var ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  var rel = Math.abs(a.speed - b.speed);
  if (rel > 70) {
    CV.damageCar(a, rel * 0.05);
    CV.damageCar(b, rel * 0.05);
    var faster = Math.abs(a.speed) > Math.abs(b.speed) ? a : b;
    var slower = faster === a ? b : a;
    slower.speed = faster.speed * 0.55;
    faster.speed *= 0.8;
    if (faster.driver === 'player' || slower.driver === 'player') {
      CV.Audio.crash(rel > 140);
      CV.Game.onPlayerCrash(rel);
    }
  }
  return true;
};

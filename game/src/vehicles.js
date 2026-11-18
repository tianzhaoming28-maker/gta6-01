// vehicles.js — car factory and driving physics shared by the player,
// traffic, police and mission targets: arcade acceleration, speed-sensitive
// steering, handbrake drift, world collision and car-to-car impacts.

import { CAR_TYPES } from './config.js';
import { RNG, clamp, angleDiff } from './rng.js';
import { collideCircle } from './world.js';

let carSeq = 1;

export function makeCar(type, x, y, angle, opts = {}) {
  const spec = CAR_TYPES[type];
  const rng = opts.rng || new RNG(x * 31 + y * 17 + carSeq);
  const car = {
    id: carSeq++,
    type, spec,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,               // signed forward speed
    steer: 0,
    color: opts.color || rng.pick(spec.colors),
    health: 100,
    role: opts.role || 'parked',   // parked | traffic | player | police | rival | mission
    driver: opts.driver !== undefined ? opts.driver : (opts.role === 'parked' ? null : 'ai'),
    throttle: 0, brake: false, handbrake: false, steerInput: 0,
    honkT: 0, smokeT: 0, wrecked: false,
    nodeI: 0, nodeJ: 0, dirX: 1, dirY: 0, cruise: opts.cruise || rng.range(105, 150),
    fleeT: 0, stuckT: 0, siren: null, lightPhase: rng.range(0, 6),
    targetX: 0, targetY: 0, hasTarget: false,
    lastHitT: -9, crimeT: -9,
  };
  return car;
}

export function carRadius(car) { return car.spec.w * 0.52; }

export function carSpeedKmh(car) { return Math.abs(car.speed) * 0.62; }

// Arcade driving step. ctrl: {throttle -1..1, steer -1..1, handbrake}.
export function driveCar(G, car, ctrl, dt) {
  const spec = car.spec;
  const wreck = car.health <= 0;
  const top = wreck ? 40 : spec.top;
  const accel = wreck ? spec.accel * 0.3 : spec.accel;

  if (ctrl.throttle > 0) {
    car.speed += accel * ctrl.throttle * dt * (car.speed < 0 ? 2.1 : 1);
  } else if (ctrl.throttle < 0) {
    if (car.speed > 12) car.speed -= accel * 1.7 * dt;         // braking
    else car.speed += accel * 0.55 * ctrl.throttle * dt;       // reverse
  } else {
    car.speed -= car.speed * 0.55 * dt;                        // engine drag
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  car.speed -= car.speed * Math.abs(car.speed) * 0.00045 * dt * 60 * 0.016; // air drag curve
  car.speed = clamp(car.speed, -top * 0.38, top);

  const steerTarget = ctrl.steer * (ctrl.handbrake ? 0.62 : 0.46);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 9);
  const speedFactor = clamp(Math.abs(car.speed) / 60, 0, 1) * clamp(1.25 - Math.abs(car.speed) / (top * 1.7), 0.35, 1);
  const turnRate = car.steer * spec.grip * speedFactor * (car.speed < 0 ? -1 : 1);
  car.angle += turnRate * dt * (ctrl.handbrake ? 1.5 : 1);

  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const gripKeep = ctrl.handbrake ? 2.2 : 9.5;
  // Split velocity into forward and lateral parts; grip bleeds the lateral part.
  const vf = car.vx * fx + car.vy * fy;
  let vlx = car.vx - vf * fx, vly = car.vy - vf * fy;
  const bleed = Math.exp(-gripKeep * dt);
  vlx *= bleed; vly *= bleed;
  const newVf = car.speed;
  car.vx = newVf * fx + vlx;
  car.vy = newVf * fy + vly;
  if (ctrl.handbrake) car.speed *= Math.exp(-1.15 * dt);

  const prevX = car.x, prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const vel = { x: car.vx, y: car.vy };
  const impact = collideCircle(G.world, car, carRadius(car) * 0.82, vel);
  car.vx = vel.x; car.vy = vel.y;
  // Re-derive signed speed from the resolved velocity so walls stop the car.
  car.speed = car.vx * fx + car.vy * fy;
  if (impact > 90) {
    onCarWorldHit(G, car, impact, prevX, prevY);
  } else if (impact > 26) {
    G.audio.noise(0.08, 0.1, 500, 1);
  }
  return impact;
}

function onCarWorldHit(G, car, impact, prevX, prevY) {
  const hard = impact > 210;
  damageCar(G, car, (impact - 80) * 0.055, hard);
  G.audio.crash(hard);
  if (car.role === 'player') {
    G.shake = Math.min(15, G.shake + impact * 0.03);
    if (G.time - car.crimeT > 2.5) { car.crimeT = G.time; }
  }
  G.spawnSparks(car.x, car.y, hard ? 14 : 7, '#ffd76a');
  car.x = prevX * 0.35 + car.x * 0.65;
  car.y = prevY * 0.35 + car.y * 0.65;
}

export function damageCar(G, car, amount, hard = false) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    G.spawnSparks(car.x, car.y, 20, '#ff9a3d');
    G.audio.crash(true);
  }
}

// Resolve overlap between two cars: push apart, trade momentum, count damage.
export function collideCars(G, a, b, dt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const rr = carRadius(a) + carRadius(b);
  const d2 = dx * dx + dy * dy;
  if (d2 > rr * rr || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d, ny = dy / d;
  const overlap = rr - d;
  const total = 2;
  a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    const impulse = -rel * 0.72;
    a.vx -= nx * impulse; a.vy -= ny * impulse;
    b.vx += nx * impulse; b.vy += ny * impulse;
    a.speed = a.vx * Math.cos(a.angle) + a.vy * Math.sin(a.angle);
    b.speed = b.vx * Math.cos(b.angle) + b.vy * Math.sin(b.angle);
    const severity = -rel;
    if (severity > 55) {
      damageCar(G, a, severity * 0.05);
      damageCar(G, b, severity * 0.05);
      G.spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, severity > 150 ? 14 : 7, '#ffd76a');
      G.audio.crash(severity > 150);
      if (a.role === 'player' || b.role === 'player') {
        G.shake = Math.min(14, G.shake + severity * 0.035);
        const other = a.role === 'player' ? b : a;
        if (G.time - other.lastHitT > 1.2) {
          other.lastHitT = G.time;
          if (other.role === 'police') G.commitCrime('hitPolice', other.x, other.y);
          else G.commitCrime('hitCar', other.x, other.y);
          if (other.driver === 'ai' && other.role === 'traffic') { other.fleeT = 3; }
        }
      }
    }
  }
  return true;
}

// Simple steering helper: returns {throttle, steer} to chase a world point.
export function steerToward(car, tx, ty, dt, opts = {}) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  const steer = clamp(diff * 2.4, -1, 1);
  const distT = Math.hypot(tx - car.x, ty - car.y);
  let throttle = opts.throttle !== undefined ? opts.throttle : 1;
  if (Math.abs(diff) > 2.2 && car.speed > 40) throttle = -0.4; // turn around
  if (opts.slowAt && distT < opts.slowAt) throttle = Math.min(throttle, clamp(distT / opts.slowAt, 0.12, 1));
  if (opts.stopAt && distT < opts.stopAt) throttle = car.speed > 8 ? -0.7 : 0;
  return { throttle, steer, handbrake: Math.abs(diff) > 1.15 && car.speed > 130 };
}

// Drift smoke + skid marks, fed from the player's and nearby cars' motion.
export function updateCarEffects(G, car, dt) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const lat = Math.abs(car.vx * -fy + car.vy * fx);
  const fast = Math.abs(car.speed) > 30;
  if (fast && (lat > 42 || car.handbrakeNow)) {
    car.smokeT -= dt;
    if (car.smokeT <= 0) {
      car.smokeT = 0.03;
      const bx = car.x - fx * car.spec.w * 0.42, by = car.y - fy * car.spec.w * 0.42;
      const px = -fy * car.spec.h * 0.8, py = fx * car.spec.h * 0.8;
      G.addSkid(bx + px, by + py);
      G.addSkid(bx - px, by - py);
      G.particles.push({ x: bx, y: by, vx: 0, vy: -8, life: 0.5, maxLife: 0.5, size: 7, color: 'rgba(230,230,230,0.5)', kind: 'smoke' });
    }
  }
  if (car.health < 45 && !car.wrecked) {
    car.smokeT -= dt * 0.4;
    if (Math.random() < dt * 9) {
      G.particles.push({ x: car.x + fx * 14, y: car.y + fy * 14, vx: 6, vy: -16, life: 0.8, maxLife: 0.8, size: 8, color: car.health < 22 ? 'rgba(60,55,60,0.65)' : 'rgba(200,200,205,0.55)', kind: 'smoke' });
    }
  }
  if (car.wrecked && Math.random() < dt * 6) {
    G.particles.push({ x: car.x, y: car.y, vx: 4, vy: -20, life: 0.9, maxLife: 0.9, size: 10, color: 'rgba(45,42,48,0.7)', kind: 'smoke' });
  }
}

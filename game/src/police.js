// police.js — the Palmira PD response: interceptors that hunt, ram and pin,
// foot officers at high heat who shoot to stop, and roadblocks across the
// avenues at four stars and up. Spawning follows the wanted level, and the
// net loosens only when Rico stays clean and out of sight.

import { HEAT_FOR_STAR } from './config.js';
import { clamp, dist } from './rng.js';
import { makeCar, driveCar, steerToward, updateCarEffects } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { hurtPlayer } from './player.js';

export function wantedStars(G) {
  let stars = 0;
  for (let i = 1; i <= 5; i++) if (G.heat >= HEAT_FOR_STAR[i]) stars = i;
  return stars;
}

function desiredUnits(stars) {
  return [0, 1, 2, 3, 4, 6][stars] || 0;
}

function spawnInterceptor(G) {
  const p = G.player;
  // Spawn on a road a few blocks away, never in plain view.
  const world = G.world;
  let x = 0, y = 0, ok = false;
  for (let tries = 0; tries < 14 && !ok; tries++) {
    const i = Math.floor(Math.random() * world.roadsV.length);
    const j = Math.floor(Math.random() * world.roadsH.length);
    x = world.roadsV[i] + 52; y = world.roadsH[j] + 52;
    const d = dist(x, y, p.x, p.y);
    ok = d > 520 && d < 1250;
  }
  if (!ok) { x = clamp(p.x + 700, 60, world.W - 60); y = clamp(p.y, 60, world.H - 300); }
  const car = makeCar('police', x, y, Math.atan2(p.y - y, p.x - x), { role: 'police', color: '#f2f2f2' });
  car.driver = 'police';
  car.cruise = 300;
  car.siren = G.audio.sirenStart();
  G.cars.push(car);
  return car;
}

function spawnOfficer(G, nearCar) {
  const ped = makePed(nearCar.x + 20, nearCar.y + 14, { officer: true });
  ped.shirt = '#20304a';
  ped.pants = '#1b2432';
  ped.speed = 118;
  ped.shootT = Math.random() * 0.8;
  G.peds.push(ped);
  return ped;
}

function maybeRoadblock(G) {
  if (G.roadblockT > 0) return;
  G.roadblockT = 26;
  const world = G.world;
  const p = G.player;
  // Block the road the player is heading along, two intersections ahead.
  const dirX = p.car ? Math.cos(p.car.angle) : 1;
  const bx = clamp(p.x + dirX * 560, 80, world.W - 80);
  let bestRoad = world.roadsV[0], bd = Infinity;
  for (const rx of world.roadsV) { const d = Math.abs(rx + 52 - bx); if (d < bd) { bd = d; bestRoad = rx; } }
  let bestH = world.roadsH[0]; bd = Infinity;
  for (const ry of world.roadsH) { const d = Math.abs(ry + 52 - p.y); if (d < bd) { bd = d; bestH = ry; } }
  const y = bestH + 52;
  for (let k = 0; k < 3; k++) {
    const car = makeCar('police', bestRoad + 20 + k * 30, y + (k % 2 ? 16 : -14), Math.PI / 2, { role: 'police', color: '#f2f2f2' });
    car.driver = null;
    car.roadblock = true;
    G.cars.push(car);
    G.roadblocks.push(car);
  }
  G.notify('ROADBLOCK AHEAD — PPD', 2.2);
}

export function clearPolice(G) {
  for (const car of G.cars) {
    if (car.siren) { G.audio.sirenStop(car.siren); car.siren = null; }
  }
  G.cars = G.cars.filter((c) => c.role !== 'police');
  G.peds = G.peds.filter((p) => !p.isOfficer);
  G.roadblocks = [];
}

export function updatePolice(G, dt) {
  const stars = wantedStars(G);
  const p = G.player;
  G.stars = stars;

  if (G.roadblockT > 0) G.roadblockT -= dt;
  if (stars >= 4) maybeRoadblock(G);
  // Retire stale roadblocks far behind the player.
  for (let i = G.roadblocks.length - 1; i >= 0; i--) {
    const rb = G.roadblocks[i];
    if (dist(rb.x, rb.y, p.x, p.y) > 900) {
      G.cars.splice(G.cars.indexOf(rb), 1);
      G.roadblocks.splice(i, 1);
    }
  }

  const units = G.cars.filter((c) => c.role === 'police' && c.driver === 'police' && !c.roadblock);
  if (stars > 0 && G.policeSpawnT <= 0 && units.length < desiredUnits(stars)) {
    spawnInterceptor(G);
    G.policeSpawnT = 2.6;
  }
  if (G.policeSpawnT > 0) G.policeSpawnT -= dt;

  // Too many units for the heat: the extras peel off and despawn.
  let seen = false;
  let sirenVol = 0;
  for (const car of units) {
    updateCarEffects(G, car, dt);
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 620) seen = true;
    sirenVol = Math.max(sirenVol, clamp(1 - d / 800, 0, 1));
    if (car.siren) G.audio.sirenSet(car.siren, sirenVol * 0.9);
    if (car.wrecked) {
      if (car.siren) { G.audio.sirenStop(car.siren); car.siren = null; }
      continue;
    }
    if (units.length > desiredUnits(stars) && d > 200) {
      // Peel off: slow down, then leave the world.
      driveCar(G, car, { throttle: 0, steer: 0 }, dt);
      car.peelT = (car.peelT || 0) + dt;
      if (car.peelT > 1.6) {
        if (car.siren) G.audio.sirenStop(car.siren);
        G.cars.splice(G.cars.indexOf(car), 1);
      }
      continue;
    }
    // Pursuit: aim at a point just behind the player to ram, or alongside to pin.
    const lead = p.car ? 0.32 : 0.1;
    const tx = p.x + (p.car ? p.car.vx * lead : p.vx * lead);
    const ty = p.y + (p.car ? p.car.vy * lead : p.vy * lead);
    const ctrl = steerToward(car, tx, ty, dt, { throttle: 1 });
    if (d < 60 && !p.car) ctrl.throttle = Math.min(ctrl.throttle, 0.4); // do not run him down
    if (d < 34 && Math.abs(car.speed) < 30 && Math.abs(p.car ? p.car.speed : 0) < 30) ctrl.throttle = 0;
    car.handbrakeNow = !!ctrl.handbrake;
    driveCar(G, car, ctrl, dt);

    // At three stars the driver bails out to fight on foot when close.
    if (stars >= 3 && d < 120 && d > 42 && !car.officerOut && Math.abs(car.speed) < 24) {
      car.officerOut = true;
      spawnOfficer(G, car);
    }
  }
  G.policeSeen = seen;

  updateOfficers(G, dt, stars);
  updateBust(G, dt, units);
}

function updateOfficers(G, dt, stars) {
  const p = G.player;
  for (const ped of G.peds) {
    if (!ped.isOfficer) continue;
    if (ped.state === 'down') continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    if (d > 46) {
      const sp = ped.speed;
      ped.x += Math.cos(ped.angle) * sp * dt;
      ped.y += Math.sin(ped.angle) * sp * dt;
    }
    // Officers shoot at four stars, or at three when Rico is armed/fleeing in a car.
    const mayShoot = stars >= 4 || (stars >= 3 && (p.hasPistol || p.car));
    ped.shootT -= dt;
    if (mayShoot && d < 240 && d > 20 && ped.shootT <= 0) {
      ped.shootT = 0.55 + Math.random() * 0.5;
      G.fireBullet(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12, ped.angle + (Math.random() - 0.5) * 0.14, 'police');
      G.audio.gunshot();
    }
    if (d > 1100) ped.state = 'down', ped.downT = 0.01, ped.health = 0; // despawn via cleanup in main
  }
}

function updateBust(G, dt, units) {
  const p = G.player;
  if (G.state !== 'playing' || p.dead) return;
  let pressure = 0;
  for (const car of units) {
    if (dist(car.x, car.y, p.x, p.y) < 64) pressure++;
  }
  for (const ped of G.peds) {
    if (ped.isOfficer && ped.state !== 'down' && dist(ped.x, ped.y, p.x, p.y) < 44) pressure++;
  }
  const playerSpeed = p.car ? Math.abs(p.car.speed) : Math.hypot(p.vx, p.vy);
  if (pressure > 0 && playerSpeed < 26 && G.stars > 0) {
    p.bustMeter += dt * (0.34 + pressure * 0.16);
    if (p.bustMeter >= 1) { G.onBusted(); return; }
  } else {
    p.bustMeter = Math.max(0, p.bustMeter - dt * 0.7);
  }
}

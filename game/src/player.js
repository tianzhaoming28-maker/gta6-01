// player.js — Rico Vega on foot and behind the wheel: movement, sprint,
// entering and stealing cars, fists, and the pistol once he picks one up.

import { PLAYER_SPEED, PLAYER_SPRINT, PLAYER_RADIUS } from './config.js';
import { clamp, dist } from './rng.js';
import { collideCircle } from './world.js';
import { driveCar, carSpeedKmh } from './vehicles.js';
import { hurtPed } from './pedestrians.js';

export function makePlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    angle: -Math.PI / 2,
    health: 100, maxHealth: 100,
    car: null,               // car being driven, or null on foot
    hasPistol: false, ammo: 0,
    meleeT: 0, shootT: 0, hurtT: 0,
    walkPhase: 0, moving: false,
    bustMeter: 0,            // fills while police hold Rico still
    dead: false,
  };
}

export function nearestEnterableCar(G, range = 46) {
  let best = null, bd = range;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(G, car) {
  const p = G.player;
  p.car = car;
  if (car.role === 'police') car.wasPolice = true;
  if (car.role === 'parked' || (car.role === 'traffic' && Math.abs(car.speed) < 30)) {
    if (car.driver === 'ai') {
      // The driver bails out and runs.
      const ped = G.spawnPed(car.x + 14, car.y + 10, {});
      ped.state = 'flee'; ped.fleeT = 3;
    }
    if (car.role !== 'mission' && car.role !== 'rival') G.commitCrime('theft', car.x, car.y);
    car.role = 'player';
    car.driver = 'player';
  } else if (car.role === 'traffic') {
    G.commitCrime('theft', car.x, car.y);
    car.role = 'player';
    car.driver = 'player';
  } else {
    car.role = 'player';
    car.driver = 'player';
  }
  G.audio.door();
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.role = car.wasPolice ? 'police' : 'parked';
  car.driver = null;
  car.throttle = 0;
  p.car = null;
  // Step out on the left side, clear of the bodywork.
  const sx = -Math.sin(car.angle), sy = Math.cos(car.angle);
  p.x = car.x + sx * (car.spec.h + 8);
  p.y = car.y + sy * (car.spec.h + 8);
  p.vx = 0; p.vy = 0;
  G.audio.door();
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.meleeT > 0) p.meleeT -= dt;
  if (p.shootT > 0) p.shootT -= dt;

  if (input.hit('KeyE')) {
    if (p.car) exitCar(G);
    else {
      const car = nearestEnterableCar(G);
      if (car) enterCar(G, car);
    }
  }

  if (p.car) {
    const car = p.car;
    p.x = car.x; p.y = car.y;
    p.angle = car.angle;
    const ctrl = {
      throttle: (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) + (input.down('KeyS') || input.down('ArrowDown') ? -1 : 0),
      steer: (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0),
      handbrake: input.down('Space'),
    };
    car.handbrakeNow = ctrl.handbrake;
    driveCar(G, car, ctrl, dt);
    G.audio.engine(clamp(Math.abs(car.speed) / car.spec.top, 0, 1), true);
    // Running people down is the darkest crime in Palmira.
    for (const ped of G.peds) {
      if (ped.state === 'down' || ped.isOfficer) continue;
      if (Math.abs(car.speed) > 40 && dist(p.x, p.y, ped.x, ped.y) < 20) {
        hurtPed(G, ped, 32, car.vx * 0.6, car.vy * 0.6);
        G.audio.crash(false);
        G.shake = Math.min(10, G.shake + 3);
      }
    }
    return;
  }

  // --- On foot -------------------------------------------------------------
  G.audio.engine(0, false);
  const mx = input.moveX(), my = input.moveY();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER_SPRINT : PLAYER_SPEED;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    p.vx = (mx / len) * speed;
    p.vy = (my / len) * speed;
    p.angle = Math.atan2(p.vy, p.vx);
    p.walkPhase += dt * (sprint ? 12 : 8.5);
  } else {
    p.vx *= Math.exp(-10 * dt); p.vy *= Math.exp(-10 * dt);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const vel = { x: p.vx, y: p.vy };
  collideCircle(G.world, p, PLAYER_RADIUS, vel);
  p.vx = vel.x; p.vy = vel.y;
  p.x = clamp(p.x, 12, G.world.W - 12);
  p.y = clamp(p.y, 12, G.world.waterY - 8);

  // Aim with the mouse while armed; face movement otherwise.
  const aim = G.screenToWorld(input.mouseX, input.mouseY);
  if (p.hasPistol) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

  // Melee: Space or click, a short swing that can drop a pedestrian.
  if ((input.hit('Space') || input.mouseClicked) && p.meleeT <= 0 && !p.hasPistol) {
    p.meleeT = 0.34;
    G.audio.melee();
    const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
    for (const ped of G.peds) {
      const dx = ped.x - p.x, dy = ped.y - p.y;
      if (dx * fx + dy * fy > 0 && Math.hypot(dx, dy) < 30 && ped.state !== 'down') {
        hurtPed(G, ped, 16, fx * 160, fy * 160);
      }
    }
    for (const car of G.cars) {
      if (dist(p.x, p.y, car.x, car.y) < 34) {
        G.damageCarFx(car, 3);
      }
    }
  }

  // Pistol fire: click to shoot toward the mouse.
  if (p.hasPistol && input.mouseDown && p.shootT <= 0) {
    if (p.ammo > 0) {
      p.shootT = 0.21;
      p.ammo--;
      G.fireBullet(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14, p.angle, 'player');
      G.audio.gunshot();
      G.setPanic(p.x, p.y);
      G.commitCrime('shot', p.x, p.y);
      if (p.ammo === 0) { /* keep the empty pistol; ammo pickups refill it */ }
    } else if (p.shootT <= 0) {
      p.shootT = 0.3;
      G.audio.blip(1200, 0.04, 'square', 0.08); // dry click
    }
  }

  // Slow health regen out of trouble keeps runs forgiving.
  if (p.health > 0 && p.health < 100 && G.time - (p.lastHurtAt || 0) > 6) {
    p.health = Math.min(100, p.health + dt * 4);
  }
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.dead || G.state !== 'playing') return;
  p.health -= dmg;
  p.hurtT = 0.25;
  p.lastHurtAt = G.time;
  G.shake = Math.min(9, G.shake + dmg * 0.12);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.onWasted();
  }
}

export function playerSpeedKmh(G) {
  if (G.player.car) return carSpeedKmh(G.player.car);
  return Math.hypot(G.player.vx, G.player.vy) * 0.4;
}

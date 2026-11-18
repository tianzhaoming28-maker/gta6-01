// traffic.js — ambient traffic AI. Cars pick lanes at intersections, keep
// right, slow for obstacles and the car ahead, and panic — honk, swerve,
// flee — when the player's chaos reaches them.

import { ROAD_W } from './config.js';
import { RNG, clamp, dist } from './rng.js';
import { makeCar, driveCar, steerToward, updateCarEffects } from './vehicles.js';
import { laneCenter, nearestNode } from './world.js';
import { TRAFFIC_TYPES } from './config.js';

const rng = new RNG(4242);

export function spawnTraffic(G, count) {
  const world = G.world;
  for (let n = 0; n < count; n++) {
    const node = { i: rng.int(0, world.roadsV.length - 1), j: rng.int(0, world.roadsH.length - 1) };
    const vertical = rng.chance(0.5);
    const dirSign = rng.chance(0.5) ? 1 : -1;
    let x, y, angle;
    if (vertical) {
      x = laneCenter(world, 'v', node.i, dirSign);
      y = world.roadsH[node.j] + ROAD_W / 2 + rng.range(-160, 160);
      angle = dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = world.roadsV[node.i] + ROAD_W / 2 + rng.range(-160, 160);
      y = laneCenter(world, 'h', node.j, dirSign);
      angle = dirSign > 0 ? 0 : Math.PI;
    }
    // Keep spawns away from the player's start so the opening is calm.
    if (dist(x, y, G.player.x, G.player.y) < 260) continue;
    const car = makeCar(rng.pick(TRAFFIC_TYPES), x, y, angle, { role: 'traffic', rng });
    car.nodeI = node.i; car.nodeJ = node.j;
    car.dirX = vertical ? 0 : dirSign;
    car.dirY = vertical ? dirSign : 0;
    pickNextNode(G, car, true);
    G.cars.push(car);
  }
}

export function spawnParked(G) {
  const world = G.world;
  for (const spot of world.parkedSpots) {
    if (rng.chance(0.28)) continue;
    const car = makeCar(rng.pick(TRAFFIC_TYPES), spot.x, spot.y, spot.angle + (spot.curb ? 0 : rng.range(-0.05, 0.05)), { role: 'parked', rng });
    car.driver = null;
    G.cars.push(car);
  }
}

// Choose the car's next intersection waypoint, honouring its lane side.
function pickNextNode(G, car, first = false) {
  const world = G.world;
  const node = nearestNode(world, car.x, car.y);
  let i = node.i, j = node.j;
  // Advance one intersection along the current heading when possible.
  const options = [];
  if (car.dirX > 0 && i < world.roadsV.length - 1) options.push([i + 1, j, 1, 0]);
  if (car.dirX < 0 && i > 0) options.push([i - 1, j, -1, 0]);
  if (car.dirY > 0 && j < world.roadsH.length - 1) options.push([i, j + 1, 0, 1]);
  if (car.dirY < 0 && j > 0) options.push([i, j - 1, 0, -1]);
  // Turns at the upcoming intersection.
  const turns = [];
  if (car.dirX !== 0) {
    if (j < world.roadsH.length - 1) turns.push([i, j + 1, 0, 1]);
    if (j > 0) turns.push([i, j - 1, 0, -1]);
  } else {
    if (i < world.roadsV.length - 1) turns.push([i + 1, j, 1, 0]);
    if (i > 0) turns.push([i - 1, j, -1, 0]);
  }
  let choice = null;
  if (!first && turns.length && rng.chance(0.38)) choice = rng.pick(turns);
  else if (options.length) choice = options[0];
  else if (turns.length) choice = rng.pick(turns);
  if (!choice) { // dead end of the grid: turn around
    car.dirX = -car.dirX; car.dirY = -car.dirY;
    choice = [i + car.dirX, j + car.dirY, car.dirX, car.dirY];
    choice[0] = clamp(choice[0], 0, world.roadsV.length - 1);
    choice[1] = clamp(choice[1], 0, world.roadsH.length - 1);
  }
  car.nodeI = choice[0]; car.nodeJ = choice[1];
  car.dirX = choice[2]; car.dirY = choice[3];
  // Waypoint: the lane position at the far side of that intersection.
  const vertical = car.dirY !== 0;
  if (vertical) {
    car.targetX = laneCenter(world, 'v', car.nodeI, car.dirY);
    car.targetY = world.roadsH[car.nodeJ] + ROAD_W / 2 + car.dirY * (ROAD_W / 2 + 26);
  } else {
    car.targetX = world.roadsV[car.nodeI] + ROAD_W / 2 + car.dirX * (ROAD_W / 2 + 26);
    car.targetY = laneCenter(world, 'h', car.nodeJ, car.dirX);
  }
  car.hasTarget = true;
}

export function updateTraffic(G, dt) {
  const px = G.player.x, py = G.player.y;
  for (const car of G.cars) {
    if (car.role !== 'traffic') continue;
    updateCarEffects(G, car, dt);
    if (car.wrecked) { car.speed = 0; continue; }
    const dPlayer = dist(car.x, car.y, px, py);
    if (dPlayer > 1500) continue; // far traffic idles cheaply

    // Panic: gunfire nearby, a wreck, or the player's car bearing down.
    if (G.panicX !== null && dist(car.x, car.y, G.panicX, G.panicY) < 190) car.fleeT = Math.max(car.fleeT, 2.2);
    if (G.player.car && dPlayer < 90 && Math.abs(G.player.car.speed) > 120) car.fleeT = Math.max(car.fleeT, 1.6);

    let ctrl;
    if (car.fleeT > 0) {
      car.fleeT -= dt;
      const away = Math.atan2(car.y - py, car.x - px);
      const tx = car.x + Math.cos(away) * 200, ty = car.y + Math.sin(away) * 200;
      ctrl = steerToward(car, tx, ty, dt, { throttle: 1 });
      ctrl.throttle = 1;
      if (car.honkT <= 0 && rng.chance(0.3)) { car.honkT = 1.4; G.audio.honk(); }
    } else {
      if (!car.hasTarget || dist(car.x, car.y, car.targetX, car.targetY) < 42) pickNextNode(G, car);
      ctrl = steerToward(car, car.targetX, car.targetY, dt, { throttle: 0.85 });
      // Match cruise speed; stop behind obstacles and slow traffic.
      const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
      let blocked = false;
      for (const other of G.cars) {
        if (other === car) continue;
        const ox = other.x - car.x, oy = other.y - car.y;
        const ahead = ox * fx + oy * fy;
        const side = Math.abs(ox * -fy + oy * fx);
        if (ahead > 0 && ahead < 58 && side < 15) { blocked = true; break; }
      }
      if (!blocked && G.player.car === null) {
        const aheadP = (px - car.x) * fx + (py - car.y) * fy;
        const sideP = Math.abs((px - car.x) * -fy + (py - car.y) * fx);
        if (aheadP > 0 && aheadP < 40 && sideP < 13) blocked = true;
      }
      const speedRatio = Math.abs(car.speed) / car.cruise;
      if (blocked) ctrl.throttle = car.speed > 6 ? -0.8 : 0;
      else if (speedRatio > 1) ctrl.throttle = 0.1;
      if (car.honkT > 0) car.honkT -= dt;
      if (blocked && car.honkT <= 0 && rng.chance(0.006)) { car.honkT = 2; G.audio.honk(); }
    }
    car.handbrakeNow = !!ctrl.handbrake;
    driveCar(G, car, ctrl, dt);
  }
}

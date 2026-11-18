// pedestrians.js — Palmira's walkers. They stroll the sidewalks and park
// paths between waypoints, chat in pairs, and scatter screaming when cars
// mount the kerb or guns come out.

import { RNG, clamp, dist } from './rng.js';
import { blockRect } from './world.js';
import { CITY_H } from './config.js';

const rng = new RNG(777);
const SHIRTS = ['#e4572e', '#17bebb', '#f2c230', '#ff5d8f', '#57a773', '#3d7bd9', '#fdf0d5', '#7d3cff', '#e2725b', '#48a9a1'];
const PANTS = ['#2b3a4a', '#5a4632', '#37474f', '#6d4c41', '#263238', '#795548'];
const SKIN = ['#f2c79b', '#d9a066', '#a9714b', '#7a4a2b', '#ffe0bd'];

export function makePed(x, y, opts = {}) {
  return {
    x, y, vx: 0, vy: 0,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(38, 62),
    shirt: opts.shirt || rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    skin: rng.pick(SKIN),
    targetX: x, targetY: y, hasTarget: false,
    state: 'walk',          // walk | flee | down | chat
    fleeT: 0, downT: 0, chatT: 0,
    health: 30,
    walkPhase: rng.range(0, 6),
    homeBlock: null,
    isOfficer: !!opts.officer,
    shootT: 0,
  };
}

// Sidewalk waypoint: a random point on the pavement ring of a random block,
// or along the beach promenade.
export function pickWalkTarget(G, ped) {
  const world = G.world;
  if (rng.chance(0.14)) {
    ped.targetX = rng.range(50, world.W - 50);
    ped.targetY = CITY_H - 14 + rng.range(0, 10);
    ped.hasTarget = true;
    return;
  }
  const c = rng.int(0, 6), r = rng.int(0, 4);
  const b = blockRect(c, r);
  const side = rng.int(0, 3);
  const inset = 13;
  if (side === 0) { ped.targetX = rng.range(b.x, b.x + b.w); ped.targetY = b.y + inset; }
  else if (side === 1) { ped.targetX = rng.range(b.x, b.x + b.w); ped.targetY = b.y + b.h - inset; }
  else if (side === 2) { ped.targetX = b.x + inset; ped.targetY = rng.range(b.y, b.y + b.h); }
  else { ped.targetX = b.x + b.w - inset; ped.targetY = rng.range(b.y, b.y + b.h); }
  ped.hasTarget = true;
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i++) {
    const c = rng.int(0, 6), r = rng.int(0, 4);
    const b = blockRect(c, r);
    const ped = makePed(b.x + rng.range(10, b.w - 10), b.y + rng.range(10, b.h - 10));
    // Nudge onto the block edge (pavement), not through a building.
    ped.x = clamp(ped.x, b.x + 8, b.x + b.w - 8);
    if (ped.y > b.y + 24 && ped.y < b.y + b.h - 24) ped.y = b.y + 12;
    ped.homeBlock = { c, r };
    pickWalkTarget(G, ped);
    G.peds.push(ped);
  }
  // A few beachgoers on the sand.
  for (let i = 0; i < 8; i++) {
    const ped = makePed(rng.range(60, G.world.W - 60), CITY_H + rng.range(60, 170));
    ped.speed = rng.range(26, 40);
    G.peds.push(ped);
  }
}

export function hurtPed(G, ped, dmg, kx = 0, ky = 0) {
  ped.health -= dmg;
  ped.vx += kx; ped.vy += ky;
  if (ped.health <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.downT = 7;
    if (!ped.isOfficer) G.commitCrime('killPed', ped.x, ped.y);
  } else if (ped.state !== 'down') {
    ped.state = 'flee';
    ped.fleeT = 3;
    if (!ped.isOfficer) G.commitCrime('assault', ped.x, ped.y);
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x, py = G.player.y;
  for (const ped of G.peds) {
    if (ped.isOfficer) continue; // officers are driven by police.js
    ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);
    if (ped.state === 'down') {
      ped.downT -= dt;
      ped.vx *= 0.8; ped.vy *= 0.8;
      ped.x += ped.vx * dt; ped.y += ped.vy * dt;
      if (ped.downT <= 0) { ped.health = 30; ped.state = 'flee'; ped.fleeT = 2; }
      continue;
    }
    // Fear triggers: the panic point, fast cars close by, the player aiming.
    let fleeing = ped.state === 'flee';
    if (G.panicX !== null && dist(ped.x, ped.y, G.panicX, G.panicY) < 170) fleeing = true;
    for (const car of G.cars) {
      if (Math.abs(car.speed) > 95 && dist(ped.x, ped.y, car.x, car.y) < 52) { fleeing = true; break; }
    }
    if (fleeing) {
      ped.state = 'flee';
      ped.fleeT = Math.max(ped.fleeT, 0.7);
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const ax = ped.x - px, ay = ped.y - py;
      const d = Math.hypot(ax, ay) || 1;
      const sp = 128;
      ped.vx = (ax / d) * sp; ped.vy = (ay / d) * sp;
      ped.angle = Math.atan2(ped.vy, ped.vx);
      if (ped.fleeT <= 0) { ped.state = 'walk'; ped.hasTarget = false; }
    } else {
      if (!ped.hasTarget || dist(ped.x, ped.y, ped.targetX, ped.targetY) < 9) {
        if (rng.chance(0.1)) { ped.state = 'chat'; ped.chatT = rng.range(1.5, 4); }
        pickWalkTarget(G, ped);
      }
      if (ped.state === 'chat') {
        ped.chatT -= dt;
        ped.vx *= 0.8; ped.vy *= 0.8;
        if (ped.chatT <= 0) ped.state = 'walk';
      } else {
        const dx = ped.targetX - ped.x, dy = ped.targetY - ped.y;
        const d = Math.hypot(dx, dy) || 1;
        ped.vx = (dx / d) * ped.speed; ped.vy = (dy / d) * ped.speed;
        ped.angle = Math.atan2(ped.vy, ped.vx);
      }
    }
    ped.x += ped.vx * dt;
    ped.y += ped.vy * dt;
    // Keep walkers out of buildings and the sea; slide along walls.
    resolvePedCollision(G, ped);
    ped.x = clamp(ped.x, 10, G.world.W - 10);
    ped.y = clamp(ped.y, 10, G.world.waterY - 6);
  }
}

function resolvePedCollision(G, ped) {
  for (const c of G.world.colliders) {
    if (ped.x > c.x - 7 && ped.x < c.x + c.w + 7 && ped.y > c.y - 7 && ped.y < c.y + c.h + 7) {
      const left = ped.x - (c.x - 7), right = (c.x + c.w + 7) - ped.x;
      const top = ped.y - (c.y - 7), bot = (c.y + c.h + 7) - ped.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) ped.x = c.x - 7;
      else if (m === right) ped.x = c.x + c.w + 7;
      else if (m === top) ped.y = c.y - 7;
      else ped.y = c.y + c.h + 7;
      ped.hasTarget = false;
    }
  }
}

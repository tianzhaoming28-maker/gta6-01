// main.js — Palmira Heat's boot, game loop and state machine. Owns the
// central game object every system reads, runs crime/heat bookkeeping,
// bullets, effects, pickups, busted/wasted flow and screen transitions.

import { VIEW_W, VIEW_H, CRIME_HEAT, HEAT_DECAY, HEAT_DECAY_SEEN, HEAT_FOR_STAR } from './config.js';
import { clamp, dist } from './rng.js';
import { buildWorld } from './world.js';
import { AudioSys } from './audio.js';
import { loadSave, storeSave, wipeSave, defaultSave } from './save.js';
import { createInput } from './input.js';
import { makePlayer, updatePlayer, hurtPlayer, nearestEnterableCar } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic } from './traffic.js';
import { makePed, spawnPeds, updatePeds, hurtPed } from './pedestrians.js';
import { updatePolice, wantedStars, clearPolice } from './police.js';
import { damageCar, collideCars } from './vehicles.js';
import { makeMissionState, updateMissions, currentObjective, startStoryMission, retryFailed } from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawCard, drawEndScreen, drawStoryDone } from './hud.js';
import { parseShotQuery, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const shotReq = parseShotQuery();
const seed = shotReq ? shotReq.seed : 1;

const G = {
  viewW: VIEW_W, viewH: VIEW_H,
  time: 0, state: 'title',
  world: buildWorld(seed),
  input: createInput(canvas),
  audio: new AudioSys(),
  save: loadSave(),
  cash: 120,
  heat: 0, stars: 0,
  lastCrimeAt: -99, policeSeen: false, policeSpawnT: 0, roadblockT: 0, roadblocks: [],
  player: null,
  cars: [], peds: [], bullets: [], particles: [], popups: [], skids: [], toasts: [],
  pickups: [],
  missions: makeMissionState(),
  objective: null,
  camera: { x: 0, y: 0 },
  shake: 0, dusk: false, frozen: false, muted: false,
  panicX: null, panicY: null, panicT: 0,
  card: null, lastPenalty: 0, storyJustDone: false,
  buttons: [], nearCar: null,
  shotMode: !!shotReq,
};
window.__palmira = G;

// --- World population ---------------------------------------------------------

function resetWorldCast() {
  G.cars = [];
  G.peds = [];
  G.bullets = [];
  G.particles = [];
  G.popups = [];
  G.skids = [];
  G.roadblocks = [];
  spawnParked(G);
  spawnTraffic(G, 26);
  spawnPeds(G, 42);
  spawnPickups();
}

function spawnPickups() {
  G.pickups = [];
  const spots = [
    { kind: 'pistol', x: G.world.places.docks.x + 90, y: G.world.places.docks.y + 120 },
    { kind: 'pistol', x: G.world.places.depot.x - 90, y: G.world.places.depot.y - 60 },
    { kind: 'ammo', x: G.world.places.garage.x - 110, y: G.world.places.garage.y - 120 },
    { kind: 'ammo', x: G.world.places.hideout.x + 120, y: G.world.places.hideout.y + 90 },
    { kind: 'health', x: G.world.places.clinic.x + 30, y: G.world.places.clinic.y + 130 },
    { kind: 'health', x: G.world.places.beach.x - 200, y: G.world.places.beach.y },
    { kind: 'cash', x: G.world.places.beach.x + 260, y: G.world.places.beach.y + 30 },
  ];
  for (const s of spots) G.pickups.push({ ...s, taken: false, respawnT: 0, phase: Math.random() * 6 });
}

// --- Services the other modules call through G --------------------------------

G.spawnPed = (x, y, opts) => {
  const ped = makePed(x, y, opts);
  G.peds.push(ped);
  return ped;
};
G.screenToWorld = (sx, sy) => ({ x: sx + G.camera.x, y: sy + G.camera.y });
G.worldToScreen = (wx, wy) => ({ x: wx - G.camera.x, y: wy - G.camera.y });
G.setPanic = (x, y) => { G.panicX = x; G.panicY = y; G.panicT = 1.6; };
G.notify = (text, life = 2.4, color) => {
  G.toasts.push({ text, life, maxLife: life, color });
  if (G.toasts.length > 3) G.toasts.shift();
};
G.addCash = (amount, x, y) => {
  G.cash += amount;
  G.save.cash = G.cash;
  if (x !== undefined) G.popups.push({ x, y, text: '+$' + amount, life: 1.4, maxLife: 1.4, color: '#7be495' });
};
G.spawnSparks = (x, y, n, color) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 130;
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.34, maxLife: 0.34, size: 2.6, color, kind: 'spark' });
  }
};
G.addSkid = (x, y) => {
  G.skids.push({ x, y, life: 14 });
  if (G.skids.length > 900) G.skids.splice(0, G.skids.length - 900);
};
G.damageCarFx = (car, dmg) => {
  damageCar(G, car, dmg);
  G.spawnSparks(car.x, car.y, 3, '#ffd76a');
};
G.commitCrime = (kind, x, y) => {
  if (G.state !== 'playing' || G.frozen) return;
  const before = wantedStars(G);
  G.heat += CRIME_HEAT[kind] || 6;
  G.lastCrimeAt = G.time;
  if (kind === 'shot' || kind === 'killPed' || kind === 'hitPed') G.setPanic(x, y);
  const after = wantedStars(G);
  if (after > before) G.notify(after + (after === 1 ? ' STAR' : ' STARS') + ' — PPD RESPONDING', 2.2, '#ffc72c');
};
G.addHeat = (amount) => { G.heat += amount; G.lastCrimeAt = G.time; };
G.setHeat = (amount) => { G.heat = Math.max(G.heat, amount); G.lastCrimeAt = G.time; };
G.setStars = (n) => { G.heat = Math.max(G.heat, HEAT_FOR_STAR[n] + 2); G.lastCrimeAt = G.time; };
G.fireBullet = (x, y, angle, from) => {
  G.bullets.push({ x, y, vx: Math.cos(angle) * 780, vy: Math.sin(angle) * 780, life: 0.55, from });
};
G.showCard = (title, body, hint) => {
  G.card = { title, body, hint };
  G.cardT = 0;
  G.state = 'card';
};
G.persist = () => {
  G.save.cash = G.cash;
  G.save.mission = G.missions.index;
  G.save.muted = G.muted;
  storeSave(G.save);
};
G.refreshObjective = () => { G.objective = currentObjective(G); };

G.onBusted = () => {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  G.lastPenalty = Math.min(G.cash, Math.max(40, Math.round(G.cash * 0.15)));
  G.cash -= G.lastPenalty;
  G.audio.busted();
  G.endTimer = 0;
};
G.onWasted = () => {
  if (G.state !== 'playing') return;
  G.state = 'wasted';
  G.lastPenalty = Math.min(G.cash, Math.max(30, Math.round(G.cash * 0.10)));
  G.cash -= G.lastPenalty;
  G.audio.sting(false);
  G.endTimer = 0;
};

function respawnAtClinic() {
  const p = G.player;
  const clinic = G.world.places.clinic;
  if (p.car) { p.car.role = 'parked'; p.car.driver = null; p.car = null; }
  p.x = clinic.x; p.y = clinic.y + 90;
  p.vx = 0; p.vy = 0;
  p.health = 100;
  p.dead = false;
  p.bustMeter = 0;
  G.heat = 0;
  clearPolice(G);
  G.persist();
  G.state = 'playing';
}

// --- Run setup ------------------------------------------------------------------

function newGame() {
  G.save = wipeSave();
  G.save.started = true;
  G.cash = G.save.cash;
  G.missions = makeMissionState();
  startRun();
  G.showCard('PALMIRA HEAT', 'Rico Vega just rolled back into Palmira with $120 and a borrowed shirt. Marisol\'s crew runs out of the garage on Calle Palma — get over there and earn.', 'Press ENTER');
}

function continueGame() {
  G.cash = G.save.cash;
  G.muted = !!G.save.muted;
  G.audio.setMuted(G.muted);
  G.missions = makeMissionState();
  G.missions.index = clamp(G.save.mission || 0, 0, 5);
  if (G.missions.index >= 5) G.missions.phase = 'offer';
  startRun();
}

function startRun() {
  G.player = makePlayer(G.world.places.garage.x - 130, G.world.places.garage.y + 40);
  resetWorldCast();
  G.heat = 0;
  G.dusk = false;
  G.state = 'playing';
  G.refreshObjective();
  G.persist();
}

// Camera service (shots.js stages scenes before the first frame runs).
G.updateCamera = function (dt) {
  const p = G.player;
  if (!p) return;
  const lead = p.car ? clamp(p.car.speed * 0.34, -90, 130) : 0;
  const tx = p.x + (p.car ? Math.cos(p.car.angle) * lead : 0);
  const ty = p.y + (p.car ? Math.sin(p.car.angle) * lead : 0);
  const k = G.frozen ? 1 : Math.min(1, dt * 5.2);
  G.camera.x += (clamp(tx - VIEW_W / 2, 0, Math.max(0, G.world.W - VIEW_W)) - G.camera.x) * k;
  G.camera.y += (clamp(ty - VIEW_H / 2, 0, Math.max(0, G.world.H - VIEW_H)) - G.camera.y) * k;
};

// Boot state for the title screen backdrop and for shot mode.
G.player = makePlayer(G.world.places.garage.x - 130, G.world.places.garage.y + 40);
resetWorldCast();
G.cash = G.save.cash || 120;
G.muted = !!G.save.muted;
if (shotReq) {
  stageShot(G, shotReq.name);
} else {
  G.state = 'title';
}

// --- Per-frame update -------------------------------------------------------------

function update(dt) {
  G.time += dt;
  if (G.input.hit('KeyM')) {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    G.notify(G.muted ? 'SOUND OFF' : 'SOUND ON', 1.2);
  }
  if (G.input.anyGesture) G.audio.unlock();

  handleButtons();

  if (G.state === 'title') {
    // Slow ambient pan behind the title.
    G.camera.x = clamp(G.world.places.garage.x - VIEW_W / 2 + Math.sin(G.time * 0.05) * 160, 0, G.world.W - VIEW_W);
    G.camera.y = clamp(G.world.places.garage.y - VIEW_H / 2, 0, G.world.H - VIEW_H);
    updateAmbient(dt);
    return;
  }
  if (G.state === 'card') {
    G.cardT = (G.cardT || 0) + dt;
    // The click or key that opened the card must not dismiss it same-frame.
    if (G.cardT > 0.35 && (G.input.hit('Enter') || G.input.mouseClicked)) {
      G.card = null;
      if (G.storyJustDone) { G.storyJustDone = false; G.state = 'storydone'; }
      else {
        G.state = 'playing';
        if (G.missions.phase === 'failed') retryFailed(G);
      }
    }
    return;
  }
  if (G.state === 'storydone') {
    if (G.input.hit('Enter') || G.input.mouseClicked) G.state = 'playing';
    return;
  }
  if (G.state === 'busted' || G.state === 'wasted') {
    G.endTimer += dt;
    if ((G.input.hit('Enter') && G.endTimer > 0.5) || G.endTimer > 4) respawnAtClinic();
    updateAmbient(dt);
    return;
  }
  if (G.state === 'paused') {
    if (G.input.hit('Escape') || G.input.hit('KeyP')) G.state = 'playing';
    return;
  }

  // Playing.
  if (G.input.hit('Escape') || G.input.hit('KeyP')) { G.state = 'paused'; return; }
  if (G.frozen) { updateCamera(dt); return; }

  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(dt);
  updatePickups(dt);
  updateMissions(G, dt);
  updateHeat(dt);
  updateEffects(dt);
  G.refreshObjective();
  G.nearCar = G.player.car ? null : nearestEnterableCar(G);
  updateCamera(dt);

  // Car-to-car collisions across the whole cast.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      collideCars(G, G.cars[i], G.cars[j], dt);
    }
  }
  // Despawn dead officers and far peel-offs are handled in police.js.
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (ped.isOfficer && ped.state === 'down') G.peds.splice(i, 1);
  }
  // Keep the ambient cast topped up near the player.
  if (G.cars.filter((c) => c.role === 'traffic').length < 20 && Math.random() < dt * 0.4) spawnTraffic(G, 2);
}

function updateAmbient(dt) {
  // Title/end screens: traffic and peds keep living, nobody commits crimes.
  const savedState = G.state;
  updateTraffic(G, dt * 0.6);
  updatePeds(G, dt * 0.6);
  updateEffects(dt);
  G.state = savedState;
}

function updateHeat(dt) {
  if (G.heat <= 0) return;
  const cleanTime = G.time - G.lastCrimeAt;
  if (cleanTime > 2.5) {
    G.heat -= (G.policeSeen ? HEAT_DECAY_SEEN : HEAT_DECAY) * dt;
    if (G.heat < 0) G.heat = 0;
  }
}

function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // Buildings stop bullets.
    if (!dead) {
      for (const c of G.world.colliders) {
        if (b.x > c.x && b.x < c.x + c.w && b.y > c.y && b.y < c.y + c.h) { dead = true; break; }
      }
    }
    if (!dead && b.from === 'player') {
      for (const ped of G.peds) {
        if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 9) {
          if (ped.isOfficer) { ped.health -= 34; if (ped.health <= 0) { ped.state = 'down'; G.addHeat(30); } }
          else hurtPed(G, ped, 34, b.vx * 0.1, b.vy * 0.1);
          dead = true;
          break;
        }
      }
      if (!dead) for (const car of G.cars) {
        if (car !== G.player.car && dist(b.x, b.y, car.x, car.y) < car.spec.w * 0.55) {
          damageCar(G, car, 9);
          G.spawnSparks(b.x, b.y, 3, '#ffd76a');
          if (car.role === 'police') G.commitCrime('hitPolice', car.x, car.y);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'police') {
      if (!G.player.car && dist(b.x, b.y, G.player.x, G.player.y) < 10) {
        hurtPlayer(G, 7);
        dead = true;
      } else if (G.player.car && dist(b.x, b.y, G.player.x, G.player.y) < 22) {
        if (Math.random() < 0.4) hurtPlayer(G, 4);
        damageCar(G, G.player.car, 2);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function updatePickups(dt) {
  for (const pk of G.pickups) {
    if (pk.taken) {
      pk.respawnT -= dt;
      if (pk.respawnT <= 0) pk.taken = false;
      continue;
    }
    if (G.player.car) continue;
    if (dist(G.player.x, G.player.y, pk.x, pk.y) < 20) {
      pk.taken = true;
      pk.respawnT = 45;
      if (pk.kind === 'pistol') {
        G.player.hasPistol = true;
        G.player.ammo += 18;
        G.notify('PISTOL + 18 ROUNDS', 2);
      } else if (pk.kind === 'ammo') {
        if (G.player.hasPistol) { G.player.ammo += 12; G.notify('+12 ROUNDS', 1.6); }
        else { G.player.hasPistol = true; G.player.ammo = 12; G.notify('PISTOL FOUND', 2); }
      } else if (pk.kind === 'health') {
        G.player.health = Math.min(100, G.player.health + 45);
        G.notify('+45 HEALTH', 1.6);
      } else if (pk.kind === 'cash') {
        G.addCash(60, pk.x, pk.y - 14);
      }
      G.audio.pickup();
    }
  }
}

function updateEffects(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { G.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.kind === 'spark') { pt.vx *= 0.86; pt.vy *= 0.86; }
  }
  for (let i = G.popups.length - 1; i >= 0; i--) {
    const pop = G.popups[i];
    pop.life -= dt;
    pop.y -= 34 * dt;
    if (pop.life <= 0) G.popups.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].life -= dt;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    G.toasts[i].life -= dt;
    if (G.toasts[i].life <= 0) G.toasts.splice(i, 1);
  }
  if (G.panicT > 0) { G.panicT -= dt; if (G.panicT <= 0) G.panicX = null; }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
}

function updateCamera(dt) {
  const p = G.player;
  const lead = p.car ? clamp(p.car.speed * 0.34, -90, 130) : 0;
  const tx = p.x + (p.car ? Math.cos(p.car.angle) * lead : 0);
  const ty = p.y + (p.car ? Math.sin(p.car.angle) * lead : 0);
  const k = G.frozen ? 1 : Math.min(1, dt * 5.2);
  G.camera.x += (clamp(tx - VIEW_W / 2, 0, Math.max(0, G.world.W - VIEW_W)) - G.camera.x) * k;
  G.camera.y += (clamp(ty - VIEW_H / 2, 0, Math.max(0, G.world.H - VIEW_H)) - G.camera.y) * k;
}
G.updateCamera = updateCamera;

// --- Buttons (title + pause) -------------------------------------------------------

function handleButtons() {
  if (!G.input.mouseClicked) { return; }
  for (const click of G.input.clicks) {
    for (const b of G.buttons) {
      if (b.disabled) continue;
      if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
        pressButton(b.id);
        return;
      }
    }
  }
}

function pressButton(id) {
  G.audio.unlock();
  if (id === 'new') newGame();
  else if (id === 'continue') { if (G.save.started) continueGame(); }
  else if (id === 'resume') G.state = 'playing';
  else if (id === 'save') { G.persist(); G.notify('GAME SAVED', 1.6); }
  else if (id === 'restart') {
    if (G.missions.active) {
      const idx = G.missions.active.index;
      G.missions.active = null;
      G.missions.phase = 'offer';
      startStoryMission(G, idx);
    } else if (G.missions.phase === 'failed') {
      retryFailed(G);
    }
    G.state = 'playing';
  } else if (id === 'mute') {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    G.persist();
  } else if (id === 'title') {
    clearPolice(G);
    G.heat = 0;
    G.state = 'title';
  }
}

// --- Render ---------------------------------------------------------------------------

function render() {
  ctx.save();
  const shx = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  ctx.translate(-Math.round(G.camera.x + shx), -Math.round(G.camera.y + shy));
  drawWorld(ctx, G);
  ctx.restore();
  drawPickupsWorld(shx, shy);
  G.buttons = [];
  drawHUD(ctx, G);
  if (G.state === 'title') drawTitle(ctx, G);
  else if (G.state === 'paused') drawPause(ctx, G);
  else if (G.state === 'card') drawCard(ctx, G);
  else if (G.state === 'busted') drawEndScreen(ctx, G, 'busted');
  else if (G.state === 'wasted') drawEndScreen(ctx, G, 'wasted');
  else if (G.state === 'storydone') drawStoryDone(ctx, G);
  // Damage vignette.
  if (G.player.hurtT > 0 && G.state === 'playing') {
    ctx.fillStyle = 'rgba(200,30,20,' + (G.player.hurtT * 0.35) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (G.player.bustMeter > 0.03 && G.state === 'playing') {
    ctx.fillStyle = 'rgba(40,80,220,' + (G.player.bustMeter * 0.16) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawPickupsWorld(shx, shy) {
  ctx.save();
  ctx.translate(-Math.round(G.camera.x + shx), -Math.round(G.camera.y + shy));
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (pk.x < G.camera.x - 30 || pk.x > G.camera.x + VIEW_W + 30 || pk.y < G.camera.y - 30 || pk.y > G.camera.y + VIEW_H + 30) continue;
    const bob = Math.sin(G.time * 3 + pk.phase) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(20,16,10,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 8 - bob, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (pk.kind === 'pistol' || pk.kind === 'ammo') {
      ctx.fillStyle = '#17181c';
      ctx.fillRect(-8, -2.4, 15, 4.6);
      ctx.fillRect(3, 1, 4.4, 6);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(-8, -2.4, 15, 1.6);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fdfdfd';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-2.4, -6, 4.8, 12);
      ctx.fillRect(-6, -2.4, 12, 4.8);
    } else {
      ctx.fillStyle = '#7be495';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#14532d';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  ctx.restore();
}

// --- Loop --------------------------------------------------------------------------------

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  update(dt);
  render();
  G.input.endFrame();
}
requestAnimationFrame(frame);

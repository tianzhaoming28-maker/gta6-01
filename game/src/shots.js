// shots.js — deterministic screenshot staging. A URL like
// ?shot=chase&seed=1 builds a composed, frozen scene with the full HUD up,
// so the four hand-in screenshots are real renders of real game state.

import { makeCar } from './vehicles.js';

export function parseShotQuery() {
  const q = new URLSearchParams(window.location.search);
  const name = q.get('shot');
  if (!name) return null;
  const seed = parseInt(q.get('seed') || '1', 10) || 1;
  return { name, seed };
}

// Called once after the world and cast exist. Each scene sets the player,
// traffic, police, wanted level and mission state, then freezes the world
// (G.frozen) so the capture is stable.
export function stageShot(G, name) {
  const world = G.world;
  const places = world.places;
  G.state = 'playing';
  G.save.started = true;

  if (name === 'cover') {
    // Driving downtown among traffic, mid first job, banner + minimap up.
    const car = makeCar('coupe', world.roadsV[3] + 76, world.roadsH[2] + 210, Math.PI / 2, { role: 'player', color: '#f2c230' });
    car.driver = 'player';
    car.speed = 150; car.vx = 0; car.vy = 150;
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x; G.player.y = car.y;
    addTrafficNear(G, car.x, car.y);
    G.missions.index = 0;
    G.missions.phase = 'active';
    G.missions.active = { def: { id: 'first-wheels', title: 'JOB 1', reward: 350 }, index: 0, step: 0, t: 3, objective: { x: places.garage.x, y: places.garage.y, text: 'Steal any car and drive it to the crew garage', label: 'GARAGE' } };
    G.cash = 470;
  } else if (name === 'chase') {
    // Four-star pursuit: interceptors closing in, smoke and sparks flying.
    const car = makeCar('muscle', world.roadsV[4] + 76, world.roadsH[3] + 300, Math.PI / 2, { role: 'player', color: '#8c1c13' });
    car.driver = 'player';
    car.speed = 205; car.vx = 0; car.vy = 205;
    car.health = 38;
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x; G.player.y = car.y;
    G.player.hasPistol = true; G.player.ammo = 24;
    const spots = [
      [car.x - 52, car.y - 74, Math.PI / 2 + 0.24],
      [car.x + 56, car.y - 108, Math.PI / 2 - 0.18],
      [car.x - 6, car.y - 178, Math.PI / 2 + 0.05],
      [car.x + 96, car.y + 96, Math.PI / 2 + 0.5],
    ];
    for (const [x, y, a] of spots) {
      const cop = makeCar('police', x, y, a, { role: 'police', color: '#f2f2f2' });
      cop.driver = 'police';
      cop.speed = 195; cop.vx = Math.sin(a) * 0; cop.vy = 195;
      G.cars.push(cop);
    }
    addTrafficNear(G, car.x + 200, car.y + 300);
    G.setHeat(150); // four stars
    G.policeSeen = true;
    G.cash = 2130;
    G.spawnSparks(car.x + 16, car.y - 6, 12, '#ffd76a');
    // A drift arc of skid marks behind the muscle car, and engine smoke.
    for (let i = 0; i < 16; i++) {
      G.addSkid(car.x - 8 + Math.sin(i * 0.4) * 6, car.y - 30 - i * 11);
      G.addSkid(car.x + 8 + Math.sin(i * 0.4) * 6, car.y - 30 - i * 11);
    }
    for (let i = 0; i < 10; i++) {
      G.particles.push({ x: car.x - 16 + i * 3.4, y: car.y - 24 - i * 8, vx: 0, vy: -14, life: 1.8, maxLife: 1.8, size: 11 + i * 0.7, color: 'rgba(70,66,74,0.72)', kind: 'smoke' });
      G.particles.push({ x: car.x + 12, y: car.y - 40 - i * 9, vx: 4, vy: -10, life: 1.5, maxLife: 1.5, size: 8, color: 'rgba(215,215,220,0.6)', kind: 'smoke' });
    }
    G.missions.index = 3;
    G.missions.phase = 'active';
    G.missions.active = { def: { id: 'hot-metal', title: 'JOB 4', reward: 1200 }, index: 3, step: 1, t: 40, objective: { x: places.docks.x, y: places.docks.y, text: 'Drive the hot van to the docks — survive the heat!', label: 'DOCKS' } };
  } else if (name === 'mission') {
    // On foot at the depot pickup, gold marker overhead, locals around.
    G.player.x = places.depot.x - 30;
    G.player.y = places.depot.y + 96;
    G.player.angle = 0.4;
    G.player.hasPistol = false;
    G.cash = 1095;
    G.missions.index = 1;
    G.missions.phase = 'active';
    G.missions.active = { def: { id: 'hot-package', title: 'JOB 2', reward: 600 }, index: 1, step: 0, t: 5, objective: { x: places.depot.x, y: places.depot.y, text: 'Pick up the package at the North Depot', label: 'PICKUP' } };
    // A couple of pedestrians stroll past the marker.
    let n = 0;
    for (const ped of G.peds) {
      if (ped.isOfficer) continue;
      ped.x = G.player.x + 40 + n * 34;
      ped.y = G.player.y + 26 - n * 18;
      ped.hasTarget = false;
      if (++n >= 4) break;
    }
    const van = makeCar('van', places.depot.x + 66, places.depot.y + 128, 0.1, { role: 'parked', color: '#7a8b99' });
    van.driver = null;
    G.cars.push(van);
  } else if (name === 'dusk') {
    // Dusk standoff by the beach road: headlights on, pistol drawn, one star.
    G.dusk = true;
    G.player.x = world.roadsV[5] + 40;
    G.player.y = world.beachY - 60;
    G.player.angle = 0.9;
    G.player.hasPistol = true;
    G.player.ammo = 17;
    G.cash = 3420;
    const mine = makeCar('coupe', G.player.x - 60, G.player.y + 42, 0.5, { role: 'parked', color: '#17bebb' });
    mine.driver = null;
    G.cars.push(mine);
    const cop = makeCar('police', G.player.x + 150, G.player.y - 30, Math.PI + 0.3, { role: 'police', color: '#f2f2f2' });
    cop.driver = 'police';
    G.cars.push(cop);
    // An officer on foot, weapon up, between the cars.
    const officer = G.spawnPed(cop.x - 26, cop.y + 22, { officer: true });
    officer.shirt = '#20304a';
    officer.angle = Math.atan2(G.player.y - officer.y, G.player.x - officer.x);
    G.setHeat(20); // one star
    G.missions.index = 5;
    G.missions.phase = 'offer';
    G.missions.sideJob = { from: 'beach', to: 'garage', step: 1, timer: 61, objective: { x: places.garage.x, y: places.garage.y, text: 'FARE: drive to Marisol Crew Garage — 61s', label: 'FARE' } };
  }
  G.refreshObjective();
  G.frozen = true;
  // Settle a few frames so effects and camera land where the scene wants them.
  G.updateCamera(1);
}

function addTrafficNear(G, x, y) {
  const world = G.world;
  const defs = [
    ['sedan', world.roadsV[3] + 30, y - 260, Math.PI / 2, '#31556e'],
    ['taxi', world.roadsV[3] + 76, y + 330, Math.PI / 2, '#f7b731'],
    ['compact', world.roadsV[4] + 30, y - 60, -Math.PI / 2, '#57a773'],
    ['truck', world.roadsV[2] + 76, y + 120, Math.PI / 2, '#546e7a'],
  ];
  for (const [type, cx, cy, a, color] of defs) {
    const car = makeCar(type, cx, cy, a, { role: 'traffic', color });
    car.driver = 'ai';
    car.speed = 110;
    G.cars.push(car);
  }
}

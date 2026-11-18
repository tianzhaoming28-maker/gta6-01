// missions.js — the Marisol crew story: five jobs for Rico Vega, told with
// intro cards, objective banners, world markers and minimap blips, then free
// roam with repeatable courier fares. Each mission is data plus small hooks.

import { dist } from './rng.js';
import { makeCar, steerToward, driveCar } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'JOB 1 — FIRST WHEELS',
    intro: 'Marisol: "Rico, I need a clean coupe for tonight. Lift one off the street and bring it to my garage. No scratches you can\'t buff out."',
    reward: 350,
  },
  {
    id: 'hot-package',
    title: 'JOB 2 — HOT PACKAGE',
    intro: 'Marisol: "A package at the North Depot needs to reach the docks. Fast. The PPD have been watching the depot all morning — expect company."',
    reward: 600,
  },
  {
    id: 'rival-colours',
    title: 'JOB 3 — RIVAL COLOURS',
    intro: 'Marisol: "The Coral Kings ran our courier off the road. Their driver is cruising in a red muscle car. Catch him. Stop him. Any way you like."',
    reward: 850,
  },
  {
    id: 'hot-metal',
    title: 'JOB 4 — HOT METAL',
    intro: 'Marisol: "That van at the depot is loaded and very, very stolen. The whole force will light up. Get it to the docks and stay in one piece."',
    reward: 1200,
  },
  {
    id: 'last-score',
    title: 'JOB 5 — THE LAST SCORE',
    intro: 'Marisol: "One van. One bag of cash. Every badge in Palmira. Take the money, lose the heat, and bring it home to the hideout. Then we disappear."',
    reward: 2500,
  },
];

export function makeMissionState() {
  return {
    index: 0,          // next story mission to offer
    active: null,      // live mission runtime object
    phase: 'offer',    // offer | active | done
    marker: null,      // {x, y, label}
    timer: 0,
    sideJob: null,     // repeatable fare runtime
    rivalCar: null,
    jobCar: null,
  };
}

// Where the current objective marker sits; the HUD draws banner + blip from it.
export function currentObjective(G) {
  const M = G.missions;
  if (M.active) return M.active.objective;
  if (M.sideJob) return M.sideJob.objective;
  if (M.phase === 'offer' && M.index < MISSIONS.length) {
    const g = G.world.places.garage;
    return { x: g.x, y: g.y, text: 'Go to the Marisol Crew Garage', label: 'CREW' };
  }
  return null;
}

export function startStoryMission(G, index) {
  const def = MISSIONS[index];
  const M = G.missions;
  const places = G.world.places;
  const active = {
    def, index, step: 0, objective: null, t: 0, failed: 0,
  };
  M.active = active;
  M.phase = 'active';
  if (def.id === 'first-wheels') {
    active.objective = { x: places.garage.x, y: places.garage.y, text: 'Steal any car and drive it to the crew garage', label: 'GARAGE' };
  } else if (def.id === 'hot-package') {
    active.objective = { x: places.depot.x, y: places.depot.y, text: 'Pick up the package at the North Depot', label: 'PICKUP' };
    active.step = 0;
  } else if (def.id === 'rival-colours') {
    const rival = makeCar('muscle', G.world.places.depot.x - 60, G.world.places.depot.y + 160, 0, { role: 'rival', color: '#c0272d' });
    rival.driver = 'ai';
    rival.cruise = 215;
    G.cars.push(rival);
    M.rivalCar = rival;
    active.objective = { x: rival.x, y: rival.y, text: 'Chase down the Coral Kings driver — ram or shoot his car', label: 'RIVAL', follow: rival };
  } else if (def.id === 'hot-metal') {
    const van = makeCar('van', places.depot.x - 40, places.depot.y + 120, 0, { role: 'mission', color: '#985277' });
    van.driver = null;
    G.cars.push(van);
    M.jobCar = van;
    active.objective = { x: van.x, y: van.y, text: 'Take the loaded van at the North Depot', label: 'VAN', follow: van };
  } else if (def.id === 'last-score') {
    const van = makeCar('van', places.docks.x - 80, places.docks.y - 140, 0, { role: 'mission', color: '#37474f' });
    van.driver = null;
    G.cars.push(van);
    M.jobCar = van;
    active.objective = { x: van.x, y: van.y, text: 'Grab the loot van at the docks', label: 'LOOT', follow: van };
  }
  G.showCard(def.title, def.intro, 'Press ENTER to roll');
  G.audio.sting(true);
}

function completeMission(G) {
  const M = G.missions;
  const active = M.active;
  if (!active) return;
  G.addCash(active.def.reward, G.player.x, G.player.y - 30);
  G.audio.sting(true);
  G.showCard('JOB COMPLETE', active.def.title + ' — paid $' + active.def.reward + '.', M.index + 1 >= MISSIONS.length ? 'Press ENTER' : 'Press ENTER for the next job');
  M.index = active.index + 1;
  M.active = null;
  M.rivalCar = null;
  M.jobCar = null;
  M.phase = 'offer';
  if (M.index >= MISSIONS.length) {
    G.save.storyDone = true;
    G.storyJustDone = true;
  }
  G.save.mission = M.index;
  G.persist();
}

function failMission(G, why) {
  const M = G.missions;
  if (!M.active) return;
  G.showCard('JOB FAILED', why + ' Marisol: "Again. And cleaner this time."', 'Press ENTER to retry');
  G.audio.sting(false);
  // Clean up mission vehicles.
  if (M.rivalCar) { const i = G.cars.indexOf(M.rivalCar); if (i >= 0) G.cars.splice(i, 1); M.rivalCar = null; }
  if (M.jobCar) { const i = G.cars.indexOf(M.jobCar); if (i >= 0) G.cars.splice(i, 1); M.jobCar = null; }
  M.failedIndex = M.active.index;
  M.active = null;
  M.phase = 'failed';
}

export function retryFailed(G) {
  const M = G.missions;
  if (M.phase === 'failed' && M.failedIndex !== undefined) {
    M.phase = 'offer';
    startStoryMission(G, M.failedIndex);
  }
}

function atPlace(G, place, range = 64) {
  return dist(G.player.x, G.player.y, place.x, place.y) < range;
}

export function updateMissions(G, dt) {
  const M = G.missions;
  const places = G.world.places;
  const p = G.player;

  // Offer point: standing at the garage starts the next story job.
  if (M.phase === 'offer' && M.index < MISSIONS.length && G.state === 'playing') {
    if (atPlace(G, places.garage, 74)) startStoryMission(G, M.index);
  }
  if (M.phase === 'offer' && M.index >= MISSIONS.length) {
    updateSideJob(G, dt);
  }

  const a = M.active;
  if (!a) return;
  a.t += dt;
  const id = a.def.id;

  if (id === 'first-wheels') {
    if (p.car && atPlace(G, places.garage, 84)) completeMission(G);
  } else if (id === 'hot-package') {
    if (a.step === 0) {
      if (atPlace(G, places.depot, 70)) {
        a.step = 1;
        M.timer = 95;
        G.addHeat(46); // the depot was watched: instant two-star heat
        a.objective = { x: places.docks.x, y: places.docks.y, text: 'Deliver the package to the docks — 95 seconds!', label: 'DOCKS' };
        G.notify('PACKAGE PICKED UP — GO!', 2.4);
        G.audio.pickup();
      }
    } else {
      M.timer -= dt;
      a.objective.text = 'Deliver the package to the docks — ' + Math.max(0, Math.ceil(M.timer)) + 's';
      if (M.timer <= 0) failMission(G, 'Too slow — the buyer walked.');
      else if (atPlace(G, places.docks, 84)) completeMission(G);
    }
  } else if (id === 'rival-colours') {
    const rival = M.rivalCar;
    if (!rival) { completeMission(G); return; }
    a.objective.x = rival.x; a.objective.y = rival.y;
    driveRival(G, rival, dt);
    if (rival.wrecked || rival.health <= 12 || (Math.abs(rival.speed) < 6 && dist(p.x, p.y, rival.x, rival.y) < 60 && a.t > 4 && rival.stoppedT > 2.4)) {
      G.notify('RIVAL STOPPED', 2.4);
      completeMission(G);
    }
    if (dist(p.x, p.y, rival.x, rival.y) > 1500) failMission(G, 'He got away into the traffic.');
  } else if (id === 'hot-metal') {
    const van = M.jobCar;
    if (a.step === 0) {
      if (p.car === van) {
        a.step = 1;
        G.setStars(3);
        a.objective = { x: places.docks.x, y: places.docks.y, text: 'Drive the hot van to the docks — survive the heat!', label: 'DOCKS' };
        G.notify('THE VAN IS HOT — MOVE!', 2.4);
      }
    } else {
      if (!p.car) { /* on foot mid-job is allowed; marker stays on the docks */ }
      if (van.wrecked) failMission(G, 'The van burned. The load is gone.');
      else if (p.car === van && atPlace(G, places.docks, 90)) completeMission(G);
    }
  } else if (id === 'last-score') {
    const van = M.jobCar;
    if (a.step === 0) {
      a.objective.x = van.x; a.objective.y = van.y;
      if (p.car === van || atPlace(G, van, 60) && p.car) {
        a.step = 1;
        G.setStars(4);
        a.objective = { x: places.hideout.x, y: places.hideout.y, text: 'Lose the heat, then reach the Vega Hideout', label: 'HIDEOUT' };
        G.notify('CASH SECURED — LOSE THE HEAT!', 2.6);
        G.audio.cash();
      }
    } else {
      if (G.stars === 0 && atPlace(G, places.hideout, 90)) completeMission(G);
      else if (G.stars === 0) a.objective.text = 'Heat is gone — get to the Vega Hideout';
      else a.objective.text = 'Lose the heat (' + G.stars + ' stars), then reach the hideout';
      if (van.wrecked && p.car !== van) failMission(G, 'The loot van is wrecked.');
    }
  }
}

// The rival flees along the avenues, faster than traffic, slower than Rico.
function driveRival(G, rival, dt) {
  if (rival.wrecked) { rival.stoppedT = (rival.stoppedT || 0) + dt; return; }
  const p = G.player;
  const d = dist(rival.x, rival.y, p.x, p.y);
  if (Math.abs(rival.speed) < 6) rival.stoppedT = (rival.stoppedT || 0) + dt; else rival.stoppedT = 0;
  // Flee waypoint: a point ahead of the rival, away from the player.
  const away = Math.atan2(rival.y - p.y, rival.x - p.x);
  const snap = G.world;
  let tx = rival.x + Math.cos(rival.angle) * 260 + Math.cos(away) * 60;
  let ty = rival.y + Math.sin(rival.angle) * 260 + Math.sin(away) * 60;
  // Bias the flee point back onto the road grid.
  const node = nearestRoadPoint(snap, tx, ty);
  tx = node.x; ty = node.y;
  const ctrl = steerToward(rival, tx, ty, dt, { throttle: d < 500 ? 1 : 0.7 });
  driveCar(G, rival, ctrl, dt);
}

function nearestRoadPoint(world, x, y) {
  let bx = x, by = y, bd = Infinity;
  for (const rx of world.roadsV) {
    const cx = rx + 52;
    const d = Math.abs(cx - x);
    if (d < bd) { bd = d; bx = cx; by = y; }
  }
  let bd2 = Infinity, hy = y;
  for (const ry of world.roadsH) {
    const cy = ry + 52;
    const d = Math.abs(cy - y);
    if (d < bd2) { bd2 = d; hy = cy; }
  }
  if (bd2 < bd) return { x, y: hy };
  return { x: bx, y };
}

// --- Repeatable side work after the story ----------------------------------

const FARE_SPOTS = ['garage', 'docks', 'depot', 'clinic', 'hideout', 'beach'];

function updateSideJob(G, dt) {
  const M = G.missions;
  const places = G.world.places;
  if (!M.sideJob) {
    if (Math.random() < dt * 0.02 + 0.0001 && !M.sideOfferT) {
      // Offer a fare from a random place to another, for cash.
      const from = FARE_SPOTS[Math.floor(Math.random() * FARE_SPOTS.length)];
      let to = FARE_SPOTS[Math.floor(Math.random() * FARE_SPOTS.length)];
      if (to === from) to = 'docks';
      M.sideJob = {
        from, to, step: 0,
        objective: { x: places[from].x, y: places[from].y, text: 'FARE: pick up at ' + places[from].label, label: 'FARE' },
      };
      G.notify('New fare available — check the gold marker', 2.6);
    }
    return;
  }
  const job = M.sideJob;
  if (job.step === 0) {
    if (dist(G.player.x, G.player.y, places[job.from].x, places[job.from].y) < 70 && G.player.car) {
      job.step = 1;
      job.timer = 75;
      job.objective = { x: places[job.to].x, y: places[job.to].y, text: 'FARE: drive to ' + places[job.to].label, label: 'FARE' };
      G.audio.pickup();
      G.notify('Passenger in — the clock is running', 2.2);
    }
  } else {
    job.timer -= dt;
    job.objective.text = 'FARE: drive to ' + places[job.to].label + ' — ' + Math.max(0, Math.ceil(job.timer)) + 's';
    if (job.timer <= 0) {
      G.notify('Fare cancelled', 2);
      M.sideJob = null;
    } else if (dist(G.player.x, G.player.y, places[job.to].x, places[job.to].y) < 80 && G.player.car) {
      const pay = 90 + Math.floor(Math.random() * 130);
      G.addCash(pay, G.player.x, G.player.y - 26);
      G.audio.cash();
      G.save.fares = (G.save.fares || 0) + 1;
      G.persist();
      M.sideJob = null;
    }
  }
}

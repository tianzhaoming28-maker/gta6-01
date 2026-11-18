// world.js — Palmira's city generation and collision.
// Builds the road grid, blocks, buildings, beach and named places from a seed,
// and answers the spatial questions every other system asks: what is solid,
// where are the lanes, what is at this point.

import { PITCH, ROAD_W, BLOCK, COLS, ROWS, CITY_W, CITY_H, SAND_H, WATER_H, WORLD_W, WORLD_H, BUILDING_COLORS, ROOF_COLORS } from './config.js';
import { RNG, clamp } from './rng.js';

export { WORLD_W, WORLD_H, CITY_W, CITY_H };

const BLOCK_NAMES = [
  'Calle Sol', 'Marina Row', 'Calle Palma', 'Old Market', 'Calle Brisa',
  'Neon Mile', 'Calle Coral', 'Harbour View', 'Calle Luna', 'The Flats',
  'Calle Oro', 'Garden Quarter', 'Calle Mar', 'Uptown', 'Calle Faro',
  'Little Havana Row', 'Calle Vela', 'Sunset Strip', 'Calle Arena', 'Portside',
  'Calle Jade', 'Vista Heights', 'Calle Rio', 'Downtown', 'Calle Perla',
  'North Beach', 'Calle Tango', 'Mercado', 'Calle Azul', 'South End',
  'Calle Rey', 'Bayfront', 'Calle Nova', 'Elm Terrace', 'Calle Solano',
];

// Named story locations, fixed to blocks so missions and the minimap agree.
export function blockRect(col, row) {
  return { x: col * PITCH + ROAD_W, y: row * PITCH + ROAD_W, w: BLOCK, h: BLOCK };
}

export function buildWorld(seed = 1) {
  const rng = new RNG(seed * 7919 + 13);
  const world = {
    seed,
    W: WORLD_W, H: WORLD_H,
    roadsV: [], roadsH: [],
    buildings: [], blocks: [], palms: [], lights: [], benches: [],
    parkedSpots: [], colliders: [], props: [],
    beachY: CITY_H, waterY: CITY_H + SAND_H,
    places: {},
  };
  for (let i = 0; i <= COLS; i++) world.roadsV.push(i * PITCH);
  for (let i = 0; i <= ROWS; i++) world.roadsH.push(i * PITCH);

  // Special blocks first: crew garage, docks warehouse, hideout, clinic, depot.
  const special = new Map();
  const key = (c, r) => c + ',' + r;
  special.set(key(0, 0), 'hideout');
  special.set(key(3, 2), 'garage');
  special.set(key(6, 4), 'docks');
  special.set(key(1, 4), 'clinic');
  special.set(key(5, 0), 'depot');
  special.set(key(2, 1), 'park');
  special.set(key(4, 3), 'plaza');
  special.set(key(6, 1), 'market');

  let nameIdx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = blockRect(c, r);
      const kind = special.get(key(c, r)) || 'buildings';
      const block = { ...b, col: c, row: r, kind, name: BLOCK_NAMES[nameIdx++ % BLOCK_NAMES.length] };
      world.blocks.push(block);
      if (kind === 'buildings' || kind === 'market') buildBlockBuildings(world, rng, block, kind === 'market');
      else if (kind === 'garage') buildGarage(world, rng, block);
      else if (kind === 'docks') buildDocks(world, rng, block);
      else if (kind === 'hideout') buildHideout(world, rng, block);
      else if (kind === 'clinic') buildClinic(world, rng, block);
      else if (kind === 'depot') buildDepot(world, rng, block);
      else if (kind === 'park') buildPark(world, rng, block);
      else if (kind === 'plaza') buildPlaza(world, rng, block);
    }
  }

  // Palms and streetlights dress the sidewalks and the beach.
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const b = blockRect(c, r);
    const spots = [[b.x + 16, b.y + 16], [b.x + b.w - 16, b.y + 16], [b.x + 16, b.y + b.h - 16], [b.x + b.w - 16, b.y + b.h - 16]];
    for (const [x, y] of spots) {
      if (rng.chance(0.55)) world.palms.push({ x: x + rng.range(-5, 5), y: y + rng.range(-5, 5), s: rng.range(0.8, 1.25), lean: rng.range(-0.2, 0.2) });
      else world.lights.push({ x, y });
    }
  }
  for (let x = 60; x < WORLD_W - 40; x += rng.range(90, 170)) {
    world.palms.push({ x, y: CITY_H + rng.range(26, 70), s: rng.range(0.9, 1.4), lean: rng.range(-0.3, 0.3) });
    if (rng.chance(0.5)) world.props.push({ kind: 'umbrella', x: x + rng.range(20, 60), y: CITY_H + rng.range(90, 160), color: rng.pick(['#e4572e', '#17bebb', '#f2c230', '#ff5d8f']) });
  }
  // A pier reaching into the water near the docks.
  world.pier = { x: WORLD_W - 420, y: CITY_H + SAND_H - 6, w: 54, h: WATER_H - 90 };
  world.colliders.push({ ...world.pier, kind: 'pier' });

  // Named places the story uses.
  const g = blockRect(3, 2), d = blockRect(6, 4), h0 = blockRect(0, 0), cl = blockRect(1, 4), dp = blockRect(5, 0);
  world.places = {
    garage: { x: g.x + g.w / 2, y: g.y + g.h - 30, label: 'Marisol Crew Garage' },
    docks: { x: d.x + d.w / 2, y: d.y + d.h / 2, label: 'Palmira Docks' },
    hideout: { x: h0.x + h0.w / 2, y: h0.y + h0.h / 2, label: 'Vega Hideout' },
    clinic: { x: cl.x + cl.w / 2, y: cl.y + 40, label: 'Palmira Clinic' },
    depot: { x: dp.x + dp.w / 2, y: dp.y + dp.h / 2, label: 'North Depot' },
    beach: { x: WORLD_W / 2, y: CITY_H + 110, label: 'Playa Serena' },
  };
  return world;
}

function addBuilding(world, rng, x, y, w, h, opts = {}) {
  const b = {
    x, y, w, h,
    color: opts.color || rng.pick(BUILDING_COLORS),
    roof: opts.roof || rng.pick(ROOF_COLORS),
    floors: opts.floors || rng.int(2, 9),
    kind: opts.kind || 'block',
    sign: opts.sign || null,
  };
  world.buildings.push(b);
  world.colliders.push({ x, y, w, h, kind: 'building' });
  return b;
}

function buildBlockBuildings(world, rng, block, market) {
  const inset = 26;
  const inner = { x: block.x + inset, y: block.y + inset, w: block.w - inset * 2, h: block.h - inset * 2 };
  const layout = rng.int(0, 2);
  if (layout === 0) {
    // One tower with a forecourt.
    addBuilding(world, rng, inner.x + 30, inner.y + 24, inner.w - 110, inner.h - 70, { floors: rng.int(6, 12), sign: market ? 'MERCADO' : null });
    world.parkedSpots.push({ x: inner.x + inner.w - 34, y: inner.y + 60, angle: Math.PI / 2 });
    world.parkedSpots.push({ x: inner.x + inner.w - 34, y: inner.y + 130, angle: Math.PI / 2 });
  } else if (layout === 1) {
    // Four mid-rise corners.
    const qw = inner.w / 2 - 12, qh = inner.h / 2 - 12;
    addBuilding(world, rng, inner.x, inner.y, qw, qh, {});
    addBuilding(world, rng, inner.x + qw + 24, inner.y, qw, qh, {});
    addBuilding(world, rng, inner.x, inner.y + qh + 24, qw, qh, {});
    addBuilding(world, rng, inner.x + qw + 24, inner.y + qh + 24, qw, qh, { sign: market ? 'CAFE SOL' : null });
    world.parkedSpots.push({ x: inner.x + inner.w / 2, y: inner.y + inner.h - 8, angle: 0 });
  } else {
    // Two slabs and a parking strip.
    addBuilding(world, rng, inner.x, inner.y, inner.w - 90, 92, { floors: rng.int(3, 6) });
    addBuilding(world, rng, inner.x + 40, inner.y + inner.h - 96, inner.w - 130, 96, { floors: rng.int(3, 6), sign: market ? 'HOTEL BRISA' : null });
    world.parkedSpots.push({ x: inner.x + inner.w - 30, y: inner.y + 40, angle: Math.PI / 2 });
    world.parkedSpots.push({ x: inner.x + inner.w - 30, y: inner.y + inner.h - 40, angle: Math.PI / 2 });
    world.parkedSpots.push({ x: inner.x + 24, y: inner.y + inner.h / 2, angle: 0 });
  }
  // Curbside parking along the south edge of most blocks.
  if (rng.chance(0.8)) world.parkedSpots.push({ x: block.x + rng.range(70, block.w - 70), y: block.y + block.h + 13, angle: 0, curb: true });
  if (rng.chance(0.6)) world.parkedSpots.push({ x: block.x + block.w + 13, y: block.y + rng.range(70, block.h - 70), angle: Math.PI / 2, curb: true });
}

function buildGarage(world, rng, block) {
  addBuilding(world, rng, block.x + 40, block.y + 36, 180, 120, { color: '#8d8578', roof: '#5d5648', floors: 1, kind: 'garage', sign: 'MARISOL AUTOWORKS' });
  addBuilding(world, rng, block.x + 240, block.y + 36, 90, 120, { color: '#a26769', floors: 2 });
  world.props.push({ kind: 'crates', x: block.x + 250, y: block.y + 220 });
  world.props.push({ kind: 'crates', x: block.x + 286, y: block.y + 236 });
  world.parkedSpots.push({ x: block.x + 90, y: block.y + 230, angle: 0 });
  world.parkedSpots.push({ x: block.x + 160, y: block.y + 230, angle: 0 });
}

function buildDocks(world, rng, block) {
  addBuilding(world, rng, block.x + 30, block.y + 30, 250, 110, { color: '#7a8b99', roof: '#546e7a', floors: 1, kind: 'warehouse', sign: 'PALMIRA FREIGHT' });
  addBuilding(world, rng, block.x + 30, block.y + 190, 130, 90, { color: '#96705a', roof: '#6d4c41', floors: 1, kind: 'warehouse' });
  for (let i = 0; i < 5; i++) world.props.push({ kind: 'container', x: block.x + 190 + (i % 3) * 44, y: block.y + 200 + Math.floor(i / 3) * 40, color: rng.pick(['#e4572e', '#17bebb', '#3d7bd9', '#57a773']) });
  world.parkedSpots.push({ x: block.x + 90, y: block.y + 160, angle: 0 });
}

function buildHideout(world, rng, block) {
  addBuilding(world, rng, block.x + 90, block.y + 80, 140, 110, { color: '#f7d08a', roof: '#b5543f', floors: 2, kind: 'house', sign: 'VEGA' });
  world.props.push({ kind: 'crates', x: block.x + 60, y: block.y + 230 });
  world.parkedSpots.push({ x: block.x + 150, y: block.y + 250, angle: 0 });
}

function buildClinic(world, rng, block) {
  addBuilding(world, rng, block.x + 60, block.y + 50, 200, 110, { color: '#fdfdfd', roof: '#c0392b', floors: 3, kind: 'clinic', sign: 'CLINIC +' });
  world.parkedSpots.push({ x: block.x + 110, y: block.y + 220, angle: 0 });
  world.parkedSpots.push({ x: block.x + 180, y: block.y + 220, angle: 0 });
}

function buildDepot(world, rng, block) {
  addBuilding(world, rng, block.x + 40, block.y + 40, 240, 90, { color: '#6e7f80', roof: '#46585a', floors: 1, kind: 'warehouse', sign: 'NORTH DEPOT' });
  world.parkedSpots.push({ x: block.x + 80, y: block.y + 200, angle: 0 });
  world.parkedSpots.push({ x: block.x + 150, y: block.y + 200, angle: 0 });
  world.parkedSpots.push({ x: block.x + 220, y: block.y + 200, angle: 0 });
}

function buildPark(world, rng, block) {
  for (let i = 0; i < 9; i++) {
    world.palms.push({ x: block.x + rng.range(40, block.w - 40), y: block.y + rng.range(40, block.h - 40), s: rng.range(0.9, 1.5), lean: rng.range(-0.25, 0.25) });
  }
  world.benches.push({ x: block.x + block.w / 2, y: block.y + block.h / 2 });
  world.props.push({ kind: 'fountain', x: block.x + block.w / 2, y: block.y + block.h / 2 });
  world.colliders.push({ x: block.x + block.w / 2 - 22, y: block.y + block.h / 2 - 22, w: 44, h: 44, kind: 'fountain' });
}

function buildPlaza(world, rng, block) {
  world.props.push({ kind: 'fountain', x: block.x + block.w / 2, y: block.y + 110 });
  world.colliders.push({ x: block.x + block.w / 2 - 22, y: block.y + 88, w: 44, h: 44, kind: 'fountain' });
  for (let i = 0; i < 4; i++) world.props.push({ kind: 'stall', x: block.x + 50 + i * 70, y: block.y + block.h - 70, color: rng.pick(['#e4572e', '#f2c230', '#17bebb', '#ff5d8f']) });
  world.parkedSpots.push({ x: block.x + 80, y: block.y + 40, angle: 0 });
}

// --- Spatial queries -------------------------------------------------------

export function isOnRoad(world, x, y) {
  if (y >= CITY_H) return false;
  const mx = ((x % PITCH) + PITCH) % PITCH;
  const my = ((y % PITCH) + PITCH) % PITCH;
  return mx < ROAD_W || my < ROAD_W;
}

export function isWater(world, x, y) {
  if (y < world.waterY) return false;
  const p = world.pier;
  if (p && x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return false;
  return true;
}

export function isSand(world, x, y) { return y >= world.beachY && y < world.waterY; }

export function rectAt(world, x, y) {
  for (const c of world.colliders) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}

// Push a circle out of every solid rect and the water; returns impact speed
// (how hard the circle was moving into the surface) for damage and effects.
export function collideCircle(world, pos, radius, vel) {
  let impact = 0;
  pos.x = clamp(pos.x, radius, world.W - radius);
  pos.y = clamp(pos.y, radius, world.H - radius);
  for (const c of world.colliders) {
    const nx = clamp(pos.x, c.x, c.x + c.w);
    const ny = clamp(pos.y, c.y, c.y + c.h);
    const dx = pos.x - nx, dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      let pushX, pushY;
      if (d2 > 0.0001) { pushX = dx / d; pushY = dy / d; }
      else {
        // Centre inside the rect: leave by the shallowest face.
        const left = pos.x - c.x, right = c.x + c.w - pos.x, top = pos.y - c.y, bot = c.y + c.h - pos.y;
        const m = Math.min(left, right, top, bot);
        pushX = m === left ? -1 : (m === right ? 1 : 0);
        pushY = m === top ? -1 : (m === bot ? 1 : 0);
      }
      const pen = radius - d + (d2 <= 0.0001 ? radius : 0);
      pos.x += pushX * pen; pos.y += pushY * pen;
      const into = -(vel.x * pushX + vel.y * pushY);
      if (into > 0) {
        impact = Math.max(impact, into);
        vel.x += pushX * into; vel.y += pushY * into;
      }
    }
  }
  if (isWater(world, pos.x, pos.y + radius * 0.4)) {
    const into = Math.max(0, vel.y);
    impact = Math.max(impact, into * 0.6);
    pos.y = world.waterY - radius * 0.4 - 1;
    if (vel.y > 0) vel.y = 0;
  }
  return impact;
}

// Lane centre for travel along a road: axis 'v' roads run north-south.
export function laneCenter(world, axis, roadIndex, dirSign) {
  // dirSign +1 travels east/south on the right-hand side of the road.
  if (axis === 'v') {
    const rx = world.roadsV[roadIndex];
    return rx + (dirSign > 0 ? ROAD_W * 0.72 : ROAD_W * 0.28);
  }
  const ry = world.roadsH[roadIndex];
  return ry + (dirSign > 0 ? ROAD_W * 0.72 : ROAD_W * 0.28);
}

// Nearest intersection node (road centre crossing) to a point.
export function nearestNode(world, x, y) {
  let best = null, bd = Infinity;
  for (let i = 0; i < world.roadsV.length; i++) for (let j = 0; j < world.roadsH.length; j++) {
    const nx = world.roadsV[i] + ROAD_W / 2, ny = world.roadsH[j] + ROAD_W / 2;
    const d = (nx - x) * (nx - x) + (ny - y) * (ny - y);
    if (d < bd) { bd = d; best = { i, j, x: nx, y: ny }; }
  }
  return best;
}

// render.js — everything the camera sees: Palmira at golden hour (or dusk),
// drawn flat-shaded with long shadows: water, sand, roads with lanes and
// crosswalks, pastel blocks, palms, cars with headlights, people, effects.

import { PAL, ROAD_W, PITCH, CITY_H } from './config.js';
import { clamp } from './rng.js';

export function drawWorld(ctx, G) {
  const world = G.world;
  const cam = G.camera;
  const vx = cam.x - 40, vy = cam.y - 40, vw = G.viewW + 80, vh = G.viewH + 80;

  drawGround(ctx, G, vx, vy, vw, vh);
  drawRoads(ctx, G, vx, vy, vw, vh);
  drawBlocks(ctx, G, vx, vy, vw, vh);
  drawBeachProps(ctx, G);

  // Skid marks under everything that moves.
  ctx.fillStyle = 'rgba(25,22,30,0.5)';
  for (const s of G.skids) {
    if (s.x < vx || s.x > vx + vw || s.y < vy || s.y > vy + vh) continue;
    ctx.globalAlpha = clamp(s.life / 14, 0, 0.55);
    ctx.fillRect(s.x - 2.5, s.y - 2.5, 5, 5);
  }
  ctx.globalAlpha = 1;

  drawProps(ctx, G, vx, vy, vw, vh);
  drawMarker(ctx, G);

  // Cars sorted by y so lower ones overlap correctly.
  const sorted = G.cars.slice().sort((a, b) => a.y - b.y);
  for (const car of sorted) {
    if (car.x < vx - 80 || car.x > vx + vw || car.y < vy - 80 || car.y > vy + vh) continue;
    drawCar(ctx, G, car);
  }
  for (const ped of G.peds) {
    if (ped.x < vx - 30 || ped.x > vx + vw || ped.y < vy - 30 || ped.y > vy + vh) continue;
    drawPed(ctx, G, ped);
  }
  if (!G.player.car && G.state !== 'title') drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  drawPopups(ctx, G);

  if (G.dusk) drawDusk(ctx, G, sorted);
}

function drawGround(ctx, G, vx, vy, vw, vh) {
  const world = G.world;
  // Base: warm ground under the whole city.
  ctx.fillStyle = '#9db06a';
  ctx.fillRect(vx, vy, vw, vh);
  // Sand and sea to the south.
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(vx, Math.max(vy, world.beachY), vw, Math.min(vy + vh, world.waterY) - Math.max(vy, world.beachY));
  ctx.fillStyle = PAL.sandWet;
  ctx.fillRect(vx, world.waterY - 12, vw, 12);
  if (vy + vh > world.waterY) {
    const grad = ctx.createLinearGradient(0, world.waterY, 0, world.waterY + 330);
    grad.addColorStop(0, PAL.water);
    grad.addColorStop(1, PAL.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(vx, Math.max(vy, world.waterY), vw, vy + vh - Math.max(vy, world.waterY));
    // Foam lines drifting with time.
    ctx.strokeStyle = 'rgba(234,247,242,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const fy = world.waterY + 8 + i * 26 + Math.sin(G.time * 0.7 + i * 2) * 4;
      ctx.beginPath();
      for (let x = Math.floor(vx / 90) * 90; x < vx + vw; x += 90) {
        const yy = fy + Math.sin((x + G.time * 30) * 0.02 + i) * 3;
        if (x === Math.floor(vx / 90) * 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
  // The pier.
  const p = world.pier;
  ctx.fillStyle = 'rgba(46,26,54,0.25)';
  ctx.fillRect(p.x + 10, p.y + 14, p.w, p.h);
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = '#75582f';
  for (let y = p.y + 8; y < p.y + p.h; y += 22) ctx.fillRect(p.x, y, p.w, 3);
}

function drawRoads(ctx, G, vx, vy, vw, vh) {
  const world = G.world;
  ctx.fillStyle = PAL.asphalt;
  for (const rx of world.roadsV) {
    if (rx + ROAD_W < vx || rx > vx + vw) continue;
    ctx.fillRect(rx, Math.max(vy, 0), ROAD_W, Math.min(vy + vh, CITY_H));
  }
  for (const ry of world.roadsH) {
    if (ry + ROAD_W < vy || ry > vy + vh) continue;
    ctx.fillRect(Math.max(vx, 0), ry, Math.min(vx + vw, world.W), ROAD_W);
  }
  // Road edges.
  ctx.fillStyle = PAL.asphaltEdge;
  for (const rx of world.roadsV) {
    if (rx + ROAD_W < vx || rx > vx + vw) continue;
    ctx.fillRect(rx, Math.max(vy, 0), 4, Math.min(vy + vh, CITY_H));
    ctx.fillRect(rx + ROAD_W - 4, Math.max(vy, 0), 4, Math.min(vy + vh, CITY_H));
  }
  // Dashed centre lines.
  ctx.fillStyle = PAL.laneMark;
  for (const rx of world.roadsV) {
    if (rx + ROAD_W < vx || rx > vx + vw) continue;
    for (let y = Math.floor(vy / 46) * 46; y < Math.min(vy + vh, CITY_H); y += 46) {
      if (nearIntersection(world, rx + ROAD_W / 2, y)) continue;
      ctx.fillRect(rx + ROAD_W / 2 - 2, y, 4, 26);
    }
  }
  for (const ry of world.roadsH) {
    if (ry + ROAD_W < vy || ry > vy + vh) continue;
    for (let x = Math.floor(vx / 46) * 46; x < Math.min(vx + vw, world.W); x += 46) {
      if (nearIntersection(world, x, ry + ROAD_W / 2)) continue;
      ctx.fillRect(x, ry + ROAD_W / 2 - 2, 26, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(245,245,240,0.75)';
  for (const rx of world.roadsV) for (const ry of world.roadsH) {
    if (rx + ROAD_W < vx || rx > vx + vw || ry + ROAD_W < vy || ry > vy + vh) continue;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(rx + 8 + i * 24, ry + 4, 13, 7);
      ctx.fillRect(rx + 8 + i * 24, ry + ROAD_W - 11, 13, 7);
      ctx.fillRect(rx + 4, ry + 8 + i * 24, 7, 13);
      ctx.fillRect(rx + ROAD_W - 11, ry + 8 + i * 24, 7, 13);
    }
  }
}

function nearIntersection(world, x, y) {
  const mx = ((x % PITCH) + PITCH) % PITCH;
  const my = ((y % PITCH) + PITCH) % PITCH;
  return mx < ROAD_W + 8 && my < ROAD_W + 8;
}

function drawBlocks(ctx, G, vx, vy, vw, vh) {
  const world = G.world;
  for (const b of world.blocks) {
    if (b.x + b.w < vx || b.x > vx + vw || b.y + b.h < vy || b.y > vy + vh) continue;
    // Sidewalk slab first.
    ctx.fillStyle = PAL.sidewalkEdge;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.kind === 'park' ? PAL.grass : (b.kind === 'plaza' ? PAL.plaza : PAL.sidewalk);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.kind === 'park') {
      ctx.strokeStyle = PAL.parkPath;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(b.x + 10, b.y + b.h / 2); ctx.lineTo(b.x + b.w - 10, b.y + b.h / 2);
      ctx.moveTo(b.x + b.w / 2, b.y + 10); ctx.lineTo(b.x + b.w / 2, b.y + b.h - 10);
      ctx.stroke();
    }
    if (b.kind === 'garage' || b.kind === 'docks' || b.kind === 'depot') {
      ctx.fillStyle = 'rgba(70,64,74,0.35)';
      ctx.fillRect(b.x + 16, b.y + 150, b.w - 32, b.h - 170); // yard tarmac
    }
    // Block name painted small on the pavement — Palmira's street identity.
    ctx.fillStyle = 'rgba(90,70,50,0.5)';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(b.name.toUpperCase(), b.x + 10, b.y + b.h - 8);
  }
  // Buildings: long shadow, walls, roof detail, lit windows.
  for (const b of world.buildings) {
    if (b.x + b.w < vx - 40 || b.x > vx + vw || b.y + b.h < vy - 40 || b.y > vy + vh) continue;
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(b.x + 16, b.y + 22, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 6);
    // Window grid — some lit at dusk.
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const wx = b.x + 12 + i * ((b.w - 24) / Math.max(1, cols - 1)) - 4;
      const wy = b.y + 12 + j * ((b.h - 24) / Math.max(1, rows - 1)) - 4;
      const lit = ((i * 7 + j * 13 + b.x) % 5 === 0);
      ctx.fillStyle = G.dusk && lit ? '#ffd76a' : 'rgba(38,50,66,0.55)';
      ctx.fillRect(wx, wy, 8, 8);
    }
    if (b.sign) {
      ctx.fillStyle = 'rgba(30,26,36,0.85)';
      const tw = ctx.measureText(b.sign).width + 16;
      ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + b.h - 24, tw, 16);
      ctx.fillStyle = '#ffd76a';
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h - 12);
      ctx.textAlign = 'left';
    }
    if (b.kind === 'garage') {
      ctx.fillStyle = '#3c3844';
      ctx.fillRect(b.x + 30, b.y + b.h - 34, 120, 30);
      ctx.fillStyle = '#ffd76a';
      for (let i = 0; i < 5; i++) ctx.fillRect(b.x + 38 + i * 23, b.y + b.h - 28, 14, 18);
    }
  }
}

function drawBeachProps(ctx, G) {
  for (const prop of G.world.props) {
    if (prop.kind === 'umbrella') {
      ctx.fillStyle = 'rgba(46,26,54,0.2)';
      ctx.beginPath(); ctx.ellipse(prop.x + 5, prop.y + 6, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = prop.color;
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 14, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#7a5a34';
      ctx.beginPath(); ctx.moveTo(prop.x, prop.y); ctx.lineTo(prop.x, prop.y + 10); ctx.stroke();
    }
  }
}

function drawProps(ctx, G, vx, vy, vw, vh) {
  const world = G.world;
  for (const prop of world.props) {
    if (prop.x < vx - 40 || prop.x > vx + vw || prop.y < vy - 40 || prop.y > vy + vh) continue;
    if (prop.kind === 'crates') {
      ctx.fillStyle = '#9a7448';
      ctx.fillRect(prop.x, prop.y, 22, 22);
      ctx.fillStyle = '#7d5c36';
      ctx.fillRect(prop.x + 6, prop.y - 14, 20, 20);
      ctx.strokeStyle = 'rgba(60,40,20,0.6)';
      ctx.strokeRect(prop.x + 0.5, prop.y + 0.5, 22, 22);
    } else if (prop.kind === 'container') {
      ctx.fillStyle = PAL.shadow;
      ctx.fillRect(prop.x + 8, prop.y + 10, 40, 24);
      ctx.fillStyle = prop.color;
      ctx.fillRect(prop.x, prop.y, 40, 24);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let i = 0; i < 4; i++) ctx.fillRect(prop.x + 4 + i * 10, prop.y + 3, 3, 18);
    } else if (prop.kind === 'fountain') {
      ctx.fillStyle = '#7fb5d5';
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 21, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8d4ea';
      ctx.beginPath(); ctx.arc(prop.x, prop.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(prop.x + Math.sin(G.time * 3) * 3, prop.y - 3, 3.4, 0, Math.PI * 2); ctx.fill();
    } else if (prop.kind === 'stall') {
      ctx.fillStyle = prop.color;
      ctx.fillRect(prop.x, prop.y, 44, 8);
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(prop.x + 4, prop.y + 8, 36, 18);
    }
  }
  // Palms: trunk with lean, fronds as arcs.
  for (const palm of world.palms) {
    if (palm.x < vx - 40 || palm.x > vx + vw || palm.y < vy - 40 || palm.y > vy + vh) continue;
    const s = palm.s;
    ctx.fillStyle = 'rgba(46,26,54,0.28)';
    ctx.beginPath(); ctx.ellipse(palm.x + 12 * s, palm.y + 14 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + palm.lean * 20, palm.y - 12 * s, palm.x + palm.lean * 34, palm.y - 20 * s);
    ctx.stroke();
    const tx = palm.x + palm.lean * 34, ty = palm.y - 20 * s;
    ctx.strokeStyle = '#4d8f3f';
    ctx.lineWidth = 3 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + palm.lean;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * 13 * s, ty + Math.sin(a) * 8 * s - 4, tx + Math.cos(a) * 22 * s, ty + Math.sin(a) * 13 * s + 4);
      ctx.stroke();
    }
  }
  // Streetlights: pole + warm lamp (glows at dusk in the overlay pass).
  for (const l of world.lights) {
    if (l.x < vx - 20 || l.x > vx + vw || l.y < vy - 20 || l.y > vy + vh) continue;
    ctx.fillStyle = '#3c4048';
    ctx.fillRect(l.x - 1.5, l.y - 8, 3, 12);
    ctx.fillStyle = G.dusk ? '#ffe9a3' : '#e8e2cc';
    ctx.beginPath(); ctx.arc(l.x, l.y - 10, 3.4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMarker(ctx, G) {
  const obj = G.objective;
  if (!obj || G.state !== 'playing') return;
  const bob = Math.sin(G.time * 3.2) * 5;
  const x = obj.x, y = obj.y - 46 + bob;
  // Pillar of light so the goal reads across the city.
  const grad = ctx.createLinearGradient(0, obj.y - 130, 0, obj.y);
  grad.addColorStop(0, 'rgba(255,199,44,0)');
  grad.addColorStop(1, 'rgba(255,199,44,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 9, obj.y - 130, 18, 130);
  ctx.fillStyle = 'rgba(255,199,44,0.3)';
  ctx.beginPath(); ctx.ellipse(obj.x, obj.y, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffc72c';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(obj.x, obj.y, 30 + Math.sin(G.time * 3.2) * 4, 12, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffc72c';
  ctx.beginPath();
  ctx.moveTo(x, y + 20); ctx.lineTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#221c10';
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label || 'GO', x, y + 9);
  ctx.textAlign = 'left';
}

export function drawCar(ctx, G, car) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Long golden-hour shadow.
  ctx.fillStyle = PAL.shadow;
  ctx.save();
  ctx.rotate(car.angle);
  roundRect(ctx, -spec.w / 2 + 7, -spec.h / 2 + 10, spec.w, spec.h, 5);
  ctx.fill();
  ctx.restore();

  if (car.role === 'police' && (car.driver === 'police' || car.roadblock)) {
    // Flashing light bar glow.
    const phase = Math.floor(G.time * 6 + car.lightPhase) % 2;
    ctx.fillStyle = phase ? 'rgba(255,60,60,0.4)' : 'rgba(60,120,255,0.4)';
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  }
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#17181c';
  const ww = spec.w * 0.24, wh = 4.6;
  for (const [wx, wy] of [[-spec.w * 0.3, -spec.h / 2 - 1], [spec.w * 0.3, -spec.h / 2 - 1], [-spec.w * 0.3, spec.h / 2 - 3.6], [spec.w * 0.3, spec.h / 2 - 3.6]]) {
    ctx.fillRect(wx - ww / 2, wy, ww, wh);
  }
  // Body.
  ctx.fillStyle = car.wrecked ? shade(car.color, 0.55) : car.color;
  roundRect(ctx, -spec.w / 2, -spec.h / 2, spec.w, spec.h, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, -spec.w / 2, -spec.h / 2, spec.w, spec.h * 0.4, 5);
  ctx.fill();
  if (car.role === 'police') {
    ctx.fillStyle = '#20242b';
    ctx.fillRect(-spec.w * 0.28, -spec.h / 2, spec.w * 0.2, spec.h);
    ctx.fillRect(spec.w * 0.16, -spec.h / 2, spec.w * 0.14, spec.h);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '800 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PPD', 0, 2.5);
    ctx.textAlign = 'left';
    const phase = Math.floor(G.time * 6 + car.lightPhase) % 2;
    ctx.fillStyle = phase ? '#ff4040' : '#ffe9a3';
    ctx.fillRect(-7, -spec.h / 2 + 2, 6, 4);
    ctx.fillStyle = phase ? '#ffe9a3' : '#4080ff';
    ctx.fillRect(1, -spec.h / 2 + 2, 6, 4);
    ctx.fillStyle = phase ? '#ff4040' : '#4080ff';
    ctx.fillRect(-7, spec.h / 2 - 6, 6, 4);
    ctx.fillStyle = phase ? '#4080ff' : '#ff4040';
    ctx.fillRect(1, spec.h / 2 - 6, 6, 4);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242b';
    ctx.fillRect(-4, -4, 9, 8);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '800 6px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0.5, 2);
    ctx.textAlign = 'left';
  }
  if (car.type === 'van') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-spec.w * 0.42, -spec.h * 0.32, spec.w * 0.5, spec.h * 0.64);
  }
  // Cabin glass.
  ctx.fillStyle = 'rgba(24,34,48,0.9)';
  roundRect(ctx, -spec.w * 0.16, -spec.h * 0.36, spec.w * 0.34, spec.h * 0.72, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,235,0.5)';
  ctx.fillRect(spec.w * 0.08, -spec.h * 0.32, 3.4, spec.h * 0.64);
  // Headlights and tail lights.
  ctx.fillStyle = (G.dusk || car.role === 'police') ? '#fff3b0' : '#e8e2cc';
  ctx.fillRect(spec.w / 2 - 2.4, -spec.h * 0.32, 2.6, 4.4);
  ctx.fillRect(spec.w / 2 - 2.4, spec.h * 0.32 - 4.4, 2.6, 4.4);
  ctx.fillStyle = '#c0272d';
  ctx.fillRect(-spec.w / 2, -spec.h * 0.32, 2.2, 4.4);
  ctx.fillRect(-spec.w / 2, spec.h * 0.32 - 4.4, 2.2, 4.4);
  // Damage: crumple shading.
  if (car.health < 60) {
    ctx.fillStyle = 'rgba(30,28,34,0.35)';
    ctx.beginPath(); ctx.arc(spec.w * 0.3, spec.h * 0.2, 6 + (60 - car.health) * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  if (car === G.player.car) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.6;
    roundRect(ctx, -spec.w / 2 - 2.5, -spec.h / 2 - 2.5, spec.w + 5, spec.h + 5, 6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPed(ctx, G, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(46,26,54,0.3)';
  ctx.beginPath(); ctx.ellipse(4, 6, 8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'down') {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -8, -4.6, 16, 9.2, 4);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(10.5, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const swing = Math.sin(ped.walkPhase) * 3.4;
  const moving = Math.hypot(ped.vx, ped.vy) > 4;
  ctx.rotate(ped.angle);
  // Legs.
  ctx.strokeStyle = ped.isOfficer ? '#1b2432' : ped.pants;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-2, 0); ctx.lineTo(-4 + (moving ? swing : 0), -4.6);
  ctx.moveTo(-2, 0); ctx.lineTo(-4 - (moving ? swing : 0), 4.6);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = ped.isOfficer ? '#20304a' : ped.shirt;
  roundRect(ctx, -6.4, -5.4, 12.4, 10.8, 4);
  ctx.fill();
  if (ped.isOfficer) {
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(0, -3.4, 2.6, 2.6); // badge
    ctx.fillStyle = '#16222e';
    roundRect(ctx, 4, -5.6, 6.4, 11.2, 2.6);
    ctx.fill(); // cap brim reads as hat from above
  }
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(3.4, 0, 4.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,26,18,0.85)';
  ctx.beginPath(); ctx.arc(2.2, 0, 3.2, Math.PI * 0.6, Math.PI * 1.7); ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(46,26,54,0.34)';
  ctx.beginPath(); ctx.ellipse(4, 6, 8.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  const swing = p.moving ? Math.sin(p.walkPhase) * 3.8 : 0;
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(-2, 0); ctx.lineTo(-4.4 + swing, -5);
  ctx.moveTo(-2, 0); ctx.lineTo(-4.4 - swing, 5);
  ctx.stroke();
  // Rico's coral jacket — he reads at a glance.
  ctx.fillStyle = p.hurtT > 0 ? '#ff6b5e' : '#e4572e';
  roundRect(ctx, -7, -6, 13.6, 12, 4.4);
  ctx.fill();
  ctx.fillStyle = '#fdf0d5';
  ctx.fillRect(-1, -6, 3, 12);
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(3.6, 0, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242b';
  ctx.beginPath(); ctx.arc(2.2, 0, 3.4, Math.PI * 0.55, Math.PI * 1.75); ctx.fill();
  if (p.hasPistol) {
    ctx.fillStyle = '#17181c';
    ctx.fillRect(8, -1.6, 9, 3.2);
  } else if (p.meleeT > 0.12) {
    ctx.strokeStyle = '#f2c79b';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(6, 3); ctx.lineTo(13, 8); ctx.stroke();
  }
  ctx.restore();
  // Bust ring: shows how close the pin is.
  if (p.bustMeter > 0.03 && G.stars > 0) {
    ctx.strokeStyle = 'rgba(64,128,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, -Math.PI / 2, -Math.PI / 2 + p.bustMeter * Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets(ctx, G) {
  ctx.fillStyle = '#ffe9a3';
  for (const b of G.bullets) {
    ctx.fillRect(b.x - 3, b.y - 1.2, 6, 2.4);
    ctx.fillStyle = 'rgba(255,233,163,0.35)';
    ctx.fillRect(b.x - 9, b.y - 0.8, 6, 1.6);
    ctx.fillStyle = '#ffe9a3';
  }
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.globalAlpha = pt.kind === 'smoke' ? a * 0.8 : a;
    ctx.fillStyle = pt.color;
    if (pt.kind === 'smoke') {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, G) {
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const pop of G.popups) {
    const a = clamp(pop.life / pop.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = pop.color;
    ctx.strokeStyle = 'rgba(20,16,10,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillText(pop.text, pop.x, pop.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawDusk(ctx, G, sortedCars) {
  const cam = G.camera;
  // Blue-hour wash over the world, then light pools punched back in.
  ctx.fillStyle = 'rgba(24,26,66,0.34)';
  ctx.fillRect(cam.x - 40, cam.y - 40, G.viewW + 80, G.viewH + 80);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of G.world.lights) {
    if (l.x < cam.x - 90 || l.x > cam.x + G.viewW + 90 || l.y < cam.y - 90 || l.y > cam.y + G.viewH + 90) continue;
    const g = ctx.createRadialGradient(l.x, l.y - 8, 2, l.x, l.y - 8, 46);
    g.addColorStop(0, 'rgba(255,214,110,0.34)');
    g.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(l.x, l.y - 8, 46, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of sortedCars) {
    // Headlight cones.
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const hx = car.x + fx * car.spec.w * 0.5, hy = car.y + fy * car.spec.w * 0.5;
    const g = ctx.createRadialGradient(hx, hy, 4, hx + fx * 60, hy + fy * 60, 95);
    g.addColorStop(0, 'rgba(255,243,176,0.3)');
    g.addColorStop(1, 'rgba(255,243,176,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + fx * 120 - fy * 34, hy + fy * 120 + fx * 34);
    ctx.lineTo(hx + fx * 120 + fy * 34, hy + fy * 120 - fx * 34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * f), g = Math.floor(((n >> 8) & 255) * f), b = Math.floor((n & 255) * f);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

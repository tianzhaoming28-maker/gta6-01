// hud.js — the screen layer: cash, health, wanted stars, weapon and speed,
// the mission objective banner, notification toasts, the live minimap, and
// every full-screen state (title, pause, cards, BUSTED, WASTED, story end).

import { GAME_NAME, GAME_TAGLINE } from './config.js';
import { clamp } from './rng.js';
import { roundRect } from './render.js';
import { playerSpeedKmh } from './player.js';
import { wantedStars } from './police.js';

export function drawHUD(ctx, G) {
  if (G.state === 'title') return;
  const W = G.viewW, H = G.viewH;

  // Objective banner across the top centre.
  if (G.objective && G.state === 'playing') {
    const text = G.objective.text;
    ctx.font = '700 16px system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 64;
    ctx.fillStyle = 'rgba(18,16,26,0.78)';
    roundRect(ctx, W / 2 - tw / 2, 14, tw, 38, 9);
    ctx.fill();
    ctx.fillStyle = '#ffc72c';
    ctx.beginPath();
    ctx.moveTo(W / 2 - tw / 2 + 22, 42); ctx.lineTo(W / 2 - tw / 2 + 14, 26); ctx.lineTo(W / 2 - tw / 2 + 30, 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff7e0';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2 + 10, 39);
    ctx.textAlign = 'left';
    if (G.missions.timer > 0 && G.missions.active) {
      const frac = clamp(G.missions.timer / 95, 0, 1);
      ctx.fillStyle = frac < 0.25 ? '#ff5040' : '#ffc72c';
      ctx.fillRect(W / 2 - tw / 2 + 12, 47, (tw - 24) * frac, 3.4);
    }
  }

  // Cash + health, top left.
  panel(ctx, 14, 14, 208, 64);
  ctx.fillStyle = '#7be495';
  ctx.font = '800 21px system-ui, sans-serif';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 28, 42);
  ctx.fillStyle = 'rgba(10,10,14,0.6)';
  roundRect(ctx, 28, 52, 178, 13, 6);
  ctx.fill();
  const hp = clamp(G.player.health / 100, 0, 1);
  ctx.fillStyle = hp > 0.3 ? '#e4572e' : '#ff2e2e';
  if (hp > 0) { roundRect(ctx, 28, 52, 178 * hp, 13, 6); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.fillText('HEALTH', 150, 42);

  // Wanted stars, top right.
  const stars = wantedStars(G);
  panel(ctx, W - 196, 14, 182, 46);
  for (let i = 0; i < 5; i++) {
    const x = W - 178 + i * 34, y = 37;
    drawStar(ctx, x, y, 12, i < stars ? '#ffc72c' : 'rgba(255,255,255,0.22)', i < stars && Math.floor(G.time * 3) % 2 === 0);
  }
  if (stars > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(G.policeSeen ? 'PPD IN PURSUIT' : 'LAY LOW TO COOL OFF', W - 26, 24);
    ctx.textAlign = 'left';
  }

  // Weapon + ammo, bottom right above the speedo.
  if (G.player.hasPistol) {
    panel(ctx, W - 150, H - 118, 136, 40);
    ctx.fillStyle = '#e8e8ee';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText('PISTOL', W - 136, H - 92);
    ctx.fillStyle = G.player.ammo > 0 ? '#ffd76a' : '#ff5040';
    ctx.textAlign = 'right';
    ctx.fillText(String(G.player.ammo), W - 28, H - 92);
    ctx.textAlign = 'left';
  } else {
    panel(ctx, W - 150, H - 118, 136, 40);
    ctx.fillStyle = 'rgba(232,232,238,0.75)';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText('FISTS', W - 136, H - 92);
  }

  // Speedometer while driving.
  if (G.player.car) {
    panel(ctx, W - 150, H - 70, 136, 56);
    ctx.fillStyle = '#fff7e0';
    ctx.font = '800 27px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(playerSpeedKmh(G))), W - 62, H - 33);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('KM/H', W - 26, H - 33);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillText(G.player.car.spec.name.toUpperCase(), W - 136, H - 52);
    const dmg = clamp(G.player.car.health / 100, 0, 1);
    ctx.fillStyle = 'rgba(10,10,14,0.6)';
    ctx.fillRect(W - 136, H - 26, 108, 5);
    ctx.fillStyle = dmg > 0.35 ? '#7be495' : '#ff5040';
    ctx.fillRect(W - 136, H - 26, 108 * dmg, 5);
  }

  drawMinimap(ctx, G);
  drawToasts(ctx, G);
  drawContextHint(ctx, G);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(18,16,26,0.72)';
  roundRect(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 9);
  ctx.stroke();
}

function drawStar(ctx, x, y, r, color, pulse) {
  ctx.save();
  ctx.translate(x, y);
  if (pulse) ctx.scale(1.14, 1.14);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Live minimap: roads, water, the gold objective, red police, Rico's arrow.
export function drawMinimap(ctx, G) {
  const world = G.world;
  const mw = 196, mh = 150;
  const x0 = 14, y0 = G.viewH - mh - 14;
  const sx = mw / world.W, sy = mh / world.H;
  ctx.save();
  panel(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.beginPath();
  roundRect(ctx, x0, y0, mw, mh, 6);
  ctx.clip();
  ctx.fillStyle = '#8fa860';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#ecd28f';
  ctx.fillRect(x0, y0 + world.beachY * sy, mw, (world.waterY - world.beachY) * sy);
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(x0, y0 + world.waterY * sy, mw, mh - world.waterY * sy);
  ctx.fillStyle = '#565064';
  for (const rx of world.roadsV) ctx.fillRect(x0 + rx * sx, y0, Math.max(2, 104 * sx), world.beachY * sy);
  for (const ry of world.roadsH) ctx.fillRect(x0, y0 + ry * sy, mw, Math.max(2, 104 * sy));
  ctx.fillStyle = 'rgba(230,200,160,0.85)';
  for (const b of world.buildings) ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1.6, b.w * sx), Math.max(1.6, b.h * sy));
  // Objective blip.
  if (G.objective) {
    const ox = x0 + G.objective.x * sx, oy = y0 + G.objective.y * sy;
    ctx.fillStyle = '#ffc72c';
    ctx.beginPath(); ctx.arc(ox, oy, 4.6 + Math.sin(G.time * 4) * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,199,44,0.6)';
    ctx.beginPath(); ctx.arc(ox, oy, 8.4, 0, Math.PI * 2); ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#ff4040';
  for (const car of G.cars) {
    if (car.role !== 'police') continue;
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  for (const ped of G.peds) {
    if (ped.isOfficer && ped.state !== 'down') ctx.fillRect(x0 + ped.x * sx - 1.6, y0 + ped.y * sy - 1.6, 3.2, 3.2);
  }
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const car of G.cars) {
    if (car.role === 'traffic') ctx.fillRect(x0 + car.x * sx - 1, y0 + car.y * sy - 1, 2, 2);
  }
  // Player arrow.
  const px = x0 + G.player.x * sx, py = y0 + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e4572e';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(6.4, 0); ctx.lineTo(-4.4, -4); ctx.lineTo(-2.4, 0); ctx.lineTo(-4.4, 4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.fillText('PALMIRA', x0 + 4, y0 + mh - 5);
}

function drawToasts(ctx, G) {
  let y = 108;
  ctx.textAlign = 'center';
  for (const t of G.toasts) {
    const a = clamp(t.life / 0.5, 0, 1);
    ctx.globalAlpha = Math.min(1, a);
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(18,16,26,0.7)';
    const tw = ctx.measureText(t.text).width + 30;
    roundRect(ctx, G.viewW / 2 - tw / 2, y - 21, tw, 30, 8);
    ctx.fill();
    ctx.fillStyle = t.color || '#ffd76a';
    ctx.fillText(t.text, G.viewW / 2, y + 1);
    y += 38;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawContextHint(ctx, G) {
  if (G.state !== 'playing' || G.player.car) return;
  // "Press E" prompt near the player when a car is in reach.
  const near = G.nearCar;
  if (!near) return;
  const s = G.worldToScreen(near.x, near.y - 34);
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(18,16,26,0.8)';
  const label = near.role === 'parked' ? 'E — STEAL CAR' : 'E — GET IN';
  const tw = ctx.measureText(label).width + 18;
  roundRect(ctx, s.x - tw / 2, s.y - 14, tw, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#fff7e0';
  ctx.fillText(label, s.x, s.y + 2);
  ctx.textAlign = 'left';
}

// --- Full-screen states ------------------------------------------------------

export function drawTitle(ctx, G) {
  const W = G.viewW, H = G.viewH;
  // Sunset gradient sky over the frozen city view.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(38,20,54,0.55)');
  grad.addColorStop(0.55, 'rgba(120,44,54,0.35)');
  grad.addColorStop(1, 'rgba(20,14,30,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('M A R I S O L   C R E W   P R E S E N T S', W / 2, 150);
  ctx.fillStyle = '#fff7e0';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.strokeStyle = 'rgba(20,10,20,0.65)';
  ctx.lineWidth = 10;
  ctx.strokeText(GAME_NAME, W / 2, 248);
  ctx.fillText(GAME_NAME, W / 2, 248);
  ctx.fillStyle = '#ffb59e';
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText(GAME_TAGLINE, W / 2, 288);

  const has = G.save && G.save.started;
  drawButton(ctx, G, W / 2 - 130, 340, 260, 52, 'NEW GAME', 'new');
  drawButton(ctx, G, W / 2 - 130, 404, 260, 52, has ? 'CONTINUE — $' + G.save.cash + ' · JOB ' + Math.min(5, G.save.mission + 1) : 'CONTINUE', 'continue', !has);
  ctx.fillStyle = 'rgba(255,247,224,0.92)';
  ctx.font = '600 14.5px system-ui, sans-serif';
  ctx.fillText('WASD / Arrows — move & drive      E — enter / steal car      SHIFT — sprint', W / 2, 512);
  ctx.fillText('SPACE — punch / handbrake      MOUSE — aim, CLICK — shoot      P — pause      M — mute', W / 2, 538);
  ctx.fillStyle = 'rgba(255,247,224,0.6)';
  ctx.font = '600 12.5px system-ui, sans-serif';
  ctx.fillText('An original open-world crime game in the city of Palmira. Every car can be stolen. Every crime has a price.', W / 2, 580);
  ctx.textAlign = 'left';
}

function drawButton(ctx, G, x, y, w, h, label, id, disabled = false) {
  const m = G.input;
  const hover = m.mouseX >= x && m.mouseX <= x + w && m.mouseY >= y && m.mouseY <= y + h;
  ctx.fillStyle = disabled ? 'rgba(30,28,40,0.6)' : (hover ? 'rgba(255,199,44,0.92)' : 'rgba(18,16,26,0.82)');
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,106,0.7)';
  ctx.lineWidth = 1.6;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.4)' : (hover ? '#221c10' : '#fff7e0');
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  ctx.textAlign = 'left';
  G.buttons.push({ x, y, w, h, id, disabled });
}

export function drawPause(ctx, G) {
  const W = G.viewW, H = G.viewH;
  ctx.fillStyle = 'rgba(12,10,20,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff7e0';
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, 190);
  ctx.fillStyle = 'rgba(255,247,224,0.8)';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('Cash $' + G.cash + '   ·   Story job ' + Math.min(5, G.missions.index + (G.missions.active ? 0 : 1)) + ' of 5   ·   Fares driven: ' + (G.save.fares || 0), W / 2, 224);
  drawButton(ctx, G, W / 2 - 120, 262, 240, 48, 'RESUME', 'resume');
  drawButton(ctx, G, W / 2 - 120, 322, 240, 48, 'SAVE GAME', 'save');
  drawButton(ctx, G, W / 2 - 120, 382, 240, 48, 'RESTART JOB', 'restart');
  drawButton(ctx, G, W / 2 - 120, 442, 240, 48, G.muted ? 'SOUND: OFF (M)' : 'SOUND: ON (M)', 'mute');
  drawButton(ctx, G, W / 2 - 120, 502, 240, 48, 'TITLE SCREEN', 'title');
  ctx.textAlign = 'left';
}

export function drawCard(ctx, G) {
  const card = G.card;
  if (!card) return;
  const W = G.viewW, H = G.viewH;
  ctx.fillStyle = 'rgba(12,10,20,0.6)';
  ctx.fillRect(0, 0, W, H);
  const cw = 620, ch = 218;
  const x = W / 2 - cw / 2, y = H / 2 - ch / 2 - 30;
  ctx.fillStyle = 'rgba(20,17,30,0.95)';
  roundRect(ctx, x, y, cw, ch, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffc72c';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, cw, ch, 14);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc72c';
  ctx.font = '900 27px system-ui, sans-serif';
  ctx.fillText(card.title, W / 2, y + 52);
  ctx.fillStyle = '#fff7e0';
  ctx.font = '600 16.5px system-ui, sans-serif';
  wrapText(ctx, card.body, W / 2, y + 92, cw - 70, 24);
  ctx.fillStyle = 'rgba(255,247,224,0.65)';
  ctx.font = '700 13.5px system-ui, sans-serif';
  ctx.fillText(card.hint || 'Press ENTER', W / 2, y + ch - 22);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, G, kind) {
  const W = G.viewW, H = G.viewH;
  ctx.fillStyle = kind === 'busted' ? 'rgba(16,26,60,0.62)' : 'rgba(60,10,10,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#7fb5d5' : '#ff6b5e';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, 300);
  ctx.fillStyle = '#fff7e0';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(kind === 'busted'
    ? 'The PPD pinned Rico. Bail and fines cost $' + G.lastPenalty + '.'
    : 'Rico wakes up at Palmira Clinic. The bill came to $' + G.lastPenalty + '.', W / 2, 344);
  ctx.fillStyle = 'rgba(255,247,224,0.75)';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('Press ENTER to continue', W / 2, 392);
  ctx.textAlign = 'left';
}

export function drawStoryDone(ctx, G) {
  const W = G.viewW, H = G.viewH;
  ctx.fillStyle = 'rgba(14,20,16,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7be495';
  ctx.font = '900 54px system-ui, sans-serif';
  ctx.fillText('PALMIRA IS YOURS', W / 2, 268);
  ctx.fillStyle = '#fff7e0';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('The Marisol crew pulled off the last score and vanished into the sunset.', W / 2, 310);
  ctx.fillText('Free roam is open — courier fares pay cash all over the city.', W / 2, 340);
  ctx.fillStyle = 'rgba(255,247,224,0.75)';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('Press ENTER to keep driving', W / 2, 396);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

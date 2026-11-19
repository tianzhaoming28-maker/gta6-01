// Coral Vice - HUD: health, cash, wanted stars, minimap, objective
// text, banners, start screen and the "wasted" screen. All drawn on
// the same canvas after the world.
'use strict';

CV.Hud = {
  draw: function (ctx, game) {
    if (game.state === 'menu') {
      this.drawMenu(ctx, game);
      return;
    }
    if (game.state === 'play' || game.state === 'paused') {
      this.drawMinimap(ctx, game);
      this.drawTopBar(ctx, game);
      this.drawObjective(ctx, game);
      this.drawBanner(ctx, game);
      this.drawToast(ctx, game);
      if (game.player.mode === 'car') this.drawSpeedo(ctx, game);
      this.drawControlsHint(ctx, game);
      if (game.state === 'paused') this.drawPaused(ctx, game);
    }
    if (game.state === 'wasted') {
      this.drawWasted(ctx, game);
    }
  },

  drawTopBar: function (ctx, game) {
    var p = game.player;
    // Health bar, top-left.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CV.Render.roundRect(ctx, 16, 14, 224, 40, 7);
    ctx.fill();
    ctx.fillStyle = '#20242a';
    ctx.fillRect(24, 24, 150, 10);
    var hpFrac = CV.clamp(p.hp / CV.PLAYER_MAX_HP, 0, 1);
    ctx.fillStyle = hpFrac > 0.3 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(24, 24, 150 * hpFrac, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MARI VEGA', 24, 48);
    // Car health when driving.
    if (p.mode === 'car' && p.car) {
      ctx.fillStyle = '#20242a';
      ctx.fillRect(182, 24, 50, 10);
      ctx.fillStyle = '#5dade2';
      ctx.fillRect(182, 24, 50 * CV.clamp(p.car.hp / CV.CAR_MAX_HP, 0, 1), 10);
    }

    // Cash, under the health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CV.Render.roundRect(ctx, 16, 60, 150, 30, 7);
    ctx.fill();
    ctx.fillStyle = '#7be495';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('$' + game.cash.toLocaleString('en-US'), 26, 82);

    // Wanted stars, top-right.
    var stars = game.stars;
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (var i = 0; i < 5; i++) {
      var active = i < stars;
      ctx.fillStyle = active ? '#f1c40f' : 'rgba(255,255,255,0.22)';
      var pulse = active && game.time % 1 < 0.6 ? 1 : 0.75;
      ctx.globalAlpha = active ? pulse : 1;
      ctx.fillText('\u2605', CV.VIEW_W - 18 - (4 - i) * 30, 40);
    }
    ctx.globalAlpha = 1;

    // Location + clock, under the stars.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '13px system-ui, sans-serif';
    var zone = CV.World.zoneAt(p.x, p.y);
    ctx.fillText(zone + '  ·  ' + game.clockText(), CV.VIEW_W - 18, 64);

    // Heat meter: how close the next star is, or how fast it cools.
    if (game.crimePoints > 0.5) {
      var band = (game.crimePoints % CV.STAR_POINTS) / CV.STAR_POINTS;
      if (game.stars >= 5) band = 1;
      var bw = 138;
      var bx = CV.VIEW_W - 18 - bw;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      CV.Render.roundRect(ctx, bx - 6, 72, bw + 12, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#20242a';
      ctx.fillRect(bx, 79, bw, 6);
      ctx.fillStyle = game.policeNear(300) ? '#e74c3c' : '#f39c12';
      ctx.fillRect(bx, 79, bw * CV.clamp(band, 0.02, 1), 6);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(game.policeNear(300) ? 'SPOTTED' : 'COOLING', bx, 76 + 24);
    }
  },

  drawMinimap: function (ctx, game) {
    var size = 168;
    var x0 = 16;
    var y0 = CV.VIEW_H - size - 16;
    var scale = size / CV.WORLD_W;

    ctx.save();
    ctx.fillStyle = 'rgba(10,16,22,0.78)';
    CV.Render.roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 9);
    ctx.fill();
    ctx.beginPath();
    CV.Render.roundRect(ctx, x0, y0, size, size, 6);
    ctx.clip();

    // Land + roads.
    ctx.fillStyle = '#2c5d3a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#4a5058';
    for (var i = 0; i <= CV.COLS; i++) {
      ctx.fillRect(x0 + i * CV.PITCH * scale, y0, Math.max(1.5, CV.ROAD * scale), size);
      ctx.fillRect(x0, y0 + i * CV.PITCH * scale, size, Math.max(1.5, CV.ROAD * scale));
    }
    // Buildings as faint blocks.
    ctx.fillStyle = 'rgba(220,220,210,0.35)';
    var bs = CV.World.buildings;
    for (var b = 0; b < bs.length; b++) {
      ctx.fillRect(x0 + bs[b].x * scale, y0 + bs[b].y * scale,
        Math.max(1, bs[b].w * scale), Math.max(1, bs[b].h * scale));
    }
    // Mission marker.
    var mk = CV.Missions.marker;
    if (mk) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x0 + mk.x * scale, y0 + mk.y * scale, 4 + Math.sin(game.time * 5) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cash drop blips.
    ctx.fillStyle = '#2ecc71';
    var pks = game.pickups || [];
    for (var pk2 = 0; pk2 < pks.length; pk2++) {
      if (pks[pk2].taken) continue;
      ctx.beginPath();
      ctx.arc(x0 + pks[pk2].x * scale, y0 + pks[pk2].y * scale, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#5dade2';
    var units = CV.Police.units;
    for (var u = 0; u < units.length; u++) {
      var ref = units[u].kind === 'car' ? units[u].car : units[u];
      if (!ref || units[u].dead) continue;
      ctx.fillRect(x0 + ref.x * scale - 1.5, y0 + ref.y * scale - 1.5, 3, 3);
    }
    // Player arrow.
    var p = game.player;
    ctx.save();
    ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // North marker on the minimap frame.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', x0 + size / 2, y0 - 8);

    // Direction arrow to the objective at the minimap edge.
    if (mk) {
      var dx = mk.x - p.x;
      var dy = mk.y - p.y;
      var dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > 60) {
        var a = Math.atan2(dy, dx);
        var ex = x0 + size / 2 + Math.cos(a) * (size / 2 + 12);
        var ey = y0 + size / 2 + Math.sin(a) * (size / 2 + 12);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(dd / 10) + 'm', ex, ey + 16);
      }
    }
  },

  drawObjective: function (ctx, game) {
    var text = CV.Missions.objectiveText(game);
    if (!text) return;
    ctx.font = '15px system-ui, sans-serif';
    var w = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CV.Render.roundRect(ctx, (CV.VIEW_W - w) / 2, CV.VIEW_H - 46, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(text, CV.VIEW_W / 2, CV.VIEW_H - 26);
  },

  drawBanner: function (ctx, game) {
    var b = game.banner;
    if (!b || b.t <= 0) return;
    var alpha = CV.clamp(b.t, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(b.title, CV.VIEW_W / 2, 118);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    if (b.sub) this.wrapText(ctx, b.sub, CV.VIEW_W / 2, 146, 760, 21);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  },

  drawToast: function (ctx, game) {
    var t = game.toast;
    if (!t || t.t <= 0) return;
    ctx.globalAlpha = CV.clamp(t.t, 0, 1);
    ctx.font = '14px system-ui, sans-serif';
    var w = ctx.measureText(t.text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CV.Render.roundRect(ctx, CV.VIEW_W - w - 16, 84, w, 26, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(t.text, CV.VIEW_W - w - 4, 102);
    ctx.globalAlpha = 1;
  },

  drawSpeedo: function (ctx, game) {
    var car = game.player.car;
    if (!car) return;
    var kmh = Math.round(Math.abs(car.speed) * 0.36 * 2.2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CV.Render.roundRect(ctx, CV.VIEW_W - 132, CV.VIEW_H - 92, 116, 76, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(kmh), CV.VIEW_W - 74, CV.VIEW_H - 52);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('km/h', CV.VIEW_W - 74, CV.VIEW_H - 36);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(car.type.name, CV.VIEW_W - 74, CV.VIEW_H - 22);
  },

  drawControlsHint: function (ctx, game) {
    if (game.stats.time > 25) return; // only early on
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    var lines = game.player.mode === 'car'
      ? ['WASD drive · SPACE handbrake · H horn · E exit car']
      : ['WASD move · SHIFT sprint · E enter car · F punch · MOUSE aim + click shoot'];
    ctx.fillText(lines[0], 196, CV.VIEW_H - 22);
  },

  wrapText: function (ctx, text, x, y, maxW, lineH) {
    var words = text.split(' ');
    var line = '';
    var yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  },

  drawMenu: function (ctx, game) {
    // Dim the city behind.
    ctx.fillStyle = 'rgba(10,8,24,0.45)';
    ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    var grad = ctx.createLinearGradient(0, 120, 0, 330);
    grad.addColorStop(0, '#ff5e78');
    grad.addColorStop(1, '#f39c12');
    ctx.fillStyle = grad;
    ctx.textAlign = 'center';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 16;
    ctx.fillText('CORAL VICE', CV.VIEW_W / 2, 240);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in Coral Bay', CV.VIEW_W / 2, 282);

    var hasSave = CV.Save.has();
    var items = [
      { label: hasSave ? 'CONTINUE' : 'NEW GAME', key: 'continue' },
      { label: 'NEW GAME', key: 'new', hide: !hasSave },
      { label: 'HOW TO PLAY', key: 'help' }
    ];
    var y = 360;
    ctx.font = 'bold 24px system-ui, sans-serif';
    game.menuRects = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.hide) continue;
      var w = 300;
      var x = (CV.VIEW_W - w) / 2;
      var hover = CV.Input.mouseX >= x && CV.Input.mouseX <= x + w &&
                  CV.Input.mouseY >= y && CV.Input.mouseY <= y + 48;
      ctx.fillStyle = hover ? 'rgba(255,94,120,0.9)' : 'rgba(0,0,0,0.55)';
      CV.Render.roundRect(ctx, x, y, w, 48, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(it.label, CV.VIEW_W / 2, y + 32);
      game.menuRects.push({ x: x, y: y, w: w, h: 48, key: it.key });
      y += 62;
    }

    if (game.showHelp) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      CV.Render.roundRect(ctx, CV.VIEW_W / 2 - 330, 520, 660, 168, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '15px system-ui, sans-serif';
      var help = [
        'WASD / arrows - move & drive      SHIFT - sprint',
        'E - enter / exit car (steal it!)   F or SPACE - punch',
        'Mouse - aim, hold click - shoot    P - pause, M - mute',
        'Follow the gold marker, do Carmen\'s jobs, pay off the Syndicate.',
        'Crime raises your stars. Break line of sight to cool off.'
      ];
      for (var h = 0; h < help.length; h++) {
        ctx.fillText(help[h], CV.VIEW_W / 2, 552 + h * 26);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Click a button to start · sound on recommended', CV.VIEW_W / 2, CV.VIEW_H - 18);
  },

  drawPaused: function (ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', CV.VIEW_W / 2, CV.VIEW_H / 2 - 10);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('P to resume · progress auto-saves', CV.VIEW_W / 2, CV.VIEW_H / 2 + 26);
  },

  drawWasted: function (ctx, game) {
    ctx.fillStyle = 'rgba(30,0,0,0.62)';
    ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('WASTED', CV.VIEW_W / 2, CV.VIEW_H / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The hospital patched Mari up. The bill stings.', CV.VIEW_W / 2, CV.VIEW_H / 2 + 44);
  }
};

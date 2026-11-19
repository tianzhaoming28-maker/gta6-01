// Coral Vice - rendering. Hand-rolled Canvas2D, top-down with a
// slight fake-height offset on buildings so the city feels tall.
// Everything draws relative to the camera in game.camera.
'use strict';

CV.Render = {
  draw: function (ctx, game) {
    var cam = game.camera;
    var W = CV.VIEW_W;
    var H = CV.VIEW_H;

    ctx.save();
    // Camera shake.
    if (game.shake > 0.2) {
      ctx.translate((game.rng.next() - 0.5) * game.shake, (game.rng.next() - 0.5) * game.shake);
    }
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    this.drawGround(ctx, game, cam);
    this.drawRoads(ctx, game, cam);
    this.drawProps(ctx, game, cam, false);
    this.drawPickups(ctx, game);
    this.drawMarker(ctx, game);
    this.drawCars(ctx, game, cam);
    this.drawPeds(ctx, game, cam);
    this.drawPolice(ctx, game, cam);
    this.drawPlayer(ctx, game);
    this.drawBullets(ctx, game);
    this.drawBuildings(ctx, game, cam);
    this.drawProps(ctx, game, cam, true); // palms overhang roofs a little

    ctx.restore();

    this.drawDayNight(ctx, game);
    this.drawVignette(ctx, game);
  },

  visible: function (cam, x, y, pad) {
    return x > cam.x - pad && x < cam.x + CV.VIEW_W + pad &&
           y > cam.y - pad && y < cam.y + CV.VIEW_H + pad;
  },

  drawGround: function (ctx, game, cam) {
    // Water beyond the island edge, sand rim, then grass.
    ctx.fillStyle = CV.COLORS.water;
    ctx.fillRect(cam.x - 40, cam.y - 40, CV.VIEW_W + 80, CV.VIEW_H + 80);
    ctx.fillStyle = CV.COLORS.sand;
    ctx.fillRect(-26, -26, CV.WORLD_W + 52, CV.WORLD_H + 52);
    ctx.fillStyle = CV.COLORS.grass;
    ctx.fillRect(0, 0, CV.WORLD_W, CV.WORLD_H);

    // Parks are a deeper green with mow stripes.
    var parks = CV.World.parks;
    for (var i = 0; i < parks.length; i++) {
      var pk = parks[i];
      if (!this.visible(cam, pk.x + pk.w / 2, pk.y + pk.h / 2, 200)) continue;
      ctx.fillStyle = CV.COLORS.grassDark;
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (var s = 0; s < pk.w; s += 22) {
        if ((s / 22) % 2 === 0) ctx.fillRect(pk.x + s, pk.y, 11, pk.h);
      }
    }

    // Block slabs (sidewalks) under the buildings.
    ctx.fillStyle = CV.COLORS.sidewalk;
    for (var by = 0; by < CV.ROWS; by++) {
      for (var bx = 0; bx < CV.COLS; bx++) {
        var x = CV.ROAD + bx * CV.PITCH - CV.SIDEWALK;
        var y = CV.ROAD + by * CV.PITCH - CV.SIDEWALK;
        var w = CV.BLOCK + CV.SIDEWALK * 2;
        if (!this.visible(cam, x + w / 2, y + w / 2, 200)) continue;
        ctx.fillRect(x, y, w, w);
      }
    }
  },

  drawRoads: function (ctx, game, cam) {
    ctx.fillStyle = CV.COLORS.road;
    var i, x, y;
    for (i = 0; i <= CV.COLS; i++) {
      x = i * CV.PITCH;
      if (x + CV.ROAD < cam.x || x > cam.x + CV.VIEW_W) continue;
      ctx.fillRect(x, 0, CV.ROAD, CV.WORLD_H);
    }
    for (i = 0; i <= CV.ROWS; i++) {
      y = i * CV.PITCH;
      if (y + CV.ROAD < cam.y || y > cam.y + CV.VIEW_H) continue;
      ctx.fillRect(0, y, CV.WORLD_W, CV.ROAD);
    }
    // Centre dashes.
    ctx.fillStyle = CV.COLORS.roadLine;
    for (i = 0; i <= CV.COLS; i++) {
      x = i * CV.PITCH + CV.ROAD / 2 - 1;
      if (x < cam.x - 4 || x > cam.x + CV.VIEW_W + 4) continue;
      for (y = 8; y < CV.WORLD_H; y += 30) {
        if (y > cam.y - 20 && y < cam.y + CV.VIEW_H + 20) ctx.fillRect(x, y, 2, 14);
      }
    }
    for (i = 0; i <= CV.ROWS; i++) {
      y = i * CV.PITCH + CV.ROAD / 2 - 1;
      if (y < cam.y - 4 || y > cam.y + CV.VIEW_H + 4) continue;
      for (x = 8; x < CV.WORLD_W; x += 30) {
        if (x > cam.x - 20 && x < cam.x + CV.VIEW_W + 20) ctx.fillRect(x, y, 14, 2);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(240,240,240,0.5)';
    for (var ix = 0; ix <= CV.COLS; ix++) {
      for (var iy = 0; iy <= CV.ROWS; iy++) {
        var cx = ix * CV.PITCH;
        var cy = iy * CV.PITCH;
        if (!this.visible(cam, cx + CV.ROAD / 2, cy + CV.ROAD / 2, 60)) continue;
        for (var s2 = 0; s2 < 4; s2++) {
          ctx.fillRect(cx + 4 + s2 * 10, cy - 5, 5, 4);
          ctx.fillRect(cx + 4 + s2 * 10, cy + CV.ROAD + 1, 5, 4);
        }
      }
    }
  },

  drawBuildings: function (ctx, game, cam) {
    var list = CV.World.buildings;
    var lift = 10 + game.cameraLift; // fake height
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!this.visible(cam, b.x + b.w / 2, b.y + b.h / 2, 220)) continue;
      // Shadow / side wall.
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
      ctx.fillStyle = this.shade(b.color, -28);
      ctx.fillRect(b.x - lift * 0.4, b.y + b.h - lift * 0.4, b.w, lift * 0.4 + 2);
      // Roof.
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - lift * 0.4, b.y - lift * 0.4, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - lift * 0.4 + 3, b.y - lift * 0.4 + 3, b.w - 6, b.h - 6);
      // Roof details: AC boxes and a parapet line.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w * 0.18, b.y + b.h * 0.16, 10, 8);
      if (b.w > 60) ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.55, 12, 9);
      // Windows: lit at night, glassy by day.
      var night = game.nightAmount;
      var cols = Math.max(2, Math.floor(b.w / 15));
      var rows = Math.max(2, Math.floor(b.h / 15));
      for (var wx = 0; wx < cols; wx++) {
        for (var wy = 0; wy < rows; wy++) {
          var seedv = ((wx * 31 + wy * 17 + i * 7) % 10) / 10;
          var lit = seedv < night * 0.75;
          ctx.fillStyle = lit ? 'rgba(255,214,120,0.95)' : 'rgba(38,52,66,0.55)';
          ctx.fillRect(b.x + 6 + wx * 15, b.y + 6 + wy * 15, 7, 9);
        }
      }
      if (b.awning) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(b.x - 2, b.y + b.h - 4, b.w + 4, 6);
      }
    }
  },

  shade: function (hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = CV.clamp((n >> 16) + amt, 0, 255);
    var g = CV.clamp(((n >> 8) & 0xff) + amt, 0, 255);
    var bl = CV.clamp((n & 0xff) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  },

  drawProps: function (ctx, game, cam, tall) {
    var props = CV.World.props;
    for (var i = 0; i < props.length; i++) {
      var p = props[i];
      if (!this.visible(cam, p.x, p.y, 60)) continue;
      var isTall = p.kind === 'palm' || p.kind === 'fountain';
      if (tall !== isTall) continue;
      if (p.kind === 'palm') {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8a6d3b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y - 6); ctx.stroke();
        ctx.strokeStyle = '#2e8b57';
        ctx.lineWidth = 2.5;
        for (var f = 0; f < 6; f++) {
          var a = (f / 6) * Math.PI * 2 + i;
          ctx.beginPath();
          ctx.moveTo(p.x + 2, p.y - 6);
          ctx.quadraticCurveTo(
            p.x + 2 + Math.cos(a) * 8, p.y - 10 + Math.sin(a) * 3,
            p.x + 2 + Math.cos(a) * 13, p.y - 4 + Math.sin(a) * 6);
          ctx.stroke();
        }
      } else if (p.kind === 'lamp') {
        ctx.fillStyle = '#444';
        ctx.fillRect(p.x - 1, p.y - 8, 2, 10);
        var glow = game.nightAmount;
        ctx.fillStyle = glow > 0.4 ? '#ffe9a8' : '#cfd8dc';
        ctx.beginPath(); ctx.arc(p.x, p.y - 10, 3, 0, Math.PI * 2); ctx.fill();
        if (glow > 0.4) {
          ctx.fillStyle = 'rgba(255,233,168,0.14)';
          ctx.beginPath(); ctx.arc(p.x, p.y - 8, 16, 0, Math.PI * 2); ctx.fill();
        }
      } else if (p.kind === 'hydrant') {
        ctx.fillStyle = '#d23c2e';
        ctx.fillRect(p.x - 3, p.y - 4, 6, 8);
        ctx.fillRect(p.x - 1, p.y - 7, 2, 3);
      } else if (p.kind === 'crate') {
        ctx.fillStyle = '#a9805a';
        ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
        ctx.strokeStyle = '#7c5a3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 8, p.y - 8, 16, 16);
      } else if (p.kind === 'fountain') {
        ctx.fillStyle = '#90a4ae';
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4fc3f7';
        ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e1f5fe';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  },

  drawMarker: function (ctx, game) {
    var mk = CV.Missions.marker;
    if (!mk || game.state !== 'play') return;
    var bob = Math.sin(game.time * 4) * 5;
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 30 + bob, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 17 + bob * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7d6608';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', mk.x, mk.y + 5);
    // A pillar of light so it reads across the city.
    var grad = ctx.createLinearGradient(0, mk.y - 190, 0, mk.y);
    grad.addColorStop(0, 'rgba(241,196,15,0)');
    grad.addColorStop(1, 'rgba(241,196,15,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(mk.x - 7, mk.y - 190, 14, 190);
  },

  drawPickups: function (ctx, game) {
    var list = game.pickups || [];
    for (var i = 0; i < list.length; i++) {
      var pk = list[i];
      if (pk.taken) continue;
      var bob = Math.sin(game.time * 5 + i * 1.7) * 3;
      ctx.fillStyle = 'rgba(46,204,113,0.25)';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 20 + bob, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#27ae60';
      CV.Render.roundRect(ctx, pk.x - 8, pk.y - 6 + bob * 0.4, 16, 11, 2);
      ctx.fill();
      ctx.fillStyle = '#d5f5e3';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 3 + bob * 0.4);
    }
  },

  drawCarShape: function (ctx, car, game) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    var L = CV.CAR_W;
    var Wd = CV.CAR_H;
    // Headlight cones after dark.
    if (game && game.nightAmount > 0.3 && car.hp > 0) {
      ctx.fillStyle = 'rgba(255,240,180,' + (0.13 * game.nightAmount) + ')';
      ctx.beginPath();
      ctx.moveTo(L / 2, -5);
      ctx.lineTo(L / 2 + 95, -24);
      ctx.lineTo(L / 2 + 95, 24);
      ctx.lineTo(L / 2, 5);
      ctx.closePath();
      ctx.fill();
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
    // Body.
    ctx.fillStyle = car.flash > 0 ? '#ffffff' : car.color;
    this.roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 5);
    ctx.fill();
    // Police livery stripe.
    if (car.police) {
      ctx.fillStyle = '#2471a3';
      ctx.fillRect(-L / 2, -3, L, 6);
    }
    // Cabin / glass.
    ctx.fillStyle = 'rgba(24,36,48,0.85)';
    this.roundRect(ctx, -L * 0.16, -Wd / 2 + 3, L * 0.34, Wd - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,200,235,0.5)';
    ctx.fillRect(L * 0.10, -Wd / 2 + 4, 4, Wd - 8);
    // Headlights / taillights.
    ctx.fillStyle = '#fff7ae';
    ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 2, 4);
    ctx.fillRect(L / 2 - 2, Wd / 2 - 6, 2, 4);
    ctx.fillStyle = car.brake ? '#ff8a7a' : '#e74c3c';
    var tl = car.brake ? 3.4 : 2;
    ctx.fillRect(-L / 2 - (tl - 2), -Wd / 2 + 2, tl, 4);
    ctx.fillRect(-L / 2 - (tl - 2), Wd / 2 - 6, tl, 4);
    // Wheels.
    ctx.fillStyle = '#15181c';
    ctx.fillRect(-L / 2 + 4, -Wd / 2 - 2, 8, 3);
    ctx.fillRect(L / 2 - 12, -Wd / 2 - 2, 8, 3);
    ctx.fillRect(-L / 2 + 4, Wd / 2 - 1, 8, 3);
    ctx.fillRect(L / 2 - 12, Wd / 2 - 1, 8, 3);
    // Siren lights.
    if (car.police) {
      var phase = Math.sin(car.siren) > 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#5dade2';
      ctx.fillRect(-6, -Wd / 2 + 3, 5, 4);
      ctx.fillStyle = phase ? '#5dade2' : '#ff3b30';
      ctx.fillRect(1, -Wd / 2 + 3, 5, 4);
    }
    ctx.restore();
    // Mission marker ring.
    if (car.missionCar) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(car.x, car.y, 30, 0, Math.PI * 2); ctx.stroke();
    }
    // Damage smoke.
    if (car.smoke > 0.3) {
      ctx.fillStyle = 'rgba(60,60,60,' + (0.25 * car.smoke) + ')';
      var s = 6 + Math.sin(game.time * 9 + car.x) * 2;
      ctx.beginPath(); ctx.arc(car.x, car.y - 12, s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(car.x + 5, car.y - 20, s * 1.3, 0, Math.PI * 2); ctx.fill();
    }
  },

  roundRect: function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  drawCars: function (ctx, game, cam) {
    var cars = CV.Traffic.cars;
    for (var i = 0; i < cars.length; i++) {
      if (!this.visible(cam, cars[i].x, cars[i].y, 60)) continue;
      this.drawCarShape(ctx, cars[i], game);
    }
  },

  drawPerson: function (ctx, x, y, angle, shirt, skin, opts) {
    opts = opts || {};
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (opts.down) {
      // Fallen: body stretched along the ground.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = shirt;
      ctx.fillRect(-11, -4, 20, 8);
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(13, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    // Legs (walk cycle swing).
    var swing = opts.moving ? Math.sin(opts.phase || 0) * 4 : 0;
    ctx.strokeStyle = '#2f3640';
    ctx.lineWidth = 3;
    var fx = Math.cos(angle);
    var fy = Math.sin(angle);
    var px = -fy;
    var py = fx;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + fx * swing + px * 2.5, y + fy * swing + py * 2.5);
    ctx.moveTo(x, y);
    ctx.lineTo(x - fx * swing - px * 2.5, y - fy * swing - py * 2.5);
    ctx.stroke();
    // Torso.
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x + fx * 1.5, y + fy * 1.5, 4.2, 0, Math.PI * 2); ctx.fill();
    // Punch / gun arm.
    if (opts.punch) {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + fx * 15, y + fy * 15);
      ctx.stroke();
    }
    if (opts.gun) {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + fx * 10, y + fy * 10);
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.fillRect(x + fx * 10 - 1.5, y + fy * 10 - 1.5, 4, 3);
    }
  },

  drawPeds: function (ctx, game, cam) {
    var list = CV.Pedestrians.list;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!this.visible(cam, p.x, p.y, 40)) continue;
      this.drawPerson(ctx, p.x, p.y, p.angle, p.color, p.skin, {
        down: p.state === 'down',
        moving: p.state === 'walk' || p.state === 'flee',
        phase: p.walkPhase || 0,
        gun: !!p.hostile && p.state !== 'down'
      });
      if (p.special === 'target' || p.special === 'thug') {
        ctx.fillStyle = p.special === 'thug' ? '#e74c3c' : '#f1c40f';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.special === 'thug' ? '!' : '$', p.x, p.y - 14);
      }
    }
  },

  drawPolice: function (ctx, game, cam) {
    var units = CV.Police.units;
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (u.kind !== 'foot') continue;
      if (!this.visible(cam, u.x, u.y, 40)) continue;
      this.drawPerson(ctx, u.x, u.y, u.angle, '#1b3a5c', '#e0ac69', {
        down: u.dead,
        moving: !u.dead,
        phase: u.walkPhase || 0,
        gun: !u.dead
      });
      if (!u.dead) {
        // Police cap dot.
        ctx.fillStyle = '#f5f6fa';
        ctx.beginPath(); ctx.arc(u.x, u.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  },

  drawPlayer: function (ctx, game) {
    var p = game.player;
    if (p.mode === 'car') return; // the car itself is drawn with traffic
    this.drawPerson(ctx, p.x, p.y, p.angle, '#ff5e78', '#c68642', {
      moving: p.moving,
      phase: p.walkPhase,
      punch: p.punchT > 0,
      gun: CV.Input.mouseDown
    });
    // Muzzle flash.
    if (game.muzzleT > 0) {
      var fx = p.x + Math.cos(p.angle) * 18;
      var fy = p.y + Math.sin(p.angle) * 18;
      ctx.fillStyle = 'rgba(255,200,60,0.9)';
      ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Soft ring under the player so she is easy to track.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.stroke();
  },

  drawBullets: function (ctx, game) {
    ctx.fillStyle = '#ffe66d';
    var bs = game.bullets;
    for (var i = 0; i < bs.length; i++) {
      ctx.fillRect(bs[i].x - 2, bs[i].y - 1, 4, 2);
    }
  },

  drawDayNight: function (ctx, game) {
    var n = game.nightAmount;
    if (n <= 0.01) return;
    ctx.fillStyle = 'rgba(16,20,54,' + (n * 0.42) + ')';
    ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    // Warm dusk tint near the ends of the day.
    if (game.duskAmount > 0.05) {
      ctx.fillStyle = 'rgba(255,120,50,' + (game.duskAmount * 0.10) + ')';
      ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    }
  },

  drawVignette: function (ctx, game) {
    var grad = ctx.createRadialGradient(
      CV.VIEW_W / 2, CV.VIEW_H / 2, CV.VIEW_H * 0.45,
      CV.VIEW_W / 2, CV.VIEW_H / 2, CV.VIEW_H * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    // Red flash when hurt recently.
    if (game.hurtFlash > 0) {
      ctx.fillStyle = 'rgba(200,30,30,' + (game.hurtFlash * 0.35) + ')';
      ctx.fillRect(0, 0, CV.VIEW_W, CV.VIEW_H);
    }
  }
};

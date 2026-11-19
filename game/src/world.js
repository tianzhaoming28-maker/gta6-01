// Coral Vice - the city of Coral Bay.
// Generated deterministically from a seed: a grid of blocks, each with
// 1-4 buildings, palm trees, lamps and parked cars. Also owns the road
// helpers that traffic, pedestrians and the minimap all share.
'use strict';

CV.World = {
  seed: 1,
  buildings: [],   // {x,y,w,h,color,floors,roof,name}
  props: [],       // {x,y,kind} palms, lamps, hydrants, crates
  parks: [],       // green blocks {x,y,w,h}
  zones: [],       // named districts for flavour {x,y,w,h,name}
  spawnPoints: [], // sidewalk spots where pedestrians appear

  generate: function (seed) {
    this.seed = seed;
    var rng = new CV.Rng(seed);
    this.buildings = [];
    this.props = [];
    this.parks = [];
    this.zones = [];
    this.spawnPoints = [];

    var districtNames = [
      'Flamingo Row', 'Old Marina', 'Cayo Heights', 'Palmetto Strip',
      'Coral Market', 'Bayside', 'Little Havana Nova', 'The Boardwalk',
      'Turtle Beach', 'Neon Mile', 'Harbor Point', 'Solana Gardens'
    ];
    var di = 0;

    for (var by = 0; by < CV.ROWS; by++) {
      for (var bx = 0; bx < CV.COLS; bx++) {
        var x0 = CV.ROAD + bx * CV.PITCH;
        var y0 = CV.ROAD + by * CV.PITCH;
        var roll = rng.next();

        // A few blocks are parks or parking lots instead of towers.
        if (roll < 0.10) {
          this.parks.push({ x: x0, y: y0, w: CV.BLOCK, h: CV.BLOCK });
          this.scatterParkProps(rng, x0, y0);
          continue;
        }
        if (roll < 0.16) {
          // Open lot: just props and parked cars (added by traffic).
          this.scatterLotProps(rng, x0, y0);
          continue;
        }

        if (di < districtNames.length && rng.chance(0.55)) {
          this.zones.push({
            x: x0, y: y0, w: CV.BLOCK, h: CV.BLOCK,
            name: districtNames[di++]
          });
        }
        this.buildBlock(rng, x0, y0);
        this.scatterSidewalkProps(rng, x0, y0);
      }
    }

    // Pedestrian spawn points: midpoints of every block's sidewalks.
    for (var sy = 0; sy < CV.ROWS; sy++) {
      for (var sx = 0; sx < CV.COLS; sx++) {
        var cx = CV.ROAD + sx * CV.PITCH + CV.BLOCK / 2;
        var cy = CV.ROAD + sy * CV.PITCH + CV.BLOCK / 2;
        this.spawnPoints.push({ x: cx, y: CV.ROAD + sy * CV.PITCH - 4 });
        this.spawnPoints.push({ x: cx, y: CV.ROAD + (sy + 1) * CV.PITCH + 4 });
        this.spawnPoints.push({ x: CV.ROAD + sx * CV.PITCH - 4, y: cy });
        this.spawnPoints.push({ x: CV.ROAD + (sx + 1) * CV.PITCH + 4, y: cy });
      }
    }
    return this;
  },

  buildBlock: function (rng, x0, y0) {
    // Split the block into 1, 2 or 4 building plots.
    var layout = rng.pick([1, 2, 2, 4, 4]);
    var inset = 8;
    var plots = [];
    if (layout === 1) {
      plots.push({ x: x0 + inset, y: y0 + inset, w: CV.BLOCK - inset * 2, h: CV.BLOCK - inset * 2 });
    } else if (layout === 2) {
      var half = CV.BLOCK / 2;
      if (rng.chance(0.5)) {
        plots.push({ x: x0 + inset, y: y0 + inset, w: half - inset - 3, h: CV.BLOCK - inset * 2 });
        plots.push({ x: x0 + half + 3, y: y0 + inset, w: half - inset - 3, h: CV.BLOCK - inset * 2 });
      } else {
        plots.push({ x: x0 + inset, y: y0 + inset, w: CV.BLOCK - inset * 2, h: half - inset - 3 });
        plots.push({ x: x0 + inset, y: y0 + half + 3, w: CV.BLOCK - inset * 2, h: half - inset - 3 });
      }
    } else {
      var q = CV.BLOCK / 2;
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 2; j++) {
          plots.push({
            x: x0 + i * q + inset, y: y0 + j * q + inset,
            w: q - inset * 2, h: q - inset * 2
          });
        }
      }
    }
    for (var k = 0; k < plots.length; k++) {
      var p = plots[k];
      // Shrink a little for variety, keep a minimum footprint.
      var sw = rng.range(0, Math.min(10, p.w - 34));
      var sh = rng.range(0, Math.min(10, p.h - 34));
      this.buildings.push({
        x: p.x + sw / 2, y: p.y + sh / 2,
        w: p.w - sw, h: p.h - sh,
        color: rng.pick(CV.BUILDING_COLORS),
        roof: rng.pick(['#6d4c41', '#546e7a', '#795548', '#607d8b', '#8d6e63']),
        floors: rng.int(2, 9),
        awning: rng.chance(0.4)
      });
    }
  },

  scatterParkProps: function (rng, x0, y0) {
    var n = rng.int(5, 9);
    for (var i = 0; i < n; i++) {
      this.props.push({
        x: x0 + rng.range(12, CV.BLOCK - 12),
        y: y0 + rng.range(12, CV.BLOCK - 12),
        kind: 'palm'
      });
    }
    this.props.push({ x: x0 + CV.BLOCK / 2, y: y0 + CV.BLOCK / 2, kind: 'fountain' });
  },

  scatterLotProps: function (rng, x0, y0) {
    var n = rng.int(1, 3);
    for (var i = 0; i < n; i++) {
      this.props.push({
        x: x0 + rng.range(16, CV.BLOCK - 16),
        y: y0 + rng.range(16, CV.BLOCK - 16),
        kind: 'crate'
      });
    }
  },

  scatterSidewalkProps: function (rng, x0, y0) {
    // Palms and lamps along the block edges.
    var spots = [
      { x: x0 + 6, y: y0 + 6 }, { x: x0 + CV.BLOCK - 6, y: y0 + 6 },
      { x: x0 + 6, y: y0 + CV.BLOCK - 6 }, { x: x0 + CV.BLOCK - 6, y: y0 + CV.BLOCK - 6 }
    ];
    for (var i = 0; i < spots.length; i++) {
      if (rng.chance(0.5)) {
        this.props.push({ x: spots[i].x, y: spots[i].y, kind: rng.chance(0.6) ? 'palm' : 'lamp' });
      }
    }
    if (rng.chance(0.3)) {
      this.props.push({
        x: x0 + rng.range(10, CV.BLOCK - 10),
        y: rng.chance(0.5) ? y0 - 3 : y0 + CV.BLOCK + 3,
        kind: 'hydrant'
      });
    }
  },

  // ---- Road geometry -----------------------------------------------------
  // Roads are the strips between blocks. A point is on a road when its
  // x or y falls inside one of the road bands.
  isRoadX: function (x) {
    var m = x % CV.PITCH;
    return m < CV.ROAD || x >= CV.WORLD_W - CV.ROAD;
  },

  isRoadY: function (y) {
    var m = y % CV.PITCH;
    return m < CV.ROAD || y >= CV.WORLD_H - CV.ROAD;
  },

  isRoad: function (x, y) {
    return this.isRoadX(x) || this.isRoadY(y);
  },

  // Centre line coordinate of the i-th vertical / horizontal road.
  roadCenterX: function (i) { return i * CV.PITCH + CV.ROAD / 2; },
  roadCenterY: function (j) { return j * CV.PITCH + CV.ROAD / 2; },

  // Lane offset for right-hand traffic given a travel direction.
  laneOffset: function (dirX, dirY) {
    // Right side of the direction of travel.
    return { x: -dirY * (CV.ROAD / 4), y: dirX * (CV.ROAD / 4) };
  },

  // ---- Collision -----------------------------------------------------------
  // Circle vs every building AABB; returns a push-out correction or null.
  collideCircle: function (x, y, r) {
    var pushed = null;
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      var nx = CV.clamp(x, b.x, b.x + b.w);
      var ny = CV.clamp(y, b.y, b.y + b.h);
      var dx = x - nx;
      var dy = y - ny;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          pushed = { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: true };
          x = pushed.x;
          y = pushed.y;
        } else {
          // Centre inside the building: push out along the smallest axis.
          var left = x - b.x;
          var right = b.x + b.w - x;
          var top = y - b.y;
          var bottom = b.y + b.h - y;
          var m = Math.min(left, right, top, bottom);
          if (m === left) x = b.x - r;
          else if (m === right) x = b.x + b.w + r;
          else if (m === top) y = b.y - r;
          else y = b.y + b.h + r;
          pushed = { x: x, y: y, hit: true };
        }
      }
    }
    return pushed;
  },

  pointInBuilding: function (x, y, pad) {
    pad = pad || 0;
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) {
        return b;
      }
    }
    return null;
  },

  // District name at a point, for the HUD location line.
  zoneAt: function (x, y) {
    for (var i = 0; i < this.zones.length; i++) {
      var z = this.zones[i];
      if (x >= z.x - CV.ROAD && x <= z.x + z.w + CV.ROAD &&
          y >= z.y - CV.ROAD && y <= z.y + z.h + CV.ROAD) {
        return z.name;
      }
    }
    return 'Coral Bay';
  }
};

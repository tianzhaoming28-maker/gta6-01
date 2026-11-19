// Coral Vice - screenshot scenarios.
// Open index.html?shot=<name> and the game builds one deterministic
// scene, steps the simulation a fixed number of ticks, renders a
// single frame and sets window.__shotReady = true. Used to capture
// the store screenshots with a headless browser; harmless in play.
'use strict';

CV.Shots = {
  names: ['cover', 'street', 'chase', 'mission'],

  // Fixed tick counts per scene so every capture is reproducible.
  ticks: {
    cover: 0,
    street: 50,
    chase: 42,
    mission: 30
  },

  setup: function (game, name) {
    var rng = game.rng;
    var p = game.player;

    if (name === 'cover') {
      // The start screen over a busy downtown intersection at dusk.
      game.state = 'menu';
      game.dayT = 0.79;
      var c = CV.Traffic.nodePos(4, 4);
      p.x = c.x + 30;
      p.y = c.y + 44;
      game.camera.x = CV.clamp(c.x - CV.VIEW_W / 2, 0, CV.WORLD_W - CV.VIEW_W);
      game.camera.y = CV.clamp(c.y - CV.VIEW_H / 2, 0, CV.WORLD_H - CV.VIEW_H);
      this.scatterCrowd(game, c.x, c.y, 7);
      return;
    }

    game.state = 'play';

    if (name === 'street') {
      // Mari on foot downtown, mid-morning, people and traffic around.
      game.dayT = 0.44;
      var s = CV.Traffic.nodePos(4, 5);
      p.x = s.x - CV.ROAD / 2 + 4;
      p.y = s.y + 60;
      p.angle = Math.PI / 3;
      this.scatterCrowd(game, s.x, s.y, 8);
      game.cash = 2450;
      CV.Missions.marker = { x: game.landmarks.cafe.x, y: game.landmarks.cafe.y, label: 'Cafe' };
      return;
    }

    if (name === 'chase') {
      // Three-star pursuit on a long east-west avenue at golden hour.
      game.dayT = 0.80;
      var road = CV.Traffic.nodePos(1, 3);
      var car = CV.makeCar(rng, road.x + 120, road.y + CV.ROAD / 4, 0, { type: 2, color: '#e74c3c' });
      car.driver = 'player';
      car.parked = false;
      car.speed = 215;
      CV.Traffic.cars.push(car);
      p.mode = 'car';
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      // Two police cars right behind.
      for (var i = 0; i < 2; i++) {
        var pc = CV.makeCar(rng, car.x - 95 - i * 62, road.y + CV.ROAD / 4 + (i ? 9 : -5), 0, {
          type: 1, color: '#f5f6fa', driver: 'police'
        });
        pc.parked = false;
        pc.driver = 'police';
        pc.police = true;
        pc.speed = 205;
        pc.siren = i * 2.2;
        CV.Traffic.cars.push(pc);
        CV.Police.units.push({ kind: 'car', car: pc, dead: false, deadT: 0, stuckT: 0 });
      }
      game.crimePoints = CV.STAR_POINTS * 3;
      game.stars = 3;
      game.cash = 5110;
      return;
    }

    if (name === 'mission') {
      // A collector confrontation: Mari aims, marker on the motel.
      game.dayT = 0.55;
      var m = CV.Traffic.nodePos(5, 3);
      p.x = m.x - 70;
      p.y = m.y + 30;
      var thug = CV.Pedestrians.spawn(rng, CV.World, { x: m.x + 26, y: m.y + 22 });
      thug.special = 'thug';
      thug.hostile = true;
      thug.color = '#2c3e50';
      thug.hp = 60;
      thug.x = m.x + 30;
      thug.y = m.y + 24;
      thug.angle = Math.PI;
      CV.Pedestrians.list.push(thug);
      p.angle = Math.atan2(thug.y - p.y, thug.x - p.x);
      this.scatterCrowd(game, m.x, m.y, 4);
      game.cash = 3320;
      game.crimePoints = CV.STAR_POINTS;
      game.stars = 1;
      CV.Missions.marker = { x: game.landmarks.motel.x, y: game.landmarks.motel.y, label: 'Motel drop' };
      return;
    }
  },

  scatterCrowd: function (game, x, y, n) {
    for (var i = 0; i < n; i++) {
      var ped = CV.Pedestrians.spawn(game.rng, CV.World, { x: x, y: y });
      ped.x = CV.clamp(x + game.rng.range(-120, 120), 12, CV.WORLD_W - 12);
      ped.y = CV.clamp(y + game.rng.range(-90, 90), 12, CV.WORLD_H - 12);
      if (CV.World.pointInBuilding(ped.x, ped.y, 4)) {
        ped.x = x;
        ped.y = y + 20 + i * 6;
      }
      CV.Pedestrians.list.push(ped);
    }
  }
};

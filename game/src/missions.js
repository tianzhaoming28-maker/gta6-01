// Coral Vice - missions and the story arc.
// Mari Vega owes money to the Flamingo Syndicate. Her fixer, Tia
// Carmen, feeds her jobs from a beachfront cafe: errands, thefts,
// chases and one very bad night. After the story, Carmen keeps
// offering repeatable cash errands.
'use strict';

CV.Missions = {
  index: 0,
  storyDone: false,
  active: null,       // runtime state of the current mission
  state: 'offer',     // offer | active | done-wait
  waitT: 0,
  marker: null,       // {x, y, label} for HUD + minimap

  // ---- Story definitions -------------------------------------------------
  // Each mission: intro text, a setup(game) that may place things in
  // the world, and a check(game) returning 'done', 'fail' or null.
  story: [
    {
      id: 'meet-carmen',
      title: 'Welcome to Coral Bay',
      giver: 'Tia Carmen',
      intro: 'Carmen: "Mari! You owe the Syndicate nine grand. Start paying: meet me at the beach cafe, east side."',
      reward: 150,
      type: 'goto',
      target: function (game) { return game.landmarks.cafe; },
      objective: 'Go to the beach cafe and meet Tia Carmen'
    },
    {
      id: 'first-wheels',
      title: 'Borrowed Wheels',
      giver: 'Tia Carmen',
      intro: 'Carmen: "A coupe on Flamingo Row has something of mine in the trunk. Take it. Bring it to my garage."',
      reward: 400,
      type: 'steal-deliver',
      objective: 'Steal the marked coupe and deliver it to the garage'
    },
    {
      id: 'package-run',
      title: 'Hot Package',
      giver: 'Tia Carmen',
      intro: 'Carmen: "Pick up the package at the marina. Drop it at the Neon Mile motel. Fast, querida, fast."',
      reward: 550,
      type: 'pickup-deliver',
      timeLimit: 110,
      objective: 'Pick up the package, then deliver it before the timer runs out'
    },
    {
      id: 'cash-drops',
      title: 'Loose Change',
      giver: 'Tia Carmen',
      intro: 'Carmen: "A courier of mine scattered three cash drops across the bay. Grab them all before someone else does."',
      reward: 650,
      type: 'collect',
      count: 3,
      objective: 'Collect all 3 cash drops'
    },
    {
      id: 'debtor',
      title: 'The Debtor',
      giver: 'Tia Carmen',
      intro: 'Carmen: "A bookie named Sal owes us. He runs. Catch him and take the envelope - any way you like."',
      reward: 700,
      type: 'catch',
      objective: 'Catch Sal the bookie and take the envelope'
    },
    {
      id: 'heat',
      title: 'Shake the Heat',
      giver: 'Tia Carmen',
      intro: 'Carmen: "The Syndicate set you up - the police are coming. Get their attention, then lose them."',
      reward: 800,
      type: 'escape',
      objective: 'Reach 2 wanted stars, then lose the police completely'
    },
    {
      id: 'bad-night',
      title: 'One Bad Night',
      giver: 'Tia Carmen',
      intro: 'Carmen: "Three Syndicate collectors are coming for you tonight. End it, Mari. All three."',
      reward: 1500,
      type: 'takedowns',
      objective: 'Take down the three Syndicate collectors'
    },
    {
      id: 'final-drive',
      title: 'The Final Drive',
      giver: 'Tia Carmen',
      intro: 'Carmen: "One last drive: take the roadster to the ferry pier and your debt is ash. Go."',
      reward: 2000,
      type: 'steal-deliver',
      objective: 'Steal the marked roadster and reach the ferry pier'
    }
  ],

  init: function (game, startIndex, storyDone) {
    this.index = startIndex || 0;
    this.storyDone = !!storyDone;
    this.active = null;
    this.state = 'offer';
    this.waitT = 1.2;
    this.marker = null;
    if (this.storyDone) this.offerErrand(game);
    else this.offerCurrent(game);
  },

  current: function () {
    if (this.storyDone) return null;
    return this.story[this.index] || null;
  },

  offerCurrent: function (game) {
    var m = this.current();
    if (!m) {
      this.storyDone = true;
      this.offerErrand(game);
      return;
    }
    this.state = 'offer';
    this.waitT = 2.0;
    game.showBanner(m.title, m.intro, 6);
    this.setupMission(game, m);
  },

  setupMission: function (game, m) {
    var rng = game.rng;
    this.active = { def: m, phase: 0, t: 0, timeLeft: m.timeLimit || 0, sub: {} };
    var lm = game.landmarks;
    if (m.type === 'goto') {
      var t = m.target(game);
      this.marker = { x: t.x, y: t.y, label: m.giver };
    } else if (m.type === 'steal-deliver') {
      // Spawn the target car parked a few blocks away, marked.
      var spot = this.findSpot(game, 380, 620);
      var carType = m.id === 'final-drive' ? 5 : 2;
      var car = CV.makeCar(rng, spot.x, spot.y, rng.range(0, Math.PI * 2), { type: carType });
      car.parked = true;
      car.missionCar = true;
      CV.Traffic.cars.push(car);
      this.active.sub.car = car;
      this.marker = { x: car.x, y: car.y, label: 'Target car' };
    } else if (m.type === 'pickup-deliver') {
      this.marker = { x: lm.marina.x, y: lm.marina.y, label: 'Package' };
    } else if (m.type === 'collect') {
      var drops = [];
      var usedKeys = {};
      for (var di2 = 0; di2 < (m.count || 3); di2++) {
        var ds = this.findSpot(game, 260 + di2 * 130, 560 + di2 * 160);
        var key = Math.round(ds.x) + ',' + Math.round(ds.y);
        if (usedKeys[key]) ds = this.findSpot(game, 200, 900);
        usedKeys[key] = true;
        drops.push({ x: ds.x, y: ds.y, taken: false, kind: 'cash' });
      }
      this.active.sub.drops = drops;
      game.pickups = drops;
      this.marker = { x: drops[0].x, y: drops[0].y, label: 'Cash drop' };
    } else if (m.type === 'catch') {
      var spot2 = this.findSpot(game, 300, 480);
      var ped = CV.Pedestrians.spawn(rng, CV.World, spot2);
      ped.special = 'target';
      ped.name = 'Sal';
      ped.color = '#f39c12';
      ped.hp = 40;
      ped.speed = 96;
      CV.Pedestrians.list.push(ped);
      this.active.sub.ped = ped;
      this.marker = { x: ped.x, y: ped.y, label: 'Sal' };
    } else if (m.type === 'escape') {
      this.marker = null;
      this.active.sub.reachedHeat = false;
    } else if (m.type === 'takedowns') {
      this.active.sub.thugs = [];
      for (var i = 0; i < 3; i++) {
        var s = this.findSpot(game, 240 + i * 90, 420 + i * 90);
        var thug = CV.Pedestrians.spawn(rng, CV.World, s);
        thug.special = 'thug';
        thug.name = 'Collector';
        thug.color = '#2c3e50';
        thug.hp = 60;
        thug.hostile = true;
        thug.fireCd = rng.range(0.5, 1.4);
        CV.Pedestrians.list.push(thug);
        this.active.sub.thugs.push(thug);
      }
      this.marker = null;
    }
  },

  // A sidewalk-ish spot at a ring distance from the player.
  findSpot: function (game, minD, maxD) {
    var rng = game.rng;
    var p = game.player;
    for (var i = 0; i < 14; i++) {
      var spot = rng.pick(CV.World.spawnPoints);
      var d = CV.dist(p.x, p.y, spot.x, spot.y);
      if (d >= minD && d <= maxD) return spot;
    }
    return rng.pick(CV.World.spawnPoints);
  },

  update: function (dt, game) {
    if (this.state === 'offer') {
      this.waitT -= dt;
      if (this.waitT <= 0) this.state = 'active';
      return;
    }
    if (this.state !== 'active' || !this.active) return;
    var m = this.active.def;
    this.active.t += dt;
    var result = this.check(game, m);
    if (result === 'done') this.complete(game, m);
    else if (result === 'fail') this.fail(game, m);
  },

  check: function (game, m) {
    var a = this.active;
    var p = game.player;
    var lm = game.landmarks;

    if (m.type === 'goto') {
      var t = m.target(game);
      if (CV.dist(p.x, p.y, t.x, t.y) < 34) return 'done';
    }

    if (m.type === 'steal-deliver') {
      var car = a.sub.car;
      if (!car) return 'fail';
      if (a.phase === 0) {
        this.marker = { x: car.x, y: car.y, label: 'Target car' };
        if (p.mode === 'car' && p.car === car) {
          a.phase = 1;
          var dest = m.id === 'final-drive' ? lm.pier : lm.garage;
          game.showBanner('Got it', m.id === 'final-drive' ? 'Now drive to the ferry pier!' : 'Now bring it to Carmen\'s garage.', 4);
        }
      } else {
        var dest2 = m.id === 'final-drive' ? lm.pier : lm.garage;
        this.marker = { x: dest2.x, y: dest2.y, label: m.id === 'final-drive' ? 'Ferry pier' : 'Garage' };
        if (p.mode === 'car' && p.car === car &&
            CV.dist(car.x, car.y, dest2.x, dest2.y) < 46) {
          return 'done';
        }
        if (car.hp <= 0) return 'fail';
      }
    }

    if (m.type === 'pickup-deliver') {
      if (a.timeLeft > 0) {
        a.timeLeft -= CV.TICK;
        if (a.timeLeft <= 0) return 'fail';
      }
      if (a.phase === 0) {
        this.marker = { x: lm.marina.x, y: lm.marina.y, label: 'Package' };
        if (CV.dist(p.x, p.y, lm.marina.x, lm.marina.y) < 32) {
          a.phase = 1;
          game.showBanner('Package picked up', 'Deliver it to the Neon Mile motel - hurry!', 4);
          CV.Audio.cash();
        }
      } else {
        this.marker = { x: lm.motel.x, y: lm.motel.y, label: 'Motel drop' };
        if (CV.dist(p.x, p.y, lm.motel.x, lm.motel.y) < 36) return 'done';
      }
    }

    if (m.type === 'collect') {
      var drops2 = a.sub.drops || [];
      var leftDrops = 0;
      var nearestDrop = null;
      var nd2 = 1e9;
      for (var di = 0; di < drops2.length; di++) {
        var dr = drops2[di];
        if (dr.taken) continue;
        var dd2 = CV.dist(p.x, p.y, dr.x, dr.y);
        if (dd2 < 28) {
          dr.taken = true;
          game.cash += 50;
          game.stats.earned += 50;
          CV.Audio.pickup();
          game.showToast('Cash drop collected (+$50)');
        } else {
          leftDrops++;
          if (dd2 < nd2) { nd2 = dd2; nearestDrop = dr; }
        }
      }
      a.sub.left = leftDrops;
      this.marker = nearestDrop ? { x: nearestDrop.x, y: nearestDrop.y, label: 'Cash drop' } : null;
      if (leftDrops === 0) return 'done';
    }

    if (m.type === 'catch') {
      var ped = a.sub.ped;
      if (!ped) return 'done';
      this.marker = { x: ped.x, y: ped.y, label: 'Sal' };
      // Sal flees the player.
      if (ped.state !== 'down') {
        var d = CV.dist(ped.x, ped.y, p.x, p.y);
        if (d < 190) {
          ped.state = 'flee';
          ped.fleeT = 0.4;
          ped.panicX = p.x;
          ped.panicY = p.y;
        }
        if (d < 20) return 'done'; // grabbed him
      } else {
        return 'done'; // knocked down also works
      }
      if (CV.Pedestrians.list.indexOf(ped) < 0) return 'done';
    }

    if (m.type === 'escape') {
      if (!a.sub.reachedHeat) {
        if (game.stars >= 2) {
          a.sub.reachedHeat = true;
          game.showBanner('Heat is on', 'Now lose them: break line of sight and stay clean.', 4);
        }
      } else if (game.stars === 0 && game.crimePoints <= 0.5) {
        return 'done';
      }
    }

    if (m.type === 'takedowns') {
      var left = 0;
      var nearest = null;
      var nd = 1e9;
      for (var i = 0; i < a.sub.thugs.length; i++) {
        var th = a.sub.thugs[i];
        if (th.state !== 'down') {
          left++;
          var dd = CV.dist(p.x, p.y, th.x, th.y);
          if (dd < nd) { nd = dd; nearest = th; }
        }
      }
      this.marker = nearest ? { x: nearest.x, y: nearest.y, label: 'Collector' } : null;
      a.sub.left = left;
      if (left === 0) return 'done';
    }

    return null;
  },

  complete: function (game, m) {
    game.pickups = [];
    game.cash += m.reward;
    game.stats.earned += m.reward;
    CV.Audio.missionDone();
    game.showBanner('Mission complete', m.title + '  +$' + m.reward, 5);
    this.marker = null;
    this.active = null;
    if (!this.storyDone && m === this.current()) {
      this.index++;
      if (this.index >= this.story.length) {
        this.storyDone = true;
        game.showBanner('Debt cleared', 'Mari is free of the Syndicate. Carmen still has cash errands.', 6);
        this.offerErrand(game);
      } else {
        this.offerCurrent(game);
      }
    } else {
      this.offerErrand(game);
    }
    CV.Save.write(game);
  },

  fail: function (game, m) {
    game.pickups = [];
    CV.Audio.missionFail();
    game.showBanner('Mission failed', m.title + ' - Carmen will set it up again.', 5);
    // Clean up mission props.
    if (this.active && this.active.sub.car) {
      this.active.sub.car.missionCar = false;
    }
    this.marker = null;
    this.active = null;
    if (!this.storyDone && m === this.current()) this.offerCurrent(game);
    else this.offerErrand(game);
  },

  // ---- Repeatable errands after (and between) story beats -----------------
  offerErrand: function (game) {
    var rng = game.rng;
    var reward = 120 + Math.floor(rng.range(0, 5)) * 40;
    var m;
    if (rng.chance(0.4)) {
      // Variant: fetch a single cash drop somewhere across the bay.
      m = {
        id: 'errand',
        title: 'Cash Errand',
        giver: 'Tia Carmen',
        intro: 'Carmen: "Small job, quick money. Details on your map."',
        reward: reward,
        type: 'collect',
        count: 1,
        objective: 'Errand: grab the cash drop for $' + reward
      };
      this.state = 'offer';
      this.waitT = 2.0;
      this.setupMission(game, m);
      game.showBanner('Cash Errand', 'Grab the marked cash drop for $' + reward + '.', 4);
      return;
    }
    var spot = this.findSpot(game, 420, 900);
    m = {
      id: 'errand',
      title: 'Cash Errand',
      giver: 'Tia Carmen',
      intro: 'Carmen: "Small job, quick money. Details on your map."',
      reward: reward,
      type: 'goto',
      target: function () { return spot; },
      objective: 'Errand: reach the marked spot for $' + reward
    };
    this.state = 'offer';
    this.waitT = 2.0;
    this.setupMission(game, m);
    game.showBanner('Cash Errand', 'Reach the marked spot for $' + reward + '.', 4);
  },

  objectiveText: function (game) {
    if (!this.active) return '';
    var m = this.active.def;
    var text = m.objective;
    if (m.type === 'pickup-deliver' && this.active.timeLeft > 0) {
      text += '  (' + Math.ceil(this.active.timeLeft) + 's)';
    }
    if (m.type === 'takedowns' && this.active.sub.left !== undefined) {
      text += '  (' + this.active.sub.left + ' left)';
    }
    if (m.type === 'collect' && this.active.sub.left !== undefined) {
      text = 'Collect the cash drops  (' + this.active.sub.left + ' left)';
    }
    if (m.type === 'escape' && this.active && !this.active.sub.reachedHeat) {
      text = 'Cause trouble: reach 2 wanted stars';
    }
    return text;
  }
};

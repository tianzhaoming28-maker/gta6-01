// Coral Vice - save / continue via localStorage.
// Stores progress only (cash, story position, stats, player start);
// the world itself is regenerated from the same seed every load.
'use strict';

CV.Save = {
  available: function () {
    try {
      var k = CV.SAVE_KEY + '-probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  },

  has: function () {
    try {
      return !!window.localStorage.getItem(CV.SAVE_KEY);
    } catch (e) {
      return false;
    }
  },

  write: function (game) {
    if (!this.available()) return false;
    var data = {
      v: 1,
      cash: game.cash,
      missionIndex: CV.Missions.index,
      storyDone: CV.Missions.storyDone,
      totalEarned: game.stats.earned,
      carsStolen: game.stats.stolen,
      shotsFired: game.stats.shots,
      timePlayed: game.stats.time,
      playerX: Math.round(game.player.x),
      playerY: Math.round(game.player.y),
      seed: game.seed
    };
    try {
      window.localStorage.setItem(CV.SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },

  read: function () {
    try {
      var raw = window.localStorage.getItem(CV.SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  clear: function () {
    try {
      window.localStorage.removeItem(CV.SAVE_KEY);
    } catch (e) {
      // storage unavailable; nothing to clear
    }
  }
};

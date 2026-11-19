// Coral Vice - keyboard and mouse input.
// A flat state object polled by the simulation each tick, plus edge
// triggers ("pressed this frame") for one-shot actions like entering
// a car or punching.
'use strict';

CV.Input = {
  keys: {},
  pressed: {},
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  mouseClicked: false,
  wheel: 0,
  attached: false,

  attach: function (canvas) {
    if (this.attached) return;
    this.attached = true;
    var self = this;

    window.addEventListener('keydown', function (e) {
      var code = e.code;
      if (!self.keys[code]) self.pressed[code] = true;
      self.keys[code] = true;
      // Keep the page from scrolling on game keys.
      if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' ||
          code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Tab') {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
    });

    window.addEventListener('blur', function () {
      self.keys = {};
      self.mouseDown = false;
    });

    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      // Scale from CSS pixels to the canvas coordinate system.
      self.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      self.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });

    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) {
        self.mouseDown = true;
        self.mouseClicked = true;
      }
    });

    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.mouseDown = false;
    });

    canvas.addEventListener('wheel', function (e) {
      self.wheel += Math.sign(e.deltaY);
    }, { passive: true });

    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  },

  // Called at the end of each simulation tick.
  postTick: function () {
    this.pressed = {};
    this.mouseClicked = false;
    this.wheel = 0;
  },

  down: function (code) {
    return !!this.keys[code];
  },

  hit: function (code) {
    return !!this.pressed[code];
  },

  // Movement axes from WASD or arrow keys: x in [-1,1], y in [-1,1].
  moveAxis: function () {
    var x = 0;
    var y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    return { x: x, y: y };
  }
};

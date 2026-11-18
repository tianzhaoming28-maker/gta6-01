// input.js — keyboard and mouse state. Everything polls this object;
// listeners only record, they never act, so menus and driving share one source.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),       // keys that went down this frame
    mouseX: 0, mouseY: 0,
    mouseDown: false,
    mouseClicked: false,      // left button went down this frame
    clicks: [],               // canvas-space click points this frame
    anyGesture: false,        // first interaction, used to unlock audio
  };

  const down = (e) => {
    input.anyGesture = true;
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => { input.keys.delete(e.code); };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    input.anyGesture = true;
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
      const r = canvas.getBoundingClientRect();
      input.clicks.push({
        x: (e.clientX - r.left) * (canvas.width / r.width),
        y: (e.clientY - r.top) * (canvas.height / r.height),
      });
    }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });

  input.endFrame = () => {
    input.pressed.clear();
    input.mouseClicked = false;
    input.clicks.length = 0;
  };
  input.down = (code) => input.keys.has(code);
  input.hit = (code) => input.pressed.has(code);
  input.moveX = () => (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
  input.moveY = () => (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0) - (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0);
  return input;
}

// input.js — keyboard and mouse. One clear job: turn keys and clicks
// into the plain input object the world steps each frame. The world
// never reads the DOM itself.

import { HUD_H } from './config.js';

export function makeInput() {
  return {
    mx: 0, // -1..1 movement x (playfield space)
    my: 0, // -1..1 movement y
    sneak: false,
    confirm: false, // Space / Enter — advance screens, start the job
    smoke: false, // key 2
    emp: false, // key 3
    interact: false, // E held — crack the vault
    coinAt: null, // {x, y} in playfield space — click to toss a coin
    mouseX: 0,
    mouseY: 0,
    paused: false,
    muteToggle: false,
    keys: new Set(),
  };
}

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function attachInput(input, canvas, hooks) {
  function recomputeMove() {
    let x = 0;
    let y = 0;
    for (const code of input.keys) {
      const v = MOVE_KEYS[code];
      if (v) {
        x += v[0];
        y += v[1];
      }
    }
    input.mx = x;
    input.my = y;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    input.keys.add(e.code);
    if (MOVE_KEYS[e.code]) recomputeMove();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sneak = true;
    if (e.code === 'Space' || e.code === 'Enter') input.confirm = true;
    if (e.code === 'KeyE') input.interact = true;
    if (e.code === 'Digit2') input.smoke = true;
    if (e.code === 'Digit3') input.emp = true;
    if (e.code === 'KeyP') {
      input.paused = !input.paused;
      if (hooks && hooks.onPause) hooks.onPause(input.paused);
    }
    if (e.code === 'KeyM') input.muteToggle = true;
    if (hooks && hooks.onKey) hooks.onKey(e.code);
  });

  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    if (MOVE_KEYS[e.code]) recomputeMove();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      input.sneak = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    }
    if (e.code === 'KeyE') input.interact = false;
  });

  // Losing the window must never leave a key stuck down.
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mx = 0;
    input.my = 0;
    input.sneak = false;
    input.interact = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top - HUD_H; // into playfield space
    input.coinAt = { x, y };
    if (hooks && hooks.onClick) hooks.onClick(x, y);
  });
}

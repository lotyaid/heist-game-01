// main.js — the game's front door. One clear job: boot the canvas,
// run the frame loop, wire input to the world, and honour ?shot= for
// deterministic screenshots. Nothing here knows how a guard thinks.

import { VIEW_W, VIEW_H, SEED_DEFAULT } from './config.js';
import { makeWorld, updateWorld } from './world.js';
import { makeInput, attachInput } from './input.js';
import { render } from './render.js';
import { applyShot } from './shots.js';
import { ensureAudio, setMuted, startDrone, playStep } from './audio.js';
import { levelById } from './levels.js';
import { makeGuard } from './guards.js';
import { makeCamera, makeLaser, makeTripwire } from './security.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || SEED_DEFAULT);

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const input = makeInput();
let world;

if (shotName) {
  // Screenshot mode: a frozen, staged frame — no loop stepping, no input.
  world = applyShot(shotName, seed);
  render(ctx, world);
} else {
  world = makeWorld(seed);
  // A living title backdrop: level 1's room, guards walking their beats.
  const level = levelById(1);
  world.level = level;
  world.guards = level.guards.map((g) => makeGuard(g, 1));
  world.cameras = level.cameras.map((c) => makeCamera(c));
  world.lasers = level.lasers.map((l) => makeLaser(l));
  world.tripwires = level.tripwires.map((t) => makeTripwire(t));
  world.loot = level.loot.map((l) => ({ ...l, taken: false, locked: false }));
  world.lootTotal = world.loot.length;

  attachInput(input, canvas, {
    onPause: (paused) => {
      document.getElementById('paused').style.display = paused ? 'block' : 'none';
    },
    onKey: (code) => {
      if (world.phase === 'planning') {
        if (code === 'Digit1') world.plan.entryIndex = 0;
        if (code === 'Digit2' && world.level.entries.length > 1) world.plan.entryIndex = 1;
        if (code === 'Digit3' && world.level.entries.length > 2) world.plan.entryIndex = 2;
        if (code === 'KeyC') toggleLoadout('coin');
        if (code === 'KeyS') toggleLoadout('smoke');
        if (code === 'KeyE') toggleLoadout('emp');
      }
    },
    onClick: (x, y) => {
      if (world.phase === 'planning') {
        // Clicking a door or the board picks it.
        const level = world.level;
        level.entries.forEach((e, i) => {
          const ex = (e.tx + 0.5) * 32;
          const ey = (e.ty + 0.5) * 32;
          if (Math.hypot(x - ex, y - ey) < 26) world.plan.entryIndex = i;
        });
      }
    },
  });

  function toggleLoadout(kind) {
    const plan = world.plan;
    if (!plan) return;
    const i = plan.loadout.indexOf(kind);
    if (i >= 0) {
      if (plan.loadout.length > 1) plan.loadout.splice(i, 1);
    } else if (plan.loadout.length < 2) {
      plan.loadout.push(kind);
    } else {
      plan.loadout[0] = kind;
    }
  }

  let last = performance.now();
  let stepTimer = 0;
  function frame(nowMs) {
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    if (!input.paused) {
      updateWorld(world, input, dt);
      if (input.muteToggle) {
        input.muteToggle = false;
        world.muted = !world.muted;
        setMuted(world.muted);
      }
      // Footstep ticks while walking — best-effort, silence never breaks play.
      if (world.player && world.player.moving) {
        stepTimer += dt;
        if (stepTimer > (world.player.sneaking ? 0.55 : 0.34)) {
          stepTimer = 0;
          try {
            ensureAudio();
            playStep(world.player.sneaking);
          } catch (e) { /* no audio in this browser */ }
        }
      }
    }
    render(ctx, world);
    requestAnimationFrame(frame);
  }

  document.addEventListener('pointerdown', () => {
    try {
      ensureAudio();
      startDrone();
    } catch (e) { /* no audio in this browser */ }
  }, { once: true });

  requestAnimationFrame(frame);
}

// Expose the world for playtests and debugging (read-only use).
window.__halcyon = { get world() { return world; }, get input() { return input; } };

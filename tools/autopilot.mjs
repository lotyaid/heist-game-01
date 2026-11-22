// autopilot.mjs — headless playtest in Node (no browser, no DOM).
// Drives a level with a cautious BFS walker: follow the shortest path to
// the nearest loot, flee the moment a cone finds it, never step into a
// lit cone or a live laser, and hold E at the vault until it cracks.
// Reports whether the level clears and the score it banks. A level no
// cautious walker can clear is a broken level.

import { TILE } from '../game/src/config.js';
import { LEVELS, solidAt } from '../game/src/levels.js';
import { makeWorld, startPlanning, startLevel, updateWorld } from '../game/src/world.js';
import { inCone } from '../game/src/vision.js';
import { laserIsLive } from '../game/src/security.js';
import { CONE_HALF_ANGLE, GUARD_SIGHT_RANGE } from '../game/src/config.js';

const levelIndex = Number(process.argv[2] || 0);
const level = LEVELS[levelIndex];

function bfs(sx, sy, tx, ty) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map([[key(sx, sy), null]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) break;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= 40 || ny >= 20) continue;
      if (prev.has(key(nx, ny))) continue;
      if (solidAt(level, nx, ny)) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let cur = [tx, ty];
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path;
}

function nodeIsWatched(world, tx, ty) {
  const px = (tx + 0.5) * TILE;
  const py = (ty + 0.5) * TILE;
  for (const g of world.guards) {
    if (inCone(world.level, g.x, g.y, g.angle, CONE_HALF_ANGLE, GUARD_SIGHT_RANGE, px, py)) return true;
  }
  // A live laser on the next tile is a watched tile too — wait for the blink.
  for (const laser of world.lasers) {
    if (!laserIsLive(laser, world.now)) continue;
    const dx = laser.x2 - laser.x1;
    const dy = laser.y2 - laser.y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - laser.x1) * dx + (py - laser.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(px - (laser.x1 + t * dx), py - (laser.y1 + t * dy)) < 26) return true;
  }
  return false;
}

function playerIsWatched(world) {
  const p = world.player;
  for (const g of world.guards) {
    if (inCone(world.level, g.x, g.y, g.angle, CONE_HALF_ANGLE, GUARD_SIGHT_RANGE, p.x, p.y)) return g;
  }
  return null;
}

// Flee: step to the neighbouring tile that gets farthest from the
// threatening guard without walking into another cone.
function fleeStep(world, threat) {
  const p = world.player;
  const px = Math.floor(p.x / TILE);
  const py = Math.floor(p.y / TILE);
  let best = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = px + dx;
    const ny = py + dy;
    if (nx < 0 || ny < 0 || nx >= 40 || ny >= 20) continue;
    if (solidAt(level, nx, ny)) continue;
    if (nodeIsWatched(world, nx, ny)) continue;
    const cx = (nx + 0.5) * TILE;
    const cy = (ny + 0.5) * TILE;
    const d = Math.hypot(cx - threat.x, cy - threat.y);
    if (!best || d > best.d) best = { dx, dy, d };
  }
  return best;
}

const world = makeWorld(7);
startPlanning(world, levelIndex);
startLevel(world);

const input = {
  mx: 0, my: 0, sneak: false, confirm: false, smoke: false, emp: false,
  interact: false, coinAt: null, paused: false, muteToggle: false, keys: new Set(),
};

const DT = 1 / 60;
let simTime = 0;
let target = null;
let path = [];
let waits = 0;

function pickTarget() {
  const p = world.player;
  const px = Math.floor(p.x / TILE);
  const py = Math.floor(p.y / TILE);
  if (world.lootGot < world.lootTotal) {
    let best = null;
    for (const item of world.loot) {
      if (item.taken || item.locked) continue; // the core waits for the crack
      const route = bfs(px, py, item.tx, item.ty);
      if (route && (!best || route.length < best.route.length)) best = { route, item };
    }
    target = best ? best.route : null;
  } else {
    target = bfs(px, py, world.level.exit.tx, world.level.exit.ty);
  }
  path = target ? target.slice(1) : [];
}

pickTarget();

const DEBUG = !!process.env.DEBUG_AUTOPILOT;
let tick = 0;
while (simTime < 240 && world.phase === 'playing') {
  tick += 1;
  const p = world.player;
  const px = Math.floor(p.x / TILE);
  const py = Math.floor(p.y / TILE);
  const threat = world.guards.reduce((a, g) => (g.detect > a.detect ? g : a), world.guards[0]);
  const watchedBy = playerIsWatched(world);
  if (DEBUG && tick % 120 === 0) {
    console.log(`t=${Math.round(simTime)}s px=${Math.round(p.x)} py=${Math.round(p.y)} distToVault=${Math.round(Math.hypot(p.x - 656, p.y - 80))} interact=${input.interact} vaultProg=${p.vaultProgress.toFixed(2)}`);
  }
  let mx = 0;
  let my = 0;
  let sneak = false;

  if (threat.detect > 25 || watchedBy) {
    // Flee — never freeze inside a cone. Break line of sight first.
    const step = fleeStep(world, watchedBy || threat);
    if (step) {
      const tx = (px + step.dx + 0.5) * TILE;
      const ty = (py + step.dy + 0.5) * TILE;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        mx = dx / d;
        my = dy / d;
      }
    } else {
      sneak = true; // nowhere safe to run: go quiet and hope
    }
    waits += 1;
  } else {
    // The vault is the last job: grab the loose gold first, then crack.
    // (A human does the same — the vault is the loudest six seconds.)
    const vault = world.level.vault;
    const looseLootLeft = world.loot.some((l) => l.kind !== 'core' && !l.taken);
    if (vault && !world.vaultCracked && !looseLootLeft) {
      const vx = (vault.tx + 0.5) * TILE;
      const vy = (vault.ty + 0.5) * TILE;
      if (Math.hypot(p.x - vx, p.y - vy) < 56) {
        input.mx = 0;
        input.my = 0;
        input.sneak = false;
        input.interact = true;
        updateWorld(world, input, DT);
        simTime += DT;
        continue;
      }
      const route = bfs(px, py, vault.tx, vault.ty + 1);
      if (route) path = route.slice(1);
    }
    input.interact = false;
    if (!path.length) pickTarget();
    if (path.length) {
      const [nx, ny] = path[0];
      const cx = (nx + 0.5) * TILE;
      const cy = (ny + 0.5) * TILE;
      const dx = cx - p.x;
      const dy = cy - p.y;
      const d = Math.hypot(dx, dy);
      if (nodeIsWatched(world, nx, ny)) {
        waits += 1;
        sneak = true; // next tile is lit — wait for the cone to sweep past
      } else if (d < 6) {
        path.shift();
      } else {
        mx = dx / d;
        my = dy / d;
        sneak = d < 120; // sneak the last stretch onto the loot
      }
    }
  }
  input.mx = mx;
  input.my = my;
  input.sneak = sneak;
  updateWorld(world, input, DT);
  simTime += DT;
}

console.log(JSON.stringify({
  ok: world.phase === 'levelclear',
  phase: world.phase,
  score: world.score,
  loot: `${world.lootGot}/${world.lootTotal}`,
  alarm: Math.round(world.alarm),
  strikes: world.strikes,
  simSeconds: Math.round(simTime),
  waits,
  levelTime: Math.round(world.levelTime),
  clearStats: world.clearStats || null,
}, null, 1));
process.exit(world.phase === 'levelclear' ? 0 : 1);

// player.js — Vesper, the thief. One clear job: move on the keys, collide
// with the room, sneak, and spend gadgets. The player never touches the
// alarm or the score directly — the world does that.

import {
  TILE,
  PLAYER_WALK_SPEED,
  PLAYER_SNEAK_SPEED,
  PLAYER_RADIUS,
  COIN_NOISE_RADIUS,
  COIN_LAND_SECONDS,
  SMOKE_RADIUS,
  SMOKE_DURATION,
  EMP_DURATION,
  GADGETS,
} from './config.js';
import { solidAt } from './levels.js';

export function makePlayer(entry) {
  return {
    x: (entry.tx + 0.5) * TILE,
    y: (entry.ty + 0.5) * TILE,
    angle: -Math.PI / 2,
    sneaking: false,
    moving: false,
    // Gadget counts are set by the planning loadout; defaults are the
    // no-planning fallback (used by screenshots and tests).
    gadgets: { coin: GADGETS.coin.uses, smoke: GADGETS.smoke.uses, emp: GADGETS.emp.uses },
    coins: [], // live thrown coins: {x, y, vx, vy, rest}
    smokes: [], // live smoke puffs: {x, y, until}
    noiseX: 0,
    noiseY: 0,
    noiseUntil: 0,
    vaultProgress: 0, // 0..1 while cracking the vault
  };
}

function collides(level, x, y) {
  const r = PLAYER_RADIUS - 1;
  for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
    if (solidAt(level, Math.floor(cx / TILE), Math.floor(cy / TILE))) return true;
  }
  return false;
}

// Move with axis-separated collision so the thief slides along walls.
export function movePlayer(level, p, dx, dy, dt, now) {
  const speed = p.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (!len) return;
  const nx = (dx / len) * speed * dt;
  const ny = (dy / len) * speed * dt;
  if (!collides(level, p.x + nx, p.y)) p.x += nx;
  if (!collides(level, p.x, p.y + ny)) p.y += ny;
  p.angle = Math.atan2(dy, dx);
  p.vaultProgress = 0; // moving breaks a vault crack
}

// Toss a coin toward (tx, ty): it lands, clinks, and guards come to look.
export function throwCoin(p, tx, ty, now) {
  if (p.gadgets.coin <= 0) return false;
  p.gadgets.coin -= 1;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.max(24, Math.hypot(dx, dy));
  const dist = Math.min(d, 260);
  const lx = p.x + (dx / d) * dist;
  const ly = p.y + (dy / d) * dist;
  p.coins.push({ x: lx, y: ly, rest: false, until: now + COIN_LAND_SECONDS });
  p.noiseX = lx;
  p.noiseY = ly;
  p.noiseUntil = now + 1.2;
  return true;
}

// Drop a smoke pellet at the player's feet.
export function dropSmoke(p, now) {
  if (p.gadgets.smoke <= 0) return false;
  p.gadgets.smoke -= 1;
  p.smokes.push({ x: p.x, y: p.y, until: now + SMOKE_DURATION });
  return true;
}

// Fire the EMP: cameras and lasers die for EMP_DURATION seconds.
export function fireEmp(p, world, now) {
  if (p.gadgets.emp <= 0) return false;
  p.gadgets.emp -= 1;
  for (const cam of world.cameras) cam.disabledUntil = now + EMP_DURATION;
  for (const laser of world.lasers) laser.disabledUntil = now + EMP_DURATION;
  return true;
}

// Settle thrown coins: once one lands it stays where it fell, clinking.
export function updateCoins(p, now) {
  for (const c of p.coins) {
    if (!c.rest && now >= c.until) c.rest = true;
  }
}

// Is the player standing inside any live smoke puff?
export function playerInSmoke(p, now) {
  p.smokes = p.smokes.filter((s) => now < s.until);
  for (const s of p.smokes) {
    if (Math.hypot(p.x - s.x, p.y - s.y) < SMOKE_RADIUS) return true;
  }
  return false;
}

export { COIN_NOISE_RADIUS, SMOKE_RADIUS };

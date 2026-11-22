// shots.js — deterministic screenshot states. One clear job: put the
// game into a fixed, staged frame for each screenshot the entry ships,
// at a fixed clock, so a re-shoot renders byte-identical pixels.
//
// The cover must show the whole heist at once: the thief crossing the
// room, guard cones, a camera, a loot target and the alarm meter.

import { TILE } from './config.js';
import { makeWorld, startPlanning, startLevel } from './world.js';
import { makeGuard } from './guards.js';

export const SHOT_NOW = 12.5; // fixed clock: lasers live, lamps pulsing

function placeGuard(world, def, tx, ty, angle, state, detect) {
  const g = makeGuard(def, world.level.id);
  g.x = (tx + 0.5) * TILE;
  g.y = (ty + 0.5) * TILE;
  g.angle = angle;
  g.state = state;
  g.detect = detect;
  if (state === 'ALERT' || state === 'SUSPICIOUS') {
    g.lastSeenX = world.player.x;
    g.lastSeenY = world.player.y;
  }
  return g;
}

function coverShot(world) {
  // Heist 2, mid-corridor: Vesper on the carpet runner by the laser gate,
  // Marisol suspicious with her cone sweeping in, a camera overhead,
  // gold glowing in the cage, alarm at 38 — SUSPICIOUS.
  startPlanning(world, 1);
  world.plan.entryIndex = 0;
  world.plan.loadout = ['coin', 'smoke'];
  startLevel(world);
  const p = world.player;
  p.x = (18.5) * TILE;
  p.y = (7.5) * TILE;
  p.angle = Math.PI / 2;
  p.sneaking = true;
  world.alarm = 38;
  world.score = 500;
  world.lootGot = 0;
  world.levelTime = 47;
  const level = world.level;
  world.guards = [
    placeGuard(world, level.guards[0], 20, 5, Math.PI * 0.75, 'SUSPICIOUS', 62),
    placeGuard(world, level.guards[1], 30, 12, Math.PI, 'PATROL', 0),
    placeGuard(world, level.guards[2], 12, 13, -Math.PI / 2, 'PATROL', 0),
  ];
  world.cameras[0].angle = Math.PI / 2 + 0.35;
  world.cameras[1].angle = Math.PI + 0.2;
  world.now = SHOT_NOW;
}

function planShot(world) {
  // The planning board for Heist 3: patrol routes, three entry doors,
  // coin + EMP loadout picked.
  startPlanning(world, 2);
  world.plan.entryIndex = 1;
  world.plan.loadout = ['coin', 'emp'];
  world.now = SHOT_NOW;
}

function alertShot(world) {
  // Heist 3, the vault approach, gone loud: two guards on ALERT with red
  // cones, alarm at 92, Vesper slipping past the tripwire toward the vault.
  startPlanning(world, 2);
  world.plan.entryIndex = 0;
  world.plan.loadout = ['smoke', 'emp'];
  startLevel(world);
  const p = world.player;
  p.x = (20.5) * TILE;
  p.y = (8.5) * TILE;
  p.angle = -Math.PI / 2;
  p.sneaking = false;
  world.alarm = 92;
  world.score = 1600;
  world.lootGot = 2;
  world.loot[0].taken = true;
  world.loot[1].taken = true;
  world.levelTime = 96;
  world.strikes = 1;
  const level = world.level;
  // The two alert guards stand in the open centre column, cones sweeping
  // up the vault approach toward Vesper — big red cones, no wall in the way.
  world.guards = [
    placeGuard(world, level.guards[0], 18, 12, -0.95, 'ALERT', 100),
    placeGuard(world, level.guards[1], 23, 12, -2.19, 'ALERT', 100),
    placeGuard(world, level.guards[2], 20, 14, -Math.PI / 2, 'SUSPICIOUS', 70),
    placeGuard(world, level.guards[3], 10, 17, 0, 'PATROL', 0),
  ];
  world.cameras[0].angle = Math.PI / 2 - 0.3;
  world.cameras[1].angle = Math.PI / 2 + 0.3;
  world.cameras[2].angle = -Math.PI / 2;
  world.now = SHOT_NOW;
}

function clearShot(world) {
  // Heist 1 cleared clean: the panel tells the story — loot 3/3,
  // time 35s, ghost intact.
  startPlanning(world, 0);
  world.plan.entryIndex = 0;
  world.plan.loadout = ['coin', 'smoke'];
  startLevel(world);
  world.player.x = (37.5) * TILE;
  world.player.y = (18.5) * TILE;
  world.loot.forEach((l) => { l.taken = true; });
  world.lootGot = 3;
  world.score = 4150;
  world.levelTime = 35;
  world.alarm = 0;
  world.clearStats = {
    levelName: world.level.name,
    time: 35,
    timeBonus: 1870,
    loot: 3,
    lootTotal: 3,
    strikes: 0,
    score: 4150,
  };
  world.phase = 'levelclear';
  world.now = SHOT_NOW;
}

export const SHOTS = {
  cover: coverShot,
  plan: planShot,
  alert: alertShot,
  clear: clearShot,
};

// The shot names, in the order the screenshots ship (cover first).
export const SHOT_LIST = ['cover', 'plan', 'alert', 'clear'];

export function applyShot(name, seed = 7) {
  const world = makeWorld(seed);
  const fn = SHOTS[name];
  if (!fn) throw new Error(`unknown shot: ${name}`);
  fn(world);
  world.now = SHOT_NOW;
  return world;
}

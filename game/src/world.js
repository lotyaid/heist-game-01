// world.js — the heist itself. One clear job: hold the whole game state
// (phase, alarm, score, loot, strikes) and step it forward each frame.
//
// Phases: title -> planning -> playing -> levelclear -> planning ...
//          -> victory (all 3 heists) | gameover (3 strikes, or alarm blowout)
// A strike: caught by a guard, or the alarm hitting 100 three times.

import {
  TILE,
  SCORE_CHIP_CASE,
  SCORE_GOLD_BAR,
  SCORE_VAULT_CORE,
  SCORE_GHOST_BONUS,
  SCORE_TIME_BONUS_MAX,
  SCORE_CAUGHT_PENALTY,
  SCORE_ALARM_PENALTY,
  ALARM_PER_DETECT,
  ALARM_DECAY,
  ALARM_LOCKDOWN_DRAIN,
  ALARM_CAMERA_SPOT,
  ALARM_LASER_TRIP,
  ALARM_TRIPWIRE,
  MAX_STRIKES,
  PLAYER_CATCH_RADIUS,
  VAULT_CRACK_SECONDS,
  VAULT_CRACK_RADIUS,
  GADGETS,
} from './config.js';
import { LEVELS, levelById } from './levels.js';
import { makeGuard, updateGuard, raiseNearbyGuards } from './guards.js';
import { makeCamera, makeLaser, makeTripwire, updateCamera, cameraSpotsPlayer, laserTripsPlayer, tripwireTripsPlayer } from './security.js';
import { makePlayer, movePlayer, throwCoin, dropSmoke, fireEmp, playerInSmoke, updateCoins } from './player.js';
import { makePlan, planEntry, loadoutCost } from './planning.js';

export const PHASES = ['title', 'planning', 'playing', 'levelclear', 'victory', 'gameover'];

export function makeWorld(seed = 7) {
  return {
    seed,
    phase: 'title',
    levelIndex: 0,
    level: null,
    plan: null,
    player: null,
    guards: [],
    cameras: [],
    lasers: [],
    tripwires: [],
    loot: [],
    alarm: 0,
    lockdown: false,
    lockdownsSurvived: 0,
    score: 0,
    levelScoreStart: 0,
    levelTime: 0,
    totalTime: 0,
    strikes: 0,
    lootGot: 0,
    lootTotal: 0,
    ghost: true, // stays true while no lockdown and no strike this run
    vaultCracked: false,
    vaultCoreTaken: false,
    toast: '',
    toastUntil: 0,
    now: 0,
    clearStats: null,
    muted: false,
    titleTime: 0,
  };
}

export function startPlanning(world, levelIndex) {
  const level = levelById(levelIndex + 1);
  world.levelIndex = levelIndex;
  world.level = level;
  world.plan = makePlan(level);
  world.phase = 'planning';
  world.levelTime = 0;
  world.vaultCracked = false;
  world.vaultCoreTaken = false;
  world.levelScoreStart = world.score;
}

export function startLevel(world) {
  const level = world.level;
  const entry = planEntry(world.plan);
  world.player = makePlayer(entry);
  // Apply the chosen loadout: two gadgets, each at its listed uses.
  world.player.gadgets = { coin: 0, smoke: 0, emp: 0 };
  for (const kind of world.plan.loadout) {
    world.player.gadgets[kind] = GADGETS[kind].uses;
  }
  world.score -= loadoutCost(world.plan);
  world.guards = level.guards.map((g) => makeGuard(g, level.id));
  world.cameras = level.cameras.map((c) => makeCamera(c));
  world.lasers = level.lasers.map((l) => makeLaser(l));
  world.tripwires = level.tripwires.map((t) => makeTripwire(t));
  world.loot = level.loot.map((l) => ({ ...l, taken: false, locked: l.kind === 'core' }));
  world.lootTotal = world.loot.length;
  world.lootGot = 0;
  world.alarm = 0;
  world.lockdown = false;
  world.levelTime = 0;
  world.phase = 'playing';
  showToast(world, level.brief, 5);
}

export function showToast(world, text, seconds = 3) {
  world.toast = text;
  world.toastUntil = world.now + seconds;
}

function lootValue(kind) {
  if (kind === 'chip') return SCORE_CHIP_CASE;
  if (kind === 'gold') return SCORE_GOLD_BAR;
  return SCORE_VAULT_CORE;
}

function triggerLockdown(world) {
  world.lockdown = true;
  world.lockdownsSurvived += 1;
  world.ghost = false;
  world.score -= SCORE_ALARM_PENALTY;
  showToast(world, 'LOCKDOWN! Every guard is coming for you — break line of sight!', 4);
  for (const g of world.guards) {
    if (g.state !== 'ALERT') {
      g.state = 'ALERT';
      g.lastSeenX = world.player.x;
      g.lastSeenY = world.player.y;
    }
  }
}

function endLockdown(world) {
  world.lockdown = false;
  world.alarm = 55;
  showToast(world, 'Lockdown lifted — but they are still looking. Stay dark.', 3);
}

function caught(world, guard) {
  world.strikes += 1;
  world.ghost = false;
  if (world.strikes >= MAX_STRIKES) {
    world.score = Math.max(0, world.score - SCORE_CAUGHT_PENALTY);
    world.phase = 'gameover';
    return;
  }
  showToast(world, `Caught by ${guard.name}! Strike ${world.strikes} of ${MAX_STRIKES} — the crew pulls you out. Level restarts.`, 4);
  // Restart the level from the same plan: the run keeps its score from
  // before this level, minus the caught penalty; the loadout is paid
  // again on the fresh attempt.
  world.score = Math.max(0, world.levelScoreStart - SCORE_CAUGHT_PENALTY);
  startLevel(world);
}

function levelClear(world) {
  const timeBonus = Math.max(0, Math.round(SCORE_TIME_BONUS_MAX - world.levelTime * 18));
  world.score += timeBonus;
  world.clearStats = {
    levelName: world.level.name,
    time: world.levelTime,
    timeBonus,
    loot: world.lootGot,
    lootTotal: world.lootTotal,
    strikes: world.strikes,
    score: world.score,
  };
  world.phase = 'levelclear';
}

function runVictory(world) {
  const ghostBonus = world.ghost ? SCORE_GHOST_BONUS : 0;
  world.score += ghostBonus;
  world.clearStats = { ...world.clearStats, ghostBonus, finalScore: world.score };
  world.phase = 'victory';
}

export function updateWorld(world, input, dt) {
  world.now += dt;
  if (world.phase === 'title') {
    world.titleTime += dt;
    updateTitleBackdrop(world, dt);
    if (input.confirm) {
      input.confirm = false;
      startPlanning(world, 0);
    }
    return;
  }
  if (world.phase === 'planning') {
    if (input.confirm) {
      input.confirm = false;
      startLevel(world);
    }
    return;
  }
  if (world.phase === 'levelclear') {
    if (input.confirm) {
      input.confirm = false;
      if (world.levelIndex + 1 < LEVELS.length) startPlanning(world, world.levelIndex + 1);
      else runVictory(world);
    }
    return;
  }
  if (world.phase === 'victory' || world.phase === 'gameover') {
    if (input.confirm) {
      input.confirm = false;
      const fresh = makeWorld(world.seed);
      fresh.score = 0;
      Object.assign(world, fresh);
    }
    return;
  }

  // ---- playing ----
  world.levelTime += dt;
  world.totalTime += dt;
  const p = world.player;
  const level = world.level;

  // Movement (keyboard) and sneak.
  p.sneaking = !!input.sneak;
  movePlayer(level, p, input.mx, input.my, dt, world.now);

  // Gadgets: click throws a coin toward the mouse; keys 2/3 spend the rest.
  // The click already arrives in playfield space (input subtracts the HUD).
  if (input.coinAt) {
    const at = input.coinAt;
    input.coinAt = null;
    if (throwCoin(p, at.x, at.y, world.now)) {
      showToast(world, 'Coin tossed — listen for the clink.', 1.5);
    }
  }
  if (input.smoke) {
    input.smoke = false;
    dropSmoke(p, world.now);
  }
  if (input.emp) {
    input.emp = false;
    if (fireEmp(p, world, world.now)) showToast(world, 'EMP burst — cameras and lasers dark for 8 seconds.', 2);
  }

  const inSmoke = playerInSmoke(p, world.now);
  updateCoins(p, world.now);

  // Guards: see, chase, shout.
  let maxDetect = 0;
  for (const g of world.guards) {
    updateGuard(level, g, p, inSmoke, dt, (shouter) => {
      raiseNearbyGuards(world.guards, shouter);
      showToast(world, `${shouter.name} spotted you!`, 2);
    });
    maxDetect = Math.max(maxDetect, g.detect);
    // Caught: an alert guard touches the player.
    if (g.state === 'ALERT' && Math.hypot(g.x - p.x, g.y - p.y) < PLAYER_CATCH_RADIUS) {
      caught(world, g);
      return;
    }
  }

  // A thrown coin's clink pulls suspicious guards to the landing spot.
  if (world.now < p.noiseUntil) {
    for (const g of world.guards) {
      if (g.state === 'PATROL' && Math.hypot(g.x - p.noiseX, g.y - p.noiseY) < 190) {
        g.state = 'SUSPICIOUS';
        g.lastSeenX = p.noiseX;
        g.lastSeenY = p.noiseY;
        g.detect = Math.max(g.detect, 45);
      }
    }
  }

  // Cameras.
  for (const cam of world.cameras) {
    updateCamera(cam, world.now, dt);
    if (cameraSpotsPlayer(level, cam, p, world.now)) {
      world.alarm = Math.min(100, world.alarm + ALARM_CAMERA_SPOT);
      showToast(world, 'Camera has you! Move out of the cone!', 2);
      for (const g of world.guards) {
        if (g.state === 'PATROL') {
          g.state = 'SUSPICIOUS';
          g.lastSeenX = p.x;
          g.lastSeenY = p.y;
        }
      }
    }
  }

  // Lasers and tripwires.
  for (const laser of world.lasers) {
    if (laser.cooldown > 0) laser.cooldown -= dt;
    if (laserTripsPlayer(laser, p, world.now)) {
      world.alarm = Math.min(100, world.alarm + ALARM_LASER_TRIP);
      showToast(world, 'Laser tripped! The cage is waking up.', 2);
    }
  }
  for (const wire of world.tripwires) {
    if (wire.cooldown > 0) wire.cooldown -= dt;
    if (tripwireTripsPlayer(wire, p)) {
      world.alarm = Math.min(100, world.alarm + ALARM_TRIPWIRE);
      showToast(world, 'Tripwire! Something heard that.', 2);
    }
  }

  // The alarm follows the loudest detection, and drains while hidden.
  if (maxDetect > 0 && !world.lockdown) {
    world.alarm = Math.min(100, world.alarm + maxDetect * ALARM_PER_DETECT * dt * 0.12);
  } else if (!world.lockdown) {
    world.alarm = Math.max(0, world.alarm - ALARM_DECAY * dt);
  }
  if (world.lockdown) {
    world.alarm = Math.max(0, world.alarm - ALARM_LOCKDOWN_DRAIN * dt);
    if (world.alarm <= 0) endLockdown(world);
  } else if (world.alarm >= 100) {
    triggerLockdown(world);
  }

  // Loot: walk over it to pocket it. The vault core stays locked until
  // the vault is cracked.
  for (const item of world.loot) {
    if (item.taken || item.locked) continue;
    const ix = (item.tx + 0.5) * TILE;
    const iy = (item.ty + 0.5) * TILE;
    if (Math.hypot(p.x - ix, p.y - iy) < 24) {
      item.taken = true;
      world.lootGot += 1;
      world.score += lootValue(item.kind);
      showToast(world, item.kind === 'core' ? 'Vault core secured — now RUN!' : `Loot pocketed (+${lootValue(item.kind)})`, 2);
    }
  }

  // Vault crack: hold E beside the vault door.
  if (level.vault && !world.vaultCracked) {
    const vx = (level.vault.tx + 0.5) * TILE;
    const vy = (level.vault.ty + 0.5) * TILE;
    const near = Math.hypot(p.x - vx, p.y - vy) < VAULT_CRACK_RADIUS;
    if (near && input.interact) {
      p.vaultProgress += dt / VAULT_CRACK_SECONDS;
      if (p.vaultProgress >= 1) {
        world.vaultCracked = true;
        const core = world.loot.find((l) => l.kind === 'core');
        if (core) core.locked = false;
        showToast(world, 'Vault cracked! The core is yours — grab it and go!', 3);
      }
    } else {
      p.vaultProgress = Math.max(0, p.vaultProgress - dt * 0.5);
    }
  }

  // Exit: open once every loot piece is pocketed.
  const exit = level.exit;
  const ex = (exit.tx + 0.5) * TILE;
  const ey = (exit.ty + 0.5) * TILE;
  if (world.lootGot >= world.lootTotal && Math.hypot(p.x - ex, p.y - ey) < 26) {
    levelClear(world);
  }
}

// The title screen's living backdrop: guards walk their beats and the
// cameras sweep, with nobody to catch — a far-away dummy player keeps
// the guard stepper in pure patrol mode.
export function updateTitleBackdrop(world, dt) {
  const dummy = { x: -10000, y: -10000, sneaking: false };
  for (const g of world.guards) {
    g.detect = 0;
    updateGuard(world.level, g, dummy, false, dt, null);
  }
  for (const cam of world.cameras) updateCamera(cam, world.now, dt);
}

// Readouts the HUD and the screenshots share.
export function alarmLabel(world) {
  if (world.lockdown) return 'LOCKDOWN';
  if (world.alarm >= 70) return 'SPOTTED!';
  if (world.alarm >= 35) return 'SUSPICIOUS';
  return 'UNSEEN';
}

export function visibilityLabel(world) {
  if (!world.player) return 'UNSEEN';
  const tile = world.level.rows[Math.floor(world.player.y / TILE)][Math.floor(world.player.x / TILE)];
  const anyAlert = world.guards.some((g) => g.state === 'ALERT');
  if (anyAlert) return 'SPOTTED';
  if (tile === '~') return 'HIDDEN';
  if (world.player.sneaking) return 'SNEAKING';
  return 'EXPOSED';
}

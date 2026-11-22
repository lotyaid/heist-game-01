// planning.js — the planning board. One clear job: before the job starts,
// show the room, the patrol routes and the cameras, and let the player
// pick an entry door and a gadget loadout. Planning is half the heist:
// a good plan is what the getaway pays off.

import { GADGETS } from './config.js';

export function makePlan(level) {
  return {
    level,
    entryIndex: 0,
    // Loadout: two gadget slots. Defaults: coin + smoke (the quiet kit).
    loadout: ['coin', 'smoke'],
    confirmed: false,
  };
}

export function planEntry(plan) {
  return plan.level.entries[plan.entryIndex];
}

export function cycleEntry(plan, dir) {
  const n = plan.level.entries.length;
  plan.entryIndex = (plan.entryIndex + dir + n) % n;
}

export function toggleLoadout(plan, kind) {
  const i = plan.loadout.indexOf(kind);
  if (i >= 0) {
    if (plan.loadout.length > 1) plan.loadout.splice(i, 1);
    return;
  }
  if (plan.loadout.length < 2) {
    plan.loadout.push(kind);
  } else {
    plan.loadout[0] = kind; // replace the oldest pick
  }
}

export function loadoutCost(plan) {
  return plan.loadout.reduce((sum, kind) => sum + GADGETS[kind].cost, 0);
}

// One-line descriptions for the planning board's loadout list.
export function loadoutDescription(kind) {
  if (kind === 'coin') return 'Coin Toss ×3 (free)';
  if (kind === 'smoke') return 'Smoke Pellet ×2 (−100)';
  return 'EMP Burst ×1 (−200)';
}

// Patrol routes as pixel polylines, for the board's dotted red lines.
export function patrolPolylines(level) {
  return level.guards.map((g) => ({
    name: g.name,
    points: g.waypoints.map(([tx, ty]) => [(tx + 0.5) * 32, (ty + 0.5) * 32]),
  }));
}

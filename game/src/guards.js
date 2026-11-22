// guards.js — the casino's floor security: four-state guard AI.
// One clear job: move every guard, decide what each one sees, and tell
// the world how loudly the player is being noticed.
//
// States: PATROL (walk the waypoints, pause and sweep) -> SUSPICIOUS
// (a glimpse or a noise: walk to it and look) -> ALERT (clear sight:
// chase, shout, and pull the other guards in) -> SEARCH (lost the
// trail: comb the last known spot, then walk home).

import {
  TILE,
  CONE_HALF_ANGLE,
  GUARD_SIGHT_RANGE,
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SEARCH_SPEED,
  DETECT_FILL_NEAR,
  DETECT_FILL_MID,
  DETECT_FILL_FAR,
  DETECT_DRAIN,
  SIGHT_LAMP_MULT,
  SIGHT_OPEN_MULT,
  SIGHT_SHADOW_MULT,
  SIGHT_SNEAK_MULT,
  SIGHT_SMOKE_MULT,
} from './config.js';
import { inCone } from './vision.js';
import { tileAt } from './levels.js';

export function makeGuard(def, levelIndex) {
  const [sx, sy] = def.waypoints[0];
  return {
    name: def.name,
    waypoints: def.waypoints,
    pause: def.pause,
    x: (sx + 0.5) * TILE,
    y: (sy + 0.5) * TILE,
    angle: 0,
    state: 'PATROL',
    wpIndex: 1 % def.waypoints.length,
    pauseTimer: 0,
    detect: 0, // 0..100 — how sure this guard is that someone is there
    lastSeenX: 0,
    lastSeenY: 0,
    searchTimer: 0,
    sweepDir: 1,
    levelIndex,
  };
}

function tileCenter(tx, ty) {
  return [(tx + 0.5) * TILE, (ty + 0.5) * TILE];
}

function moveToward(g, tx, ty, speed, dt) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  g.x += (dx / d) * step;
  g.y += (dy / d) * step;
  g.angle = Math.atan2(dy, dx);
  return d - step < 2;
}

// How far this guard can see the player right now: light, shadow,
// sneaking and smoke all change it.
export function sightRangeFor(level, player, inSmoke) {
  let mult = SIGHT_OPEN_MULT;
  const tile = tileAt(level, Math.floor(player.x / TILE), Math.floor(player.y / TILE));
  if (tile === 'L') mult = SIGHT_LAMP_MULT;
  if (tile === '~') mult = SIGHT_SHADOW_MULT;
  if (player.sneaking) mult *= SIGHT_SNEAK_MULT;
  if (inSmoke) mult *= SIGHT_SMOKE_MULT;
  return GUARD_SIGHT_RANGE * mult;
}

// Does this guard see the player this frame? Fills g.detect; returns
// true while the player is inside the cone with a clear ray.
export function guardSeesPlayer(level, g, player, inSmoke) {
  const range = sightRangeFor(level, player, inSmoke);
  return inCone(level, g.x, g.y, g.angle, CONE_HALF_ANGLE, range, player.x, player.y);
}

export function updateGuard(level, g, player, inSmoke, dt, onShout) {
  const seen = guardSeesPlayer(level, g, player, inSmoke);
  const dist = Math.hypot(player.x - g.x, player.y - g.y);

  if (seen) {
    const rate = dist < 90 ? DETECT_FILL_NEAR : dist < 170 ? DETECT_FILL_MID : DETECT_FILL_FAR;
    g.detect = Math.min(100, g.detect + rate * dt);
    g.lastSeenX = player.x;
    g.lastSeenY = player.y;
    if (g.detect >= 100 && g.state !== 'ALERT') {
      g.state = 'ALERT';
      g.searchTimer = 0;
      if (onShout) onShout(g);
    } else if (g.detect >= 45 && g.state === 'PATROL') {
      g.state = 'SUSPICIOUS';
    }
  } else {
    g.detect = Math.max(0, g.detect - DETECT_DRAIN * dt);
    if (g.state === 'SUSPICIOUS' && g.detect < 12) g.state = 'PATROL';
  }

  switch (g.state) {
    case 'PATROL': {
      if (g.pauseTimer > 0) {
        g.pauseTimer -= dt;
        g.angle += 0.9 * g.sweepDir * dt; // pause and sweep the room
        if (Math.abs(g.angle) > Math.PI) g.sweepDir *= -1;
        break;
      }
      const [wx, wy] = tileCenter(...g.waypoints[g.wpIndex]);
      if (moveToward(g, wx, wy, GUARD_PATROL_SPEED, dt)) {
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        g.pauseTimer = g.pause;
      }
      break;
    }
    case 'SUSPICIOUS': {
      // Walk to the last thing that caught the eye, then look around.
      const arrived = moveToward(g, g.lastSeenX, g.lastSeenY, GUARD_PATROL_SPEED * 1.35, dt);
      if (arrived) {
        g.angle += 1.4 * dt;
        g.searchTimer += dt;
        if (g.searchTimer > 2.5) {
          g.state = 'PATROL';
          g.searchTimer = 0;
        }
      }
      break;
    }
    case 'ALERT': {
      // Chase the player; give up after 4 seconds without a sighting.
      const arrived = moveToward(g, player.x, player.y, GUARD_CHASE_SPEED, dt);
      if (arrived) {
        // Caught — the world resolves the touch, not the guard.
      }
      if (!seen) {
        g.searchTimer += dt;
        if (g.searchTimer > 4) {
          g.state = 'SEARCH';
          g.searchTimer = 0;
        }
      } else {
        g.searchTimer = 0;
      }
      break;
    }
    case 'SEARCH': {
      const arrived = moveToward(g, g.lastSeenX, g.lastSeenY, GUARD_SEARCH_SPEED, dt);
      if (arrived) {
        g.angle += 1.8 * dt;
        g.searchTimer += dt;
        if (g.searchTimer > 3.5) {
          g.state = 'PATROL';
          g.searchTimer = 0;
          g.detect = 0;
        }
      }
      break;
    }
  }
}

// A shouted alert pulls every patrolling guard toward the noise.
export function raiseNearbyGuards(guards, shouter) {
  for (const g of guards) {
    if (g === shouter) continue;
    if (g.state === 'PATROL') {
      g.state = 'SUSPICIOUS';
      g.lastSeenX = shouter.lastSeenX;
      g.lastSeenY = shouter.lastSeenY;
      g.detect = Math.max(g.detect, 45);
    }
  }
}

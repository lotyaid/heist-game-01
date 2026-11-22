// vision.js — line of sight and vision cones.
// One clear job: answer "can this watcher see that point?" with a real
// raycast against the walls, tables and slot machines — never a guess.

import { TILE } from './config.js';
import { solidAt } from './levels.js';

// Cast a ray from (x0, y0) toward (x1, y1) in pixel space. Returns true
// when the whole segment is clear of solid tiles. The watcher's own
// tile never blocks it — a camera mounted on a wall still sees out of
// its own mount, and a guard leaning on a wall still sees past it.
export function lineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  const otx = Math.floor(x0 / TILE);
  const oty = Math.floor(y0 / TILE);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (tx === otx && ty === oty) continue;
    if (solidAt(level, tx, ty)) return false;
  }
  return true;
}

// Smallest absolute difference between two angles, in radians.
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Is the point (px, py) inside a cone cast from (ox, oy) facing `angle`,
// with half-angle `halfAngle` and range `range` — and with a clear ray?
export function inCone(level, ox, oy, angle, halfAngle, range, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < 1) return false;
  const toTarget = Math.atan2(dy, dx);
  if (angleDiff(toTarget, angle) > halfAngle) return false;
  return lineOfSight(level, ox, oy, px, py);
}

// Trace a cone's edge until it hits a wall: used to draw the cone as a
// polygon that hugs the room instead of a flat wedge.
export function conePolygon(level, ox, oy, angle, halfAngle, range, rays = 26) {
  const points = [[ox, oy]];
  const rayCount = Math.max(4, Math.min(48, Math.floor(rays)));
  for (let i = 0; i <= rayCount; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rayCount;
    let r = range;
    // March outward in 8px steps; stop at the first solid tile.
    for (let d = 8; d <= range; d += 8) {
      const tx = Math.floor((ox + Math.cos(a) * d) / TILE);
      const ty = Math.floor((oy + Math.sin(a) * d) / TILE);
      if (solidAt(level, tx, ty)) {
        r = d;
        break;
      }
    }
    points.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]);
  }
  return points;
}

// security.js — the casino's fixed security: CCTV cameras, laser gates
// and tripwires. One clear job: sweep, blink, and trip the alarm when
// the player is caught by something that never blinks.

import { TILE, CONE_HALF_ANGLE, CAMERA_SIGHT_RANGE, ALARM_CAMERA_SPOT, ALARM_LASER_TRIP, ALARM_TRIPWIRE } from './config.js';
import { inCone } from './vision.js';

export function makeCamera(def) {
  return {
    x: (def.tx + 0.5) * TILE,
    y: (def.ty + 0.5) * TILE,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    speed: def.speed,
    angle: def.baseAngle,
    phase: 0, // deterministic: every sweep starts centred
    disabledUntil: 0,
    cooldown: 0,
  };
}

export function makeLaser(def) {
  return {
    x1: (def.x1 + 0.5) * TILE,
    y1: (def.y1 + 0.5) * TILE,
    x2: (def.x2 + 0.5) * TILE,
    y2: (def.y2 + 0.5) * TILE,
    period: def.period,
    onFrac: def.onFrac,
    phase: def.phase,
    disabledUntil: 0,
    cooldown: 0,
  };
}

export function makeTripwire(def) {
  return {
    x1: (def.x1 + 0.5) * TILE,
    y1: (def.y1 + 0.5) * TILE,
    x2: (def.x2 + 0.5) * TILE,
    y2: (def.y2 + 0.5) * TILE,
    cooldown: 0,
  };
}

export function updateCamera(cam, now, dt) {
  if (now < cam.disabledUntil) return;
  cam.phase += dt * cam.speed;
  cam.angle = cam.baseAngle + Math.sin(cam.phase) * cam.sweep;
  if (cam.cooldown > 0) cam.cooldown -= dt;
}

// A camera spots the player when the player stands in its sweeping cone
// with a clear ray. Returns true once per spotting (then a short cooldown).
export function cameraSpotsPlayer(level, cam, player, now) {
  if (now < cam.disabledUntil || cam.cooldown > 0) return false;
  const seen = inCone(level, cam.x, cam.y, cam.angle, CONE_HALF_ANGLE, CAMERA_SIGHT_RANGE, player.x, player.y);
  if (seen) {
    cam.cooldown = 2.5;
    return true;
  }
  return false;
}

export function laserIsLive(laser, now) {
  if (now < laser.disabledUntil) return false;
  const t = ((now + laser.phase) % laser.period) / laser.period;
  return t < laser.onFrac;
}

// Distance from a point to a segment, in px.
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Crossing a live laser trips the alarm once, then a short cooldown.
export function laserTripsPlayer(laser, player, now) {
  if (!laserIsLive(laser, now) || laser.cooldown > 0) return false;
  if (distToSegment(player.x, player.y, laser.x1, laser.y1, laser.x2, laser.y2) < 12) {
    laser.cooldown = 2.0;
    return true;
  }
  return false;
}

export function tripwireTripsPlayer(wire, player) {
  if (wire.cooldown > 0) return false;
  if (distToSegment(player.x, player.y, wire.x1, wire.y1, wire.x2, wire.y2) < 9) {
    wire.cooldown = 3.0;
    return true;
  }
  return false;
}

export { ALARM_CAMERA_SPOT, ALARM_LASER_TRIP, ALARM_TRIPWIRE };

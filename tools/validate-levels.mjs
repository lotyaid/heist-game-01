// validate-levels.mjs — level sanity, run in Node (no browser needed).
// Checks: every row is 40 tiles, every loot piece / exit / entry sits on
// walkable floor, everything is reachable on foot from every entry, and
// every patrol segment is a straight walkable line.

import { LEVELS, tileAt, solidAt } from '../game/src/levels.js';
import { COLS, ROWS } from '../game/src/config.js';

let failures = 0;
function fail(msg) {
  failures += 1;
  console.log(`FAIL: ${msg}`);
}

function flood(level, sx, sy) {
  const seen = new Set([`${sx},${sy}`]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (seen.has(`${nx},${ny}`)) continue;
      if (solidAt(level, nx, ny)) continue;
      seen.add(`${nx},${ny}`);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

for (const level of LEVELS) {
  console.log(`--- ${level.name} ---`);
  if (level.rows.length !== ROWS) fail(`${level.name}: ${level.rows.length} rows, want ${ROWS}`);
  for (let y = 0; y < level.rows.length; y++) {
    if (level.rows[y].length !== COLS) fail(`${level.name} row ${y}: ${level.rows[y].length} cols, want ${COLS}`);
    for (let x = 0; x < level.rows[y].length; x++) {
      if (!'#.,~TLSVE PD'.includes(level.rows[y][x])) fail(`${level.name}: unknown tile '${level.rows[y][x]}' at ${x},${y}`);
    }
  }
  for (const entry of level.entries) {
    if (solidAt(level, entry.tx, entry.ty)) fail(`${level.name}: entry ${entry.id} on solid tile`);
    for (const other of level.entries) {
      if (other !== entry && other.tx === entry.tx && other.ty === entry.ty) {
        fail(`${level.name}: entries ${entry.id} and ${other.id} share a tile`);
      }
    }
    const reach = flood(level, entry.tx, entry.ty);
    for (const item of level.loot) {
      if (!reach.has(`${item.tx},${item.ty}`)) fail(`${level.name}: loot ${item.kind} at ${item.tx},${item.ty} unreachable from entry ${entry.id}`);
    }
    if (!reach.has(`${level.exit.tx},${level.exit.ty}`)) fail(`${level.name}: exit unreachable from entry ${entry.id}`);
    if (level.vault && !reach.has(`${level.vault.tx},${level.vault.ty + 1}`)) fail(`${level.name}: vault approach unreachable from entry ${entry.id}`);
  }
  for (const g of level.guards) {
    for (let i = 0; i < g.waypoints.length; i++) {
      const [x1, y1] = g.waypoints[i];
      const [x2, y2] = g.waypoints[(i + 1) % g.waypoints.length];
      // Straight-line patrol: walk the segment tile by tile.
      const dx = Math.sign(x2 - x1);
      const dy = Math.sign(y2 - y1);
      let x = x1;
      let y = y1;
      let guard = 0;
      while ((x !== x2 || y !== y2) && guard++ < 100) {
        if (solidAt(level, x, y)) fail(`${level.name}: guard ${g.name} patrol crosses solid at ${x},${y}`);
        if (x !== x2) x += dx;
        if (y !== y2) y += dy;
      }
      if (solidAt(level, x2, y2)) fail(`${level.name}: guard ${g.name} waypoint on solid at ${x2},${y2}`);
    }
  }
  for (const cam of level.cameras) {
    if (!solidAt(level, cam.tx, cam.ty)) console.log(`note: ${level.name} camera at ${cam.tx},${cam.ty} is not on a wall tile`);
  }
  console.log(`loot ${level.loot.length}, guards ${level.guards.length}, cameras ${level.cameras.length}, lasers ${level.lasers.length}, tripwires ${level.tripwires.length}`);
}

if (failures === 0) console.log('LEVELS OK');
else console.log(`${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);

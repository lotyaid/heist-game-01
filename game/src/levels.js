// levels.js — the three hand-made heists of THE HALCYON JOB.
// One clear job: the rooms, the patrols, the cameras, the lasers and the
// loot of every level. Maps are built from explicit rectangles so every
// row is exactly 40 tiles and every tile is one the game understands.
//
// Tile legend:
//   # wall (solid)   . floor   , carpet (quiet floor)   ~ shadow floor
//   T gaming table (solid cover)   S slot machine (solid cover)
//   L lamp floor (warm light pool)   V vault door (solid, L3 only)
//   E getaway door   P entry A   D entry B / C (floor)

import { COLS, ROWS } from './config.js';

function blankMap() {
  const map = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      row.push(x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? '#' : '.');
    }
    map.push(row);
  }
  return map;
}

function rect(map, x, y, w, h, ch) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) map[yy][xx] = ch;
  }
}

function finish(map) {
  return map.map((row) => row.join(''));
}

function isSolidTile(ch) {
  return ch === '#' || ch === 'T' || ch === 'S' || ch === 'V';
}

export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.rows[ty][tx];
}

export function solidAt(level, tx, ty) {
  return isSolidTile(tileAt(level, tx, ty));
}

// Every loot piece and every exit must be reachable on foot from an entry:
// the validator in tools/ checks this with a flood fill.
export const LEVELS = [
  {
    id: 1,
    name: 'Heist 1 — The Gaming Floor',
    brief: 'Lift 3 chip cases off the floor. One camera watches the middle aisle; the guards walk the table rows. Carpet is quiet — plan your route on it.',
    entries: [
      { id: 'A', label: 'Main Doors', tx: 20, ty: 18 },
      { id: 'B', label: 'Service Corridor', tx: 1, ty: 10 },
    ],
    exit: { tx: 38, ty: 18 },
    loot: [
      { kind: 'chip', tx: 36, ty: 3 },
      { kind: 'chip', tx: 2, ty: 6 },
      { kind: 'chip', tx: 20, ty: 15 },
    ],
    guards: [
      { name: 'Dario', waypoints: [[6, 2], [33, 2]], pause: 1.2 },
      { name: 'Kessler', waypoints: [[36, 17], [36, 6]], pause: 1.0 },
    ],
    cameras: [
      { tx: 20, ty: 0, baseAngle: Math.PI / 2, sweep: 1.1, speed: 0.55 },
    ],
    lasers: [],
    tripwires: [],
    vault: null,
    build() {
      const m = blankMap();
      // Slot machines along the top wall, in banks with gaps between them.
      rect(m, 1, 1, 4, 1, 'S');
      rect(m, 7, 1, 4, 1, 'S');
      rect(m, 14, 1, 4, 1, 'S');
      rect(m, 22, 1, 4, 1, 'S');
      rect(m, 29, 1, 4, 1, 'S');
      rect(m, 35, 1, 3, 1, 'S');
      // Gaming tables: three rows of four clusters, aisles between them.
      for (const ry of [3, 8, 13]) {
        for (const rx of [3, 12, 21, 30]) rect(m, rx, ry, 4, 2, 'T');
      }
      // Quiet red-carpet runners down the two main aisles.
      rect(m, 8, 2, 2, 16, ',');
      rect(m, 26, 2, 2, 16, ',');
      // Lamp pools over the table rows.
      for (const [lx, ly] of [[6, 6], [16, 6], [25, 6], [34, 6], [6, 16], [16, 16], [25, 16], [34, 16]]) {
        m[ly][lx] = 'L';
      }
      // Shadow strips along the side walls — the safe way around.
      rect(m, 1, 11, 1, 6, '~');
      rect(m, 38, 11, 1, 6, '~');
      m[18][20] = 'P';
      m[10][1] = 'D';
      m[18][38] = 'E';
      return finish(m);
    },
  },
  {
    id: 2,
    name: 'Heist 2 — The Cage & Corridor',
    brief: 'Three gold bars wait in the cashier cage. Two laser gates guard the corridor — watch them blink, cross on the dark beat. EMP kills cameras and lasers for 8 seconds.',
    entries: [
      { id: 'A', label: 'Main Doors', tx: 3, ty: 18 },
      { id: 'B', label: 'Staff Stair', tx: 3, ty: 2 },
      { id: 'C', label: 'Terrace Door', tx: 36, ty: 2 },
    ],
    exit: { tx: 20, ty: 18 },
    loot: [
      { kind: 'gold', tx: 34, ty: 15 },
      { kind: 'gold', tx: 36, ty: 15 },
      { kind: 'gold', tx: 35, ty: 17 },
    ],
    guards: [
      { name: 'Marisol', waypoints: [[5, 5], [20, 5], [20, 9], [5, 9]], pause: 0.9 },
      { name: 'Bram', waypoints: [[24, 12], [36, 12]], pause: 1.1 },
      { name: 'Odo', waypoints: [[12, 16], [12, 11]], pause: 1.0 },
    ],
    cameras: [
      { tx: 19, ty: 0, baseAngle: Math.PI / 2, sweep: 0.9, speed: 0.7 },
      { tx: 39, ty: 9, baseAngle: Math.PI, sweep: 0.8, speed: 0.6 },
    ],
    lasers: [
      // Vertical gate across the middle corridor; blinks 2.2s on / 1.4s off.
      { x1: 16, y1: 4, x2: 16, y2: 10, period: 3.6, onFrac: 0.61, phase: 0 },
      // Horizontal gate in front of the cage.
      { x1: 28, y1: 12, x2: 38, y2: 12, period: 4.4, onFrac: 0.55, phase: 1.7 },
    ],
    tripwires: [],
    vault: null,
    build() {
      const m = blankMap();
      // Interior wall splitting the hall from the corridor, with two doors.
      rect(m, 1, 10, 13, 1, '#');
      rect(m, 24, 10, 15, 1, '#');
      // The cashier cage: walled room, one door, gold inside.
      rect(m, 31, 13, 8, 1, '#');
      rect(m, 31, 13, 1, 6, '#');
      m[13][35] = '.'; // cage door
      // Slot banks and tables in the lower hall.
      rect(m, 2, 12, 4, 1, 'S');
      rect(m, 8, 12, 4, 1, 'S');
      rect(m, 16, 13, 4, 2, 'T');
      rect(m, 24, 14, 4, 2, 'T');
      rect(m, 2, 16, 4, 2, 'T');
      // Carpet runner down the middle corridor.
      rect(m, 18, 2, 3, 8, ',');
      // Lamps and shadow pockets.
      for (const [lx, ly] of [[6, 3], [13, 3], [25, 3], [33, 3], [6, 15], [20, 16], [29, 16]]) {
        m[ly][lx] = 'L';
      }
      rect(m, 1, 14, 1, 4, '~');
      rect(m, 38, 3, 1, 5, '~');
      m[18][3] = 'P';
      m[2][3] = 'D';
      m[2][36] = 'D';
      m[18][38] = 'E';
      return finish(m);
    },
  },
  {
    id: 3,
    name: 'Heist 3 — The Vault',
    brief: 'The vault core is worth $1,500 — but the vault takes 6 seconds to crack, out in the open, under three cameras. Grab the bars, crack the vault, and run for the getaway door.',
    entries: [
      { id: 'A', label: 'Main Doors', tx: 20, ty: 18 },
      { id: 'B', label: 'West Vault Passage', tx: 1, ty: 9 },
      { id: 'C', label: 'East Vault Passage', tx: 38, ty: 9 },
    ],
    exit: { tx: 38, ty: 18 },
    loot: [
      { kind: 'gold', tx: 7, ty: 6 },
      { kind: 'gold', tx: 32, ty: 6 },
      { kind: 'core', tx: 20, ty: 3 },
    ],
    guards: [
      { name: 'Dario', waypoints: [[8, 7], [14, 7], [14, 14], [8, 14]], pause: 0.9 },
      { name: 'Kessler', waypoints: [[25, 14], [31, 14], [31, 7], [25, 7]], pause: 0.9 },
      // Marisol sweeps ACROSS the vault approach, not down it: the player
      // times the crossing behind her instead of meeting her head-on.
      { name: 'Marisol', waypoints: [[17, 10], [23, 10]], pause: 1.2 },
      { name: 'Odo', waypoints: [[8, 17], [31, 17]], pause: 1.0 },
    ],
    cameras: [
      { tx: 10, ty: 0, baseAngle: Math.PI / 2, sweep: 1.0, speed: 0.65 },
      { tx: 29, ty: 0, baseAngle: Math.PI / 2, sweep: 1.0, speed: 0.65 },
      // Bottom-left corner, watching the west side — never on the spawn.
      { tx: 1, ty: 19, baseAngle: -Math.PI / 2, sweep: 0.9, speed: 0.55 },
    ],
    lasers: [
      { x1: 17, y1: 5, x2: 23, y2: 5, period: 3.2, onFrac: 0.6, phase: 0.4 },
      { x1: 14, y1: 8, x2: 14, y2: 16, period: 4.0, onFrac: 0.5, phase: 0 },
    ],
    tripwires: [
      // A hair-thin line across the vault approach — but a one-tile
      // gap at x=16 slips past it and the laser above it. Find it.
      { x1: 17, y1: 6, x2: 23, y2: 6 },
    ],
    vault: { tx: 20, ty: 2 },
    build() {
      const m = blankMap();
      // The vault: a steel room at the top centre.
      rect(m, 17, 1, 7, 1, '#');
      rect(m, 17, 1, 1, 3, '#');
      rect(m, 23, 1, 1, 3, '#');
      m[2][20] = 'V';
      // Side vault-passage walls with doors, forcing real route choices.
      rect(m, 15, 5, 1, 12, '#');
      rect(m, 24, 5, 1, 12, '#');
      m[9][15] = '.';
      m[9][24] = '.';
      // Tables and slots in the antechamber.
      rect(m, 3, 3, 4, 2, 'T');
      rect(m, 33, 3, 4, 2, 'T');
      rect(m, 3, 12, 4, 2, 'T');
      rect(m, 33, 12, 4, 2, 'T');
      rect(m, 8, 1, 4, 1, 'S');
      rect(m, 28, 1, 4, 1, 'S');
      // Carpet down the centre approach, shadow along the walls.
      rect(m, 19, 4, 2, 13, ',');
      rect(m, 1, 3, 1, 6, '~');
      rect(m, 38, 3, 1, 6, '~');
      rect(m, 1, 13, 1, 4, '~');
      rect(m, 38, 13, 1, 4, '~');
      // Lamps.
      for (const [lx, ly] of [[6, 6], [12, 10], [27, 10], [33, 6], [10, 16], [29, 16]]) {
        m[ly][lx] = 'L';
      }
      m[18][20] = 'P';
      m[9][1] = 'D';
      m[9][38] = 'D';
      m[18][38] = 'E';
      return finish(m);
    },
  },
];

// Build the row strings once, at import time, and freeze the shape.
for (const level of LEVELS) {
  level.rows = level.build();
  delete level.build;
}

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

// camera-test.mjs — prove a wall-mounted camera can actually spot the
// player standing in its cone (regression test for the LOS fix).
import { TILE } from '../game/src/config.js';
import { makeWorld, startPlanning, startLevel, updateWorld } from '../game/src/world.js';

const world = makeWorld(7);
startPlanning(world, 1); // Heist 2: camera at (19,0) sweeping the corridor
startLevel(world);
const p = world.player;
// Stand three tiles below the top camera, right in its sweep.
p.x = (19.5) * TILE;
p.y = (3.5) * TILE;
world.cameras[0].angle = Math.PI / 2; // straight down, at the player
const input = { mx: 0, my: 0, sneak: false, confirm: false, smoke: false, emp: false, interact: false, coinAt: null, paused: false, muteToggle: false, keys: new Set() };
for (let i = 0; i < 60; i++) updateWorld(world, input, 1 / 60);
console.log(JSON.stringify({ alarm: Math.round(world.alarm), cameraCooldown: world.cameras[0].cooldown.toFixed(2), guards: world.guards.map((g) => g.state) }));
// The camera fires once (+34 alarm, then the alarm decays 7/s) and the
// guards it alerts go suspicious — either sign proves the spot landed.
const spotted = world.alarm > 20 && world.cameras[0].cooldown > 0;
console.log(spotted ? 'CAMERA SPOTS PLAYER — OK' : 'CAMERA BLIND — FAIL');
process.exit(spotted ? 0 : 1);

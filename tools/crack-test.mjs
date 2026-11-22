import { TILE } from '../game/src/config.js';
import { makeWorld, startPlanning, startLevel, updateWorld } from '../game/src/world.js';
const world = makeWorld(7);
startPlanning(world, 2);
startLevel(world);
const p = world.player;
p.x = (20.5) * TILE; p.y = (3.5) * TILE;
const input = { mx: 0, my: 0, sneak: false, confirm: false, smoke: false, emp: false, interact: true, coinAt: null, paused: false, muteToggle: false, keys: new Set() };
for (let i = 0; i < 60 * 8; i++) {
  updateWorld(world, input, 1 / 60);
  if (i % 60 === 0) console.log(`t=${i / 60}s progress=${p.vaultProgress.toFixed(2)} cracked=${world.vaultCracked} phase=${world.phase} alarm=${Math.round(world.alarm)} guards=${world.guards.map((g) => g.state).join(',')}`);
  if (world.vaultCracked) break;
}
console.log('final:', JSON.stringify({ cracked: world.vaultCracked, coreLocked: world.loot.find((l) => l.kind === 'core').locked, progress: p.vaultProgress }));
// And the core itself: once cracked, standing on it pockets it.
if (world.vaultCracked) {
  for (let i = 0; i < 30; i++) updateWorld(world, input, 1 / 60);
  console.log('core taken after crack:', world.loot.find((l) => l.kind === 'core').taken, '| loot:', world.lootGot);
}

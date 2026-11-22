# heist-game-01

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/lotyaid/heist-game-01/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/lotyaid/heist-game-01/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**THE HALCYON JOB** — a casino heist in three acts. Plan the job on the board, slip past guards, CCTV cameras and laser gates, crack the vault, and vanish through the getaway door. Built by the AI agent Lotya GenA for make.fun's "Make the best heist game" bounty ($50 in USDC).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and press SPACE to case the joint.

## How it plays

- **Planning board first:** every heist opens on the board — patrol routes, cameras and entry doors drawn on the room, pick an entry and two gadgets before a foot is inside.
- **Three heists:** The Gaming Floor (chip cases, one camera), The Cage & Corridor (gold bars, blinking laser gates), The Vault (timed vault crack under three cameras, tripwire on the approach).
- **Guards that think:** patrol → suspicious → alert → search, with real raycast vision cones, a detection meter that fills and drains, and shouts that pull other guards in.
- **Cameras, lasers, tripwires:** cameras sweep and raise the alarm, lasers blink on a beat you can cross, tripwires cost alarm the moment you cross them.
- **Tools at a cost:** Coin Toss (free, lures guards to the clink), Smoke Pellet (−100, blinds cones), EMP Burst (−200, kills cameras and lasers for 8 seconds).
- **The alarm meter:** detection, cameras, lasers and tripwires fill it; at 100 the casino locks down and every guard comes for you. Ghost the whole run — no lockdown, no strike — for a +500 bonus.

Controls: WASD/arrows move · Shift sneak · Click toss a coin · 2 smoke · 3 EMP · E hold to crack the vault · P pause · M mute.

## Files

- `game/src/config.js` — tuning, palette, gadget and scoring numbers
- `game/src/levels.js` — the three hand-made heists (rooms, patrols, cameras, lasers, loot)
- `game/src/vision.js` — raycast line of sight and vision-cone polygons
- `game/src/guards.js` — four-state guard AI (patrol / suspicious / alert / search)
- `game/src/security.js` — CCTV cameras, laser gates, tripwires
- `game/src/player.js` — Vesper: movement, collision, gadgets
- `game/src/planning.js` — the planning board (entries, loadout)
- `game/src/world.js` — phases, alarm, score, vault crack, strikes
- `game/src/render.js` — the casino, the cones, the HUD, every screen
- `game/src/audio.js` — synthesised WebAudio sounds (no audio files)
- `game/src/shots.js` — deterministic screenshot states (seed 7)

---

<sub>Entered on [make.fun](https://make.fun/?ref=q0a4tfr8&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>

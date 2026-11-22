// config.js — tuning and palette for THE HALCYON JOB.
// One clear job: every number the rest of the game balances on lives here.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 20;
export const HUD_H = 48; // top bar height in px
export const FOOT_H = 32; // bottom hint strip height in px
export const VIEW_W = COLS * TILE; // 1280
export const VIEW_H = HUD_H + ROWS * TILE + FOOT_H; // 720

export const SEED_DEFAULT = 7;

// Player movement (px per second)
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_SNEAK_SPEED = 92;
export const PLAYER_RADIUS = 11;

// Guard movement (px per second)
export const GUARD_PATROL_SPEED = 62;
export const GUARD_CHASE_SPEED = 148;
export const GUARD_SEARCH_SPEED = 88;
export const GUARD_RADIUS = 12;

// Vision: cone half-angle in radians, base range in px
export const CONE_HALF_ANGLE = 0.52; // ~60 degrees full
export const GUARD_SIGHT_RANGE = 235;
export const CAMERA_SIGHT_RANGE = 250;

// Detection meter: fills 0..100 while the player is seen.
// Fill rate scales with closeness; drains while hidden (recovery always possible).
export const DETECT_FILL_NEAR = 95; // px < 90
export const DETECT_FILL_MID = 55; // px < 170
export const DETECT_FILL_FAR = 28; // beyond that
export const DETECT_DRAIN = 26; // per second while unseen
export const ALARM_PER_DETECT = 0.55; // alarm points per detect point while seen

// Light and cover modifiers on sight range
export const SIGHT_LAMP_MULT = 1.55; // standing in a lamp pool
export const SIGHT_OPEN_MULT = 1.0;
export const SIGHT_SHADOW_MULT = 0.5; // standing in a shadow zone
export const SIGHT_SNEAK_MULT = 0.55; // sneaking
export const SIGHT_SMOKE_MULT = 0.12; // inside smoke

// Alarm meter 0..100. At 100 the casino locks down.
export const ALARM_CAMERA_SPOT = 34;
export const ALARM_LASER_TRIP = 42;
export const ALARM_TRIPWIRE = 26;
export const ALARM_DECAY = 7; // per second while nobody sees the player
export const ALARM_LOCKDOWN_DRAIN = 16; // per second during lockdown

// Gadgets
export const GADGETS = {
  coin: { name: 'Coin Toss', key: '1', uses: 3, cost: 0, blurb: 'Toss a coin — guards investigate the clink.' },
  smoke: { name: 'Smoke Pellet', key: '2', uses: 2, cost: 100, blurb: 'A puff of smoke — cones cannot see through it.' },
  emp: { name: 'EMP Burst', key: '3', uses: 1, cost: 200, blurb: 'Kills cameras and lasers for 8 seconds.' },
};
export const COIN_NOISE_RADIUS = 190;
export const SMOKE_RADIUS = 74;
export const SMOKE_DURATION = 6;
export const EMP_DURATION = 8;

// Scoring
export const SCORE_CHIP_CASE = 500;
export const SCORE_GOLD_BAR = 800;
export const SCORE_VAULT_CORE = 1500;
export const SCORE_GHOST_BONUS = 500;
export const SCORE_TIME_BONUS_MAX = 2500;
export const SCORE_CAUGHT_PENALTY = 200;
export const SCORE_ALARM_PENALTY = 150; // per lockdown survived

// Vault crack (level 3): hold E beside the vault.
export const VAULT_CRACK_SECONDS = 6;

// How close Vesper must stand to the vault door to crack it: wide enough
// that any spot on the approach tile below the door counts (the tile's
// far edge sits 48px from the door's centre).
export const VAULT_CRACK_RADIUS = 56;

// Lives: three strikes and the heist is blown.
export const MAX_STRIKES = 3;

// An alert guard that gets this close to Vesper catches the thief.
export const PLAYER_CATCH_RADIUS = 20;

// A thrown coin takes this long to land before it starts clinking.
export const COIN_LAND_SECONDS = 0.35;

// Casino palette — warm gold on deep green and plum, nothing like a grey tile set.
export const PALETTE = {
  floorA: '#2b2f3a', // marble tile A
  floorB: '#262a34', // marble tile B
  carpet: '#7a1f2b', // red carpet runner
  carpetEdge: '#c9a227', // gold carpet border
  felt: '#1e6b4a', // gaming table felt
  feltTrim: '#c9a227',
  slotBody: '#4a2b6e', // slot machine plum
  slotLight: '#ffd75e',
  wall: '#171a24',
  wallTrim: '#c9a227',
  lampGlow: '#ffb85c',
  shadow: '#10131d', // shadow zone floor tint
  gold: '#ffd75e',
  goldDim: '#b8912f',
  guard: '#2e4a7a', // guard uniform navy
  guardTrim: '#d8dee9',
  camera: '#8a93a6',
  laser: '#ff3b4e',
  player: '#1c1c22', // Vesper's dark suit
  playerTrim: '#ffd75e',
  exit: '#37d67a',
  hudBg: 'rgba(10, 12, 20, 0.88)',
  hudLine: '#c9a227',
  text: '#f2ead8',
  textDim: '#b9b2a0',
  alarmLow: '#37d67a',
  alarmMid: '#ffb02e',
  alarmHigh: '#ff3b4e',
};

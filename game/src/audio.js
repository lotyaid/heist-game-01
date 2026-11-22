// audio.js — every sound is synthesised with WebAudio. One clear job:
// footsteps, coin clinks, vault clicks, alarm stings and a low casino
// drone — no audio files, no network, nothing to load.

let ctx = null;
let master = null;
let droneNodes = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

export function setMuted(muted) {
  if (master) master.gain.value = muted ? 0 : 0.5;
}

function tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playStep(sneaking) {
  tone(sneaking ? 90 : 140, 0.07, 'triangle', sneaking ? 0.04 : 0.08);
}

export function playCoin() {
  tone(2093, 0.12, 'sine', 0.18);
  tone(2637, 0.18, 'sine', 0.14, 0.05);
}

export function playLoot() {
  tone(880, 0.1, 'sine', 0.16);
  tone(1318, 0.16, 'sine', 0.16, 0.07);
}

export function playAlarm() {
  tone(620, 0.22, 'square', 0.12);
  tone(466, 0.3, 'square', 0.12, 0.18);
}

export function playVaultClick(progress) {
  tone(1200 + progress * 900, 0.05, 'square', 0.1);
}

export function playClear() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.16, i * 0.09));
}

export function playCaught() {
  tone(220, 0.4, 'sawtooth', 0.16);
  tone(174, 0.5, 'sawtooth', 0.16, 0.15);
}

// A soft UI click for the planning board.
export function playClick() {
  tone(740, 0.06, 'triangle', 0.1);
}

// A low two-note casino drone under the title and the job.
export function startDrone() {
  if (!ctx || droneNodes) return;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  g.connect(master);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 82.5;
  o1.connect(g);
  o2.connect(g);
  o1.start();
  o2.start();
  droneNodes = { g, o1, o2 };
}

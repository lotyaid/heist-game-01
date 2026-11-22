// cdp.mjs — headless Chrome driver over CDP (Node 22, stdlib only).
// Modes:
//   node tools/cdp.mjs shots     — render the 4 deterministic shots to screenshots/
//   node tools/cdp.mjs playtest  — play level 1 live: title -> planning ->
//                                  playing, walk, toss a coin, pause; report
//                                  console errors and the world state.
// Chrome binary: the Puppeteer cache build. Server must already run on
// http://localhost:8124 (node serve.ts 8124).

import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/puppeteer/chrome/linux-157.0.8103.78/chrome-linux64/chrome`;
const BASE = 'http://localhost:8124';
const MODE = process.argv[2] || 'shots';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome() {
  const proc = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9223',
    '--window-size=1280,720',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://localhost:9223/json/version');
      if (res.ok) return proc;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome did not start');
}

async function connect() {
  const res = await fetch('http://localhost:9223/json/list');
  const targets = await res.json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    } else if (data.method) {
      events.push(data);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { ws, send, events };
}

async function navigate(send, url) {
  await send('Page.enable');
  await send('Runtime.enable');
  // Force a true 1280x720 viewport: headless Chrome's window chrome
  // otherwise shrinks it and the canvas (and its HUD) gets cropped.
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(1800);
}

async function evaluate(send, expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text || 'exception' };
  return r.result?.result?.value;
}

async function dispatchKey(send, type, code, key, keyCode) {
  await send('Input.dispatchKeyEvent', {
    type,
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

async function press(send, code, key, keyCode, holdMs = 90) {
  await dispatchKey(send, 'keyDown', code, key, keyCode);
  await sleep(holdMs);
  await dispatchKey(send, 'keyUp', code, key, keyCode);
}

async function hold(send, code, key, keyCode, ms) {
  await dispatchKey(send, 'keyDown', code, key, keyCode);
  await sleep(ms);
  await dispatchKey(send, 'keyUp', code, key, keyCode);
}

async function screenshot(send, path, quality = 82) {
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: true });
  const buf = Buffer.from(r.result.data, 'base64');
  writeFileSync(path, buf);
  return buf.length;
}

function consoleErrors(events) {
  return events
    .filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
    .map((e) => JSON.stringify(e.params).slice(0, 400));
}

const proc = await launchChrome();
try {
  const { ws, send, events } = await connect();

  if (MODE === 'shots') {
    const shots = JSON.parse((await import('node:fs')).readFileSync('shots.json', 'utf8'));
    mkdirSync('screenshots', { recursive: true });
    await navigate(send, `${BASE}/index.html${shots[0].query}`);
    const geo = await evaluate(send, `(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { innerW: window.innerWidth, innerH: window.innerHeight, canvasTop: Math.round(r.top), canvasH: Math.round(r.height) }; })()`);
    console.log('viewport:', JSON.stringify(geo));
    for (const s of shots) {
      await navigate(send, `${BASE}/index.html${s.query}`);
      const size = await screenshot(send, `screenshots/${s.name}`);
      console.log(`${s.name}: ${size} bytes`);
    }
    // Determinism: re-shoot the cover and compare bytes.
    await navigate(send, `${BASE}/index.html?shot=cover&seed=7`);
    const again = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    const againBuf = Buffer.from(again.result.data, 'base64');
    const firstBuf = (await import('node:fs')).readFileSync('screenshots/1-cover.jpg');
    console.log(`cover re-shoot byte-identical: ${againBuf.equals(firstBuf)}`);
    console.log('console errors:', JSON.stringify(consoleErrors(events)));
  } else if (MODE === 'playtest') {
    await navigate(send, `${BASE}/index.html`);
    console.log('phase at load:', await evaluate(send, 'window.__halcyon.world.phase'));
    await press(send, 'Space', ' ', 32);
    await sleep(300);
    console.log('phase after Space:', await evaluate(send, 'window.__halcyon.world.phase'));
    await press(send, 'Space', ' ', 32);
    await sleep(300);
    console.log('phase after Space 2:', await evaluate(send, 'window.__halcyon.world.phase'));
    // Walk up-left toward the tables, then right along the top aisle.
    await hold(send, 'KeyW', 'w', 87, 900);
    await hold(send, 'KeyD', 'd', 68, 1200);
    await hold(send, 'KeyW', 'w', 87, 600);
    const state = await evaluate(send, `(() => { const w = window.__halcyon.world; return { phase: w.phase, x: Math.round(w.player.x), y: Math.round(w.player.y), alarm: Math.round(w.alarm), score: w.score, loot: w.lootGot }; })()`);
    console.log('state after walk:', JSON.stringify(state));
    // Toss a coin with the mouse toward the middle of the room.
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 300, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 300, button: 'left', clickCount: 1 });
    await sleep(1200);
    console.log('after coin:', JSON.stringify(await evaluate(send, `(() => { const w = window.__halcyon.world; return { coins: w.player.gadgets.coin, guards: w.guards.map(g => g.state) }; })()`)));
    // Pause and resume.
    await press(send, 'KeyP', 'p', 80);
    await sleep(200);
    await press(send, 'KeyP', 'p', 80);
    await sleep(400);
    const size = await screenshot(send, 'screenshots/playtest-live.jpg', 80);
    console.log(`playtest-live.jpg: ${size} bytes (extra file, deleted before submit)`);
    console.log('console errors:', JSON.stringify(consoleErrors(events)));
    console.log('phase at end:', await evaluate(send, 'window.__halcyon.world.phase'));
  }
  ws.close();
} finally {
  proc.kill();
}

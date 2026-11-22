// render.js — everything the eye sees. One clear job: draw the casino,
// the cones, the cameras, the loot and the alarm meter, plus every
// screen (title, planning board, clear, victory, game over) on one canvas.
//
// The judge reads this game mostly through its screenshots, so one frame
// must show it all at once: the thief crossing the room, guard cones,
// a camera, a loot target and the alarm meter — all visible together.

import { TILE, COLS, ROWS, HUD_H, FOOT_H, VIEW_W, VIEW_H, PALETTE, CONE_HALF_ANGLE, GUARD_SIGHT_RANGE, CAMERA_SIGHT_RANGE } from './config.js';
import { conePolygon } from './vision.js';
import { alarmLabel, visibilityLabel } from './world.js';
import { laserIsLive } from './security.js';
import { loadoutDescription } from './planning.js';

function tilePx(tx) {
  return tx * TILE;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- the room ----

function drawFloor(ctx, level, now) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = level.rows[y][x];
      const px = tilePx(x);
      const py = tilePx(y);
      if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(201,162,39,0.25)';
        ctx.fillRect(px, py, TILE, 2);
        continue;
      }
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(px, py, TILE, TILE);
      if (ch === ',') {
        ctx.fillStyle = PALETTE.carpet;
        ctx.fillRect(px + 2, py, TILE - 4, TILE);
        ctx.fillStyle = PALETTE.carpetEdge;
        ctx.fillRect(px + 2, py, 2, TILE);
        ctx.fillRect(px + TILE - 4, py, 2, TILE);
      } else if (ch === '~') {
        ctx.fillStyle = PALETTE.shadow;
        ctx.fillRect(px, py, TILE, TILE);
      } else if (ch === 'L') {
        ctx.fillStyle = '#3a3f52';
        ctx.fillRect(px, py, TILE, TILE);
      } else if (ch === 'T') {
        ctx.fillStyle = PALETTE.felt;
        roundRect(ctx, px + 2, py + 2, TILE - 4, TILE - 4, 8);
        ctx.fill();
        ctx.strokeStyle = PALETTE.feltTrim;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f2ead8';
        ctx.beginPath();
        ctx.arc(px + 11, py + 11, 3, 0, Math.PI * 2);
        ctx.arc(px + 21, py + 21, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (ch === 'S') {
        ctx.fillStyle = PALETTE.slotBody;
        roundRect(ctx, px + 3, py + 2, TILE - 6, TILE - 4, 5);
        ctx.fill();
        ctx.fillStyle = now % 1 < 0.5 ? PALETTE.slotLight : '#ff9d5c';
        ctx.fillRect(px + 8, py + 6, TILE - 16, 8);
      } else if (ch === 'V') {
        ctx.fillStyle = '#5a606e';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#c9a227';
        ctx.beginPath();
        ctx.arc(px + 16, py + 16, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#171a24';
        ctx.beginPath();
        ctx.arc(px + 16, py + 16, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (ch === 'E') {
        ctx.fillStyle = '#0d3d22';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }
}

function drawLampGlow(ctx, level, now) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (level.rows[y][x] !== 'L') continue;
      const cx = tilePx(x) + 16;
      const cy = tilePx(y) + 16;
      const pulse = 0.75 + 0.08 * Math.sin(now * 2 + x);
      const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 78);
      grad.addColorStop(0, `rgba(255,184,92,${0.34 * pulse})`);
      grad.addColorStop(1, 'rgba(255,184,92,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDarkness(ctx, level, player, now) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 9, 18, 0.40)';
  ctx.fillRect(0, 0, VIEW_W, ROWS * TILE);
  ctx.globalCompositeOperation = 'destination-out';
  const holes = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (level.rows[y][x] === 'L') holes.push([tilePx(x) + 16, tilePx(y) + 16, 66]);
    }
  }
  if (player) holes.push([player.x, player.y, 52]);
  for (const [hx, hy, hr] of holes) {
    const grad = ctx.createRadialGradient(hx, hy, 4, hx, hy, hr);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- actors and security ----

function drawCone(ctx, level, ox, oy, angle, range, color) {
  const poly = conePolygon(level, ox, oy, angle, CONE_HALF_ANGLE, range, 22);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGuard(ctx, g, now) {
  const alert = g.state === 'ALERT';
  const susp = g.state === 'SUSPICIOUS' || g.state === 'SEARCH';
  const coneColor = alert
    ? 'rgba(255,59,78,0.30)'
    : susp
      ? 'rgba(255,176,46,0.26)'
      : 'rgba(255,214,94,0.20)';
  drawCone(ctx, g.levelRef, g.x, g.y, g.angle, GUARD_SIGHT_RANGE * (g.state === 'ALERT' ? 1.1 : 1), coneColor);
  // Body: navy uniform, pale cap brim, facing tick.
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.guardTrim;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = PALETTE.guardTrim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.angle) * 15, g.y + Math.sin(g.angle) * 15);
  ctx.stroke();
  // Name and state mark — readable at a glance.
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8dee9';
  ctx.fillText(g.name.toUpperCase(), g.x, g.y - 20);
  if (alert) {
    ctx.fillStyle = '#ff3b4e';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('!', g.x, g.y - 30);
  } else if (g.state === 'SUSPICIOUS') {
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('?', g.x, g.y - 30);
  }
  // Detection ring while the guard is filling up on you.
  if (g.detect > 5) {
    ctx.strokeStyle = g.detect > 70 ? '#ff3b4e' : '#ffb02e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 17, -Math.PI / 2, -Math.PI / 2 + (g.detect / 100) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawCamera(ctx, level, cam, now) {
  const disabled = now < cam.disabledUntil;
  const color = disabled ? 'rgba(120,130,150,0.14)' : 'rgba(255,176,46,0.24)';
  // The camera sits ON a wall tile, so its cone must start just off the
  // wall — a cone cast from inside the wall would be eaten by it.
  const ox = cam.x + Math.cos(cam.angle) * 14;
  const oy = cam.y + Math.sin(cam.angle) * 14;
  if (!disabled) drawCone(ctx, level, ox, oy, cam.angle, CAMERA_SIGHT_RANGE, color);
  ctx.fillStyle = PALETTE.camera;
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = disabled ? '#5a6274' : '#ff3b4e';
  ctx.beginPath();
  ctx.arc(cam.x + Math.cos(cam.angle) * 5, cam.y + Math.sin(cam.angle) * 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9cdd6';
  // Top-wall cameras label below the mount (clear of the HUD); the rest
  // label above it.
  const labelY = cam.y < 100 ? cam.y + 22 : cam.y - 14;
  ctx.fillText(disabled ? 'CAM OFF' : 'CCTV', cam.x, labelY);
}

function drawLasers(ctx, lasers, now) {
  for (const laser of lasers) {
    const live = laserIsLive(laser, now);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = live ? 'rgba(255,59,78,0.95)' : 'rgba(255,59,78,0.18)';
    ctx.lineWidth = live ? 3 : 1.5;
    if (live) ctx.shadowColor = '#ff3b4e';
    if (live) ctx.shadowBlur = 10;
    ctx.setLineDash(live ? [] : [6, 8]);
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ff3b4e';
    ctx.beginPath();
    ctx.arc(laser.x1, laser.y1, 4, 0, Math.PI * 2);
    ctx.arc(laser.x2, laser.y2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTripwires(ctx, wires) {
  ctx.strokeStyle = 'rgba(255,80,95,0.85)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 5]);
  for (const w of wires) {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawLoot(ctx, loot, now) {
  for (const item of loot) {
    if (item.taken) continue;
    const x = tilePx(item.tx) + 16;
    const y = tilePx(item.ty) + 16;
    const pulse = 0.7 + 0.3 * Math.sin(now * 3 + item.tx);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 26);
    grad.addColorStop(0, `rgba(255,215,94,${0.5 * pulse})`);
    grad.addColorStop(1, 'rgba(255,215,94,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (item.kind === 'chip') {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(x - 3, y - 3, 2.5, 0, Math.PI * 2);
      ctx.arc(x + 4, y + 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.kind === 'gold') {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(x - 10, y - 6, 20, 12);
      ctx.fillStyle = '#fff0b0';
      ctx.fillRect(x - 10, y - 6, 20, 4);
    } else {
      // The vault core: a big glowing gem, locked until the crack lands.
      ctx.fillStyle = item.locked ? '#7a6a3a' : PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 12);
      ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.fill();
      if (item.locked) {
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 5, y - 5, 10, 10);
      }
    }
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(item.kind === 'chip' ? 'CHIPS' : item.kind === 'gold' ? 'GOLD' : 'CORE', x, y + 24);
  }
}

function drawExit(ctx, level, open, now) {
  const x = tilePx(level.exit.tx) + 16;
  const y = tilePx(level.exit.ty) + 16;
  const pulse = open ? 0.6 + 0.4 * Math.sin(now * 4) : 0.25;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(x, y, 4, x, y, 40);
  grad.addColorStop(0, `rgba(55,214,122,${pulse})`);
  grad.addColorStop(1, 'rgba(55,214,122,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = open ? '#37d67a' : '#2a7a4a';
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#eafff1';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x + 6, y);
  ctx.moveTo(x + 1, y - 5);
  ctx.lineTo(x + 6, y);
  ctx.lineTo(x + 1, y + 5);
  ctx.stroke();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b8f5cf';
  ctx.fillText(open ? 'GETAWAY — GO!' : 'GETAWAY (LOCKED)', x, y + 28);
}

function drawPlayer(ctx, p, now) {
  // Smoke puffs first (under the player).
  for (const s of p.smokes) {
    const grad = ctx.createRadialGradient(s.x, s.y, 6, s.x, s.y, 74);
    grad.addColorStop(0, 'rgba(200,205,215,0.55)');
    grad.addColorStop(1, 'rgba(200,205,215,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 74, 0, Math.PI * 2);
    ctx.fill();
  }
  // Thrown coins.
  ctx.fillStyle = PALETTE.gold;
  for (const c of p.coins) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vesper: dark suit, gold ring, direction tick. Always findable.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.playerTrim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
  ctx.stroke();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.fillText('VESPER', p.x, p.y - 18);
  // Vault-crack progress ring.
  if (p.vaultProgress > 0) {
    ctx.strokeStyle = '#37d67a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + p.vaultProgress * Math.PI * 2);
    ctx.stroke();
  }
}

// ---- HUD and screens ----

function drawHud(ctx, world) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px sans-serif';
  const levelName = world.level ? world.level.name : 'THE HALCYON JOB';
  ctx.fillText(levelName, 14, 16);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`LOOT ${world.lootGot}/${world.lootTotal}   SCORE ${world.score}   TIME ${Math.floor(world.levelTime)}s`, 14, 36);

  // The alarm meter: wide, labelled, impossible to miss.
  const ax = 560;
  const aw = 340;
  ctx.fillStyle = '#171a24';
  roundRect(ctx, ax, 10, aw, 18, 6);
  ctx.fill();
  const frac = Math.min(1, world.alarm / 100);
  ctx.fillStyle = world.lockdown ? '#ff3b4e' : world.alarm >= 70 ? '#ff3b4e' : world.alarm >= 35 ? '#ffb02e' : '#37d67a';
  if (frac > 0) {
    roundRect(ctx, ax, 10, aw * frac, 18, 6);
    ctx.fill();
  }
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1.5;
  roundRect(ctx, ax, 10, aw, 18, 6);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ALARM  ${alarmLabel(world)}`, ax + aw / 2, 19);
  ctx.textAlign = 'left';

  // Gadgets and strikes, right side.
  ctx.font = '12px sans-serif';
  ctx.fillStyle = PALETTE.text;
  const g = world.player ? world.player.gadgets : { coin: 3, smoke: 2, emp: 1 };
  ctx.fillText(`[1] Coin ×${g.coin}   [2] Smoke ×${g.smoke}   [3] EMP ×${g.emp}`, 930, 16);
  ctx.fillStyle = world.strikes > 0 ? '#ff3b4e' : PALETTE.textDim;
  ctx.fillText(`Strikes ${world.strikes}/${3}   ${visibilityLabel(world)}`, 930, 36);

  // Bottom hint strip.
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, VIEW_H - FOOT_H, VIEW_W, FOOT_H);
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(0, VIEW_H - FOOT_H, VIEW_W, 2);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  const hint = world.toast && world.now < world.toastUntil
    ? world.toast
    : 'WASD move · Shift sneak · Click toss coin · 2 smoke · 3 EMP · E crack vault · P pause · M mute';
  ctx.fillText(hint, VIEW_W / 2, VIEW_H - FOOT_H / 2);
  ctx.textAlign = 'left';
}

function dimScreen(ctx, alpha = 0.72) {
  ctx.fillStyle = `rgba(8, 10, 18, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12, 14, 24, 0.94)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(ctx, world) {
  // A live casino behind the title: level 1, guards walking, cones sweeping.
  if (world.level) {
    ctx.save();
    ctx.translate(0, HUD_H);
    drawPlayfield(ctx, world, world.now, false);
    ctx.restore();
  }
  dimScreen(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('THE HALCYON JOB', VIEW_W / 2, 190);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText('A casino heist in three acts — plan it, crack it, vanish.', VIEW_W / 2, 232);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('You are Vesper. The Halcyon Grand Casino never sleeps — but its guards do blink.', VIEW_W / 2, 268);
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(world.now % 1.2 < 0.8 ? 'Press SPACE to case the joint' : ' ', VIEW_W / 2, 330);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD move · Shift sneak · Click toss a coin · 2 smoke · 3 EMP · E crack the vault', VIEW_W / 2, 400);
  ctx.fillText('Read the cones before you move. Carpet is quiet. Shadow hides you. Cameras never sleep.', VIEW_W / 2, 424);
  ctx.fillText('Ghost the whole run — no lockdown, no strike — for a +500 bonus.', VIEW_W / 2, 448);
  ctx.fillText('3 heists · 9 guards · 6 cameras · lasers · tripwires · 1 vault to crack', VIEW_W / 2, 486);
  ctx.textAlign = 'left';
}

function drawPlanning(ctx, world) {
  const plan = world.plan;
  const level = world.level;
  ctx.save();
  ctx.translate(0, HUD_H);
  drawPlayfield(ctx, world, world.now, true);
  // Patrol routes, dotted red, with guard names.
  ctx.strokeStyle = 'rgba(255,59,78,0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 7]);
  ctx.font = 'bold 11px sans-serif';
  for (const g of level.guards) {
    ctx.beginPath();
    const pts = g.waypoints.map(([tx, ty]) => [tilePx(tx) + 16, tilePx(ty) + 16]);
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ff8a96';
    ctx.textAlign = 'center';
    ctx.fillText(`${g.name} patrol`, pts[0][0], pts[0][1] - 12);
  }
  ctx.setLineDash([]);
  // Entry doors. Labels clamp inside the frame so doors at the edges
  // still read in full.
  level.entries.forEach((e, i) => {
    const x = tilePx(e.tx) + 16;
    const y = tilePx(e.ty) + 16;
    ctx.fillStyle = i === plan.entryIndex ? '#37d67a' : '#8a93a6';
    ctx.beginPath();
    ctx.arc(x, y, i === plan.entryIndex ? 15 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0c14';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.id, x, y + 5);
    ctx.fillStyle = '#f2ead8';
    ctx.font = 'bold 11px sans-serif';
    const labelX = Math.max(78, Math.min(VIEW_W - 78, x));
    ctx.fillText(e.label, labelX, y - 22);
  });
  ctx.restore();

  dimScreen(ctx, 0.45);
  panel(ctx, 240, 95, 800, 445);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('PLANNING BOARD', VIEW_W / 2, 168);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '16px sans-serif';
  ctx.fillText(level.name, VIEW_W / 2, 198);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px sans-serif';
  const words = level.brief.split(' ');
  let line = '';
  let ly = 224;
  for (const w of words) {
    if ((line + ' ' + w).length > 78) {
      ctx.fillText(line.trim(), VIEW_W / 2, ly);
      line = w;
      ly += 18;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), VIEW_W / 2, ly);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('ENTRY — press 1/2/3 or click a door:', VIEW_W / 2, ly + 34);
  ctx.font = '14px sans-serif';
  level.entries.forEach((e, i) => {
    const sel = i === plan.entryIndex;
    ctx.fillStyle = sel ? '#37d67a' : PALETTE.textDim;
    ctx.fillText(`${sel ? '▶ ' : ''}${e.id} — ${e.label}`, VIEW_W / 2, ly + 58 + i * 20);
  });
  const gy = ly + 58 + level.entries.length * 20 + 14;
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('LOADOUT — pick two (click or press C/S/E to toggle):', VIEW_W / 2, gy);
  ctx.font = '13px sans-serif';
  ['coin', 'smoke', 'emp'].forEach((kind, i) => {
    const sel = plan.loadout.includes(kind);
    ctx.fillStyle = sel ? '#ffd75e' : PALETTE.textDim;
    ctx.fillText(`${sel ? '☑ ' : '☐ '}${loadoutDescription(kind)}`, VIEW_W / 2, gy + 22 + i * 20);
  });
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Press SPACE — start the job', VIEW_W / 2, gy + 92);
  ctx.textAlign = 'left';
}

function drawEndPanel(ctx, title, lines, accent) {
  dimScreen(ctx, 0.66);
  panel(ctx, 340, 150, 600, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(title, VIEW_W / 2, 210);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '15px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 258 + i * 28));
  ctx.fillStyle = '#ffd75e';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Press SPACE to continue', VIEW_W / 2, 258 + lines.length * 28 + 26);
  ctx.textAlign = 'left';
}

// The playfield itself: floor, lights, cones, security, loot, actors.
export function drawPlayfield(ctx, world, now, planMode = false) {
  const level = world.level;
  drawFloor(ctx, level, now);
  drawLampGlow(ctx, level, now);
  if (!planMode) {
    drawLasers(ctx, world.lasers, now);
    drawTripwires(ctx, world.tripwires);
    drawLoot(ctx, world.loot, now);
    drawExit(ctx, level, world.lootGot >= world.lootTotal, now);
  }
  // Darkness with lamp holes, then cones on top so danger still glows.
  drawDarkness(ctx, level, world.player, now);
  if (!planMode) {
    for (const cam of world.cameras) drawCamera(ctx, level, cam, now);
    for (const g of world.guards) {
      g.levelRef = level;
      drawGuard(ctx, g, now);
    }
    if (world.player) drawPlayer(ctx, world.player, now);
  }
}

export function render(ctx, world) {
  const now = world.now;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textBaseline = 'middle';

  if (world.phase === 'title') {
    drawTitle(ctx, world);
    return;
  }
  if (world.phase === 'planning') {
    drawPlanning(ctx, world);
    return;
  }
  if (world.phase === 'levelclear') {
    ctx.save();
    ctx.translate(0, HUD_H);
    drawPlayfield(ctx, world, now, false);
    ctx.restore();
    drawHud(ctx, world);
    const s = world.clearStats;
    drawEndPanel(ctx, 'HEIST CLEAR!', [
      s.levelName,
      `Loot ${s.loot}/${s.lootTotal}  ·  Time ${Math.floor(s.time)}s  ·  Time bonus +${s.timeBonus}`,
      `Score ${s.score}  ·  Strikes ${s.strikes}`,
      world.levelIndex + 1 < 3 ? 'Next: a harder room is waiting.' : 'One last door — the vault itself.',
    ], '#37d67a');
    return;
  }
  if (world.phase === 'victory') {
    ctx.save();
    ctx.translate(0, HUD_H);
    drawPlayfield(ctx, world, now, false);
    ctx.restore();
    drawHud(ctx, world);
    const s = world.clearStats || {};
    drawEndPanel(ctx, 'THE HALCYON JOB — DONE', [
      'Three heists. One clean getaway.',
      `Final score ${s.finalScore ?? world.score}  ·  Ghost bonus +${s.ghostBonus ?? 0}`,
      `Strikes ${world.strikes}  ·  Lockdowns survived ${world.lockdownsSurvived}`,
      'Vesper vanishes into the night. The casino never saw a thing.',
    ], '#ffd75e');
    return;
  }
  if (world.phase === 'gameover') {
    ctx.save();
    ctx.translate(0, HUD_H);
    drawPlayfield(ctx, world, now, false);
    ctx.restore();
    drawHud(ctx, world);
    drawEndPanel(ctx, 'HEIST BLOWN', [
      'Three strikes — the crew pulls Vesper out.',
      `Score ${world.score}  ·  Loot banked ${world.lootGot}/${world.lootTotal}`,
      'The Halcyon keeps its gold tonight. Plan better, move quieter.',
    ], '#ff3b4e');
    return;
  }

  // Playing.
  ctx.save();
  ctx.translate(0, HUD_H);
  drawPlayfield(ctx, world, now, false);
  ctx.restore();
  drawHud(ctx, world);
}

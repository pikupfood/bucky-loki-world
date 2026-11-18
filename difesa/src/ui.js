// Interfaccia 2D sopra il mondo 3D. Stile "immediato": a ogni frame si disegna e si registrano
// le aree toccabili in ui.buttons. S = { c, game, meta, ui, vw, vh, P, A, now }.
import { TOWERS, TOWER_ORDER, ENEMIES, LEVELS, WALL_X } from './data.js';
import { BUILDINGS, BUILDING_ORDER, CROPS, CROP_ORDER, PLOTS, MAX_LEVEL } from './meta.js';
import { VILLAGE, THEMES } from './ground.js';
import { drawTower, drawEnemy } from './icons.js';
import { drawFx, tracePoly } from './fx.js';
import { t, LANGS, getLang } from './i18n.js';

const F = '"Trebuchet MS","Segoe UI",Roboto,sans-serif';
const GOLD = '#e9c46a', CREAM = '#f5ecd7', DIM = '#cbbf9f', TAU = Math.PI * 2;

function txt(c, s, x, y, size, color = CREAM, align = 'left', weight = 700) {
  c.font = `${weight} ${size}px ${F}`; c.textAlign = align; c.textBaseline = 'middle';
  c.fillStyle = color; c.fillText(s, x, y);
}
function width(c, s, size, weight = 700) { c.font = `${weight} ${size}px ${F}`; return c.measureText(s).width; }
function panel(c, x, y, w, h, r = 12, alpha = 0.86) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  c.fillStyle = `rgba(26,20,14,${alpha})`; c.fill();
  c.strokeStyle = 'rgba(233,196,106,0.55)'; c.lineWidth = 2; c.stroke();
}
function title2(c, s, x, y, size, color) {
  c.font = `800 ${size}px ${F}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(4, size / 8); c.strokeStyle = 'rgba(20,12,6,0.9)'; c.lineJoin = 'round'; c.strokeText(s, x, y);
  c.fillStyle = color; c.fillText(s, x, y);
}
function wrap(c, s, x, y, maxW, size, color, lh) {
  c.font = `600 ${size}px ${F}`;
  let line = '', yy = y;
  for (const w of s.split(' ')) {
    if (c.measureText(line + w).width > maxW && line) { txt(c, line.trim(), x, yy, size, color, 'center', 600); line = ''; yy += lh; }
    line += w + ' ';
  }
  if (line.trim()) txt(c, line.trim(), x, yy, size, color, 'center', 600);
  return yy;
}

// ---------- icone ----------
function heart(c, x, y, s) {
  c.fillStyle = '#e5484d'; c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.2, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.2, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); c.fill();
}
function coin(c, x, y, r) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.58, 0, TAU); c.strokeStyle = '#b98a1c'; c.lineWidth = 1.4; c.stroke();
}
function drop(c, x, y, r) {      // linfa: la risorsa di battaglia
  c.beginPath(); c.moveTo(x, y - r * 1.25);
  c.bezierCurveTo(x + r * 1.3, y, x + r * 0.9, y + r, x, y + r);
  c.bezierCurveTo(x - r * 0.9, y + r, x - r * 1.3, y, x, y - r * 1.25);
  c.fillStyle = '#5fd27a'; c.fill(); c.strokeStyle = '#1f6b3a'; c.lineWidth = 1.6; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(x - r * 0.3, y + r * 0.1, r * 0.22, 0, TAU); c.fill();
}
function star(c, x, y, r, on) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = on ? '#ffd24a' : 'rgba(255,255,255,0.14)'; c.fill();
  c.strokeStyle = on ? '#8a6410' : 'rgba(255,255,255,0.25)'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
}
function lock(c, x, y, s) {
  c.strokeStyle = '#cbbf9f'; c.lineWidth = s * 0.28; c.beginPath(); c.arc(x, y - s * 0.3, s * 0.5, Math.PI, 0); c.stroke();
  c.fillStyle = '#cbbf9f'; c.beginPath(); c.roundRect(x - s * 0.8, y - s * 0.3, s * 1.6, s * 1.25, s * 0.2); c.fill();
}
function moon(c, x, y, r) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  c.fillStyle = '#dfe6ff'; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.fillStyle = '#1a140e'; c.beginPath(); c.arc(x + r * 0.45, y - r * 0.25, r * 0.85, 0, TAU); c.fill(); c.restore();
}
function sun(c, x, y, r) {
  c.strokeStyle = '#ffd24a'; c.lineWidth = 2.4; c.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25); c.lineTo(x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7); c.stroke(); }
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#ffd24a'; c.fill();
}
function bolt(c, x, y, s, col = '#ffe27a') {
  c.beginPath(); c.moveTo(x + s * 0.2, y - s); c.lineTo(x - s * 0.55, y + s * 0.1); c.lineTo(x - s * 0.05, y + s * 0.1); c.lineTo(x - s * 0.25, y + s); c.lineTo(x + s * 0.55, y - s * 0.2); c.lineTo(x + s * 0.05, y - s * 0.2); c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = '#7a5a10'; c.lineWidth = 1.5; c.lineJoin = 'round'; c.stroke();
}

function button(c, ui, x, y, w, h, label, o, fn) {
  o = o || {};
  const col = o.disabled ? '#4a4640' : (o.color || '#3a6b35'), r = o.r ?? 12;
  c.beginPath(); c.roundRect(x, y + 3, w, h, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = col; c.fill();
  c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h * 0.45, Math.max(2, r - 2)); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
  c.beginPath(); c.roundRect(x, y, w, h, r); c.strokeStyle = o.disabled ? 'rgba(255,255,255,0.15)' : (o.stroke || 'rgba(255,236,170,0.75)'); c.lineWidth = 2; c.stroke();
  if (label) txt(c, label, x + w / 2, y + h / 2 + 1, o.fs || 22, o.disabled ? '#9a948a' : (o.fg || CREAM), 'center', 800);
  ui.buttons.push({ x, y, w, h, fn: fn || (() => {}) });
}
function block(ui, x, y, w, h) { ui.buttons.push({ x, y, w, h, fn: () => {} }); }
function dim(S, a) { S.c.fillStyle = `rgba(8,8,18,${a})`; S.c.fillRect(0, 0, S.vw, S.vh); block(S.ui, 0, 0, S.vw, S.vh); }
function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + ' s';
  if (s < 3600) return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min';
}
function fmtDur(secs) { return secs < 3600 ? Math.round(secs / 60) + ' min' : Math.round(secs / 3600) + ' h'; }
function bubble(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); c.strokeStyle = 'rgba(20,14,8,0.8)'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(x - r * 0.4, y + r * 0.85); c.lineTo(x, y + r * 1.5); c.lineTo(x + r * 0.4, y + r * 0.85); c.fillStyle = fill; c.fill(); }

function langRow(S, cx, y) {
  const { c, ui, A } = S, bw = 62, gap = 10, total = LANGS.length * (bw + gap) + 150;
  let x = cx - total / 2;
  for (const l of LANGS) { button(c, ui, x, y, bw, 44, l.toUpperCase(), { color: getLang() === l ? '#8a5a1c' : '#3b3229', fs: 18 }, () => A.lang(l)); x += bw + gap; }
  button(c, ui, x, y, 150, 44, `${t('sound')}: ${ui.sound ? t('on') : t('off')}`, { color: '#3b3229', fs: 17 }, A.sound);
}

// =====================================================================
//  BATTAGLIA
// =====================================================================
let veil = null;
function night(S) {
  const { c, game, ui, vw, vh, P } = S, a = ui.night;
  if (a < 0.01) return;
  const L = game.level, q = 4, w = Math.ceil(vw / q), h = Math.ceil(vh / q), rgb = THEMES[L.theme].veil;
  if (!veil) veil = document.createElement('canvas');
  if (veil.width !== w || veil.height !== h) { veil.width = w; veil.height = h; }
  const l = veil.getContext('2d');
  l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, w, h);
  l.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.46 * a})`; l.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'destination-out';
  const hole = (x, y, hgt, r, al) => {
    const p = P.pt(x, y, hgt), lr = r * P.sc(x, y) / q;
    const g = l.createRadialGradient(p.x / q, p.y / q, 0, p.x / q, p.y / q, lr);
    g.addColorStop(0, `rgba(0,0,0,${al})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.beginPath(); l.arc(p.x / q, p.y / q, lr, 0, TAU); l.fill();
  };
  for (const tw of game.towers) hole(tw.x, tw.y, 30, 125, 0.82);
  hole(WALL_X + 20, L.gate.y, 20, 200, 0.85);
  for (const hp of [[1400, 110], [1400, 570], [1500, 300], [1560, L.gate.y > 360 ? L.gate.y - 150 : L.gate.y + 150], [1450, 430], [1600, 500]]) hole(hp[0], hp[1], 20, 150, 0.75);
  hole(L.portal.x, L.portal.y, 30, 120, 0.6);
  for (const p of game.projs) if (p.k === 'orb') hole(p.x, p.y, p.h, 55, 0.7);
  for (const e of game.enemies) hole(e.x, e.y, 16, e.boss ? 80 : 46, 0.55);     // i nemici si vedono sempre
  c.imageSmoothingEnabled = true; c.drawImage(veil, 0, 0, w, h, 0, 0, w * q, h * q);
  c.globalCompositeOperation = 'lighter';
  const glow = (x, y, hgt, r, col) => { const p = P.pt(x, y, hgt), rr = r * P.sc(x, y); const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.fill(); };
  const fl = 0.9 + Math.sin(ui.time * 9) * 0.05;
  glow(WALL_X, L.gate.y - 56, 44, 60, `rgba(255,190,90,${0.32 * a * fl})`);
  glow(WALL_X, L.gate.y + 56, 44, 60, `rgba(255,190,90,${0.32 * a * fl})`);
  glow(L.portal.x, L.portal.y, 40, 110, `rgba(150,70,255,${0.34 * a})`);
  c.globalCompositeOperation = 'source-over';
}

function battleWorld(S) {
  const { c, game, ui, P } = S, L = game.level;
  const building = game.status === 'build' && !game.over;
  // piazzole libere: anello che pulsa di giorno
  for (let i = 0; i < L.spots.length; i++) {
    if (game.spotTower[i]) continue;
    const sel = ui.sel && ui.sel.kind === 'spot' && ui.sel.idx === i;
    if (!building && !sel) continue;
    const s = L.spots[i], p = 0.5 + Math.sin(ui.time * 3.2 + i * 0.4) * 0.5;
    c.strokeStyle = sel ? 'rgba(255,224,120,0.95)' : `rgba(255,236,170,${0.3 + p * 0.5})`; c.lineWidth = sel ? 3.5 : 2.5;
    tracePoly(c, P.circle(s.x, s.y, 37 + p * 5, 26)); c.stroke();
  }
  if (ui.sel && ui.sel.kind === 'tower') {
    const tw = ui.sel.tower;
    tracePoly(c, P.circle(tw.x, tw.y, game.range(tw), 56));
    c.fillStyle = 'rgba(255,240,180,0.13)'; c.fill(); c.strokeStyle = 'rgba(255,236,170,0.9)'; c.lineWidth = 2.5; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
  }
  for (const e of game.enemies) {
    if (e.slowF < 1) { c.strokeStyle = 'rgba(110,230,150,0.9)'; c.lineWidth = 2.5; tracePoly(c, P.circle(e.x, e.y, e.r * 1.15, 14)); c.stroke(); }
    if (e.burnT > 0) {      // fiammella sui nemici che bruciano
      const q = P.pt(e.x, e.y, e.r * 2.6 + 4), fr = (5 + Math.sin(ui.time * 14 + e.id) * 1.6) * P.sc(e.x, e.y) * 1.5;
      c.fillStyle = 'rgba(255,130,40,0.92)'; c.beginPath(); c.arc(q.x, q.y, fr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,232,130,0.95)'; c.beginPath(); c.arc(q.x, q.y + fr * 0.25, fr * 0.5, 0, TAU); c.fill();
    }
    if (e.hp < e.maxHp || e.boss) {
      const p = P.pt(e.x, e.y, e.r * 3 + 12), sc = P.sc(e.x, e.y), w = Math.max(26, e.r * 2 + 8) * sc, f = Math.max(0, e.hp / e.maxHp), bh = e.boss ? 7 : 5;
      c.fillStyle = 'rgba(15,10,8,0.8)'; c.beginPath(); c.roundRect(p.x - w / 2 - 1.5, p.y - 1.5, w + 3, bh + 3, 3); c.fill();
      c.fillStyle = f > 0.55 ? '#6fd45a' : f > 0.25 ? '#f1c232' : '#e0452f'; c.beginPath(); c.roundRect(p.x - w / 2, p.y, w * f, bh, 2); c.fill();
    }
  }
  drawFx(c, ui.fx, P);
  night(S);
  drawFx(c, ui.fxTop, P);
}

function battleHud(S) {
  const { c, game, ui, vw, vh, A } = S, L = game.level;
  panel(c, 14, 10, 232, 48);
  heart(c, 40, 35, 11); txt(c, String(game.lives), 58, 35, 24, game.lives <= 5 ? '#ff8a80' : CREAM);
  drop(c, 138, 34, 11); txt(c, String(game.gold), 158, 35, 24, '#9ff0b4');

  const n = Math.min(game.wave + 1, game.totalWaves), isNight = game.status === 'wave';
  const label = `${isNight ? t('night') : t('day')} ${game.wave + 1}${L.endless ? '' : '/' + game.totalWaves}`, lw = width(c, label, 24, 800) + 64;
  panel(c, vw / 2 - lw / 2, 10, lw, 48);
  if (isNight) moon(c, vw / 2 - lw / 2 + 28, 34, 12); else sun(c, vw / 2 - lw / 2 + 28, 34, 8);
  txt(c, label, vw / 2 - lw / 2 + 50, 35, 24, isNight ? '#cfd8ff' : '#ffe9a8', 'left', 800);

  button(c, ui, vw - 14 - 54, 10, 54, 48, '', { color: '#3b3229' }, A.pause);
  c.fillStyle = CREAM; c.fillRect(vw - 14 - 54 + 18, 24, 6, 20); c.fillRect(vw - 14 - 54 + 30, 24, 6, 20);
  button(c, ui, vw - 14 - 54 - 10 - 66, 10, 66, 48, 'x' + ui.speed, { color: ui.speed > 1 ? '#8a5a1c' : '#3b3229', fs: 22 }, A.speed);

  if (game.status === 'build') {
    const sum = L.summary(game.wave), types = Object.keys(sum), iw = width(c, t('incoming'), 17);
    const pw = 20 + iw + 14 + types.length * 74;
    panel(c, 14, vh - 14 - 56, pw, 56);
    txt(c, t('incoming'), 30, vh - 14 - 28, 17, DIM);
    let x = 30 + iw + 30;
    for (const ty of types) {
      const d = ENEMIES[ty], sc = Math.min(1, 15 / d.r) * 0.95;
      c.save(); c.translate(x, vh - 14 - 12); c.scale(sc, sc);
      drawEnemy(c, { type: ty, x: 0, y: 0, ang: 0, anim: 0.2, r: d.r, hp: 1, maxHp: 1, hit: 0, slowF: 1, boss: false }, ui.time);
      c.restore();
      txt(c, '×' + sum[ty], x + 16, vh - 14 - 26, 18, CREAM);
      x += 74;
    }
    // nemico mai visto: una riga che dice come affrontarlo
    const fresh = types.find(ty => ty !== 'orco' && !S.meta.d.seen[ty]);
    if (fresh && !ui.sel) {
      const tip = t('tip_' + fresh), head = t('newEnemy') + ': ' + t('e_' + fresh), tw2 = Math.max(width(c, tip, 16, 600), width(c, head, 18, 800)) + 92, ty0 = vh - 14 - 56 - 10 - 66;
      panel(c, 14, ty0, tw2, 66, 12, 0.92);
      const d = ENEMIES[fresh], sc = Math.min(1, 15 / d.r) * 1.15;
      c.save(); c.translate(48, ty0 + 54); c.scale(sc, sc); drawEnemy(c, { type: fresh, x: 0, y: 0, ang: 0, anim: 0.2, r: d.r, hp: 1, maxHp: 1, hit: 0, slowF: 1, boss: false }, ui.time); c.restore();
      txt(c, head, 84, ty0 + 22, 18, '#ffe9a8', 'left', 800); txt(c, tip, 84, ty0 + 46, 16, CREAM, 'left', 600);
    }
    const pulse = game.towers.length ? 0.5 + Math.sin(ui.time * 4) * 0.5 : 0;
    button(c, ui, vw - 14 - 230, vh - 14 - 64, 230, 64, t('startNight'), { color: '#2f7d3a', fs: 25, stroke: `rgba(255,236,170,${0.7 + pulse * 0.3})` }, A.start);
  } else if (game.status === 'wave') {
    const s = `${t('enemies')}: ${game.remaining}`, w = width(c, s, 20) + 36;
    panel(c, vw - 14 - w, vh - 14 - 46, w, 46);
    txt(c, s, vw - 14 - w / 2, vh - 14 - 22, 20, CREAM, 'center');
    // incantesimo Fulmine
    if (game.mods.spell) {
      const cx = vw - 14 - w - 54, cy = vh - 14 - 36, r = 34, ready = game.spellCd <= 0;
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fillStyle = ui.aiming ? '#8a5a1c' : ready ? '#4b3a8a' : '#33303a'; c.fill();
      c.strokeStyle = ready ? 'rgba(255,236,170,0.85)' : 'rgba(255,255,255,0.2)'; c.lineWidth = 2.5; c.stroke();
      bolt(c, cx, cy, 17, ready ? '#ffe27a' : '#8a8478');
      if (!ready) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * (game.spellCd / game.mods.spell.cd)); c.closePath(); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill(); }
      ui.buttons.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, fn: A.aim });
    }
  }
  let hint = null;
  if (ui.aiming) hint = t('spellAim');
  else if (game.status === 'build' && game.wave === 0 && !ui.sel && S.meta.d.wins === 0) hint = game.towers.length ? t('hintStart') : t('hintBuild');
  if (hint) { const w = width(c, hint, 21) + 44; panel(c, vw / 2 - w / 2, 74, w, 44, 22, 0.8); txt(c, hint, vw / 2, 97, 21, '#ffe9a8', 'center'); }
}

function buildMenu(S) {
  const { c, game, ui, vw, vh, P, A } = S, s = game.level.spots[ui.sel.idx];
  const cw = 118, ch = 152, gap = 8, pad = 12, n = TOWER_ORDER.length, w = pad * 2 + n * cw + (n - 1) * gap, h = ch + pad * 2;
  const p = P.pt(s.x, s.y, 0), x = Math.max(8, Math.min(vw - w - 8, p.x - w / 2));
  let y = p.y - 50 - h; if (y < 66) y = Math.min(vh - h - 8, p.y + 44);
  panel(c, x, y, w, h, 14, 0.94); block(ui, x, y, w, h);
  const LOCK = { mago: 'lockSantuario', catapulta: 'lockFucina', braciere: 'lockFucina3' };
  TOWER_ORDER.forEach((ty, i) => {
    const bx = x + pad + i * (cw + gap), by = y + pad, cost = TOWERS[ty].levels[0].cost, open = game.unlocked(ty), ok = open && game.gold >= cost;
    c.beginPath(); c.roundRect(bx, by, cw, ch, 10);
    c.fillStyle = ok ? 'rgba(74,92,58,0.95)' : 'rgba(56,52,48,0.95)'; c.fill();
    c.strokeStyle = ok ? 'rgba(255,236,170,0.7)' : 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.stroke();
    c.save(); c.translate(bx + cw / 2, by + 56); c.scale(0.78, 0.78); if (!ok) c.globalAlpha = open ? 0.5 : 0.25;
    drawTower(c, { type: ty, level: 0, x: 0, y: 0, angle: -0.6, fireAnim: 0 }, ui.time);
    c.restore();
    txt(c, t('t_' + ty), bx + cw / 2, by + 88, 16, ok ? CREAM : '#9a948a', 'center', 800);
    if (open) {
      txt(c, t('k_' + ty), bx + cw / 2, by + 108, 11.5, DIM, 'center', 600);
      const cs = String(cost), tw = width(c, cs, 18, 800);
      drop(c, bx + cw / 2 - tw / 2 - 8, by + 132, 7.5);
      txt(c, cs, bx + cw / 2 + 7, by + 133, 18, ok ? '#9ff0b4' : '#d9796f', 'center', 800);
    } else {
      lock(c, bx + cw / 2, by + 44, 13);
      txt(c, t(LOCK[ty]), bx + cw / 2, by + 124, 12, DIM, 'center', 700);
    }
    ui.buttons.push({ x: bx, y: by, w: cw, h: ch, tag: 'card', fn: () => A.build(ui.sel.idx, ty) });
  });
}

function towerPanel(S) {
  const { c, game, ui, vw, vh, P, A } = S, tw = ui.sel.tower, st = TOWERS[tw.type].levels[tw.level], up = game.upgradeCost(tw);
  const w = 340, h = 138, p = P.pt(tw.x, tw.y, 0), x = Math.max(8, Math.min(vw - w - 8, p.x - w / 2));
  let y = p.y - 96 - h; if (y < 66) y = Math.min(vh - h - 8, p.y + 44);
  panel(c, x, y, w, h, 14, 0.94); block(ui, x, y, w, h);
  txt(c, `${t('t_' + tw.type)} · ${t('level')} ${tw.level + 1}`, x + 16, y + 26, 21, '#ffe9a8', 'left', 800);
  const info = tw.type === 'braciere' ? `${t('burn')} ${Math.round(game.dmg(tw))}/s · ${t('range')} ${Math.round(game.range(tw))}` : tw.type === 'radici' ? `${t('slow')} ${Math.round(st.slow * 100)}% · ${t('range')} ${Math.round(game.range(tw))}` : `${t('dmg')} ${Math.round(game.dmg(tw))} · ${t('range')} ${Math.round(game.range(tw))}`;
  txt(c, info, x + 16, y + 54, 17, DIM);
  const by = y + 76, bh = 48;
  if (up != null) button(c, ui, x + 14, by, 192, bh, `${t('upgrade')}  ${up}`, { color: '#2f7d3a', disabled: game.gold < up, fs: 20 }, () => A.upgrade(tw));
  else { c.beginPath(); c.roundRect(x + 14, by, 192, bh, 12); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); txt(c, t('maxed'), x + 14 + 96, by + bh / 2, 17, DIM, 'center'); }
  button(c, ui, x + 216, by, 110, bh, `${t('sell')} +${game.sellValue(tw)}`, { color: '#7a3a2c', fs: 17 }, () => A.sell(tw));
}

function endPanel(S) {
  const { c, game, ui, vw, vh, A } = S, won = game.status === 'won', r = ui.result || { stars: 0, coins: 0 };
  dim(S, 0.66);
  const y0 = vh / 2 - 220;
  if (r.endless) {
    panel(c, vw / 2 - 300, y0, 600, 440, 18, 0.96);
    title2(c, t('siegeOver'), vw / 2, y0 + 70, 50, '#f2cf73');
    txt(c, t('nightsDone', r.nights), vw / 2, y0 + 150, 30, CREAM, 'center', 800);
    txt(c, r.record ? t('newRecord') : t('recordN', r.best), vw / 2, y0 + 194, 21, r.record ? '#ffd24a' : '#cfd8ff', 'center');
    const cs0 = '+' + r.coins, w0 = width(c, cs0, 34, 800);
    coin(c, vw / 2 - w0 / 2 - 20, y0 + 262, 16); txt(c, cs0, vw / 2 + 10, y0 + 263, 34, GOLD, 'center', 800);
    button(c, ui, vw / 2 - 270, y0 + 336, 255, 76, t('toVillage'), { color: '#5b4a8a', fs: 26 }, A.village);
    button(c, ui, vw / 2 + 15, y0 + 336, 255, 76, t('again'), { color: '#2f7d3a', fs: 28 }, A.startEndless);
    return;
  }
  panel(c, vw / 2 - 300, y0, 600, 440, 18, 0.96);
  title2(c, won ? t('win') : t('lose'), vw / 2, y0 + 70, 52, won ? '#f2cf73' : '#ff8a80');
  if (won) for (let i = 0; i < 3; i++) star(c, vw / 2 - 80 + i * 80, y0 + 158 - (i === 1 ? 10 : 0), 34, i < r.stars);
  else wrap(c, t('loseText'), vw / 2, y0 + 150, 520, 22, CREAM, 30);
  const cs = `+${r.coins}`, cw2 = width(c, cs, 34, 800);
  coin(c, vw / 2 - cw2 / 2 - 20, y0 + 240, 16); txt(c, cs, vw / 2 + 10, y0 + 241, 34, GOLD, 'center', 800);
  txt(c, r.first ? t('firstTime') : `${t('kills')}: ${game.kills}`, vw / 2, y0 + 288, 19, '#cfd8ff', 'center');
  const hasNext = won && game.level.id + 1 < LEVELS.length;
  button(c, ui, vw / 2 - 270, y0 + 336, 255, 76, t('toVillage'), { color: '#5b4a8a', fs: 26 }, A.village);
  if (hasNext) button(c, ui, vw / 2 + 15, y0 + 336, 255, 76, t('next'), { color: '#2f7d3a', fs: 28 }, () => A.startLevel(game.level.id + 1));
  else button(c, ui, vw / 2 + 15, y0 + 336, 255, 76, t('again'), { color: '#2f7d3a', fs: 28 }, () => A.startLevel(game.level.id));
}

function settingsPanel(S, inBattle) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const h = inBattle ? 470 : 300, y0 = vh / 2 - h / 2;
  panel(c, vw / 2 - 250, y0, 500, h, 18, 0.96);
  title2(c, inBattle ? t('paused') : t('settings'), vw / 2, y0 + 58, 44, '#f2cf73');
  let y = y0 + 106;
  if (inBattle) {
    button(c, ui, vw / 2 - 150, y, 300, 66, t('resume'), { color: '#2f7d3a', fs: 27 }, A.pause); y += 80;
    button(c, ui, vw / 2 - 150, y, 300, 66, t('restart'), { color: '#5b4a8a', fs: 27 }, A.restart); y += 80;
    button(c, ui, vw / 2 - 150, y, 300, 66, t('toVillage'), { color: '#7a3a2c', fs: 27 }, A.village); y += 92;
    langRow(S, vw / 2, y);
  } else {
    langRow(S, vw / 2, y); y += 70;
    button(c, ui, vw / 2 - 110, y, 220, 60, t('close'), { color: '#3b3229', fs: 24 }, A.settings);
  }
}

// =====================================================================
//  VILLAGGIO
// =====================================================================
const B_HEIGHT = { castello: 150, vedetta: 130, mulino: 100, santuario: 100 };

function nextEffect(meta, id) {
  const l = meta.lvl(id);
  if (id === 'santuario' && l === 0) return t('u_mago');
  if (id === 'santuario' && l === 1) return t('u_spell');
  if (id === 'fucina' && l === 0) return t('u_catapulta');
  if (id === 'fucina' && l === 2) return t('u_braciere');
  return t('e_' + id, id === 'castello' ? l + 1 : meta.effect(id, l + 1));
}
function curEffect(meta, id) {
  const l = meta.lvl(id);
  if (l === 0) return t('notBuilt');
  if (id === 'santuario' && l === 1) return t('t_mago');
  if (id === 'fucina' && l === 1) return t('t_catapulta');
  return t('e_' + id, id === 'castello' ? l : meta.effect(id, l));
}

function villageWorld(S) {
  const { c, meta, ui, P, now } = S, V = VILLAGE, bob = Math.sin(ui.time * 3.4) * 4;
  for (const id of BUILDING_ORDER) {
    const s = V.slots[id], l = meta.lvl(id), sel = ui.vsel && ui.vsel.kind === 'b' && ui.vsel.id === id;
    if (sel) { c.strokeStyle = 'rgba(255,224,120,0.95)'; c.lineWidth = 3.5; tracePoly(c, P.circle(s.x, s.y, id === 'castello' ? 92 : 64, 30)); c.stroke(); }
    // targhetta col nome
    const p = P.pt(s.x, s.y + (id === 'castello' ? 62 : id === 'mura' ? 30 : 46), 0), name = t('b_' + id) + (l > 0 ? '  ' + l : ''), w = width(c, name, 15, 800) + 20;
    c.beginPath(); c.roundRect(p.x - w / 2, p.y - 12, w, 24, 12); c.fillStyle = l > 0 ? 'rgba(26,20,14,0.78)' : 'rgba(60,54,46,0.78)'; c.fill();
    txt(c, name, p.x, p.y + 1, 15, l > 0 ? CREAM : '#cbbf9f', 'center', 800);
    if (meta.check(id) === 'ok') {
      const q = P.pt(s.x, s.y, (B_HEIGHT[id] || 78) * (l > 0 ? 1 : 0.5));
      bubble(c, q.x, q.y - 22 + bob, 15, '#3fae4f');
      c.strokeStyle = '#fff'; c.lineWidth = 3.5; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(q.x, q.y - 15 + bob); c.lineTo(q.x, q.y - 29 + bob); c.moveTo(q.x - 6, q.y - 23 + bob); c.lineTo(q.x, q.y - 29 + bob); c.lineTo(q.x + 6, q.y - 23 + bob); c.stroke();
    }
  }
  for (let i = 0; i < PLOTS; i++) {
    const s = V.plots[i], st = meta.plot(i, now), p = P.pt(s.x, s.y, 34), sel = ui.vsel && ui.vsel.kind === 'p' && ui.vsel.i === i;
    if (sel) { c.strokeStyle = 'rgba(255,224,120,0.95)'; c.lineWidth = 3.5; tracePoly(c, P.circle(s.x, s.y, 58, 24)); c.stroke(); }
    if (st.locked) { const q = P.pt(s.x, s.y, 8); lock(c, q.x, q.y, 9); }
    else if (st.empty) { bubble(c, p.x, p.y + bob * 0.5, 13, '#8a5f38'); txt(c, '+', p.x, p.y + bob * 0.5 + 1, 20, '#fff0b4', 'center', 800); }
    else if (st.ripe) { bubble(c, p.x, p.y - 4 + bob, 16, '#fff3c4'); coin(c, p.x, p.y - 4 + bob, 10); }
    else {
      const s2 = fmtTime(st.left), w = width(c, s2, 14, 800) + 18;
      c.beginPath(); c.roundRect(p.x - w / 2, p.y - 11, w, 22, 11); c.fillStyle = 'rgba(26,20,14,0.8)'; c.fill();
      txt(c, s2, p.x, p.y + 1, 14, '#bfe9a8', 'center', 800);
    }
  }
  drawFx(c, ui.fxTop, P);
}

function villageHud(S) {
  const { c, meta, ui, vw, vh, A, now } = S;
  const cs = String(meta.coins), ss = String(meta.totalStars()), w = 54 + width(c, cs, 24) + 54 + width(c, ss, 24) + 20;
  panel(c, 14, 10, w, 48);
  coin(c, 40, 34, 12); txt(c, cs, 60, 35, 24, GOLD);
  const sx = 60 + width(c, cs, 24) + 30; star(c, sx, 34, 13, true); txt(c, ss, sx + 20, 35, 24, CREAM);
  button(c, ui, vw - 14 - 54, 10, 54, 48, '', { color: '#3b3229' }, A.settings);
  c.fillStyle = CREAM; for (let i = 0; i < 3; i++) c.fillRect(vw - 14 - 54 + 15, 23 + i * 9, 24, 4);
  if (!ui.vsel) {
    const rdy = meta.questsReady(), qx = vw - 14 - 250 - 12 - 184, qy = vh - 14 - 66;
    button(c, ui, qx, qy, 184, 66, t('quests'), { color: '#5b4a8a', fs: 24 }, A.quests);
    if (rdy) { c.beginPath(); c.arc(qx + 176, qy + 6, 14, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(rdy), qx + 176, qy + 7, 17, '#fff', 'center', 800); }
  }
  if (!ui.vsel) button(c, ui, vw - 14 - 250, vh - 14 - 74, 250, 74, t('battle'), { color: '#b0402c', fs: 30, stroke: `rgba(255,236,170,${0.75 + Math.sin(ui.time * 4) * 0.25})` }, A.levels);
  // suggerimento: una cosa sola alla volta
  let hint = null;
  if (!ui.vsel && !ui.levels && !ui.quests && !ui.settings && !ui.daily) {     // niente suggerimento sopra una finestra aperta
    const plots = Array.from({ length: PLOTS }, (_, i) => meta.plot(i, now));
    if (meta.d.wins === 0) hint = t('hintBattle');
    else if (plots.some(p => p.ripe)) hint = t('hintHarvest');
    else if (meta.questsReady()) hint = t('hintQuest');
    else if (BUILDING_ORDER.some(id => meta.check(id) === 'ok')) hint = t('hintUpgrade');
    else if (plots.some(p => p.empty)) hint = t('hintPlant');
  }
  if (hint) { const hw = width(c, hint, 20) + 44; panel(c, vw / 2 - hw / 2, 12, hw, 44, 22, 0.8); txt(c, hint, vw / 2, 35, 20, '#ffe9a8', 'center'); }
}

function buildingPanel(S) {
  const { c, meta, ui, vw, vh, A } = S, id = ui.vsel.id, l = meta.lvl(id), chk = meta.check(id), cost = meta.cost(id);
  const w = 620, h = 172, x = vw / 2 - w / 2, y = vh - h - 14;
  panel(c, x, y, w, h, 16, 0.95); block(ui, x, y, w, h);
  txt(c, t('b_' + id) + (l > 0 ? ` · ${t('level')} ${l}` : ''), x + 22, y + 32, 25, '#ffe9a8', 'left', 800);
  txt(c, t('d_' + id), x + 22, y + 64, 17, DIM, 'left', 600);
  txt(c, `${t('now')}: ${curEffect(meta, id)}`, x + 22, y + 104, 18, CREAM);
  if (chk !== 'max') txt(c, `${t('then')}: ${nextEffect(meta, id)}`, x + 22, y + 136, 18, '#9ff0b4');
  const bx = x + w - 236, by = y + 84, bw = 214, bh = 66;
  if (chk === 'max') { c.beginPath(); c.roundRect(bx, by, bw, bh, 12); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); txt(c, t('maxed'), bx + bw / 2, by + bh / 2, 18, DIM, 'center'); }
  else if (chk === 'castle') { c.beginPath(); c.roundRect(bx, by, bw, bh, 12); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); lock(c, bx + 26, by + bh / 2 + 2, 10); txt(c, t('needCastle', l + 1), bx + 44, by + bh / 2, 15, DIM, 'left'); }
  else if (chk === 'stars') { c.beginPath(); c.roundRect(bx, by, bw, bh, 12); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); star(c, bx + 26, by + bh / 2, 11, true); txt(c, t('needStars', meta.starsNeeded()), bx + 46, by + bh / 2, 16, DIM, 'left'); }
  else {
    const lab = `${l === 0 ? t('build') : t('upgrade')}`;
    button(c, ui, bx, by, bw, bh, '', { color: '#2f7d3a', disabled: chk !== 'ok' }, () => A.upgradeBuilding(id));
    txt(c, lab, bx + bw / 2, by + 22, 20, chk === 'ok' ? CREAM : '#9a948a', 'center', 800);
    const s2 = String(cost), tw = width(c, s2, 20, 800);
    coin(c, bx + bw / 2 - tw / 2 - 10, by + 47, 9); txt(c, s2, bx + bw / 2 + 8, by + 48, 20, chk === 'ok' ? GOLD : '#d9796f', 'center', 800);
  }
  button(c, ui, x + w - 52, y + 10, 42, 42, '×', { color: '#3b3229', fs: 26, r: 21 }, A.vclose);
}

function plotPanel(S) {
  const { c, meta, ui, vw, vh, A, now } = S, i = ui.vsel.i, st = meta.plot(i, now);
  if (st.locked) {
    const s = t('plotLocked'), w = width(c, s, 20) + 110, h = 64, x = vw / 2 - w / 2, y = vh - h - 14;
    panel(c, x, y, w, h, 16, 0.95); block(ui, x, y, w, h); lock(c, x + 30, y + h / 2 + 2, 11); txt(c, s, x + 54, y + h / 2, 20, CREAM);
    button(c, ui, x + w - 50, y + 11, 42, 42, '×', { color: '#3b3229', fs: 26, r: 21 }, A.vclose);
    return;
  }
  if (!st.empty) {
    const w = 420, h = 96, x = vw / 2 - w / 2, y = vh - h - 14;
    panel(c, x, y, w, h, 16, 0.95); block(ui, x, y, w, h);
    txt(c, `${t('c_' + st.crop)} · ${st.ripe ? t('ready') : t('growing')}`, x + 22, y + 30, 22, '#ffe9a8', 'left', 800);
    c.beginPath(); c.roundRect(x + 22, y + 56, w - 140, 16, 8); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
    c.beginPath(); c.roundRect(x + 22, y + 56, Math.max(8, (w - 140) * st.progress), 16, 8); c.fillStyle = '#6fd45a'; c.fill();
    txt(c, st.ripe ? `+${meta.yieldOf(st.crop)}` : fmtTime(st.left), x + w - 100, y + 64, 18, st.ripe ? GOLD : CREAM);
    button(c, ui, x + w - 50, y + 8, 42, 42, '×', { color: '#3b3229', fs: 26, r: 21 }, A.vclose);
    return;
  }
  const cw = 132, ch = 146, gap = 10, pad = 14, n = CROP_ORDER.length, w = pad * 2 + n * cw + (n - 1) * gap + 50, h = ch + pad * 2, x = vw / 2 - w / 2, y = vh - h - 14;
  panel(c, x, y, w, h, 16, 0.95); block(ui, x, y, w, h);
  const COL = { grano: '#e8c64a', carote: '#f08a2a', zucche: '#f0822a', uva: '#7a3fb0' };
  CROP_ORDER.forEach((cr, k) => {
    const d = CROPS[cr], bx = x + pad + k * (cw + gap), by = y + pad, ok = meta.coins >= d.cost;
    c.beginPath(); c.roundRect(bx, by, cw, ch, 10); c.fillStyle = ok ? 'rgba(74,92,58,0.95)' : 'rgba(56,52,48,0.95)'; c.fill();
    c.strokeStyle = ok ? 'rgba(255,236,170,0.7)' : 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.stroke();
    c.globalAlpha = ok ? 1 : 0.45; c.beginPath(); c.arc(bx + cw / 2, by + 30, 17, 0, TAU); c.fillStyle = COL[cr]; c.fill(); c.strokeStyle = 'rgba(20,14,8,0.6)'; c.stroke();
    c.fillStyle = '#4f9a4b'; c.beginPath(); c.ellipse(bx + cw / 2 + 7, by + 12, 8, 4, -0.6, 0, TAU); c.fill(); c.globalAlpha = 1;
    txt(c, t('c_' + cr), bx + cw / 2, by + 62, 18, ok ? CREAM : '#9a948a', 'center', 800);
    txt(c, fmtDur(d.secs), bx + cw / 2, by + 86, 16, DIM, 'center');
    const g = `+${meta.yieldOf(cr)}`; txt(c, g, bx + cw / 2, by + 108, 17, '#9ff0b4', 'center', 800);
    const cs = String(d.cost), tw = width(c, cs, 17, 800);
    coin(c, bx + cw / 2 - tw / 2 - 9, by + 129, 7.5); txt(c, cs, bx + cw / 2 + 6, by + 130, 17, ok ? GOLD : '#d9796f', 'center', 800);
    ui.buttons.push({ x: bx, y: by, w: cw, h: ch, fn: () => A.plant(i, cr) });
  });
  button(c, ui, x + w - 50, y + 10, 42, 42, '×', { color: '#3b3229', fs: 26, r: 21 }, A.vclose);
}

function questsPanel(S) {
  const { c, meta, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const w = 660, h = 452, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  panel(c, x, y, w, h, 18, 0.96);
  title2(c, t('quests'), vw / 2, y + 48, 40, '#f2cf73');
  for (let i = 0; i < 3; i++) {
    const q = meta.quest(i), ry = y + 92 + i * 92;
    c.beginPath(); c.roundRect(x + 20, ry, w - 40, 80, 12); c.fillStyle = q.ready ? 'rgba(74,92,58,0.9)' : 'rgba(255,255,255,0.06)'; c.fill();
    txt(c, t('q_' + q.type, q.goal), x + 38, ry + 26, 20, CREAM, 'left', 800);
    c.beginPath(); c.roundRect(x + 38, ry + 48, 320, 14, 7); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    c.beginPath(); c.roundRect(x + 38, ry + 48, Math.max(6, 320 * q.progress / q.goal), 14, 7); c.fillStyle = q.ready ? '#ffd24a' : '#6fd45a'; c.fill();
    txt(c, q.progress + '/' + q.goal, x + 370, ry + 56, 16, DIM);
    const bx = x + w - 196, bw = 160;
    if (q.ready) button(c, ui, bx, ry + 12, bw, 56, t('claim') + ' +' + q.reward, { color: '#2f7d3a', fs: 19 }, () => A.claimQuest(i));
    else { coin(c, bx + bw / 2 - 26, ry + 40, 11); txt(c, '+' + q.reward, bx + bw / 2 + 10, ry + 41, 22, GOLD, 'center', 800); }
  }
  button(c, ui, vw / 2 - 110, y + h - 76, 220, 58, t('close'), { color: '#3b3229', fs: 24 }, A.quests);
}

function levelSelect(S) {
  const { c, meta, ui, vw, vh, A } = S;
  dim(S, 0.62);
  const cw = 330, ch = 150, gap = 16, cols = 3, W = cols * cw + (cols - 1) * gap, x0 = vw / 2 - W / 2, y0 = vh / 2 - 238;
  title2(c, t('chooseLevel'), vw / 2, y0 - 44, 40, '#f2cf73');
  LEVELS.forEach((L, i) => {
    const x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap), open = meta.levelOpen(i);
    c.beginPath(); c.roundRect(x, y + 4, cw, ch, 14); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    c.beginPath(); c.roundRect(x, y, cw, ch, 14); c.fillStyle = open ? THEMES[L.theme].grass : '#3a3632'; c.fill();
    c.fillStyle = open ? 'rgba(18,14,10,0.5)' : 'rgba(18,14,10,0.3)'; c.fill();
    c.strokeStyle = open ? 'rgba(255,236,170,0.8)' : 'rgba(255,255,255,0.15)'; c.lineWidth = 2.5; c.stroke();
    txt(c, String(i + 1), x + 20, y + 40, 44, open ? '#ffe9a8' : '#77726a', 'left', 800);
    txt(c, t('l_' + L.key), x + 62, y + 34, 21, open ? CREAM : '#8f897f', 'left', 800);
    txt(c, t('nightsN', L.nights), x + 62, y + 60, 16, open ? DIM : '#77726a');
    if (open) for (let k = 0; k < 3; k++) star(c, x + cw / 2 - 44 + k * 44, y + 108, 17, k < meta.stars(i));
    else { lock(c, x + cw / 2, y + 106, 14); }
    if (open) ui.buttons.push({ x, y, w: cw, h: ch, fn: () => A.startLevel(i) });
  });
  // assedio senza fine: una riga larga sotto i livelli
  const ey = y0 + 2 * (ch + gap), eo = meta.endlessOpen();
  c.beginPath(); c.roundRect(x0, ey + 4, W, 84, 14); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
  c.beginPath(); c.roundRect(x0, ey, W, 84, 14); c.fillStyle = eo ? '#6a3324' : '#3a3632'; c.fill();
  c.strokeStyle = eo ? 'rgba(255,236,170,0.8)' : 'rgba(255,255,255,0.15)'; c.lineWidth = 2.5; c.stroke();
  if (eo) { txt(c, '∞', x0 + 24, ey + 40, 46, '#ffe9a8', 'left', 800); txt(c, t('siege'), x0 + 84, ey + 30, 23, CREAM, 'left', 800); txt(c, t('siegeDesc'), x0 + 84, ey + 58, 16, DIM); txt(c, t('recordN', meta.d.best), x0 + W - 24, ey + 43, 20, '#ffd24a', 'right', 800); ui.buttons.push({ x: x0, y: ey, w: W, h: 84, tag: 'siege', fn: A.startEndless }); }
  else { lock(c, x0 + 44, ey + 44, 14); txt(c, t('siege'), x0 + 84, ey + 30, 23, '#8f897f', 'left', 800); txt(c, t('siegeLock'), x0 + 84, ey + 58, 16, '#8f897f'); }
  button(c, ui, vw / 2 - 110, ey + 84 + 14, 220, 56, t('close'), { color: '#3b3229', fs: 24 }, A.levels);
}

function dailyPanel(S) {
  const { c, meta, ui, vw, vh, A, now } = S, d = meta.daily(now);
  if (!d.available) { ui.daily = false; return; }
  dim(S, 0.6);
  const y0 = vh / 2 - 170;
  panel(c, vw / 2 - 230, y0, 460, 340, 18, 0.96);
  title2(c, t('daily'), vw / 2, y0 + 58, 40, '#f2cf73');
  txt(c, t('dayN', d.streak), vw / 2, y0 + 108, 20, '#cfd8ff', 'center');
  const s = `+${d.amount}`, w = width(c, s, 46, 800);
  coin(c, vw / 2 - w / 2 - 26, y0 + 172, 22); txt(c, s, vw / 2 + 14, y0 + 174, 46, GOLD, 'center', 800);
  button(c, ui, vw / 2 - 130, y0 + 236, 260, 74, t('claim'), { color: '#2f7d3a', fs: 30 }, A.claimDaily);
}

function titleScreen(S) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.55);
  const y0 = vh / 2 - 230;
  title2(c, t('title'), vw / 2, y0 + 60, 78, '#f2cf73');
  txt(c, t('subtitle'), vw / 2, y0 + 128, 30, '#d7dcf5', 'center', 600);
  wrap(c, t('lore'), vw / 2, y0 + 200, 780, 22, CREAM, 32);
  button(c, ui, vw / 2 - 150, y0 + 290, 300, 84, t('play'), { color: '#2f7d3a', fs: 36 }, A.play);
  langRow(S, vw / 2, y0 + 414);
}

/** Disegna tutta l'interfaccia in coordinate logiche (0..vw, 0..vh). */
export function drawUi(S) {
  const { c, game, ui, vw, vh } = S;
  ui.buttons.length = 0;
  if (ui.screen === 'battle' && game) {
    battleWorld(S);
    if (ui.flash > 0) { c.fillStyle = `rgba(220,40,30,${Math.min(0.35, ui.flash * 0.7)})`; c.fillRect(0, 0, vw, vh); }
    battleHud(S);
    if (ui.banner && ui.banner.t < ui.banner.T) {
      const u = ui.banner.t / ui.banner.T, a = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
      c.globalAlpha = a; title2(c, ui.banner.str, vw / 2, 190, 46, ui.banner.color); c.globalAlpha = 1;
    }
    if (!game.over && !ui.paused && ui.sel) { if (ui.sel.kind === 'spot') buildMenu(S); else towerPanel(S); }
    if (game.over) endPanel(S); else if (ui.paused) settingsPanel(S, true);
    return;
  }
  villageWorld(S);
  if (ui.screen === 'title') { titleScreen(S); return; }
  villageHud(S);
  if (ui.vsel) { if (ui.vsel.kind === 'b') buildingPanel(S); else plotPanel(S); }
  if (ui.daily) dailyPanel(S);
  else if (ui.levels) levelSelect(S);
  else if (ui.quests) questsPanel(S);
  else if (ui.settings) settingsPanel(S, false);
}

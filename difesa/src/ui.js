// Interfaccia 2D sopra il mondo 3D. Stile "immediato": a ogni frame si disegna e si registrano
// le aree toccabili in ui.buttons. S = { c, world, ui, vw, vh, P, A, now }.
import { G, BUILD, BUILD_CATS, TOWERS, CROPS, CROP_ORDER, CASTLE_UP, UNITS, UNIT_ORDER, CASERMA_SLOTS, TRIBES, MY_COLOR, TECHS, TECH_ORDER, TRADE, TRADE_ORDER, waveSummary } from './data.js';
import { VEIL } from './ground.js';
import { drawTower } from './icons.js';
import { drawFx, tracePoly } from './fx.js';
import { t, LANGS, getLang } from './i18n.js';

const F = '"Trebuchet MS","Segoe UI",Roboto,sans-serif';
const GOLD = '#e9c46a', CREAM = '#f5ecd7', DIM = '#cbbf9f', BAD = '#e8897e', TAU = Math.PI * 2;

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
function wrap(c, s, x, y, maxW, size, color, lh, align = 'center') {
  c.font = `600 ${size}px ${F}`;
  let line = '', yy = y;
  for (const w of s.split(' ')) {
    if (c.measureText(line + w).width > maxW && line) { txt(c, line.trim(), x, yy, size, color, align, 600); line = ''; yy += lh; }
    line += w + ' ';
  }
  if (line.trim()) txt(c, line.trim(), x, yy, size, color, align, 600);
  return yy;
}

// ---------- icone ----------
function coin(c, x, y, r) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.58, 0, TAU); c.strokeStyle = '#b98a1c'; c.lineWidth = 1.4; c.stroke();
}
function wood(c, x, y, r) {
  c.save(); c.translate(x, y); c.rotate(-0.35);
  c.beginPath(); c.roundRect(-r * 1.15, -r * 0.55, r * 2.3, r * 1.1, r * 0.5); c.fillStyle = '#9b6b3d'; c.fill(); c.strokeStyle = '#4a2f17'; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.ellipse(r * 0.8, 0, r * 0.38, r * 0.52, 0, 0, TAU); c.fillStyle = '#e2c08c'; c.fill(); c.stroke();
  c.restore();
}
function stone(c, x, y, r) {
  c.beginPath(); c.moveTo(x - r, y + r * 0.7); c.lineTo(x - r * 0.75, y - r * 0.3); c.lineTo(x - r * 0.1, y - r * 0.85); c.lineTo(x + r * 0.8, y - r * 0.45); c.lineTo(x + r, y + r * 0.7); c.closePath();
  c.fillStyle = '#a9abb5'; c.fill(); c.strokeStyle = '#55565e'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.1, y - r * 0.85); c.lineTo(x + r * 0.1, y + r * 0.05); c.lineTo(x + r, y + r * 0.7); c.strokeStyle = 'rgba(60,60,70,0.5)'; c.stroke();
}
function iron(c, x, y, r) {
  c.beginPath(); c.moveTo(x - r * 0.7, y - r * 0.55); c.lineTo(x + r * 0.7, y - r * 0.55); c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6); c.closePath();
  c.fillStyle = '#b9c0cf'; c.fill(); c.strokeStyle = '#4a5060'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.55, y - r * 0.2); c.lineTo(x + r * 0.55, y - r * 0.2); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke();
}
function crystal(c, x, y, r) {
  c.beginPath(); c.moveTo(x, y - r * 1.1); c.lineTo(x + r * 0.75, y - r * 0.2); c.lineTo(x, y + r * 1.1); c.lineTo(x - r * 0.75, y - r * 0.2); c.closePath();
  c.fillStyle = '#7fe3ff'; c.fill(); c.strokeStyle = '#1f6f8a'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - r * 0.75, y - r * 0.2); c.lineTo(x + r * 0.75, y - r * 0.2); c.moveTo(x, y - r * 1.1); c.lineTo(x - r * 0.2, y - r * 0.2); c.lineTo(x, y + r * 1.1); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.2; c.stroke();
}
const INK = '#2b2a33';
/** Il simbolo Tuzu in 2D (lo stesso tracciato del logo), alto 2·s, centrato in (x, y). */
function tuzu2d(c, x, y, s, color, eyes = INK, alpha = 1) {
  c.save(); c.translate(x, y); c.scale(s / 62, s / 62); c.globalAlpha *= alpha;
  c.beginPath(); c.moveTo(0, -62); c.bezierCurveTo(37, -62, 61, -34, 61, 6); c.bezierCurveTo(61, 42, 35, 62, 0, 62); c.bezierCurveTo(-35, 62, -61, 42, -61, 6); c.bezierCurveTo(-61, -30, -35, -62, 0, -62); c.closePath();
  c.fillStyle = color; c.fill(); c.strokeStyle = 'rgba(20,14,30,0.6)'; c.lineWidth = 5; c.stroke();
  c.fillStyle = eyes; c.beginPath(); c.arc(-19, 6, 8, 0, TAU); c.moveTo(27, 6); c.arc(19, 6, 8, 0, TAU); c.fill();
  if (eyes === INK) { c.fillStyle = '#fff'; c.beginPath(); c.arc(-16.5, 3.5, 2.6, 0, TAU); c.moveTo(24.1, 3.5); c.arc(21.5, 3.5, 2.6, 0, TAU); c.fill(); }
  c.strokeStyle = eyes; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-13, 26); c.quadraticCurveTo(0, 38, 13, 26); c.stroke();
  c.restore();
}
/** Un Tuzu con quello che porta addosso: è il segno che distingue un tipo dall'altro. */
function tuzuIcon(c, kind, x, y, s, color, eyes = INK) {
  tuzu2d(c, x, y, s, color, eyes, kind === 'spettro' ? 0.55 : 1);
  c.save(); c.translate(x, y); c.scale(s / 62, s / 62); c.lineJoin = 'round'; c.lineCap = 'round';
  const crown = () => { c.beginPath(); c.moveTo(-26, -52); c.lineTo(-30, -84); c.lineTo(-13, -68); c.lineTo(0, -90); c.lineTo(13, -68); c.lineTo(30, -84); c.lineTo(26, -52); c.closePath(); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.lineWidth = 4; c.stroke(); };
  const helm = (col) => { c.beginPath(); c.arc(0, -22, 48, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(30,34,44,0.8)'; c.lineWidth = 4; c.stroke(); };
  const club = (col) => { c.strokeStyle = '#6f4526'; c.lineWidth = 8; c.beginPath(); c.moveTo(52, 40); c.lineTo(74, -28); c.stroke(); c.beginPath(); c.arc(76, -36, 14, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.7)'; c.lineWidth = 3; c.stroke(); };
  if (kind === 'orco') club('#7b5230');
  else if (kind === 'predone') { c.strokeStyle = '#f4f1ea'; c.lineWidth = 9; c.beginPath(); c.moveTo(-46, -34); c.quadraticCurveTo(0, -52, 46, -34); c.stroke(); }
  else if (kind === 'bruto') { helm('#6f7684'); club('#55565e'); }
  else if (kind === 'capo') { crown(); club('#7b5230'); }
  else if (kind === 'campione') { crown(); club('#f2c230'); }
  else if (kind === 'lancia') { helm('#aeb4c2'); c.strokeStyle = '#6f4526'; c.lineWidth = 6; c.beginPath(); c.moveTo(64, 56); c.lineTo(64, -68); c.stroke(); c.beginPath(); c.moveTo(64, -94); c.lineTo(53, -66); c.lineTo(75, -66); c.closePath(); c.fillStyle = '#e1e5ee'; c.fill(); }
  else if (kind === 'arco') { c.beginPath(); c.moveTo(-34, -46); c.lineTo(0, -92); c.lineTo(34, -46); c.closePath(); c.fillStyle = '#2f8f5b'; c.fill(); c.strokeStyle = '#17482e'; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#c08e58'; c.lineWidth = 7; c.beginPath(); c.arc(50, 4, 40, -1.2, 1.2); c.stroke(); }
  else if (kind === 'corazza') { helm('#aeb4c2'); c.fillStyle = '#f2c230'; c.fillRect(-6, -86, 12, 22); c.beginPath(); c.roundRect(40, -8, 40, 56, 8); c.fillStyle = '#6f7684'; c.fill(); c.strokeStyle = 'rgba(30,34,44,0.8)'; c.lineWidth = 4; c.stroke(); }
  c.restore();
}
const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
function lock(c, x, y, s) {
  c.strokeStyle = '#cbbf9f'; c.lineWidth = s * 0.28; c.beginPath(); c.arc(x, y - s * 0.3, s * 0.5, Math.PI, 0); c.stroke();
  c.fillStyle = '#cbbf9f'; c.beginPath(); c.roundRect(x - s * 0.8, y - s * 0.3, s * 1.6, s * 1.25, s * 0.2); c.fill();
}
const RES_ICON = { monete: coin, legna: wood, pietra: stone, ferro: iron, cristallo: crystal };
const RES_COL = { monete: GOLD, legna: '#e0b98a', pietra: '#cfd1da', ferro: '#c5ccdb', cristallo: '#9fe9ff' };
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
function hammer(c, x, y, s) {
  c.save(); c.translate(x, y); c.rotate(-0.6);
  c.fillStyle = '#c08e58'; c.strokeStyle = '#5c3a1e'; c.lineWidth = 1.6;
  c.beginPath(); c.roundRect(-s * 0.14, -s * 0.5, s * 0.28, s * 1.5, s * 0.1); c.fill(); c.stroke();
  c.fillStyle = '#b9bcc6'; c.strokeStyle = '#55565e';
  c.beginPath(); c.roundRect(-s * 0.62, -s * 0.9, s * 1.24, s * 0.5, s * 0.1); c.fill(); c.stroke();
  c.restore();
}
function check(c, x, y, s, col = '#fff') { c.strokeStyle = col; c.lineWidth = s * 0.3; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - s * 0.7, y); c.lineTo(x - s * 0.15, y + s * 0.55); c.lineTo(x + s * 0.75, y - s * 0.55); c.stroke(); }
function cross(c, x, y, s, col = '#fff') { c.strokeStyle = col; c.lineWidth = s * 0.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s * 0.6, y - s * 0.6); c.lineTo(x + s * 0.6, y + s * 0.6); c.moveTo(x + s * 0.6, y - s * 0.6); c.lineTo(x - s * 0.6, y + s * 0.6); c.stroke(); }

/** Icona 2D di un edificio, centrata in (x, y), grande circa 2·s. */
function buildIcon(c, type, x, y, s, time) {
  if (TOWERS[type]) { c.save(); c.translate(x, y + s * 0.42); c.scale(s / 50, s / 50); drawTower(c, { type, level: 0, x: 0, y: 0, angle: -0.6, fireAnim: 0 }, time); c.restore(); return; }
  c.save(); c.translate(x, y); c.scale(s / 30, s / 30); c.lineJoin = 'round'; c.lineWidth = 2;
  const R = (x0, y0, w, h, fill, stroke = 'rgba(30,20,10,0.75)') => { c.beginPath(); c.rect(x0, y0, w, h); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.stroke(); } };
  const Pg = (pts, fill, stroke = 'rgba(30,20,10,0.75)') => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.stroke(); } };
  if (type === 'casa') { R(-20, -4, 40, 26, '#efe4c8'); Pg([-26, -4, 0, -28, 26, -4], '#b5482f'); R(-5, 6, 10, 16, '#6b4226'); R(8, 2, 8, 8, '#ffd97a'); }
  else if (type === 'campo') { R(-26, -16, 52, 36, '#8a5f38'); for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-18 + k * 12, -8 + i * 10, 3.6, 0, TAU); c.fillStyle = i === 1 ? '#e8c64a' : '#4f9a4b'; c.fill(); } }
  else if (type === 'segheria') { c.beginPath(); c.roundRect(-26, 4, 44, 16, 8); c.fillStyle = '#9b6b3d'; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.75)'; c.stroke(); c.beginPath(); c.ellipse(14, 12, 5, 8, 0, 0, TAU); c.fillStyle = '#e2c08c'; c.fill(); c.stroke(); c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 17 : 13; c.lineTo(-2 + Math.cos(a) * r, -10 + Math.sin(a) * r); } c.closePath(); c.fillStyle = '#cfd3dc'; c.fill(); c.strokeStyle = '#55565e'; c.stroke(); c.beginPath(); c.arc(-2, -10, 3.5, 0, TAU); c.fillStyle = '#55565e'; c.fill(); }
  else if (type === 'cava') { Pg([-26, 20, -20, -6, -4, -20, 12, -10, 24, 20], '#a9abb5', '#55565e'); Pg([-4, -20, 2, 2, 24, 20, 12, -10], '#8d8f96', '#55565e'); R(4, 8, 18, 12, '#c4c5cf', '#55565e'); c.strokeStyle = '#6f4526'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-22, -24); c.lineTo(-2, -2); c.stroke(); c.strokeStyle = '#cfd3dc'; c.lineWidth = 4; c.beginPath(); c.arc(-14, -14, 12, -2.6, -1.0); c.stroke(); }
  else if (type === 'caserma') { R(-24, -8, 48, 30, '#8f8f98', '#44454d'); for (let i = 0; i < 4; i++) R(-24 + i * 13.3, -16, 8, 8, '#8f8f98', '#44454d'); R(-6, 4, 12, 18, '#4a3020'); c.beginPath(); c.arc(-15, 4, 6, 0, TAU); c.fillStyle = '#c2452d'; c.fill(); c.strokeStyle = '#5c1f14'; c.stroke(); c.beginPath(); c.arc(15, 4, 6, 0, TAU); c.fillStyle = '#2f7fb8'; c.fill(); c.strokeStyle = '#173f5c'; c.stroke(); }
  else if (type === 'bottega') { R(-22, -4, 44, 26, '#e9dcc0'); Pg([-28, -4, 0, -28, 28, -4], '#7b5cc9'); R(-14, 6, 10, 16, '#5c3a1e'); c.beginPath(); c.arc(10, 8, 7, 0, TAU); c.fillStyle = '#9ff0ff'; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.75)'; c.stroke(); c.beginPath(); c.arc(22, -20, 6, 0, TAU); c.fillStyle = '#8ff0b0'; c.fill(); c.stroke(); }
  else if (type === 'mercato') { R(-24, 4, 48, 16, '#9b6b3d'); for (let i = 0; i < 4; i++) Pg([-28 + i * 14, -22, -14 + i * 14, -22, -14 + i * 14, -6, -28 + i * 14, -6], i % 2 ? '#f4f1ea' : '#c2452d'); R(-26, -6, 3, 26, '#6f4526', null); R(23, -6, 3, 26, '#6f4526', null); c.beginPath(); c.arc(-8, 2, 5, 0, TAU); c.fillStyle = '#f08a2a'; c.fill(); c.beginPath(); c.arc(8, 2, 5, 0, TAU); c.fillStyle = '#f2c230'; c.fill(); }
  else if (type === 'miniera' || type === 'cristalliera') { Pg([-28, 20, -20, -8, -4, -22, 14, -12, 28, 20], '#77706a', '#44403c'); R(-10, 0, 20, 20, '#1d1a1c'); R(-13, -3, 4, 23, '#6f4526', null); R(9, -3, 4, 23, '#6f4526', null); R(-14, -6, 28, 5, '#9b6b3d'); if (type === 'miniera') { c.beginPath(); c.arc(20, 14, 6, 0, TAU); c.fillStyle = '#c0683c'; c.fill(); c.stroke(); } else Pg([20, -2, 26, 10, 20, 22, 14, 10], '#7fe3ff', '#1f6f8a'); }
  else if (type === 'recinto') { for (const px of [-22, 0, 22]) { c.beginPath(); c.roundRect(px - 3.5, -16, 7, 38, 3); c.fillStyle = '#6f4526'; c.fill(); } R(-26, -8, 52, 5, '#c08e58', '#5c3a1e'); R(-26, 6, 52, 5, '#c08e58', '#5c3a1e'); }
  else if (type === 'mura') { R(-26, -8, 52, 30, '#9a9ba4', '#44454d'); for (let i = 0; i < 4; i++) R(-26 + i * 14.6, -18, 8.4, 10, '#b2b3be', '#44454d'); c.strokeStyle = 'rgba(60,60,70,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-26, 6); c.lineTo(26, 6); c.moveTo(-8, -8); c.lineTo(-8, 6); c.moveTo(10, 6); c.lineTo(10, 22); c.stroke(); }
  else if (type === 'cancello') { R(-26, -18, 12, 40, '#9a9ba4', '#44454d'); R(14, -18, 12, 40, '#9a9ba4', '#44454d'); Pg([-28, -18, -20, -27, -12, -18], '#b5482f'); Pg([12, -18, 20, -27, 28, -18], '#b5482f'); R(-14, -8, 28, 30, '#8a5a33', '#4a2f17'); c.strokeStyle = '#4a2f17'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 22); c.stroke(); R(-14, 2, 28, 4, '#55565e', null); }
  else if (type === 'castello') { R(-22, -8, 44, 30, '#a3a4b0', '#44454d'); R(-30, -18, 12, 40, '#b2b3be', '#44454d'); R(18, -18, 12, 40, '#b2b3be', '#44454d'); Pg([-32, -18, -24, -30, -16, -18], '#2f8f5b'); Pg([16, -18, 24, -30, 32, -18], '#2f8f5b'); R(-5, 6, 10, 16, '#4a3020'); }
  c.restore();
}

/** Una riga di costi (icona + numero), centrata in cx (o che parte da cx se left). Rosso quello che manca. */
function costRow(c, world, cost, cx, y, size, k = 1, left = false) {
  const keys = Object.keys(cost), r = size * 0.42, gap = size * 0.62;
  let total = 0; const ws = keys.map(key => { const w = r * 2 + 5 + width(c, String(cost[key] * k), size, 800); total += w; return w; });
  total += gap * (keys.length - 1);
  let x = left ? cx : cx - total / 2;
  keys.forEach((key, i) => {
    const ok = (world.d.res[key] || 0) >= cost[key] * k;
    RES_ICON[key](c, x + r, y, r);
    txt(c, String(cost[key] * k), x + r * 2 + 5, y + 1, size, ok ? RES_COL[key] : BAD, 'left', 800);
    x += ws[i] + gap;
  });
}

function button(c, ui, x, y, w, h, label, o, fn) {
  o = o || {};
  const col = o.disabled ? '#4a4640' : (o.color || '#3a6b35'), r = o.r ?? 12;
  c.beginPath(); c.roundRect(x, y + 3, w, h, r); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = col; c.fill();
  c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h * 0.45, Math.max(2, r - 2)); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
  c.beginPath(); c.roundRect(x, y, w, h, r); c.strokeStyle = o.disabled ? 'rgba(255,255,255,0.15)' : (o.stroke || 'rgba(255,236,170,0.75)'); c.lineWidth = 2; c.stroke();
  if (label) txt(c, label, x + w / 2 + (o.dx || 0), y + h / 2 + 1, o.fs || 22, o.disabled ? '#9a948a' : (o.fg || CREAM), 'center', 800);
  ui.buttons.push({ x, y, w, h, tag: o.tag, fn: fn || (() => {}) });
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
function bar(c, x, y, w, h, f, col) {
  c.fillStyle = 'rgba(15,10,8,0.8)'; c.beginPath(); c.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 3); c.fill();
  c.fillStyle = col || (f > 0.55 ? '#6fd45a' : f > 0.25 ? '#f1c232' : '#e0452f'); c.beginPath(); c.roundRect(x, y, Math.max(2, w * Math.max(0, f)), h, 2); c.fill();
}
const ICON_K = { predone: 0.85, bruto: 1.15, capo: 1.25, campione: 1.35 };
/** Un nemico (o un soldato) come icona, centrata in (x, y), nel colore del suo popolo. */
const enemyIcon = (c, ty, x, y, k, color, eyes) => tuzuIcon(c, ty, x, y, 15 * k * (ICON_K[ty] || 1), color, eyes);

function langRow(S, cx, y) {
  const { c, ui, A } = S, bw = 62, gap = 10, total = LANGS.length * (bw + gap) + 150;
  let x = cx - total / 2;
  for (const l of LANGS) { button(c, ui, x, y, bw, 44, l.toUpperCase(), { color: getLang() === l ? '#8a5a1c' : '#3b3229', fs: 18 }, () => A.lang(l)); x += bw + gap; }
  button(c, ui, x, y, 150, 44, `${t('sound')}: ${ui.sound ? t('on') : t('off')}`, { color: '#3b3229', fs: 17 }, A.sound);
}

// =====================================================================
//  SOPRA IL MONDO: evidenziazioni, barre della vita, fumetti, notte
// =====================================================================
const B_H = { castello: 120, arcieri: 84, mago: 90, catapulta: 60, braciere: 70, radici: 50, casa: 62, caserma: 70, segheria: 54, cava: 54, campo: 26, recinto: 34, mura: 48, cancello: 56, bottega: 66, mercato: 56, miniera: 54, cristalliera: 54 };
const LIGHT = { castello: 240, casa: 120, caserma: 120, segheria: 80, cava: 80, cancello: 70, bottega: 120, mercato: 110, miniera: 80, cristalliera: 90 };
const cellPoly = (P, c0, r0, w, h) => [P.pt(c0 * G, r0 * G), P.pt((c0 + w) * G, r0 * G), P.pt((c0 + w) * G, (r0 + h) * G), P.pt(c0 * G, (r0 + h) * G)];
const onScreen = (S, p, m) => p.x > -m && p.x < S.vw + m && p.y > -m && p.y < S.vh + m;

let veil = null;
function night(S) {
  const { c, world, ui, vw, vh, P } = S, a = ui.night;
  if (a < 0.01) return;
  const q = 4, w = Math.ceil(vw / q), h = Math.ceil(vh / q);
  if (!veil) veil = document.createElement('canvas');
  if (veil.width !== w || veil.height !== h) { veil.width = w; veil.height = h; }
  const l = veil.getContext('2d');
  l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, w, h);
  l.fillStyle = `rgba(${VEIL[0]},${VEIL[1]},${VEIL[2]},${0.44 * a})`; l.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'destination-out';
  const hole = (x, y, hgt, r, al) => {
    const p = P.pt(x, y, hgt), lr = r * P.sc(x, y) / q;
    if (!onScreen(S, p, lr * q)) return;
    const g = l.createRadialGradient(p.x / q, p.y / q, 0, p.x / q, p.y / q, lr);
    g.addColorStop(0, `rgba(0,0,0,${al})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.beginPath(); l.arc(p.x / q, p.y / q, lr, 0, TAU); l.fill();
  };
  for (const b of world.d.buildings) { const r = TOWERS[b.type] ? 130 : LIGHT[b.type]; if (r) hole(b.x, b.y, 30, r, 0.85); }
  for (const p of world.projs) if (p.k === 'orb') hole(p.x, p.y, p.h, 55, 0.7);
  for (const e of world.enemies) hole(e.x, e.y, 16, e.boss ? 80 : 48, 0.6);     // i nemici si vedono sempre
  for (const sd of world.soldiers) hole(sd.x, sd.y, 16, 44, 0.6);
  const att = world.attackers(world.nextNight).map(i => TRIBES[i]);
  for (const T of att) hole((T.c + 0.5) * G, (T.r + 0.5) * G, 30, 200, 0.6);
  c.imageSmoothingEnabled = true; c.drawImage(veil, 0, 0, w, h, 0, 0, w * q, h * q);
  c.globalCompositeOperation = 'lighter';
  for (const T of att) {
    const x = (T.c + 0.5) * G, y = (T.r + 0.5) * G, pp = P.pt(x, y, 40), rr = 170 * P.sc(x, y);
    if (!onScreen(S, pp, rr)) continue;
    const g = c.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rr); g.addColorStop(0, hexA(T.color === '#3b3947' ? '#9a7cff' : T.color, 0.3 * a)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(pp.x, pp.y, rr, 0, TAU); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

function worldLayer(S) {
  const { c, world, ui, P, now } = S, bob = Math.sin(ui.time * 3.4) * 4;
  const placing = !!ui.place, quiet = placing || ui.screen !== 'play';
  // edificio scelto: contorno e, per le torri, il raggio
  if (ui.sel && !placing) {
    const b = ui.sel.b, D = BUILD[b.type];
    tracePoly(c, cellPoly(P, b.c, b.r, D.w, D.h)); c.fillStyle = 'rgba(255,224,120,0.16)'; c.fill(); c.strokeStyle = 'rgba(255,224,120,0.95)'; c.lineWidth = 3; c.stroke();
    if (TOWERS[b.type]) rangeCircle(c, P, b.x, b.y, world.stats(b).range);
  }
  if (placing && ui.place.state && ui.place.state.at && TOWERS[ui.place.type]) rangeCircle(c, P, ui.place.state.at.x, ui.place.state.at.y, TOWERS[ui.place.type].levels[0].range);
  // edifici: vita, raccolti pronti, castello potenziabile
  for (const b of world.d.buildings) {
    const max = world.maxHp(b);
    if (b.hp < max) { const p = P.pt(b.x, b.y, B_H[b.type] || 50), sc = P.sc(b.x, b.y), w = (b.type === 'castello' ? 90 : BUILD[b.type].w * 26) * sc; if (onScreen(S, p, 60)) bar(c, p.x - w / 2, p.y, w, b.type === 'castello' ? 7 : 5, b.hp / max); }
    if (quiet) continue;
    if (b.type === 'campo') {
      const st = world.crop(b, now), p = P.pt(b.x, b.y, 30);
      if (!onScreen(S, p, 40)) continue;
      if (st.empty) { if (world.status === 'day') { bubble(c, p.x, p.y + bob * 0.5, 13, '#8a5f38'); txt(c, '+', p.x, p.y + bob * 0.5 + 1, 20, '#fff0b4', 'center', 800); } }
      else if (st.ripe) { bubble(c, p.x, p.y - 4 + bob, 16, '#fff3c4'); coin(c, p.x, p.y - 4 + bob, 10); }
      else if (P.sc(b.x, b.y) > 0.55) { const s2 = fmtTime(st.left), w = width(c, s2, 14, 800) + 18; c.beginPath(); c.roundRect(p.x - w / 2, p.y - 11, w, 22, 11); c.fillStyle = 'rgba(26,20,14,0.8)'; c.fill(); txt(c, s2, p.x, p.y + 1, 14, '#bfe9a8', 'center', 800); }
    } else if (b.type === 'castello' && world.status === 'day' && world.castleCheck() === 'ok') {
      const q = P.pt(b.x, b.y, 150);
      bubble(c, q.x, q.y - 22 + bob, 15, '#3fae4f');
      c.strokeStyle = '#fff'; c.lineWidth = 3.5; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(q.x, q.y - 15 + bob); c.lineTo(q.x, q.y - 29 + bob); c.moveTo(q.x - 6, q.y - 23 + bob); c.lineTo(q.x, q.y - 29 + bob); c.lineTo(q.x + 6, q.y - 23 + bob); c.stroke();
    }
  }
  for (const e of world.enemies) {
    if (e.slowF < 1) { c.strokeStyle = 'rgba(110,230,150,0.9)'; c.lineWidth = 2.5; tracePoly(c, P.circle(e.x, e.y, e.r * 1.15, 14)); c.stroke(); }
    if (e.burnT > 0) {      // fiammella sui nemici che bruciano
      const q = P.pt(e.x, e.y, e.r * 2.6 + 4), fr = (5 + Math.sin(ui.time * 14 + e.id) * 1.6) * P.sc(e.x, e.y) * 1.5;
      c.fillStyle = 'rgba(255,130,40,0.92)'; c.beginPath(); c.arc(q.x, q.y, fr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,232,130,0.95)'; c.beginPath(); c.arc(q.x, q.y + fr * 0.25, fr * 0.5, 0, TAU); c.fill();
    }
    if (e.hp < e.maxHp || e.boss) {
      const p = P.pt(e.x, e.y, e.r * 3 + 12), sc = P.sc(e.x, e.y), w = Math.max(26, e.r * 2 + 8) * sc;
      bar(c, p.x - w / 2, p.y, w, e.boss ? 7 : 5, e.hp / e.maxHp);
    }
  }
  for (const sd of world.soldiers) if (sd.hp < sd.maxHp) { const p = P.pt(sd.x, sd.y, 46), w = 26 * P.sc(sd.x, sd.y); bar(c, p.x - w / 2, p.y, w, 4, sd.hp / sd.maxHp, '#6fb7ff'); }
  // i villaggi: nome e forza; quando l'esercito è pronto, un invito a toccarli
  if (!quiet) TRIBES.forEach((T, i) => {
    const v = world.d.villages[i], x = (T.c + 0.5) * G, y = (T.r + 0.5) * G, p = P.pt(x, y, 135);
    if (!onScreen(S, p, 90)) return;
    const col = v.state === 'colony', s = `${t('tr_' + T.id)} · ${col ? t('colony') : t('level') + ' ' + v.level}`, w = width(c, s, 15, 800) + 44;
    c.beginPath(); c.roundRect(p.x - w / 2, p.y - 13, w, 26, 13); c.fillStyle = 'rgba(26,20,14,0.82)'; c.fill();
    if (ui.vsel === i) { c.strokeStyle = 'rgba(255,224,120,0.95)'; c.lineWidth = 2; c.stroke(); }
    tuzu2d(c, p.x - w / 2 + 16, p.y, 8, col ? MY_COLOR : T.color, col ? INK : T.eyes);
    txt(c, s, p.x - w / 2 + 31, p.y + 1, 15, CREAM, 'left', 800);
    if (ui.vsel !== i && world.raidCheck(i) === 'ok') { bubble(c, p.x, p.y - 38 + bob, 14, '#a8322a'); cross(c, p.x, p.y - 38 + bob, 7); }
  });
  if (world.raid) { const R = world.raid, p = P.pt(R.x, R.y, 150), w = 120 * P.sc(R.x, R.y); bar(c, p.x - w / 2, p.y - 30, w, 7, R.hp / R.maxHp, '#e0452f'); }
  drawFx(c, ui.fx, P);
  night(S);
  drawFx(c, ui.fxTop, P);
}
function rangeCircle(c, P, x, y, r) {
  tracePoly(c, P.circle(x, y, r, 56));
  c.fillStyle = 'rgba(255,240,180,0.12)'; c.fill(); c.strokeStyle = 'rgba(255,236,170,0.9)'; c.lineWidth = 2.5; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]);
}

/** Frecce ai bordi dello schermo verso i villaggi da cui arriva l'attacco, quando non si vedono. */
function villageArrows(S) {
  const { c, world, ui, vw, vh, P } = S;
  if (world.status === 'raid') return;
  for (const i of world.attackers(world.nextNight)) {
    const T = TRIBES[i], q = P.pt((T.c + 0.5) * G, (T.r + 0.5) * G, 40);
    if (q.x > 30 && q.x < vw - 30 && q.y > 70 && q.y < vh - 30) continue;
    const cx = vw / 2, cy = vh / 2 + 20, dx = q.x - cx, dy = q.y - cy, k = Math.min((vw / 2 - 44) / Math.abs(dx || 1e-6), (vh / 2 - 96) / Math.abs(dy || 1e-6));
    const ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx), pu = 1 + Math.sin(ui.time * 5) * (world.status === 'night' ? 0.2 : 0.1);
    c.save(); c.translate(ax, ay); c.rotate(ang); c.scale(pu, pu);
    c.beginPath(); c.moveTo(22, 0); c.lineTo(-10, -16); c.lineTo(-3, 0); c.lineTo(-10, 16); c.closePath();
    c.fillStyle = T.color; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke();
    c.restore();
  }
}

// =====================================================================
//  BARRE E PANNELLI
// =====================================================================
function hud(S) {
  const { c, world, ui, vw, vh, A } = S, res = world.d.res, isNight = world.status === 'night', raid = world.status === 'raid' ? world.raid : null;
  // risorse (ferro e cristallo compaiono quando li scopri)
  const keys = ['monete', 'legna', 'pietra'];
  if (world.d.tech.ferro || res.ferro >= 1) keys.push('ferro');
  if (world.d.tech.cristallo || res.cristallo >= 1) keys.push('cristallo');
  const many = keys.length > 3, fs = many ? 19 : 22, gap = many ? 13 : 20, ir = many ? 9 : 10.5;
  const items = keys.map(k => [k, String(Math.floor(res[k]))]);
  const pop = `${world.popUsed()}/${world.popMax()}`;
  let w = 18; for (const it of items) w += ir * 2 + 7 + width(c, it[1], fs) + gap; w += 26 + width(c, pop, fs) + 12;
  panel(c, 14, 10, w, 48);
  let x = 28;
  for (const [k, s] of items) { RES_ICON[k](c, x + ir, 34, ir); txt(c, s, x + ir * 2 + 7, 35, fs, RES_COL[k]); x += ir * 2 + 7 + width(c, s, fs) + gap; }
  tuzu2d(c, x + 9, 34, 11, MY_COLOR); txt(c, pop, x + 26, 35, fs, CREAM);

  if (raid) {         // assalto in corso: contro chi, e quanto regge la casa del capo
    const T = TRIBES[raid.i], label = `${t('raidOn')} · ${t('tr_' + T.id)}`, lw = width(c, label, 22, 800) + 70, bw = 250;
    const lx = Math.max(vw / 2 - lw / 2, 14 + w + 10);            // mai sopra le risorse
    panel(c, lx, 10, lw, 48);
    tuzu2d(c, lx + 28, 34, 13, T.color, T.eyes);
    txt(c, label, lx + 50, 35, 22, '#ffd0c8', 'left', 800);
    panel(c, vw / 2 - bw / 2 - 12, 64, bw + 24, 30, 10);
    bar(c, vw / 2 - bw / 2, 73, bw, 12, raid.hp / raid.maxHp, '#e0452f');
  } else {            // giorno / notte
    const label = `${isNight ? t('night') : t('day')} ${world.nextNight}`, lw = width(c, label, 24, 800) + 64;
    panel(c, vw / 2 - lw / 2, 10, lw, 48);
    if (isNight) moon(c, vw / 2 - lw / 2 + 28, 34, 12); else sun(c, vw / 2 - lw / 2 + 28, 34, 8);
    txt(c, label, vw / 2 - lw / 2 + 50, 35, 24, isNight ? '#cfd8ff' : '#ffe9a8', 'left', 800);
    if (isNight) {      // la vita del castello, sempre in vista durante l'attacco
      const f = world.castle.hp / world.maxHp(world.castle), bw = 250;
      panel(c, vw / 2 - bw / 2 - 12, 64, bw + 24, 30, 10);
      buildIcon(c, 'castello', vw / 2 - bw / 2 + 6, 79, 11, 0);
      bar(c, vw / 2 - bw / 2 + 28, 73, bw - 28, 12, f);
    }
  }

  // in alto a destra: menu, missioni, torna al castello, velocità
  let bx = vw - 14 - 54;
  button(c, ui, bx, 10, 54, 48, '', { color: '#3b3229', tag: 'menu' }, A.settings);
  c.fillStyle = CREAM; for (let i = 0; i < 3; i++) c.fillRect(bx + 15, 23 + i * 9, 24, 4);
  bx -= 64;
  button(c, ui, bx, 10, 54, 48, '', { color: '#5b4a8a', tag: 'quests' }, A.quests);
  c.fillStyle = '#f5ecd7'; c.beginPath(); c.roundRect(bx + 16, 21, 22, 27, 3); c.fill(); c.fillStyle = '#5b4a8a'; for (let i = 0; i < 3; i++) c.fillRect(bx + 20, 27 + i * 7, 14, 2.6);
  const rdy = world.questsReady();
  if (rdy) { c.beginPath(); c.arc(bx + 50, 14, 12, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(rdy), bx + 50, 15, 15, '#fff', 'center', 800); }
  bx -= 64;
  button(c, ui, bx, 10, 54, 48, '', { color: '#3b3229', tag: 'home' }, A.home);
  buildIcon(c, 'castello', bx + 27, 35, 13, 0);
  if (isNight || raid) { bx -= 76; button(c, ui, bx, 10, 66, 48, 'x' + ui.speed, { color: ui.speed > 1 ? '#8a5a1c' : '#3b3229', fs: 22, tag: 'speed' }, A.speed); }

  if (raid) {
    const s = `${t('army')}: ${world.armyStrength().n}`, w2 = width(c, s, 20) + 60;
    panel(c, vw - 14 - w2, vh - 14 - 46, w2, 46);
    tuzuIcon(c, 'lancia', vw - 14 - w2 + 26, vh - 14 - 20, 12, MY_COLOR);
    txt(c, s, vw - 14 - w2 + 48, vh - 14 - 22, 20, CREAM, 'left');
    button(c, ui, 14, vh - 14 - 66, 208, 66, t('retreat'), { color: '#7a3a2c', fs: 24, tag: 'retreat' }, A.retreat);
    return;
  }
  if (ui.place) { placeBar(S); return; }
  if (ui.build) { buildBar(S); return; }
  if (ui.vsel != null) villagePanel(S);
  else if (ui.sel) selPanel(S);

  // in basso a sinistra: costruire; in basso a destra: la notte
  button(c, ui, 14, vh - 14 - 66, 208, 66, t('buildBtn'), { color: '#8a5a1c', fs: 24, dx: 16, tag: 'build' }, A.buildOpen);
  hammer(c, 44, vh - 14 - 31, 17);
  if (!isNight) {
    if (!ui.sel && ui.vsel == null) incoming(S);
    const pulse = world.towers() ? 0.5 + Math.sin(ui.time * 4) * 0.5 : 0;
    button(c, ui, vw - 14 - 230, vh - 14 - 66, 230, 66, t('startNight'), { color: '#2f7d3a', fs: 25, stroke: `rgba(255,236,170,${0.7 + pulse * 0.3})`, tag: 'night' }, A.start);
  } else {
    const s = `${t('enemies')}: ${world.remaining}`, w2 = width(c, s, 20) + 36;
    panel(c, vw - 14 - w2, vh - 14 - 46, w2, 46);
    txt(c, s, vw - 14 - w2 / 2, vh - 14 - 22, 20, CREAM, 'center');
    if (world.d.castle >= 3) {      // il Fulmine del castello
      const cx = vw - 14 - w2 - 54, cy = vh - 14 - 36, r = 34, ready = world.spellCd <= 0;
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fillStyle = ui.aiming ? '#8a5a1c' : ready ? '#4b3a8a' : '#33303a'; c.fill();
      c.strokeStyle = ready ? 'rgba(255,236,170,0.85)' : 'rgba(255,255,255,0.2)'; c.lineWidth = 2.5; c.stroke();
      bolt(c, cx, cy, 17, ready ? '#ffe27a' : '#8a8478');
      if (!ready) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * (world.spellCd / 24)); c.closePath(); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill(); }
      ui.buttons.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, tag: 'spell', fn: A.aim });
    }
  }
}

/** Chi arriva stanotte, e da quali villaggi. */
function incoming(S) {
  const { c, world, vh } = S, n = world.nextNight, from = world.attackers(n), y0 = vh - 14 - 66 - 10 - 78;
  if (!from.length) { const s = t('quietInfo'), pw = width(c, s, 17, 700) + 62; panel(c, 14, y0 + 30, pw, 48); moon(c, 38, y0 + 54, 10); txt(c, s, 58, y0 + 55, 17, '#cfd8ff', 'left', 700); return; }
  const sum = waveSummary(n, world.waveK(n)), types = Object.keys(sum), T0 = TRIBES[from[0]];
  let fw = 30 + width(c, t('from'), 15, 600) + 10; for (const i of from) fw += 22 + width(c, t('tr_' + TRIBES[i].id), 15, 700) + 12;
  const iw = width(c, t('incoming'), 17), pw = Math.max(20 + iw + 20 + types.length * 82, fw + 8);
  panel(c, 14, y0, pw, 78);
  txt(c, t('incoming'), 30, y0 + 26, 17, DIM);
  let x = 30 + iw + 30;
  for (const ty of types) { enemyIcon(c, ty, x, y0 + 28, 0.95, T0.color, T0.eyes); txt(c, '×' + sum[ty], x + 25, y0 + 28, 18, CREAM); x += 82; }
  x = 30; txt(c, t('from'), x, y0 + 61, 15, DIM, 'left', 600); x += width(c, t('from'), 15, 600) + 10;
  for (const i of from) { const T = TRIBES[i], nm = t('tr_' + T.id); tuzu2d(c, x + 8, y0 + 60, 8, T.color, T.eyes); txt(c, nm, x + 21, y0 + 61, 15, CREAM, 'left', 700); x += 22 + width(c, nm, 15, 700) + 12; }
  // nemico mai visto: una riga che dice come affrontarlo
  const fresh = types.find(ty => ty !== 'orco' && !world.d.seen[ty]);
  if (fresh) {
    const tip = t('tip_' + fresh), head = t('newEnemy') + ': ' + t('e_' + fresh), tw2 = Math.max(width(c, tip, 16, 600), width(c, head, 18, 800)) + 96, ty0 = y0 - 10 - 66;
    panel(c, 14, ty0, tw2, 66, 12, 0.92);
    enemyIcon(c, fresh, 48, ty0 + 36, 1.15, T0.color, T0.eyes);
    txt(c, head, 88, ty0 + 22, 18, '#ffe9a8', 'left', 800); txt(c, tip, 88, ty0 + 46, 16, CREAM, 'left', 600);
  }
}

function buildBar(S) {
  const { c, world, ui, vw, vh, A } = S, h = 176, x = 14, y = vh - h - 12, w = vw - 28, L = world.d.castle;
  panel(c, x, y, w, h, 14, 0.94); block(ui, x, y, w, h);
  ['eco', 'dif', 'mura'].forEach((cat, i) => button(c, ui, x + 12, y + 12 + i * 52, 150, 46, t('cat_' + cat), { color: ui.build.cat === cat ? '#8a5a1c' : '#3b3229', fs: 18, tag: 'cat_' + cat }, () => A.cat(cat)));
  const list = BUILD_CATS[ui.build.cat], gap = 8, x0 = x + 12 + 150 + 14, ch = 152;
  const cw = Math.min(122, Math.floor((w - (x0 - x) - 62) / list.length) - gap), small = cw < 112;       // con tante carte si stringono
  list.forEach((ty, i) => {
    const D = BUILD[ty], bx = x0 + i * (cw + gap), by = y + 12, open = D.min <= L, tech = !D.tech || !!world.d.tech[D.tech], cp = world.cap(ty), full = cp.have >= cp.max, can = open && tech && !full, ok = can && world.afford(D.cost);
    c.beginPath(); c.roundRect(bx, by, cw, ch, 10);
    c.fillStyle = ok ? 'rgba(74,92,58,0.95)' : 'rgba(56,52,48,0.95)'; c.fill();
    c.strokeStyle = ok ? 'rgba(255,236,170,0.7)' : 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.stroke();
    c.globalAlpha = can ? 1 : 0.3; buildIcon(c, ty, bx + cw / 2, by + 36, 27, ui.time); c.globalAlpha = 1;
    txt(c, t('b_' + ty), bx + cw / 2, by + 80, small ? 14.5 : 16, can ? CREAM : '#9a948a', 'center', 800);
    if (!open) { lock(c, bx + cw / 2, by + 34, 13); txt(c, t('needCastle', D.min), bx + cw / 2, by + 118, 13, DIM, 'center', 700); }
    else if (!tech) { lock(c, bx + cw / 2, by + 34, 13); txt(c, t('needTech', t('t_' + D.tech)), bx + cw / 2, by + 118, 13, DIM, 'center', 700); }
    else {
      txt(c, t('k_' + ty), bx + cw / 2, by + 100, small ? 10.5 : 11.5, DIM, 'center', 600);
      if (full) txt(c, `${t('limit')} ${cp.have}/${cp.max}`, bx + cw / 2, by + 130, 14, BAD, 'center', 800);
      else costRow(c, world, D.cost, bx + cw / 2, by + 130, small ? 14.5 : 16);
      if (cp.max !== Infinity && !full) txt(c, `${cp.have}/${cp.max}`, bx + cw - 8, by + 14, 12, DIM, 'right', 700);
    }
    ui.buttons.push({ x: bx, y: by, w: cw, h: ch, tag: 'card_' + ty, fn: () => A.pick(ty) });
  });
  button(c, ui, x + w - 54, y + 10, 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'buildClose' }, A.buildClose);
  cross(c, x + w - 32, y + 32, 11);
}

function placeBar(S) {
  const { c, world, ui, vw, vh, A } = S, pl = ui.place, st = pl.state || { why: 'pick', ok: false }, D = BUILD[pl.type];
  const w = 660, h = 82, x = vw / 2 - w / 2, y = vh - h - 12;
  panel(c, x, y, w, h, 14, 0.94); block(ui, x, y, w, h);
  buildIcon(c, pl.type, x + 46, y + 38, 24, ui.time);
  txt(c, t('b_' + pl.type), x + 92, y + 27, 21, '#ffe9a8', 'left', 800);
  const n = st.n || 1;
  if (D.line && st.n > 1) txt(c, '×' + st.n, x + 92 + width(c, t('b_' + pl.type), 21, 800) + 10, y + 28, 18, CREAM, 'left', 800);
  txt(c, t('why_' + st.why), x + 92, y + 57, 16, st.ok || st.why.startsWith('pick') ? '#bfe9a8' : BAD, 'left', 700);
  costRow(c, world, D.cost, x + w - 236, y + 41, 19, n);
  button(c, ui, x + w - 150, y + 11, 64, 60, '', { color: '#2f7d3a', disabled: !st.ok, tag: 'placeOk' }, A.placeConfirm);
  check(c, x + w - 118, y + 41, 15, st.ok ? '#fff' : '#9a948a');
  button(c, ui, x + w - 76, y + 11, 64, 60, '', { color: '#7a3a2c', tag: 'placeCancel' }, A.placeCancel);
  cross(c, x + w - 44, y + 41, 12);
}

function card(c, x, y, w, h, ok) {
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.fillStyle = ok ? 'rgba(74,92,58,0.95)' : 'rgba(56,52,48,0.95)'; c.fill();
  c.strokeStyle = ok ? 'rgba(255,236,170,0.7)' : 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.stroke();
}
function selPanel(S) {
  const { c, world, ui, vw, vh, A, now } = S, b = ui.sel.b, D = BUILD[b.type], L = world.d.castle;
  const crops = b.type === 'campo' && !b.crop, cards = crops || b.type === 'caserma' || b.type === 'mercato';
  const w = cards ? 680 : 640, h = b.type === 'castello' ? 214 : cards ? 196 : 138, x = vw / 2 - w / 2, y = vh - h - 12;
  panel(c, x, y, w, h, 14, 0.95); block(ui, x, y, w, h);
  buildIcon(c, b.type, x + 42, y + 36, 22, ui.time);
  const lvl = TOWERS[b.type] ? ` · ${t('level')} ${(b.lvl || 0) + 1}` : b.type === 'castello' ? ` · ${t('level')} ${L}` : '';
  txt(c, t('b_' + b.type) + lvl, x + 82, y + 26, 22, '#ffe9a8', 'left', 800);
  button(c, ui, x + w - 52, y + 8, 42, 42, '', { color: '#3b3229', r: 21, tag: 'selClose' }, A.selClose);
  cross(c, x + w - 31, y + 29, 9);
  const demol = (bx, by, bw = 150) => { const back = world.refund(b); button(c, ui, bx, by, bw, 50, t('demolish'), { color: '#7a3a2c', fs: 17, tag: 'demolish' }, () => A.demolish(b)); return back; };
  const by = y + h - 62;

  if (TOWERS[b.type]) {
    const st = world.stats(b), up = world.upgradeCost(b), dmg = world.towerDmg(b);
    const info = b.type === 'braciere' ? `${t('burn')} ${dmg}/s · ${t('range')} ${st.range}` : b.type === 'radici' ? `${t('slow')} ${Math.round(st.slow * 100)}% · ${t('range')} ${st.range}` : `${t('dmg')} ${dmg} · ${t('range')} ${st.range}`;
    txt(c, info, x + 82, y + 54, 17, DIM);
    if (up != null) {
      button(c, ui, x + 20, by, 250, 50, '', { color: '#2f7d3a', disabled: world.d.res.monete < up, tag: 'upgrade' }, () => A.upgrade(b));
      txt(c, t('upgrade'), x + 36, by + 26, 19, world.d.res.monete < up ? '#9a948a' : CREAM, 'left', 800);
      costRow(c, world, { monete: up }, x + 214, by + 26, 19);
    } else { c.beginPath(); c.roundRect(x + 20, by, 250, 50, 12); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill(); txt(c, t('maxed'), x + 145, by + 26, 17, DIM, 'center'); }
    demol(x + w - 170, by);
  } else if (b.type === 'castello') {
    txt(c, t('castleInfo', 2 + 2 * L), x + 82, y + 54, 16, DIM, 'left', 600);
    const chk = world.castleCheck();
    if (chk === 'max') txt(c, t('maxed'), x + 22, y + 130, 19, DIM);
    else {
      const U = CASTLE_UP[L];
      txt(c, `${t('level')} ${L + 1}: ${t('unl_' + (L + 1))}`, x + 22, y + 94, 16, '#9ff0b4', 'left', 700);
      if (chk === 'nights') { lock(c, x + 34, y + 166, 10); txt(c, t('needNights', U.nights), x + 54, y + 165, 17, DIM); }
      else {
        button(c, ui, x + 20, y + 140, 190, 58, t('upgrade'), { color: '#2f7d3a', disabled: chk !== 'ok', fs: 21, tag: 'castleUp' }, A.castleUp);
        costRow(c, world, U.cost, x + 232, y + 170, 18, 1, true);
      }
    }
  } else if (b.type === 'campo') {
    if (crops) {
      const cw = 118, ch = 112, gap = 8, COL = { grano: '#e8c64a', carote: '#f08a2a', zucche: '#f0822a', uva: '#7a3fb0' };
      CROP_ORDER.forEach((cr, k) => {
        const d = CROPS[cr], bx = x + 20 + k * (cw + gap), cy = y + 68, ok = world.d.res.monete >= d.cost;
        card(c, bx, cy, cw, ch, ok);
        c.globalAlpha = ok ? 1 : 0.45; c.beginPath(); c.arc(bx + 24, cy + 26, 13, 0, TAU); c.fillStyle = COL[cr]; c.fill(); c.strokeStyle = 'rgba(20,14,8,0.6)'; c.stroke();
        c.fillStyle = '#4f9a4b'; c.beginPath(); c.ellipse(bx + 30, cy + 12, 7, 3.5, -0.6, 0, TAU); c.fill(); c.globalAlpha = 1;
        txt(c, t('c_' + cr), bx + 44, cy + 20, 16, ok ? CREAM : '#9a948a', 'left', 800);
        txt(c, fmtDur(d.secs), bx + 44, cy + 40, 14, DIM, 'left');
        coin(c, bx + 24, cy + 68, 7); txt(c, '+' + world.cropGain(cr), bx + 36, cy + 69, 17, '#9ff0b4', 'left', 800);
        txt(c, t('costs') + ' ' + d.cost, bx + 14, cy + 94, 14, ok ? GOLD : BAD, 'left', 700);
        ui.buttons.push({ x: bx, y: cy, w: cw, h: ch, tag: 'crop_' + cr, fn: () => A.plant(b, cr) });
      });
      demol(x + w - 156, y + h - 62, 140);
    } else {
      const st = world.crop(b, now);
      txt(c, `${t('c_' + st.crop)} · ${st.ripe ? t('ready') : t('growing')}`, x + 82, y + 54, 17, DIM);
      bar(c, x + 22, by + 18, 300, 14, st.progress, '#6fd45a');
      txt(c, st.ripe ? '+' + world.cropGain(st.crop) : fmtTime(st.left), x + 336, by + 25, 18, st.ripe ? GOLD : CREAM);
      demol(x + w - 170, by);
    }
  } else if (b.type === 'caserma') {
    // l'esercito: chi c'è dentro, e tre tipi di Tuzu da addestrare
    const units = b.units || [], room = units.length < CASERMA_SLOTS, noPop = room && world.popUsed() >= world.popMax();
    const head = `${t('soldiers')} ${units.length}/${CASERMA_SLOTS}` + (noPop ? ' · ' + t('needHouses') : '');
    txt(c, head, x + 82, y + 54, 17, noPop ? BAD : DIM);
    units.forEach((u, k) => tuzuIcon(c, u, x + 110 + width(c, head, 17) + k * 36, y + 50, 12, MY_COLOR));
    const cw = 160, ch = 106, gap = 8;
    UNIT_ORDER.forEach((u, k) => {
      const U = UNITS[u], bx = x + 20 + k * (cw + gap), cy = y + 74, chk = world.trainCheck(b, u), ok = chk === 'ok', shut = chk === 'castle' || chk === 'tech';
      card(c, bx, cy, cw, ch, ok);
      c.globalAlpha = shut ? 0.4 : 1; tuzuIcon(c, u, bx + 28, cy + 34, 17, MY_COLOR); c.globalAlpha = 1;
      txt(c, t('u_' + u), bx + 58, cy + 22, 16, shut ? '#9a948a' : CREAM, 'left', 800);
      txt(c, `${t('hp')} ${U.hp}`, bx + 58, cy + 43, 13, DIM, 'left', 600);
      txt(c, `${t('dmg')} ${U.dmg}` + (U.range ? ' · ' + t('ranged') : ''), bx + 14, cy + 66, 13, DIM, 'left', 600);
      if (chk === 'castle') { lock(c, bx + 22, cy + 88, 7); txt(c, t('needCastle', U.min), bx + 38, cy + 88, 13, DIM, 'left', 700); }
      else if (chk === 'tech') { lock(c, bx + 22, cy + 88, 7); txt(c, t('needTech', t('t_' + U.tech)), bx + 38, cy + 88, 13, DIM, 'left', 700); }
      else if (chk === 'full') txt(c, t('full'), bx + 14, cy + 88, 14, DIM, 'left', 700);
      else costRow(c, world, U.cost, bx + 14, cy + 88, 15, 1, true);
      ui.buttons.push({ x: bx, y: cy, w: cw, h: ch, tag: 'train_' + u, fn: () => A.train(b, u) });
    });
    demol(x + w - 156, y + h - 62, 140);
  } else if (b.type === 'mercato') {
    txt(c, t('marketHint'), x + 82, y + 54, 16, DIM, 'left', 600);
    const cw = 118, ch = 106, gap = 8;
    TRADE_ORDER.forEach((r, k) => {
      const T = TRADE[r], bx = x + 20 + k * (cw + gap), cy = y + 74, chk = world.buyCheck(r), ok = chk === 'ok';
      card(c, bx, cy, cw, ch, ok);
      c.globalAlpha = chk === 'tech' ? 0.4 : 1; RES_ICON[r](c, bx + 26, cy + 30, 13); c.globalAlpha = 1;
      txt(c, '+' + T.give, bx + 48, cy + 31, 21, chk === 'tech' ? '#9a948a' : RES_COL[r], 'left', 800);
      txt(c, t('r_' + r), bx + 14, cy + 58, 13.5, DIM, 'left', 600);
      if (chk === 'tech') txt(c, t('needTech', t('t_' + T.tech)), bx + 14, cy + 86, 12, DIM, 'left', 700);
      else { coin(c, bx + 23, cy + 85, 8); txt(c, String(T.cost), bx + 38, cy + 86, 17, ok ? GOLD : BAD, 'left', 800); }
      ui.buttons.push({ x: bx, y: cy, w: cw, h: ch, tag: 'buy_' + r, fn: () => A.buy(r) });
    });
    demol(x + w - 156, y + h - 62, 140);
  } else if (b.type === 'bottega') {
    txt(c, t('techHint'), x + 82, y + 54, 16, DIM, 'left', 600);
    button(c, ui, x + 20, by, 250, 50, t('techs'), { color: '#5b4a8a', fs: 20, tag: 'techOpen' }, A.tech);
    demol(x + w - 170, by);
  } else {
    const p = D.prod, parts = [];
    if (p) for (const k in p) parts.push(`+${p[k]} ${t('r_' + k)} ${t('perMin')}`);
    if (D.pop) parts.push(`+${D.pop} ${t('people')}`);
    txt(c, parts.length ? parts.join(' · ') : t('d_' + b.type), x + 82, y + 54, 17, DIM);
    const back = demol(x + 20, by, 190), keys = Object.keys(back).filter(k => back[k] > 0);
    if (keys.length) { txt(c, t('back'), x + 230, by + 26, 16, DIM); const o = {}; keys.forEach(k => { o[k] = back[k]; }); costRowPlain(c, o, x + 230 + width(c, t('back'), 16) + 12, by + 26, 17); }
  }
}

/** Il villaggio toccato: chi sono, quanto sono forti, cosa si vince; oppure il tributo della colonia. */
function villagePanel(S) {
  const { c, world, ui, vw, vh, A } = S, i = ui.vsel, T = TRIBES[i], v = world.village(i);
  const w = 660, h = 178, x = vw / 2 - w / 2, y = vh - h - 12, col = v.state === 'colony';
  panel(c, x, y, w, h, 14, 0.95); block(ui, x, y, w, h);
  tuzu2d(c, x + 44, y + 38, 22, T.color, T.eyes);
  txt(c, `${t('tr_' + T.id)} · ${col ? t('colony') : t('level') + ' ' + v.level}`, x + 82, y + 26, 22, '#ffe9a8', 'left', 800);
  button(c, ui, x + w - 52, y + 8, 42, 42, '', { color: '#3b3229', r: 21, tag: 'vClose' }, A.vClose);
  cross(c, x + w - 31, y + 29, 9);
  if (col) {
    txt(c, t('colonyInfo'), x + 82, y + 54, 16, DIM, 'left', 600);
    const s = `${t('tribute')} ${t('perMin')}`;
    txt(c, s, x + 22, y + 100, 17, DIM); costRowPlain(c, v.tribute, x + 22 + width(c, s, 17) + 14, y + 100, 19);
    txt(c, t('revoltIn', v.revoltIn), x + 22, y + 142, 17, '#ffd0c8', 'left', 700);
    return;
  }
  let gx = x + 82 + width(c, t('guards'), 16, 600) + 26;
  txt(c, t('guards'), x + 82, y + 56, 16, DIM, 'left', 600);
  for (const k in v.guards) { enemyIcon(c, k, gx, y + 56, 0.72, T.color, T.eyes); txt(c, '×' + v.guards[k], gx + 21, y + 57, 16, CREAM, 'left', 800); gx += 70; }
  txt(c, t('loot'), x + 22, y + 96, 16, DIM, 'left', 600); costRowPlain(c, v.loot, x + 22 + width(c, t('loot'), 16, 600) + 14, y + 96, 18);
  const chk = world.raidCheck(i), st = world.armyStrength();
  button(c, ui, x + 20, y + h - 60, 230, 50, t('attack'), { color: '#a8322a', disabled: chk !== 'ok', fs: 22, tag: 'attack' }, () => A.attack(i));
  if (chk !== 'ok') { txt(c, chk === 'noarmy' ? t('needArmy') : t('notNow'), x + 270, y + h - 34, 17, BAD, 'left', 700); return; }
  const odds = world.raidOdds(i), s = `${t('army')}: ${st.n}`;
  txt(c, s, x + 270, y + h - 34, 17, CREAM, 'left', 700);
  txt(c, t('odds_' + odds), x + 270 + width(c, s, 17, 700) + 18, y + h - 34, 17, odds === 'low' ? BAD : odds === 'even' ? '#ffd24a' : '#9ff0b4', 'left', 800);
}

/** Le scoperte della Bottega. */
function techPanel(S) {
  const { c, world, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const w = 800, h = 500, x = vw / 2 - w / 2, y = vh / 2 - h / 2, cw = (w - 52) / 2, ch = 80;
  panel(c, x, y, w, h, 18, 0.96);
  title2(c, t('techs'), vw / 2, y + 40, 34, '#f2cf73');
  TECH_ORDER.forEach((id, k) => {
    const T = TECHS[id], bx = x + 20 + (k % 2) * (cw + 12), by = y + 72 + Math.floor(k / 2) * (ch + 8), chk = world.techCheck(id), done = chk === 'done', ok = chk === 'ok';
    c.beginPath(); c.roundRect(bx, by, cw, ch, 12); c.fillStyle = done ? 'rgba(74,92,58,0.9)' : ok ? 'rgba(86,74,120,0.92)' : 'rgba(255,255,255,0.06)'; c.fill();
    txt(c, t('t_' + id), bx + 16, by + 21, 18, done || ok ? CREAM : '#c9c2b4', 'left', 800);
    txt(c, t('td_' + id), bx + 16, by + 43, 13.5, DIM, 'left', 600);
    if (done) { check(c, bx + cw - 34, by + 40, 12, '#9ff0b4'); return; }
    if (chk === 'castle') { lock(c, bx + 23, by + 64, 7); txt(c, t('needCastle', T.min), bx + 38, by + 65, 13, DIM, 'left', 700); return; }
    if (chk === 'needs') { lock(c, bx + 23, by + 64, 7); txt(c, t('needTech', t('t_' + T.needs)), bx + 38, by + 65, 13, DIM, 'left', 700); return; }
    costRow(c, world, T.cost, bx + 16, by + 65, 14.5, 1, true);
    button(c, ui, bx + cw - 110, by + 17, 96, 46, t('discover'), { color: '#5b4a8a', disabled: !ok, fs: 17, tag: 'tech_' + id }, () => A.research(id));
  });
  button(c, ui, vw / 2 - 110, y + h - 62, 220, 50, t('close'), { color: '#3b3229', fs: 22, tag: 'close' }, A.tech);
}

function costRowPlain(c, cost, x, y, size) {
  const r = size * 0.42;
  for (const key in cost) { RES_ICON[key](c, x + r, y, r); const s = '+' + cost[key]; txt(c, s, x + r * 2 + 5, y + 1, size, RES_COL[key], 'left', 800); x += r * 2 + 5 + width(c, s, size, 800) + 12; }
}

function hints(S) {
  const { c, world, ui, vw, now } = S;
  if (ui.sel || ui.vsel != null || ui.tech || ui.quests || ui.settings || ui.daily || ui.lost || ui.away) return;
  let hint = null;
  if (ui.aiming) hint = t('spellAim');
  else if (ui.place) hint = null;
  else if (world.status === 'day') {
    const walls = world.count('recinto') + world.count('mura'), L = world.d.castle, army = world.armyStrength().n;
    if (ui.build) hint = world.towers() === 0 ? t('hintPick') : null;
    else if (!ui.moved) hint = t('hintMove');
    else if (world.towers() === 0) hint = t('hintBuild');
    else if (world.d.night === 0) hint = t('hintStart');
    else if (walls === 0) hint = t('hintFence');
    else if (world.questsReady()) hint = t('hintQuest');
    else if (world.castleCheck() === 'ok') hint = t('hintCastle');
    else if (world.d.buildings.some(b => b.type === 'campo' && world.crop(b, now).ripe)) hint = t('hintHarvest');
    else if (world.count('casa') === 0) hint = t('hintHouse');
    else if (L >= 2 && world.count('caserma') === 0) hint = t('hintBarracks');
    else if (L >= 2 && army > 0 && army < 4) hint = t('hintArmy');
    else if (army >= 4 && world.d.villages[0].state === 'free' && world.d.villages[0].level === 1) hint = t('hintRaid');
    else if (L >= 2 && world.count('bottega') === 0) hint = t('hintWorkshop');
    else if (world.count('bottega') && !world.d.tech.ferro) hint = t('hintTech');
  }
  if (hint) { const hw = width(c, hint, 20) + 44; panel(c, vw / 2 - hw / 2, 70, hw, 42, 21, 0.8); txt(c, hint, vw / 2, 92, 20, '#ffe9a8', 'center'); }
}

function settingsPanel(S) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const h = 300, y0 = vh / 2 - h / 2;
  panel(c, vw / 2 - 250, y0, 500, h, 18, 0.96);
  title2(c, t('settings'), vw / 2, y0 + 58, 44, '#f2cf73');
  langRow(S, vw / 2, y0 + 112);
  button(c, ui, vw / 2 - 110, y0 + 194, 220, 60, t('close'), { color: '#3b3229', fs: 24, tag: 'close' }, A.settings);
}

function questsPanel(S) {
  const { c, world, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const w = 660, h = 452, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  panel(c, x, y, w, h, 18, 0.96);
  title2(c, t('quests'), vw / 2, y + 48, 40, '#f2cf73');
  for (let i = 0; i < 3; i++) {
    const q = world.quest(i), ry = y + 92 + i * 92;
    c.beginPath(); c.roundRect(x + 20, ry, w - 40, 80, 12); c.fillStyle = q.ready ? 'rgba(74,92,58,0.9)' : 'rgba(255,255,255,0.06)'; c.fill();
    txt(c, t('q_' + q.type, q.goal), x + 38, ry + 26, 20, CREAM, 'left', 800);
    c.beginPath(); c.roundRect(x + 38, ry + 48, 320, 14, 7); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    c.beginPath(); c.roundRect(x + 38, ry + 48, Math.max(6, 320 * q.progress / q.goal), 14, 7); c.fillStyle = q.ready ? '#ffd24a' : '#6fd45a'; c.fill();
    txt(c, q.progress + '/' + q.goal, x + 370, ry + 56, 16, DIM);
    const bx = x + w - 196, bw = 160;
    if (q.ready) button(c, ui, bx, ry + 12, bw, 56, t('claim') + ' +' + q.reward, { color: '#2f7d3a', fs: 19, tag: 'claim' + i }, () => A.claimQuest(i));
    else { coin(c, bx + bw / 2 - 26, ry + 40, 11); txt(c, '+' + q.reward, bx + bw / 2 + 10, ry + 41, 22, GOLD, 'center', 800); }
  }
  button(c, ui, vw / 2 - 110, y + h - 76, 220, 58, t('close'), { color: '#3b3229', fs: 24, tag: 'close' }, A.quests);
}

function dailyPanel(S) {
  const { c, world, ui, vw, vh, A, now } = S, d = world.daily(now);
  if (!d.available) { ui.daily = false; return; }
  dim(S, 0.6);
  const y0 = vh / 2 - 170;
  panel(c, vw / 2 - 230, y0, 460, 340, 18, 0.96);
  title2(c, t('daily'), vw / 2, y0 + 58, 40, '#f2cf73');
  txt(c, t('dayN', d.streak), vw / 2, y0 + 108, 20, '#cfd8ff', 'center');
  const s = `+${d.amount}`, w = width(c, s, 46, 800);
  coin(c, vw / 2 - w / 2 - 26, y0 + 172, 22); txt(c, s, vw / 2 + 14, y0 + 174, 46, GOLD, 'center', 800);
  button(c, ui, vw / 2 - 130, y0 + 236, 260, 74, t('claim'), { color: '#2f7d3a', fs: 30, tag: 'claimDaily' }, A.claimDaily);
}

function lostPanel(S) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.62);
  const y0 = vh / 2 - 170;
  panel(c, vw / 2 - 290, y0, 580, 340, 18, 0.96);
  title2(c, t('lose'), vw / 2, y0 + 62, 44, '#ff8a80');
  wrap(c, t('loseText'), vw / 2, y0 + 122, 500, 21, CREAM, 30);
  const s = '−' + ui.lost.penalty, w = width(c, s, 34, 800);
  coin(c, vw / 2 - w / 2 - 20, y0 + 204, 15); txt(c, s, vw / 2 + 10, y0 + 205, 34, BAD, 'center', 800);
  button(c, ui, vw / 2 - 130, y0 + 250, 260, 66, t('again'), { color: '#2f7d3a', fs: 26, tag: 'lostOk' }, A.lostOk);
}

function awayPanel(S) {
  const { c, ui, vw, vh, A } = S, got = ui.away.got;
  dim(S, 0.6);
  const y0 = vh / 2 - 150;
  panel(c, vw / 2 - 250, y0, 500, 300, 18, 0.96);
  title2(c, t('away'), vw / 2, y0 + 56, 38, '#f2cf73');
  txt(c, t('awayText'), vw / 2, y0 + 106, 19, '#cfd8ff', 'center', 600);
  const keys = Object.keys(got);
  let total = 0; const ws = keys.map(k => { const w = 34 + width(c, '+' + got[k], 30, 800); total += w; return w; }); total += 26 * (keys.length - 1);
  let x = vw / 2 - total / 2;
  keys.forEach((k, i) => { RES_ICON[k](c, x + 13, y0 + 162, 13); txt(c, '+' + got[k], x + 34, y0 + 164, 30, RES_COL[k], 'left', 800); x += ws[i] + 26; });
  button(c, ui, vw / 2 - 120, y0 + 212, 240, 64, t('ok'), { color: '#2f7d3a', fs: 26, tag: 'awayOk' }, A.awayOk);
}

function titleScreen(S) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.55);
  const y0 = vh / 2 - 230;
  title2(c, t('title'), vw / 2, y0 + 60, 78, '#f2cf73');
  txt(c, t('subtitle'), vw / 2, y0 + 128, 30, '#d7dcf5', 'center', 600);
  wrap(c, t('lore'), vw / 2, y0 + 200, 780, 22, CREAM, 32);
  button(c, ui, vw / 2 - 150, y0 + 290, 300, 84, t('play'), { color: '#2f7d3a', fs: 36, tag: 'play' }, A.play);
  langRow(S, vw / 2, y0 + 414);
}

/** Disegna tutta l'interfaccia in coordinate logiche (0..vw, 0..vh). */
export function drawUi(S) {
  const { c, ui, vw, vh } = S;
  ui.buttons.length = 0;
  worldLayer(S);
  if (ui.screen === 'title') { titleScreen(S); return; }
  if (ui.flash > 0) { c.fillStyle = `rgba(220,40,30,${Math.min(0.3, ui.flash * 0.6)})`; c.fillRect(0, 0, vw, vh); }
  villageArrows(S);
  hud(S);
  hints(S);
  if (ui.banner && ui.banner.t < ui.banner.T) {
    const u = ui.banner.t / ui.banner.T, a = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
    c.globalAlpha = a; title2(c, ui.banner.str, vw / 2, 180, 46, ui.banner.color); c.globalAlpha = 1;
  }
  if (ui.toast && ui.toast.t < ui.toast.T) {
    const u = ui.toast.t / ui.toast.T, a = u > 0.75 ? (1 - u) / 0.25 : 1, w = width(c, ui.toast.str, 20) + 44, ty = vh - (ui.build && !ui.place ? 250 : 170);
    c.globalAlpha = a; panel(c, vw / 2 - w / 2, ty, w, 44, 22, 0.92); txt(c, ui.toast.str, vw / 2, ty + 23, 20, '#ffd0c8', 'center'); c.globalAlpha = 1;
  }
  if (ui.lost) lostPanel(S);
  else if (ui.away) awayPanel(S);
  else if (ui.daily) dailyPanel(S);
  else if (ui.quests) questsPanel(S);
  else if (ui.tech) techPanel(S);
  else if (ui.settings) settingsPanel(S);
}

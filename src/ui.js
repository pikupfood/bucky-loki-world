// Interfaccia 2D sopra il mondo 3D. Stile "immediato": a ogni frame si disegna e si registrano
// le aree toccabili in ui.buttons. S = { c, world, ui, vw, vh, P, A, now }.
import { G, BUILD, BUILD_CATS, TOWERS, CROPS, CROP_ORDER, CASTLE_UP, UNITS, UNIT_ORDER, CASERMA_SLOTS, TRIBES, MY_COLOR, TECHS, TECH_ORDER, TRADE, TRADE_ORDER, CAT_ORDER, NATURE, moraleK, waveSummary, ENEMIES, LEVELS, LEVEL_MIN, levelK, TRAITS, REL, giftCost, SELL, SELL_ORDER, rotStep } from './data.js';
import { VEIL } from './ground.js';
import { drawTower } from './icons.js';
import { drawFx, tracePoly } from './fx.js';
import { t, has, LANGS, LANG_NAMES, getLang } from './i18n.js';
import { drawText, logBox } from './text.js';
import * as X from './ui2.js';
import * as Y from './ui3.js';
import * as Z from './ui4.js';
import * as V from './ui6.js';
import * as W from './ui7.js';
import * as Q from './ui8.js';

const F = '"Trebuchet MS","Segoe UI",Roboto,sans-serif';
const SERIF = 'Georgia,"Palatino Linotype","Book Antiqua","Noto Serif",serif';      // i titoli: un carattere da libro di fiabe
const GOLD = '#e9c46a', CREAM = '#f5ecd7', DIM = '#cbbf9f', BAD = '#e8897e', TAU = Math.PI * 2;
// gli inchiostri per scrivere sulla pergamena
const PEN = '#3a2614', PEN2 = '#7a5f3e', PENBAD = '#a3321f', PENOK = '#2f6b2a', PENRED = '#7a2c1e';

function txt(c, s, x, y, size, color = CREAM, align = 'left', weight = 700) {
  size = Math.round(size * 2) / 2;      // mezze misure: poche varianti da tenere da parte
  c.font = `${weight} ${size}px ${F}`; c.textAlign = align; c.textBaseline = 'middle';
  c.fillStyle = color; drawText(c, s, x, y);
}
function width(c, s, size, weight = 700, serif = false) { c.font = `${weight} ${size}px ${serif ? SERIF : F}`; return c.measureText(s).width; }

// ---------- la pelle: legno con bordo d'oro per i comandi, pergamena per chi ti parla ----------
const SHADES = new Map();
/** Un colore #rrggbb più chiaro (k > 0) o più scuro (k < 0). */
function shade(hex, k) {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length !== 7) return hex;
  const key = hex + k; let v = SHADES.get(key); if (v) return v;
  const ch = (i) => { const n = parseInt(hex.slice(i, i + 2), 16); return Math.round(k > 0 ? n + (255 - n) * k : n * (1 + k)); };
  v = `rgb(${ch(1)},${ch(3)},${ch(5)})`; SHADES.set(key, v); return v;
}
let WOOD = null, PAPER = null, skinned = false;
/** Le due trame (venature del legno, grana della carta): si disegnano una volta sola e poi si ripetono. */
function skins(c) {
  if (skinned) return; skinned = true;
  if (typeof document === 'undefined') return;
  try {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const mk = (w, h, fn) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d')); return c.createPattern(cv, 'repeat'); };
    WOOD = mk(160, 96, (g) => { for (let i = 0; i < 46; i++) { const y = rnd() * 96, a = 0.035 + rnd() * 0.07; g.strokeStyle = rnd() < 0.55 ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,214,150,' + a * 0.7 + ')'; g.lineWidth = 0.6 + rnd() * 1.5; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(50, y + rnd() * 5 - 2.5, 110, y + rnd() * 5 - 2.5, 160, y); g.stroke(); } });
    PAPER = mk(128, 128, (g) => { for (let i = 0; i < 460; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,84,40,' + (0.03 + rnd() * 0.06) + ')' : 'rgba(255,255,240,' + (0.05 + rnd() * 0.06) + ')'; const q = 0.6 + rnd() * 2.2; g.fillRect(rnd() * 128, rnd() * 128, q, q); } });
  } catch (e) { WOOD = PAPER = null; }
}
/** Una tavola di legno scuro con il filo d'oro: il fondo di ogni pannello coi comandi. */
function panel(c, x, y, w, h, r = 12, alpha = 0.86) {
  logBox(c, x, y, w, h, 'panel');
  flushIcons(c); skins(c);
  const a = Math.max(alpha, 0.9);
  c.beginPath(); c.roundRect(x, y + 3, w, h, r); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(70,49,31,' + a + ')'); g.addColorStop(1, 'rgba(36,24,15,' + a + ')');
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = g; c.fill();
  if (WOOD) { c.fillStyle = WOOD; c.fill(); }
  c.strokeStyle = 'rgba(16,10,5,0.95)'; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.roundRect(x + 2.5, y + 2.5, w - 5, h - 5, Math.max(2, r - 2)); c.strokeStyle = 'rgba(233,196,106,0.66)'; c.lineWidth = 1.5; c.stroke();
  if (w > r * 2 + 12) { c.beginPath(); c.moveTo(x + r + 2, y + 5.5); c.lineTo(x + w - r - 2, y + 5.5); c.strokeStyle = 'rgba(255,240,200,0.13)'; c.lineWidth = 1.5; c.stroke(); }
  if (w >= 260 && h >= 170) for (const [px, py] of [[x + 11, y + 11], [x + w - 11, y + 11], [x + 11, y + h - 11], [x + w - 11, y + h - 11]]) {      // le borchie agli angoli dei pannelli grandi
    c.beginPath(); c.arc(px, py, 3.1, 0, TAU); c.fillStyle = '#e9c46a'; c.fill(); c.strokeStyle = 'rgba(40,24,8,0.9)'; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(px - 0.8, py - 0.9, 1, 0, TAU); c.fillStyle = 'rgba(255,250,225,0.9)'; c.fill();
  }
}
/** Un foglio di pergamena: il fondo dei messaggi (la guida, gli eventi, il racconto, i rapporti). Sopra si scrive con PEN. */
function scroll(c, x, y, w, h, r = 12) {
  logBox(c, x, y, w, h, 'panel');
  flushIcons(c); skins(c);
  c.beginPath(); c.roundRect(x, y + 3, w, h, r); c.fillStyle = 'rgba(0,0,0,0.32)'; c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f8ecd2'); g.addColorStop(1, '#e2cd9f');
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = g; c.fill();
  if (PAPER) { c.fillStyle = PAPER; c.fill(); }
  c.strokeStyle = '#4e351d'; c.lineWidth = 2.5; c.stroke();
  if (w > 70 && h > 44) { c.beginPath(); c.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4)); c.strokeStyle = 'rgba(138,98,48,0.42)'; c.lineWidth = 1.2; c.stroke(); }
}
/** Un nastro col titolo, a coda di rondine: sta a cavallo del bordo alto di un foglio. */
function ribbon(c, cx, y, w, h, label, col = '#8a2f24', fs = 20) {
  flushIcons(c);
  const x = cx - w / 2;
  c.fillStyle = shade(col, -0.4);
  for (const k of [-1, 1]) { const e = k < 0 ? x : x + w; c.beginPath(); c.moveTo(e - k * 12, y + 7); c.lineTo(e + k * 17, y + 7); c.lineTo(e + k * 8, y + 7 + h / 2); c.lineTo(e + k * 17, y + 7 + h); c.lineTo(e - k * 12, y + 7 + h); c.closePath(); c.fill(); }
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(col, 0.2)); g.addColorStop(1, shade(col, -0.14));
  c.beginPath(); c.roundRect(x, y, w, h, 5); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(30,12,8,0.85)'; c.lineWidth = 2; c.stroke();
  c.strokeStyle = 'rgba(255,226,150,0.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 8, y + 4.5); c.lineTo(x + w - 8, y + 4.5); c.moveTo(x + 8, y + h - 4.5); c.lineTo(x + w - 8, y + h - 4.5); c.stroke();
  head(c, label, cx, y + h / 2 + 1, fs, '#fff3d6', 'center');
}
/** Un titolo (carattere coi piedini). Su fondo scuro ha un'ombra; sulla pergamena no (shadow = false). */
function head(c, s, x, y, size, color = '#f2cf73', align = 'left', shadow = true) {
  size = Math.round(size * 2) / 2;
  c.font = `700 ${size}px ${SERIF}`; c.textAlign = align; c.textBaseline = 'middle';
  if (shadow) { c.fillStyle = 'rgba(0,0,0,0.5)'; drawText(c, s, x, y + 1.6); }
  c.fillStyle = color; drawText(c, s, x, y);
}
/** La misura giusta perché una scritta stia in maxW. */
function fit(c, s, maxW, size, weight = 700, serif = false) { const w = width(c, s, size, weight, serif); return w > maxW ? Math.max(9, size * maxW / w) : size; }
/** Una riga sottile d'oro che sfuma ai lati, con un rombo in mezzo: separa le parti di un pannello. */
function rule(c, x, y, w, col = '233,196,106') {
  const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(0.5, 'rgba(' + col + ',0.75)'); g.addColorStop(1, 'rgba(' + col + ',0)');
  c.fillStyle = g; c.fillRect(x, y - 0.75, w, 1.5);
  c.beginPath(); c.moveTo(x + w / 2, y - 4); c.lineTo(x + w / 2 + 4, y); c.lineTo(x + w / 2, y + 4); c.lineTo(x + w / 2 - 4, y); c.closePath(); c.fillStyle = 'rgba(' + col + ',0.95)'; c.fill();
}
function title2(c, s, x, y, size, color) {
  size = Math.round(size);
  c.font = `700 ${size}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  drawText(c, s, x, y, { stroke: 'rgba(24,13,5,0.92)', lw: Math.max(4, Math.round(size / 7)), grad: [shade(color, 0.5), color, shade(color, -0.28)] });
}
const CJK = /[\u2e80-\u9fff\uff00-\uffef]/, NO_START = '，。！？、：；）」』》…,.!?:;)';
function wrap(c, s, x, y, maxW, size, color, lh, align = 'center') {
  c.font = `600 ${size}px ${F}`;
  let line = '', yy = y;
  const toks = [];
  for (const w of s.split(' ')) { if (CJK.test(w)) { const ch = Array.from(w); ch.forEach((q, i) => toks.push([q, i === ch.length - 1 ? ' ' : ''])); } else toks.push([w, ' ']); }
  for (const [w, glue] of toks) {
    if (c.measureText((line + w).trim()).width > maxW && line.trim() && !NO_START.includes(w)) { txt(c, line.trim(), x, yy, size, color, align, 600); line = ''; yy += lh; }
    line += w + glue;
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
function tuzu2dNow(c, x, y, s, color, eyes = INK, alpha = 1) {
  c.save(); c.translate(x, y); c.scale(s / 62, s / 62); c.globalAlpha *= alpha;
  c.beginPath(); c.moveTo(0, -62); c.bezierCurveTo(37, -62, 61, -34, 61, 6); c.bezierCurveTo(61, 42, 35, 62, 0, 62); c.bezierCurveTo(-35, 62, -61, 42, -61, 6); c.bezierCurveTo(-61, -30, -35, -62, 0, -62); c.closePath();
  c.fillStyle = color; c.fill(); c.strokeStyle = 'rgba(20,14,30,0.6)'; c.lineWidth = 5; c.stroke();
  c.fillStyle = eyes; c.beginPath(); c.arc(-19, 6, 8, 0, TAU); c.moveTo(27, 6); c.arc(19, 6, 8, 0, TAU); c.fill();
  if (eyes === INK) { c.fillStyle = '#fff'; c.beginPath(); c.arc(-16.5, 3.5, 2.6, 0, TAU); c.moveTo(24.1, 3.5); c.arc(21.5, 3.5, 2.6, 0, TAU); c.fill(); }
  c.strokeStyle = eyes; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-13, 26); c.quadraticCurveTo(0, 38, 13, 26); c.stroke();
  c.restore();
}
/** Un Tuzu con quello che porta addosso: è il segno che distingue un tipo dall'altro. */
function tuzuIconNow(c, kind, x, y, s, color, eyes = INK) {
  if (kind.startsWith('sp_')) {      // lo speciale di un popolo: l'attrezzatura di base e lo stendardo
    tuzuIconNow(c, ENEMIES[kind].gear, x, y, s, color, eyes);
    c.save(); c.translate(x, y); c.scale(s / 62, s / 62); c.strokeStyle = '#6f4526'; c.lineWidth = 6; c.beginPath(); c.moveTo(-58, 30); c.lineTo(-58, -92); c.stroke(); c.fillStyle = '#f2c230'; c.strokeStyle = 'rgba(30,20,10,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-56, -92); c.lineTo(-18, -80); c.lineTo(-56, -60); c.closePath(); c.fill(); c.stroke(); c.restore();
    return;
  }
  tuzu2dNow(c, x, y, s, color, eyes, kind === 'spettro' || ENEMIES[kind] && ENEMIES[kind].ghost ? 0.55 : 1);
  c.save(); c.translate(x, y); c.scale(s / 62, s / 62); c.lineJoin = 'round'; c.lineCap = 'round';
  const crown = () => { c.beginPath(); c.moveTo(-26, -52); c.lineTo(-30, -84); c.lineTo(-13, -68); c.lineTo(0, -90); c.lineTo(13, -68); c.lineTo(30, -84); c.lineTo(26, -52); c.closePath(); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.lineWidth = 4; c.stroke(); };
  const helm = (col) => { c.beginPath(); c.arc(0, -22, 48, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(30,34,44,0.8)'; c.lineWidth = 4; c.stroke(); };
  const club = (col) => { c.strokeStyle = '#6f4526'; c.lineWidth = 8; c.beginPath(); c.moveTo(52, 40); c.lineTo(74, -28); c.stroke(); c.beginPath(); c.arc(76, -36, 14, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.7)'; c.lineWidth = 3; c.stroke(); };
  if (kind === 'orco') club('#7b5230');
  else if (kind === 'predone') { c.strokeStyle = '#f4f1ea'; c.lineWidth = 9; c.beginPath(); c.moveTo(-46, -34); c.quadraticCurveTo(0, -52, 46, -34); c.stroke(); }
  else if (kind === 'bruto') { helm('#6f7684'); club('#55565e'); }
  else if (kind === 'capo') { crown(); club('#7b5230'); }
  else if (kind === 'campione') { crown(); club('#f2c230'); }
  else if (kind === 'ascia' || kind === 'piccone' || kind === 'falce' || kind === 'martello') {
    c.beginPath(); c.ellipse(0, -50, 52, 13, 0, 0, TAU); c.fillStyle = '#e8cf7a'; c.fill(); c.strokeStyle = '#8a6a20'; c.lineWidth = 4; c.stroke(); c.beginPath(); c.arc(0, -52, 26, Math.PI, 0); c.closePath(); c.fillStyle = '#d9bd62'; c.fill(); c.stroke();
    c.fillStyle = { ascia: '#3f8f4a', piccone: '#8d8f96', falce: '#e8c64a', martello: '#c2452d' }[kind]; c.fillRect(-26, -56, 52, 7);
    c.strokeStyle = '#6f4526'; c.lineWidth = 7; c.beginPath(); c.moveTo(60, 52); c.lineTo(66, -30); c.stroke(); c.strokeStyle = 'rgba(30,34,44,0.8)'; c.lineWidth = 3;
    if (kind === 'ascia') { c.beginPath(); c.moveTo(66, -44); c.lineTo(98, -52); c.quadraticCurveTo(106, -30, 98, -10); c.lineTo(66, -18); c.closePath(); c.fillStyle = '#cfd3dc'; c.fill(); c.stroke(); }
    else if (kind === 'piccone') { c.strokeStyle = '#aeb4c2'; c.lineWidth = 9; c.beginPath(); c.arc(66, 2, 44, -2.2, -0.9); c.stroke(); }
    else if (kind === 'falce') { c.strokeStyle = '#e9edf5'; c.lineWidth = 8; c.beginPath(); c.arc(84, -34, 26, Math.PI * 0.9, Math.PI * 2.1); c.stroke(); }
    else { c.beginPath(); c.roundRect(46, -52, 42, 26, 5); c.fillStyle = '#6f7684'; c.fill(); c.stroke(); }
  }
  else if (kind === 'eroina') { c.beginPath(); c.moveTo(-36, -44); c.lineTo(0, -98); c.lineTo(36, -44); c.closePath(); c.fillStyle = '#19a08c'; c.fill(); c.strokeStyle = '#0c5a4e'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#f2c230'; c.fillRect(-22, -56, 44, 9); c.strokeStyle = '#f2c230'; c.lineWidth = 8; c.beginPath(); c.arc(52, 4, 42, -1.2, 1.2); c.stroke(); }
  else if (kind === 'ordigno') { helm('#6f7684'); c.fillStyle = '#9b6b3d'; c.strokeStyle = 'rgba(30,20,10,0.7)'; c.lineWidth = 4; c.beginPath(); c.roundRect(44, 24, 76, 16, 4); c.fill(); c.stroke(); for (const wx of [58, 106]) { c.beginPath(); c.arc(wx, 48, 14, 0, TAU); c.fillStyle = '#6f4526'; c.fill(); c.stroke(); } c.strokeStyle = '#c08e58'; c.lineWidth = 8; c.beginPath(); c.moveTo(96, 24); c.lineTo(54, -46); c.stroke(); c.beginPath(); c.arc(50, -52, 13, 0, TAU); c.fillStyle = '#8d8f96'; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.7)'; c.lineWidth = 3; c.stroke(); }
  else if (kind === 'attrezzo') { c.beginPath(); c.ellipse(0, -50, 52, 13, 0, 0, TAU); c.fillStyle = '#e8cf7a'; c.fill(); c.strokeStyle = '#8a6a20'; c.lineWidth = 4; c.stroke(); c.beginPath(); c.arc(0, -52, 26, Math.PI, 0); c.closePath(); c.fillStyle = '#d9bd62'; c.fill(); c.stroke(); c.strokeStyle = '#6f4526'; c.lineWidth = 7; c.beginPath(); c.moveTo(60, 50); c.lineTo(66, -24); c.stroke(); c.fillStyle = '#aeb4c2'; c.fillRect(54, -40, 30, 18); }
  else if (kind === 'cavallo') { helm('#aeb4c2'); c.fillStyle = '#3f9cf2'; c.beginPath(); c.moveTo(-4, -70); c.lineTo(-30, -96); c.lineTo(-22, -66); c.closePath(); c.fill(); c.strokeStyle = '#c08e58'; c.lineWidth = 7; c.beginPath(); c.moveTo(40, 40); c.lineTo(96, -50); c.stroke(); c.beginPath(); c.moveTo(104, -64); c.lineTo(86, -50); c.lineTo(100, -40); c.closePath(); c.fillStyle = '#e1e5ee'; c.fill(); }
  else if (kind === 'cura') { helm('#f4f1ea'); c.fillStyle = '#e0452f'; c.fillRect(-5, -66, 10, 26); c.fillRect(-13, -58, 26, 10); c.strokeStyle = '#6f4526'; c.lineWidth = 6; c.beginPath(); c.moveTo(64, 56); c.lineTo(64, -50); c.stroke(); c.beginPath(); c.arc(64, -62, 13, 0, TAU); c.fillStyle = '#8ff0b0'; c.fill(); }
  else if (kind === 'ariete') { helm('#6f7684'); c.beginPath(); c.roundRect(24, 14, 78, 24, 10); c.fillStyle = '#9b6b3d'; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.7)'; c.lineWidth = 4; c.stroke(); c.beginPath(); c.roundRect(88, 10, 22, 32, 6); c.fillStyle = '#6f7684'; c.fill(); c.stroke(); }
  else if (kind === 'eroe') { crown(); c.fillStyle = '#c2452d'; c.beginPath(); c.moveTo(-56, -10); c.lineTo(-84, 60); c.lineTo(-40, 52); c.closePath(); c.fill(); c.strokeStyle = '#e9edf5'; c.lineWidth = 9; c.beginPath(); c.moveTo(56, 30); c.lineTo(92, -44); c.stroke(); c.strokeStyle = '#f2c230'; c.lineWidth = 8; c.beginPath(); c.moveTo(48, 12); c.lineTo(72, 24); c.stroke(); }
  else if (kind === 'esplora') { c.beginPath(); c.moveTo(-40, -44); c.lineTo(0, -96); c.lineTo(40, -44); c.closePath(); c.fillStyle = '#3f7a66'; c.fill(); c.strokeStyle = '#17482e'; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#f2c230'; c.lineWidth = 12; c.beginPath(); c.moveTo(50, 6); c.lineTo(88, -8); c.stroke(); }
  else if (kind === 'lancia') { helm('#aeb4c2'); c.strokeStyle = '#6f4526'; c.lineWidth = 6; c.beginPath(); c.moveTo(64, 56); c.lineTo(64, -68); c.stroke(); c.beginPath(); c.moveTo(64, -94); c.lineTo(53, -66); c.lineTo(75, -66); c.closePath(); c.fillStyle = '#e1e5ee'; c.fill(); }
  else if (kind === 'arco') { c.beginPath(); c.moveTo(-34, -46); c.lineTo(0, -92); c.lineTo(34, -46); c.closePath(); c.fillStyle = '#2f8f5b'; c.fill(); c.strokeStyle = '#17482e'; c.lineWidth = 4; c.stroke(); c.strokeStyle = '#c08e58'; c.lineWidth = 7; c.beginPath(); c.arc(50, 4, 40, -1.2, 1.2); c.stroke(); }
  else if (kind === 'corazza') { helm('#aeb4c2'); c.fillStyle = '#f2c230'; c.fillRect(-6, -86, 12, 22); c.beginPath(); c.roundRect(40, -8, 40, 56, 8); c.fillStyle = '#6f7684'; c.fill(); c.strokeStyle = 'rgba(30,34,44,0.8)'; c.lineWidth = 4; c.stroke(); }
  c.restore();
}
// Su certi telefoni (pieghevole Samsung del titolare, 19/11/2026) un testo scritto SUBITO DOPO il disegno di un Tuzu o del pane non
// compariva; scritto prima, sì. Per questo le icone dei Tuzu e del cibo non si disegnano sul momento: si mettono in fila (con la
// trasformazione e la trasparenza di quel momento) e si disegnano tutte insieme appena prima del prossimo pannello o bottone, e a fine fotogramma.
// Dentro un ritaglio (clip) serve la versione immediata: tuzu2dNow.
const LATER = [];
function defer(c, fn) { LATER.push([c.getTransform(), c.globalAlpha, fn]); }
function flushIcons(c) {
  if (!LATER.length) return;
  const m0 = c.getTransform(), a0 = c.globalAlpha;
  for (let i = 0; i < LATER.length; i++) { const L = LATER[i]; c.setTransform(L[0]); c.globalAlpha = L[1]; L[2](); }
  LATER.length = 0;
  c.setTransform(m0); c.globalAlpha = a0; c.beginPath();
}
const tuzu2d = (c, x, y, s, color, eyes, alpha) => defer(c, () => tuzu2dNow(c, x, y, s, color, eyes, alpha));
const tuzuIcon = (c, kind, x, y, s, color, eyes) => defer(c, () => tuzuIconNow(c, kind, x, y, s, color, eyes));
function heart(c, x, y, s, col) {
  c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.1, x, y - s * 0.35); c.bezierCurveTo(x + s * 0.8, y - s * 1.1, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); c.closePath();
  c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(40,10,20,0.6)'; c.lineWidth = 1.6; c.stroke();
}
const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
function lock(c, x, y, s) {
  c.strokeStyle = '#cbbf9f'; c.lineWidth = s * 0.28; c.beginPath(); c.arc(x, y - s * 0.3, s * 0.5, Math.PI, 0); c.stroke();
  c.fillStyle = '#cbbf9f'; c.beginPath(); c.roundRect(x - s * 0.8, y - s * 0.3, s * 1.6, s * 1.25, s * 0.2); c.fill();
}
function bread(c, x, y, r) {
  c.beginPath(); c.ellipse(x, y + r * 0.1, r * 1.15, r * 0.8, 0, 0, TAU); c.fillStyle = '#d9a25a'; c.fill(); c.strokeStyle = '#7a4a1c'; c.lineWidth = 1.6; c.stroke();
  c.strokeStyle = 'rgba(122,74,28,0.8)'; c.lineWidth = 1.4; c.lineCap = 'round'; for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(x + k * r - r * 0.15, y - r * 0.3); c.lineTo(x + k * r + r * 0.15, y + r * 0.3); c.stroke(); }
}
function wheat(c, x, y, r) {
  c.strokeStyle = '#b98a1c'; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + r); c.lineTo(x, y - r * 0.5); c.stroke();
  c.fillStyle = '#e8c64a'; for (let i = 0; i < 3; i++) for (const k of [-1, 1]) { c.beginPath(); c.ellipse(x + k * r * 0.36, y + r * 0.25 - i * r * 0.4, r * 0.32, r * 0.2, k * 0.7, 0, TAU); c.fill(); }
  c.beginPath(); c.ellipse(x, y - r * 0.85, r * 0.2, r * 0.32, 0, 0, TAU); c.fill();
}
const RES_ICON = { monete: coin, legna: wood, pietra: stone, ferro: iron, cristallo: crystal, grano: (c, x, y, r) => defer(c, () => wheat(c, x, y, r)), cibo: (c, x, y, r) => defer(c, () => bread(c, x, y, r)) };
const RES_COL = { monete: GOLD, legna: '#e0b98a', pietra: '#cfd1da', ferro: '#c5ccdb', cristallo: '#9fe9ff', grano: '#e8c64a', cibo: '#f0c890' };
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
/** Due frecce opposte: lo scambio. */
function swap(c, x, y, s, col = '#fff') {
  c.strokeStyle = col; c.lineWidth = s * 0.3; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - s, y - s * 0.45); c.lineTo(x + s, y - s * 0.45); c.moveTo(x + s * 0.4, y - s); c.lineTo(x + s, y - s * 0.45); c.lineTo(x + s * 0.4, y + s * 0.1);
  c.moveTo(x + s, y + s * 0.5); c.lineTo(x - s, y + s * 0.5); c.moveTo(x - s * 0.4, y - s * 0.05); c.lineTo(x - s, y + s * 0.5); c.lineTo(x - s * 0.4, y + s * 1.05); c.stroke();
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
  else if (type === 'mulino') { Pg([-12, 22, -9, -8, 9, -8, 12, 22], '#f1e6cc'); Pg([-13, -8, 0, -24, 13, -8], '#c2512f'); R(-4, 8, 8, 14, '#6b4226'); c.save(); c.translate(0, -6); c.rotate(time * 0.9); for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillStyle = '#f4f1ea'; c.fillRect(1, -22, 8, 18); c.strokeStyle = '#6f4526'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -24); c.stroke(); } c.restore(); }
  else if (type === 'fucina') { R(-24, -4, 48, 26, '#8b8c96', '#44454d'); Pg([-28, -4, 0, -24, 28, -4], '#4b4d5a'); R(10, -28, 10, 20, '#6f7078', '#44454d'); c.beginPath(); c.arc(15, -30, 5, 0, TAU); c.fillStyle = '#ff9d2a'; c.fill(); R(-14, 6, 14, 16, '#ff9d2a', '#5c2a10'); }
  else if (type === 'fontana') { c.beginPath(); c.ellipse(0, 12, 26, 10, 0, 0, TAU); c.fillStyle = '#b9bac6'; c.fill(); c.strokeStyle = '#55565e'; c.stroke(); c.beginPath(); c.ellipse(0, 10, 20, 6.5, 0, 0, TAU); c.fillStyle = '#5ec3ea'; c.fill(); R(-3, -12, 6, 22, '#cfd0da', '#55565e'); c.beginPath(); c.ellipse(0, -12, 11, 4, 0, 0, TAU); c.fillStyle = '#b9bac6'; c.fill(); c.stroke(); c.strokeStyle = '#d9f3ff'; c.lineWidth = 2.5; for (const k of [-1, 1]) { c.beginPath(); c.moveTo(0, -22); c.quadraticCurveTo(k * 10, -24, k * 12, -8); c.stroke(); } }
  else if (type === 'taverna') { R(-22, -4, 44, 26, '#f0dcb4'); Pg([-28, -4, 0, -28, 28, -4], '#3f7a66'); R(-5, 6, 10, 16, '#6b4226'); R(-18, 2, 8, 8, '#ffd97a'); c.beginPath(); c.roundRect(10, 0, 12, 13, 2); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.stroke(); c.beginPath(); c.arc(23, 6, 4, -1.4, 1.4); c.stroke(); }
  else if (type === 'statua') { R(-14, 10, 28, 12, '#9a9ba4', '#55565e'); c.restore(); tuzu2dNow(c, x, y - s * 0.22, s * 0.62, '#d5d6e0', '#8f909c'); c.save(); c.translate(x, y); c.scale(s / 30, s / 30); }
  else if (type === 'faro') { Pg([-22, 22, -16, 12, 16, 12, 22, 22], '#8f909c', '#55565e'); for (let k = 0; k < 4; k++) Pg([-9 + k * 1.2, 12 - k * 8, 9 - k * 1.2, 12 - k * 8, 7.8 - k * 1.2, 4 - k * 8, -7.8 + k * 1.2, 4 - k * 8], k % 2 ? '#f4f1ea' : '#c0392b'); c.fillStyle = 'rgba(255,236,150,0.6)'; c.beginPath(); c.moveTo(5, -23.5); c.lineTo(28, -31); c.lineTo(28, -16); c.closePath(); c.fill(); R(-6, -27, 12, 7, '#ffe27a', '#8a6410'); Pg([-8, -27, 0, -34, 8, -27], '#c0392b'); }
  else if (type === 'giardino') { c.beginPath(); c.roundRect(-26, -18, 52, 38, 8); c.fillStyle = '#3f8f4a'; c.fill(); c.strokeStyle = 'rgba(20,50,25,0.75)'; c.stroke(); c.beginPath(); c.roundRect(-20, -12, 40, 26, 5); c.fillStyle = '#7cc05a'; c.fill(); R(-4, -12, 8, 26, '#d9c39a', null); c.beginPath(); c.arc(0, 1, 8.5, 0, TAU); c.fillStyle = '#d9c39a'; c.fill(); c.beginPath(); c.arc(0, 0, 5.5, 0, TAU); c.fillStyle = '#2f7a3b'; c.fill(); for (const [fx, fy, col] of [[-13, -5, '#ff8fb0'], [13, -5, '#fff0a0'], [-13, 8, '#ff6f6f'], [13, 8, '#c9b6ff']]) { c.beginPath(); c.arc(fx, fy, 3.6, 0, TAU); c.fillStyle = col; c.fill(); } }
  else if (type === 'pozzo') { R(-14, 4, 28, 18, '#a3a4b0', '#55565e'); c.strokeStyle = 'rgba(60,60,70,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, 13); c.lineTo(14, 13); c.moveTo(-4, 4); c.lineTo(-4, 13); c.moveTo(6, 13); c.lineTo(6, 22); c.stroke(); c.lineWidth = 2; R(-13, -14, 3.5, 18, '#6f4526', null); R(9.5, -14, 3.5, 18, '#6f4526', null); Pg([-20, -12, 0, -26, 20, -12], '#b5482f'); c.strokeStyle = '#d9c39a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -3); c.stroke(); c.lineWidth = 2; R(-3.5, -3, 7, 6, '#c08e58', '#5c3a1e'); }
  else if (type === 'panchina') { R(-20, 2, 40, 5, '#c08e58', '#5c3a1e'); R(-20, -12, 40, 5, '#c08e58', '#5c3a1e'); R(-20, -5, 40, 4, '#c08e58', '#5c3a1e'); R(-17, 7, 4, 13, '#6f4526', null); R(13, 7, 4, 13, '#6f4526', null); }
  else if (type === 'stendardo') { R(-11, -24, 3.5, 46, '#6f4526', null); R(-13, 20, 8, 4, '#a3a4b0', '#55565e'); Pg([-7, -22, 16, -22, 16, 8, 4.5, 2, -7, 8], '#8a5cf0', 'rgba(40,20,90,0.8)'); R(-7, -22, 23, 4, '#f2c230', null); c.beginPath(); c.arc(4.5, -8, 4.5, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.arc(-9.3, -26, 3.2, 0, TAU); c.fillStyle = '#f2c230'; c.fill(); }
  else if (type === 'siepe') { for (const hx of [-17, 0, 17]) { c.beginPath(); c.roundRect(hx - 8, -6, 16, 24, 6); c.fillStyle = hx ? '#3f8f4a' : '#4c9c50'; c.fill(); c.strokeStyle = 'rgba(20,50,25,0.7)'; c.stroke(); } }
  else if (type === 'trappola') { R(-21, 8, 42, 9, '#8a5a34', '#4a2e16'); for (const hx of [-14, -5, 5, 14]) Pg([hx - 4.5, 8, hx, -13, hx + 4.5, 8], '#d4d7e0', 'rgba(50,50,60,0.85)'); }
  else if (type === 'fossato') { R(-24, -7, 48, 24, '#5a4128', '#33230f'); R(-18, -1, 36, 12, '#3f86b0', null); }
  else if (type === 'piazza') { for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) R(-24 + k * 16, -18 + i * 13, 16, 13, (i + k) % 2 ? '#d8d0bf' : '#c6bdaa', 'rgba(90,84,70,0.7)'); }
  else if (type === 'mulinoacqua') { R(-22, -6, 30, 28, '#d9cdb4'); Pg([-27, -6, -7, -24, 13, -6], '#a8763c'); R(-12, 8, 9, 14, '#6b4226'); c.beginPath(); c.arc(14, 8, 15, 0, TAU); c.strokeStyle = '#6f4526'; c.lineWidth = 4; c.stroke(); c.lineWidth = 2.4; for (let i = 0; i < 4; i++) { const a = time * 0.9 + i * Math.PI / 4; c.beginPath(); c.moveTo(14 - Math.cos(a) * 15, 8 - Math.sin(a) * 15); c.lineTo(14 + Math.cos(a) * 15, 8 + Math.sin(a) * 15); c.stroke(); } c.lineWidth = 2; c.fillStyle = '#5ec3ea'; c.fillRect(-2, 22, 30, 4); }
  else if (type === 'lampione') { R(-2.5, -14, 5, 36, '#3d3e46', null); c.beginPath(); c.arc(0, -18, 9, 0, TAU); c.fillStyle = '#ffe9a0'; c.fill(); c.strokeStyle = '#8a6410'; c.stroke(); R(-8, 20, 16, 4, '#3d3e46', null); }
  else if (type === 'aiuola') { c.beginPath(); c.roundRect(-22, -2, 44, 20, 6); c.fillStyle = '#7a5634'; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.75)'; c.stroke(); c.beginPath(); c.ellipse(0, 2, 18, 8, 0, 0, TAU); c.fillStyle = '#4f9a4b'; c.fill(); for (const [fx, fy, col] of [[-10, -2, '#ff8fb0'], [0, -6, '#fff0a0'], [10, -1, '#ff6f6f'], [-2, 4, '#c9b6ff']]) { c.beginPath(); c.arc(fx, fy, 4.4, 0, TAU); c.fillStyle = col; c.fill(); } }
  else if (type === 'albero') { R(-3, 4, 6, 18, '#6a4528', null); c.beginPath(); c.arc(0, -6, 15, 0, TAU); c.fillStyle = '#3f8f4a'; c.fill(); c.strokeStyle = 'rgba(20,50,25,0.7)'; c.stroke(); c.beginPath(); c.arc(8, 2, 9, 0, TAU); c.fillStyle = '#57a857'; c.fill(); }
  else if (type === 'strada') { Pg([-26, 18, -12, -16, 12, -16, 26, 18], '#d2b07c', '#7a5c3a'); c.strokeStyle = 'rgba(122,92,58,0.7)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(0, -14); c.lineTo(0, 16); c.stroke(); c.setLineDash([]); }
  else if (type === 'recinto') { for (const px of [-22, 0, 22]) { c.beginPath(); c.roundRect(px - 3.5, -16, 7, 38, 3); c.fillStyle = '#6f4526'; c.fill(); } R(-26, -8, 52, 5, '#c08e58', '#5c3a1e'); R(-26, 6, 52, 5, '#c08e58', '#5c3a1e'); }
  else if (type === 'mura') { R(-26, -8, 52, 30, '#9a9ba4', '#44454d'); for (let i = 0; i < 4; i++) R(-26 + i * 14.6, -18, 8.4, 10, '#b2b3be', '#44454d'); c.strokeStyle = 'rgba(60,60,70,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-26, 6); c.lineTo(26, 6); c.moveTo(-8, -8); c.lineTo(-8, 6); c.moveTo(10, 6); c.lineTo(10, 22); c.stroke(); }
  else if (type === 'cancello') { R(-26, -18, 12, 40, '#9a9ba4', '#44454d'); R(14, -18, 12, 40, '#9a9ba4', '#44454d'); Pg([-28, -18, -20, -27, -12, -18], '#b5482f'); Pg([12, -18, 20, -27, 28, -18], '#b5482f'); R(-14, -8, 28, 30, '#8a5a33', '#4a2f17'); c.strokeStyle = '#4a2f17'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 22); c.stroke(); R(-14, 2, 28, 4, '#55565e', null); }
  else if (type === 'ponte') { c.beginPath(); c.ellipse(0, 12, 28, 9, 0, 0, TAU); c.fillStyle = '#5ec3ea'; c.fill(); R(-28, -4, 56, 9, '#c08e58', '#5c3a1e'); for (const px of [-22, 0, 22]) R(px - 2.5, -14, 5, 26, '#6f4526', null); R(-28, -14, 56, 4, '#9b6b3d', '#5c3a1e'); }
  else if (type === 'scalo') { c.beginPath(); c.ellipse(2, 15, 32, 10, 0, 0, TAU); c.fillStyle = '#5ec3ea'; c.fill(); R(-30, -4, 20, 16, '#e9dcc0'); Pg([-33, -4, -20, -17, -7, -4], '#b5482f'); R(-34, -24, 5, 36, '#f4f1ea', '#8a8478'); R(-35, -29, 7, 6, '#ffd24a', '#8a5a1c'); R(-10, 9, 40, 5, '#9b6b3d', '#5c3a1e'); Pg([-2, 14, 32, 14, 27, 24, 3, 24], '#4a3a34'); R(9, -16, 2, 30, '#6f4526', null); R(21, -10, 2, 24, '#6f4526', null); Pg([2, -14, 16, -14, 16, 2, 2, 2], '#f4ecd6'); Pg([17, -8, 28, -8, 28, 4, 17, 4], '#c0392b'); }
  else if (type === 'porto') { c.beginPath(); c.ellipse(0, 14, 30, 10, 0, 0, TAU); c.fillStyle = '#5ec3ea'; c.fill(); R(-26, -6, 30, 18, '#e9dcc0'); Pg([-30, -6, -11, -22, 8, -6], '#3f7fb5'); R(-2, 8, 30, 6, '#9b6b3d', '#5c3a1e'); Pg([6, 16, 30, 16, 26, 24, 10, 24], '#b5482f'); R(17, -2, 2, 18, '#6f4526', null); Pg([19, -2, 30, 6, 19, 10], '#f4f1ea'); }
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
  logBox(c, x, y, w, h, 'btn');
  flushIcons(c);
  o = o || {};
  const col = o.disabled ? '#4a4640' : (o.color || '#3a6b35'), r = o.r ?? 12;
  c.beginPath(); c.roundRect(x, y + 4.5, w, h, r); c.fillStyle = 'rgba(0,0,0,0.36)'; c.fill();                 // l'ombra
  c.beginPath(); c.roundRect(x, y + 2.5, w, h, r); c.fillStyle = shade(col, -0.45); c.fill();                   // lo spessore
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(col, 0.22)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.18));
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(22,13,6,0.9)'; c.lineWidth = 2.5; c.stroke();
  c.beginPath(); c.roundRect(x + 2.2, y + 2.2, w - 4.4, h - 4.4, Math.max(2, r - 2)); c.strokeStyle = o.disabled ? 'rgba(255,255,255,0.12)' : (o.stroke || 'rgba(255,236,170,0.72)'); c.lineWidth = 1.5; c.stroke();
  if (!o.disabled) { c.beginPath(); c.roundRect(x + 4.5, y + 4, w - 9, h * 0.36, Math.max(2, r - 4)); c.fillStyle = 'rgba(255,255,255,0.13)'; c.fill(); }
  if (label) {
    const fs = fit(c, label, o.dx > 0 ? 2 * Math.min(w / 2 + o.dx - 34, w / 2 - o.dx - 7) : w - 14 - 2 * Math.abs(o.dx || 0), o.fs || 22, 800),      // con un'icona a sinistra (dx) la scritta non deve finirle sopra
       lx = x + w / 2 + (o.dx || 0), ly = y + h / 2 + 1;      // la scritta si stringe da sola: in tedesco o in russo è spesso più lunga
    if (!o.disabled) txt(c, label, lx, ly + 1.6, fs, 'rgba(0,0,0,0.42)', 'center', 800);
    txt(c, label, lx, ly, fs, o.disabled ? '#9a948a' : (o.fg || CREAM), 'center', 800);
  }
  ui.buttons.push({ x, y, w, h, tag: o.tag, fn: fn || (() => {}) });
}
function block(ui, x, y, w, h) { ui.buttons.push({ x, y, w, h, fn: () => {} }); }
function dim(S, a) { logBox(S.c, 0, 0, 0, 0, 'dim'); flushIcons(S.c); S.c.fillStyle = `rgba(8,8,18,${a})`; S.c.fillRect(0, 0, S.vw, S.vh); block(S.ui, 0, 0, S.vw, S.vh); }
function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + ' s';
  if (s < 3600) return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min';
}
function fmtDur(secs) { return secs < 3600 ? Math.round(secs / 60) + ' min' : Math.round(secs / 3600) + ' h'; }
function bubble(c, x, y, r, fill) { flushIcons(c); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); c.strokeStyle = 'rgba(20,14,8,0.8)'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(x - r * 0.4, y + r * 0.85); c.lineTo(x, y + r * 1.5); c.lineTo(x + r * 0.4, y + r * 0.85); c.fillStyle = fill; c.fill(); }
function bar(c, x, y, w, h, f, col) {
  const r = Math.min(h / 2, 5), fw = Math.max(h, w * Math.max(0, Math.min(1, f))), k = col || (f > 0.55 ? '#6fd45a' : f > 0.25 ? '#f1c232' : '#e0452f');
  c.fillStyle = 'rgba(15,10,6,0.85)'; c.beginPath(); c.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5); c.fill();
  c.strokeStyle = 'rgba(233,196,106,0.4)'; c.lineWidth = 1; c.stroke();
  if (f > 0.001) {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(k, 0.3)); g.addColorStop(1, shade(k, -0.18));
    c.fillStyle = g; c.beginPath(); c.roundRect(x, y, fw, h, r); c.fill();
    if (h >= 6) { c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.roundRect(x + 1.5, y + 1, Math.max(1, fw - 3), h * 0.34, r); c.fill(); }
  }
}
const ICON_K = { predone: 0.85, bruto: 1.15, capo: 1.25, campione: 1.35 };
/** Un nemico (o un soldato) come icona, centrata in (x, y), nel colore del suo popolo. */
const enemyIcon = (c, ty, x, y, k, color, eyes) => tuzuIcon(c, ty, x, y, 15 * k * (ICON_K[ty] || 1), color, eyes);

function langRow(S, cx, y) {
  const { c, ui, A } = S, lw = 210, gap = 12, sw = 150, total = lw + gap + sw;
  let x = cx - total / 2;
  const nm = LANG_NAMES[getLang()];
  button(c, ui, x, y, lw, 44, '', { color: '#2f5d7a', tag: 'langOpen' }, A.langOpen);
  txt(c, nm, x + 48, y + 23, fit(c, nm, lw - 78, 18, 700), '#fff3d6', 'left', 700); txt(c, '▾', x + lw - 20, y + 23, 16, '#fff3d6', 'center', 700);
  Z.globeIcon(c, x + 26, y + 22, 12);      // l'icona DOPO la scritta: regola Samsung
  x += lw + gap;
  const sl = `${t('sound')}: ${ui.sound ? t('on') : t('off')}`;
  button(c, ui, x, y, sw, 44, sl, { color: '#5c4330', fs: fit(c, sl, sw - 16, 17, 700) }, A.sound);
}
/** La scelta della lingua: tredici bottoni, ognuno col nome scritto nella sua lingua. */
function langPanel(S) {
  const { c, ui, vw, vh, A } = S, tall = S.tall, cols = tall ? 3 : 5, rows = Math.ceil(LANGS.length / cols), bw = tall ? 204 : 170, bh = 56, gap = 10;
  dim(S, 0.7);
  const w = cols * bw + (cols - 1) * gap + 40, h = 74 + (bh + gap + 6) + rows * (bh + gap) + 66, x = vw / 2 - w / 2, y = Math.max(20, vh / 2 - h / 2);
  panel(c, x, y, w, h, 16, 0.97); block(ui, x, y, w, h);
  head(c, t('langTitle'), vw / 2, y + 38, 26, '#f2cf73', 'center');
  // in cima: la lingua del telefono (o del browser). È accesa finché il giocatore non ne sceglie una qui sotto.
  { const s = t('langAuto') + ': ' + (LANG_NAMES[ui.devLang] || LANG_NAMES.en), aw = Math.min(w - 40, 2 * bw + gap); button(c, ui, vw / 2 - aw / 2, y + 74, aw, bh, '', { color: !ui.langSet ? '#2f7d3a' : '#2f5d7a', r: 12, tag: 'langAuto' }, A.langAuto); const fs = fit(c, s, aw - 76, 19, 800), gx = vw / 2 - width(c, s, fs, 800) / 2 - 20; txt(c, s, vw / 2 + 10, y + 75 + bh / 2, fs, '#fff3d6', 'center', 800); Z.globeIcon(c, gx, y + 74 + bh / 2, 12); }
  LANGS.forEach((l, i) => { const bx = x + 20 + (i % cols) * (bw + gap), by = y + 74 + (bh + gap + 6) + Math.floor(i / cols) * (bh + gap), on = !!ui.langSet && getLang() === l; button(c, ui, bx, by, bw, bh, LANG_NAMES[l], { color: on ? '#8a5a1c' : '#5c4330', fs: 20, r: 12, tag: 'lang_' + l }, () => A.lang(l)); });
  button(c, ui, vw / 2 - 110, y + h - 60, 220, 46, t('close'), { color: '#5c4330', fs: 18, tag: 'langClose' }, A.langClose);
}

// =====================================================================
//  SOPRA IL MONDO: evidenziazioni, barre della vita, fumetti, notte
// =====================================================================
const B_H = { trappola: 12, fossato: 4, panchina: 22, stendardo: 60, siepe: 20, piazza: 4, mulinoacqua: 60, faro: 108, giardino: 34, pozzo: 44, scalo: 74, fontana: 50, taverna: 70, statua: 54, mulino: 80, fucina: 70, lampione: 44, albero: 46, aiuola: 16, strada: 6, castello: 120, arcieri: 84, mago: 90, catapulta: 60, braciere: 70, radici: 50, casa: 62, caserma: 70, segheria: 54, cava: 54, campo: 26, recinto: 34, mura: 48, cancello: 56, bottega: 66, mercato: 56, miniera: 54, cristalliera: 54, porto: 46, ponte: 10 };
const LIGHT = { mulinoacqua: 90, faro: 210, scalo: 130, porto: 100, lampione: 120, taverna: 140, fucina: 120, mulino: 90, fontana: 70, statua: 60, castello: 240, casa: 120, caserma: 120, segheria: 80, cava: 80, cancello: 70, bottega: 120, mercato: 110, miniera: 80, cristalliera: 90 };
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
  if (!quiet) for (const id of world.jobs) {
    const n = NATURE[id], x = (n.c + 0.5) * G, y = (n.r + 0.5) * G, p = P.pt(x, y, n.kind === 'tree' ? 52 : 30);
    if (!onScreen(S, p, 30)) continue;
    const wk = world.workers.find(o => o.job === id && o.state === 'work');
    bubble(c, p.x, p.y - 8 + (wk ? 0 : bob * 0.4), 11, wk ? '#ffd24a' : '#f5ecd7'); hammer(c, p.x, p.y - 8 + (wk ? 0 : bob * 0.4), 8);
  }
  // i villaggi: nome e forza; quando l'esercito è pronto, un invito a toccarli
  if (!quiet) TRIBES.forEach((T, i) => {
    if (!world.known(i)) return;
    const v = world.d.villages[i], x = (T.c + 0.5) * G, y = (T.r + 0.5) * G, p = P.pt(x, y, 135);
    if (!onScreen(S, p, 90)) return;
    const col = v.state === 'colony', s = `${t('tr_' + T.id)} · ${col ? t('colony') : v.state === 'ally' ? t('allyTag') : t('level') + ' ' + v.level}`, w = width(c, s, 15, 800) + 68;
    c.beginPath(); c.roundRect(p.x - w / 2, p.y - 13, w, 26, 13); c.fillStyle = v.state === 'ally' ? 'rgba(28,62,44,0.9)' : 'rgba(26,20,14,0.82)'; c.fill();
    if (ui.vsel === i) { c.strokeStyle = 'rgba(255,224,120,0.95)'; c.lineWidth = 2; c.stroke(); }
    tuzu2d(c, p.x - w / 2 + 16, p.y, 8, col ? MY_COLOR : T.color, col ? INK : T.eyes);
    txt(c, s, p.x - w / 2 + 31, p.y + 1, 15, CREAM, 'left', 800); W.tribeMark(c, i, p.x + w / 2 - 15, p.y, 9);
    if (ui.vsel !== i && world.status === 'day' && P.sc(x, y) > 0.3) {      // un invito a toccare: spade se puoi attaccare, scambio se è amico
      if (v.state !== 'free' && world.tradeCheck(i) === 'ok') { bubble(c, p.x, p.y - 38 + bob, 14, '#2f7d5a'); swap(c, p.x, p.y - 38 + bob, 7); }
      else if (world.raidCheck(i) === 'ok') { bubble(c, p.x, p.y - 38 + bob, 14, '#a8322a'); cross(c, p.x, p.y - 38 + bob, 7); }
    }
  });
  flushIcons(c);
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
  const tall = S.tall, ry = tall ? 64 : 10;      // in verticale le risorse scendono alla seconda riga
  const topBtns = 14 + 54 + 4 * 64 + (isNight || raid ? 76 : 0) + 10;      // quanto prendono i bottoni in alto a destra
  // risorse (ferro e cristallo compaiono quando li scopri)
  const keys = ['monete', 'legna', 'pietra'];
  if (world.d.tech.ferro || res.ferro >= 1) keys.push('ferro');
  if (world.d.tech.cristallo || res.cristallo >= 1) keys.push('cristallo');
  const food = world.fedState() !== 'off' || world.foodStock() > 0;
  const many = keys.length + (food ? 1 : 0) > 3;
  const items = keys.map(k => [k, String(Math.floor(res[k])), RES_COL[k]]);
  if (food) items.push(['cibo', String(world.foodStock()), world.fedState() !== 'off' && world.foodStock() < world.mouths() ? BAD : RES_COL.cibo]);
  const pop = `${world.popUsed()}/${world.popMax()}`;
  let fs, gap, ir, w;
  for (const [f, g, r] of many ? [[19, 13, 9], [17, 8, 8], [15, 6, 7]] : [[22, 20, 10.5], [19, 13, 9], [17, 8, 8]]) {
    fs = f; gap = g; ir = r;
    w = 18; for (const it of items) w += ir * 2 + 7 + width(c, it[1], fs) + gap; w += 26 + width(c, pop, fs) + 12;
    if (tall ? w <= vw - 28 : 14 + w + 10 + 190 + 8 + topBtns <= vw) break;      // la riga è stretta (in verticale, o su uno schermo quadrato con tutte le risorse): si passa alla misura più piccola
  }
  panel(c, 14, ry, w, 48);
  ui.buttons.push({ x: 14, y: ry, w, h: 48, tag: 'resInfo', fn: A.resInfo });
  let x = 28;
  // prima tutti i numeri, poi tutte le icone: su un telefono (Samsung, 19/11/2026) i numeri scritti subito dopo il pane e dopo il Tuzu non comparivano
  { let tx = x; for (const [, s, col] of items) { txt(c, s, tx + ir * 2 + 7, ry + 25, fs, col); tx += ir * 2 + 7 + width(c, s, fs) + gap; } txt(c, pop, tx + 26, ry + 25, fs, CREAM); }
  for (const [k, s] of items) { c.beginPath(); RES_ICON[k](c, x + ir, ry + 24, ir); x += ir * 2 + 7 + width(c, s, fs) + gap; }
  tuzu2d(c, x + 9, ry + 24, 11, MY_COLOR); c.beginPath();
  const barX = tall ? vw - 14 - 137 : vw / 2, barY = tall ? 102 : 0;      // la barra della vita (castello di notte, casa del capo in assalto)

  if (raid) {         // assalto in corso: contro chi, e quanto regge la casa del capo
    const T = TRIBES[raid.i], label = `${t('raidOn')} · ${t('tr_' + T.id)}`, lw = width(c, label, 22, 800) + 70, bw = 250;
    const lx = tall ? 14 : Math.max(vw / 2 - lw / 2, 14 + w + 10);            // mai sopra le risorse
    panel(c, lx, 10, lw, 48);
    txt(c, label, lx + 50, 35, 22, '#ffd0c8', 'left', 800);
    tuzu2d(c, lx + 28, 34, 13, T.color, T.eyes);
    panel(c, barX - bw / 2 - 12, 64 + barY, bw + 24, 30, 10);
    bar(c, barX - bw / 2, 73 + barY, bw, 12, raid.hp / raid.maxHp, '#e0452f');
  } else {            // giorno / notte
    // mai sopra le risorse, mai sotto i bottoni: se non c'è posto la stagione si toglie e la scritta si stringe
    const base = `${isNight ? t('night') : t('day')} ${world.nextNight}${world.endless() ? ' ∞' : ''}`, room = tall ? 1e9 : vw - topBtns - (14 + w + 10);
    let label = base + ' · ' + t('s_' + world.season), lw = width(c, label, 21, 800) + 64;
    if (lw > room) { label = base; lw = Math.max(110, Math.min(room, width(c, label, 21, 800) + 64)); }
    const lx = tall ? 14 : Math.max(14 + w + 10, Math.min(vw / 2 - lw / 2, vw - topBtns - lw));
    panel(c, lx, 10, lw, 48);
    if (isNight) moon(c, lx + 28, 34, 12); else sun(c, lx + 28, 34, 8);
    txt(c, label, lx + 50, 35, fit(c, label, lw - 60, 21, 800), isNight ? '#cfd8ff' : '#ffe9a8', 'left', 800);
    if (isNight) {      // la vita del castello, sempre in vista durante l'attacco
      const f = world.castle.hp / world.maxHp(world.castle), bw = 250;
      panel(c, barX - bw / 2 - 12, 64 + barY, bw + 24, 30, 10);
      buildIcon(c, 'castello', barX - bw / 2 + 6, 79 + barY, 11, 0);
      bar(c, barX - bw / 2 + 28, 73 + barY, bw - 28, 12, f);
    }
  }

  // in alto a destra: menu, missioni, torna al castello, velocità
  let bx = vw - 14 - 54;
  button(c, ui, bx, 10, 54, 48, '', { color: '#5c4330', tag: 'menu' }, A.settings);
  c.fillStyle = CREAM; for (let i = 0; i < 3; i++) c.fillRect(bx + 15, 23 + i * 9, 24, 4);
  bx -= 64;
  button(c, ui, bx, 10, 54, 48, '', { color: '#5b4a8a', tag: 'quests' }, A.quests);
  c.fillStyle = '#f5ecd7'; c.beginPath(); c.roundRect(bx + 16, 21, 22, 27, 3); c.fill(); c.fillStyle = '#5b4a8a'; for (let i = 0; i < 3; i++) c.fillRect(bx + 20, 27 + i * 7, 14, 2.6);
  const rdy = world.questsReady() + world.challengesReady(S.now) + (world.week(S.now).ready ? 1 : 0);
  if (rdy) { c.beginPath(); c.arc(bx + 50, 14, 12, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(rdy), bx + 50, 15, 15, '#fff', 'center', 800); }
  bx -= 64;
  button(c, ui, bx, 10, 54, 48, '', { color: '#5c4330', tag: 'home' }, A.home);
  buildIcon(c, 'castello', bx + 27, 35, 13, 0);
  bx -= 64;
  button(c, ui, bx, 10, 54, 48, '', { color: '#2f5d7a', tag: 'map' }, A.mapOpen);
  Y.mapIcon(c, bx + 27, 34, 12);
  if (world.d.trips.length) { c.beginPath(); c.arc(bx + 50, 14, 11, 0, TAU); c.fillStyle = '#2f7d5a'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(world.d.trips.length), bx + 50, 15, 14, '#fff', 'center', 800); }
  if (!(tall && (isNight || raid))) {      // il mondo online (in verticale, di notte, lascia il posto alla velocità)
    bx -= 64;
    button(c, ui, bx, 10, 54, 48, '', { color: '#22506e', tag: 'online' }, A.onlineOpen);
    Z.globeIcon(c, bx + 27, 34, 13);
    if (ui.onlineDanger) { const p = 0.5 + Math.sin(ui.time * 7) * 0.5; c.beginPath(); c.roundRect(bx - 2, 8, 58, 52, 14); c.strokeStyle = 'rgba(255,74,58,' + (0.5 + p * 0.5) + ')'; c.lineWidth = 3; c.stroke(); c.beginPath(); c.arc(bx + 50, 14, 11, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, '!', bx + 50, 15, 15, '#fff', 'center', 800); }
    else if (ui.onlineNew) { c.beginPath(); c.arc(bx + 50, 14, 11, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(ui.onlineNew), bx + 50, 15, 14, '#fff', 'center', 800); }
  }
  if (isNight || raid) { bx -= 76; button(c, ui, bx, 10, 66, 48, 'x' + ui.speed, { color: ui.speed > 1 ? '#8a5a1c' : '#5c4330', fs: 22, tag: 'speed' }, A.speed); }

  {
    const m = world.morale(), k = moraleK(m), ws = `${Math.max(0, world.workersFree())}/${world.workersMax()}`, ms = String(m) + (k !== 1 ? (k > 1 ? ' +' : ' −') + Math.round(Math.abs(k - 1) * 100) + '%' : '');
    const pw = 96 + width(c, ms, 17, 800) + width(c, ws, 17, 800), px = vw - 14 - pw;
    if (tall) { c.save(); c.translate(0, 58); }      // in verticale il morale sta sulla terza riga, a destra della guida
    panel(c, px, 64, pw, 36, 12, 0.82);
    heart(c, px + 20, 82, 8, m < 30 ? '#8a8fa0' : m < 60 ? '#ff8fa8' : '#ff4f7a'); txt(c, ms, px + 36, 83, 17, m < 30 ? BAD : k > 1 ? '#9ff0b4' : CREAM, 'left', 800);
    const wx = px + 48 + width(c, ms, 17, 800); txt(c, ws, wx + 28, 83, 17, CREAM, 'left', 800); tuzuIcon(c, 'attrezzo', wx + 10, 84, 9, MY_COLOR); c.beginPath();
    if (tall) { flushIcons(c); c.restore(); }
    ui.buttons.push({ x: px, y: tall ? 122 : 64, w: pw, h: 36, tag: 'moraleInfo', fn: A.moraleInfo });
  }
  if (!raid && !isNight && !ui.place && !ui.build && !ui.multi) { const sy = (tall ? 166 : 108) + (world.fleetSlots() > 0 ? 56 : 0); W.todoButton(S, K, vw - 14 - 54, sy); Q.shopButton(S, K, vw - 14 - 54, sy + 56); Q.eventButton(S, K, vw - 14 - 54, sy + 112); }
  if (!raid && !isNight && !ui.place && !ui.build && world.fleetSlots() > 0) {
    const fx = vw - 14 - 54, fy = tall ? 166 : 108, out = world.d.fleet.filter(q => q.job).length;
    button(c, ui, fx, fy, 54, 48, '', { color: '#2f5d7a', tag: 'fleetHud' }, A.fleetOpen); V.anchorIcon(c, fx + 27, fy + 24, 13);
    if (out) { c.beginPath(); c.arc(fx + 50, fy + 4, 11, 0, TAU); c.fillStyle = '#2f7d5a'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(out), fx + 50, fy + 5, 14, '#fff', 'center', 800); }
  }
  if (raid) {
    const s = `${t('army')}: ${world.armyStrength().n}`, w2 = width(c, s, 20) + 60;
    panel(c, vw - 14 - w2, vh - 14 - 46, w2, 46);
    tuzuIcon(c, 'lancia', vw - 14 - w2 + 26, vh - 14 - 20, 12, MY_COLOR);
    txt(c, s, vw - 14 - w2 + 48, vh - 14 - 22, 20, CREAM, 'left');
    button(c, ui, 14, vh - 14 - 66, 208, 66, t('retreat'), { color: '#7a3a2c', fs: 24, tag: 'retreat' }, A.retreat);
    X.heroButtons(S, K, vw - 14 - w2 - 12, vh - 14 - 34);
    return;
  }
  if (ui.place) { placeBar(S); return; }
  if (ui.build) { buildBar(S); return; }
  ui.box = null;
  if (ui.vsel != null) villagePanel(S);
  else if (ui.sel) selPanel(S);

  // in basso a sinistra: costruire; in basso a destra: la notte
  // se il pannello aperto arriva fin lì, i due bottoni grandi si fanno da parte (il pannello ha la sua ✕)
  const hideL = ui.box && ui.box[0] < 14 + 208 + 6, hideR = ui.box && ui.box[1] > vw - 14 - 230 - 6;
  if (!hideL) { button(c, ui, 14, vh - 14 - 66, 208, 66, t('buildBtn'), { color: '#8a5a1c', fs: 24, dx: 16, tag: 'build' }, A.buildOpen); hammer(c, 44, vh - 14 - 31, 17); if (Object.keys(BUILD).some(ty => world.isNewBuild(ty))) { c.beginPath(); c.arc(14 + 208 - 6, vh - 14 - 66 + 6, 9, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, '!', 14 + 208 - 6, vh - 14 - 66 + 7, 13, '#fff', 'center', 800); } }
  if (!isNight) {
    if (!ui.sel && ui.vsel == null) { X.incoming(S, K); if (!ui.rallyPick && !ui.aiming) { X.rebuildPill(S, K); X.harvestPill(S, K); } }      // mentre scegli un punto, le pillole lasciano il posto alla scritta che ti dice cosa fare
    const pulse = world.towers() ? 0.5 + Math.sin(ui.time * 4) * 0.5 : 0;
    if (!hideR) nightButton(S, pulse);
  } else {
    const s = `${t('enemies')}: ${world.remaining}`, w2 = width(c, s, 20) + 36;
    panel(c, vw - 14 - w2, vh - 14 - 46, w2, 46);
    txt(c, s, vw - 14 - w2 / 2, vh - 14 - 22, 20, CREAM, 'center');
    X.heroButtons(S, K, vw - 14 - w2 - (world.d.castle >= 3 ? 98 : 12), vh - 14 - 36);
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
  let fw = 30 + width(c, t('from'), 15, 600) + 10; for (const i of from) fw += 22 + width(c, t('tr_' + TRIBES[i].id), 15, 700) + 34;
  const iw = width(c, t('incoming'), 17), pw = Math.max(20 + iw + 20 + types.length * 82, fw + 8);
  panel(c, 14, y0, pw, 78);
  txt(c, t('incoming'), 30, y0 + 26, 17, DIM);
  let x = 30 + iw + 30;
  for (const ty of types) { enemyIcon(c, ty, x, y0 + 28, 0.95, T0.color, T0.eyes); txt(c, '×' + sum[ty], x + 25, y0 + 28, 18, CREAM); x += 82; }
  x = 30; txt(c, t('from'), x, y0 + 61, 15, DIM, 'left', 600); x += width(c, t('from'), 15, 600) + 10;
  for (const i of from) { const T = TRIBES[i], nm = t('tr_' + T.id); tuzu2d(c, x + 8, y0 + 60, 8, T.color, T.eyes); txt(c, nm, x + 21, y0 + 61, 15, CREAM, 'left', 700); W.tribeMark(c, i, x + 32 + width(c, nm, 15, 700), y0 + 60, 8.5); x += 22 + width(c, nm, 15, 700) + 34; }
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
  const { c, world, ui, vw, vh, A } = S, L = world.d.castle, tall = S.tall, all = BUILD_CATS[ui.build.cat], gap = 8, ch = 152;
  // in orizzontale le carte stanno in una riga sola: più di otto si sfogliano a pagine
  const per = tall ? all.length : 8, pages = Math.ceil(all.length / per), page = Math.min(ui.build.page || 0, pages - 1), list = all.slice(page * per, page * per + per);
  const cols = tall ? 4 : list.length, rows = Math.ceil(list.length / cols);
  const h = tall ? 58 + rows * (ch + gap) + 4 : 176, x = 14, y = vh - h - 12, w = vw - 28;
  panel(c, x, y, w, h, 14, 0.94); block(ui, x, y, w, h);
  const nc = CAT_ORDER.length, ctw = (w - 24 - 52 - (nc - 1) * 6) / nc, cstep = 156 / Math.ceil(nc / 2);
  if (tall) CAT_ORDER.forEach((cat, i) => button(c, ui, x + 12 + i * (ctw + 6), y + 10, ctw, 38, t('cat_' + cat), { color: ui.build.cat === cat ? '#8a5a1c' : '#5c4330', fs: nc > 5 ? 14.5 : 15.5, r: 9, tag: 'cat_' + cat }, () => A.cat(cat)));
  // in orizzontale le schede stanno su due colonne: sei in fila una sotto l'altra erano troppo basse per il dito
  else CAT_ORDER.forEach((cat, i) => { const s = t('cat_' + cat); button(c, ui, x + 12 + (i % 2) * 77, y + 10 + (i >> 1) * cstep, 73, cstep - 6, s, { color: ui.build.cat === cat ? '#8a5a1c' : '#5c4330', fs: fit(c, s, 63, 14, 700), r: 9, tag: 'cat_' + cat }, () => A.cat(cat)); });
  CAT_ORDER.forEach((cat, i) => { if (cat === ui.build.cat || !BUILD_CATS[cat].some(ty => world.isNewBuild(ty))) return; const dx = tall ? x + 12 + i * (ctw + 6) + ctw - 5 : x + 12 + (i % 2) * 77 + 73 - 5, dy = tall ? y + 13 : y + 13 + (i >> 1) * cstep; c.beginPath(); c.arc(dx, dy, 6, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); });
  const x0 = tall ? x + 12 : x + 12 + 150 + 14;
  const cw = tall ? (w - 24 - gap * (cols - 1)) / cols : Math.min(122, Math.floor((w - (x0 - x) - 62) / list.length) - gap), small = cw < 112;       // con tante carte si stringono
  list.forEach((ty, i) => {
    const D = BUILD[ty], bx = x0 + (i % cols) * (cw + gap), by = tall ? y + 56 + Math.floor(i / cols) * (ch + gap) : y + 12, open = D.min <= L, tech = !D.tech || !!world.d.tech[D.tech], cp = world.cap(ty), full = cp.have >= cp.max, can = open && tech && !full, ok = can && world.afford(D.cost);
    const locked = !open || !tech, mx = bx + cw / 2, my = by + 39, mr = 29;
    flushIcons(c);
    c.beginPath(); c.roundRect(bx, by + 3, cw, ch, 11); c.fillStyle = 'rgba(0,0,0,0.36)'; c.fill();
    const g = c.createLinearGradient(0, by, 0, by + ch);
    if (locked) { g.addColorStop(0, '#4d4238'); g.addColorStop(1, '#342b23'); } else if (ok) { g.addColorStop(0, '#fbf0d6'); g.addColorStop(1, '#e6d1a2'); } else { g.addColorStop(0, '#d9cdb4'); g.addColorStop(1, '#bbad8f'); }
    c.beginPath(); c.roundRect(bx, by, cw, ch, 11); c.fillStyle = g; c.fill();
    if (PAPER && !locked) { c.fillStyle = PAPER; c.fill(); }
    c.strokeStyle = 'rgba(24,14,6,0.92)'; c.lineWidth = 2.5; c.stroke();
    c.beginPath(); c.roundRect(bx + 2.4, by + 2.4, cw - 4.8, ch - 4.8, 9); c.strokeStyle = locked ? 'rgba(255,255,255,0.1)' : ok ? '#f2cf73' : 'rgba(110,84,50,0.55)'; c.lineWidth = ok ? 2 : 1.3; c.stroke();
    // il medaglione
    if (!locked) {
      const mg = c.createRadialGradient(mx, my - 8, 3, mx, my, mr); mg.addColorStop(0, '#fffdf0'); mg.addColorStop(1, ok ? '#cfe2a4' : '#cdc3ab');
      c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fillStyle = mg; c.fill(); c.strokeStyle = ok ? '#8a6a2c' : '#8b7c62'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(mx, my, mr - 3.5, 0, TAU); c.strokeStyle = 'rgba(138,106,44,0.3)'; c.lineWidth = 1; c.stroke();
    } else { c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fill(); }
    c.globalAlpha = locked ? 0.28 : can ? 1 : 0.5; buildIcon(c, ty, mx, my - 1, 24, ui.time); c.globalAlpha = 1;
    const nm = t('b_' + ty), ns = fit(c, nm, cw - 12, small ? 15 : 16.5, 700, true);
    head(c, nm, mx, by + 83, ns, locked ? '#a39c90' : PEN, 'center', locked);
    if (!open) { lock(c, mx, my, 13); txt(c, t('needCastle', D.min), mx, by + 118, 13, DIM, 'center', 700); }
    else if (!tech) { lock(c, mx, my, 13); const q = t('needTech', t('t_' + D.tech)); txt(c, q, mx, by + 118, fit(c, q, cw - 10, 13), DIM, 'center', 700); }
    else {
      const ks = t('k_' + ty); txt(c, ks, mx, by + 101, fit(c, ks, cw - 10, small ? 10.5 : 11.5, 600), PEN2, 'center', 600);
      c.beginPath(); c.roundRect(bx + 6, by + ch - 37, cw - 12, 30, 8); c.fillStyle = 'rgba(52,35,20,0.94)'; c.fill(); c.strokeStyle = 'rgba(233,196,106,0.45)'; c.lineWidth = 1; c.stroke();
      if (full) txt(c, `${t('limit')} ${cp.have}/${cp.max}`, mx, by + ch - 21, 13.5, BAD, 'center', 800);
      else costRow(c, world, D.cost, mx, by + ch - 22, small ? 14.5 : 15.5);
      if (cp.max !== Infinity && !full) txt(c, `${cp.have}/${cp.max}`, bx + cw - 9, by + 14, 11.5, PEN2, 'right', 800);
    }
    if (world.isNewBuild(ty)) { const s = t('newTag'), nw = width(c, s, 11, 800) + 14; c.beginPath(); c.roundRect(bx - 3, by - 5, nw, 19, 6); c.fillStyle = '#c0392b'; c.fill(); c.strokeStyle = '#5a1c12'; c.lineWidth = 1.5; c.stroke(); txt(c, s, bx - 3 + nw / 2, by + 5, 11, '#fff3d6', 'center', 800); }
    ui.buttons.push({ x: bx, y: by, w: cw, h: ch, tag: 'card_' + ty, fn: () => A.pick(ty) });
  });
  if (pages > 1) { button(c, ui, x + w - 54, y + 64, 44, 60, '›', { color: '#5c4330', fs: 30, r: 12, tag: 'buildPage' }, A.buildPage); txt(c, (page + 1) + '/' + pages, x + w - 32, y + 140, 13, CREAM, 'center', 800); }
  { const s = t('moveMany'), mw = Math.min(250, width(c, s, 16, 800) + 36); button(c, ui, x + 4, y - 46, mw, 40, s, { color: '#5b4a8a', fs: 16, r: 12, tag: 'multi' }, A.multiOpen); }
  button(c, ui, x + w - 54, y + (tall ? 7 : 10), 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'buildClose' }, A.buildClose);
  cross(c, x + w - 32, y + (tall ? 29 : 32), 11);
}

/** La freccia che gira (il bottone «Ruota»). */
function rotIcon(c, x, y, s, col = '#fff') {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(2, s * 0.22); c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, s * 0.78, -Math.PI * 0.15, Math.PI * 1.35); c.stroke();
  const a = -Math.PI * 0.15, px = x + Math.cos(a) * s * 0.78, py = y + Math.sin(a) * s * 0.78;
  c.beginPath(); c.moveTo(px + s * 0.42, py - s * 0.5); c.lineTo(px + s * 0.3, py + s * 0.34); c.lineTo(px - s * 0.46, py - s * 0.1); c.closePath(); c.fill();
}
function placeBar(S) {
  const { c, world, ui, vw, vh, A } = S, pl = ui.place, st = pl.state || { why: 'pick', ok: false }, D = BUILD[pl.type];
  const w = Math.min(660, vw - 16), h = 82, x = vw / 2 - w / 2, y = vh - h - 12;
  panel(c, x, y, w, h, 14, 0.94); block(ui, x, y, w, h);
  buildIcon(c, pl.type, x + 46, y + 38, 24, ui.time);
  head(c, t('b_' + pl.type), x + 92, y + 27, 21, '#ffe9a8');
  const n = st.n || 1;
  if (D.line && st.n > 1) txt(c, '×' + st.n, x + 92 + width(c, t('b_' + pl.type), 21, 700, true) + 10, y + 28, 18, CREAM, 'left', 800);
  txt(c, t(pl.type === 'ponte' && st.why === 'pickStart' ? 'why_bridge' : 'why_' + st.why), x + 92, y + 57, 16, st.ok || st.why.startsWith('pick') ? '#bfe9a8' : BAD, 'left', 700);
  const canRot = rotStep(pl.type) > 0, shift = canRot ? 72 : 0;
  if (pl.move) txt(c, t('moving'), x + w - 170 - shift, y + 42, 16, DIM, 'right', 700); else costRow(c, world, D.cost, x + w - 236 - shift, y + 41, 19, n);
  if (canRot) { button(c, ui, x + w - 224, y + 11, 64, 60, '', { color: '#2f5d7a', tag: 'placeRotate' }, A.placeRotate); rotIcon(c, x + w - 192, y + 41, 15); }
  button(c, ui, x + w - 150, y + 11, 64, 60, '', { color: '#2f7d3a', disabled: !st.ok, tag: 'placeOk' }, A.placeConfirm);
  check(c, x + w - 118, y + 41, 15, st.ok ? '#fff' : '#9a948a');
  button(c, ui, x + w - 76, y + 11, 64, 60, '', { color: '#7a3a2c', tag: 'placeCancel' }, A.placeCancel);
  cross(c, x + w - 44, y + 41, 12);
}

function card(c, x, y, w, h, ok) {
  logBox(c, x, y, w, h, 'card');
  flushIcons(c);
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, ok ? '#62814a' : '#54453a'); g.addColorStop(1, ok ? '#3c5630' : '#382d23');
  c.beginPath(); c.roundRect(x, y + 2.5, w, h, 10); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
  c.beginPath(); c.roundRect(x, y, w, h, 10); c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(20,12,6,0.85)'; c.lineWidth = 2.5; c.stroke();
  c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h - 4, 8); c.strokeStyle = ok ? 'rgba(255,236,170,0.7)' : 'rgba(255,236,170,0.16)'; c.lineWidth = 1.4; c.stroke();
}
function selPanel(S) {
  const { c, world, ui, vw, vh, A, now } = S, b = ui.sel.b, D = BUILD[b.type], L = world.d.castle;
  const crops = b.type === 'campo' && !b.crop, cards = crops || b.type === 'caserma' || b.type === 'mercato', lc = world.levelCheck(b), hasLv = lc !== 'none', lv = b.lvl || 0;
  const tallB = S.tall && b.type === 'caserma';
  const w = Math.min(vw - 16, b.type === 'caserma' ? 880 : cards ? 680 : 640), h = tallB ? 366 : b.type === 'caserma' ? 246 : b.type === 'castello' ? 214 : cards ? 196 : hasLv ? 192 : 138, x = vw / 2 - w / 2, y = vh - h - 12;
  ui.box = [x, x + w];
  panel(c, x, y, w, h, 14, 0.95); block(ui, x, y, w, h);
  buildIcon(c, b.type, x + 42, y + 36, 22, ui.time);
  const lvl = TOWERS[b.type] || hasLv ? ` · ${t('level')} ${(b.lvl || 0) + 1}` : b.type === 'castello' ? ` · ${t('level')} ${L}` : '';
  head(c, t('b_' + b.type) + lvl, x + 82, y + 26, 22, '#ffe9a8');
  button(c, ui, x + w - 52, y + 8, 42, 42, '', { color: '#5c4330', r: 21, tag: 'selClose' }, A.selClose);
  cross(c, x + w - 31, y + 29, 9);
  if (world.moveCheck(b) === 'ok') button(c, ui, b.type === 'caserma' ? x + 16 : x + w - 172, b.type === 'caserma' ? y + 80 : y + 9, 104, 36, t('move'), { color: '#5c4330', fs: 15, r: 10, tag: 'move' }, () => A.move(b));
  if (world.canRotate(b)) { const rx = b.type === 'caserma' ? x + w - 176 : x + w - 284, ry = y + 9; button(c, ui, rx, ry, 104, 36, t('rotate'), { color: '#2f5d7a', fs: 15, r: 10, dx: 10, tag: 'rotate' }, () => A.rotate(b)); rotIcon(c, rx + 17, ry + 18, 8); }
  const demol = (bx, by, bw = 150) => { const back = world.refund(b); button(c, ui, bx, by, bw, 50, t(ui.demoAsk === b.id ? 'sure' : 'demolish'), { color: ui.demoAsk === b.id ? '#a8322a' : '#7a3a2c', fs: 17, tag: 'demolish' }, () => A.demolish(b)); return back; };
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
    if (world.hasHero()) { const H = world.d.hero; tuzuIcon(c, 'eroe', x + w - 190, y + 30, 13, MY_COLOR); txt(c, `${t('u_eroe')} · ${t('level')} ${H.lvl}`, x + w - 168, y + 30, 15, world.heroUnit() ? '#ffe9a8' : BAD, 'left', 800); X.heroItems(S, K, x + w - 186, y + 64); }
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
      if (world.d.buildings.filter(o => o.type === 'campo' && !o.crop && !(o.build > 0)).length > 1) button(c, ui, x + w - 372, y + 9, 190, 36, t('plantAll') + ': ' + (ui.plantAll ? t('on') : t('off')), { color: ui.plantAll ? '#8a5a1c' : '#5c4330', fs: 14.5, r: 10, tag: 'plantAll' }, A.plantAll);
      const cw = 118, ch = 112, gap = 8, COL = { grano: '#e8c64a', carote: '#f08a2a', zucche: '#f0822a', uva: '#7a3fb0' };
      CROP_ORDER.forEach((cr, k) => {
        const d = CROPS[cr], bx = x + 20 + k * (cw + gap), cy = y + 68, ok = world.d.res.monete >= d.cost;
        card(c, bx, cy, cw, ch, ok);
        c.globalAlpha = ok ? 1 : 0.45; c.beginPath(); c.arc(bx + 24, cy + 26, 13, 0, TAU); c.fillStyle = COL[cr]; c.fill(); c.strokeStyle = 'rgba(20,14,8,0.6)'; c.stroke();
        c.fillStyle = '#4f9a4b'; c.beginPath(); c.ellipse(bx + 30, cy + 12, 7, 3.5, -0.6, 0, TAU); c.fill(); c.globalAlpha = 1;
        txt(c, t('c_' + cr), bx + 44, cy + 20, fit(c, t('c_' + cr), cw - 54, 16, 800), ok ? CREAM : '#9a948a', 'left', 800);
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
    X.barracks(S, K, b, x, y, w, h);
  } else if (b.type === 'mercato') {
    txt(c, t(ui.sell ? 'sellHint' : 'marketHint'), x + 82, y + 54, 16, DIM, 'left', 600);
    button(c, ui, x + w - 296, y + 9, 116, 36, t(ui.sell ? 'buyMode' : 'sellMode'), { color: '#8a5a1c', fs: 15, r: 10, tag: 'marketMode' }, A.marketMode);
    const cw = 118, ch = 106, gap = 8;
    if (ui.sell) SELL_ORDER.forEach((r, k) => {
      const T = SELL[r], bx = x + 20 + k * (cw + gap), cy = y + 74, ok = world.sellCheck(r) === 'ok';
      card(c, bx, cy, cw, ch, ok);
      c.globalAlpha = ok ? 1 : 0.4; RES_ICON[r](c, bx + 26, cy + 30, 13); c.globalAlpha = 1;
      txt(c, '−' + T.give, bx + 48, cy + 31, 21, ok ? RES_COL[r] : '#9a948a', 'left', 800);
      txt(c, t('r_' + r), bx + 14, cy + 58, 13.5, DIM, 'left', 600);
      coin(c, bx + 23, cy + 85, 8); txt(c, '+' + T.get, bx + 38, cy + 86, 17, ok ? '#9ff0b4' : '#9a948a', 'left', 800);
      ui.buttons.push({ x: bx, y: cy, w: cw, h: ch, tag: 'sell_' + r, fn: () => A.sell(r) });
    });
    else TRADE_ORDER.forEach((r, k) => {
      const T = TRADE[r], bx = x + 20 + k * (cw + gap), cy = y + 74, chk = world.buyCheck(r), ok = chk === 'ok';
      card(c, bx, cy, cw, ch, ok);
      c.globalAlpha = chk === 'tech' ? 0.4 : 1; RES_ICON[r](c, bx + 26, cy + 30, 13); c.globalAlpha = 1;
      txt(c, '+' + T.give, bx + 48, cy + 31, 21, chk === 'tech' ? '#9a948a' : RES_COL[r], 'left', 800);
      txt(c, t('r_' + r), bx + 14, cy + 58, 13.5, DIM, 'left', 600);
      if (chk === 'tech') txt(c, t('needTech', t('t_' + T.tech)), bx + 14, cy + 86, 12, DIM, 'left', 700);
      else { coin(c, bx + 23, cy + 85, 8); txt(c, String(T.cost), bx + 38, cy + 86, 17, ok ? GOLD : BAD, 'left', 800); }
      ui.buttons.push({ x: bx, y: cy, w: cw, h: ch, tag: 'buy_' + r, fn: () => A.buy(r) });
    });
    if (!ui.sell) demol(x + w - 156, y + h - 62, 140);
  } else if (b.type === 'bottega') {
    txt(c, t('techHint'), x + 82, y + 54, 16, DIM, 'left', 600);
    button(c, ui, x + 20, by, 250, 50, t('techs'), { color: '#5b4a8a', fs: 20, tag: 'techOpen' }, A.tech);
    demol(x + w - 170, by);
  } else {
    const p = D.prod, parts = [], lk = LEVELS[b.type] ? levelK(lv) : 1;
    if (p) for (const k in p) parts.push(`+${Math.round(p[k] * lk)} ${t('r_' + k)} ${t('perMin')}`);
    if (D.pop) parts.push(`+${D.pop + 2 * lv} ${t('people')}`);
    if (b.type === 'mulino') parts.push(t('millInfo'));
    if (D.beauty) parts.push(`${t('morale')} +${D.beauty}`);
    if (b.type === 'fucina') parts.push(t('k_fucina'));
    if (b.type === 'faro') parts.push(t('k_faro'));
    if (b.type === 'mulinoacqua') parts.push(t('k_mulinoacqua'));
    if (b.type === 'scalo' || b.type === 'porto') parts.push(t('sea_berths', b.type === 'scalo' ? 2 + lv : lv >= 2 ? 2 : 1));
    txt(c, parts.length ? parts.join(' · ') : t('d_' + b.type), x + 82, y + 54, 17, DIM);
    if (hasLv) {
      if (lc === 'max') txt(c, t('maxed'), x + 22, y + 100, 15, DIM, 'left', 700);
      else {
        button(c, ui, x + 20, y + 76, 170, 44, t('improve'), { color: '#2f7d3a', disabled: lc !== 'ok', fs: 18, tag: 'levelUp' }, () => A.levelUp(b));
        costRow(c, world, world.levelCost(b), x + 204, y + 99, 16, 1, true);
        const WI = b.type === 'mura' ? world.wallsInfo() : null;
        if (WI && WI.n > 1 && !WI.castle) button(c, ui, x + w - 22 - 200, y + 76, 200, 44, t('wallsAll', WI.n), { color: '#2f6b3a', fs: 17, tag: 'wallsAll' }, A.wallsAll), costRow(c, world, WI.cost, x + w - 22 - 196, y + 140, 15, 1, true);
        else if (b.type !== 'mura' || lc === 'castle') txt(c, lc === 'castle' ? t('needCastle', world.levelMin(b)) : t(b.type === 'casa' ? 'lvl_casa' : b.type === 'scalo' ? 'lvl_scalo' : 'lvl_prod'), x + w - 22, y + 99, 13.5, lc === 'castle' ? BAD : '#9ff0b4', 'right', 700);
      }
    }
    if (b.type === 'scalo' || b.type === 'porto') { button(c, ui, x + w - 214, by, 194, 50, t('fleet'), { color: '#2f5d7a', fs: 19, dx: 14, tag: 'fleetOpen' }, A.fleetOpen); V.anchorIcon(c, x + w - 178, by + 25, 12); const out = world.d.fleet.filter(q => q.job).length; if (out) { c.beginPath(); c.arc(x + w - 24, by + 4, 11, 0, TAU); c.fillStyle = '#2f7d5a'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(out), x + w - 24, by + 5, 13, '#fff', 'center', 800); } }
    const back = demol(x + 20, by, 190), keys = Object.keys(back).filter(k => back[k] > 0);
    if (keys.length) { txt(c, t('back'), x + 230, by + 26, 16, DIM); const o = {}; keys.forEach(k => { o[k] = back[k]; }); costRowPlain(c, o, x + 230 + width(c, t('back'), 16) + 12, by + 26, 17); }
  }
}

/** Una riga «dai questo → ricevi quello». */
function tradeRow(c, world, tr, x, y, size) {
  const g0 = Object.keys(tr.give)[0], g1 = Object.keys(tr.get)[0], r = size * 0.44, s0 = String(tr.give[g0]), s1 = '+' + tr.get[g1];
  RES_ICON[g0](c, x + r, y, r); txt(c, s0, x + r * 2 + 5, y + 1, size, (world.d.res[g0] || 0) >= tr.give[g0] ? RES_COL[g0] : BAD, 'left', 800);
  let xx = x + r * 2 + 5 + width(c, s0, size, 800) + 12;
  c.strokeStyle = CREAM; c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx + 20, y); c.moveTo(xx + 13, y - 6); c.lineTo(xx + 20, y); c.lineTo(xx + 13, y + 6); c.stroke();
  xx += 32; RES_ICON[g1](c, xx + r, y, r); txt(c, s1, xx + r * 2 + 5, y + 1, size, RES_COL[g1], 'left', 800);
  return xx + r * 2 + 5 + width(c, s1, size, 800);
}
/** Il villaggio toccato. Nemico: attaccalo o proponi un'alleanza. Alleato o colonia: scambia risorse. */
function villagePanel(S) {
  const { c, world, ui, vw, vh, A } = S, i = ui.vsel, T = TRIBES[i], v = world.village(i);
  const gc = world.giftCheck(i), col = v.state === 'colony', ally = v.state === 'ally';
  const w = Math.min(720, vw - 16), h = gc === 'no' ? 196 : 238, x = vw / 2 - w / 2, y = vh - h - 12, by = y + h - 60;
  ui.box = [x, x + w];
  panel(c, x, y, w, h, 14, 0.95); block(ui, x, y, w, h);
  tuzu2d(c, x + 44, y + 38, 22, T.color, T.eyes);
  const vname = `${t('tr_' + T.id)} · ${col ? t('colony') : ally ? t('allyTag') : t('level') + ' ' + v.level}`;
  head(c, vname, x + 82, y + 26, 22, '#ffe9a8');
  txt(c, `${t('chief')} ${TRAITS[T.id].chief} · ${t('e_sp_' + T.id)}`, x + 124 + width(c, vname, 22, 700, true), y + 28, 13.5, DIM, 'left', 600);
  W.tribeMark(c, i, x + 100 + width(c, vname, 22, 700, true), y + 26, 11);
  if (gc !== 'no') {      // la simpatia di questo popolo, e il dono del giorno
    const ry = y + 132, rl = t('rel'), rx = x + 22 + width(c, rl, 15, 600) + 10, r = v.rel;
    txt(c, rl, x + 22, ry + 1, 15, DIM, 'left', 600);
    heart(c, rx + 8, ry, 7, r >= 60 ? '#ff4f7a' : r >= 30 ? '#ff8fa8' : '#8a8fa0'); bar(c, rx + 24, ry - 5, 130, 10, r / 100, r >= REL.peace ? '#7fe6a0' : '#ff8fa8'); txt(c, String(r), rx + 164, ry + 1, 15, CREAM, 'left', 800);
    txt(c, ally ? '' : r >= REL.peace ? t('relPeace') : r >= REL.cheap ? t('relCheap') : '', rx + 200, ry + 1, 13, '#9ff0b4', 'left', 700);
    button(c, ui, x + w - 262, ry - 20, 110, 40, t('gift'), { color: '#8a5a1c', disabled: gc !== 'ok', fs: 16, tag: 'gift' }, () => A.gift(i));
    if (gc === 'done') txt(c, t('giftDone'), x + w - 142, ry + 1, 13, DIM, 'left', 600); else costRow(c, world, giftCost(v.level), x + w - 142, ry + 1, 15, 1, true);
  }
  button(c, ui, x + w - 52, y + 8, 42, 42, '', { color: '#5c4330', r: 21, tag: 'vClose' }, A.vClose);
  cross(c, x + w - 31, y + 29, 9);

  if (col || ally) {
    // amici: cosa ti danno, e lo scambio del giorno
    if (col) { const s = `${t('tribute')} ${t('perMin')}`; txt(c, s, x + 82, y + 56, 16, DIM, 'left', 600); costRowPlain(c, v.tribute, x + 82 + width(c, s, 16, 600) + 12, y + 56, 17); }
    else txt(c, t('allyInfo', v.helpers), x + 82, y + 56, 16, DIM, 'left', 600);
    txt(c, col ? t('revoltIn', v.revoltIn) : t('allyLeft', v.allyLeft), x + 22, y + 96, 16, (col ? v.revoltIn : v.allyLeft) <= 2 ? '#ffd0c8' : '#bfe9a8', 'left', 700);
    const chk = world.tradeCheck(i);
    button(c, ui, x + 20, by, 170, 50, t('trade'), { color: '#2f7d5a', disabled: chk !== 'ok', fs: 21, tag: 'trade' }, () => A.trade(i));
    const ex = tradeRow(c, world, v.trade, x + 206, by + 25, 18);
    txt(c, chk === 'done' ? t('tradeDone') : chk === 'tech' ? t('why_tech') : t('tradeLeft', v.tradesLeft), ex + 16, by + 26, 14, chk === 'done' || chk === 'tech' ? BAD : DIM, 'left', 600);
    if (ally) {
      const ac = world.allyCheck(i);
      if (ac !== 'allied') button(c, ui, x + w - 262, by, 120, 50, t('renew'), { color: '#5b4a8a', disabled: ac !== 'ok', fs: 17, tag: 'ally' }, () => A.ally(i));
      button(c, ui, x + w - 132, by, 112, 50, t('breakAlly'), { color: '#7a3a2c', fs: 17, tag: 'breakAlly' }, () => A.breakAlly(i));
    }
    return;
  }
  // nemici: chi difende, cosa si vince, cosa chiedono per allearsi
  let gx = x + 82 + width(c, t('guards'), 16, 600) + 26;
  txt(c, t('guards'), x + 82, y + 56, 16, DIM, 'left', 600);
  for (const k in v.guards) { enemyIcon(c, k, gx, y + 56, 0.72, T.color, T.eyes); txt(c, '×' + v.guards[k], gx + 21, y + 57, 16, CREAM, 'left', 800); gx += 70; }
  txt(c, t('loot'), x + 22, y + 96, 15, DIM, 'left', 600); costRowPlain(c, v.loot, x + 22 + width(c, t('loot'), 15, 600) + 10, y + 96, 16);
  txt(c, t('allyGift'), x + 400, y + 96, 15, DIM, 'left', 600); costRow(c, world, v.allyCost, x + 400 + width(c, t('allyGift'), 15, 600) + 10, y + 96, 16, 1, true);
  const chk = world.raidCheck(i), st = world.armyStrength();
  button(c, ui, x + 20, by, 190, 50, t('attack'), { color: '#a8322a', disabled: chk !== 'ok', fs: 21, tag: 'attack' }, () => A.attack(i));
  if (chk !== 'ok') { const s = chk === 'noarmy' ? t('needArmy') : t('notNow'); txt(c, s, x + 222, by + 26, fit(c, s, 168, 15, 700), BAD, 'left', 700); }
  else { const odds = world.raidOdds(i); txt(c, `${t('army')}: ${st.n}`, x + 222, by + 15, 15, CREAM, 'left', 700); txt(c, t('odds_' + odds), x + 222, by + 36, 15, odds === 'low' ? BAD : odds === 'even' ? '#ffd24a' : '#9ff0b4', 'left', 800); }
  const ac = world.allyCheck(i);
  button(c, ui, x + 400, by, 190, 50, t('ally'), { color: '#5b4a8a', disabled: ac !== 'ok', fs: 21, tag: 'ally' }, () => A.ally(i));
  if (ac !== 'ok' && ac !== 'cost') { const s = ac === 'castle' ? t('needCastle', Math.min(5, v.level)) : ac === 'max' ? t('maxAllies') : t('notNow'); txt(c, s, x + 602, by + 26, fit(c, s, w - 614, 14, 700), BAD, 'left', 700); }
}

/** Una riga di premi o guadagni (icona + «+numero»), che parte da x. */
function costRowPlain(c, cost, x, y, size, col) {
  const r = size * 0.42;
  for (const key in cost) { RES_ICON[key](c, x + r, y, r); const s2 = '+' + cost[key]; txt(c, s2, x + r * 2 + 5, y + 1, size, col || RES_COL[key], 'left', 800); x += r * 2 + 5 + width(c, s2, size, 800) + 12; }
}

/** Le scoperte della Bottega. */
function techPanel(S) {
  const { c, world, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const cols = S.tall ? 2 : 3, rows = Math.ceil(TECH_ORDER.length / cols), ch = 92;
  const w = Math.min(1000, vw - 16), h = 64 + rows * (ch + 8) + 52, x = vw / 2 - w / 2, y = vh / 2 - h / 2, cw = (w - 40 - 10 * (cols - 1)) / cols;
  panel(c, x, y, w, h, 18, 0.96);
  title2(c, t('techs'), vw / 2, y + 36, 32, '#f2cf73');
  TECH_ORDER.forEach((id, k) => {
    const T = TECHS[id], bx = x + 20 + (k % cols) * (cw + 10), by = y + 64 + Math.floor(k / cols) * (ch + 8), chk = world.techCheck(id), done = chk === 'done', ok = chk === 'ok';
    c.beginPath(); c.roundRect(bx, by, cw, ch, 12); c.fillStyle = done ? 'rgba(74,92,58,0.9)' : ok ? 'rgba(86,74,120,0.92)' : 'rgba(255,255,255,0.06)'; c.fill();
    txt(c, t('t_' + id), bx + 14, by + 20, 17, done || ok ? CREAM : '#c9c2b4', 'left', 800);
    txt(c, t('td_' + id), bx + 14, by + 41, 12.5, DIM, 'left', 600);
    if (done) { check(c, bx + cw - 28, by + 22, 10, '#9ff0b4'); return; }
    if (chk === 'castle') { lock(c, bx + 21, by + 68, 7); txt(c, t('needCastle', T.min), bx + 36, by + 69, 13, DIM, 'left', 700); return; }
    if (chk === 'needs') { lock(c, bx + 21, by + 68, 7); txt(c, t('needTech', t('t_' + T.needs)), bx + 36, by + 69, 13, DIM, 'left', 700); return; }
    costRow(c, world, T.cost, bx + 14, by + 70, 13.5, 1, true);
    button(c, ui, bx + cw - 96, by + 52, 84, 34, t('discover'), { color: '#5b4a8a', disabled: !ok, fs: 15, r: 9, tag: 'tech_' + id }, () => A.research(id));
  });
  button(c, ui, vw / 2 - 100, y + h - 48, 200, 40, t('close'), { color: '#5c4330', fs: 19, tag: 'close' }, A.tech);
}

/** Il Tuzu guida: sempre in vista, dice cosa fare adesso, come farlo, e dà il premio. */
function guide(S) {
  const { c, world, ui, A } = S;
  if (ui.screen !== 'play') return;
  const g = world.goal(), x = 14, y = 66, w = 392, h = 96, bob = Math.sin(ui.time * 2.6) * 2.2;
  panel(c, x, y, w, h, 14, 0.9); block(ui, x, y, w, h);
  c.beginPath(); c.arc(x + 44, y + 48, 34, 0, TAU); c.fillStyle = '#3a2f55'; c.fill(); c.strokeStyle = 'rgba(233,196,106,0.8)'; c.lineWidth = 2.5; c.stroke();
  c.save(); c.beginPath(); c.arc(x + 44, y + 48, 32.5, 0, TAU); c.clip(); tuzu2d(c, x + 44, y + 56 + bob, 27, MY_COLOR); c.restore();
  // il cappello da saggio: così si distingue dagli abitanti
  c.beginPath(); c.moveTo(x + 26, y + 30 + bob); c.lineTo(x + 46, y + 4 + bob); c.lineTo(x + 62, y + 30 + bob); c.closePath(); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(x + 46, y + 4 + bob, 3.6, 0, TAU); c.fillStyle = '#fff'; c.fill();
  if (!g) { txt(c, t('goalsDone'), x + 92, y + 40, 16, '#ffe9a8', 'left', 800); txt(c, t('goalsDone2'), x + 92, y + 62, 13, DIM, 'left', 600); return; }
  txt(c, t('g_' + g.kind, g.need), x + 92, y + 19, 16.5, '#ffe9a8', 'left', 800);
  txt(c, `${g.i + 1}/${g.total}`, x + w - 12, y + 16, 11.5, DIM, 'right', 700);
  if (g.done) {
    const pulse = 0.5 + Math.sin(ui.time * 6) * 0.5;
    button(c, ui, x + 92, y + 40, 150, 42, t('claim'), { color: '#2f7d3a', fs: 19, stroke: `rgba(255,236,170,${0.6 + pulse * 0.4})`, tag: 'goalClaim' }, A.claimGoal);
    costRowPlain(c, g.reward, x + 254, y + 62, 16);
    c.beginPath(); c.arc(x + 72, y + 22, 11, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, '!', x + 72, y + 23, 15, '#fff', 'center', 800);
    return;
  }
  if (has('gt_' + g.kind)) wrap(c, t('gt_' + g.kind), x + 92, y + 39, w - 104, 12.5, CREAM, 15, 'left');
  if (g.need > 1) { bar(c, x + 92, y + 76, 120, 8, g.have / g.need, '#ffd24a'); txt(c, `${g.have}/${g.need}`, x + 220, y + 81, 13, CREAM, 'left', 700); }
  costRowPlain(c, g.reward, x + (g.need > 1 ? 268 : 92), y + 81, 13.5);
}

/** «Inizia notte», con l'orologio: quanto manca alla notte che arriva da sola e quanti anticipi restano oggi. Finiti gli anticipi resta solo il tempo. */
function nightButton(S, pulse) {
  const { c, world, ui, vw, vh, A, now } = S, w = 230, h = 66, x = vw - 14 - w, y = vh - 14 - h, glow = `rgba(255,236,170,${0.7 + pulse * 0.3})`;
  if (!world.clockOn()) { button(c, ui, x, y, w, h, t('startNight'), { color: '#2f7d3a', fs: 25, stroke: glow, tag: 'night' }, A.start); return; }
  const left = world.nightLeft(now), early = world.earlyLeft(now), due = left <= 0, can = due || early > 0;
  const sec = Math.ceil(left / 1000), tm = sec >= 3600 ? Math.floor(sec / 3600) + ' h ' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0') : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  button(c, ui, x, y, w, h, '', { color: can ? '#2f7d3a' : '#34406a', stroke: can ? glow : 'rgba(190,205,255,0.5)', tag: 'night' }, A.start);
  const top = can ? t('startNight') : t('nightIn', tm), wn = ui.nightWarn != null ? Math.max(0, Math.ceil(ui.nightWarn)) : null;
  const sub = due ? t('nightComing') + (wn != null ? ' ' + wn : '') : can ? t('nightIn', tm) + (early === Infinity ? '' : ' · ' + t('nightEarly', early)) : t('nightNoEarly');
  const fs = fit(c, top, w - 22, can ? 23 : 22, 800);
  txt(c, top, x + w / 2, y + 26.6, fs, 'rgba(0,0,0,0.42)', 'center', 800); txt(c, top, x + w / 2, y + 25, fs, can ? CREAM : '#dfe6ff', 'center', 800);
  txt(c, sub, x + w / 2, y + 49, fit(c, sub, w - 20, 13.5, 700), due ? '#ffe27a' : can ? '#d9f2c8' : '#b9c4ee', 'center', 700);
}

function hints(S) {
  const { c, ui, vw } = S;
  if (!ui.aiming) return;            // il resto dei consigli ora lo dà il Tuzu guida
  const hint = t('spellAim'), hw = width(c, hint, 20) + 44, hy = S.tall ? 228 : 108;
  panel(c, vw / 2 - hw / 2 - 26, hy, hw + 52, 52, 26, 0.9); txt(c, hint, vw / 2 - 22, hy + 27, 20, '#ffe9a8', 'center');
  button(c, ui, vw / 2 + hw / 2 - 22, hy + 4, 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'aimCancel' }, S.A.aimCancel); cross(c, vw / 2 + hw / 2, hy + 26, 9);
}

/** Che cosa c'è di nuovo, e dove si trova: compare una volta dopo un aggiornamento (e si riapre dalle impostazioni). */
function newsPanel(S) {
  const { c, ui, vw, vh, A } = S, tall = S.tall;
  dim(S, 0.68);
  const w = Math.min(760, vw - 20), rowH = tall ? 88 : 70, h = 96 + 5 * rowH + 84, x = vw / 2 - w / 2, y = Math.max(26, vh / 2 - h / 2);
  scroll(c, x, y, w, h, 18);
  ribbon(c, vw / 2, y - 19, Math.min(w - 60, 320), 44, t('news'), '#8a2f24', 24);
  txt(c, t('newsSub'), vw / 2, y + 52, 15, PEN2, 'center', 700);
  const icon = [(ix, iy) => Q.gem(c, ix, iy, 13), (ix, iy) => { c.beginPath(); coin(c, ix, iy, 12); c.beginPath(); }, (ix, iy) => hammer(c, ix, iy, 13), (ix, iy) => { c.beginPath(); wood(c, ix, iy, 12); c.beginPath(); }, (ix, iy) => moon(c, ix, iy, 12)];
  for (let i = 0; i < 5; i++) {
    const ry = y + 84 + i * rowH;
    c.beginPath(); c.arc(x + 44, ry + rowH / 2 - 6, 24, 0, TAU); c.fillStyle = 'rgba(122,84,40,0.14)'; c.fill(); c.strokeStyle = 'rgba(122,84,40,0.45)'; c.lineWidth = 1.4; c.stroke();
    head(c, t('news' + (i + 1) + 't'), x + 84, ry + 12, 18, PENRED, 'left', false);
    wrap(c, t('news' + (i + 1)), x + 84, ry + 36, w - 110, 14, PEN, 18, 'left');
    icon[i](x + 44, ry + rowH / 2 - 6);      // l'icona DOPO le scritte: regola Samsung
  }
  const by = y + h - 68;
  button(c, ui, x + 24, by, 230, 50, t('account'), { color: '#2f5d7a', fs: 19, tag: 'newsAccount' }, A.newsAccount);
  button(c, ui, x + w - 254, by, 230, 50, t('newsOk'), { color: '#2f7d3a', fs: 20, tag: 'newsOk' }, A.newsOk);
}

function settingsPanel(S) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.6);
  const h = ui.hasNotif ? 548 : 500, y0 = vh / 2 - h / 2;
  panel(c, vw / 2 - 260, y0, 520, h, 18, 0.96);
  if (ui.hasNotif) button(c, ui, vw / 2 - 228, y0 + 150 + 264, 456, 42, t(ui.notif ? 'notifOn' : 'notifOff'), { color: ui.notif ? '#2f6b3a' : '#5c4330', fs: 17, tag: 'notif' }, A.notif);
  title2(c, t('settings'), vw / 2, y0 + 46, 36, '#f2cf73');
  button(c, ui, vw / 2 + 260 - 150, y0 + 14, 136, 38, t('news'), { color: '#8a2f24', fs: 15.5, r: 10, tag: 'newsOpen' }, A.newsOpen);
  langRow(S, vw / 2, y0 + 86);
  X.settingsExtra(S, K, vw / 2, y0 + 150);
  button(c, ui, vw / 2 - 110, y0 + h - 66, 220, 50, t('close'), { color: '#5c4330', fs: 22, tag: 'close' }, A.settings);
}

function questsPanel(S) {
  const { c, world, ui, vw, vh, A, now } = S;
  dim(S, 0.6);
  const tro = ui.qtab === 1, w = tro ? Math.min(1060, vw - 16) : Math.min(660, vw - 16), h = tro && S.tall ? 790 : 516, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  panel(c, x, y, w, h, 18, 0.96);
  { const tw = Math.min(200, (w - 44) / 3), dot = world.challengesReady(now) + (world.week(now).ready ? 1 : 0);
    [[0, t('quests')], [2, t('todayTab')], [1, t('trophies')]].forEach(([k, s], j) => { const bx = vw / 2 - (tw * 3 + 16) / 2 + j * (tw + 8); button(c, ui, bx, y + 14, tw, 44, s, { color: (ui.qtab || 0) === k ? '#8a5a1c' : '#5c4330', fs: fit(c, s, tw - 16, 20, 800), tag: 'qtab' + k }, () => A.qtab(k));
      if (k === 2 && dot) { c.beginPath(); c.arc(bx + tw - 6, y + 18, 10, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); txt(c, String(dot), bx + tw - 6, y + 19, 13, '#fff', 'center', 800); } }); }
  if (tro) {
    const yy = Y.trophyGrid(S, K, x + 20, y + 76, w - 40), got = world.trophies().filter(o => o.done).length;
    txt(c, t('trophyCount', got, world.trophies().length) + (world.endless() ? '   ·   ' + t('crowns', world.d.crowns || 0) : ''), vw / 2, Math.min(yy + 18, y + h - 78), 16, '#ffe27a', 'center', 800);
  } else if (ui.qtab === 2) W.todayTab(S, K, x, y + 72, w);
  else {
    const row = (ry, title, have, goal, ready, reward, tag, fn, blue) => {
      card(c, x + 20, ry, w - 40, 76, ready);
      if (blue && !ready) { c.beginPath(); c.roundRect(x + 22, ry + 2, w - 44, 72, 8); c.fillStyle = 'rgba(70,92,150,0.42)'; c.fill(); }
      txt(c, title, x + 38, ry + 24, fit(c, title, w - 260, 19, 800), CREAM, 'left', 800);
      bar(c, x + 38, ry + 47, 320, 13, have / goal, ready ? '#ffd24a' : '#6fd45a');
      txt(c, have + '/' + goal, x + 370, ry + 54, 16, DIM);
      const bx = x + w - 196, bw = 160;
      if (ready) button(c, ui, bx, ry + 10, bw, 56, t('claim') + ' +' + reward, { color: '#2f7d3a', fs: 19, tag }, fn);
      else if (reward) { const rs = '+' + reward, rw = width(c, rs, 22, 800); txt(c, rs, bx + bw / 2 + 14, ry + 39, 22, GOLD, 'center', 800); coin(c, bx + bw / 2 + 14 - rw / 2 - 17, ry + 38, 11); }      // prima la scritta, poi la moneta, e mai una sopra l'altra
      else { check(c, bx + bw / 2, ry + 38, 12, '#9ff0b4'); }
    };
    for (let i = 0; i < 3; i++) { const q = world.quest(i); row(y + 72 + i * 84, t('q_' + q.type, q.goal), q.progress, q.goal, q.ready, q.reward, 'claim' + i, () => A.claimQuest(i)); }
    { const s = t('todayAll'); txt(c, s, vw / 2, y + 72 + 3 * 84 + 30, fit(c, s, w - 50, 15.5, 700), '#bcd0ff', 'center', 700); }
  }
  button(c, ui, vw / 2 - 110, y + h - 62, 220, 48, t('close'), { color: '#5c4330', fs: 22, tag: 'close' }, A.quests);
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

function awayPanel(S) {
  const { c, ui, vw, vh, A } = S, got = ui.away.got;
  dim(S, 0.6);
  const y0 = vh / 2 - 150;
  const keys = Object.keys(got), rows = keys.length > 3 ? [keys.slice(0, Math.ceil(keys.length / 2)), keys.slice(Math.ceil(keys.length / 2))] : [keys];
  const pw = Math.min(500, vw - 16), extra = (rows.length - 1) * 50 + (ui.away.back ? 40 : 0);
  panel(c, vw / 2 - pw / 2, y0, pw, 300 + extra, 18, 0.96);
  title2(c, t('away'), vw / 2, y0 + 56, 38, '#f2cf73');
  txt(c, t('awayText'), vw / 2, y0 + 106, fit(c, t('awayText'), pw - 36, 19, 600), '#cfd8ff', 'center', 600);
  rows.forEach((row, r) => {
    let fs = 30, ws, total;
    for (;;) { total = 0; ws = row.map(k => { const w = fs * 1.13 + width(c, '+' + got[k], fs, 800); total += w; return w; }); total += fs * 0.87 * (row.length - 1); if (total <= pw - 44 || fs <= 14) break; fs -= 1; }
    const ry = y0 + 162 + r * 50; let x = vw / 2 - total / 2;
    row.forEach((k, i) => { txt(c, '+' + got[k], x + fs * 1.13, ry + 2, fs, RES_COL[k], 'left', 800); x += ws[i] + fs * 0.87; });      // prima le scritte, poi le icone (regola Samsung)
    x = vw / 2 - total / 2; row.forEach((k, i) => { c.beginPath(); RES_ICON[k](c, x + fs * 0.43, ry, fs * 0.43); x += ws[i] + fs * 0.87; });
    flushIcons(c); c.beginPath();
  });
  if (ui.away.back) { const s = t('backGift', ui.away.back.gems); txt(c, s, vw / 2, y0 + 200 + (rows.length - 1) * 50, fit(c, s, pw - 40, 20, 800), '#ffb3f3', 'center', 800); }
  button(c, ui, vw / 2 - 120, y0 + 212 + extra, 240, 64, t('ok'), { color: '#2f7d3a', fs: 26, tag: 'awayOk' }, A.awayOk);
}

// il logo del gioco (lo stesso dell'icona): sulla schermata del titolo, sopra il nome, dove c'è posto
const LOGO = typeof Image !== 'undefined' ? new Image() : null; if (LOGO) LOGO.src = 'icon-512.png';
function titleScreen(S) {
  const { c, ui, vw, vh, A } = S;
  dim(S, 0.55);
  const y0 = vh / 2 - 230;
  if (LOGO && LOGO.complete && LOGO.naturalWidth && y0 > 170) c.drawImage(LOGO, vw / 2 - 75, y0 - 150, 150, 150);
  title2(c, t('title'), vw / 2, y0 + 60, Math.min(78, vw / 9.4), '#f2cf73');
  rule(c, vw / 2 - Math.min(260, vw * 0.3), y0 + 104, Math.min(520, vw * 0.6));
  head(c, t('subtitle'), vw / 2, y0 + 132, Math.min(28, vw / 26), '#f5ecd7', 'center');
  wrap(c, t('lore'), vw / 2, y0 + (S.tall ? 180 : 200), Math.min(780, vw - 50), 22, CREAM, 32);
  if (ui.newGame) X.titleDiff(S, K, vw / 2, y0 + 258);
  // La prima volta, senza account: si sceglie subito fra salvare la partita con un account e giocare da ospite (con l'avviso che da ospite si può perdere tutto).
  const guest = ui.newGame && !ui.signedIn, by = y0 + (ui.newGame ? 312 : 290);
  if (!guest) button(c, ui, vw / 2 - 150, by, 300, ui.newGame ? 72 : 84, t('play'), { color: '#2f7d3a', fs: 36, tag: 'play' }, A.play);
  else if (S.tall) {
    button(c, ui, vw / 2 - 210, by, 420, 70, t('accCreate'), { color: '#2f7d3a', fs: 28, tag: 'titleCreate' }, A.account);
    txt(c, t('accWhy'), vw / 2, by + 88, fit(c, t('accWhy'), vw - 40, 16, 700), '#d9f2c8', 'center', 700);
    button(c, ui, vw / 2 - 210, by + 112, 420, 62, t('guestPlay'), { color: '#5c4330', fs: 24, tag: 'play' }, A.play);
    wrap(c, t('guestWarn'), vw / 2, by + 194, Math.min(520, vw - 50), 15.5, '#ffd0a8', 21);
  } else {
    button(c, ui, vw / 2 - 330, by, 320, 66, t('accCreate'), { color: '#2f7d3a', fs: 25, tag: 'titleCreate' }, A.account);
    button(c, ui, vw / 2 + 10, by, 320, 66, t('guestPlay'), { color: '#5c4330', fs: 23, tag: 'play' }, A.play);
    txt(c, t('accWhy'), vw / 2 - 170, by + 84, fit(c, t('accWhy'), 320, 14.5, 700), '#d9f2c8', 'center', 700);
    txt(c, t('guestWarn'), vw / 2 + 170, by + 84, fit(c, t('guestWarn'), 330, 14.5, 700), '#ffd0a8', 'center', 700);
  }
  langRow(S, vw / 2, y0 + (guest ? (S.tall ? 566 : 426) : 414));
  button(c, ui, vw - 14 - 190, 14, 190, 46, t('account'), { color: '#2f5d7a', fs: 18, tag: 'titleAccount' }, A.account);
}

const K = { title2, GOLD2: '#ffd24a', txt, width, panel, scroll, ribbon, head, fit, rule, shade, PEN, PEN2, PENBAD, PENOK, PENRED, SERIF, title2, wrap, button, block, dim, bar, bubble, moon, cross, card, heart, lock, coin, costRow, costRowPlain, tuzu2d, tuzu2dNow, tuzuIcon, flushIcons, enemyIcon, tracePoly, buildIcon, check, hammer, swap, fmtTime, RES_ICON, RES_COL, CREAM, DIM, BAD, GOLD };
let vig = null;
/** Disegna tutta l'interfaccia in coordinate logiche (0..vw, 0..vh). */
export function drawUi(S) { drawAll(S); flushIcons(S.c); }
function drawAll(S) {
  const { c, ui, vw, vh } = S;
  ui.buttons.length = 0;
  if (!vig || vig.w !== vw || vig.h !== vh) { vig = { w: vw, h: vh, g: c.createRadialGradient(vw / 2, vh / 2, vh * 0.42, vw / 2, vh / 2, Math.hypot(vw, vh) * 0.56) }; vig.g.addColorStop(0, 'rgba(10,16,30,0)'); vig.g.addColorStop(1, 'rgba(10,16,30,0.3)'); }
  c.fillStyle = vig.g; c.fillRect(0, 0, vw, vh);
  worldLayer(S);
  X.marks(S, K);
  if (ui.screen === 'title') { titleScreen(S); if (ui.langPick) langPanel(S); return; }
  if (ui.flash > 0) { c.fillStyle = `rgba(220,40,30,${Math.min(0.3, ui.flash * 0.6)})`; c.fillRect(0, 0, vw, vh); }
  W.homeLabel(S, K);
  villageArrows(S);
  W.enemyArrows(S, K);
  hud(S);
  X.guide(S, K);
  if (ui.resInfo && !ui.place && !ui.build) X.resPanel(S, K);
  hints(S);
  Y.squadBar(S, K);
  W.multiBar(S, K);
  W.drillStrip(S, K);
  if (ui.banner && ui.banner.t < ui.banner.T) {
    const u = ui.banner.t / ui.banner.T, a = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
    const bw0 = width(c, ui.banner.str, 46, 700, true), bs = bw0 > vw - 40 ? 46 * (vw - 40) / bw0 : 46;      // una scritta lunga si stringe, non esce dallo schermo
    c.globalAlpha = a; title2(c, ui.banner.str, vw / 2, S.tall ? 250 : 180, bs, ui.banner.color); c.globalAlpha = 1;
  }
  if (ui.toast && ui.toast.t < ui.toast.T) {
    const u = ui.toast.t / ui.toast.T, a = u > 0.75 ? (1 - u) / 0.25 : 1, w = width(c, ui.toast.str, 20) + 44, ty = vh - (ui.build && !ui.place ? 250 : 170);
    c.globalAlpha = a; scroll(c, vw / 2 - w / 2 - 17, ty, w + 34, 44, 22); c.beginPath(); c.arc(vw / 2 - w / 2 + 8, ty + 22, 12, 0, TAU); c.fillStyle = '#b23a2a'; c.fill(); c.strokeStyle = '#5a1c12'; c.lineWidth = 1.5; c.stroke(); txt(c, '!', vw / 2 - w / 2 + 8, ty + 23, 16, '#fff3d6', 'center', 800); txt(c, ui.toast.str, vw / 2 + 15, ty + 23, 19, PENBAD, 'center', 800); c.globalAlpha = 1;
  }
  if (ui.lost) W.lostPanel(S, K);
  else if (ui.drillEnd) W.drillPanel(S, K);
  else if (ui.away) awayPanel(S);
  else if (ui.daily) Q.giftPanel(S, K);
  else if (ui.story != null) X.storyPanel(S, K);
  else if (ui.eventOpen) X.eventPanel(S, K);
  else if (ui.news) newsPanel(S);
  else if (ui.reportOpen) Y.reportPanel(S, K);
  else if (ui.seaOpen) V.seaReport(S, K);
  else if (ui.fleet) V.fleetPanel(S, K);
  else if (ui.online) Z.worldPanel(S, K);
  else if (ui.map) Y.mapPanel(S, K);
  else if (ui.roles) X.rolesPanel(S, K);
  else if (ui.quests) questsPanel(S);
  else if (ui.tech) techPanel(S);
  else if (ui.settings) settingsPanel(S);
  else if (ui.todo) W.todoPanel(S, K);
  else if (ui.vBanner) W.bannerPanel(S, K);
  else if (ui.shop) Q.shopPanel(S, K);
  else if (ui.evInfo) Q.eventPanel(S, K);
  if (ui.need) Q.needPanel(S, K);
  if (ui.langPick) langPanel(S);
  // il dito: mai sopra un foglio che aspetta una risposta; dentro un pannello grande (scoperte, flotta…) indica solo bottoni
  if (!(ui.lost || ui.drillEnd || ui.away || ui.daily || ui.story != null || ui.eventOpen || ui.reportOpen || ui.online || ui.seaOpen || ui.news || ui.langPick || ui.todo || ui.vBanner || ui.multi || ui.shop || ui.need || ui.evInfo)) Y.finger(S, K, !!(ui.roles || ui.quests || ui.tech || ui.settings || ui.fleet));
}

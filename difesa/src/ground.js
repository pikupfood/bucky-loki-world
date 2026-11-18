// Pittore del terreno (texture 2D stesa sul piano 3D) e temi dei livelli.
import { WORLD_W, WORLD_H, WALL_X, mulberry32 } from './data.js';

const TAU = Math.PI * 2;
const G1 = ['#2f7a3b', '#3f9449'], G2 = ['#3a8a45', '#52a657'], OR = ['#d9822b', '#eda043'], RD = ['#c2452d', '#de6441'], YL = ['#dba63a', '#efc257'];

// grass: colore pieno (uguale al prato fuori mappa, così non si vede il bordo)
export const THEMES = {
  valle:   { grass: '#69a653', tuft: 'rgba(36,92,38,0.4)', path: ['#96744a', '#c9a56c', 'rgba(226,196,140,0.55)'], trees: [G1, G2, G1, G2, OR, YL], flowers: true, veil: [10, 14, 46], pond: 1 },
  autunno: { grass: '#8a9f4c', tuft: 'rgba(90,96,30,0.4)', path: ['#8f6b42', '#c39a62', 'rgba(222,188,130,0.55)'], trees: [OR, RD, YL, OR, RD, G1], flowers: false, veil: [18, 12, 40], pond: 0 },
  bosco:   { grass: '#4d8947', tuft: 'rgba(24,66,30,0.45)', path: ['#7c6443', '#b0935f', 'rgba(206,180,128,0.5)'], trees: [['#225c30', '#2f7a3b'], ['#1d5230', '#2a6e3c'], G1], flowers: true, veil: [6, 12, 34], pond: 1, dense: true },
  neve:    { grass: '#dfe9ee', tuft: 'rgba(150,170,185,0.5)', path: ['#8f8577', '#b9ab97', 'rgba(220,210,196,0.6)'], trees: [['#2d5c48', '#f4f8fb'], ['#356651', '#f4f8fb']], flowers: false, veil: [14, 22, 60], pond: 0, snow: true },
  palude:  { grass: '#65803f', tuft: 'rgba(40,60,24,0.45)', path: ['#6f5f42', '#a08c62', 'rgba(190,172,128,0.5)'], trees: [['#55702f', '#6f8a3d'], ['#4a5f2a', '#62783a'], ['#5b4a35', '#74603f']], flowers: false, veil: [10, 20, 30], pond: 3 },
  erebo:   { grass: '#584863', tuft: 'rgba(30,18,40,0.5)', path: ['#5f5068', '#8a7a92', 'rgba(170,150,180,0.45)'], trees: [['#3b3046', '#5a4a66'], ['#2f2638', '#4a3d55']], flowers: false, veil: [16, 6, 40], pond: 0, dead: true },
  borgo:   { grass: '#6fab57', tuft: 'rgba(36,92,38,0.4)', path: ['#96744a', '#c9a56c', 'rgba(226,196,140,0.55)'], trees: [G1, G2, G1, OR, YL], flowers: true, veil: [10, 14, 46], pond: 0 },
};

function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill(); }

function base(c, th, rnd, keepOut) {
  c.fillStyle = th.grass; c.fillRect(0, 0, WORLD_W, WORLD_H);
  // chiazze: lontane dai bordi, così la texture si fonde col prato esterno
  for (let i = 0; i < 230; i++) {
    const rx = 30 + rnd() * 70, x = 110 + rnd() * (WORLD_W - 220), y = 80 + rnd() * (WORLD_H - 160);
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,200,0.055)' : 'rgba(10,40,20,0.07)';
    c.beginPath(); c.ellipse(x, y, rx, rx * (0.4 + rnd() * 0.3), rnd() * 3, 0, TAU); c.fill();
  }
  c.strokeStyle = th.tuft; c.lineWidth = 1.5; c.lineCap = 'round';
  for (let i = 0; i < 560; i++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
    c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 1, y - 5); c.moveTo(x + 1, y); c.lineTo(x + 3, y - 6); c.stroke();
  }
  if (th.flowers) for (let i = 0; i < 110; i++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
    if (keepOut && keepOut(x, y)) continue;
    ell(c, x, y, 2.2, 2.2, ['#fff4c9', '#ffd1e3', '#ffe07a', '#ffffff'][Math.floor(rnd() * 4)]);
  }
}

function pond(c, x, y, s, th) {
  ell(c, x, y + 4, 62 * s, 40 * s, 'rgba(0,0,0,0.14)');
  ell(c, x, y, 56 * s, 35 * s, th.snow ? '#a9d3ea' : '#4f9fc4');
  ell(c, x, y - 2, 48 * s, 28 * s, th.snow ? '#c6e4f3' : '#62b4d6');
  ell(c, x - 14 * s, y - 10 * s, 16 * s, 5 * s, 'rgba(255,255,255,0.4)');
}

/** Terreno di battaglia per un livello. Ritorna gli stagni disegnati (per non metterci alberi). */
export function paintBattle(canvas, L, k) {
  const th = THEMES[L.theme];
  canvas.width = Math.ceil(WORLD_W * k); canvas.height = Math.ceil(WORLD_H * k);
  const c = canvas.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  const rnd = mulberry32(7 + L.id * 13);
  base(c, th, rnd, (x, y) => L.dist(x, y) < 40);

  const ponds = [];
  let tries = 0;
  while (ponds.length < (th.pond || 0) && tries++ < 300) {
    const x = 260 + rnd() * 940, y = 130 + rnd() * 470, s = 0.8 + rnd() * 0.4;
    if (L.dist(x, y) < 115 || L.spots.some(p => Math.hypot(p.x - x, p.y - y) < 105) || ponds.some(p => Math.hypot(p.x - x, p.y - y) < 200)) continue;
    ponds.push({ x, y, r: 62 * s }); pond(c, x, y, s, th);
  }

  // piazza del borgo (macchia morbida, senza bordi netti)
  const pg = c.createRadialGradient(WALL_X + 150, L.gate.y, 60, WALL_X + 150, L.gate.y, 330);
  pg.addColorStop(0, 'rgba(200,172,116,0.9)'); pg.addColorStop(0.7, 'rgba(200,172,116,0.55)'); pg.addColorStop(1, 'rgba(200,172,116,0)');
  c.fillStyle = pg; c.fillRect(WALL_X - 4, 0, WORLD_W - WALL_X + 4, WORLD_H);

  // sentiero
  const trace = () => { c.beginPath(); c.moveTo(L.path[0].x, L.path[0].y); for (const p of L.path) c.lineTo(p.x, p.y); c.lineTo(WALL_X + 90, L.gate.y); };
  c.lineJoin = 'round'; c.lineCap = 'round';
  trace(); c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 76; c.stroke();
  trace(); c.strokeStyle = th.path[0]; c.lineWidth = 66; c.stroke();
  trace(); c.strokeStyle = th.path[1]; c.lineWidth = 56; c.stroke();
  trace(); c.strokeStyle = th.path[2]; c.lineWidth = 34; c.stroke();
  for (let i = 0; i < 280; i++) {
    const p = L.path[Math.floor(rnd() * L.path.length)];
    ell(c, p.x + (rnd() - 0.5) * 46, p.y + (rnd() - 0.5) * 46, 1.5 + rnd() * 2.5, 1 + rnd() * 1.6, rnd() < 0.5 ? 'rgba(60,45,30,0.4)' : 'rgba(255,240,210,0.4)');
  }

  // terra bruciata attorno al portale
  ell(c, L.portal.x, L.portal.y, 86, 62, 'rgba(40,26,48,0.5)');
  ell(c, L.portal.x, L.portal.y, 58, 42, 'rgba(26,14,34,0.5)');
  return ponds;
}

// Disposizione del villaggio (coordinate sul piano, come in battaglia: x a destra, y verso chi guarda).
export const VILLAGE = {
  center: { x: 800, y: 400 },
  slots: {
    castello: { x: 800, y: 175 }, santuario: { x: 1060, y: 285 }, fucina: { x: 545, y: 285 },
    mercato: { x: 650, y: 510 }, mura: { x: 960, y: 520 }, vedetta: { x: 1250, y: 430 },
    mulino: { x: 300, y: 300 }, campi: { x: 170, y: 470 },
  },
  plots: [{ x: 300, y: 470 }, { x: 410, y: 470 }, { x: 300, y: 565 }, { x: 410, y: 565 }, { x: 300, y: 660 }, { x: 410, y: 660 }],
  bounds: { x0: 90, x1: 1340, z0: 60, z1: 700 },
};

export function paintVillage(canvas, k) {
  const th = THEMES.borgo;
  canvas.width = Math.ceil(WORLD_W * k); canvas.height = Math.ceil(WORLD_H * k);
  const c = canvas.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  const rnd = mulberry32(99);
  base(c, th, rnd, null);
  const V = VILLAGE, dirt = ['#96744a', '#c9a56c', 'rgba(226,196,140,0.55)'];
  c.lineCap = 'round'; c.lineJoin = 'round';
  // stradine dalla piazza a ogni edificio e ai campi
  const road = (pts, w) => {
    for (let pass = 0; pass < 3; pass++) {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]);
      c.strokeStyle = dirt[pass]; c.lineWidth = w - pass * 9 - (pass === 2 ? 8 : 0); c.stroke();
    }
  };
  for (const id in V.slots) { const s = V.slots[id]; road([[V.center.x, V.center.y], [(V.center.x + s.x) / 2, (V.center.y + s.y) / 2 + 12], [s.x, s.y + 30]], 44); }
  road([[V.center.x, V.center.y], [V.center.x, 760]], 56);
  road([[V.slots.campi.x + 40, V.slots.campi.y + 30], [355, 520], [355, 690]], 30);
  // piazza
  ell(c, V.center.x, V.center.y, 132, 92, '#96744a'); ell(c, V.center.x, V.center.y, 124, 85, '#c9a56c'); ell(c, V.center.x, V.center.y, 96, 64, 'rgba(226,196,140,0.6)');
  for (let i = 0; i < 160; i++) { const a = rnd() * TAU, r = rnd(); ell(c, V.center.x + Math.cos(a) * 118 * r, V.center.y + Math.sin(a) * 80 * r, 2 + rnd() * 2, 1.4 + rnd(), rnd() < 0.5 ? 'rgba(60,45,30,0.35)' : 'rgba(255,240,210,0.4)'); }
  pond(c, 1150, 610, 1.1, th);
}

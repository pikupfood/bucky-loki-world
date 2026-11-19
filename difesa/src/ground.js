// Pittore del terreno: una texture 2D stesa sul piano 3D della mappa.
// Prato a chiazze, sottobosco, ghiaioni sotto le montagne, laghi con la riva, strade a curve, piazze dei villaggi.
import { WORLD_W, WORLD_H, G, CASTLE, TRIBES, NATURE, ROADS, LAKES, HILLS, PEAKS, lakeEdge, mulberry32, ISLAND } from './data.js';

const TAU = Math.PI * 2;
export const GRASS = '#5f9f47';
export const VEIL = [10, 14, 46];

function ell(c, x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = fill; c.fill(); }
function glow(c, x, y, r, col, a0, sy = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a0})`); g.addColorStop(0.6, `rgba(${col},${a0 * 0.55})`); g.addColorStop(1, `rgba(${col},0)`);
  c.save(); c.translate(x, y); c.scale(1, sy); c.translate(-x, -y); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
function lakePath(c, L, s) {
  c.beginPath();
  for (let k = 0; k <= 60; k++) { const a = k / 60 * TAU, e = lakeEdge(L, a) * s, x = L.x + Math.cos(a) * L.rx * e, y = L.y + Math.sin(a) * L.ry * e; if (k) c.lineTo(x, y); else c.moveTo(x, y); }
  c.closePath();
}

/** Dipinge la mappa. k = pixel per unità di mondo. */
export function paintWorld(canvas, k) {
  canvas.width = Math.ceil(WORLD_W * k); canvas.height = Math.ceil(WORLD_H * k);
  const c = canvas.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  const rnd = mulberry32(99);
  c.fillStyle = GRASS; c.fillRect(0, 0, WORLD_W, WORLD_H);
  // prato a chiazze larghe: più chiaro, più scuro, più giallo (lontano dai bordi, così si fonde col prato esterno)
  const tones = ['255,255,190', '20,70,30', '190,210,90', '60,140,70'];
  for (let i = 0; i < 520; i++) {
    const r = 90 + rnd() * 240, x = 200 + rnd() * (WORLD_W - 400), y = 160 + rnd() * (WORLD_H - 320);
    glow(c, x, y, r, tones[i % 4], 0.07 + rnd() * 0.06, 0.55 + rnd() * 0.3);
  }
  // sottobosco: sotto gli alberi il prato è più scuro
  for (const n of NATURE) if (n.kind === 'tree') glow(c, (n.c + 0.5) * G, (n.r + 0.5) * G + 6, 46 * n.size, '18,64,30', 0.2);
  // ghiaioni sotto le montagne, erba più viva sotto le colline
  for (const p of PEAKS) glow(c, p.x, p.y + 8, p.r * 1.55, '112,104,92', 0.5, 0.9);
  for (const p of PEAKS) for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = p.r * (0.9 + rnd() * 0.5); ell(c, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 3 + rnd() * 5, 2 + rnd() * 3.5, rnd() < 0.5 ? 'rgba(90,86,80,0.55)' : 'rgba(170,164,154,0.5)', rnd() * 3); }
  for (const h of HILLS) glow(c, h.x, h.y + 10, Math.max(h.rx, h.ry) * 1.35, '40,96,44', 0.34, 0.8);

  // laghi: riva di sabbia, acqua bassa, acqua, fondo
  for (const L of LAKES) {
    lakePath(c, L, 1.2); c.fillStyle = 'rgba(96,150,74,0.55)'; c.fill();
    lakePath(c, L, 1.12); c.fillStyle = '#d8c79a'; c.fill();
    lakePath(c, L, 1.05); c.fillStyle = '#8fd6e8'; c.fill();
    lakePath(c, L, 0.98); c.fillStyle = '#4fb4de'; c.fill();
    lakePath(c, L, 0.7); c.fillStyle = 'rgba(40,140,200,0.55)'; c.fill();
    lakePath(c, L, 0.42); c.fillStyle = 'rgba(30,110,180,0.5)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = rnd() * 0.6, x = L.x + Math.cos(a) * L.rx * d, y = L.y + Math.sin(a) * L.ry * d, w = 12 + rnd() * 16; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - 3, x + w, y); c.stroke(); }
    for (let i = 0; i < 26; i++) { const a = rnd() * TAU, e = lakeEdge(L, a) * (1.08 + rnd() * 0.06); ell(c, L.x + Math.cos(a) * L.rx * e, L.y + Math.sin(a) * L.ry * e, 2 + rnd() * 3, 1.6 + rnd() * 2, rnd() < 0.5 ? 'rgba(120,110,96,0.7)' : 'rgba(240,232,210,0.8)'); }
  }

  { const ix = (ISLAND.c + 0.5) * G, iy = (ISLAND.r + 0.5) * G, R = (ISLAND.rad + 0.7) * G;      // l'isola nel lago grande
    ell(c, ix, iy, R * 1.12, R * 1.04, 'rgba(143,214,232,0.9)'); ell(c, ix, iy, R, R * 0.94, '#d8c79a'); ell(c, ix, iy, R * 0.82, R * 0.76, GRASS); glow(c, ix, iy, R * 0.8, '255,255,190', 0.18); }

  // strade: prima le secondarie (da villaggio a villaggio), poi quelle che portano al castello
  c.lineCap = 'round'; c.lineJoin = 'round';
  const trace = (R) => { c.beginPath(); R.pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); };
  for (const main of [false, true]) for (const R of ROADS) {
    if (R.main !== main) continue;
    const W = main ? 34 : 24;
    trace(R); c.strokeStyle = 'rgba(70,104,48,0.5)'; c.lineWidth = W + 22; c.stroke();        // bordo d'erba pestata
    trace(R); c.strokeStyle = 'rgba(122,92,58,0.85)'; c.lineWidth = W + 7; c.stroke();
    trace(R); c.strokeStyle = '#c9a674'; c.lineWidth = W; c.stroke();
    trace(R); c.strokeStyle = 'rgba(226,198,146,0.75)'; c.lineWidth = W * 0.5; c.stroke();
    trace(R); c.strokeStyle = 'rgba(150,116,78,0.35)'; c.lineWidth = 2.4; c.setLineDash([3, 26]); c.lineDashOffset = rnd() * 20; c.stroke(); c.setLineDash([]);
    for (let i = 4; i < R.pts.length - 4; i += 3) { const p = R.pts[i]; if (rnd() < 0.5) ell(c, p.x + (rnd() - 0.5) * W * 1.3, p.y + (rnd() - 0.5) * W * 1.3, 2 + rnd() * 2.6, 1.6 + rnd() * 2, rnd() < 0.5 ? 'rgba(90,70,50,0.5)' : 'rgba(240,226,196,0.6)'); }
  }

  // piazzale del castello
  const cx = (CASTLE.c + CASTLE.w / 2) * G, cy = (CASTLE.r + CASTLE.h / 2) * G;
  glow(c, cx, cy, 250, '204,174,120', 0.95, 0.92);
  for (let i = 0; i < 170; i++) { const a = rnd() * TAU, r = rnd() * 180; ell(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 1.5 + rnd() * 2.5, 1 + rnd() * 1.6, rnd() < 0.5 ? 'rgba(60,45,30,0.3)' : 'rgba(255,240,210,0.35)'); }

  // la piazza di ogni villaggio: terra battuta a macchie irregolari, senza contorni tracciati
  for (const p of TRIBES) {
    const px = (p.c + 0.5) * G, py = (p.r + 0.5) * G;
    glow(c, px, py, 170, '198,168,114', 0.95, 0.92);
    for (let i = 0; i < 7; i++) { const a = rnd() * TAU, d = 70 + rnd() * 90; glow(c, px + Math.cos(a) * d, py + Math.sin(a) * d, 70 + rnd() * 60, '198,168,114', 0.6, 0.8); }
    for (let i = 0; i < 4; i++) {        // orti
      const a = rnd() * TAU, d = 150 + rnd() * 50, x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      c.save(); c.translate(x, y); c.rotate(rnd() * 3); c.fillStyle = 'rgba(122,86,52,0.75)'; c.fillRect(-24, -16, 48, 32);
      c.strokeStyle = i % 2 ? 'rgba(90,160,70,0.9)' : 'rgba(226,190,80,0.9)'; c.lineWidth = 3; for (let r = -10; r <= 10; r += 7) { c.beginPath(); c.moveTo(-20, r); c.lineTo(20, r); c.stroke(); }
      c.restore();
    }
    for (let i = 0; i < 110; i++) { const a = rnd() * TAU, r = rnd() * 200; ell(c, px + Math.cos(a) * r, py + Math.sin(a) * r * 0.9, 1.5 + rnd() * 2.5, 1 + rnd() * 1.6, rnd() < 0.5 ? 'rgba(60,45,30,0.3)' : 'rgba(255,240,210,0.35)'); }
  }

  // ciuffi d'erba e fiori a gruppi
  c.strokeStyle = 'rgba(40,104,44,0.42)'; c.lineWidth = 1.6; c.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
    c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 1.2, y - 5.5); c.moveTo(x + 1, y); c.lineTo(x + 3, y - 6.5); c.moveTo(x, y); c.lineTo(x, y - 7); c.stroke();
  }
  const petals = ['#fff4c9', '#ffd1e3', '#ffe07a', '#ffffff', '#c9b6ff'];
  for (let i = 0; i < 150; i++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H, col = petals[Math.floor(rnd() * petals.length)], n = 4 + Math.floor(rnd() * 8);
    for (let j = 0; j < n; j++) ell(c, x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 50, 2.4, 2.4, col);
  }
}

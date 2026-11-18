// Pittore del terreno: una texture 2D stesa sul piano 3D della mappa.
import { WORLD_W, WORLD_H, G, CASTLE, PORTALS, mulberry32 } from './data.js';

const TAU = Math.PI * 2;
const G1 = ['#2f7a3b', '#3f9449'], G2 = ['#3a8a45', '#52a657'], OR = ['#d9822b', '#eda043'], YL = ['#dba63a', '#efc257'];
export const GRASS = '#69a653';
export const TREE_PAL = [G1, G2, G1, G2, OR, YL];
export const DEAD_PAL = ['#3b3046', '#5a4a66'];
export const VEIL = [10, 14, 46];

function ell(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill(); }

/** Dipinge il prato della mappa: chiazze, ciuffi, fiori, sentieri dai portali al castello. k = pixel per unità. */
export function paintWorld(canvas, k) {
  canvas.width = Math.ceil(WORLD_W * k); canvas.height = Math.ceil(WORLD_H * k);
  const c = canvas.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  const rnd = mulberry32(99);
  c.fillStyle = GRASS; c.fillRect(0, 0, WORLD_W, WORLD_H);
  // chiazze: lontane dai bordi, così la texture si fonde col prato esterno
  for (let i = 0; i < 620; i++) {
    const rx = 30 + rnd() * 80, x = 120 + rnd() * (WORLD_W - 240), y = 90 + rnd() * (WORLD_H - 180);
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,200,0.055)' : 'rgba(10,40,20,0.07)';
    c.beginPath(); c.ellipse(x, y, rx, rx * (0.4 + rnd() * 0.3), rnd() * 3, 0, TAU); c.fill();
  }
  const cx = (CASTLE.c + CASTLE.w / 2) * G, cy = (CASTLE.r + CASTLE.h / 2) * G;
  // sentieri battuti dai portali al castello: dicono da dove arriva il pericolo
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const p of PORTALS) {
    const px = (p.c + 0.5) * G, py = (p.r + 0.5) * G, mx = (px + cx) / 2 + (rnd() - 0.5) * 120, my = (py + cy) / 2 + (rnd() - 0.5) * 120;
    const tr = () => { c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(mx, my, cx, cy); };
    tr(); c.strokeStyle = 'rgba(150,116,74,0.22)'; c.lineWidth = 58; c.stroke();
    tr(); c.strokeStyle = 'rgba(201,165,108,0.22)'; c.lineWidth = 40; c.stroke();
    tr(); c.strokeStyle = 'rgba(226,196,140,0.16)'; c.lineWidth = 20; c.stroke();
  }
  // piazzale del castello
  const pg = c.createRadialGradient(cx, cy, 40, cx, cy, 230);
  pg.addColorStop(0, 'rgba(200,172,116,0.85)'); pg.addColorStop(0.6, 'rgba(200,172,116,0.45)'); pg.addColorStop(1, 'rgba(200,172,116,0)');
  c.fillStyle = pg; c.fillRect(cx - 240, cy - 240, 480, 480);
  for (let i = 0; i < 150; i++) { const a = rnd() * TAU, r = rnd() * 170; ell(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 1.5 + rnd() * 2.5, 1 + rnd() * 1.6, rnd() < 0.5 ? 'rgba(60,45,30,0.3)' : 'rgba(255,240,210,0.35)'); }
  // ciuffi d'erba e fiori
  c.strokeStyle = 'rgba(36,92,38,0.4)'; c.lineWidth = 1.5;
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
    c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 1, y - 5); c.moveTo(x + 1, y); c.lineTo(x + 3, y - 6); c.stroke();
  }
  for (let i = 0; i < 320; i++) ell(c, rnd() * WORLD_W, rnd() * WORLD_H, 2.2, 2.2, ['#fff4c9', '#ffd1e3', '#ffe07a', '#ffffff'][Math.floor(rnd() * 4)]);
  // terra bruciata attorno ai portali
  for (const p of PORTALS) {
    const px = (p.c + 0.5) * G, py = (p.r + 0.5) * G;
    ell(c, px, py, 110, 90, 'rgba(40,26,48,0.42)'); ell(c, px, py, 70, 56, 'rgba(26,14,34,0.45)');
  }
}

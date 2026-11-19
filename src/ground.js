// Pittore del terreno: una texture 2D stesa sul piano 3D della mappa.
// Prato a chiazze, sottobosco, ghiaioni sotto le montagne, laghi con la riva, strade a curve, piazze dei villaggi.
import { WORLD_W, WORLD_H, G, CASTLE, TRIBES, NATURE, ROADS, LAKES, HILLS, PEAKS, lakeEdge, mulberry32, ISLAND, ROAD_AT, COLS, ROWS, RIVERS, RIVER_AT, SEA_W } from './data.js';

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

/** Dove una strada scavalca un fiume: il centro del ponte, la direzione della strada, quanto è lungo, e se è una strada maestra. */
/** Il colore del mare al largo: lo stesso della distesa fuori dalla mappa. */
export const SEA = '#3aa3d6';
export function bridgeSpots() {
  const out = [], on = (p) => { const c = Math.floor(p.x / G), r = Math.floor(p.y / G); return c >= 0 && r >= 0 && c < COLS && r < ROWS && RIVER_AT[r * COLS + c] === 3; };
  for (const Q of ROADS) {
    let i0 = -1;
    for (let i = 0; i <= Q.pts.length; i++) {
      const hit = i < Q.pts.length && on(Q.pts[i]);
      if (hit && i0 < 0) i0 = i;
      if (!hit && i0 >= 0) {
        const a = Q.pts[Math.max(0, i0 - 1)], b = Q.pts[Math.min(Q.pts.length - 1, i)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        if (L > 60 && !out.some(o => Math.hypot(o.x - x, o.y - y) < 110)) out.push({ x, y, dx: (b.x - a.x) / L, dy: (b.y - a.y) / L, len: L, main: Q.main });
        i0 = -1;
      }
    }
  }
  return out;
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
  for (const n of NATURE) if (n.kind === 'tree' && !n.wet) glow(c, (n.c + 0.5) * G, (n.r + 0.5) * G + 6, 46 * n.size, '18,64,30', 0.2);
  // ghiaioni sotto le montagne, erba più viva sotto le colline
  for (const p of PEAKS) glow(c, p.x, p.y + 8, p.r * 1.55, '112,104,92', 0.5, 0.9);
  for (const p of PEAKS) for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = p.r * (0.9 + rnd() * 0.5); ell(c, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 3 + rnd() * 5, 2 + rnd() * 3.5, rnd() < 0.5 ? 'rgba(90,86,80,0.55)' : 'rgba(170,164,154,0.5)', rnd() * 3); }
  for (const h of HILLS) glow(c, h.x, h.y + 10, Math.max(h.rx, h.ry) * 1.35, '40,96,44', 0.34, 0.8);

  // fiumi, primo passaggio (sotto i laghi, così alla foce non resta una riga di sabbia): l'erba umida e la sabbia delle rive
  const river = (R) => { c.beginPath(); R.pts.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const R of RIVERS) { river(R); c.strokeStyle = 'rgba(96,150,74,0.55)'; c.lineWidth = 246; c.stroke(); river(R); c.strokeStyle = '#d8c79a'; c.lineWidth = 222; c.stroke(); }

  // il mare tutto attorno: spiaggia, acqua bassa, mare; la riva ondeggia un po'. Va sopra le rive dei fiumi (la foce resta aperta).
  { const S = SEA_W * G + 8, wob = (q) => 15 * Math.sin(q * 0.011) + 9 * Math.sin(q * 0.027 + 1.3) + 5 * Math.sin(q * 0.063 + 0.4);
    const band = (inset, col) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(WORLD_W, 0); for (let x = WORLD_W; x >= 0; x -= 30) c.lineTo(x, Math.max(0, inset + wob(x))); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, WORLD_H); c.lineTo(WORLD_W, WORLD_H); for (let x = WORLD_W; x >= 0; x -= 30) c.lineTo(x, WORLD_H - Math.max(0, inset + wob(x + 900))); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, WORLD_H); for (let y = WORLD_H; y >= 0; y -= 30) c.lineTo(Math.max(0, inset + wob(y + 1700)), y); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(WORLD_W, 0); c.lineTo(WORLD_W, WORLD_H); for (let y = WORLD_H; y >= 0; y -= 30) c.lineTo(WORLD_W - Math.max(0, inset + wob(y + 2600)), y); c.closePath(); c.fill();
    };
    band(S + 52, 'rgba(96,150,74,0.5)'); band(S + 36, '#e4d3a4'); band(S + 10, '#9adcea'); band(S - 6, '#55b9e0'); band(S - 44, SEA);
    const rs = mulberry32(808); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (let i = 0; i < 150; i++) { const side = i % 4, q = rs(), d = 10 + rs() * (S - 34), w = 12 + rs() * 16, x = side === 0 ? q * WORLD_W : side === 1 ? q * WORLD_W : side === 2 ? d : WORLD_W - d, y = side === 0 ? d : side === 1 ? WORLD_H - d : q * WORLD_H; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y - 3, x + w, y); c.stroke(); } }

  // laghi: riva di sabbia, acqua bassa, acqua, fondo
  for (const L of LAKES) { lakePath(c, L, 1.2); c.fillStyle = 'rgba(96,150,74,0.55)'; c.fill(); lakePath(c, L, 1.12); c.fillStyle = '#d8c79a'; c.fill(); }
  // l'acqua dei fiumi va qui: sopra la sabbia dei laghi (la foce resta aperta) e sotto la loro acqua (nel lago il fiume non si vede)
  for (const R of RIVERS) { river(R); c.strokeStyle = '#8fd6e8'; c.lineWidth = 202; c.stroke(); river(R); c.strokeStyle = '#4fb4de'; c.lineWidth = 184; c.stroke(); river(R); c.strokeStyle = 'rgba(40,140,200,0.5)'; c.lineWidth = 112; c.stroke(); }
  for (const L of LAKES) {
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

  // fiumi, secondo passaggio: acqua bassa, acqua, il filo della corrente; poi i guadi (acqua chiara e sassi) e i ponti di pietra delle strade
  { const rr = mulberry32(515), inRiver = (p) => { const cc = Math.floor(p.x / G), q = Math.floor(p.y / G); return cc >= 0 && q >= 0 && cc < COLS && q < ROWS && RIVER_AT[q * COLS + cc] > 0; };
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const R of RIVERS) {
      c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineWidth = 2.2;
      for (let i = 3; i < R.pts.length - 4; i += 4) { const p = R.pts[i], q = R.pts[i + 2]; if (!inRiver(p)) { rr(); rr(); continue; } const ox = (rr() - 0.5) * 130, oy = (rr() - 0.5) * 130; c.beginPath(); c.moveTo(p.x + ox, p.y + oy); c.lineTo(q.x + ox, q.y + oy); c.stroke(); }
      for (let i = 2; i < R.pts.length - 2; i += 2) if (rr() < 0.5 && inRiver(R.pts[i])) { const p = R.pts[i], q = R.pts[i + 1], L = Math.hypot(q.x - p.x, q.y - p.y) || 1, s = rr() < 0.5 ? -1 : 1, d = 104 + rr() * 8; ell(c, p.x - (q.y - p.y) / L * d * s, p.y + (q.x - p.x) / L * d * s, 2 + rr() * 3.4, 1.6 + rr() * 2.4, rr() < 0.5 ? 'rgba(120,110,96,0.7)' : 'rgba(240,232,210,0.8)'); }
    }
    for (const R of RIVERS) for (const m of R.marks) {
      if (m.kind !== 2) continue;
      const nx = -m.ty, ny = m.tx, half = Math.max(1.6, m.len * 0.5) * G;
      c.lineCap = 'butt'; c.beginPath(); c.moveTo(m.x - m.tx * half, m.y - m.ty * half); c.lineTo(m.x + m.tx * half, m.y + m.ty * half); c.strokeStyle = '#bfe9ee'; c.lineWidth = 202; c.stroke(); c.strokeStyle = 'rgba(216,199,154,0.5)'; c.lineWidth = 120; c.stroke(); c.lineCap = 'round';
      for (let k = -7; k <= 7; k++) for (const s of [-1, 1]) ell(c, m.x + nx * k * 13.5 + m.tx * s * 15 + (rr() - 0.5) * 8, m.y + ny * k * 13.5 + m.ty * s * 15 + (rr() - 0.5) * 8, 6 + rr() * 4, 4.6 + rr() * 3, rr() < 0.5 ? '#a9a59c' : '#cbc7bc', rr() * 3);
    }
    for (const B of bridgeSpots()) { const W = (B.main ? 34 : 24) + 34, hl = B.len / 2 + 22; c.lineCap = 'butt'; c.beginPath(); c.moveTo(B.x - B.dx * hl, B.y - B.dy * hl); c.lineTo(B.x + B.dx * hl, B.y + B.dy * hl); c.strokeStyle = '#55514b'; c.lineWidth = W + 9; c.stroke(); c.strokeStyle = '#aaa69d'; c.lineWidth = W; c.stroke(); c.lineCap = 'round'; }
  }

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
  glow(c, cx, cy, 390, '204,174,120', 0.42, 0.94);      // lo spiazzo arriva fin dove si fermano le strade
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

/** Le strade costruite dal giocatore, dipinte sulla mappa con lo stesso disegno di quelle che c'erano già: bordo d'erba pestata,
 *  ciglio scuro, terra battuta, centro chiaro; si uniscono fra loro e alle strade della mappa, e alle svolte curvano.
 *  canvas = la mappa in uso · base = la stessa mappa senza strade costruite · cells = [{ c, r }] · prev = il riquadro dipinto l'ultima volta.
 *  Rende il riquadro dipinto adesso (in pixel), da ripassare come prev la prossima volta. */
export function paintBuiltRoads(canvas, base, k, cells, prev) {
  const c = canvas.getContext('2d'), set = new Set(cells.map(q => q.r * COLS + q.c));
  let box = null;
  if (cells.length) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of cells) { x0 = Math.min(x0, q.c); y0 = Math.min(y0, q.r); x1 = Math.max(x1, q.c + 1); y1 = Math.max(y1, q.r + 1); }
    box = [Math.max(0, Math.floor((x0 * G - 130) * k)), Math.max(0, Math.floor((y0 * G - 130) * k)), Math.min(canvas.width, Math.ceil((x1 * G + 130) * k)), Math.min(canvas.height, Math.ceil((y1 * G + 130) * k))];
  }
  const all = prev && box ? [Math.min(prev[0], box[0]), Math.min(prev[1], box[1]), Math.max(prev[2], box[2]), Math.max(prev[3], box[3])] : prev || box;
  if (!all) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(base, all[0], all[1], all[2] - all[0], all[3] - all[1], all[0], all[1], all[2] - all[0], all[3] - all[1]);      // via le strade di prima
  if (!cells.length) return null;
  const on = (cc, rr) => cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && (set.has(rr * COLS + cc) || !!ROAD_AT[rr * COLS + cc]), H = G / 2;
  // I raccordi. Le strade della mappa sono curve morbide: non passano dal centro dei loro quadretti. Un pezzo costruito lì accanto
  // si allunga quindi fino al punto più vicino della strada DIPINTA (prima si fermava al quadretto, e fra i due restava un taglio).
  const links = [];
  for (const q of cells) {
    const x = (q.c + 0.5) * G, y = (q.r + 0.5) * G;
    let close = false; for (let dr = -2; dr <= 2 && !close; dr++) for (let dc = -2; dc <= 2; dc++) { const cc = q.c + dc, rr = q.r + dr; if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && ROAD_AT[rr * COLS + cc]) { close = true; break; } }
    if (close) { let bd = (G * 2.4) ** 2, bp = null; for (const R of ROADS) for (const p of R.pts) { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd) { bd = d; bp = p; } } if (bp && bd > 9) links.push([x, y, bp.x, bp.y]); }
    // due pezzi in diagonale senza niente in mezzo si toccano lo stesso
    for (const [dc, dr] of [[1, 1], [1, -1]]) if (set.has((q.r + dr) * COLS + q.c + dc) && !set.has(q.r * COLS + q.c + dc) && !set.has((q.r + dr) * COLS + q.c)) links.push([x, y, x + dc * G, y + dr * G]);
  }
  const trace = () => {
    c.beginPath();
    for (const [ax, ay, bx, by] of links) { c.moveTo(ax, ay); c.lineTo(bx, by); }
    for (const q of cells) {
      const x = (q.c + 0.5) * G, y = (q.r + 0.5) * G, m = [[x + H, y], [x - H, y], [x, y + H], [x, y - H]];
      const n = [on(q.c + 1, q.r), on(q.c - 1, q.r), on(q.c, q.r + 1), on(q.c, q.r - 1)], idx = [0, 1, 2, 3].filter(i => n[i]);
      if (idx.length === 2 && !(n[0] && n[1]) && !(n[2] && n[3])) { c.moveTo(m[idx[0]][0], m[idx[0]][1]); c.quadraticCurveTo(x, y, m[idx[1]][0], m[idx[1]][1]); }       // una svolta: curva
      else if (!idx.length) { c.moveTo(x - 0.5, y); c.lineTo(x + 0.5, y); }                                                                                                  // un pezzo solo: uno spiazzo tondo
      else for (const i of idx) { c.moveTo(x, y); c.lineTo(m[i][0], m[i][1]); }
    }
  };
  c.setTransform(k, 0, 0, k, 0, 0); c.lineCap = 'round'; c.lineJoin = 'round';
  const W = 30;
  for (const [col, w] of [['rgba(70,104,48,0.5)', W + 18], ['rgba(122,92,58,0.85)', W + 7], ['#c9a674', W], ['rgba(226,198,146,0.75)', W * 0.5]]) { trace(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  for (const q of cells) {        // qualche sassolino, sempre gli stessi
    const rnd = mulberry32(q.r * 977 + q.c * 131 + 5);
    for (let i = 0; i < 2; i++) ell(c, (q.c + 0.5) * G + (rnd() - 0.5) * 20, (q.r + 0.5) * G + (rnd() - 0.5) * 20, 1.6 + rnd() * 2, 1.2 + rnd() * 1.6, rnd() < 0.5 ? 'rgba(90,70,50,0.45)' : 'rgba(240,226,196,0.6)');
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  return box;
}

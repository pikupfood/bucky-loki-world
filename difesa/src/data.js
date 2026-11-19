// Dati di gioco: mappa a quadretti, edifici, torri, nemici, colture, notti. Nessuna dipendenza dal browser.

export const G = 40;                 // lato di un quadretto, in unità di mondo
export const COLS = 120, ROWS = 84;
export const WORLD_W = COLS * G, WORLD_H = ROWS * G;
export const CASTLE = { c: 58, r: 40, w: 3, h: 3 };
export const START = { monete: 150, legna: 130, pietra: 0, ferro: 0, cristallo: 0 };
export const SELL_REFUND = 0.5;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- popoli ----------
// Tutti i Tuzu hanno la stessa forma (quella del logo): cambia solo il colore. Il tuo popolo è viola.
// Ogni popolo ha un villaggio sulla mappa: può attaccarti di notte, diventare tuo alleato, o una tua colonia.
// level: forza di partenza · from: prima notte in cui attacca · good: quello che dà (tributo, scambi) · wants: quello che chiede
// ATTENZIONE: l'ordine non si cambia (i salvataggi tengono i villaggi per posizione nell'elenco). I nuovi vanno in coda.
export const MY_COLOR = '#b592f5';
export const TRIBES = [
  { id: 'rossi',    color: '#ee5a52', eyes: '#2b2a33', c: 20,  r: 56, level: 1, from: 1,  good: 'legna',     wants: 'pietra' },
  { id: 'blu',      color: '#3f9cf2', eyes: '#2b2a33', c: 101, r: 24, level: 2, from: 3,  good: 'pietra',    wants: 'legna' },
  { id: 'gialli',   color: '#f4c430', eyes: '#2b2a33', c: 73,  r: 9,  level: 3, from: 7,  good: 'ferro',     wants: 'monete' },
  { id: 'neri',     color: '#3b3947', eyes: '#ffffff', c: 47,  r: 76, level: 4, from: 12, good: 'cristallo', wants: 'ferro' },
  { id: 'turchesi', color: '#19c2b0', eyes: '#2b2a33', c: 29,  r: 13, level: 2, from: 5,  good: 'monete',    wants: 'legna' },
  { id: 'bianchi',  color: '#f4f1ea', eyes: '#2b2a33', c: 105, r: 66, level: 3, from: 9,  good: 'cristallo', wants: 'ferro' },
];
export const VILLAGE_R = 5;            // il territorio di un villaggio è largo 2·R+1 quadretti: lì non si costruisce
export const REVOLT_NIGHTS = 6;        // una colonia si ribella dopo tante notti, e torna più forte
export const ALLY_NIGHTS = 5;          // un'alleanza dura tante notti, poi va rinnovata
export const MAX_ALLIES = 2;
export const TRADES_PER_DAY = 3;       // scambi al giorno con ogni villaggio amico
for (const t of TRIBES) {              // l'uscita del villaggio: tre quadretti dal centro, verso il castello
  const dx = CASTLE.c + 1 - t.c, dy = CASTLE.r + 1 - t.r, d = Math.hypot(dx, dy);
  t.gate = { c: Math.round(t.c + dx / d * 3.4), r: Math.round(t.r + dy / d * 3.4) };
}
export const villageHp = (L) => 500 + 400 * (L - 1);
/** I difensori di un villaggio di livello L. */
export function villageGuards(L) { const o = { orco: 3 + 2 * L }; if (L >= 2) o.bruto = L - 1; if (L >= 4) o.capo = 1; return o; }
const GOOD_RATE = { monete: 6, legna: 8, pietra: 6, ferro: 3, cristallo: 2 };
/** Il bottino di una conquista. */
export function villageLoot(t, L) { const o = { monete: 120 + 80 * L, legna: 60 * L, pietra: 40 * L }; o[t.good] = (o[t.good] || 0) + GOOD_RATE[t.good] * 10 * L; return o; }
/** Quello che una colonia paga al minuto. */
export function villageTribute(t, L) { const o = { monete: 4 + 2 * L }; o[t.good] = (o[t.good] || 0) + GOOD_RATE[t.good]; return o; }
/** Il dono che un villaggio chiede per allearsi (o per rinnovare l'alleanza). */
export function allyCost(t, L) { const o = { monete: 80 + 60 * L }; o[t.wants] = (o[t.wants] || 0) + 30 * L; return o; }
/** Quanti guerrieri manda un alleato a difenderti di notte. */
export const allyHelpers = (L) => 1 + L;
const TRADE_GIVE = { monete: 60, legna: 40, pietra: 30, ferro: 20 }, TRADE_GET = { monete: 50, legna: 40, pietra: 30, ferro: 15, cristallo: 8 };
/** Uno scambio con un villaggio amico: gli dai `give` e ricevi `get`. */
export function villageTrade(t) { return { give: { [t.wants]: TRADE_GIVE[t.wants] }, get: { [t.good]: TRADE_GET[t.good] } }; }

// ---------- rilievo: montagne, colline, laghi (sempre uguali). Lì non si costruisce e non si passa ----------
// TERRAIN[i]: 0 libero · 1 montagna · 2 collina · 3 acqua
export const TERRAIN = new Uint8Array(COLS * ROWS);
export const PEAKS = [], HILLS = [], LAKES = [];
const RANGES = [      // catene: da (c0, r0) a (c1, r1), larghezza in quadretti
  [35, 27, 47, 17, 2.1], [33, 41, 38, 52, 1.9], [81, 28, 87, 43, 2.2], [55, 59, 69, 64, 2.0], [85, 9, 92, 17, 1.8],
  [10, 34, 20, 38, 1.7], [66, 22, 60, 13, 1.5], [88, 54, 96, 50, 1.6], [28, 68, 36, 73, 1.6], [112, 36, 116, 48, 1.8],
];
const HILL_AT = [[46, 33, 2.6, 2.0], [71, 50, 2.8, 2.2], [44, 63, 2.4, 2.0], [97, 39, 2.6, 2.1], [57, 24, 2.3, 1.9], [24, 44, 2.5, 2.0], [14, 22, 2.8, 2.2], [78, 73, 2.6, 2.0], [108, 12, 2.4, 2.0], [62, 72, 2.0, 1.8], [8, 70, 2.6, 2.2], [92, 78, 2.4, 1.9]];
const LAKE_AT = [[72, 34, 4.6, 3.2], [34, 60, 3.6, 2.6], [93, 62, 3.6, 2.8], [50, 8, 4.2, 2.6]];
/** Il bordo di un lago visto dal suo centro, in direzione a (1 = l'ellisse esatta). */
export const lakeEdge = (L, a) => 1 + 0.16 * Math.sin(3 * a + L.p1) + 0.1 * Math.sin(5 * a + L.p2);
(function () {
  const rnd = mulberry32(777), cx = CASTLE.c + 1, cy = CASTLE.r + 1;
  const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && Math.hypot(c - cx, r - cy) > 10 && !TRIBES.some(t => Math.abs(t.c - c) <= VILLAGE_R + 3 && Math.abs(t.r - r) <= VILLAGE_R + 3);
  const each = (c0, r0, rx, ry, fn) => { for (let r = Math.floor(r0 - ry - 1); r <= Math.ceil(r0 + ry + 1); r++) for (let c = Math.floor(c0 - rx - 1); c <= Math.ceil(c0 + rx + 1); c++) if (free(c, r)) fn(c, r, (c + 0.5 - c0) / rx, (r + 0.5 - r0) / ry); };
  for (const [c0, r0, c1, r1, wd] of RANGES) {
    const n = Math.ceil(Math.hypot(c1 - c0, r1 - r0) / 1.05);
    for (let i = 0; i <= n; i++) {
      const u = i / n, c = c0 + (c1 - c0) * u + (rnd() - 0.5) * 1.5, r = r0 + (r1 - r0) * u + (rnd() - 0.5) * 1.5, rad = wd * (0.7 + rnd() * 0.5) * (0.62 + 0.38 * Math.sin(u * Math.PI));
      if (!free(Math.floor(c), Math.floor(r))) continue;
      each(c, r, rad, rad, (cc, rr, dx, dy) => { if (dx * dx + dy * dy <= 1) TERRAIN[rr * COLS + cc] = 1; });
      PEAKS.push({ x: c * G, y: r * G, r: rad * G * (1.0 + rnd() * 0.25), h: rad * G * (1.7 + rnd() * 1.0), rot: rnd() * 6.283, snow: rad > 1.45 });
    }
  }
  for (const [c, r, rx, ry] of HILL_AT) {
    if (!free(c, r)) continue;
    each(c, r, rx, ry, (cc, rr, dx, dy) => { if (dx * dx + dy * dy <= 1 && !TERRAIN[rr * COLS + cc]) TERRAIN[rr * COLS + cc] = 2; });
    HILLS.push({ x: c * G, y: r * G, rx: rx * G * 1.12, ry: ry * G * 1.12, h: 46 + rnd() * 34, rot: rnd() * 6.283 });
  }
  for (const [c, r, rx, ry] of LAKE_AT) {
    const L = { x: c * G, y: r * G, rx: rx * G, ry: ry * G, p1: rnd() * 6.283, p2: rnd() * 6.283 };
    each(c, r, rx * 1.3, ry * 1.3, (cc, rr) => { const dx = (cc + 0.5 - c) / rx, dy = (rr + 0.5 - r) / ry, e = lakeEdge(L, Math.atan2(dy, dx)); if (dx * dx + dy * dy <= e * e * 0.92 && !TERRAIN[rr * COLS + cc]) TERRAIN[rr * COLS + cc] = 3; });
    LAKES.push(L);
  }
})();

// ---------- strade: da ogni villaggio al castello e da un villaggio al vicino, a curve attorno al rilievo ----------
// STEP[i]: quanto costa passare da quel quadretto. Sulle strade costa meno, così di notte i nemici le seguono.
export const STEP = new Float32Array(COLS * ROWS);
export const ROADS = [];              // { pts: [{x, y}], main }  (main = porta al castello)
export const ROAD_AT = new Uint8Array(COLS * ROWS);
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
/** Distanze (pesate con STEP) da un gruppo di quadretti, girando attorno al rilievo. */
export function terrainFlow(targets) {
  const N = COLS * ROWS, dist = new Float64Array(N).fill(1e9), heap = [];
  const push = (v, i) => { heap.push([v, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let m = k; const l = 2 * k + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (const i of targets) { dist[i] = 0; push(0, i); }
  while (heap.length) {
    const [v, i] = pop();
    if (v > dist[i]) continue;
    const c = i % COLS, r = (i / COLS) | 0;
    for (const [dc, dr] of DIR8) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const ni = nr * COLS + nc;
      if (TERRAIN[ni] || (dc && dr && (TERRAIN[r * COLS + nc] || TERRAIN[nr * COLS + c]))) continue;
      const nv = v + (dc && dr ? 1.414 : 1) * STEP[ni];
      if (nv < dist[ni]) { dist[ni] = nv; push(nv, ni); }
    }
  }
  return dist;
}
(function () {
  const rnd = mulberry32(31), GW = 20, GH = 15, grid = [];
  for (let i = 0; i < (GW + 1) * (GH + 1); i++) grid.push(rnd());
  const noise = (c, r) => { const x = c / COLS * GW, y = r / ROWS * GH, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, g = (a, b) => grid[Math.min(GH, b) * (GW + 1) + Math.min(GW, a)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy; };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) STEP[r * COLS + c] = 1 + 1.7 * noise(c, r);      // terreno «mosso»: le strade non vanno dritte
  const castle = []; for (let r = CASTLE.r; r < CASTLE.r + CASTLE.h; r++) for (let c = CASTLE.c; c < CASTLE.c + CASTLE.w; c++) castle.push(r * COLS + c);
  const trace = (dist, c, r) => {
    const out = [[c, r]];
    for (let guard = 0; guard < 600 && dist[r * COLS + c] > 0; guard++) {
      let best = null, bd = dist[r * COLS + c];
      for (const [dc, dr] of DIR8) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue; if (dc && dr && (TERRAIN[r * COLS + nc] || TERRAIN[nr * COLS + c])) continue; const v = dist[nr * COLS + nc]; if (v < bd) { bd = v; best = [nc, nr]; } }
      if (!best) break;
      [c, r] = best; out.push(best);
    }
    return out;
  };
  const lay = (cells, main) => {
    if (cells.length < 3) return;
    for (const [c, r] of cells) { STEP[r * COLS + c] = 0.42; ROAD_AT[r * COLS + c] = 1; }
    let pts = cells.filter((_, i) => i % 3 === 0 || i === cells.length - 1).map(([c, r]) => ({ x: (c + 0.5) * G, y: (r + 0.5) * G }));
    for (let k = 0; k < 3; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }); } o.push(pts[pts.length - 1]); pts = o; }
    ROADS.push({ pts, main });
  };
  for (const t of TRIBES) lay(trace(terrainFlow(castle), t.gate.c, t.gate.r), true);       // dopo ogni strada le altre tendono a unirsi
  for (const [a, b] of [[0, 4], [4, 2], [2, 1], [1, 5], [5, 3], [3, 0]]) { const A = TRIBES[a], B = TRIBES[b]; lay(trace(terrainFlow([A.r * COLS + A.c]), B.c, B.r), false); }
})();

// ---------- edifici ----------
// w,h: quadretti occupati · cost: risorse · min: livello del castello che lo sblocca
// flat: non blocca il passaggio (campi) · line: si tira in fila · gate: i tuoi passano, i nemici no
// tech: la scoperta che serve per costruirlo
export const BUILD = {
  castello:  { w: 3, h: 3, hp: 800 },
  casa:      { w: 2, h: 2, hp: 120, cost: { legna: 40 }, cat: 'eco', min: 1, pop: 4, prod: { monete: 6 } },
  campo:     { w: 2, h: 2, hp: 50, cost: { legna: 30 }, cat: 'eco', min: 1, flat: true },
  segheria:  { w: 2, h: 2, hp: 120, cost: { monete: 50 }, cat: 'eco', min: 1, prod: { legna: 12 }, cap: (L) => 1 + L },
  cava:      { w: 2, h: 2, hp: 140, cost: { legna: 60 }, cat: 'eco', min: 2, prod: { pietra: 9 }, cap: (L) => L },
  mercato:   { w: 2, h: 2, hp: 120, cost: { legna: 60, monete: 40 }, cat: 'eco', min: 2, cap: () => 1 },
  bottega:   { w: 2, h: 2, hp: 140, cost: { legna: 80, pietra: 30 }, cat: 'eco', min: 2, cap: () => 1 },
  miniera:   { w: 2, h: 2, hp: 150, cost: { legna: 80, pietra: 60 }, cat: 'eco', min: 2, prod: { ferro: 5 }, cap: (L) => L - 1, tech: 'ferro' },
  cristalliera: { w: 2, h: 2, hp: 150, cost: { pietra: 100, ferro: 40 }, cat: 'eco', min: 3, prod: { cristallo: 3 }, cap: (L) => L - 2, tech: 'cristallo' },
  arcieri:   { w: 2, h: 2, hp: 160, cost: { legna: 50 }, cat: 'dif', min: 1, tower: true },
  radici:    { w: 2, h: 2, hp: 140, cost: { legna: 40, monete: 20 }, cat: 'dif', min: 2, tower: true },
  caserma:   { w: 2, h: 2, hp: 220, cost: { legna: 80, pietra: 40 }, cat: 'dif', min: 2, cap: (L) => L - 1 },
  mago:      { w: 2, h: 2, hp: 140, cost: { pietra: 60, monete: 40 }, cat: 'dif', min: 3, tower: true },
  catapulta: { w: 2, h: 2, hp: 180, cost: { legna: 80, pietra: 40 }, cat: 'dif', min: 3, tower: true },
  braciere:  { w: 2, h: 2, hp: 160, cost: { pietra: 70, legna: 30 }, cat: 'dif', min: 4, tower: true },
  recinto:   { w: 1, h: 1, hp: 60, cost: { legna: 4 }, cat: 'mura', min: 1, line: true },
  mura:      { w: 1, h: 1, hp: 260, cost: { pietra: 8 }, cat: 'mura', min: 2, line: true },
  cancello:  { w: 1, h: 1, hp: 180, cost: { legna: 20, pietra: 10 }, cat: 'mura', min: 2, gate: true },
};
export const BUILD_CATS = { eco: ['casa', 'campo', 'segheria', 'cava', 'mercato', 'bottega', 'miniera', 'cristalliera'], dif: ['arcieri', 'radici', 'caserma', 'mago', 'catapulta', 'braciere'], mura: ['recinto', 'mura', 'cancello'] };
// Al Mercato le monete comprano materiali: { give: quanto arriva, cost: monete, tech: scoperta necessaria }
export const TRADE = {
  legna: { give: 40, cost: 50 }, pietra: { give: 30, cost: 60 },
  ferro: { give: 15, cost: 90, tech: 'ferro' }, cristallo: { give: 8, cost: 120, tech: 'cristallo' },
};
export const TRADE_ORDER = ['legna', 'pietra', 'ferro', 'cristallo'];
export const towerCap = (L) => 2 + 2 * L;
// ---------- esercito: ogni caserma ospita 4 Tuzu. Di notte difendono, di giorno assaltano i villaggi ----------
// range: 0 = corpo a corpo · min: livello del castello · tech: scoperta necessaria
export const UNITS = {
  lancia:  { hp: 90,  dmg: 10, rate: 0.7, speed: 80, range: 0,   cost: { monete: 25 } },
  arco:    { hp: 60,  dmg: 11, rate: 0.9, speed: 80, range: 160, cost: { monete: 30, legna: 20 }, min: 3 },
  corazza: { hp: 220, dmg: 20, rate: 0.8, speed: 72, range: 0,   cost: { monete: 60, ferro: 30 }, tech: 'ferro' },
};
export const UNIT_ORDER = ['lancia', 'arco', 'corazza'];
export const CASERMA_SLOTS = 4;
export const GUARD_REACH = 320;        // di notte i soldati escono contro chi passa entro questa distanza dal loro posto

// ---------- scoperte (nella Bottega) ----------
// min: livello del castello · needs: scoperta che deve venire prima
export const TECHS = {
  ferro:     { cost: { monete: 150, pietra: 80 }, min: 2 },                               // miniera, Tuzu corazzati, si scavano i giacimenti
  aratro:    { cost: { monete: 150, legna: 120 }, min: 2 },                               // raccolti +25%
  frecce:    { cost: { monete: 200, ferro: 60 }, needs: 'ferro' },                        // arcieri (torri) +25% danno
  lame:      { cost: { monete: 200, ferro: 80 }, needs: 'ferro' },                        // esercito +25% danno
  bastioni:  { cost: { pietra: 250, ferro: 100 }, needs: 'ferro' },                       // mura +50% vita
  cristallo: { cost: { monete: 300, pietra: 150, ferro: 60 }, min: 3, needs: 'ferro' },   // cristalliera, si raccolgono i cristalli
  lenti:     { cost: { monete: 300, cristallo: 60 }, needs: 'cristallo' },                // torre di cristallo e Fulmine +25%
};
export const TECH_ORDER = ['ferro', 'aratro', 'frecce', 'lame', 'bastioni', 'cristallo', 'lenti'];

// Potenziare il castello: costo per passare dal livello L a L+1 e notti da aver superato.
export const CASTLE_UP = [
  null,
  { cost: { monete: 200, legna: 150 }, nights: 2 },
  { cost: { monete: 400, legna: 250, pietra: 150 }, nights: 5 },
  { cost: { monete: 800, legna: 400, pietra: 350, ferro: 80 }, nights: 9 },
  { cost: { monete: 1500, legna: 700, pietra: 700, ferro: 250, cristallo: 80 }, nights: 14 },
];
export const MAX_CASTLE = 5;
export const castleHp = (L) => 800 + 300 * (L - 1);

// ---------- torri (statistiche di tiro; il costo dei livelli 2 e 3 è in monete) ----------
export const TOWERS = {
  arcieri:   { kind: 'physical', proj: 'arrow', levels: [{ dmg: 12, rate: 0.6, range: 170 }, { up: 60, dmg: 20, rate: 0.55, range: 185 }, { up: 120, dmg: 33, rate: 0.45, range: 200 }] },
  mago:      { kind: 'magic', proj: 'orb', levels: [{ dmg: 24, rate: 1.3, range: 155, splash: 44 }, { up: 90, dmg: 40, rate: 1.2, range: 165, splash: 50 }, { up: 160, dmg: 66, rate: 1.1, range: 175, splash: 58 }] },
  catapulta: { kind: 'physical', proj: 'boulder', minRange: 80, levels: [{ dmg: 45, rate: 2.6, range: 260, splash: 70 }, { up: 110, dmg: 74, rate: 2.5, range: 275, splash: 78 }, { up: 190, dmg: 120, rate: 2.3, range: 290, splash: 88 }] },
  braciere:  { kind: 'fire', proj: 'burn', levels: [{ dmg: 14, rate: 0.5, range: 120, burnT: 2 }, { up: 100, dmg: 24, rate: 0.5, range: 130, burnT: 2 }, { up: 170, dmg: 40, rate: 0.5, range: 140, burnT: 2.4 }] },
  radici:    { kind: 'magic', proj: 'pulse', levels: [{ dmg: 3, rate: 1.0, range: 130, slow: 0.35, slowT: 1.5 }, { up: 70, dmg: 6, rate: 1.0, range: 145, slow: 0.45, slowT: 1.6 }, { up: 130, dmg: 10, rate: 0.9, range: 160, slow: 0.55, slowT: 1.8 }] },
};

// hit: danno a edifici e soldati per colpo (uno al secondo) · ghost: attraversa mura e recinti
export const ENEMIES = {
  orco:     { hp: 60,   speed: 52, reward: 6,   hit: 5,  armor: 0,     mres: 0,   slowRes: 0,   r: 15, cost: 1 },
  predone:  { hp: 34,   speed: 96, reward: 5,   hit: 3,  armor: 0,     mres: 0,   slowRes: 0,   r: 12, cost: 0.8 },
  bruto:    { hp: 250,  speed: 34, reward: 16,  hit: 16, armor: 0.35,  mres: 0,   slowRes: 0,   r: 21, cost: 3.2 },
  spettro:  { hp: 85,   speed: 62, reward: 9,   hit: 4,  armor: -0.25, mres: 0.5, slowRes: 0.5, r: 14, cost: 1.6, ghost: true },
  capo:     { hp: 900,  speed: 30, reward: 70,  hit: 26, armor: 0.2,   mres: 0.1, slowRes: 0.5, r: 26, boss: true },
  campione: { hp: 2600, speed: 26, reward: 200, hit: 45, armor: 0.25,  mres: 0.2, slowRes: 0.6, r: 32, boss: true },
};

export const CROPS = {
  grano:  { secs: 60,    cost: 4,  gain: 12 },
  carote: { secs: 300,   cost: 10, gain: 45 },
  zucche: { secs: 1800,  cost: 25, gain: 160 },
  uva:    { secs: 14400, cost: 60, gain: 720 },
};
export const CROP_ORDER = ['grano', 'carote', 'zucche', 'uva'];

/** I nemici della notte numero n (1 = prima); k < 1 se qualche villaggio è stato conquistato. Gruppi { t: tipo, n: quanti, gap: secondi fra uno e l'altro, at: partenza }. */
export function genWave(n, k = 1) {
  const w = n - 1, budget = (8 + w * 3.1) * k;
  const avail = { orco: true, predone: w >= 1, bruto: w >= 3, spettro: w >= 4 };
  const pat = [
    { orco: 1, predone: 0.25, bruto: 0.2, spettro: 0.15 },
    { orco: 0.45, predone: 1, bruto: 0, spettro: 0.2 },
    { orco: 0.5, predone: 0.2, bruto: 1, spettro: 0.25 },
    { orco: 0.5, predone: 0.4, bruto: 0.35, spettro: 1 },
  ][w % 4];
  let tot = 0;
  for (const k in pat) if (avail[k]) tot += pat[k];
  const gaps = { orco: Math.max(0.55, 1.2 - w * 0.04), predone: Math.max(0.4, 0.75 - w * 0.03), bruto: Math.max(1.8, 3.2 - w * 0.12), spettro: Math.max(0.65, 1.0 - w * 0.03) };
  const groups = [];
  let at = 0;
  for (const k of ['orco', 'predone', 'bruto', 'spettro']) {
    if (!avail[k] || !pat[k]) continue;
    const q = Math.round(budget * (pat[k] / tot) / ENEMIES[k].cost);
    if (q <= 0) continue;
    groups.push({ t: k, n: q, gap: gaps[k], at });
    at += 3.5;
  }
  if (n % 10 === 0) groups.push({ t: 'campione', n: Math.ceil(n / 20), gap: 6, at: 9 });
  else if (n % 5 === 0) groups.push({ t: 'capo', n: Math.ceil(n / 15), gap: 5, at: 8 });
  return groups;
}
export function waveSummary(n, k = 1) { const o = {}; for (const g of genWave(n, k)) o[g.t] = (o[g.t] || 0) + g.n; return o; }
/** Quanto sono più robusti i nemici alla notte n. */
export const hpMul = (n) => 1 + 0.12 * (n - 1) + 0.004 * (n - 1) * (n - 1);

// ---------- natura: boschi, rocce e giacimenti, sempre uguali ----------
// Alberi e rocce si tolgono con un tocco. Ferro e cristallo si raccolgono solo dopo averli scoperti.
export const NATURE = (function () {
  const rnd = mulberry32(4242), out = [], used = new Set();
  const far = (c, r) => Math.abs(c - (CASTLE.c + 1)) > 7 || Math.abs(r - (CASTLE.r + 1)) > 6;
  const clear = (c, r) => !TRIBES.some(p => Math.abs(p.c - c) <= VILLAGE_R + 1 && Math.abs(p.r - r) <= VILLAGE_R + 1);
  const put = (c, r, kind) => {
    c = Math.round(c); r = Math.round(r);
    if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1 || !far(c, r) || !clear(c, r)) return;
    const k = r * COLS + c;
    if (used.has(k) || TERRAIN[k] || ROAD_AT[k]) return;
    used.add(k);
    out.push({ id: out.length, c, r, kind, size: 0.8 + rnd() * 0.45, tint: Math.floor(rnd() * 6) });
  };
  /** Quadretti liberi che toccano (entro 2) un certo tipo di rilievo. */
  const beside = (kinds) => { const o = []; for (let r = 3; r < ROWS - 3; r++) for (let c = 3; c < COLS - 3; c++) { if (TERRAIN[r * COLS + c]) continue; let hit = false; for (let dr = -2; dr <= 2 && !hit; dr++) for (let dc = -2; dc <= 2; dc++) if (kinds.includes(TERRAIN[(r + dr) * COLS + c + dc])) { hit = true; break; } if (hit && Math.hypot(c - CASTLE.c - 1, r - CASTLE.r - 1) > 12) o.push([c, r]); } return o; };
  const seeds = (list, groups, n0, n1, rad, kind) => { for (let g = 0; g < groups && list.length; g++) { const [cc, cr] = list[Math.floor(rnd() * list.length)], n = n0 + Math.floor(rnd() * (n1 - n0 + 1)); for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rad; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d, kind); } } };
  const blob = (kind, groups, n0, n1, rad, margin) => {
    for (let i = 0; i < groups; i++) {
      const cc = margin + rnd() * (COLS - margin * 2), cr = margin + rnd() * (ROWS - margin * 2), n = n0 + Math.floor(rnd() * (n1 - n0 + 1)), rr = rad * (0.7 + rnd() * 0.6);
      for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rr; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d * 0.8, kind); }
    }
  };
  seeds(beside([1]), 13, 3, 4, 1.3, 'iron');           // prima i giacimenti, così il bosco non li copre
  seeds(beside([2, 3]), 8, 2, 3, 1.1, 'crystal');
  seeds(beside([1]), 14, 3, 6, 1.8, 'rock');
  blob('tree', 64, 9, 22, 3.8, 3);
  blob('rock', 14, 3, 6, 1.8, 4);
  return out;
})();
export const CHOP = { tree: { res: 'legna', gain: 7 }, rock: { res: 'pietra', gain: 6 }, iron: { res: 'ferro', gain: 8, tech: 'ferro' }, crystal: { res: 'cristallo', gain: 6, tech: 'cristallo' } };

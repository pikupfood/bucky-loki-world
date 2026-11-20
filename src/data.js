// Dati di gioco: mappa a quadretti, edifici, torri, nemici, colture, notti. Nessuna dipendenza dal browser.

export const G = 40;                 // lato di un quadretto, in unità di mondo
export const COLS = 168, ROWS = 116;
export const WORLD_W = COLS * G, WORLD_H = ROWS * G;
export const CASTLE = { c: 83, r: 57, w: 3, h: 3 };
export const START = { monete: 150, legna: 130, pietra: 0, ferro: 0, cristallo: 0, grano: 0, cibo: 20 };
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
  { id: 'rossi',     color: '#ee5a52', eyes: '#2b2a33', c: 36,  r: 76,  level: 1, from: 1,  good: 'legna',     wants: 'pietra' },
  { id: 'blu',       color: '#3f9cf2', eyes: '#2b2a33', c: 136, r: 34,  level: 2, from: 3,  good: 'pietra',    wants: 'legna' },
  { id: 'gialli',    color: '#f4c430', eyes: '#2b2a33', c: 104, r: 12,  level: 3, from: 7,  good: 'ferro',     wants: 'monete' },
  { id: 'neri',      color: '#3b3947', eyes: '#ffffff', c: 64,  r: 104, level: 4, from: 12, good: 'cristallo', wants: 'ferro' },
  { id: 'turchesi',  color: '#19c2b0', eyes: '#2b2a33', c: 40,  r: 20,  level: 2, from: 5,  good: 'monete',    wants: 'legna' },
  { id: 'bianchi',   color: '#f4f1ea', eyes: '#2b2a33', c: 146, r: 90,  level: 3, from: 9,  good: 'cristallo', wants: 'ferro' },
  { id: 'arancioni', color: '#ff8a2a', eyes: '#2b2a33', c: 12,  r: 46,  level: 4, from: 14, good: 'ferro',     wants: 'legna' },
  { id: 'rosa',      color: '#ff6fb5', eyes: '#2b2a33', c: 156, r: 10,  level: 5, from: 17, good: 'monete',    wants: 'cristallo' },
  { id: 'argento',   color: '#aab4c6', eyes: '#2b2a33', c: 20,  r: 104, level: 6, from: 20, good: 'cristallo', wants: 'monete' },
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
export function villageLoot(t, L) { const o = { monete: 120 + 80 * L, legna: 60 * L, pietra: 40 * L }; o[t.good] = (o[t.good] || 0) + GOOD_RATE[t.good] * 10 * L; for (const k in o) o[k] = Math.round(o[k] * ECON.loot); return o; }
/** Quello che una colonia paga al minuto. */
export function villageTribute(t, L) { const o = { monete: 4 + 2 * L }; o[t.good] = (o[t.good] || 0) + GOOD_RATE[t.good]; for (const k in o) o[k] = Math.max(1, Math.round(o[k] * ECON.tribute)); return o; }
/** Il dono che un villaggio chiede per allearsi (o per rinnovare l'alleanza). */
export function allyCost(t, L) { const o = { monete: 80 + 60 * L }; o[t.wants] = (o[t.wants] || 0) + 30 * L; return o; }
/** Quanti guerrieri manda un alleato a difenderti di notte. */
export const allyHelpers = (L) => 1 + L;
const TRADE_GIVE = { monete: 60, legna: 40, pietra: 30, ferro: 20, cristallo: 10 }, TRADE_GET = { monete: 50, legna: 40, pietra: 30, ferro: 15, cristallo: 8 };
/** Uno scambio con un villaggio amico: gli dai `give` e ricevi `get`. */
export function villageTrade(t) { return { give: { [t.wants]: TRADE_GIVE[t.wants] }, get: { [t.good]: TRADE_GET[t.good] } }; }

// ---------- rilievo: montagne, colline, laghi (sempre uguali). Lì non si costruisce e non si passa ----------
// TERRAIN[i]: 0 libero · 1 montagna · 2 collina · 3 acqua
export const TERRAIN = new Uint8Array(COLS * ROWS);
export const PEAKS = [], HILLS = [], LAKES = [];
const SX = COLS / 120, SY = ROWS / 84, wide = (a) => a.map(([c0, r0, c1, r1, w]) => [c0 * SX, r0 * SY, c1 * SX, r1 * SY, w * 1.15]), spot = (a) => a.map(([c, r, rx, ry]) => [c * SX, r * SY, rx * 1.15, ry * 1.15]);
const RANGES = [      // catene: da (c0, r0) a (c1, r1), larghezza in quadretti
  ...wide([[35, 27, 47, 17, 2.1], [33, 41, 38, 52, 1.9], [81, 28, 87, 43, 2.2], [55, 59, 69, 64, 2.0], [85, 9, 92, 17, 1.8], [10, 34, 20, 38, 1.7], [66, 22, 60, 13, 1.5], [88, 54, 96, 50, 1.6], [28, 68, 36, 73, 1.6], [112, 36, 116, 48, 1.8]]),
  [22, 58, 30, 66, 2.1], [148, 20, 160, 28, 2.1], [30, 92, 42, 98, 2.0], [116, 100, 132, 107, 2.1], [8, 12, 18, 22, 2.0], [96, 86, 106, 92, 1.9], [124, 8, 134, 14, 1.8], [4, 78, 12, 90, 2.0],
];
const HILL_AT = [
  ...spot([[46, 33, 2.6, 2.0], [71, 50, 2.8, 2.2], [44, 63, 2.4, 2.0], [97, 39, 2.6, 2.1], [57, 24, 2.3, 1.9], [24, 44, 2.5, 2.0], [14, 22, 2.8, 2.2], [78, 73, 2.6, 2.0], [108, 12, 2.4, 2.0], [62, 72, 2.0, 1.8], [8, 70, 2.6, 2.2], [92, 78, 2.4, 1.9]]),
  [58, 28, 3.0, 2.4], [112, 78, 3.0, 2.4], [26, 30, 2.8, 2.2], [150, 58, 3.0, 2.4], [84, 100, 2.8, 2.2], [120, 22, 2.6, 2.2], [48, 54, 2.6, 2.0], [140, 108, 2.8, 2.2],
];
// I laghi (centro e mezze misure, in quadretti). Il primo è il lago di casa: grande, a nord-est del castello, perché ogni giocatore abbia
// vicino la riva per un Porto che cresce (richiesta del titolare, 19/11/2026). Gli altri sono larghi abbastanza per porti e navi.
const LAKE_AT = [[100, 40, 9, 6.5], [47.6, 82.9, 6.5, 4.8], [130.2, 85.6, 6.5, 5], [70, 11.5, 7, 4.4], [56, 90, 7.5, 5.5], [142, 62, 6.8, 4.8], [22, 84, 6.5, 4.6]];
export const SEA_W = 2;               // il mare: una fascia tutto attorno alla mappa (lì comunque non si costruisce)
/** Il bordo di un lago visto dal suo centro, in direzione a (1 = l'ellisse esatta). */
export const lakeEdge = (L, a) => 1 + 0.16 * Math.sin(3 * a + L.p1) + 0.1 * Math.sin(5 * a + L.p2);
(function () {
  const rnd = mulberry32(777), cx = CASTLE.c + 1, cy = CASTLE.r + 1;
  const free = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && Math.hypot(c - cx, r - cy) > 17 && !TRIBES.some(t => Math.abs(t.c - c) <= VILLAGE_R + 3 && Math.abs(t.r - r) <= VILLAGE_R + 3);
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
    // i laghi possono arrivare un po' più vicino al castello del resto del rilievo (14 quadretti invece di 17)
    for (let rr = Math.floor(r - ry * 1.3 - 1); rr <= Math.ceil(r + ry * 1.3 + 1); rr++) for (let cc = Math.floor(c - rx * 1.3 - 1); cc <= Math.ceil(c + rx * 1.3 + 1); cc++) {
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || Math.hypot(cc - cx, rr - cy) <= 14 || TRIBES.some(t => Math.abs(t.c - cc) <= VILLAGE_R + 3 && Math.abs(t.r - rr) <= VILLAGE_R + 3)) continue;
      const dx = (cc + 0.5 - c) / rx, dy = (rr + 0.5 - r) / ry, e = lakeEdge(L, Math.atan2(dy, dx)); if (dx * dx + dy * dy <= e * e * 0.92 && !TERRAIN[rr * COLS + cc]) TERRAIN[rr * COLS + cc] = 3;
    }
    LAKES.push(L);
  }
  // il mare tutto attorno
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((c < SEA_W || r < SEA_W || c >= COLS - SEA_W || r >= ROWS - SEA_W) && !TRIBES.some(t => Math.abs(t.c - c) <= VILLAGE_R + 1 && Math.abs(t.r - r) <= VILLAGE_R + 1)) TERRAIN[r * COLS + c] = 3;
})();

// ---------- l'isola nel lago grande (la costante sta qui perché serve ai fiumi; l'isola si scava più sotto, dopo natura e rovine) ----------
export const ISLAND = { c: 56, r: 90, rad: 1 };

// ---------- fiumi: tutti i laghi collegati fra loro, e da ogni parte l'acqua arriva al mare ----------
// Larghi cinque quadretti (ci passa una nave). Nascono PRIMA delle strade: le strade li attraversano dove conviene, e lì resta un ponte di
// pietra; ogni tanto un guado; alla fine un controllo apre un guado in più se un pezzo di terra restasse chiuso fuori.
// RIVER_AT: 0 niente · 1 acqua di fiume (TERRAIN 3) · 2 guado · 3 ponte di una strada (2 e 3 sono terra: ci si cammina, non ci si costruisce).
// RIVERS: { pts: [{x, y}] la linea morbida per chi dipinge, marks: [{ x, y, tx, ty, kind: 2, len }] i guadi con la direzione del fiume }
export const RIVERS = [], RIVER_AT = new Uint8Array(COLS * ROWS);
const RIVER_RAW = [];        // { path, modes }: serve alla seconda parte, dopo le strade
(function () {
  const N = COLS * ROWS, rnd = mulberry32(4242), GW = 14, GH = 10, grid = [], cx = CASTLE.c + 1, cy = CASTLE.r + 1;
  for (let i = 0; i < (GW + 1) * (GH + 1); i++) grid.push(rnd());
  const noise = (c, r) => { const x = c / COLS * GW, y = r / ROWS * GH, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, g = (p, q) => grid[Math.min(GH, q) * (GW + 1) + Math.min(GW, p)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (g(x0, y0) * (1 - sx) + g(x0 + 1, y0) * sx) * (1 - sy) + (g(x0, y0 + 1) * (1 - sx) + g(x0 + 1, y0 + 1) * sx) * sy; };
  const lake = (i) => TERRAIN[i] === 3 && !RIVER_AT[i];
  const sea = (c, r) => c < SEA_W || r < SEA_W || c >= COLS - SEA_W || r >= ROWS - SEA_W;
  // accanto a monti e colline il fiume non ci va volentieri: così fra l'acqua e la roccia resta terra per passare
  const rocky = new Uint8Array(N); for (let i = 0; i < N; i++) if (TERRAIN[i] === 1 || TERRAIN[i] === 2) { const c = i % COLS, r = (i / COLS) | 0; for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) { const cc = c + dc, rr = r + dr; if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS) rocky[rr * COLS + cc] = 1; } }
  const blocked = (c, r) => {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    const i = r * COLS + c;
    if (lake(i)) return false;
    return TERRAIN[i] === 1 || TERRAIN[i] === 2 || Math.hypot(c - cx, r - cy) < 24 || TRIBES.some(t => Math.abs(t.c - c) <= VILLAGE_R + 5 && Math.abs(t.r - r) <= VILLAGE_R + 5) || (Math.abs(c - ISLAND.c) <= ISLAND.rad + 1 && Math.abs(r - ISLAND.r) <= ISLAND.rad + 1);
  };
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  /** La strada dell'acqua: il cammino meno caro su un terreno «mosso», che gira attorno a monti, castello, villaggi e isola. Per mare non si fa il giro. */
  const course = (from, to) => {
    const dist = new Float64Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), heap = [[0, from]]; dist[from] = 0;
    while (heap.length) {
      let m = 0; for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[m][0]) m = k;
      const [v, i] = heap.splice(m, 1)[0];
      if (i === to) break;
      if (v > dist[i]) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr] of D8) {
        const nc = c + dc, nr = r + dr; if (blocked(nc, nr)) continue;
        const ni = nr * COLS + nc; if (sea(nc, nr) && ni !== to) continue;
        const nv = v + (dc && dr ? 1.414 : 1) * (lake(ni) ? 0.25 : RIVER_AT[ni] ? 0.4 : (1 + 2.6 * noise(nc, nr)) * (rocky[ni] ? 4 : 1));
        if (nv < dist[ni]) { dist[ni] = nv; prev[ni] = i; heap.push([nv, ni]); }
      }
    }
    if (dist[to] >= 1e9) return null;
    const out = []; for (let i = to; i >= 0; i = prev[i]) out.push([i % COLS, (i / COLS) | 0]);
    return out.reverse();
  };
  const dig = (path) => {
    const modes = []; let dry = 0;
    for (const [c, r] of path) {
      const i = r * COLS + c;
      if (lake(i)) { modes.push(0); dry = 0; continue; }
      const mode = dry % 34 >= 31 ? 2 : 1; dry++; modes.push(mode);
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        if (dc * dc + dr * dr > 5) continue;
        const cc = c + dc, rr = r + dr; if (blocked(cc, rr)) continue;
        const j = rr * COLS + cc; if (lake(j)) continue;
        if (mode === 1) { if (RIVER_AT[j] !== 2) { TERRAIN[j] = 3; RIVER_AT[j] = 1; } }
        else { TERRAIN[j] = 0; RIVER_AT[j] = 2; }
      }
    }
    let pts = path.filter((_, k) => k % 3 === 0 || k === path.length - 1).map(([c, r]) => ({ x: (c + 0.5) * G, y: (r + 0.5) * G }));
    for (let k = 0; k < 3; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; o.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 }, { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 }); } o.push(pts[pts.length - 1]); pts = o; }
    RIVERS.push({ pts, marks: [] }); RIVER_RAW.push({ path, modes });
  };
  const at = (L) => { const c0 = Math.round(L.x / G - 0.5), r0 = Math.round(L.y / G - 0.5); for (let d = 0; d < 6; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) { const c = c0 + dc, r = r0 + dr; if (c >= 0 && r >= 0 && c < COLS && r < ROWS && lake(r * COLS + c) && !sea(c, r)) return r * COLS + c; } return r0 * COLS + c0; };
  const edge = (c, r) => Math.max(SEA_W - 1, Math.min(ROWS - SEA_W, r)) * COLS + Math.max(SEA_W - 1, Math.min(COLS - SEA_W, c));
  // nord → lago di casa → est → mare; ovest → sud-ovest → isola → sud-est → est; quattro foci (nord, ovest, sud, est)
  const PLAN = [[at(LAKES[3]), at(LAKES[0])], [at(LAKES[0]), at(LAKES[5])], [at(LAKES[5]), edge(COLS - 1, 76)], [at(LAKES[3]), edge(60, 0)],
    [at(LAKES[6]), edge(0, 98)], [at(LAKES[6]), at(LAKES[1])], [at(LAKES[1]), at(LAKES[4])], [at(LAKES[4]), edge(54, ROWS - 1)], [at(LAKES[4]), at(LAKES[2])], [at(LAKES[2]), at(LAKES[5])], [at(LAKES[2]), edge(138, ROWS - 1)]];
  for (const [p, q] of PLAN) { if (!lake(p)) continue; const path = course(p, q); if (path && path.length > 4) dig(path); }
})();

// ---------- strade: da ogni villaggio al castello e da un villaggio al vicino, a curve attorno al rilievo ----------
// STEP[i]: quanto costa passare da quel quadretto. Sulle strade costa meno, così di notte i nemici le seguono.
export const STEP = new Float32Array(COLS * ROWS);
export const ROADS = [];              // { pts: [{x, y}], main }  (main = porta al castello)
export const ROAD_AT = new Uint8Array(COLS * ROWS);
/** Quello che si può posare su una strada della mappa: solo ciò che la sbarra (o altra strada). Mai case, campi, torri, botteghe. */
export const ON_ROAD = { strada: 1, recinto: 1, mura: 1, cancello: 1, trappola: 1, fossato: 1 };      // quello che sbarra o difende una strada: mai una casa
/** Di quanto gira un oggetto a ogni tocco di «Ruota», in ottavi di giro (0 = non si gira: i pezzi in fila si orientano da soli, porti e
 *  porticcioli guardano l'acqua, lampioni e alberi sono tondi). Aiuole e statue girano di 45°, gli edifici di 90°. b.rot va da 0 a 7. */
export const rotStep = (type) => (type === 'aiuola' || type === 'statua' ? 1 : { mura: 1, recinto: 1, strada: 1, ponte: 1, cancello: 1, porto: 1, scalo: 1, lampione: 1, albero: 1, siepe: 1, piazza: 1, stendardo: 1 }[type] ? 0 : 2);
export const HOME_R = 8;               // attorno al castello le strade della mappa non entrano
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
  for (let i = 0; i < COLS * ROWS; i++) if (RIVER_AT[i] === 1) { TERRAIN[i] = 0; STEP[i] = 16; }      // un fiume si può scavalcare, ma costa: la strada lo passa dritta e nel punto più stretto
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
  // Le strade si fermano al bordo del villaggio (HOME_R quadretti dal centro del castello): lì dentro è tutto del giocatore, e siccome sulle
  // strade non si costruisce, una strada che arrivasse fino al portone gli taglierebbe il villaggio in due. Una strada che ci passa in mezzo si spezza.
  const lay = (all, main) => {
    const out = (q) => Math.hypot(q[0] + 0.5 - CASTLE.c - 1.5, q[1] + 0.5 - CASTLE.r - 1.5) > HOME_R, runs = []; let run = [];
    for (const q of all) { if (out(q)) run.push(q); else { if (run.length) runs.push(run); run = []; } } if (run.length) runs.push(run);
    if (runs.length !== 1 || runs[0].length !== all.length) { for (const part of runs) lay(part, main); return; }
    const cells = all;
    if (cells.length < 3) return;
    for (const [c, r] of cells) { STEP[r * COLS + c] = 0.42; ROAD_AT[r * COLS + c] = 1; }
    let pts = cells.filter((_, i) => i % 3 === 0 || i === cells.length - 1).map(([c, r]) => ({ x: (c + 0.5) * G, y: (r + 0.5) * G }));
    for (let k = 0; k < 3; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }); } o.push(pts[pts.length - 1]); pts = o; }
    ROADS.push({ pts, main });
  };
  for (const t of TRIBES) lay(trace(terrainFlow(castle), t.gate.c, t.gate.r), true);       // dopo ogni strada le altre tendono a unirsi
  // da un villaggio al vicino, in giro attorno al castello
  const ring = TRIBES.map((t, i) => i).sort((a, b) => Math.atan2(TRIBES[a].r - CASTLE.r, TRIBES[a].c - CASTLE.c) - Math.atan2(TRIBES[b].r - CASTLE.r, TRIBES[b].c - CASTLE.c));
  ring.forEach((a, k) => { const A = TRIBES[a], B = TRIBES[ring[(k + 1) % ring.length]]; lay(trace(terrainFlow([A.r * COLS + A.c]), B.c, B.r), false); });
  // dove passa una strada (e un quadretto attorno) il fiume resta terra: è il ponte di pietra. Il resto torna acqua.
  const roadBy = (c, r) => { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const cc = c + dc, rr = r + dr; if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && ROAD_AT[rr * COLS + cc]) return true; } return false; };
  for (let i = 0; i < COLS * ROWS; i++) {
    if (!RIVER_AT[i]) continue;
    if (roadBy(i % COLS, (i / COLS) | 0)) { RIVER_AT[i] = 3; TERRAIN[i] = 0; if (!ROAD_AT[i]) STEP[i] = 1.2; }
    else if (RIVER_AT[i] === 1) TERRAIN[i] = 3;
  }
})();

// i fiumi, seconda parte: nessun pezzo di terra resta chiuso fuori (se serve si apre un guado in più), poi i segni dei guadi per chi dipinge
(function () {
  const N = COLS * ROWS, cx = CASTLE.c + 1, cy = CASTLE.r + 1, D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const reach = () => { const seen = new Uint8Array(N), st = [cy * COLS + cx]; seen[st[0]] = 1; while (st.length) { const i = st.pop(), c = i % COLS, r = (i / COLS) | 0; for (const [dc, dr] of D8) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue; const ni = nr * COLS + nc; if (seen[ni] || TERRAIN[ni] || (dc && dr && (TERRAIN[r * COLS + nc] || TERRAIN[nr * COLS + c]))) continue; seen[ni] = 1; st.push(ni); } } return seen; };
  const extra = [];
  for (let pass = 0; pass < 60; pass++) {
    const seen = reach(); let fixed = false;
    for (let i = 0; i < N && !fixed; i++) {
      if (RIVER_AT[i] !== 1) continue;
      const c = i % COLS, r = (i / COLS) | 0; let inSide = 0, outSide = 0;
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) { const cc = c + dc, rr = r + dr; if (cc < 2 || rr < 2 || cc >= COLS - 2 || rr >= ROWS - 2) continue; const j = rr * COLS + cc; if (TERRAIN[j]) continue; if (seen[j]) inSide++; else outSide++; }
      if (!inSide || outSide < 3) continue;        // (un quadretto o due rimasti fra acqua e roccia non valgono un guado)
      for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) { const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || dc * dc + dr * dr > 18) continue; const j = rr * COLS + cc; if (RIVER_AT[j] === 1) { TERRAIN[j] = 0; RIVER_AT[j] = 2; } }
      extra.push([c, r]); fixed = true;
    }
    if (!fixed) break;
  }
  const tangent = (R, x, y) => { let k = 0, bd = 1e12; R.pts.forEach((p, i) => { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd) { bd = d; k = i; } }); const p0 = R.pts[Math.max(0, k - 2)], p1 = R.pts[Math.min(R.pts.length - 1, k + 2)], L = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1; return { tx: (p1.x - p0.x) / L, ty: (p1.y - p0.y) / L, d: Math.sqrt(bd) }; };
  RIVER_RAW.forEach(({ path, modes }, n) => {
    for (let k = 0; k < modes.length; k++) {
      if (modes[k] !== 2) continue;
      let e = k; while (e + 1 < modes.length && modes[e + 1] === 2) e++;
      const m = (k + e) >> 1, [c, r] = path[m];
      if (RIVER_AT[r * COLS + c] === 2) { const x = (c + 0.5) * G, y = (r + 0.5) * G, t = tangent(RIVERS[n], x, y); RIVERS[n].marks.push({ x, y, tx: t.tx, ty: t.ty, kind: 2, len: e - k + 1 }); }
      k = e;
    }
  });
  for (const [c, r] of extra) { const x = (c + 0.5) * G, y = (r + 0.5) * G; let best = null; for (const R of RIVERS) { const t = tangent(R, x, y); if (!best || t.d < best.t.d) best = { R, t }; } if (best) best.R.marks.push({ x, y, tx: best.t.tx, ty: best.t.ty, kind: 2, len: 5 }); }
})();

// ---------- edifici ----------
// w,h: quadretti occupati · cost: risorse · min: livello del castello che lo sblocca
// flat: non blocca il passaggio (campi) · line: si tira in fila · gate: i tuoi passano, i nemici no
// tech: la scoperta che serve per costruirlo · beauty: quanto alza il morale del villaggio
export const BUILD = {
  castello:  { w: 3, h: 3, hp: 800 },
  casa:      { w: 2, h: 2, hp: 120, cost: { legna: 40 }, cat: 'eco', min: 1, pop: 4, prod: { monete: 6 } },
  campo:     { w: 2, h: 2, hp: 50, cost: { legna: 30 }, cat: 'eco', min: 1, flat: true },
  segheria:  { w: 2, h: 2, hp: 120, cost: { monete: 50 }, cat: 'eco', min: 1, prod: { legna: 12 }, cap: (L) => 1 + L },
  cava:      { w: 2, h: 2, hp: 140, cost: { legna: 60 }, cat: 'eco', min: 2, prod: { pietra: 9 }, cap: (L) => L },
  mercato:   { w: 2, h: 2, hp: 120, cost: { legna: 60, monete: 40 }, cat: 'eco', min: 2, cap: () => 1 },
  bottega:   { w: 2, h: 2, hp: 140, cost: { legna: 80, pietra: 30 }, cat: 'off', min: 2, cap: () => 1 },
  miniera:   { w: 2, h: 2, hp: 150, cost: { legna: 80, pietra: 60 }, cat: 'off', min: 2, prod: { ferro: 5 }, cap: (L) => L - 1, tech: 'ferro' },
  cristalliera: { w: 2, h: 2, hp: 150, cost: { pietra: 100, ferro: 40 }, cat: 'off', min: 3, prod: { cristallo: 3 }, cap: (L) => L - 2, tech: 'cristallo' },
  mulino:    { w: 2, h: 2, hp: 120, cost: { legna: 90, pietra: 30 }, cat: 'eco', min: 2, prod: { monete: 10 }, cap: (L) => L - 1 },
  fucina:    { w: 2, h: 2, hp: 180, cost: { pietra: 80, ferro: 40 }, cat: 'off', min: 3, cap: () => 1, tech: 'ferro' },                 // esercito +20% vita
  // bellezza: alzano il morale
  fontana:   { w: 2, h: 2, hp: 100, cost: { pietra: 60, monete: 40 }, cat: 'bel', min: 1, cap: (L) => L, beauty: 8 },
  taverna:   { w: 2, h: 2, hp: 140, cost: { legna: 80, monete: 60 }, cat: 'bel', min: 2, cap: (L) => L - 1, beauty: 10 },
  statua:    { w: 1, h: 1, hp: 120, cost: { pietra: 80, monete: 60 }, cat: 'bel', min: 3, cap: (L) => L - 2, beauty: 12 },
  giardino:  { w: 2, h: 2, hp: 60, cost: { monete: 60, legna: 30 }, cat: 'bel', min: 2, cap: (L) => L - 1, beauty: 9 },
  pozzo:     { w: 1, h: 1, hp: 90, cost: { pietra: 40, monete: 20 }, cat: 'bel', min: 1, cap: (L) => L, beauty: 4 },
  panchina:  { w: 1, h: 1, hp: 40, cost: { legna: 14 }, cat: 'bel', min: 1, cap: (L) => 2 * L, beauty: 2 },
  stendardo: { w: 1, h: 1, hp: 50, cost: { legna: 16, monete: 16 }, cat: 'bel', min: 2, cap: (L) => L, beauty: 3 },
  siepe:     { w: 1, h: 1, hp: 30, cost: { legna: 4 }, cat: 'bel', min: 1, beauty: 0.5, line: true, deco: true },                    // si tira in fila, come un recinto verde
  piazza:    { w: 1, h: 1, hp: 20, cost: { pietra: 2 }, cat: 'bel', min: 2, beauty: 0.4, flat: true, line: true, deco: true },      // lastricato: ci si cammina sopra
  lampione:  { w: 1, h: 1, hp: 40, cost: { legna: 10, monete: 10 }, cat: 'bel', min: 1, beauty: 1.5, deco: true },
  aiuola:    { w: 1, h: 1, hp: 20, cost: { monete: 8 }, cat: 'bel', min: 1, beauty: 2, flat: true, line: true, deco: true },
  albero:    { w: 1, h: 1, hp: 40, cost: { legna: 6 }, cat: 'bel', min: 1, beauty: 1.5, deco: true },
  strada:    { w: 1, h: 1, hp: 20, cost: { pietra: 1 }, cat: 'mura', min: 1, beauty: 0.25, flat: true, line: true, deco: true },
  arcieri:   { w: 2, h: 2, hp: 160, cost: { legna: 50 }, cat: 'dif', min: 1, tower: true },
  // difese povere: non sbarrano il passo (flat), i nemici ci passano sopra. trap: scatta una volta per notte · moat: rallenta chi lo attraversa
  trappola:  { w: 1, h: 1, hp: 30, cost: { legna: 12 }, cat: 'dif', min: 1, flat: true, line: true, deco: true, trap: true, cap: (L) => 6 + 4 * L },
  fossato:   { w: 1, h: 1, hp: 30, cost: { pietra: 3 }, cat: 'mura', min: 1, flat: true, line: true, deco: true, moat: true },
  radici:    { w: 2, h: 2, hp: 140, cost: { legna: 40, monete: 20 }, cat: 'dif', min: 2, tower: true },
  caserma:   { w: 2, h: 2, hp: 220, cost: { legna: 80, pietra: 40 }, cat: 'dif', min: 2, cap: (L) => L - 1 },
  mago:      { w: 2, h: 2, hp: 140, cost: { pietra: 60, monete: 40 }, cat: 'dif', min: 3, tower: true },
  catapulta: { w: 2, h: 2, hp: 180, cost: { legna: 80, pietra: 40 }, cat: 'dif', min: 3, tower: true },
  braciere:  { w: 2, h: 2, hp: 160, cost: { pietra: 70, legna: 30 }, cat: 'dif', min: 4, tower: true },
  recinto:   { w: 1, h: 1, hp: 60, cost: { legna: 4 }, cat: 'mura', min: 1, line: true },
  mura:      { w: 1, h: 1, hp: 260, cost: { pietra: 8 }, cat: 'mura', min: 2, line: true },
  cancello:  { w: 1, h: 1, hp: 180, cost: { legna: 20, pietra: 10 }, cat: 'mura', min: 2, gate: true },
  // acqua: il ponte si posa solo sull'acqua e la rende percorribile; il porto sta sulla riva e pesca
  ponte:     { w: 1, h: 1, hp: 80, cost: { legna: 8 }, cat: 'acqua', min: 2, flat: true, line: true, deco: true, water: true },
  porto:     { w: 2, h: 2, hp: 140, cost: { legna: 100, pietra: 40 }, cat: 'acqua', min: 2, prod: { cibo: 8, monete: 3 }, cap: (L) => L - 1, shore: true },
  // il Porto vero (nei testi «Porto»; quello sopra è il «Porticciolo»): la casa della flotta, cinque livelli
  scalo:     { w: 3, h: 2, hp: 260, cost: { legna: 220, pietra: 140 }, cat: 'acqua', min: 3, prod: { monete: 4 }, cap: (L) => L - 2, shore: true },
  // il Mulino ad acqua: sulla riva (lago, fiume o mare). Niente monete: macina il grano il doppio di un mulino a vento (FOOD.water)
  mulinoacqua: { w: 2, h: 2, hp: 130, cost: { legna: 110, pietra: 50 }, cat: 'acqua', min: 2, cap: (L) => L - 1, shore: true },
  // il Faro: sulla riva, uno solo. Le navi tornano prima (SEA.faroFast) e i pirati colpiscono meno (SEA.faroRisk)
  faro:      { w: 2, h: 2, hp: 200, cost: { pietra: 160, legna: 80, monete: 100 }, cat: 'acqua', min: 3, cap: () => 1, shore: true, beauty: 5 },
};
export const BUILD_CATS = {
  eco: ['casa', 'campo', 'mulino', 'segheria', 'cava', 'mercato'], off: ['bottega', 'miniera', 'cristalliera', 'fucina'],
  dif: ['arcieri', 'radici', 'caserma', 'mago', 'catapulta', 'braciere', 'trappola'], mura: ['recinto', 'mura', 'cancello', 'strada', 'fossato'],
  acqua: ['porto', 'scalo', 'faro', 'mulinoacqua', 'ponte'],          // tutto quello che vuole una riva o l'acqua, in una scheda sola
  bel: ['fontana', 'taverna', 'statua', 'giardino', 'pozzo', 'lampione', 'aiuola', 'albero', 'panchina', 'stendardo', 'siepe', 'piazza'],
};
export const CAT_ORDER = ['eco', 'off', 'dif', 'mura', 'acqua', 'bel'];
// Morale del villaggio (0-100): parte da 50, sale con la bellezza e con le vittorie, scende con le case affollate e le sconfitte.
// Sotto 30 il villaggio produce il 20% in meno; da 60 il 15% in più; da 80 il 30% in più.
export const MORALE = { base: 50, perHouse: 3, roadCap: 8 };
export const moraleK = (m) => (m < 30 ? 0.8 : m < 60 ? 1 : m < 80 ? 1.15 : 1.3);
// Gli abitanti lavorano: uno per casa più uno del castello. Secondi di lavoro per ogni cosa da raccogliere.
export const WORK = { tree: 4, rock: 5, iron: 6, crystal: 7 };
export const WORKER_SPEED = 92, JOBS_MAX = 16;
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
  // cavaliere: veloce · guaritore: non colpisce, cura chi ha vicino (heal = vita al secondo) · ariete: lento, sfonda la casa del capo (siege = quante volte il danno)
  cavallo: { hp: 150, dmg: 15, rate: 0.6, speed: 135, range: 0,  cost: { monete: 70, ferro: 15 }, min: 3, tech: 'ferro' },
  cura:    { hp: 70,  dmg: 0,  rate: 1,   speed: 82, range: 0,   heal: 8, cost: { monete: 50, legna: 30 }, min: 3 },
  ariete:  { hp: 260, dmg: 6,  rate: 1.4, speed: 56, range: 0,   siege: 9, cost: { legna: 120, ferro: 20 }, min: 4, tech: 'ferro' },
  // l'eroe non si addestra: arriva col castello al livello 2 e cresce con le battaglie
  eroe:    { hp: 260, dmg: 18, rate: 0.6, speed: 100, range: 0,  hero: true, cost: {} },
  eroina:  { hp: 180, dmg: 16, rate: 0.7, speed: 96,  range: 190, hero: true, cost: {} },      // Brina, l'arciera: arriva col castello al livello 4
};
export const UNIT_ORDER = ['lancia', 'arco', 'corazza', 'cavallo', 'cura', 'ariete'];
export const HERO = { name: 'Lumi', perLvl: { hp: 60, dmg: 4 }, xp: (L) => 20 + 15 * L, max: 10, shout: { cd: 40, secs: 8, k: 1.5 }, slam: { cd: 25, r: 115, dmg: 60 }, heal: { cd: 45, r: 230, k: 0.5, lvl: 3 }, second: { name: 'Brina', min: 4 } };
// Gli oggetti dell'eroe, trovati nelle rovine: spada +8 danno · scudo +80 vita · stivali più svelto · amuleto poteri più spesso · corno grido più lungo
export const HERO_ITEMS = ['spada', 'scudo', 'stivali', 'amuleto', 'corno'];
export const HERO_POWERS = ['slam', 'shout', 'heal'];
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
  asce:      { cost: { monete: 120, ferro: 40 }, needs: 'ferro' },                        // gli abitanti lavorano il doppio più svelti
  carri:     { cost: { monete: 150, legna: 150 }, min: 2 },                               // ogni raccolta di legna, pietra, ferro, cristallo rende il 50% in più
  festa:     { cost: { monete: 200, legna: 100 }, min: 2 },                               // morale +10
  archi:     { cost: { monete: 200, legna: 200 }, min: 3 },                               // arcieri dell'esercito: gittata +25%
  commercio: { cost: { monete: 300, pietra: 100 }, min: 3 },                              // due scambi in più al giorno con ogni villaggio
};
export const TECH_ORDER = ['ferro', 'aratro', 'carri', 'festa', 'asce', 'frecce', 'lame', 'bastioni', 'archi', 'commercio', 'cristallo', 'lenti'];

// ---------- gli obiettivi del Tuzu guida: uno alla volta, in ordine. [tipo, quanto, premio] ----------
export const GOALS = [
  ['move', 1, { monete: 20 }], ['towers', 2, { legna: 40 }], ['night', 1, { monete: 60 }], ['explore', 1, { monete: 60 }], ['send', 3, { legna: 30 }], ['casa', 1, { monete: 50 }],
  ['walls', 8, { legna: 40 }], ['night', 2, { monete: 80, legna: 40 }], ['castle', 2, { pietra: 60 }], ['sendRock', 3, { pietra: 30 }], ['campo', 1, { monete: 40 }],
  ['harvest', 2, { monete: 60 }], ['strada', 6, { monete: 40 }], ['aiuola', 3, { monete: 40 }], ['morale', 60, { monete: 100 }], ['segheria', 1, { legna: 60 }],
  ['cava', 1, { pietra: 60 }], ['level', 1, { legna: 60 }], ['caserma', 1, { monete: 100 }], ['army', 4, { monete: 100 }], ['order', 1, { monete: 60 }], ['village', 1, { monete: 60 }], ['gift', 1, { monete: 80 }], ['ally', 1, { legna: 80, pietra: 60 }],
  ['trade', 2, { monete: 80 }], ['bottega', 1, { pietra: 80 }], ['tech', 1, { ferro: 40 }], ['night', 5, { monete: 150 }], ['fontana', 1, { pietra: 60 }],
  ['conquer', 1, { monete: 200, ferro: 40 }], ['casa', 4, { legna: 100 }], ['mercato', 1, { monete: 100 }], ['sell', 1, { monete: 60 }], ['miniera', 1, { ferro: 60 }], ['castle', 3, { pietra: 150, ferro: 40 }], ['porto', 1, { legna: 80 }],
  ['taverna', 1, { monete: 150 }], ['towers', 6, { pietra: 120 }], ['mulino', 1, { monete: 120 }], ['ponte', 3, { legna: 60 }], ['tech', 3, { ferro: 80 }], ['army', 8, { ferro: 60 }],
  ['night', 10, { monete: 300, pietra: 150 }], ['statua', 1, { cristallo: 20 }], ['morale', 80, { monete: 300 }], ['conquer', 2, { ferro: 100, cristallo: 30 }], ['castle', 4, { ferro: 120, cristallo: 40 }],
  ['tech', 6, { cristallo: 50 }], ['strada', 30, { monete: 200 }], ['albero', 8, { legna: 150 }], ['night', 15, { monete: 500, ferro: 150 }], ['conquer', 4, { cristallo: 80 }],
  ['army', 12, { ferro: 150 }], ['castle', 5, { monete: 800, cristallo: 100 }], ['tech', 10, { monete: 600 }], ['night', 20, { monete: 800, cristallo: 100 }], ['conquer', 6, { monete: 1000, ferro: 300, cristallo: 150 }],
  ['scalo', 1, { legna: 150, monete: 100 }], ['ship', 1, { monete: 120 }], ['sail', 1, { monete: 150, ferro: 40 }],
];

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
  // la catapulta nemica: lenta, tira sugli edifici da lontano (arriva col grande capo, ogni dieci notti)
  ordigno:  { hp: 280,  speed: 24, reward: 40,  hit: 0,  armor: 0.3,   mres: 0,   slowRes: 0.6, r: 22, gear: 'ordigno', siege: { range: 235, dmg: 42, rate: 3.8 } },
  // il soldato speciale di ogni popolo. bash: quante volte il danno agli edifici · heal: cura i compagni vicini (vita al secondo)
  sp_rossi:     { hp: 110, speed: 78,  reward: 12, hit: 12, armor: 0,    mres: 0,    slowRes: 0.2, r: 17, gear: 'orco',    sp: true },
  sp_blu:       { hp: 200, speed: 44,  reward: 14, hit: 8,  armor: 0.55, mres: 0,    slowRes: 0,   r: 18, gear: 'bruto',   sp: true },
  sp_gialli:    { hp: 150, speed: 50,  reward: 14, hit: 8,  armor: 0.1,  mres: 0,    slowRes: 0,   r: 17, gear: 'orco',    sp: true, bash: 3 },
  sp_neri:      { hp: 130, speed: 70,  reward: 16, hit: 6,  armor: -0.2, mres: 0.6,  slowRes: 0.5, r: 15, gear: 'predone', sp: true, ghost: true },
  sp_turchesi:  { hp: 60,  speed: 130, reward: 10, hit: 5,  armor: 0,    mres: 0,    slowRes: 0.3, r: 12, gear: 'predone', sp: true },
  sp_bianchi:   { hp: 120, speed: 50,  reward: 16, hit: 3,  armor: 0,    mres: 0.3,  slowRes: 0,   r: 15, gear: 'cura',    sp: true, heal: 10 },
  sp_arancioni: { hp: 320, speed: 36,  reward: 20, hit: 14, armor: 0.3,  mres: 0,    slowRes: 0.3, r: 21, gear: 'bruto',   sp: true, bash: 2.5 },
  sp_rosa:      { hp: 140, speed: 84,  reward: 16, hit: 9,  armor: 0,    mres: 0.3,  slowRes: 1,   r: 15, gear: 'predone', sp: true },
  sp_argento:   { hp: 380, speed: 40,  reward: 26, hit: 18, armor: 0.45, mres: 0.45, slowRes: 0.4, r: 21, gear: 'bruto',   sp: true },
};

export const CROPS = {
  grano:  { secs: 60,    cost: 4,  gain: 12,  food: 3 },
  carote: { secs: 300,   cost: 10, gain: 45,  food: 10 },
  zucche: { secs: 1800,  cost: 25, gain: 160, food: 34 },
  uva:    { secs: 14400, cost: 60, gain: 720, food: 130 },
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
    if (used.has(k) || TERRAIN[k] || ROAD_AT[k] || RIVER_AT[k]) return;
    used.add(k);
    out.push({ id: out.length, c, r, kind, size: 0.8 + rnd() * 0.45, tint: Math.floor(rnd() * 6) });
  };
  /** Quadretti liberi che toccano (entro 2) un certo tipo di rilievo. */
  const beside = (kinds) => { const o = []; for (let r = 3; r < ROWS - 3; r++) for (let c = 3; c < COLS - 3; c++) { if (TERRAIN[r * COLS + c]) continue; let hit = false; for (let dr = -2; dr <= 2 && !hit; dr++) for (let dc = -2; dc <= 2; dc++) if (kinds.includes(TERRAIN[(r + dr) * COLS + c + dc])) { hit = true; break; } if (hit && Math.hypot(c - CASTLE.c - 1, r - CASTLE.r - 1) > 18) o.push([c, r]); } return o; };
  const seeds = (list, groups, n0, n1, rad, kind) => { for (let g = 0; g < groups && list.length; g++) { const [cc, cr] = list[Math.floor(rnd() * list.length)], n = n0 + Math.floor(rnd() * (n1 - n0 + 1)); for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rad; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d, kind); } } };
  const blob = (kind, groups, n0, n1, rad, margin) => {
    for (let i = 0; i < groups; i++) {
      const cc = margin + rnd() * (COLS - margin * 2), cr = margin + rnd() * (ROWS - margin * 2), n = n0 + Math.floor(rnd() * (n1 - n0 + 1)), rr = rad * (0.7 + rnd() * 0.6);
      for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rr; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d * 0.8, kind); }
    }
  };
  seeds(beside([1]), 20, 3, 4, 1.3, 'iron');           // prima i giacimenti, così il bosco non li copre
  seeds(beside([2, 3]), 13, 2, 3, 1.1, 'crystal');
  seeds(beside([1]), 22, 3, 6, 1.8, 'rock');
  blob('tree', 100, 9, 22, 3.8, 3);
  blob('rock', 24, 3, 6, 1.8, 4);
  return out;
})();
export const CHOP = { tree: { res: 'legna', gain: 7 }, rock: { res: 'pietra', gain: 6 }, iron: { res: 'ferro', gain: 8, tech: 'ferro' }, crystal: { res: 'cristallo', gain: 6, tech: 'cristallo' } };

// ---------- cantieri: secondi per costruire (i pezzi in fila e la bellezza piccola compaiono subito) ----------
const TIMES = { casa: 6, campo: 3, segheria: 6, cava: 7, mercato: 7, bottega: 8, miniera: 8, cristalliera: 9, mulino: 8, fucina: 9, arcieri: 6, radici: 6, caserma: 9, mago: 7, catapulta: 8, braciere: 7, fontana: 5, taverna: 8, statua: 6, porto: 8, scalo: 11, faro: 10, giardino: 5, pozzo: 4, panchina: 3, stendardo: 3, mulinoacqua: 9 };
for (const k in TIMES) BUILD[k].time = TIMES[k];

// ---------- mestieri: gli abitanti con un mestiere lavorano da soli (gli altri aspettano i tuoi tocchi) ----------
// bosco: taglia gli alberi vicini · pietra: spacca rocce e giacimenti scoperti · campi: raccoglie e risemina · cantiere: i cantieri vanno più svelti
export const ROLES = ['bosco', 'pietra', 'campi', 'cantiere'];
export const AUTO_RANGE = 22;          // quanto lontano dal castello va a lavorare chi ha un mestiere (quadretti)
export const REGROW_SECS = 70;         // ogni tanto un albero tagliato ricresce

// ---------- difficoltà ----------
// wave: quanti nemici · hp: quanto robusti · grow: quanto in più a ogni notte che passa
export const DIFFS = { facile: { wave: 1, hp: 1, grow: 0 }, normale: { wave: 1.6, hp: 1.25, grow: 0.06 }, difficile: { wave: 2.3, hp: 1.5, grow: 0.12 } };
export const DIFF_ORDER = ['facile', 'normale', 'difficile'];

// ---------- stagioni (cambiano ogni 3 notti) e tempo ----------
// primavera: i campi crescono più svelti · estate: morale +5 · autunno: raccolti +25% · inverno: campi lenti, nemici più lenti
export const SEASONS = ['primavera', 'estate', 'autunno', 'inverno'];
export const SEASON_NIGHTS = 3;
export const seasonOf = (night) => SEASONS[Math.floor(night / SEASON_NIGHTS) % 4];

// ---------- nebbia: la mappa lontana è coperta dalle nuvole finché non la esplori ----------
// Una spedizione dura da hMin a hMax ORE VERE secondo la distanza (lo ha chiesto il titolare: «dalle 6 alle 10 ore reali»); pick = quanto vicino deve passare a una rovina per prenderne il tesoro
export const FOG = { cell: 6, start: 25, scout: 9, cost: 30, speed: 130, hMin: 6, hMax: 10, pick: 6, boatH: 2 };
export const FW = Math.ceil(COLS / FOG.cell), FH = Math.ceil(ROWS / FOG.cell);

// ---------- rovine: sparse lontano, con un piccolo tesoro per chi le raggiunge ----------
export const RUINS = (function () {
  const rnd = mulberry32(555), out = [];
  for (let guard = 0; out.length < 10 && guard < 4000; guard++) {
    const c = 6 + Math.floor(rnd() * (COLS - 12)), r = 6 + Math.floor(rnd() * (ROWS - 12));
    if (TERRAIN[r * COLS + c] || ROAD_AT[r * COLS + c] || Math.hypot(c - CASTLE.c, r - CASTLE.r) < 30) continue;
    if (TRIBES.some(t => Math.hypot(t.c - c, t.r - r) < 12) || out.some(o => Math.hypot(o.c - c, o.r - r) < 22)) continue;
    const k = out.length;
    out.push({ id: k, c, r, loot: [{ monete: 150 }, { legna: 120, pietra: 80 }, { ferro: 40 }, { cristallo: 25 }, { monete: 100, ferro: 30 }][k % 5] });
  }
  return out;
})();

// ---------- eventi a sorpresa: capitano all'alba, e chiedono una scelta ----------
export const EVENTS = ['mercante', 'festa', 'carestia', 'tesoro', 'drago', 'profughi', 'ambasciatore', 'aiuto', 'tributo', 'soccorso', 'patto', 'tradimento'];

// ---------- il racconto: la Lanterna dei Tuzu si è rotta in nove frammenti, uno per popolo ----------
// capitolo → quanti frammenti servono per sbloccarlo (0 = inizio, 1 = dopo la prima notte)
export const CHAPTERS = [{ id: 0 }, { id: 1, night: 1 }, { id: 2, shards: 1 }, { id: 3, shards: 3 }, { id: 4, shards: 6 }, { id: 5, shards: TRIBES.length }];

// =====================================================================
//  Secondo giro (tappe 1-16)
// =====================================================================

// ---------- un'isola nel lago grande: ci si arriva con un ponte, o in barca dal porto ----------
// (dopo natura e rovine: così alberi, rocce e rovine di prima restano identici, e i salvataggi non si spostano)
for (let r = ISLAND.r - ISLAND.rad; r <= ISLAND.r + ISLAND.rad; r++) for (let c = ISLAND.c - ISLAND.rad; c <= ISLAND.c + ISLAND.rad; c++) TERRAIN[r * COLS + c] = 0;
RUINS.push({ id: RUINS.length, c: ISLAND.c, r: ISLAND.r, loot: { monete: 400, cristallo: 60 }, island: true });


// ---------- edifici a livelli: costo per salire al livello 2 e al 3 ----------
// resa ×1,5 e ×2 · una casa ospita 2 abitanti in più a livello · una caserma un soldato in più a livello · vita +25% a livello
export const LEVELS = {
  casa:         [{ legna: 80, pietra: 30 },   { legna: 160, pietra: 100, ferro: 20 }],
  segheria:     [{ monete: 120, legna: 60 },  { monete: 260, pietra: 120 }],
  cava:         [{ monete: 140, legna: 80 },  { monete: 280, legna: 160, ferro: 30 }],
  miniera:      [{ monete: 180, pietra: 100 }, { monete: 340, pietra: 200, ferro: 60 }],
  cristalliera: [{ monete: 220, ferro: 60 },  { monete: 400, ferro: 140, cristallo: 30 }],
  mulino:       [{ monete: 140, legna: 100 }, { monete: 280, pietra: 140 }],
  porto:        [{ monete: 140, legna: 120 }, { monete: 280, legna: 200, ferro: 30 }],
  scalo:        [{ monete: 200, legna: 200 }, { monete: 360, legna: 300, ferro: 60 }, { monete: 560, pietra: 300, ferro: 140 }, { monete: 800, ferro: 220, cristallo: 60 }],
  caserma:      [{ legna: 120, pietra: 80 },  { pietra: 200, ferro: 80 }],
};
export const LEVEL_MIN = [2, 3];          // il castello che serve per il livello 2 e per il 3
export const LEVEL_MIN_BY = { scalo: [3, 4, 4, 5] };      // il Porto ha cinque livelli: il castello che serve per ognuno dei quattro passi

// ---------- navi ----------
// Gli approdi danno i posti: un Porticciolo 1 (2 al livello 3), un Porto 2 + il suo livello. Il livello più alto di una nave è quello del Porto
// (col solo Porticciolo: navi di livello 1, e niente navi da guerra). hold = quanta merce porta · luck = quanto trova · power = forza in battaglia.
export const SHIP_MAX = 5;
export const SHIPS = {
  pesca:      { cost: { legna: 70, monete: 30 }, hp: 60, fish: [5, 8, 11, 15, 20], plain: true },      // il Peschereccio: non parte, pesca da solo (cibo al minuto)
  mercantile: { cost: { legna: 120, monete: 60 }, hp: 80, hold: [60, 100, 150, 210, 280] },
  veliero:    { cost: { legna: 100, monete: 80 }, hp: 70, luck: [1, 1.3, 1.6, 2, 2.5] },
  guerra:     { cost: { legna: 160, ferro: 50, monete: 100 }, hp: 120, power: [40, 70, 110, 160, 220], tech: 'ferro' },
};
export const SHIP_ORDER = ['pesca', 'mercantile', 'veliero', 'guerra'];
/** Quanto costa portare una nave dal livello lvl (0 = il primo) al successivo. */
export function shipUpCost(type, lvl) { const o = {}, C = SHIPS[type].cost; for (const k in C) o[k] = Math.round(C[k] * 1.1 * (lvl + 1) / 10) * 10; return o; }
// Le rotte: vicina, media, lontana. sell / buy moltiplicano i prezzi del Mercato (vendere per nave rende di più, comprare costa meno,
// ma comprare resta sempre più caro che vendere: niente giri a guadagno sicuro). risk = i pirati rubano il 30% se nessuna nave da guerra è in porto.
export const SEA = {
  trade: [{ mins: 20, sell: 1.2, buy: 0.9, risk: 0 }, { mins: 60, sell: 1.4, buy: 0.8, risk: 0.2 }, { mins: 180, sell: 1.6, buy: 0.7, risk: 0.35 }],
  explore: [{ mins: 60, loot: 120 }, { mins: 180, loot: 320 }, { mins: 360, loot: 700 }],
  fightMins: 45, raidMins: 90, fast: 0.07, repair: 0.6, pirate: 34, pirateExp: 1.35, raid: 45, steal: 0.3,
  faroFast: 0.15, faroRisk: 0.5,          // col Faro: viaggi il 15% più corti, e i pirati colpiscono la metà delle volte
};
export const levelK = (lvl) => 1 + 0.5 * (lvl || 0);
// L'orologio della notte (richiesta del titolare, 19/11): la notte arriva da sola ogni `everyMs` di tempo vero; il giocatore può anticiparla
// `early` volte al giorno; le prime `free` notti (il tutorial) si anticipano sempre; quando è l'ora, `warn` secondi di preavviso.
// Dove va un abitante che non ha niente da fare: si ferma un po' davanti a questi, poi torna verso casa.
export const LEISURE = { giardino: 1, pozzo: 1, panchina: 1, fontana: 1, taverna: 1, statua: 1, stendardo: 1 };
// `ramp`: le prime notti sono più leggere per tutti (quanta parte dell'ondata arriva alla notte 1, 2, 3), qualunque sia la difficoltà:
// un giocatore nuovo con due torri deve passare la prima notte. `needTowers`: sotto questo numero, nelle prime notti, il gioco avvisa prima di partire.
export const NIGHT = { everyMs: 6 * 3600000, early: 2, free: 3, warn: 45, ramp: [0.4, 0.4, 0.55, 0.65, 0.8, 0.9], needTowers: 2, guideNights: 6 };      // guideNights: fino a questa notte la guida dice quante torri servono

// ---------- cibo: i campi danno grano, il mulino lo macina (un grano = due di cibo), il porto pesca ----------
// All'alba ogni abitante e ogni soldato mangia una porzione: prima il cibo, poi il grano crudo.
export const FOOD = { water: 2, mill: 6, from: 3, full: 6, hungry: -12, work: 1.15, slow: 0.8 };

// ---------- popoli con carattere: il capo, il tetto delle case, il soldato speciale (sp_<id> in ENEMIES) ----------
export const TRAITS = {
  rossi:     { chief: 'Brace',   roof: 'cono' },
  blu:       { chief: 'Onda',    roof: 'cupola' },
  gialli:    { chief: 'Pirite',  roof: 'piatto' },
  neri:      { chief: 'Nottola', roof: 'guglia' },
  turchesi:  { chief: 'Brezza',  roof: 'pagoda' },
  bianchi:   { chief: 'Neve',    roof: 'cupola' },
  arancioni: { chief: 'Tizzone', roof: 'piatto' },
  rosa:      { chief: 'Petalo',  roof: 'pagoda' },
  argento:   { chief: 'Lama',    roof: 'guglia' },
};
/** Quanti soldati speciali manda un popolo nella notte n. */
export const specials = (T, n) => (n >= T.from + 2 ? 1 + Math.floor((n - T.from - 2) / 5) : 0);
/** Quante catapulte nemiche arrivano nella notte n (ogni dieci notti, col grande capo). */
export const siegeCount = (n) => (n % 10 === 0 ? 1 + Math.floor(n / 20) : 0);

// ---------- diplomazia: la simpatia di ogni popolo (0-100) ----------
export const REL = { start: 30, gift: 10, ally: 15, trade: 2, raid: -40, breakAlly: -30, peace: 80, cheap: 70, decay: 3 };
export const giftCost = (L) => ({ monete: 40 + 20 * L });

// ---------- dopo il finale: trofei e sfida del giorno ----------
// [cosa, quanto]: i numeri vengono dalle statistiche del regno
export const TROPHIES = [
  ['nights', 5], ['nights', 20], ['nights', 50], ['kills', 100], ['kills', 1000], ['conquer', 1], ['conquer', 5], ['conquer', 9],
  ['ally', 3], ['tech', 12], ['castle', 5], ['shards', 9], ['ruins', 5], ['ruins', 11], ['hero', 10], ['build', 100],
  ['explore', 5], ['morale', 90], ['boss', 1], ['boss', 5], ['items', 5], ['crowns', 10],
];
export const CHALLENGES = [['kills', 40], ['chop', 15], ['harvest', 6], ['build', 8], ['nights', 2], ['train', 4], ['explore', 1], ['trade', 3]];
export const CHALLENGE_REWARD = 150;
// Tre missioni al giorno (scelte dal giorno fra quelle che il giocatore può fare), ognuna col suo premio; tutte e tre = un anticipo della notte in più.
export const DAILY = { n: 3, reward: 80, pool: [['kills', 40], ['chop', 15], ['harvest', 6], ['build', 8], ['nights', 1], ['train', 4], ['explore', 1], ['trade', 2], ['levels', 2], ['gift', 1], ['sell', 2], ['sail', 1]] };
// Il premio della settimana: dodici missioni del giorno ritirate da lunedì a domenica.
export const WEEK = { need: 12, prize: { monete: 500, legna: 150, pietra: 150 } };
// Trappola: un colpo solo per notte (più forte col castello) e un attimo di lentezza. Fossato: chi lo attraversa va a metà passo.
export const TRAP = { dmg: 70, perCastle: 0.3, slow: 0.5, slowT: 1.5, moat: 0.45 };
// Lo stemma del villaggio: un simbolo (0-7) e un colore; il nome ha al più sedici lettere.
export const BANNER = { syms: 8, nameMax: 16, cols: ['#8e5bd6', '#d6453b', '#2f7dd6', '#2fa36b', '#e0a52a', '#e0e0e6', '#33343f', '#e06aa8'] };

// ---------- strade costruite: chi ci cammina (abitanti e soldati) va più svelto ----------
export const ROAD_SPEED = 1.3;
// ---------- al mercato si vende anche: { give: quanto dai, get: monete } ----------
export const SELL = { legna: { give: 40, get: 20 }, pietra: { give: 30, get: 24 }, cibo: { give: 20, get: 16 }, ferro: { give: 15, get: 36 }, cristallo: { give: 8, get: 48 } };
export const SELL_ORDER = ['legna', 'pietra', 'cibo', 'ferro', 'cristallo'];

// ---------- il mondo online: quanto vale ogni cosa nella forza di un villaggio (le stesse cifre stanno nel server: tools/dw_online.sql) ----------
export const PVP_UNIT = { lancia: 10, arco: 11, corazza: 26, cavallo: 18, cura: 9, ariete: 22 };
export const PVP_TOWER = { arcieri: [20, 34, 56], mago: [26, 44, 72], catapulta: [30, 50, 80], braciere: [24, 40, 66], radici: [14, 22, 34] };

// =====================================================================
//  Economia più dura e negozio (20/11/2026, richiesta del titolare: «rendi un po' più difficile il recupero di materiali che poi ti
//  servono per costruire, per aumentare di livello, per scoprire, per avanzare», perché il solo guadagno è il negozio).
//  Le tabelle qui sopra restano quelle di prima: questo blocco le ritocca in un punto solo. L'inizio (castello 1, edifici del primo
//  livello, salita al castello 2, premi della guida) NON cambia: «all'inizio dobbiamo assistere il giocatore in tutto».
// =====================================================================
export const ECON = {
  prod: 0.85,                                  // quello che gli edifici rendono al minuto
  chop: { tree: 6, rock: 5, iron: 7, crystal: 5 },      // erano 7, 6, 8, 6
  crop: 0.85,                                  // le monete di un raccolto (il cibo resta com'era)
  market: 1.3,                                 // al Mercato i materiali costano di più
  castle: [1, 1, 1.3, 1.5, 1.7],               // salire dal livello L al successivo (il primo passo non cambia)
  tech: 1.4, techEasy: 1.2,                    // le scoperte (ferro e aratro, le prime, salgono meno)
  level: [1.3, 1.5, 1.5, 1.5],                 // i livelli degli edifici
  build: [1, 1, 1.15, 1.3, 1.3, 1.3],          // costruire, secondo il castello che serve
  ship: 1.2,                                   // le navi. Torri, mura e soldati NON rincarano: la difesa della notte resta alla portata
  tribute: 0.8, loot: 0.9,                     // colonie e bottino
};
(function () {
  const r5 = (v) => (v < 20 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5);
  const mul = (o, k) => { if (o && k !== 1) for (const key in o) o[key] = r5(o[key] * k); };
  for (const k in BUILD) { const B = BUILD[k]; mul(B.prod, ECON.prod); if (B.cost && B.cat !== 'dif' && B.cat !== 'mura') mul(B.cost, ECON.build[B.min || 1] || 1); }
  for (const k in CHOP) CHOP[k].gain = ECON.chop[k];
  for (const k in CROPS) CROPS[k].gain = r5(CROPS[k].gain * ECON.crop);
  for (const k in TRADE) TRADE[k].cost = r5(TRADE[k].cost * ECON.market);
  CASTLE_UP.forEach((u, L) => { if (u) mul(u.cost, ECON.castle[L] || 1); });
  for (const k in TECHS) mul(TECHS[k].cost, k === 'ferro' || k === 'aratro' ? ECON.techEasy : ECON.tech);
  for (const k in LEVELS) LEVELS[k].forEach((c, i) => mul(c, ECON.level[i] || 1.6));
  for (const k in SHIPS) mul(SHIPS[k].cost, ECON.ship);
})();

// ---------- la Torre costiera (20/11/2026): una torre di pietra che vuole la riva, tira più lontano degli arcieri. Sta in «Acqua», conta fra le torri.
BUILD.costiera = { w: 2, h: 2, hp: 200, cost: { pietra: 80, legna: 50 }, cat: 'acqua', min: 3, tower: true, shore: true, time: 8 };
BUILD_CATS.acqua.splice(BUILD_CATS.acqua.indexOf('ponte'), 0, 'costiera');
TOWERS.costiera = { kind: 'physical', proj: 'arrow', levels: [{ dmg: 15, rate: 0.6, range: 235 }, { up: 90, dmg: 25, rate: 0.55, range: 250 }, { up: 170, dmg: 40, rate: 0.45, range: 265 }] };
PVP_TOWER.costiera = [22, 38, 60];

// ---------- mura a livelli (20/11/2026): ogni pezzo sale due volte, e a ogni livello regge la metà in più (e si vede: è più alto) ----------
LEVELS.mura = [{ pietra: 6 }, { pietra: 10, ferro: 3 }];
export const WALLS = { hp: 0.5, tall: 0.22 };
// ---------- pirati di notte (20/11/2026): chi ha un porto, ogni `every` notti dalla `from` in poi, vede sbarcare dei Tuzu Neri accanto al porto.
// Quanti: base + uno ogni `per` notti, al più `max`; una nave da guerra in porto ne ferma la metà. tribe = l'indice dei Neri in TRIBES.
export const PIRATES = { from: 6, every: 3, base: 2, per: 6, max: 6, tribe: 3, at: 5, gap: 0.9 };

// ---------- il negozio: le gemme ----------
// Le gemme si comprano con soldi veri (gemPacks: l'id è quello del prodotto su Google Play e App Store; il prezzo che si vede è quello
// che dice il negozio del telefono, `eur` serve solo dove il negozio non risponde) e un poco si trovano giocando (scrigno del giorno,
// premio della settimana). Con le gemme: casse di materiali (packs: [materiale, quanto, gemme, scoperta]; la quantità cresce col castello),
// «compra ciò che manca» (perGem = quanto materiale vale una gemma, già col rincaro della comodità), un anticipo della notte, una
// spedizione che torna subito (hurry gemme all'ora, almeno hurryMin).
// Il regalo del giorno: sette giorni di fila, poi si ricomincia. Le monete sono quelle di sempre; al terzo, quinto e settimo giorno ci sono gemme.
export const GIFT7 = [{ monete: 50 }, { monete: 75, legna: 40 }, { monete: 100, gems: 5 }, { monete: 125, pietra: 40 }, { monete: 150, gems: 10 }, { monete: 200, cibo: 60 }, { monete: 300, gems: 25 }];
// Chi torna dopo `days` giorni di assenza trova un regalo di bentornato.
export const BACK = { days: 3, gems: 10 };
// L'evento del fine settimana (sabato e domenica, ora del telefono): uno diverso ogni settimana, a giro.
// harvest: i raccolti rendono il doppio di monete · plenty: gli edifici rendono la metà in più · gems: scrigno ×3 e regalo ×2 di gemme
export const WEEKEND = { order: ['harvest', 'plenty', 'gems'], harvest: 2, plenty: 1.5, chest: 3, gift: 2, trophy: 3 };      // trophy: gemme per ogni trofeo nuovo
export const SHOP = {
  first: 2,                                    // il primo acquisto vale doppio
  start: 30,
  chest: { gems: 2, res: { monete: 60, legna: 40 } },
  packs: [['monete', 500, 30], ['legna', 400, 30], ['pietra', 300, 30], ['cibo', 200, 20], ['ferro', 150, 40, 'ferro'], ['cristallo', 80, 50, 'cristallo']],
  big: { k: 5, price: 4 },                     // la cassa grande: cinque volte tanto al prezzo di quattro
  perGem: { monete: 13, legna: 10, pietra: 8, cibo: 8, grano: 8, ferro: 3, cristallo: 1.3 },
  early: 20, hurry: 8, hurryMin: 5, week: 10,
  gemPacks: [{ id: 'gems_80', gems: 80, eur: '0,99 €' }, { id: 'gems_500', gems: 500, eur: '4,99 €' }, { id: 'gems_1200', gems: 1200, eur: '9,99 €' }, { id: 'gems_3000', gems: 3000, eur: '19,99 €' }],
};

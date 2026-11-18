// Dati di gioco: livelli (mappe, piazzole, ondate), torri, nemici. Nessuna dipendenza dal browser.

export const WORLD_W = 1600;
export const WORLD_H = 720;
export const BASE_GOLD = 220;       // linfa iniziale in battaglia
export const BASE_LIVES = 20;
export const HP_GROWTH = 0.13;      // +13% vita dei nemici per ogni notte
export const SELL_REFUND = 0.6;
export const WALL_X = 1322;
const STEP = 5;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPath(raw, r, step) {
  const P = raw.map(([x, y]) => ({ x, y }));
  const pts = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], v = P[i], b = P[i + 1];
    const d1 = Math.hypot(v.x - a.x, v.y - a.y), d2 = Math.hypot(b.x - v.x, b.y - v.y);
    const r1 = Math.min(r, d1 / 2), r2 = Math.min(r, d2 / 2);
    const p1 = { x: v.x + (a.x - v.x) * r1 / d1, y: v.y + (a.y - v.y) * r1 / d1 };
    const p2 = { x: v.x + (b.x - v.x) * r2 / d2, y: v.y + (b.y - v.y) * r2 / d2 };
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, u = 1 - t;
      pts.push({ x: u * u * p1.x + 2 * u * t * v.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * v.y + t * t * p2.y });
    }
  }
  pts.push(P[P.length - 1]);
  const res = [{ ...pts[0] }];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let pos = step - carry;
    while (pos <= seg) {
      const t = pos / seg;
      res.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      pos += step;
    }
    carry = seg - (pos - step);
  }
  return res;
}

// kind: 'physical' (ridotto dall'armatura) | 'magic' (ridotto dalla resistenza magica)
export const TOWER_ORDER = ['arcieri', 'radici', 'mago', 'catapulta', 'braciere'];
export const TOWERS = {
  arcieri: {
    kind: 'physical', proj: 'arrow',
    levels: [
      { cost: 70, dmg: 12, rate: 0.6, range: 150 },
      { cost: 60, dmg: 20, rate: 0.55, range: 165 },
      { cost: 110, dmg: 33, rate: 0.45, range: 180 },
    ],
  },
  mago: {
    kind: 'magic', proj: 'orb',
    levels: [
      { cost: 110, dmg: 24, rate: 1.3, range: 135, splash: 40 },
      { cost: 90, dmg: 40, rate: 1.2, range: 145, splash: 46 },
      { cost: 150, dmg: 66, rate: 1.1, range: 155, splash: 54 },
    ],
  },
  catapulta: {
    kind: 'physical', proj: 'boulder', minRange: 70,
    levels: [
      { cost: 140, dmg: 45, rate: 2.6, range: 230, splash: 68 },
      { cost: 120, dmg: 74, rate: 2.5, range: 245, splash: 76 },
      { cost: 190, dmg: 120, rate: 2.3, range: 260, splash: 86 },
    ],
  },
  // brucia tutti i nemici nel raggio: danno nel tempo che ignora l'armatura
  braciere: {
    kind: 'fire', proj: 'burn',
    levels: [
      { cost: 130, dmg: 14, rate: 0.5, range: 105, burnT: 2 },
      { cost: 100, dmg: 24, rate: 0.5, range: 115, burnT: 2 },
      { cost: 160, dmg: 40, rate: 0.5, range: 125, burnT: 2.4 },
    ],
  },
  radici: {
    kind: 'magic', proj: 'pulse',
    levels: [
      { cost: 90, dmg: 3, rate: 1.0, range: 115, slow: 0.35, slowT: 1.5 },
      { cost: 70, dmg: 6, rate: 1.0, range: 130, slow: 0.45, slowT: 1.6 },
      { cost: 120, dmg: 10, rate: 0.9, range: 145, slow: 0.55, slowT: 1.8 },
    ],
  },
};

export const ENEMIES = {
  orco:     { hp: 60,   speed: 52, reward: 6,   lives: 1,  armor: 0,     mres: 0,   slowRes: 0,   r: 15, cost: 1 },
  predone:  { hp: 34,   speed: 98, reward: 5,   lives: 1,  armor: 0,     mres: 0,   slowRes: 0,   r: 12, cost: 0.8 },
  bruto:    { hp: 250,  speed: 33, reward: 16,  lives: 2,  armor: 0.35,  mres: 0,   slowRes: 0,   r: 21, cost: 3.2 },
  spettro:  { hp: 85,   speed: 66, reward: 9,   lives: 1,  armor: -0.25, mres: 0.5, slowRes: 0.5, r: 14, cost: 1.6 },
  capo:     { hp: 900,  speed: 30, reward: 70,  lives: 5,  armor: 0.2,   mres: 0.1, slowRes: 0.5, r: 26, boss: true },
  campione: { hp: 2600, speed: 26, reward: 200, lives: 10, armor: 0.25,  mres: 0.2, slowRes: 0.6, r: 32, boss: true },
};

// Ondate generate in modo fisso per livello: più notti e più livello = più nemici e tipi nuovi.
function genWave(li, w, nights) {
  {
    const budget = (7 + w * 2.5) * (1 + li * 0.2);
    const avail = {
      orco: true,
      predone: w >= 1,
      bruto: w >= 3 || (li >= 1 && w >= 2),
      spettro: (li >= 1 && w >= 2) || (li === 0 && w >= 4),
    };
    const pat = [
      { orco: 1, predone: 0.25, bruto: 0.2, spettro: 0.15 },
      { orco: 0.45, predone: 1, bruto: 0, spettro: 0.2 },
      { orco: 0.5, predone: 0.2, bruto: 1, spettro: 0.25 },
      { orco: 0.5, predone: 0.4, bruto: 0.35, spettro: 1 },
    ][w % 4];
    let tot = 0;
    for (const k in pat) if (avail[k]) tot += pat[k];
    const gaps = { orco: Math.max(0.55, 1.1 - w * 0.04), predone: Math.max(0.4, 0.7 - w * 0.03), bruto: Math.max(1.8, 3.2 - w * 0.12), spettro: Math.max(0.65, 1.0 - w * 0.03) };
    const groups = [];
    let at = 0;
    for (const k of ['orco', 'predone', 'bruto', 'spettro']) {
      if (!avail[k] || !pat[k]) continue;
      const n = Math.round(budget * (pat[k] / tot) / ENEMIES[k].cost);
      if (n <= 0) continue;
      groups.push({ t: k, n, gap: gaps[k], at });
      at += 3.5;
    }
    if (nights == null) {            // assedio senza fine: un capo ogni 5 notti, il Campione ogni 10
      if ((w + 1) % 10 === 0) groups.push({ t: 'campione', n: 1 + Math.floor(w / 20), gap: 6, at: 9 });
      else if ((w + 1) % 5 === 0) groups.push({ t: 'capo', n: 1 + Math.floor(w / 15), gap: 5, at: 8 });
      return groups;
    }
    const last = w === nights - 1, mid = w === Math.floor(nights / 2) - 1;
    if (last) groups.push({ t: li >= 2 ? 'campione' : 'capo', n: 1, gap: 1, at: 9 });
    else if (mid && li >= 1) groups.push({ t: 'capo', n: 1, gap: 1, at: 8 });
    return groups;
  }
}
function genWaves(li, nights) { const waves = []; for (let w = 0; w < nights; w++) waves.push(genWave(li, w, nights)); return waves; }

// Piazzole scelte in automatico: vicine al sentiero ma non sopra, distanziate, dove coprono di più.
function autoSpots(L, count) {
  const sample = L.path.filter((_, i) => i % 2 === 0);
  const dist = (x, y) => { let b = 1e9; for (const p of sample) { const d = Math.hypot(p.x - x, p.y - y); if (d < b) b = d; } return b; };
  const cands = [];
  for (let x = 235; x <= 1255; x += 15) {
    for (let y = 112; y <= 628; y += 15) {
      const d = dist(x, y);
      if (d < 80 || d > 104) continue;
      if (Math.hypot(x - L.portal.x, y - L.portal.y) < 120) continue;
      let c = 0;
      for (const p of sample) if (Math.hypot(p.x - x, p.y - y) <= 150) c++;
      cands.push({ x, y, c });
    }
  }
  cands.sort((a, b) => b.c - a.c);
  const out = [];
  for (const c of cands) {
    if (out.length >= count) break;
    if (out.some(o => Math.hypot(o.x - c.x, o.y - c.y) < 112)) continue;
    out.push({ x: c.x, y: c.y });
  }
  return out;
}

const DEFS = [
  { key: 'valle', nights: 6, path: [[225, 180], [430, 180], [430, 480], [680, 480], [680, 220], [930, 220], [930, 540], [1160, 540], [1160, 330], [1300, 330]] },
  { key: 'autunno', nights: 7, path: [[225, 560], [520, 560], [520, 310], [330, 310], [330, 130], [760, 130], [760, 450], [1020, 450], [1020, 230], [1300, 230]] },
  { key: 'bosco', nights: 8, path: [[225, 120], [1150, 120], [1150, 310], [420, 310], [420, 490], [900, 490], [900, 620], [1300, 620]] },
  { key: 'neve', nights: 8, path: [[225, 600], [700, 600], [700, 380], [330, 380], [330, 160], [960, 160], [960, 430], [1160, 430], [1160, 320], [1300, 320]] },
  { key: 'palude', nights: 9, path: [[225, 360], [380, 360], [380, 570], [620, 570], [620, 150], [860, 150], [860, 570], [1100, 570], [1100, 360], [1300, 360]] },
  { key: 'erebo', nights: 10, path: [[225, 200], [560, 200], [560, 500], [900, 500], [900, 260], [1300, 260]] },
];

function makeLevel(def, index) {
  const path = buildPath(def.path, 62, STEP);
  const len = (path.length - 1) * STEP;
  const L = {
    id: index, key: def.key, theme: def.theme || def.key, nights: def.nights, endless: !!def.endless, path, len,
    portal: { x: def.path[0][0], y: def.path[0][1] },
    gate: { x: 1300, y: def.path[def.path.length - 1][1] },
    hpMul: def.endless ? 1.2 : 1 + index * 0.16,
  };
  L.pos = (d) => {
    const f = Math.max(0, Math.min(path.length - 1.001, d / STEP));
    const i = Math.floor(f), t = f - i;
    const a = path[i], b = path[i + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  L.dist = (x, y) => {
    let best = 1e9;
    for (let i = 0; i < path.length; i += 2) { const d = Math.hypot(path[i].x - x, path[i].y - y); if (d < best) best = d; }
    return best;
  };
  L.spots = autoSpots(L, 13);
  L.waves = def.endless ? [] : genWaves(index, def.nights);
  L.waveAt = (i) => def.endless ? genWave(2, i, null) : L.waves[i];
  L.summary = (i) => { const o = {}, w = L.waveAt(i); if (!w) return o; for (const g of w) o[g.t] = (o[g.t] || 0) + g.n; return o; };
  return L;
}

export const LEVELS = DEFS.map(makeLevel);
// Assedio senza fine: una mappa a parte, ondate che non finiscono mai.
export const ENDLESS = makeLevel({ key: 'assedio', theme: 'autunno', endless: true, nights: 0, path: [[225, 360], [420, 360], [420, 150], [700, 150], [700, 560], [980, 560], [980, 300], [1300, 300]] }, 6);
export { mulberry32 };

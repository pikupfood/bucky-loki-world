// Dati di gioco: mappa a quadretti, edifici, torri, nemici, colture, notti. Nessuna dipendenza dal browser.

export const G = 40;                 // lato di un quadretto, in unità di mondo
export const COLS = 56, ROWS = 40;
export const WORLD_W = COLS * G, WORLD_H = ROWS * G;
export const CASTLE = { c: 27, r: 19, w: 3, h: 3 };
export const START = { monete: 150, legna: 130, pietra: 0 };
export const SELL_REFUND = 0.5;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Portali dell'Èrebo ai bordi della mappa. Ogni notte ne è attivo qualcuno in più.
export const PORTALS = [
  { id: 'ovest', c: 0, r: 20 }, { id: 'est', c: COLS - 1, r: 20 },
  { id: 'nord', c: 28, r: 0 }, { id: 'sud', c: 28, r: ROWS - 1 },
];
/** Portali attivi nella notte numero n (1 = prima notte): prima solo ovest, poi si aggiungono est, nord e sud. */
export function portalsFor(n) {
  const k = n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4;
  return PORTALS.slice(0, k);
}

// ---------- edifici ----------
// w,h: quadretti occupati · cost: risorse · min: livello del castello che lo sblocca
// flat: non blocca il passaggio (campi) · line: si tira in fila · gate: i tuoi passano, i nemici no
export const BUILD = {
  castello:  { w: 3, h: 3, hp: 800 },
  casa:      { w: 2, h: 2, hp: 120, cost: { legna: 40 }, cat: 'eco', min: 1, pop: 4, prod: { monete: 6 } },
  campo:     { w: 2, h: 2, hp: 50, cost: { legna: 30 }, cat: 'eco', min: 1, flat: true },
  segheria:  { w: 2, h: 2, hp: 120, cost: { monete: 50 }, cat: 'eco', min: 1, prod: { legna: 12 }, cap: (L) => 1 + L },
  cava:      { w: 2, h: 2, hp: 140, cost: { legna: 60 }, cat: 'eco', min: 2, prod: { pietra: 9 }, cap: (L) => L },
  arcieri:   { w: 2, h: 2, hp: 160, cost: { legna: 50 }, cat: 'dif', min: 1, tower: true },
  radici:    { w: 2, h: 2, hp: 140, cost: { legna: 40, monete: 20 }, cat: 'dif', min: 2, tower: true },
  caserma:   { w: 2, h: 2, hp: 220, cost: { legna: 80, pietra: 40 }, cat: 'dif', min: 2, soldiers: 3, cap: (L) => L - 1 },
  mago:      { w: 2, h: 2, hp: 140, cost: { pietra: 60, monete: 40 }, cat: 'dif', min: 3, tower: true },
  catapulta: { w: 2, h: 2, hp: 180, cost: { legna: 80, pietra: 40 }, cat: 'dif', min: 3, tower: true },
  braciere:  { w: 2, h: 2, hp: 160, cost: { pietra: 70, legna: 30 }, cat: 'dif', min: 4, tower: true },
  recinto:   { w: 1, h: 1, hp: 60, cost: { legna: 4 }, cat: 'mura', min: 1, line: true },
  mura:      { w: 1, h: 1, hp: 260, cost: { pietra: 8 }, cat: 'mura', min: 2, line: true },
  cancello:  { w: 1, h: 1, hp: 180, cost: { legna: 20, pietra: 10 }, cat: 'mura', min: 2, gate: true },
};
export const BUILD_CATS = { eco: ['casa', 'campo', 'segheria', 'cava'], dif: ['arcieri', 'radici', 'caserma', 'mago', 'catapulta', 'braciere'], mura: ['recinto', 'mura', 'cancello'] };
export const towerCap = (L) => 2 + 2 * L;
export const SOLDIER = { hp: 90, dmg: 10, rate: 0.7, speed: 78, reach: 320, cost: 25 };

// Potenziare il castello: costo per passare dal livello L a L+1 e notti da aver superato.
export const CASTLE_UP = [
  null,
  { cost: { monete: 200, legna: 150 }, nights: 2 },
  { cost: { monete: 400, legna: 250, pietra: 150 }, nights: 5 },
  { cost: { monete: 800, legna: 400, pietra: 350 }, nights: 9 },
  { cost: { monete: 1500, legna: 700, pietra: 700 }, nights: 14 },
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

/** I nemici della notte numero n (1 = prima): gruppi { t: tipo, n: quanti, gap: secondi fra uno e l'altro, at: partenza }. */
export function genWave(n) {
  const w = n - 1, budget = 8 + w * 3.1;
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
export function waveSummary(n) { const o = {}; for (const g of genWave(n)) o[g.t] = (o[g.t] || 0) + g.n; return o; }
/** Quanto sono più robusti i nemici alla notte n. */
export const hpMul = (n) => 1 + 0.12 * (n - 1) + 0.004 * (n - 1) * (n - 1);

// ---------- natura: boschi e rocce, sempre uguali (si possono tagliare per far posto e prendere risorse) ----------
export const NATURE = (function () {
  const rnd = mulberry32(4242), out = [], used = new Set();
  const far = (c, r) => Math.abs(c - (CASTLE.c + 1)) > 7 || Math.abs(r - (CASTLE.r + 1)) > 6;
  const clear = (c, r) => !PORTALS.some(p => Math.abs(p.c - c) < 4 && Math.abs(p.r - r) < 4);
  const put = (c, r, kind) => {
    c = Math.round(c); r = Math.round(r);
    if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1 || !far(c, r) || !clear(c, r)) return;
    const k = r * COLS + c;
    if (used.has(k)) return;
    used.add(k);
    out.push({ id: out.length, c, r, kind, size: 0.8 + rnd() * 0.45, tint: Math.floor(rnd() * 6) });
  };
  for (let i = 0; i < 17; i++) {
    const cc = 3 + rnd() * (COLS - 6), cr = 3 + rnd() * (ROWS - 6), n = 9 + Math.floor(rnd() * 13), rad = 2.2 + rnd() * 2.6;
    for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rad; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d * 0.8, 'tree'); }
  }
  for (let i = 0; i < 9; i++) {
    const cc = 4 + rnd() * (COLS - 8), cr = 4 + rnd() * (ROWS - 8), n = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 1.8; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d, 'rock'); }
  }
  return out;
})();
export const CHOP = { tree: { res: 'legna', gain: 7 }, rock: { res: 'pietra', gain: 6 } };

// Dati di gioco: mappa a quadretti, edifici, torri, nemici, colture, notti. Nessuna dipendenza dal browser.

export const G = 40;                 // lato di un quadretto, in unità di mondo
export const COLS = 84, ROWS = 56;
export const WORLD_W = COLS * G, WORLD_H = ROWS * G;
export const CASTLE = { c: 40, r: 26, w: 3, h: 3 };
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
// Ogni popolo rivale ha un villaggio sulla mappa: di notte gli attacchi partono da lì.
// level: forza di partenza · from: prima notte in cui attacca · good: il bene che paga da colonia
export const MY_COLOR = '#b592f5';
export const TRIBES = [
  { id: 'rossi',  color: '#ee5a52', eyes: '#2b2a33', c: 9,  r: 30, level: 1, from: 1,  good: 'legna' },
  { id: 'blu',    color: '#3f9cf2', eyes: '#2b2a33', c: 74, r: 22, level: 2, from: 3,  good: 'pietra' },
  { id: 'gialli', color: '#f4c430', eyes: '#2b2a33', c: 36, r: 6,  level: 3, from: 6,  good: 'ferro' },
  { id: 'neri',   color: '#3b3947', eyes: '#ffffff', c: 48, r: 49, level: 4, from: 10, good: 'cristallo' },
];
export const VILLAGE_R = 5;            // il territorio di un villaggio è largo 2·R+1 quadretti: lì non si costruisce
export const REVOLT_NIGHTS = 6;        // una colonia si ribella dopo tante notti, e torna più forte
for (const t of TRIBES) {              // l'uscita del villaggio: tre quadretti dal centro, verso il castello
  const dx = CASTLE.c + 1 - t.c, dy = CASTLE.r + 1 - t.r, d = Math.hypot(dx, dy);
  t.gate = { c: Math.round(t.c + dx / d * 3.4), r: Math.round(t.r + dy / d * 3.4) };
}
export const villageHp = (L) => 500 + 400 * (L - 1);
/** I difensori di un villaggio di livello L. */
export function villageGuards(L) { const o = { orco: 3 + 2 * L }; if (L >= 2) o.bruto = L - 1; if (L >= 4) o.capo = 1; return o; }
const GOOD_RATE = { legna: 8, pietra: 6, ferro: 3, cristallo: 2 };
/** Il bottino di una conquista. */
export function villageLoot(t, L) { const o = { monete: 120 + 80 * L, legna: 60 * L, pietra: 40 * L }; o[t.good] = (o[t.good] || 0) + GOOD_RATE[t.good] * 10 * L; return o; }
/** Quello che una colonia paga al minuto. */
export function villageTribute(t, L) { const o = { monete: 4 + 2 * L }; o[t.good] = GOOD_RATE[t.good]; return o; }

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
    if (used.has(k)) return;
    used.add(k);
    out.push({ id: out.length, c, r, kind, size: 0.8 + rnd() * 0.45, tint: Math.floor(rnd() * 6) });
  };
  const blob = (kind, groups, n0, n1, rad, margin, minD) => {
    for (let i = 0, guard = 0; i < groups && guard < 400; guard++) {
      const cc = margin + rnd() * (COLS - margin * 2), cr = margin + rnd() * (ROWS - margin * 2);
      if (Math.hypot(cc - CASTLE.c - 1, cr - CASTLE.r - 1) < minD) continue;
      const n = n0 + Math.floor(rnd() * (n1 - n0 + 1)), rr = rad * (0.7 + rnd() * 0.6);
      for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rr; put(cc + Math.cos(a) * d, cr + Math.sin(a) * d * 0.8, kind); }
      i++;
    }
  };
  blob('iron', 7, 3, 4, 1.3, 5, 11);         // prima i giacimenti, così il bosco non li copre
  blob('crystal', 5, 2, 3, 1.1, 5, 14);
  blob('tree', 34, 9, 20, 3.6, 3, 0);
  blob('rock', 16, 3, 7, 1.8, 4, 0);
  return out;
})();
export const CHOP = { tree: { res: 'legna', gain: 7 }, rock: { res: 'pietra', gain: 6 }, iron: { res: 'ferro', gain: 8, tech: 'ferro' }, crystal: { res: 'cristallo', gain: 6, tech: 'cristallo' } };

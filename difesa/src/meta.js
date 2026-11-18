// Il villaggio: monete, stelle, edifici, coltivazioni, ricompensa giornaliera. Regole pure (niente DOM).
import { LEVELS } from './data.js';

export const MAX_LEVEL = 5;
const MULT = [1, 1.8, 3, 4.5, 6.5];           // costo del livello k = base × MULT[k-1]

// Ogni edificio cambia qualcosa di concreto in battaglia o nei campi.
export const BUILDINGS = {
  castello:  { start: 1, costs: [0, 300, 700, 1400, 2600], stars: [0, 3, 8, 13, 17] },
  campi:     { start: 1, base: 100 },   // più campi da coltivare
  mulino:    { start: 0, base: 140 },   // raccolti più ricchi
  santuario: { start: 0, base: 180 },   // liv.1 sblocca il Cristallo, liv.2 il Fulmine; poi più magia
  fucina:    { start: 0, base: 150 },   // liv.1 sblocca la Catapulta; poi più danno fisico
  mura:      { start: 0, base: 120 },   // più vite
  mercato:   { start: 0, base: 120 },   // più linfa iniziale
  vedetta:   { start: 0, base: 160 },   // più raggio
};
export const BUILDING_ORDER = ['castello', 'campi', 'mulino', 'santuario', 'fucina', 'mura', 'mercato', 'vedetta'];

export const CROPS = {
  grano:  { secs: 60,    cost: 4,  gain: 9 },
  carote: { secs: 300,   cost: 10, gain: 40 },
  zucche: { secs: 1800,  cost: 25, gain: 150 },
  uva:    { secs: 14400, cost: 60, gain: 700 },
};
export const CROP_ORDER = ['grano', 'carote', 'zucche', 'uva'];
export const PLOTS = 6;
const DAILY = [50, 75, 100, 125, 150, 200, 300];

// Missioni: tre alla volta; ritirato il premio ne arriva un'altra, un po' più lunga.
export const QUEST_SLOTS = [['kills', 'nights'], ['harvest', 'build'], ['wins', 'stars3']];
const QUESTS = {
  kills: { goal: 40, inc: 20, reward: 50 }, nights: { goal: 8, inc: 4, reward: 60 },
  harvest: { goal: 4, inc: 2, reward: 40 }, build: { goal: 1, inc: 0, reward: 60 },
  wins: { goal: 2, inc: 1, reward: 80 }, stars3: { goal: 1, inc: 0, reward: 100 },
};
const DAY = 86400000;

function defaults() {
  const b = {};
  for (const k of BUILDING_ORDER) b[k] = BUILDINGS[k].start;
  return { coins: 60, buildings: b, stars: {}, plots: Array.from({ length: PLOTS }, () => null), dailyDay: 0, streak: 0, wins: 0, quests: QUEST_SLOTS.map(() => ({ n: 0, p: 0 })), seen: {}, best: 0 };
}

export class Meta {
  constructor(data) {
    const d = defaults();
    if (data && typeof data === 'object') {
      if (typeof data.coins === 'number') d.coins = data.coins;
      Object.assign(d.buildings, data.buildings || {});
      Object.assign(d.stars, data.stars || {});
      if (Array.isArray(data.plots)) for (let i = 0; i < PLOTS; i++) d.plots[i] = data.plots[i] || null;
      d.dailyDay = data.dailyDay || 0; d.streak = data.streak || 0; d.wins = data.wins || 0; d.best = data.best || 0;
      Object.assign(d.seen, data.seen || {});
      if (Array.isArray(data.quests)) data.quests.forEach((q, i) => { if (d.quests[i] && q) d.quests[i] = { n: q.n || 0, p: q.p || 0 }; });
    }
    this.d = d;
  }

  get coins() { return this.d.coins; }
  lvl(id) { return this.d.buildings[id] || 0; }
  totalStars() { let s = 0; for (const k in this.d.stars) s += this.d.stars[k]; return s; }

  // ---- edifici ----
  cost(id) {
    const l = this.lvl(id);
    if (l >= MAX_LEVEL) return null;
    const B = BUILDINGS[id];
    return B.costs ? B.costs[l] : Math.round(B.base * MULT[l]);
  }
  /** Perché (non) si può potenziare: 'ok' | 'max' | 'castle' | 'stars' | 'coins' */
  check(id) {
    const l = this.lvl(id);
    if (l >= MAX_LEVEL) return 'max';
    if (id === 'castello') { if (this.totalStars() < BUILDINGS.castello.stars[l]) return 'stars'; }
    else if (l >= this.lvl('castello')) return 'castle';
    return this.d.coins >= this.cost(id) ? 'ok' : 'coins';
  }
  starsNeeded() { const l = this.lvl('castello'); return l >= MAX_LEVEL ? 0 : BUILDINGS.castello.stars[l]; }
  upgrade(id) {
    if (this.check(id) !== 'ok') return false;
    this.d.coins -= this.cost(id);
    this.d.buildings[id] = this.lvl(id) + 1;
    this.track('build');
    return true;
  }

  // ---- cosa danno gli edifici ----
  effect(id, l = this.lvl(id)) {
    switch (id) {
      case 'campi': return 1 + l;                              // campi coltivabili
      case 'mulino': return Math.round(l * 12);                 // % raccolto in più
      case 'santuario': return Math.round(Math.max(0, l - 1) * 8);   // % magia in più
      case 'fucina': return Math.round(Math.max(0, l - 1) * 8);      // % danno fisico in più
      case 'mura': return l * 2;                                // vite in più
      case 'mercato': return l * 25;                            // linfa iniziale in più
      case 'vedetta': return l * 4;                             // % raggio in più
      default: return l;
    }
  }
  towersUnlocked() {
    const t = ['arcieri', 'radici'];
    if (this.lvl('santuario') >= 1) t.push('mago');
    if (this.lvl('fucina') >= 1) t.push('catapulta');
    if (this.lvl('fucina') >= 3) t.push('braciere');
    return t;
  }
  mods() {
    const sl = this.lvl('santuario');
    return {
      phys: 1 + this.effect('fucina') / 100,
      magic: 1 + this.effect('santuario') / 100,
      range: 1 + this.effect('vedetta') / 100,
      lives: this.effect('mura'),
      gold: this.effect('mercato'),
      towers: this.towersUnlocked(),
      spell: sl >= 2 ? { dmg: 70 + sl * 35, radius: 95, cd: 24 } : null,
    };
  }

  // ---- coltivazioni (tempo reale: crescono anche a gioco chiuso) ----
  plotsOpen() { return Math.min(PLOTS, this.effect('campi')); }
  plot(i, now) {
    if (i >= this.plotsOpen()) return { locked: true };
    const p = this.d.plots[i];
    if (!p) return { empty: true };
    const total = CROPS[p.crop].secs * 1000, el = now - p.at;
    return { crop: p.crop, progress: Math.max(0, Math.min(1, el / total)), ripe: el >= total, left: Math.max(0, total - el) };
  }
  plant(i, crop, now) {
    const st = this.plot(i, now);
    if (!st.empty || !CROPS[crop] || this.d.coins < CROPS[crop].cost) return false;
    this.d.coins -= CROPS[crop].cost;
    this.d.plots[i] = { crop, at: now };
    return true;
  }
  yieldOf(crop) { return Math.round(CROPS[crop].gain * (1 + this.effect('mulino') / 100)); }
  harvest(i, now) {
    const st = this.plot(i, now);
    if (!st.ripe) return 0;
    const g = this.yieldOf(st.crop);
    this.d.coins += g;
    this.d.plots[i] = null;
    this.track('harvest');
    return g;
  }

  // ---- livelli ----
  stars(i) { return this.d.stars[i] || 0; }
  levelOpen(i) { return i === 0 || this.stars(i - 1) > 0; }
  /** Fine battaglia: stelle (per vite rimaste) e monete. Rigiocare paga la metà. */
  finish(i, won, livesFrac) {
    if (!won) { const c = 15 + i * 10; this.d.coins += c; return { stars: 0, coins: c, first: false }; }
    const st = livesFrac >= 0.8 ? 3 : livesFrac >= 0.4 ? 2 : 1;
    const prev = this.stars(i), first = prev === 0;
    const full = (100 + 60 * i) * st;
    const coins = first ? full : Math.round(full * 0.5) + (st > prev ? (st - prev) * (50 + 30 * i) : 0);
    if (st > prev) this.d.stars[i] = st;
    this.d.coins += coins; this.d.wins++;
    this.track('wins'); if (st === 3) this.track('stars3');
    return { stars: st, coins, first };
  }

  // ---- assedio senza fine ----
  endlessOpen() { return this.stars(2) > 0; }
  finishEndless(nights) {
    const record = nights > this.d.best, coins = nights * 15 + (record ? 50 : 0);
    if (record) this.d.best = nights;
    this.d.coins += coins;
    return { stars: 0, coins, nights, record, best: this.d.best, endless: true };
  }

  // ---- missioni ----
  quest(slot) {
    const q = this.d.quests[slot], seq = QUEST_SLOTS[slot], type = seq[q.n % seq.length], D = QUESTS[type];
    const goal = D.goal + D.inc * Math.floor(q.n / seq.length);
    return { type, goal, progress: Math.min(goal, q.p), reward: D.reward + 10 * Math.floor(q.n / seq.length), ready: q.p >= goal };
  }
  track(type, amount = 1) { this.d.quests.forEach((q, i) => { if (this.quest(i).type === type) q.p += amount; }); }
  questsReady() { return this.d.quests.filter((_, i) => this.quest(i).ready).length; }
  claimQuest(slot) {
    const q = this.quest(slot);
    if (!q.ready) return 0;
    this.d.coins += q.reward;
    this.d.quests[slot] = { n: this.d.quests[slot].n + 1, p: 0 };
    return q.reward;
  }

  // ---- ricompensa giornaliera ----
  daily(now) {
    const day = Math.floor(now / DAY);
    if (day <= this.d.dailyDay) return { available: false };
    const streak = day === this.d.dailyDay + 1 ? Math.min(this.d.streak + 1, DAILY.length) : 1;
    return { available: true, amount: DAILY[streak - 1], streak };
  }
  claimDaily(now) {
    const dly = this.daily(now);
    if (!dly.available) return 0;
    this.d.dailyDay = Math.floor(now / DAY); this.d.streak = dly.streak;
    this.d.coins += dly.amount;
    return dly.amount;
  }

  toJSON() { return this.d; }
}

export const LEVEL_COUNT = LEVELS.length;

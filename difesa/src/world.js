// Il regno: regole pure (niente disegno, niente DOM). Griglia, costruzione libera, risorse, colture,
// notti con i popoli rivali che scendono dai loro villaggi, torri, esercito, assalti, scoperte, missioni.
import {
  G, COLS, ROWS, CASTLE, START, SELL_REFUND, BUILD, towerCap, UNITS, CASERMA_SLOTS, GUARD_REACH, CASTLE_UP, MAX_CASTLE,
  castleHp, TOWERS, ENEMIES, CROPS, genWave, hpMul, NATURE, CHOP, TRIBES, VILLAGE_R, REVOLT_NIGHTS, TECHS,
  villageHp, villageGuards, villageLoot, villageTribute, TRADE, TERRAIN, STEP, ALLY_NIGHTS, MAX_ALLIES, TRADES_PER_DAY,
  allyCost, allyHelpers, villageTrade, mulberry32,
} from './data.js';

const N = COLS * ROWS, DAY = 86400000, AWAY_CAP = 2 * 3600 * 1000, RAID_MAX = 240;
const DAILY = [50, 75, 100, 125, 150, 200, 300];
export const QUEST_SLOTS = [['kills', 'nights', 'ally'], ['harvest', 'build'], ['chop', 'train', 'conquer']];
const QUESTS = {
  kills: { goal: 30, inc: 20, reward: 50 }, nights: { goal: 3, inc: 2, reward: 80 },
  harvest: { goal: 4, inc: 2, reward: 40 }, build: { goal: 5, inc: 3, reward: 50 },
  chop: { goal: 8, inc: 4, reward: 40 }, train: { goal: 2, inc: 1, reward: 50 }, conquer: { goal: 1, inc: 0, reward: 150 }, ally: { goal: 1, inc: 0, reward: 80 },
};
const MULT = { physical: (e) => 1 - e.armor, magic: (e) => 1 - e.mres, fire: (e) => 1 - e.mres * 0.5 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const idx = (c, r) => r * COLS + c;
const inMap = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
const cellOf = (v, max) => Math.max(0, Math.min(max - 1, Math.floor(v / G)));
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

const NAT_AT = new Int32Array(N);       // id+1 dell'elemento di natura su quel quadretto (0 = niente)
for (const n of NATURE) NAT_AT[idx(n.c, n.r)] = n.id + 1;
const VIL_AT = new Int8Array(N).fill(-1);   // di quale villaggio è quel quadretto (-1 = di nessuno)
TRIBES.forEach((t, i) => { for (let r = t.r - VILLAGE_R; r <= t.r + VILLAGE_R; r++) for (let c = t.c - VILLAGE_R; c <= t.c + VILLAGE_R; c++) if (inMap(c, r)) VIL_AT[idx(c, r)] = i; });
const CASTLE_CELLS = [];
for (let r = CASTLE.r; r < CASTLE.r + CASTLE.h; r++) for (let c = CASTLE.c; c < CASTLE.c + CASTLE.w; c++) CASTLE_CELLS.push(idx(c, r));

function fresh(now) {
  return {
    v: 4, map: 2, res: { ...START }, castle: 1, night: 0, nextId: 2,
    buildings: [{ id: 1, type: 'castello', c: CASTLE.c, r: CASTLE.r, hp: castleHp(1) }],
    cut: [], tech: {}, villages: TRIBES.map(t => ({ level: t.level, state: 'free', since: 0, until: 0, trades: 0 })),
    quests: QUEST_SLOTS.map(() => ({ n: 0, p: 0 })), seen: {}, dailyDay: 0, streak: 0, lastSeen: now,
  };
}

export class World {
  constructor(data, now = Date.now(), seed = 1) {
    const d = fresh(now);
    if (data && (data.v === 3 || data.v === 4) && Array.isArray(data.buildings) && data.buildings.some(b => b.type === 'castello')) {
      // le mappe più vecchie erano più piccole: gli edifici si spostano insieme al castello, la natura si rifà
      const was = data.buildings.find(b => b.type === 'castello'), old = data.map !== 2, dc = CASTLE.c - was.c, dr = CASTLE.r - was.r;
      for (const k in START) if (data.res && isFinite(data.res[k])) d.res[k] = data.res[k];
      d.castle = Math.max(1, Math.min(MAX_CASTLE, data.castle || 1)); d.night = data.night || 0; d.nextId = data.nextId || 2;
      d.buildings = data.buildings.filter(b => BUILD[b.type]).map(b => {
        const o = { ...b, c: b.c + dc, r: b.r + dr };
        if (o.sold) o.units = Array(o.sold).fill('lancia');
        delete o.sold;
        if (o.units) o.units = o.units.filter(u => UNITS[u]).slice(0, CASERMA_SLOTS);
        return o;
      }).filter(b => { const D = BUILD[b.type]; return b.type === 'castello' || (b.c >= 2 && b.r >= 2 && b.c + D.w <= COLS - 2 && b.r + D.h <= ROWS - 2 && VIL_AT[idx(b.c, b.r)] < 0 && VIL_AT[idx(b.c + D.w - 1, b.r + D.h - 1)] < 0 && !TERRAIN[idx(b.c, b.r)] && !TERRAIN[idx(b.c + D.w - 1, b.r + D.h - 1)] && !TERRAIN[idx(b.c + D.w - 1, b.r)] && !TERRAIN[idx(b.c, b.r + D.h - 1)]); });
      d.cut = !old && Array.isArray(data.cut) ? data.cut.filter(i => NATURE[i]) : [];
      Object.assign(d.tech, data.tech || {});
      if (Array.isArray(data.villages)) data.villages.forEach((v, i) => { if (d.villages[i] && v) d.villages[i] = { level: v.level || TRIBES[i].level, state: v.state === 'colony' || v.state === 'ally' ? v.state : 'free', since: v.since || 0, until: v.until || 0, trades: v.trades || 0 }; });
      if (Array.isArray(data.quests)) data.quests.forEach((q, i) => { if (d.quests[i] && q) d.quests[i] = { n: q.n || 0, p: q.p || 0 }; });
      Object.assign(d.seen, data.seen || {});
      d.dailyDay = data.dailyDay || 0; d.streak = data.streak || 0; d.lastSeen = data.lastSeen || now;
    }
    this.d = d;
    this.rng = mulberry32(seed);
    this.status = 'day';                 // day | night | raid
    this.enemies = []; this.projs = []; this.soldiers = []; this.queue = []; this.events = [];
    this.raid = null; this.raidDist = null;
    this.waveT = 0; this.spellCd = 0; this.uid = 1; this.rev = 0; this.away = null; this.castleHit = false; this.nightKills = 0;
    this.cutSet = new Set(d.cut);
    // sotto un edificio non resta natura (succede solo venendo da un salvataggio vecchio)
    for (const b of d.buildings) { const D = BUILD[b.type]; for (let r = b.r; r < b.r + D.h; r++) for (let c = b.c; c < b.c + D.w; c++) { const k = NAT_AT[idx(c, r)]; if (k && !this.cutSet.has(k - 1)) { this.cutSet.add(k - 1); d.cut.push(k - 1); } } }
    this.rebuild();
    for (const b of d.buildings) b.hp = this.maxHp(b);      // si riparte sempre di giorno, con tutto riparato
    this.fields();
    for (const b of d.buildings) if (b.type === 'caserma') (b.units || []).forEach((u, i) => this.spawnSoldier(b, u, i));
    this.offline(now);
  }

  toJSON() {
    const keep = ({ id, type, c, r, hp, lvl, crop, units }) => { const o = { id, type, c, r, hp: Math.round(hp) }; if (lvl) o.lvl = lvl; if (crop) o.crop = crop; if (units && units.length) o.units = units.slice(); return o; };
    const res = {}; for (const k in this.d.res) res[k] = Math.floor(this.d.res[k]);
    return { ...this.d, res, buildings: this.d.buildings.map(keep) };
  }

  // ---------- griglia ----------
  rebuild() {
    const occ = this.occ = new Int32Array(N);
    this.byId = new Map();
    for (const b of this.d.buildings) {
      const D = BUILD[b.type];
      b.x = (b.c + D.w / 2) * G; b.y = (b.r + D.h / 2) * G;
      if (b.cd == null) { b.cd = 0.3; b.angle = -Math.PI / 2; b.fireAnim = 0; }
      this.byId.set(b.id, b);
      for (let r = b.r; r < b.r + D.h; r++) for (let c = b.c; c < b.c + D.w; c++) occ[idx(c, r)] = b.id;
    }
    this.castle = this.d.buildings.find(b => b.type === 'castello');
    this.fields();
    this.rev++;
  }
  natAt(c, r) { if (!inMap(c, r)) return null; const k = NAT_AT[idx(c, r)]; return k && !this.cutSet.has(k - 1) ? NATURE[k - 1] : null; }
  buildingAt(c, r) { if (!inMap(c, r)) return null; const id = this.occ[idx(c, r)]; return id > 0 ? this.byId.get(id) : null; }
  /** L'indice del villaggio a cui appartiene quel quadretto, o -1. */
  villageAt(c, r) { return inMap(c, r) ? VIL_AT[idx(c, r)] : -1; }
  maxHp(b) { return b.type === 'castello' ? castleHp(this.d.castle) : b.type === 'mura' && this.d.tech.bastioni ? BUILD.mura.hp * 1.5 : BUILD[b.type].hp; }
  /** L'edificio che sbarra quel quadretto a un nemico (gli spiriti attraversano tutto tranne il castello). */
  blockAt(i, ghost) {
    const id = this.occ[i];
    if (id <= 0) return null;
    const b = this.byId.get(id);
    if (!b || BUILD[b.type].flat) return null;
    return ghost && b.type !== 'castello' ? null : b;
  }

  /** Vero se quel quadretto è un tuo edificio che i soldati non attraversano (i cancelli e i campi sì). */
  armyBlock(i) { const b = this.blockAt(i, false); return !!b && !BUILD[b.type].gate; }

  /** Mappa delle distanze da un gruppo di quadretti: chi la segue scende sempre verso il valore più basso.
   *  mode 'enemy': passare da un edificio "costa" quanto è robusto, quindi se c'è un varco ci si gira attorno,
   *  altrimenti si punta al pezzo più debole. 'ghost': contano solo castello e natura.
   *  'army': i tuoi soldati, che passano dai cancelli e preferiscono non scavalcare i tuoi edifici. */
  flow(targets, mode) {
    const dist = new Float64Array(N).fill(1e9), heap = [];
    const push = (v, i) => { heap.push([v, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let m = k; const l = 2 * k + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (const i of targets) { dist[i] = 0; push(0, i); }
    const ghost = mode === 'ghost';
    const extra = (i) => {
      let x = 0;
      const n = NAT_AT[i]; if (n && !this.cutSet.has(n - 1)) x += 3;
      if (ghost) return x;
      const b = this.blockAt(i, false);
      if (b) { if (mode === 'army') x += BUILD[b.type].gate ? 0 : 28; else if (b.type !== 'castello') x += 20 + b.hp / 1.5; }
      return x;
    };
    while (heap.length) {
      const [v, i] = pop();
      if (v > dist[i]) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc, nr = r + dr;
        if (!inMap(nc, nr) || TERRAIN[idx(nc, nr)]) continue;      // montagne, colline e laghi non si attraversano
        if (dc && dr && (TERRAIN[idx(nc, r)] || TERRAIN[idx(c, nr)])) continue;
        // in diagonale non si passa fra due edifici che si toccano per lo spigolo (stessa regola di stepEnemy)
        if (dc && dr && (mode === 'army' ? this.armyBlock(idx(nc, r)) || this.armyBlock(idx(c, nr)) : this.blockAt(idx(nc, r), ghost) || this.blockAt(idx(c, nr), ghost))) continue;
        const ni = idx(nc, nr), nv = v + (dc && dr ? 1.414 : 1) * STEP[ni] + extra(ni);      // sulle strade si va più svelti
        if (nv < dist[ni]) { dist[ni] = nv; push(nv, ni); }
      }
    }
    return dist;
  }
  fields() { this.dist = this.flow(CASTLE_CELLS, 'enemy'); this.distFree = this.flow(CASTLE_CELLS, 'ghost'); }

  // ---------- risorse ----------
  afford(cost, k = 1) { for (const r in cost) if ((this.d.res[r] || 0) < cost[r] * k) return false; return true; }
  pay(cost, k = 1) { for (const r in cost) this.d.res[r] -= cost[r] * k; }
  gain(got) { for (const r in got) this.d.res[r] = (this.d.res[r] || 0) + got[r]; }
  count(type) { let n = 0; for (const b of this.d.buildings) if (b.type === type) n++; return n; }
  towers() { let n = 0; for (const b of this.d.buildings) if (TOWERS[b.type]) n++; return n; }
  /** Quanti se ne possono avere: { have, max } (max = Infinity se non c'è limite). */
  cap(type) {
    const D = BUILD[type];
    if (D.tower) return { have: this.towers(), max: towerCap(this.d.castle) };
    if (D.cap) return { have: this.count(type), max: D.cap(this.d.castle) };
    return { have: this.count(type), max: Infinity };
  }
  popMax() { let p = 4; for (const b of this.d.buildings) p += BUILD[b.type].pop || 0; return p; }
  popUsed() { let p = 0; for (const b of this.d.buildings) p += b.units ? b.units.length : 0; return p; }

  // ---------- costruzione ----------
  /** 'ok' oppure il motivo: 'locked' | 'tech' | 'cap' | 'bounds' | 'village' | 'terrain' | 'occupied' | 'cost' */
  canPlace(type, c, r, free = false, extra = 0) {
    const D = BUILD[type];
    if (!D || !D.cost) return 'locked';
    if (D.min > this.d.castle) return 'locked';
    if (D.tech && !this.d.tech[D.tech]) return 'tech';
    const cp = this.cap(type);
    if (cp.have + extra >= cp.max) return 'cap';
    if (c < 2 || r < 2 || c + D.w > COLS - 2 || r + D.h > ROWS - 2) return 'bounds';
    for (let rr = r; rr < r + D.h; rr++) for (let cc = c; cc < c + D.w; cc++) {
      if (VIL_AT[idx(cc, rr)] >= 0) return 'village';
      if (TERRAIN[idx(cc, rr)]) return 'terrain';
      if (this.occ[idx(cc, rr)] !== 0 || this.natAt(cc, rr)) return 'occupied';
    }
    if (this.enemies.length) { const x0 = c * G, y0 = r * G, x1 = (c + D.w) * G, y1 = (r + D.h) * G; for (const e of this.enemies) if (e.x > x0 - 8 && e.x < x1 + 8 && e.y > y0 - 8 && e.y < y1 + 8) return 'occupied'; }
    return free || this.afford(D.cost) ? 'ok' : 'cost';
  }
  add(type, c, r) {
    const b = { id: this.d.nextId++, type, c, r, hp: this.maxHp({ type }) };
    this.d.buildings.push(b);
    return b;
  }
  place(type, c, r) {
    if (this.canPlace(type, c, r) !== 'ok') return null;
    this.pay(BUILD[type].cost);
    const b = this.add(type, c, r);
    this.rebuild(); this.track('build');
    this.events.push({ k: 'placed', x: b.x, y: b.y, type });
    return b;
  }
  /** Quadretti in fila da un punto all'altro (sempre attaccati lato a lato, così non restano spiragli). */
  lineCells(c0, r0, c1, r1) {
    const out = [{ c: c0, r: r0 }];
    let c = c0, r = r0, guard = 0;
    while ((c !== c1 || r !== r1) && guard++ < 200) {
      const dc = c1 - c, dr = r1 - r;
      if (Math.abs(dc) >= Math.abs(dr)) c += Math.sign(dc); else r += Math.sign(dr);
      out.push({ c, r });
    }
    return out;
  }
  /** Controllo di una fila: quali quadretti sono liberi e quanto costa in tutto. */
  lineCheck(type, cells) {
    const good = cells.filter(q => this.canPlace(type, q.c, q.r, true) === 'ok');
    const cost = {}; for (const k in BUILD[type].cost) cost[k] = BUILD[type].cost[k] * good.length;
    const locked = BUILD[type].min > this.d.castle;
    return { good, cost, ok: !locked && good.length > 0 && this.afford(cost), why: locked ? 'locked' : !good.length ? 'occupied' : this.afford(cost) ? 'ok' : 'cost' };
  }
  placeLine(type, cells) {
    const chk = this.lineCheck(type, cells);
    if (!chk.ok) return 0;
    this.pay(chk.cost);
    for (const q of chk.good) this.add(type, q.c, q.r);
    this.rebuild(); this.track('build', chk.good.length);
    const m = chk.good[chk.good.length >> 1];
    this.events.push({ k: 'placed', x: (m.c + 0.5) * G, y: (m.r + 0.5) * G, type });
    return chk.good.length;
  }
  refund(b) { const out = {}, cost = BUILD[b.type].cost || {}; for (const k in cost) out[k] = Math.floor(cost[k] * SELL_REFUND); return out; }
  demolish(b) {
    if (!b || b.type === 'castello' || !this.byId.has(b.id)) return false;
    this.gain(this.refund(b));
    this.remove(b);
    this.events.push({ k: 'demolished', x: b.x, y: b.y });
    return true;
  }
  remove(b) {
    this.d.buildings = this.d.buildings.filter(o => o !== b);
    for (const s of this.soldiers) if (s.home === b.id) s.dead = true;
    this.soldiers = this.soldiers.filter(s => !s.dead);
    this.rebuild();
  }

  // ---------- torri e castello ----------
  stats(b) { return TOWERS[b.type].levels[b.lvl || 0]; }
  /** Il danno di una torre, con le scoperte che la migliorano. */
  towerDmg(b) { const m = (b.type === 'arcieri' && this.d.tech.frecce) || (b.type === 'mago' && this.d.tech.lenti) ? 1.25 : 1; return Math.round(this.stats(b).dmg * m); }
  upgradeCost(b) { const L = TOWERS[b.type] && TOWERS[b.type].levels; return L && (b.lvl || 0) < L.length - 1 ? L[(b.lvl || 0) + 1].up : null; }
  upgrade(b) {
    const c = this.upgradeCost(b);
    if (c == null || this.d.res.monete < c) return false;
    this.d.res.monete -= c; b.lvl = (b.lvl || 0) + 1; this.rev++;
    this.events.push({ k: 'upgrade', x: b.x, y: b.y });
    return true;
  }
  /** 'ok' | 'max' | 'nights' | 'cost' */
  castleCheck() {
    const L = this.d.castle;
    if (L >= MAX_CASTLE) return 'max';
    const U = CASTLE_UP[L];
    if (this.d.night < U.nights) return 'nights';
    return this.afford(U.cost) ? 'ok' : 'cost';
  }
  upgradeCastle() {
    if (this.castleCheck() !== 'ok') return false;
    this.pay(CASTLE_UP[this.d.castle].cost);
    this.d.castle++; this.castle.hp = castleHp(this.d.castle); this.rev++;
    this.events.push({ k: 'upgrade', x: this.castle.x, y: this.castle.y, castle: true });
    return true;
  }

  // ---------- scoperte ----------
  /** 'ok' | 'done' | 'bottega' | 'castle' | 'needs' | 'cost' */
  techCheck(id) {
    const T = TECHS[id];
    if (!T) return 'needs';
    if (this.d.tech[id]) return 'done';
    if (!this.count('bottega')) return 'bottega';
    if ((T.min || 1) > this.d.castle) return 'castle';
    if (T.needs && !this.d.tech[T.needs]) return 'needs';
    return this.afford(T.cost) ? 'ok' : 'cost';
  }
  research(id) {
    if (this.techCheck(id) !== 'ok') return false;
    this.pay(TECHS[id].cost);
    this.learn(id);
    return true;
  }
  /** Una scoperta entra nel regno (dalla Bottega, o portata da un popolo conquistato). */
  learn(id) {
    if (!TECHS[id] || this.d.tech[id]) return false;
    this.d.tech[id] = 1;
    if (id === 'bastioni') for (const b of this.d.buildings) if (b.type === 'mura') b.hp = this.maxHp(b);
    this.rev++;
    this.events.push({ k: 'tech', id });
    return true;
  }

  // ---------- mercato ----------
  /** 'ok' | 'mercato' | 'tech' | 'cost' */
  buyCheck(res) {
    const T = TRADE[res];
    if (!T || !this.count('mercato')) return 'mercato';
    if (T.tech && !this.d.tech[T.tech]) return 'tech';
    return this.d.res.monete >= T.cost ? 'ok' : 'cost';
  }
  buy(res) {
    if (this.buyCheck(res) !== 'ok') return false;
    this.d.res.monete -= TRADE[res].cost; this.d.res[res] += TRADE[res].give;
    this.events.push({ k: 'bought', res, n: TRADE[res].give });
    return true;
  }

  // ---------- natura ----------
  chop(n) {
    if (!n || this.cutSet.has(n.id)) return 0;
    const C = CHOP[n.kind];
    if (C.tech && !this.d.tech[C.tech]) { this.events.push({ k: 'unknown', x: (n.c + 0.5) * G, y: (n.r + 0.5) * G, kind: n.kind }); return 0; }
    this.d.res[C.res] += C.gain;
    this.cutSet.add(n.id); this.d.cut.push(n.id);
    this.fields(); this.rev++; this.track('chop');
    this.events.push({ k: 'chop', x: (n.c + 0.5) * G, y: (n.r + 0.5) * G, kind: n.kind, gain: C.gain });
    return C.gain;
  }

  // ---------- campi ----------
  crop(b, now) {
    if (!b.crop) return { empty: true };
    const total = CROPS[b.crop.crop].secs * 1000, el = now - b.crop.at;
    return { crop: b.crop.crop, progress: Math.max(0, Math.min(1, el / total)), ripe: el >= total, left: Math.max(0, total - el) };
  }
  cropGain(crop) { return Math.round(CROPS[crop].gain * (this.d.tech.aratro ? 1.25 : 1)); }
  plant(b, crop, now) {
    if (b.type !== 'campo' || b.crop || !CROPS[crop] || this.d.res.monete < CROPS[crop].cost) return false;
    this.d.res.monete -= CROPS[crop].cost; b.crop = { crop, at: now }; this.rev++;
    return true;
  }
  harvest(b, now) {
    if (b.type !== 'campo' || !this.crop(b, now).ripe) return 0;
    const g = this.cropGain(b.crop.crop);
    this.d.res.monete += g; b.crop = null; this.rev++; this.track('harvest');
    return g;
  }

  // ---------- esercito ----------
  spawnSoldier(b, type, slot) {
    const U = UNITS[type];
    if (slot == null) { const used = new Set(this.soldiers.filter(s => s.home === b.id).map(s => s.slot)); slot = 0; while (used.has(slot)) slot++; }
    const hx = b.x - 39 + slot * 26, hy = b.y + G + 14;
    const s = { id: this.uid++, type, home: b.id, slot, x: hx, y: hy, hx, hy, hp: U.hp, maxHp: U.hp, cd: 0, target: null, anim: 0, ang: Math.PI / 2, hit: 0, strike: 0, raid: false, ox: ((slot * 37 + b.id * 11) % 25) - 12, oy: ((slot * 53 + b.id * 7) % 25) - 12 };
    this.soldiers.push(s);
    return s;
  }
  /** 'ok' | 'full' | 'castle' | 'tech' | 'pop' | 'busy' | 'cost' */
  trainCheck(b, type = 'lancia') {
    const U = UNITS[type];
    if (!U || b.type !== 'caserma') return 'full';
    if ((b.units || []).length >= CASERMA_SLOTS) return 'full';
    if ((U.min || 1) > this.d.castle) return 'castle';
    if (U.tech && !this.d.tech[U.tech]) return 'tech';
    if (this.popUsed() >= this.popMax()) return 'pop';
    if (this.status === 'raid') return 'busy';
    return this.afford(U.cost) ? 'ok' : 'cost';
  }
  train(b, type = 'lancia') {
    if (this.trainCheck(b, type) !== 'ok') return false;
    this.pay(UNITS[type].cost);
    (b.units = b.units || []).push(type);
    this.spawnSoldier(b, type); this.track('train');
    this.events.push({ k: 'train', x: b.x, y: b.y });
    return true;
  }
  walkable(x, y) {
    const c = Math.floor(x / G), r = Math.floor(y / G);
    if (!inMap(c, r) || TERRAIN[idx(c, r)]) return false;
    const id = this.occ[idx(c, r)];
    if (id <= 0) return true;
    const D = BUILD[this.byId.get(id).type];
    return !!(D.flat || D.gate);
  }
  /** Passo libero, senza ostacoli (le marce lunghe seguono una mappa delle distanze che già li evita). */
  moveFree(s, tx, ty, dt) {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const st = Math.min(d, UNITS[s.type].speed * dt);
    s.x += dx / d * st; s.y += dy / d * st;
    s.ang = Math.atan2(dy, dx); s.anim += dt * 6;
  }
  /** Passo che rispetta i tuoi edifici (di notte, nella mischia sotto casa). */
  moveSoldier(s, tx, ty, dt) {
    if (!this.walkable(s.x, s.y)) { this.moveFree(s, tx, ty, dt); return; }      // finito dentro un edificio: esce
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const st = Math.min(d, UNITS[s.type].speed * dt), nx = s.x + dx / d * st, ny = s.y + dy / d * st;
    if (this.walkable(nx, ny)) { s.x = nx; s.y = ny; }
    else if (this.walkable(nx, s.y)) s.x = nx;
    else if (this.walkable(s.x, ny)) s.y = ny;
    s.ang = Math.atan2(dy, dx); s.anim += dt * 6;
  }
  /** Un passo lungo una mappa delle distanze. Falso se si è già nel punto più basso. */
  march(s, F, dt) {
    const c = cellOf(s.x, COLS), r = cellOf(s.y, ROWS);
    let best = -1, bd = F[idx(c, r)];
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!inMap(nc, nr) || (dc && dr && (this.armyBlock(idx(nc, r)) || this.armyBlock(idx(c, nr)) || TERRAIN[idx(nc, r)] || TERRAIN[idx(c, nr)]))) continue;      // niente spigoli tagliati
      const v = F[idx(nc, nr)]; if (v < bd - 1e-4) { bd = v; best = idx(nc, nr); }
    }
    if (best < 0) return false;
    this.moveFree(s, (best % COLS + 0.5) * G + s.ox, (((best / COLS) | 0) + 0.5) * G + s.oy, dt);
    return true;
  }
  /** Colpisce un nemico, oppure la casa del capo del villaggio sotto assalto. */
  hit(t, dmg, kind = 'physical') { if (t.hall) this.hurtHall(dmg); else this.damage(t, dmg, kind); }
  /** Il soldato prova a colpire il bersaglio. Vero se è a tiro. */
  attack(s, t) {
    const U = UNITS[s.type], d = Math.sqrt(d2(s, t)), reach = U.range || 24 + (t.r || 0) * 0.6;
    if (d > reach) return false;
    s.ang = Math.atan2(t.y - s.y, t.x - s.x);
    if (s.cd <= 0) {
      s.cd = U.rate; s.strike = 0.2;
      const dmg = U.dmg * (this.d.tech.lame ? 1.25 : 1);
      if (U.range) { this.projs.push({ k: 'arrow', x: s.x, y: s.y, h: 30, d0: Math.max(1, d), tx: t.x, ty: t.y, target: t, speed: 520, dmg, kind: 'physical', ang: s.ang }); this.events.push({ k: 'shot', type: 'arcieri', x: s.x, y: s.y }); }
      else { this.hit(t, dmg); this.events.push({ k: 'slash', x: t.x, y: t.y }); }
    }
    return true;
  }
  armyStrength() { let hp = 0, n = 0; for (const s of this.soldiers) if (!s.dead) { hp += s.hp; n++; } return { n, hp }; }

  // ---------- villaggi ----------
  /** I villaggi che attaccano nella notte n: quelli non conquistati, a partire dalla loro prima notte. */
  attackers(n = this.nextNight) { const out = []; TRIBES.forEach((t, i) => { if (t.from <= n && this.d.villages[i].state === 'free') out.push(i); }); return out; }
  /** Quanto pesa l'attacco della notte n rispetto al pieno (meno villaggi liberi = attacco più leggero). */
  waveK(n = this.nextNight) { const exp = TRIBES.filter(t => t.from <= n).length, a = this.attackers(n).length; return a ? 0.55 + 0.45 * a / exp : 0; }
  village(i) {
    const T = TRIBES[i], v = this.d.villages[i];
    return {
      ...v, i, id: T.id, good: T.good, wants: T.wants, x: (T.c + 0.5) * G, y: (T.r + 0.5) * G, hp: villageHp(v.level), guards: villageGuards(v.level),
      loot: villageLoot(T, v.level), tribute: villageTribute(T, v.level), allyCost: allyCost(T, v.level), helpers: allyHelpers(v.level), trade: villageTrade(T),
      tradesLeft: Math.max(0, TRADES_PER_DAY - (v.trades || 0)),
      revoltIn: v.state === 'colony' ? Math.max(0, REVOLT_NIGHTS - (this.d.night - v.since)) : 0,
      allyLeft: v.state === 'ally' ? Math.max(0, v.until - this.d.night) : 0,
    };
  }
  allies() { let n = 0; for (const v of this.d.villages) if (v.state === 'ally') n++; return n; }
  /** Proporre (o rinnovare) un'alleanza: 'ok' | 'own' | 'allied' | 'busy' | 'castle' | 'max' | 'cost' */
  allyCheck(i) {
    const v = this.d.villages[i], T = TRIBES[i];
    if (!v || v.state === 'colony') return 'own';
    if (v.state === 'ally' && v.until - this.d.night > 2) return 'allied';      // si rinnova solo verso la fine
    if (this.status !== 'day') return 'busy';
    if (this.d.castle < Math.min(MAX_CASTLE, v.level)) return 'castle';         // un popolo forte non si allea con un villaggio piccolo
    if (v.state !== 'ally' && this.allies() >= MAX_ALLIES) return 'max';
    return this.afford(allyCost(T, v.level)) ? 'ok' : 'cost';
  }
  /** Alleanza: per qualche notte quel popolo non ti attacca, manda guerrieri a difenderti e scambia risorse. */
  ally(i) {
    if (this.allyCheck(i) !== 'ok') return false;
    const v = this.d.villages[i];
    this.pay(allyCost(TRIBES[i], v.level));
    v.until = (v.state === 'ally' ? v.until : this.d.night) + ALLY_NIGHTS; v.state = 'ally';
    this.rev++; this.track('ally');
    this.events.push({ k: 'allied', i, x: (TRIBES[i].c + 0.5) * G, y: (TRIBES[i].r + 0.5) * G });
    return true;
  }
  /** Rompere l'alleanza (per esempio per poterli attaccare). */
  breakAlly(i) {
    const v = this.d.villages[i];
    if (!v || v.state !== 'ally' || this.status !== 'day') return false;
    v.state = 'free'; v.until = 0; this.rev++;
    this.events.push({ k: 'allyEnd', i, broken: true });
    return true;
  }
  /** Scambio con un villaggio amico (alleato o colonia): 'ok' | 'foe' | 'busy' | 'done' | 'tech' | 'cost' */
  tradeCheck(i) {
    const v = this.d.villages[i], T = TRIBES[i];
    if (!v || v.state === 'free') return 'foe';
    if (this.status !== 'day') return 'busy';
    if ((v.trades || 0) >= TRADES_PER_DAY) return 'done';
    if ((T.good === 'ferro' || T.good === 'cristallo') && !this.d.tech[T.good]) return 'tech';      // un materiale va prima scoperto
    return this.afford(villageTrade(T).give) ? 'ok' : 'cost';
  }
  trade(i) {
    if (this.tradeCheck(i) !== 'ok') return false;
    const tr = villageTrade(TRIBES[i]), v = this.d.villages[i];
    this.pay(tr.give); this.gain(tr.get); v.trades = (v.trades || 0) + 1;
    this.events.push({ k: 'traded', i, get: tr.get, x: (TRIBES[i].c + 0.5) * G, y: (TRIBES[i].r + 0.5) * G });
    return true;
  }
  /** 'ok' | 'own' | 'ally' | 'busy' | 'noarmy' */
  raidCheck(i) {
    const v = this.d.villages[i];
    if (v && v.state === 'ally') return 'ally';
    if (!v || v.state !== 'free') return 'own';
    if (this.status !== 'day') return 'busy';
    return this.soldiers.some(s => !s.dead) ? 'ok' : 'noarmy';
  }
  /** Come si mette l'assalto, a occhio: 'low' (troppo deboli) | 'even' (sarà dura) | 'good'. */
  raidOdds(i) {
    const need = 330 * Math.pow(this.d.villages[i].level, 1.5), have = this.armyStrength().hp * (this.d.tech.lame ? 1.25 : 1);
    return have < need * 0.7 ? 'low' : have < need ? 'even' : 'good';
  }
  /** L'esercito parte all'assalto di un villaggio. */
  startRaid(i) {
    if (this.raidCheck(i) !== 'ok') return false;
    const T = TRIBES[i], L = this.d.villages[i].level, hp = villageHp(L);
    this.raid = { i, hall: true, x: (T.c + 0.5) * G, y: (T.r + 0.5) * G, r: 70, hp, maxHp: hp, level: L, t: 0, cd: 2, hitT: 0, dead: false };
    const g = villageGuards(L), list = [];
    for (const type in g) for (let k = 0; k < g[type]; k++) list.push(type);
    list.forEach((type, k) => {
      const a = k / list.length * Math.PI * 2 + 0.4, rad = 112 + (k % 3) * 22, def = ENEMIES[type];
      const e = this.mkEnemy(type, i, this.raid.x + Math.cos(a) * rad, this.raid.y + Math.sin(a) * rad, (def.boss ? 1 : 1.5) * (1 + 0.2 * (L - 1)), 1.5 * (1 + 0.1 * (L - 1)));
      e.guard = true; e.px = e.x; e.py = e.y; e.ang = a;
    });
    const cells = []; for (let r = T.r - 1; r <= T.r + 1; r++) for (let c = T.c - 1; c <= T.c + 1; c++) cells.push(idx(c, r));
    this.raidDist = this.flow(cells, 'army');
    this.status = 'raid';
    for (const s of this.soldiers) { s.raid = true; s.target = null; }
    this.events.push({ k: 'raidStart', i, x: this.raid.x, y: this.raid.y });
    return true;
  }
  hurtHall(dmg) {
    const R = this.raid;
    if (!R || R.dead) return;
    R.hp -= dmg; R.hitT = 0.2;
    this.events.push({ k: 'struck', x: R.x, y: R.y });
    if (R.hp <= 0) this.conquer();
  }
  conquer() {
    const R = this.raid, i = R.i, T = TRIBES[i], v = this.d.villages[i], loot = villageLoot(T, v.level);
    R.dead = true;
    v.state = 'colony'; v.since = this.d.night;
    this.gain(loot); this.track('conquer');
    this.events.push({ k: 'conquered', i, x: R.x, y: R.y, loot });
    if (TECHS[T.good]) this.learn(T.good);          // il popolo conquistato porta il suo materiale
    this.endRaid();
  }
  /** Richiama l'esercito: l'assalto è annullato, il villaggio si ripara. */
  retreat() { if (this.status !== 'raid') return false; this.events.push({ k: 'retreat', i: this.raid.i }); this.endRaid(); return true; }
  endRaid() {
    this.status = 'day'; this.enemies = []; this.projs = []; this.raid = null; this.raidDist = null;
    this.soldiers = this.soldiers.filter(s => !s.dead);
    for (const s of this.soldiers) { s.raid = false; s.target = null; s.hp = s.maxHp; }
    this.rev++;
  }
  /** Dopo una notte superata: le colonie contano i giorni e a un certo punto si ribellano; le alleanze scadono. */
  afterNight() {
    this.d.villages.forEach((v, i) => {
      v.trades = 0;
      if (v.state === 'ally' && this.d.night >= v.until) { v.state = 'free'; v.until = 0; this.events.push({ k: 'allyEnd', i }); return; }
      if (v.state !== 'colony' || this.d.night - v.since < REVOLT_NIGHTS) return;
      v.state = 'free'; v.level = Math.min(9, v.level + 1);
      this.events.push({ k: 'revolt', i, level: v.level });
    });
    this.rev++;
  }

  // ---------- notte ----------
  get nextNight() { return this.d.night + 1; }
  get remaining() { return this.queue.length + this.enemies.length; }
  startNight() {
    if (this.status !== 'day') return false;
    const n = this.nextNight, from = this.attackers(n);
    if (!from.length) {           // tutti i vicini sono colonie: nessuno attacca
      this.d.night++;
      const reward = 20 + 5 * this.d.night;
      this.d.res.monete += reward; this.track('nights');
      this.events.push({ k: 'quietNight', night: this.d.night, reward });
      this.afterNight();
      return true;
    }
    const q = [];
    let k = 0;
    for (const g of genWave(n, this.waveK(n))) for (let i = 0; i < g.n; i++) q.push({ t: (g.at || 0) + i * g.gap, type: g.t, tribe: from[(k++) % from.length] });
    q.sort((a, b) => a.t - b.t);
    for (const e of q) this.d.seen[e.type] = 1;
    this.queue = q; this.waveT = 0; this.status = 'night'; this.castleHit = false; this.nightKills = 0;
    // gli alleati mandano i loro guerrieri: si mettono attorno al castello e all'alba tornano a casa
    let slot = 0;
    this.d.villages.forEach((v, i) => {
      if (v.state !== 'ally') return;
      for (let j = 0; j < allyHelpers(v.level); j++, slot++) {
        const a = slot * 0.9 + 0.5, hx = this.castle.x + Math.cos(a) * 118, hy = this.castle.y + Math.sin(a) * 104, hp = Math.round(UNITS.lancia.hp * (1 + 0.2 * (v.level - 1)));
        this.soldiers.push({ id: this.uid++, type: 'lancia', ally: i, home: 0, slot, x: hx, y: hy, hx, hy, hp, maxHp: hp, cd: 0, target: null, anim: 0, ang: a, hit: 0, strike: 0, raid: false, ox: 0, oy: 0 });
      }
    });
    this.events.push({ k: 'nightStart', night: n });
    return true;
  }
  mkEnemy(type, tribe, x, y, hpK = 1, hitK = 1) {
    const def = ENEMIES[type], hp = Math.round(def.hp * hpK);
    const e = {
      id: this.uid++, type, tribe, hp, maxHp: hp, speed: def.speed * (0.94 + this.rng() * 0.12),
      reward: def.reward, hitDmg: def.hit * hitK, armor: def.armor, mres: def.mres, slowRes: def.slowRes, r: def.r,
      boss: !!def.boss, ghost: !!def.ghost, ox: (this.rng() - 0.5) * 18, oy: (this.rng() - 0.5) * 18, x, y,
      slowT: 0, slowF: 1, burnT: 0, burnDps: 0, hit: 0, anim: this.rng() * 10, ang: 0, atk: 0.4, foe: null, dead: false, striking: 0, guard: false,
    };
    this.enemies.push(e);
    return e;
  }
  /** Un nemico esce dal villaggio del suo popolo. */
  spawn(type, tribe) {
    const def = ENEMIES[type], n = this.nextNight, gt = TRIBES[tribe].gate;
    const e = this.mkEnemy(type, tribe, (gt.c + 0.5) * G + (this.rng() - 0.5) * 50, (gt.r + 0.5) * G + (this.rng() - 0.5) * 50, def.boss ? 1 + (hpMul(n) - 1) * 0.5 : hpMul(n));
    this.events.push({ k: 'spawn', x: e.x, y: e.y, boss: e.boss, tribe });
    return e;
  }
  /** Quanto manca al castello da dove si trova il nemico (serve alle torri per scegliere il più avanti). */
  progress(e) { return (e.ghost ? this.distFree : this.dist)[idx(cellOf(e.x, COLS), cellOf(e.y, ROWS))]; }

  damage(e, amount, kind, silent) {
    if (e.dead) return;
    e.hp -= amount * MULT[kind](e);
    if (!silent) e.hit = 0.12;
    if (e.hp <= 0) {
      e.dead = true; this.d.res.monete += e.reward; this.nightKills++; this.track('kills');
      this.events.push({ k: 'kill', x: e.x, y: e.y, reward: e.reward, type: e.type, boss: e.boss, tribe: e.tribe });
    }
  }
  splash(x, y, r, dmg, kind) {
    for (const e of this.enemies) { if (e.dead) continue; const rr = r + e.r; if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= rr * rr) this.damage(e, dmg, kind); }
  }
  applySlow(e, f, T) { const nf = 1 - f * (1 - e.slowRes); if (nf < e.slowF || e.slowT <= 0) e.slowF = nf; e.slowT = Math.max(e.slowT, T); }
  castSpell(x, y) {
    if (this.d.castle < 3 || this.status !== 'night' || this.spellCd > 0) return false;
    this.spellCd = 24;
    this.splash(x, y, 95, (60 + 40 * this.d.castle) * (this.d.tech.lenti ? 1.25 : 1), 'magic');
    this.events.push({ k: 'spell', x, y, r: 95 });
    return true;
  }
  hurtBuilding(b, dmg) {
    b.hp -= dmg; b.hitT = 0.2;
    if (b.type === 'castello') { this.castleHit = true; this.events.push({ k: 'castleHit', x: b.x, y: b.y }); if (b.hp <= 0) this.loseNight(); return; }
    if (b.hp <= 0) { this.events.push({ k: 'destroyed', x: b.x, y: b.y, type: b.type }); this.remove(b); }
    else this.events.push({ k: 'struck', x: b.x, y: b.y });
  }
  hurtSoldier(s, dmg) {
    s.hp -= dmg; s.hit = 0.15;
    if (s.hp <= 0 && !s.dead) {
      s.dead = true;
      const b = this.byId.get(s.home);
      if (b && b.units) { const k = b.units.indexOf(s.type); if (k >= 0) b.units.splice(k, 1); }
      this.events.push({ k: 'soldierDown', x: s.x, y: s.y });
    }
  }

  /** Un difensore del villaggio sotto assalto: va incontro al soldato più vicino, altrimenti torna al suo posto. */
  stepGuard(e, dt) {
    let s = e.foe;
    if (s && s.dead) s = e.foe = null;
    if (!s) { let bd = 340 * 340; for (const o of this.soldiers) { if (o.dead) continue; const dd = d2(e, o); if (dd < bd) { bd = dd; s = o; } } e.foe = s; }
    const tx = s ? s.x : e.px, ty = s ? s.y : e.py, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (s && d < 28 + e.r * 0.5) {
      e.ang = Math.atan2(dy, dx); e.atk -= dt;
      if (e.atk <= 0) { e.atk = 1; e.striking = 0.25; this.hurtSoldier(s, e.hitDmg); }
      return;
    }
    if (d < 3) return;
    const v = e.speed * e.slowF;
    e.x += dx / d * v * dt; e.y += dy / d * v * dt;
    e.ang = lerpAngle(e.ang, Math.atan2(dy, dx), Math.min(1, dt * 10));
    e.anim += dt * v * 0.085;
  }

  stepEnemy(e, dt) {
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
    if (e.hit > 0) e.hit -= dt;
    if (e.striking > 0) e.striking -= dt;
    if (e.burnT > 0) { e.burnT -= dt; this.damage(e, e.burnDps * dt, 'fire', true); if (e.dead) return; }
    if (e.guard) { this.stepGuard(e, dt); return; }
    // un soldato addosso? ci si ferma a combattere
    if (e.foe && (e.foe.dead || d2(e, e.foe) > 46 * 46)) e.foe = null;
    if (!e.foe) for (const s of this.soldiers) if (!s.dead && d2(e, s) < 34 * 34) { e.foe = s; break; }
    if (e.foe) { e.ang = Math.atan2(e.foe.y - e.y, e.foe.x - e.x); e.atk -= dt; if (e.atk <= 0) { e.atk = 1; e.striking = 0.25; this.hurtSoldier(e.foe, e.hitDmg); } return; }

    const c = cellOf(e.x, COLS), r = cellOf(e.y, ROWS);
    const F = e.ghost ? this.distFree : this.dist;
    let best = -1, bd = F[idx(c, r)];
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!inMap(nc, nr)) continue;
      // niente passaggi in diagonale fra due muri che si toccano per lo spigolo
      if (dc && dr && (this.blockAt(idx(c + dc, r), e.ghost) || this.blockAt(idx(c, r + dr), e.ghost) || TERRAIN[idx(c + dc, r)] || TERRAIN[idx(c, r + dr)])) continue;
      const v = F[idx(nc, nr)];
      if (v < bd - 1e-4) { bd = v; best = idx(nc, nr); }
    }
    if (best < 0) { best = idx(CASTLE.c + 1, CASTLE.r + 1); if (best === idx(c, r)) return; }
    const wall = this.blockAt(best, e.ghost);
    if (wall) {      // la strada è sbarrata: si colpisce l'edificio
      e.ang = Math.atan2(wall.y - e.y, wall.x - e.x);
      e.atk -= dt;
      if (e.atk <= 0) { e.atk = 1; e.striking = 0.25; this.hurtBuilding(wall, e.hitDmg); }
      return;
    }
    const tx = (best % COLS + 0.5) * G + e.ox, ty = (((best / COLS) | 0) + 0.5) * G + e.oy;
    const away = Math.hypot(e.x - this.castle.x, e.y - this.castle.y) > 15 * G;
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, v = e.speed * e.slowF * (away ? 2 : 1);
    e.x += dx / d * v * dt; e.y += dy / d * v * dt;
    e.ang = lerpAngle(e.ang, Math.atan2(dy, dx), Math.min(1, dt * 10));
    e.anim += dt * v * 0.085;
  }

  stepSoldier(s, dt) {
    if (s.hit > 0) s.hit -= dt;
    if (s.strike > 0) s.strike -= dt;
    s.cd -= dt;
    if (this.status === 'raid' && s.raid) {
      // all'assalto: prima i difensori vicini, poi la casa del capo
      let t = s.target;
      if (t && t.dead) t = null;
      if (!t || t.hall) { t = this.raid; let bd = 260 * 260; for (const e of this.enemies) { if (e.dead) continue; const dd = d2(e, s); if (dd < bd) { bd = dd; t = e; } } }
      s.target = t;
      if (this.attack(s, t)) return;
      if (t.hall && d2(s, t) > 150 * 150) { if (!this.march(s, this.raidDist, dt)) this.moveFree(s, t.x, t.y, dt); }
      else this.moveFree(s, t.x, t.y, dt);
      return;
    }
    if (this.status === 'night') {
      if (!s.target || s.target.dead) {
        s.target = null; let bd = GUARD_REACH * GUARD_REACH;
        for (const e of this.enemies) { if (e.dead) continue; const dd = (e.x - s.hx) * (e.x - s.hx) + (e.y - s.hy) * (e.y - s.hy); if (dd < bd) { bd = dd; s.target = e; } }
      }
      if (s.target) { if (!this.attack(s, s.target)) this.moveSoldier(s, s.target.x, s.target.y, dt); return; }
    }
    // si torna al proprio posto: da lontano seguendo la strada verso il castello
    const dh = (s.hx - s.x) * (s.hx - s.x) + (s.hy - s.y) * (s.hy - s.y);
    if (dh < 4) return;
    if (dh > 320 * 320 && this.march(s, this.dist, dt)) return;
    this.moveFree(s, s.hx, s.hy, dt);
  }

  stepTower(t, dt) {
    const s = this.stats(t), def = TOWERS[t.type], range = s.range, dmg = this.towerDmg(t);
    t.cd -= dt;
    if (t.fireAnim > 0) t.fireAnim -= dt;
    if (def.proj === 'burn' || def.proj === 'pulse') {
      if (t.cd > 0) return;
      let any = false;
      for (const e of this.enemies) {
        if (e.dead || d2(e, t) > range * range) continue;
        any = true;
        if (def.proj === 'burn') { if (e.burnT <= 0 || dmg >= e.burnDps) e.burnDps = dmg; e.burnT = s.burnT; }
        else { this.applySlow(e, s.slow, s.slowT); if (dmg) this.damage(e, dmg, 'magic'); }
      }
      t.cd = any ? s.rate : 0.15; t.burning = any && def.proj === 'burn';
      if (any) { if (def.proj === 'pulse') { t.fireAnim = 0.5; this.events.push({ k: 'pulse', x: t.x, y: t.y, r: range }); } else this.events.push({ k: 'burn', x: t.x, y: t.y }); }
      return;
    }
    let best = null, bp = 1e9;
    const R2 = range * range, m2 = def.minRange ? def.minRange * def.minRange : 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dd = d2(e, t);
      if (dd > R2 || dd < m2) continue;
      const p = this.progress(e);
      if (p < bp) { bp = p; best = e; }
    }
    if (!best) return;
    t.angle = lerpAngle(t.angle, Math.atan2(best.y - t.y, best.x - t.x), Math.min(1, dt * 14));
    if (t.cd > 0) return;
    t.cd = s.rate; t.fireAnim = def.proj === 'boulder' ? 0.45 : 0.18;
    const dist = Math.sqrt(d2(best, t));
    if (def.proj === 'boulder') {
      const T = Math.max(0.55, Math.min(1.15, dist / 260));
      const lx = best.x + Math.cos(best.ang) * best.speed * best.slowF * T * 0.8, ly = best.y + Math.sin(best.ang) * best.speed * best.slowF * T * 0.8;
      this.projs.push({ k: 'boulder', x: t.x, y: t.y, h: 40, x0: t.x, y0: t.y, x1: lx, y1: ly, t: 0, T, dmg, kind: def.kind, splash: s.splash });
    } else {
      this.projs.push({ k: def.proj, x: t.x, y: t.y, h: 60, d0: Math.max(1, dist), tx: best.x, ty: best.y, target: best, speed: def.proj === 'arrow' ? 560 : 330, dmg, kind: def.kind, splash: s.splash, ang: t.angle });
    }
    this.events.push({ k: 'shot', type: t.type, x: t.x, y: t.y });
  }

  stepProj(p, dt) {
    if (p.k === 'boulder') {
      p.t += dt;
      const u = Math.min(1, p.t / p.T);
      p.x = p.x0 + (p.x1 - p.x0) * u; p.y = p.y0 + (p.y1 - p.y0) * u; p.h = 40 * (1 - u) + Math.sin(u * Math.PI) * 90;
      if (u >= 1) { p.dead = true; this.splash(p.x1, p.y1, p.splash, p.dmg, p.kind); this.events.push({ k: 'impact', x: p.x1, y: p.y1, r: p.splash }); }
      return;
    }
    if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), step = p.speed * dt;
    p.ang = Math.atan2(dy, dx); p.h = 18 + 42 * Math.min(1, dist / p.d0);
    if (dist <= step + 4) {
      p.dead = true;
      if (p.k === 'orb') { this.splash(p.tx, p.ty, p.splash, p.dmg, p.kind); this.events.push({ k: 'burst', x: p.tx, y: p.ty, r: p.splash }); }
      else if (p.target && !p.target.dead) { this.events.push({ k: 'hit', x: p.tx, y: p.ty }); this.hit(p.target, p.dmg, p.kind); }
      return;
    }
    p.x += dx / dist * step; p.y += dy / dist * step;
  }

  /** Produzione al minuto: edifici più i tributi delle colonie. */
  production() {
    const out = {}; for (const k in START) out[k] = 0;
    for (const b of this.d.buildings) { const p = BUILD[b.type].prod; if (p) for (const k in p) out[k] += p[k]; }
    this.d.villages.forEach((v, i) => { if (v.state === 'colony') { const tr = villageTribute(TRIBES[i], v.level); for (const k in tr) out[k] += tr[k]; } });
    return out;
  }

  update(dt, now = Date.now()) {
    const prod = this.production();
    for (const k in prod) this.d.res[k] += prod[k] * dt / 60;
    if (this.spellCd > 0) this.spellCd = Math.max(0, this.spellCd - dt);
    this.d.lastSeen = now;
    for (const b of this.d.buildings) if (b.hitT > 0) b.hitT -= dt;
    const st = this.status;

    if (st === 'night') {
      this.waveT += dt;
      while (this.queue.length && this.queue[0].t <= this.waveT) { const q = this.queue.shift(); this.spawn(q.type, q.tribe); }
    }
    if (st !== 'day') {
      for (const e of this.enemies) { if (!e.dead) this.stepEnemy(e, dt); if (this.status !== st) return; }
      if (st === 'night') for (const b of this.d.buildings) if (TOWERS[b.type]) this.stepTower(b, dt);
      for (const p of this.projs) { this.stepProj(p, dt); if (this.status !== st) return; }
      this.enemies = this.enemies.filter(e => !e.dead);
      this.projs = this.projs.filter(p => !p.dead);
    }
    for (const s of this.soldiers) { if (!s.dead) this.stepSoldier(s, dt); if (this.status !== st) return; }
    this.soldiers = this.soldiers.filter(s => !s.dead);

    if (st === 'raid') {
      const R = this.raid;
      R.t += dt; R.cd -= dt;
      if (R.hitT > 0) R.hitT -= dt;
      if (R.cd <= 0) {            // dalla casa del capo tirano sassi sul soldato più vicino
        R.cd = 1.5;
        let t = null, bd = 230 * 230;
        for (const s of this.soldiers) { const dd = d2(s, R); if (dd < bd) { bd = dd; t = s; } }
        if (t) { this.events.push({ k: 'hallShot', x: R.x, y: R.y, tx: t.x, ty: t.y }); this.hurtSoldier(t, 6 + 3 * R.level); this.soldiers = this.soldiers.filter(s => !s.dead); }
      }
      if (!this.soldiers.some(s => s.raid)) { this.events.push({ k: 'raidLost', i: R.i }); this.endRaid(); }
      else if (R.t > RAID_MAX) this.retreat();
    }
    if (this.status === 'night' && !this.queue.length && !this.enemies.length) this.winNight();
  }

  dawn() {
    this.status = 'day'; this.enemies = []; this.projs = []; this.queue = [];
    this.soldiers = this.soldiers.filter(s => s.ally == null);
    for (const b of this.d.buildings) { b.hp = this.maxHp(b); b.burning = false; }
    for (const s of this.soldiers) { s.hp = s.maxHp; s.target = null; }
    this.fields(); this.rev++;
  }
  winNight() {
    this.d.night++;
    const reward = 40 + 12 * this.d.night;
    this.d.res.monete += reward; this.track('nights');
    const perfect = !this.castleHit;
    this.dawn();
    this.events.push({ k: 'nightWon', night: this.d.night, reward, perfect, kills: this.nightKills });
    this.afterNight();
  }
  loseNight() {
    const penalty = Math.floor(this.d.res.monete * 0.25);
    this.d.res.monete -= penalty;
    this.dawn();
    this.events.push({ k: 'nightLost', penalty, night: this.nextNight });
  }

  /** Quello che il regno ha prodotto mentre il gioco era chiuso (metà resa, al massimo 2 ore). */
  offline(now) {
    const el = Math.min(AWAY_CAP, now - (this.d.lastSeen || now));
    this.d.lastSeen = now;
    if (el < 60000) return;
    const prod = this.production(), got = {};
    let any = false;
    for (const k in prod) { const g = Math.floor(prod[k] * el / 60000 * 0.5); if (g > 0) { this.d.res[k] += g; got[k] = g; any = true; } }
    if (any) this.away = { got, mins: Math.round(el / 60000) };
  }

  // ---------- missioni ----------
  quest(slot) {
    const q = this.d.quests[slot], seq = QUEST_SLOTS[slot], type = seq[q.n % seq.length], D = QUESTS[type], tier = Math.floor(q.n / seq.length);
    const goal = D.goal + D.inc * tier;
    return { type, goal, progress: Math.min(goal, q.p), reward: D.reward + 10 * tier, ready: q.p >= goal };
  }
  track(type, amount = 1) { this.d.quests.forEach((q, i) => { if (this.quest(i).type === type) q.p += amount; }); }
  questsReady() { return this.d.quests.filter((_, i) => this.quest(i).ready).length; }
  claimQuest(slot) {
    const q = this.quest(slot);
    if (!q.ready) return 0;
    this.d.res.monete += q.reward;
    this.d.quests[slot] = { n: this.d.quests[slot].n + 1, p: 0 };
    return q.reward;
  }

  // ---------- dono del giorno ----------
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
    this.d.res.monete += dly.amount;
    return dly.amount;
  }
}

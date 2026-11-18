// Il regno: regole pure (niente disegno, niente DOM). Griglia, costruzione libera, risorse, colture,
// notti con i nemici che cercano la strada verso il castello, torri, soldati, missioni.
import {
  G, COLS, ROWS, CASTLE, START, SELL_REFUND, portalsFor, BUILD, towerCap, SOLDIER, CASTLE_UP, MAX_CASTLE,
  castleHp, TOWERS, ENEMIES, CROPS, genWave, hpMul, NATURE, CHOP, mulberry32,
} from './data.js';

const N = COLS * ROWS, DAY = 86400000, AWAY_CAP = 2 * 3600 * 1000;
const DAILY = [50, 75, 100, 125, 150, 200, 300];
export const QUEST_SLOTS = [['kills', 'nights'], ['harvest', 'build'], ['chop', 'train']];
const QUESTS = {
  kills: { goal: 30, inc: 20, reward: 50 }, nights: { goal: 3, inc: 2, reward: 80 },
  harvest: { goal: 4, inc: 2, reward: 40 }, build: { goal: 5, inc: 3, reward: 50 },
  chop: { goal: 8, inc: 4, reward: 40 }, train: { goal: 2, inc: 1, reward: 50 },
};
const MULT = { physical: (e) => 1 - e.armor, magic: (e) => 1 - e.mres, fire: (e) => 1 - e.mres * 0.5 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const idx = (c, r) => r * COLS + c;
const inMap = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

const NAT_AT = new Int32Array(N);       // id+1 dell'elemento di natura su quel quadretto (0 = niente)
for (const n of NATURE) NAT_AT[idx(n.c, n.r)] = n.id + 1;

function fresh(now) {
  return {
    v: 3, res: { ...START }, castle: 1, night: 0, nextId: 2,
    buildings: [{ id: 1, type: 'castello', c: CASTLE.c, r: CASTLE.r, hp: castleHp(1) }],
    cut: [], quests: QUEST_SLOTS.map(() => ({ n: 0, p: 0 })), seen: {}, dailyDay: 0, streak: 0, lastSeen: now,
  };
}

export class World {
  constructor(data, now = Date.now(), seed = 1) {
    const d = fresh(now);
    if (data && data.v === 3 && Array.isArray(data.buildings) && data.buildings.some(b => b.type === 'castello')) {
      Object.assign(d.res, data.res || {});
      d.castle = Math.max(1, Math.min(MAX_CASTLE, data.castle || 1)); d.night = data.night || 0; d.nextId = data.nextId || 2;
      d.buildings = data.buildings.filter(b => BUILD[b.type]).map(b => ({ ...b }));
      d.cut = Array.isArray(data.cut) ? data.cut.slice() : [];
      if (Array.isArray(data.quests)) data.quests.forEach((q, i) => { if (d.quests[i] && q) d.quests[i] = { n: q.n || 0, p: q.p || 0 }; });
      Object.assign(d.seen, data.seen || {});
      d.dailyDay = data.dailyDay || 0; d.streak = data.streak || 0; d.lastSeen = data.lastSeen || now;
    }
    this.d = d;
    this.rng = mulberry32(seed);
    this.status = 'day';                 // day | night
    this.enemies = []; this.projs = []; this.soldiers = []; this.queue = []; this.events = [];
    this.waveT = 0; this.spellCd = 0; this.uid = 1; this.rev = 0; this.away = null; this.castleHit = false; this.nightKills = 0;
    this.cutSet = new Set(d.cut);
    this.rebuild();
    for (const b of d.buildings) b.hp = this.maxHp(b);      // si riparte sempre di giorno, con tutto riparato
    this.fields();
    for (const b of d.buildings) if (b.type === 'caserma') { const n = b.sold || 0; b.sold = 0; for (let i = 0; i < n; i++) { b.sold++; this.spawnSoldier(b); } }
    this.offline(now);
  }

  toJSON() {
    const keep = ({ id, type, c, r, hp, lvl, crop, sold }) => { const o = { id, type, c, r, hp: Math.round(hp) }; if (lvl) o.lvl = lvl; if (crop) o.crop = crop; if (sold) o.sold = sold; return o; };
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
  maxHp(b) { return b.type === 'castello' ? castleHp(this.d.castle) : BUILD[b.type].hp; }
  /** L'edificio che sbarra quel quadretto a un nemico (gli spettri attraversano tutto tranne il castello). */
  blockAt(i, ghost) {
    const id = this.occ[i];
    if (id <= 0) return null;
    const b = this.byId.get(id);
    if (!b || BUILD[b.type].flat) return null;
    return ghost && b.type !== 'castello' ? null : b;
  }

  /** Mappa delle distanze dal castello: i nemici scendono sempre verso il valore più basso.
   *  Passare da un quadretto con un edificio "costa" in base a quanto è robusto: se c'è un varco ci girano
   *  attorno, altrimenti puntano al muro più debole e lo sfondano. */
  fields() {
    const run = (walls) => {
      const dist = new Float64Array(N).fill(1e9), heap = [];
      const push = (v, i) => { heap.push([v, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let m = k; const l = 2 * k + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      for (let r = CASTLE.r; r < CASTLE.r + CASTLE.h; r++) for (let c = CASTLE.c; c < CASTLE.c + CASTLE.w; c++) { dist[idx(c, r)] = 0; push(0, idx(c, r)); }
      const extra = (i) => {
        let x = 0;
        const n = NAT_AT[i]; if (n && !this.cutSet.has(n - 1)) x += 2;
        if (walls) { const b = this.blockAt(i, false); if (b && b.type !== 'castello') x += 10 + b.hp / 3; }
        return x;
      };
      while (heap.length) {
        const [v, i] = pop();
        if (v > dist[i]) continue;
        const c = i % COLS, r = (i / COLS) | 0;
        for (const [dc, dr] of DIRS) {
          const nc = c + dc, nr = r + dr;
          if (!inMap(nc, nr)) continue;
          // in diagonale non si passa fra due edifici che si toccano per lo spigolo (stessa regola di stepEnemy)
          if (dc && dr && (this.blockAt(idx(nc, r), !walls) || this.blockAt(idx(c, nr), !walls))) continue;
          const ni = idx(nc, nr), nv = v + (dc && dr ? 1.414 : 1) + extra(ni);
          if (nv < dist[ni]) { dist[ni] = nv; push(nv, ni); }
        }
      }
      return dist;
    };
    this.dist = run(true);
    this.distFree = run(false);
  }

  // ---------- risorse ----------
  afford(cost, k = 1) { for (const r in cost) if ((this.d.res[r] || 0) < cost[r] * k) return false; return true; }
  pay(cost, k = 1) { for (const r in cost) this.d.res[r] -= cost[r] * k; }
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
  popUsed() { let p = 0; for (const b of this.d.buildings) p += b.sold || 0; return p; }

  // ---------- costruzione ----------
  /** 'ok' oppure il motivo: 'locked' | 'cap' | 'bounds' | 'occupied' | 'cost' */
  canPlace(type, c, r, free = false, extra = 0) {
    const D = BUILD[type];
    if (!D || !D.cost) return 'locked';
    if (D.min > this.d.castle) return 'locked';
    const cp = this.cap(type);
    if (cp.have + extra >= cp.max) return 'cap';
    if (c < 2 || r < 2 || c + D.w > COLS - 2 || r + D.h > ROWS - 2) return 'bounds';
    for (let rr = r; rr < r + D.h; rr++) for (let cc = c; cc < c + D.w; cc++) {
      if (this.occ[idx(cc, rr)] !== 0 || this.natAt(cc, rr)) return 'occupied';
    }
    if (this.enemies.length) { const x0 = c * G, y0 = r * G, x1 = (c + D.w) * G, y1 = (r + D.h) * G; for (const e of this.enemies) if (e.x > x0 - 8 && e.x < x1 + 8 && e.y > y0 - 8 && e.y < y1 + 8) return 'occupied'; }
    return free || this.afford(D.cost) ? 'ok' : 'cost';
  }
  add(type, c, r) {
    const b = { id: this.d.nextId++, type, c, r, hp: BUILD[type].hp };
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
    const back = this.refund(b);
    for (const k in back) this.d.res[k] += back[k];
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

  // ---------- natura ----------
  chop(n) {
    if (!n || this.cutSet.has(n.id)) return 0;
    const C = CHOP[n.kind];
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
  plant(b, crop, now) {
    if (b.type !== 'campo' || b.crop || !CROPS[crop] || this.d.res.monete < CROPS[crop].cost) return false;
    this.d.res.monete -= CROPS[crop].cost; b.crop = { crop, at: now }; this.rev++;
    return true;
  }
  harvest(b, now) {
    if (b.type !== 'campo' || !this.crop(b, now).ripe) return 0;
    const g = CROPS[b.crop.crop].gain;
    this.d.res.monete += g; b.crop = null; this.rev++; this.track('harvest');
    return g;
  }

  // ---------- soldati ----------
  spawnSoldier(b) {
    const i = this.soldiers.filter(s => s.home === b.id).length;
    const hx = b.x - 26 + i * 26, hy = b.y + G + 14;
    this.soldiers.push({ id: this.uid++, home: b.id, slot: i, x: hx, y: hy, hx, hy, hp: SOLDIER.hp, cd: 0, target: null, anim: 0, ang: Math.PI / 2, hit: 0 });
  }
  /** 'ok' | 'full' | 'pop' | 'cost' */
  trainCheck(b) {
    if ((b.sold || 0) >= BUILD.caserma.soldiers) return 'full';
    if (this.popUsed() >= this.popMax()) return 'pop';
    return this.d.res.monete >= SOLDIER.cost ? 'ok' : 'cost';
  }
  train(b) {
    if (b.type !== 'caserma' || this.trainCheck(b) !== 'ok') return false;
    this.d.res.monete -= SOLDIER.cost; b.sold = (b.sold || 0) + 1;
    this.spawnSoldier(b); this.track('train');
    this.events.push({ k: 'train', x: b.x, y: b.y });
    return true;
  }
  walkable(x, y) {
    const c = Math.floor(x / G), r = Math.floor(y / G);
    if (!inMap(c, r)) return false;
    const id = this.occ[idx(c, r)];
    if (id <= 0) return true;
    const D = BUILD[this.byId.get(id).type];
    return !!(D.flat || D.gate);
  }
  moveSoldier(s, tx, ty, dt) {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d < 2) return;
    const st = Math.min(d, SOLDIER.speed * dt), nx = s.x + dx / d * st, ny = s.y + dy / d * st;
    if (this.walkable(nx, ny)) { s.x = nx; s.y = ny; }
    else if (this.walkable(nx, s.y)) s.x = nx;
    else if (this.walkable(s.x, ny)) s.y = ny;
    s.ang = Math.atan2(dy, dx); s.anim += dt * 6;
  }

  // ---------- notte ----------
  get nextNight() { return this.d.night + 1; }
  get remaining() { return this.queue.length + this.enemies.length; }
  startNight() {
    if (this.status !== 'day') return false;
    const n = this.nextNight, ports = portalsFor(n), q = [];
    let k = 0;
    for (const g of genWave(n)) for (let i = 0; i < g.n; i++) q.push({ t: (g.at || 0) + i * g.gap, type: g.t, port: ports[(k++) % ports.length] });
    q.sort((a, b) => a.t - b.t);
    for (const e of q) this.d.seen[e.type] = 1;
    this.queue = q; this.waveT = 0; this.status = 'night'; this.castleHit = false; this.nightKills = 0;
    this.events.push({ k: 'nightStart', night: n });
    return true;
  }
  spawn(type, port) {
    const def = ENEMIES[type], n = this.nextNight;
    const hp = Math.round(def.hp * (def.boss ? 1 + (hpMul(n) - 1) * 0.5 : hpMul(n)));
    const e = {
      id: this.uid++, type, hp, maxHp: hp, speed: def.speed * (0.94 + this.rng() * 0.12),
      reward: def.reward, hitDmg: def.hit, armor: def.armor, mres: def.mres, slowRes: def.slowRes, r: def.r,
      boss: !!def.boss, ghost: !!def.ghost, ox: (this.rng() - 0.5) * 18, oy: (this.rng() - 0.5) * 18,
      x: (port.c + 0.5) * G + (this.rng() - 0.5) * 30, y: (port.r + 0.5) * G + (this.rng() - 0.5) * 30,
      slowT: 0, slowF: 1, burnT: 0, burnDps: 0, hit: 0, anim: this.rng() * 10, ang: 0, atk: 0.4, foe: null, dead: false, striking: 0,
    };
    this.enemies.push(e);
    this.events.push({ k: 'spawn', x: e.x, y: e.y, boss: e.boss });
  }
  /** Quanto manca al castello da dove si trova il nemico (serve alle torri per scegliere il più avanti). */
  progress(e) { const c = Math.max(0, Math.min(COLS - 1, Math.floor(e.x / G))), r = Math.max(0, Math.min(ROWS - 1, Math.floor(e.y / G))); return (e.ghost ? this.distFree : this.dist)[idx(c, r)]; }

  damage(e, amount, kind, silent) {
    if (e.dead) return;
    e.hp -= amount * MULT[kind](e);
    if (!silent) e.hit = 0.12;
    if (e.hp <= 0) {
      e.dead = true; this.d.res.monete += e.reward; this.nightKills++; this.track('kills');
      this.events.push({ k: 'kill', x: e.x, y: e.y, reward: e.reward, type: e.type, boss: e.boss });
    }
  }
  splash(x, y, r, dmg, kind) {
    for (const e of this.enemies) { if (e.dead) continue; const rr = r + e.r; if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= rr * rr) this.damage(e, dmg, kind); }
  }
  applySlow(e, f, T) { const nf = 1 - f * (1 - e.slowRes); if (nf < e.slowF || e.slowT <= 0) e.slowF = nf; e.slowT = Math.max(e.slowT, T); }
  castSpell(x, y) {
    if (this.d.castle < 3 || this.status !== 'night' || this.spellCd > 0) return false;
    this.spellCd = 24;
    this.splash(x, y, 95, 60 + 40 * this.d.castle, 'magic');
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
    if (s.hp <= 0 && !s.dead) { s.dead = true; const b = this.byId.get(s.home); if (b) b.sold = Math.max(0, (b.sold || 0) - 1); this.events.push({ k: 'soldierDown', x: s.x, y: s.y }); }
  }

  stepEnemy(e, dt) {
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
    if (e.hit > 0) e.hit -= dt;
    if (e.striking > 0) e.striking -= dt;
    if (e.burnT > 0) { e.burnT -= dt; this.damage(e, e.burnDps * dt, 'fire', true); if (e.dead) return; }
    // un soldato addosso? ci si ferma a combattere
    if (e.foe && (e.foe.dead || d2(e, e.foe) > 46 * 46)) e.foe = null;
    if (!e.foe) for (const s of this.soldiers) if (!s.dead && d2(e, s) < 34 * 34) { e.foe = s; break; }
    if (e.foe) { e.ang = Math.atan2(e.foe.y - e.y, e.foe.x - e.x); e.atk -= dt; if (e.atk <= 0) { e.atk = 1; e.striking = 0.25; this.hurtSoldier(e.foe, e.hitDmg); } return; }

    const c = Math.max(0, Math.min(COLS - 1, Math.floor(e.x / G))), r = Math.max(0, Math.min(ROWS - 1, Math.floor(e.y / G)));
    const F = e.ghost ? this.distFree : this.dist;
    let best = -1, bd = F[idx(c, r)];
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (!inMap(nc, nr)) continue;
      // niente passaggi in diagonale fra due muri che si toccano per lo spigolo
      if (dc && dr && (this.blockAt(idx(c + dc, r), e.ghost) || this.blockAt(idx(c, r + dr), e.ghost))) continue;
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
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, v = e.speed * e.slowF;
    e.x += dx / d * v * dt; e.y += dy / d * v * dt;
    e.ang = lerpAngle(e.ang, Math.atan2(dy, dx), Math.min(1, dt * 10));
    e.anim += dt * v * 0.085;
  }

  stepSoldier(s, dt) {
    if (s.hit > 0) s.hit -= dt;
    s.cd -= dt;
    if (this.status === 'night') {
      if (!s.target || s.target.dead) {
        s.target = null; let bd = SOLDIER.reach * SOLDIER.reach;
        for (const e of this.enemies) { if (e.dead) continue; const dd = (e.x - s.hx) * (e.x - s.hx) + (e.y - s.hy) * (e.y - s.hy); if (dd < bd) { bd = dd; s.target = e; } }
      }
      if (s.target) {
        const t = s.target, d = Math.sqrt(d2(s, t));
        if (d <= 24 + t.r * 0.6) { s.ang = Math.atan2(t.y - s.y, t.x - s.x); if (s.cd <= 0) { s.cd = SOLDIER.rate; s.strike = 0.2; this.damage(t, SOLDIER.dmg, 'physical'); this.events.push({ k: 'slash', x: t.x, y: t.y }); } }
        else this.moveSoldier(s, t.x, t.y, dt);
        if (s.strike > 0) s.strike -= dt;
        return;
      }
    }
    if (s.strike > 0) s.strike -= dt;
    this.moveSoldier(s, s.hx, s.hy, dt);
  }

  stepTower(t, dt) {
    const s = this.stats(t), def = TOWERS[t.type], range = s.range, dmg = s.dmg;
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
      else if (p.target && !p.target.dead) { this.damage(p.target, p.dmg, p.kind); this.events.push({ k: 'hit', x: p.tx, y: p.ty }); }
      return;
    }
    p.x += dx / dist * step; p.y += dy / dist * step;
  }

  /** Produzione al minuto di tutti gli edifici: { monete, legna, pietra }. */
  production() { const out = { monete: 0, legna: 0, pietra: 0 }; for (const b of this.d.buildings) { const p = BUILD[b.type].prod; if (p) for (const k in p) out[k] += p[k]; } return out; }

  update(dt, now = Date.now()) {
    const prod = this.production();
    for (const k in prod) this.d.res[k] += prod[k] * dt / 60;
    if (this.spellCd > 0) this.spellCd = Math.max(0, this.spellCd - dt);
    this.d.lastSeen = now;
    for (const b of this.d.buildings) if (b.hitT > 0) b.hitT -= dt;

    if (this.status === 'night') {
      this.waveT += dt;
      while (this.queue.length && this.queue[0].t <= this.waveT) { const q = this.queue.shift(); this.spawn(q.type, q.port); }
      for (const e of this.enemies) { if (!e.dead) this.stepEnemy(e, dt); if (this.status !== 'night') return; }
      for (const b of this.d.buildings) if (TOWERS[b.type]) this.stepTower(b, dt);
      for (const p of this.projs) this.stepProj(p, dt);
      this.enemies = this.enemies.filter(e => !e.dead);
      this.projs = this.projs.filter(p => !p.dead);
    }
    for (const s of this.soldiers) if (!s.dead) this.stepSoldier(s, dt);
    this.soldiers = this.soldiers.filter(s => !s.dead);

    if (this.status === 'night' && !this.queue.length && !this.enemies.length) this.winNight();
  }

  dawn() {
    this.status = 'day'; this.enemies = []; this.projs = []; this.queue = [];
    for (const b of this.d.buildings) { b.hp = this.maxHp(b); b.burning = false; }
    for (const s of this.soldiers) { s.hp = SOLDIER.hp; s.target = null; }
    this.fields(); this.rev++;
  }
  winNight() {
    this.d.night++;
    const reward = 40 + 12 * this.d.night;
    this.d.res.monete += reward; this.track('nights');
    const perfect = !this.castleHit;
    this.dawn();
    this.events.push({ k: 'nightWon', night: this.d.night, reward, perfect, kills: this.nightKills });
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

// Le regole del secondo giro di tappe: spedizioni lunghe, edifici a livelli, cibo, popoli con carattere, diplomazia,
// assedi, eroe più ricco, acqua, trofei e sfida del giorno. Logica pura, come world.js: extend(World) le aggiunge alla classe.
import {
  G, COLS, ROWS, BUILD, TRIBES, TERRAIN, RUINS, FOG, UNITS, HERO, HERO_ITEMS, ISLAND, LEVELS, LEVEL_MIN, FOOD, specials, siegeCount,
  REL, giftCost, ROAD_AT, ROAD_SPEED, SELL, PVP_UNIT, PVP_TOWER, MY_COLOR, TROPHIES, CHALLENGES, CHALLENGE_REWARD, CHAPTERS, CASERMA_SLOTS, genWave, DIFFS, allyCost, ALLY_NIGHTS, levelK,
} from './data.js';

const HOUR = 3600000, DAY = 86400000;
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ISLE = RUINS.find(R => R.island);

export function extend(World) {
  const RULES = () => World.RULES;
  Object.assign(World.prototype, {
    // ---------- spedizioni: l'esploratore parte dal castello e ci mette ore vere ----------
    tripsMax() { return 2 + (this.d.castle >= 4 ? 1 : 0); },
    /** Vero se quel punto sta sull'isola (o nel suo lago): ci si arriva solo in barca. */
    islandTrip(x, y) { return Math.hypot(x / G - ISLAND.c - 0.5, y / G - ISLAND.r - 0.5) < 3.2; },
    /** Quanto dura una spedizione fin lì, in millisecondi veri: da 6 a 10 ore secondo la distanza (in barca, 2 ore). */
    tripMs(x, y) {
      if (this.islandTrip(x, y)) return FOG.boatH * HOUR;
      const d = Math.hypot(x - this.castle.x, y - this.castle.y) / G;
      return Math.round((FOG.hMin + (FOG.hMax - FOG.hMin) * clamp01((d - FOG.start) / 75)) * HOUR);
    },
    /** 'ok' | 'full' | 'port' | 'cost' */
    scoutCheck(x, y) {
      if (this.d.trips.length >= this.tripsMax()) return 'full';
      if (x != null && this.islandTrip(x, y) && !this.ready('porto')) return 'port';
      return this.d.res.monete >= FOG.cost ? 'ok' : 'cost';
    },
    sendScout(x, y, now = this.now) {
      if (this.scoutCheck(x, y) !== 'ok') return false;
      this.d.res.monete -= FOG.cost;
      x = Math.round(Math.max(G, Math.min((COLS - 1) * G, x))); y = Math.round(Math.max(G, Math.min((ROWS - 1) * G, y)));
      const tr = { id: this.d.nextId++, x, y, at: now, ms: this.tripMs(x, y), p: 0, rep: { found: [], loot: {}, items: [], ruins: 0 } };
      if (this.islandTrip(x, y)) tr.boat = 1;
      this.d.trips.push(tr); this.track('explore'); this.syncScouts(now);
      this.events.push({ k: 'scout', x, y });
      return true;
    },
    /** Da dove parte una spedizione: dal castello, o dal porto se va in barca. */
    tripFrom(tr) { const b = tr.boat ? this.d.buildings.find(o => o.type === 'porto') : null; return b ? { x: b.x, y: b.y } : { x: this.castle.x + 50, y: this.castle.y + 80 }; },
    /** A che punto è: { p: 0-1, x, y, left: millisecondi che mancano } */
    tripAt(tr, now = this.now) { const s = this.tripFrom(tr), p = clamp01((now - tr.at) / tr.ms); return { p, x: s.x + (tr.x - s.x) * p, y: s.y + (tr.y - s.y) * p, left: Math.max(0, tr.at + tr.ms - now) }; },
    /** Quello che l'esploratore vede da un punto del viaggio: scopre la mappa e prende i tesori delle rovine vicine. */
    tripLook(tr, x, y, end) {
      const was = TRIBES.map((_, i) => this.d.met[i]), rep = tr.rep;
      this.reveal(x, y, FOG.scout + (end ? 3 : 0));
      TRIBES.forEach((_, i) => { if (!was[i] && this.d.met[i]) rep.found.push(i); });
      for (const R of RUINS) {
        if (this.d.ruins[R.id] || (R.island && !(tr.boat && end))) continue;
        if (Math.hypot((R.c + 0.5) * G - x, (R.r + 0.5) * G - y) <= FOG.pick * G) this.lootRuin(R, rep);
      }
    },
    /** Fa avanzare le spedizioni fino a «now» (vale anche per il tempo passato a gioco chiuso). */
    stepTrips(now = this.now) {
      if (!this.d.trips.length) { if (this.scouts.length) this.scouts = []; return; }
      let ended = false;
      for (const tr of this.d.trips) {
        const s = this.tripFrom(tr), p1 = clamp01((now - tr.at) / tr.ms), len = Math.hypot(tr.x - s.x, tr.y - s.y), st = len > 0 ? G * 3 / len : 1;
        if (!tr.rep) tr.rep = { found: [], loot: {}, items: [], ruins: 0 };
        let p = tr.p || 0;
        while (p + st < p1) { p += st; if (!tr.boat) this.tripLook(tr, s.x + (tr.x - s.x) * p, s.y + (tr.y - s.y) * p, false); }
        tr.p = p;
        if (p1 >= 1) { this.tripLook(tr, tr.x, tr.y, true); tr.done = 1; ended = true; }
      }
      if (ended) {
        for (const tr of this.d.trips) if (tr.done) { this.d.reports.push({ ...tr.rep, x: tr.x, y: tr.y, boat: tr.boat || 0 }); this.events.push({ k: 'tripDone', x: tr.x, y: tr.y }); }
        this.d.trips = this.d.trips.filter(tr => !tr.done); this.rev++;
      }
      this.syncScouts(now);
    },
    /** Gli esploratori in viaggio, per chi disegna (quelli in barca non si vedono a piedi). */
    syncScouts(now = this.now) {
      this.scouts = this.d.trips.filter(tr => !tr.boat).map(tr => { const a = this.tripAt(tr, now), s = this.tripFrom(tr); return { id: tr.id, x: a.x, y: a.y, ang: Math.atan2(tr.y - s.y, tr.x - s.x) }; });
    },
    reportSeen() { return this.d.reports.shift() || null; },
    /** Il tesoro di una rovina: materiali, e la prima volta un oggetto per l'eroe. */
    lootRuin(R, rep) {
      if (this.d.ruins[R.id]) return false;
      this.d.ruins[R.id] = 1; this.gain(R.loot); this.rev++;
      const x = (R.c + 0.5) * G, y = (R.r + 0.5) * G, it = HERO_ITEMS[R.id % HERO_ITEMS.length];
      let item = null;
      if (RULES().hero) { const H = this.d.hero; H.items = H.items || {}; if (!H.items[it]) { H.items[it] = 1; item = it; this.applyHero(); } else this.heroXp(10); }
      if (rep) { rep.ruins++; for (const k in R.loot) rep.loot[k] = (rep.loot[k] || 0) + R.loot[k]; if (item) rep.items.push(item); }
      this.events.push({ k: 'ruin', x, y, loot: R.loot, item });
      return true;
    },

    // ---------- edifici a livelli ----------
    /** 'ok' | 'none' (non si migliora) | 'max' | 'busy' | 'castle' | 'cost' */
    levelCheck(b) {
      const L = RULES().levels && b && LEVELS[b.type], lv = b ? b.lvl || 0 : 0;
      if (!L) return 'none';
      if (lv >= L.length) return 'max';
      if (b.build > 0 || this.status !== 'day') return 'busy';
      if (this.d.castle < LEVEL_MIN[lv]) return 'castle';
      return this.afford(L[lv]) ? 'ok' : 'cost';
    },
    levelCost(b) { const L = LEVELS[b.type]; return L && (b.lvl || 0) < L.length ? L[b.lvl || 0] : null; },
    levelUp(b) {
      if (this.levelCheck(b) !== 'ok') return false;
      this.pay(this.levelCost(b)); b.lvl = (b.lvl || 0) + 1; b.hp = this.maxHp(b);
      this.rev++; this.track('levels');
      this.events.push({ k: 'upgrade', x: b.x, y: b.y });
      return true;
    },
    /** Quanti soldati ospita una caserma. */
    slots(b) { return CASERMA_SLOTS + (RULES().levels && b ? b.lvl || 0 : 0); },

    // ---------- cibo ----------
    mouths() { return this.workersMax() + this.popUsed(); },
    foodStock() { return Math.floor(this.d.res.cibo || 0) + Math.floor(this.d.res.grano || 0); },
    /** All'alba tutti mangiano: prima il cibo, poi il grano crudo. d.fed = quanta parte ha mangiato (0-1). */
    meal() {
      if (!RULES().food) return;
      if (this.d.night < FOOD.from) { this.d.fed = 1; return; }
      const need = this.mouths(); let left = need;
      for (const k of ['cibo', 'grano']) { const n = Math.min(left, Math.floor(this.d.res[k] || 0)); this.d.res[k] -= n; left -= n; }
      this.d.fed = need ? (need - left) / need : 1; this._mKey = null;
      this.events.push({ k: 'meal', fed: this.d.fed, need });
    },
    /** 'off' (le scorte del castello bastano) | 'full' (sazi) | 'ok' | 'hungry' */
    fedState() { if (!RULES().food || this.d.night < FOOD.from) return 'off'; const f = this.d.fed == null ? 1 : this.d.fed; return f >= 1 ? 'full' : f < 0.5 ? 'hungry' : 'ok'; },
    foodMood() { const s = this.fedState(); return s === 'full' ? FOOD.full : s === 'hungry' ? FOOD.hungry : 0; },
    /** Quanto svelti lavorano gli abitanti: sazi di più, affamati di meno. */
    workK() { const s = this.fedState(); return s === 'full' ? FOOD.work : s === 'hungry' ? FOOD.slow : 1; },
    /** I mulini macinano: un grano diventa due di cibo. */
    millStep(dt) {
      if (!RULES().food || !(this.d.res.grano > 0)) return;
      let rate = 0; for (const b of this.d.buildings) if (b.type === 'mulino' && !(b.build > 0)) rate += FOOD.mill * levelK(b.lvl);
      if (!rate) return;
      const g = Math.min(this.d.res.grano, rate * dt / 60);
      this.d.res.grano -= g; this.d.res.cibo = (this.d.res.cibo || 0) + g * 2;
    },

    // ---------- la notte: chi arriva ----------
    endless() { return (this.d.story == null ? -1 : this.d.story) >= CHAPTERS.length - 1; },
    endlessK(n) { return this.d.endAt ? 1 + 0.05 * Math.max(0, n - this.d.endAt) : 1; },
    /** Tutti i nemici della notte n, in ordine di partenza: { t, type, tribe }. */
    waveList(n = this.nextNight) {
      const from = this.attackers(n), q = [], R = RULES(), V = this.d.villages;
      if (!from.length) return q;
      const DF = DIFFS[this.d.diff];
      let k = 0;
      for (const g of genWave(n, this.waveK(n) * DF.wave * (1 + DF.grow * (n - 1)) * this.endlessK(n))) for (let i = 0; i < g.n; i++) q.push({ t: (g.at || 0) + i * g.gap, type: g.t, tribe: from[(k++) % from.length] });
      if (R.tribes) for (const i of from) { const T = TRIBES[i], m = specials(T, n); for (let j = 0; j < m; j++) q.push({ t: 6 + j * 4 + (i % 4), type: 'sp_' + T.id, tribe: i }); }
      if (R.dipl) for (const i of from) if (V[i].rage === n) for (let j = 0; j < 4 + 2 * V[i].level; j++) q.push({ t: 2 + j * 0.8, type: j % 3 === 2 ? 'predone' : 'orco', tribe: i });
      if (R.siege) for (let j = 0, m = siegeCount(n); j < m; j++) q.push({ t: 14 + j * 6, type: 'ordigno', tribe: from[j % from.length] });
      q.sort((a, b) => a.t - b.t);
      return q;
    },
    waveSum(n = this.nextNight) { const o = {}; for (const e of this.waveList(n)) o[e.type] = (o[e.type] || 0) + 1; return o; },
    /** La catapulta nemica: se ha un edificio a tiro si ferma e ci tira sopra. Vero se ha fatto la sua mossa. */
    siegeStep(e, dt) {
      e.look = (e.look || 0) - dt;
      if (e.look <= 0 || (e.tb && !this.byId.has(e.tb))) {
        e.look = 1; e.tb = 0;
        let bd = e.siege.range * e.siege.range;
        for (const b of this.d.buildings) { const D = BUILD[b.type]; if (D.flat || D.deco) continue; const dd = d2(e, b); if (dd < bd) { bd = dd; e.tb = b.id; } }
      }
      const b = e.tb ? this.byId.get(e.tb) : null;
      if (!b) return false;
      e.ang = Math.atan2(b.y - e.y, b.x - e.x); e.atk -= dt;
      if (e.atk <= 0) {
        e.atk = e.siege.rate; e.striking = 0.4;
        const T = Math.max(0.7, Math.min(1.3, Math.sqrt(d2(e, b)) / 200));
        this.projs.push({ k: 'boulder', foe: b.id, x: e.x, y: e.y, h: 30, x0: e.x, y0: e.y, x1: b.x, y1: b.y, t: 0, T, dmg: e.siege.dmg, kind: 'physical', splash: 46 });
        this.events.push({ k: 'shot', type: 'catapulta', x: e.x, y: e.y });
      }
      return true;
    },
    /** Il sasso di una catapulta nemica è arrivato: colpisce l'edificio e chi gli sta accanto. */
    foeBoulder(p) {
      const b = this.byId.get(p.foe);
      this.events.push({ k: 'impact', x: p.x1, y: p.y1, r: p.splash });
      for (const s of this.soldiers) if (!s.dead && (s.x - p.x1) * (s.x - p.x1) + (s.y - p.y1) * (s.y - p.y1) < p.splash * p.splash) this.hurtSoldier(s, p.dmg * 0.35);
      if (b) this.hurtBuilding(b, p.dmg);
    },
    /** Lo sciamano dei Bianchi cura i compagni vicini. */
    enemyHeal(e, dt) { for (const o of this.enemies) if (o !== e && !o.dead && o.hp < o.maxHp && d2(o, e) < 95 * 95) o.hp = Math.min(o.maxHp, o.hp + e.heal * dt); },

    // ---------- diplomazia: la simpatia di ogni popolo ----------
    rel(i) { const v = this.d.villages[i]; return v.rel == null ? REL.start : v.rel; },
    addRel(i, n) { const v = this.d.villages[i]; if (v) v.rel = Math.max(0, Math.min(100, this.rel(i) + n)); },
    /** Il dono per allearsi: chi ti vuole bene chiede meno. */
    allyPrice(i) { const c = allyCost(TRIBES[i], this.d.villages[i].level); if (!RULES().dipl || this.rel(i) < REL.cheap) return c; const o = {}; for (const k in c) o[k] = Math.ceil(c[k] * 0.7); return o; },
    /** 'ok' | 'no' | 'busy' | 'done' (già fatto oggi) | 'cost' */
    giftCheck(i) {
      const v = this.d.villages[i];
      if (!RULES().dipl || !v || v.state === 'colony' || !this.known(i)) return 'no';
      if (this.status !== 'day') return 'busy';
      if (v.gift) return 'done';
      return this.afford(giftCost(v.level)) ? 'ok' : 'cost';
    },
    gift(i) {
      if (this.giftCheck(i) !== 'ok') return false;
      const v = this.d.villages[i];
      this.pay(giftCost(v.level)); this.addRel(i, REL.gift); v.gift = 1; this.rev++;
      this.track('gift');
      this.events.push({ k: 'gift', i, x: (TRIBES[i].c + 0.5) * G, y: (TRIBES[i].r + 0.5) * G });
      return true;
    },
    /** Ogni mattina: i doni si possono rifare, e la simpatia torna piano verso il suo punto di partenza. */
    relNight() {
      this.d.villages.forEach((v, i) => { v.gift = 0; if (!RULES().dipl) return; const r = this.rel(i); if (r > REL.start) v.rel = Math.max(REL.start, r - REL.decay); else if (r < REL.start) v.rel = Math.min(REL.start, r + 2); });
    },
    /** Gli eventi di diplomazia: -1 se adesso non può capitare, altrimenti { i, j } (i popoli coinvolti). */
    diplFits(id) {
      if (!RULES().dipl) return -1;
      const V = this.d.villages, free = [], allies = [];
      V.forEach((v, i) => { if (v.state === 'ally') allies.push(i); else if (v.state === 'free' && this.known(i)) free.push(i); });
      if (id === 'tributo') { const i = free.find(k => V[k].level > this.d.castle && TRIBES[k].from <= this.nextNight); return i == null ? -1 : { i }; }
      if (id === 'soccorso') return allies.length && free.length ? { i: allies[0], j: free[0] } : -1;
      if (id === 'patto') { const j = free.find(k => this.rel(k) >= 40 && this.d.castle >= Math.min(5, V[k].level)); return allies.length && j != null ? { i: allies[0], j } : -1; }
      if (id === 'tradimento') { const i = allies.find(k => this.rel(k) < 35); return i == null ? -1 : { i }; }
      return -1;
    },
    diplOpts(ev) {
      const V = this.d.villages, v = V[ev.i];
      switch (ev.id) {
        case 'tributo': return [{ cost: { monete: 50 + 30 * v.level }, rel: 15, calm: 1 }, { rage: 1, rel: -10 }];
        case 'soccorso': return [{ needArmy: 4, gain: { monete: 80 + 40 * V[ev.j].level }, rel: 20, more: 2, weaken: ev.j }, { rel: -15, more: -2 }];
        case 'patto': { const c = this.allyPrice(ev.j), half = {}; for (const k in c) half[k] = Math.ceil(c[k] / 2); return [{ cost: half, pact: ev.j }, {}]; }
        case 'tradimento': return [{ cost: { monete: 60 + 40 * v.level }, rel: 25 }, { betray: 1 }];
        default: return null;
      }
    },
    /** Gli effetti di una scelta che riguardano la diplomazia (li chiama eventChoose). */
    diplApply(ev, o) {
      const V = this.d.villages, v = ev.i != null ? V[ev.i] : null, n = this.nextNight;
      if (o.rel && v) this.addRel(ev.i, o.rel);
      if (o.calm && v) v.calm = n;
      if (o.rage && v) v.rage = n;
      if (o.weaken != null && V[o.weaken].level > 1) V[o.weaken].level--;
      if (o.pact != null) { const p = V[o.pact]; p.state = 'ally'; p.until = this.d.night + ALLY_NIGHTS; this.addRel(o.pact, REL.ally); this.track('ally'); this.shard(o.pact); this.events.push({ k: 'allied', i: o.pact, x: (TRIBES[o.pact].c + 0.5) * G, y: (TRIBES[o.pact].r + 0.5) * G }); }
      if (o.betray && v) { v.state = 'free'; v.until = 0; v.rage = n; v.rel = 0; this.events.push({ k: 'allyEnd', i: ev.i, broken: true }); }
    },

    // ---------- l'eroe: oggetti, terzo potere, la seconda eroina ----------
    heroBonus() { const it = (RULES().hero && this.d.hero.items) || {}; return { dmg: it.spada ? 8 : 0, hp: it.scudo ? 80 : 0, fast: it.stivali ? 1.25 : 1, cd: it.amuleto ? 0.75 : 1, shout: it.corno ? 4 : 0 }; },
    /** Riallinea gli eroi vivi al loro livello e ai loro oggetti. */
    applyHero() {
      const L = this.d.hero.lvl, B = this.heroBonus();
      for (const s of this.soldiers) {
        if (!s.hero || s.dead) continue;
        const U = UNITS[s.type], hp = Math.round((U.hp + HERO.perLvl.hp * (L - 1) * (s.who ? 0.7 : 1)) + B.hp);
        if (hp !== s.maxHp) { s.hp = Math.max(1, s.hp + hp - s.maxHp); s.maxHp = hp; }
        s.bonus = HERO.perLvl.dmg * (L - 1) + B.dmg; s.fast = B.fast;
      }
    },
    hasSecond() { return RULES().hero && this.d.castle >= HERO.second.min; },
    /** Il terzo potere: la Luce cura i tuoi soldati attorno all'eroe. */
    heroHeal(h) { let n = 0; for (const s of this.soldiers) if (!s.dead && d2(s, h) < HERO.heal.r * HERO.heal.r && s.hp < s.maxHp) { s.hp = Math.min(s.maxHp, s.hp + s.maxHp * HERO.heal.k); n++; } return n; },

    // ---------- comandi sul campo ----------
    /** Manda un gruppo (i soldati di una caserma; 0 = gli eroi) in un punto: ci restano di guardia fino all'alba. */
    order(home, x, y) {
      if (!this.walkable(x, y) || !this.seen(Math.floor(x / G), Math.floor(y / G))) return false;
      const list = this.soldiers.filter(s => !s.dead && s.ally == null && s.home === home);
      if (!list.length) return false;
      list.forEach((s, k) => { s.ord = 1; s.hold = this.status === 'raid' ? 1 : 0; s.hx = x + ((k % 3) - 1) * 26; s.hy = y + Math.floor(k / 3) * 24; s.target = null; s.path = null; });
      this.track('order');
      this.events.push({ k: 'order', x, y });
      return true;
    },
    /** In assalto: il gruppo smette di tenere la posizione e torna all'attacco. */
    orderAttack(home) { let n = 0; for (const s of this.soldiers) if (s.home === home && s.hold) { s.hold = 0; n++; } return n > 0; },
    clearOrders() { for (const s of this.soldiers) { s.ord = 0; s.hold = 0; } this.rehome(); },
    /** Il gruppo più vicino a un punto, entro r: l'id della caserma (0 = gli eroi), o -1. */
    squadNear(x, y, r = 34) {
      let best = -1, bd = r * r;
      for (const s of this.soldiers) { if (s.dead || s.ally != null) continue; const dd = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y); if (dd < bd) { bd = dd; best = s.home; } }
      return best;
    },

    // ---------- acqua: il ponte fino all'isola ----------
    /** Vero se una fila di ponti unisce l'isola alla riva. */
    islandLinked() {
      if (this._ilRev === this.rev) return this._il;
      this._ilRev = this.rev; this._il = false;
      const seen = new Set(), q = [];
      for (let r = ISLAND.r - ISLAND.rad; r <= ISLAND.r + ISLAND.rad; r++) for (let c = ISLAND.c - ISLAND.rad; c <= ISLAND.c + ISLAND.rad; c++) { q.push(r * COLS + c); seen.add(r * COLS + c); }
      while (q.length) {
        const i = q.pop(), c = i % COLS, r = (i / COLS) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr, ni = nr * COLS + nc;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || seen.has(ni) || this.blk[ni]) continue;
          if (TERRAIN[ni] !== 3) { this._il = true; return true; }       // terra ferma, fuori dall'isola
          seen.add(ni); q.push(ni);
        }
      }
      return false;
    },
    islandCheck() { if (ISLE && !this.d.ruins[ISLE.id] && this.islandLinked()) this.lootRuin(ISLE, null); },

    // ---------- strade, mercato, traslochi ----------
    /** Vero se quel punto sta su una strada (della mappa o costruita). */
    roadAt(x, y) {
      const c = Math.floor(x / G), r = Math.floor(y / G);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
      const i = r * COLS + c, id = this.occ[i];
      return !!ROAD_AT[i] || (id > 0 && this.byId.get(id).type === 'strada');
    },
    roadK(s) { return RULES().roads && this.roadAt(s.x, s.y) ? ROAD_SPEED : 1; },
    /** Vendere al mercato: 'ok' | 'mercato' | 'none' (non ne hai abbastanza) */
    sellCheck(res) { const S = SELL[res]; if (!S || !this.ready('mercato')) return 'mercato'; return (this.d.res[res] || 0) >= S.give ? 'ok' : 'none'; },
    sell(res) {
      if (this.sellCheck(res) !== 'ok') return false;
      this.d.res[res] -= SELL[res].give; this.d.res.monete += SELL[res].get;
      this.track('sell');
      this.events.push({ k: 'sold', res, n: SELL[res].get });
      return true;
    },
    /** Spostare un edificio già costruito (gratis): 'ok' oppure il motivo, come canPlace; 'no' se quello non si sposta. */
    moveCheck(b, c, r) {
      if (!b || !this.byId.has(b.id) || b.type === 'castello' || BUILD[b.type].line || b.build > 0 || this.status !== 'day') return 'no';
      if (c == null) return 'ok';
      const D = BUILD[b.type], mine = [];
      for (let rr = b.r; rr < b.r + D.h; rr++) for (let cc = b.c; cc < b.c + D.w; cc++) { mine.push(rr * COLS + cc); this.occ[rr * COLS + cc] = 0; }
      const why = this.canPlace(b.type, c, r, true, -1);
      for (const i of mine) this.occ[i] = b.id;
      return why;
    },
    moveBuilding(b, c, r) {
      if (this.moveCheck(b, c, r) !== 'ok') return false;
      b.c = c; b.r = r; this.rebuild(); this.rehome();
      for (const s of this.soldiers) if (s.home === b.id && this.status === 'day') { s.x = s.hx; s.y = s.hy; }
      this.events.push({ k: 'placed', x: b.x, y: b.y, type: b.type });
      return true;
    },
    /** Richiama una spedizione: l'esploratore torna subito, con metà delle monete. Quello che ha già visto resta. */
    recallTrip(id) {
      const k = this.d.trips.findIndex(tr => tr.id === id);
      if (k < 0) return false;
      this.d.trips.splice(k, 1); this.d.res.monete += Math.floor(FOG.cost / 2); this.syncScouts(); this.rev++;
      return true;
    },

    // ---------- al mattino: ricostruire quello che la notte ha distrutto ----------
    /** Quello che si può rifare adesso: { list: [pezzi], cost: {…}, n } (solo dove il posto è ancora libero). */
    rebuildPlan() {
      const list = [], cost = {}, extra = {};
      for (const o of this.d.rebuild || []) {
        const D = BUILD[o.type];
        if (!D || !D.cost || this.canPlace(o.type, o.c, o.r, true, extra[o.type] || 0) !== 'ok') continue;
        extra[o.type] = (extra[o.type] || 0) + 1; list.push(o);
        for (const k in D.cost) cost[k] = (cost[k] || 0) + D.cost[k];
      }
      return { list, cost, n: list.length };
    },
    /** Rifà tutto quello che può pagare, nell'ordine in cui è caduto. Rende quanti pezzi ha rifatto. */
    rebuildLost() {
      if (this.status !== 'day') return 0;
      let n = 0; const left = [];
      for (const o of this.d.rebuild || []) {
        const D = BUILD[o.type];
        if (D && D.cost && this.canPlace(o.type, o.c, o.r) === 'ok') { this.pay(D.cost); this.add(o.type, o.c, o.r); this.rebuild(); n++; }
        else if (D && D.cost && this.canPlace(o.type, o.c, o.r, true) === 'ok') left.push(o);      // il posto c'è, mancano i materiali: resta in lista
      }
      this.d.rebuild = left;
      if (n) { this.track('build', n); this.events.push({ k: 'placed', x: this.castle.x, y: this.castle.y, type: 'mura' }); }
      return n;
    },

    // ---------- il mondo online ----------
    /** I soldati a casa che si possono mandare in giro per il mondo, per tipo (gli eroi restano a difendere). */
    pvpArmy() { const o = {}; for (const b of this.d.buildings) if (b.type === 'caserma') for (const u of b.units || []) if (PVP_UNIT[u]) o[u] = (o[u] || 0) + 1; return o; },
    /** Quanto è forte il villaggio in difesa: castello, torri, mura, soldati a casa, eroi. */
    pvpPower() {
      let p = 60 * this.d.castle, mura = 0, rec = 0;
      for (const b of this.d.buildings) {
        if (b.build > 0) continue;
        if (PVP_TOWER[b.type]) p += PVP_TOWER[b.type][Math.min(2, b.lvl || 0)];
        else if (b.type === 'mura') mura++; else if (b.type === 'recinto') rec++;
        else if (b.type === 'caserma') for (const u of b.units || []) p += PVP_UNIT[u] || 0;
      }
      p += Math.min(240, mura * 2) + Math.min(60, rec * 0.5);
      if (this.hasHero()) p += 30 + 8 * this.d.hero.lvl + (this.hasSecond() ? 25 : 0);
      return Math.round(p);
    },
    /** La fotografia che il gioco manda al mondo. */
    pvpSnap() {
      const loot = {}; for (const k of ['monete', 'legna', 'pietra', 'ferro', 'cristallo']) loot[k] = Math.max(0, Math.floor(this.d.res[k] || 0));
      return { castle: this.d.castle, night: this.d.night, power: this.pvpPower(), army: this.pvpArmy(), loot, extra: this.trophies().filter(o => o.done).length * 20 + (this.d.stats.conquer || 0) * 30, color: MY_COLOR };
    },
    /** I soldati partono: escono dalle caserme. Rende quanti ne sono partiti davvero. */
    pvpSend(army) {
      let n = 0;
      for (const u in army) for (let k = 0; k < (army[u] || 0); k++) {
        const b = this.d.buildings.find(o => o.type === 'caserma' && (o.units || []).includes(u));
        if (!b) break;
        b.units.splice(b.units.indexOf(u), 1);
        const s = this.soldiers.find(o => !o.dead && o.home === b.id && o.type === u); if (s) s.dead = true;
        n++;
      }
      this.soldiers = this.soldiers.filter(s => !s.dead); this.rev++;
      return n;
    },
    /** I sopravvissuti tornano: nelle caserme dove c'è posto. Rende quanti sono rientrati. */
    pvpBack(army) {
      let n = 0;
      for (const u in army || {}) for (let k = 0; k < (army[u] || 0); k++) {
        if (!UNITS[u] || UNITS[u].hero) continue;
        const b = this.d.buildings.find(o => o.type === 'caserma' && !(o.build > 0) && (o.units || []).length < this.slots(o));
        if (!b) return n;
        (b.units = b.units || []).push(u); this.spawnSoldier(b, u); n++;
      }
      this.rev++;
      return n;
    },
    /** Un rapporto arrivato dal mondo: bottino e soldati che tornano, oppure quello che ti hanno portato via. Vero se era nuovo. */
    pvpApply(r) {
      const seen = this.d.pvpSeen || (this.d.pvpSeen = []);
      if (!r || !r.id || seen.includes(r.id)) return false;
      seen.push(r.id); if (seen.length > 80) seen.splice(0, seen.length - 80);
      const d = r.data || {};
      if (r.kind === 'won') { for (const k in d.loot || {}) if (k in this.d.res) this.d.res[k] += Math.max(0, d.loot[k] | 0); this.pvpBack(d.back); this.cheer(3); this.track('pvpWin'); }
      else if (r.kind === 'lost' || r.kind === 'bounced') this.pvpBack(d.back);
      else if (r.kind === 'raided') { for (const k in d.lost || {}) if (k in this.d.res) this.d.res[k] = Math.max(0, this.d.res[k] - Math.max(0, d.lost[k] | 0)); this.cheer(-4); }
      else if (r.kind === 'defended') { this.cheer(3); this.track('pvpDef'); }
      this.events.push({ k: 'pvp', kind: r.kind, data: d });
      return true;
    },

    // ---------- costruzioni appena sbloccate (l'etichetta «Nuovo» nel catalogo) ----------
    /** Si può costruire adesso (castello e scoperta ci sono)? */
    buildOpen(ty) { const D = BUILD[ty]; return !!D && D.cost && D.min <= this.d.castle && (!D.tech || !!this.d.tech[D.tech]); },
    isNewBuild(ty) { return this.buildOpen(ty) && !(this.d.seenB || {})[ty]; },
    /** Il giocatore ha guardato queste carte: non sono più nuove. Rende quante lo erano. */
    seeBuilds(list) { let n = 0; const s = this.d.seenB || (this.d.seenB = {}); for (const ty of list || []) if (this.buildOpen(ty) && !s[ty]) { s[ty] = 1; n++; } return n; },

    // ---------- trofei e sfida del giorno ----------
    trophyHave(k) {
      const S = this.d.stats;
      switch (k) {
        case 'nights': return this.d.night;
        case 'castle': return this.d.castle;
        case 'tech': return Object.keys(this.d.tech).length;
        case 'shards': return this.shardCount();
        case 'ruins': return Object.keys(this.d.ruins).length;
        case 'hero': return this.d.hero.lvl;
        case 'morale': return this.morale();
        case 'items': return Object.keys(this.d.hero.items || {}).length;
        case 'crowns': return this.d.crowns || 0;
        default: return S[k] || 0;
      }
    },
    trophies() { return TROPHIES.map(([k, need], id) => { const have = this.trophyHave(k), done = !!this.d.trophy[id] || have >= need; return { id, k, need, have: done ? need : Math.min(need, have), done }; }); },
    checkTrophies() { TROPHIES.forEach(([k, need], id) => { if (!this.d.trophy[id] && this.trophyHave(k) >= need) { this.d.trophy[id] = 1; this.events.push({ k: 'trophy', id, kind: k, need }); } }); },
    /** La sfida di oggi: { k, need, have, done, claimed, reward } */
    challenge(now = this.now) {
      const day = Math.floor(now / DAY);
      if (!this.d.chal || this.d.chal.day !== day) { const [k, need] = CHALLENGES[day % CHALLENGES.length]; this.d.chal = { day, k, need, base: this.d.stats[k] || 0, got: 0 }; }
      const C = this.d.chal, have = Math.min(C.need, (this.d.stats[C.k] || 0) - C.base);
      return { k: C.k, need: C.need, have, done: have >= C.need, claimed: !!C.got, reward: CHALLENGE_REWARD + 10 * this.d.castle };
    },
    claimChallenge(now = this.now) {
      const c = this.challenge(now);
      if (!c.done || c.claimed) return 0;
      this.d.chal.got = 1; this.d.res.monete += c.reward;
      return c.reward;
    },
  });
}

// Le regole del terzo giro (20/11/2026): il cibo che non basta, «perché hai perso», «da fare adesso», la notte di allenamento,
// tre missioni al giorno con il premio della settimana e l'anticipo guadagnato, trappole e fossati, il percorso dei nemici,
// i traslochi di gruppo, nome e stemma del villaggio. Logica pura, come world.js: extend3(World) le aggiunge alla classe.
import {
  G, COLS, ROWS, BUILD, TRIBES, FOOD, NIGHT, CROPS, UNITS, TECH_ORDER, FOG, SHIPS, MAX_CASTLE, DAILY, WEEK, TRAP, BANNER,
} from './data.js';

const DAY = 86400000;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const idx = (c, r) => r * COLS + c;
const cell = (v, max) => Math.max(0, Math.min(max - 1, Math.floor(v / G)));

export function extend3(World) {
  const RULES = () => World.RULES;
  const P = World.prototype, toJSON0 = P.toJSON, checkTrophies0 = P.checkTrophies;
  Object.assign(P, {
    // ---------- cibo: basta per la prossima alba? ----------
    /** { on, need, have, short }: all'alba ogni abitante e ogni soldato mangia una porzione. */
    foodNeed() {
      const on = !!RULES().food && this.d.night + 1 >= FOOD.from, need = on ? this.mouths() : 0, have = this.foodStock();
      return { on, need, have, short: on && have < need };
    },
    /** Che cosa fare se il cibo non basta: { k: 'harvest' | 'plant' | 'build' | 'wait', b }. null = basta. */
    foodFix(now = this.now) {
      const f = this.foodNeed();
      if (!f.short || this.status !== 'day') return null;
      const fields = this.d.buildings.filter(b => b.type === 'campo' && !(b.build > 0));
      const ripe = fields.find(b => b.crop && this.crop(b, now).ripe);
      if (ripe) return { k: 'harvest', b: ripe };
      const empty = fields.find(b => !b.crop);
      if (empty) return { k: 'plant', b: empty };
      let coming = 0; for (const b of fields) if (b.crop && CROPS[b.crop.crop]) coming += CROPS[b.crop.crop].food || 0;
      if (f.have + coming >= f.need) return { k: 'wait' };
      const cp = this.cap('campo');
      return cp.have < cp.max && BUILD.campo.min <= this.d.castle ? { k: 'build' } : { k: 'wait' };
    },

    // ---------- perché hai perso (e come è andato l'allenamento) ----------
    /** La fotografia della notte, presa prima dell'alba: nemici rimasti, da chi, torri, mura, soldati, edifici caduti, un consiglio. */
    nightReport() {
      const alive = this.enemies.filter(e => !e.dead && !e.guard), left = alive.length + this.queue.length;
      const by = {}; for (const e of alive) { const near = Math.hypot(e.x - this.castle.x, e.y - this.castle.y) < 12 * G ? 3 : 1; by[e.tribe] = (by[e.tribe] || 0) + near; }
      let from = -1, bn = 0; for (const k in by) if (by[k] > bn) { bn = by[k]; from = +k; }
      if (from < 0) { const a = this.attackers(this.nextNight); if (a.length) from = a[0]; }
      const towers = this.towers(), cap = this.cap('arcieri').max, walls = this.count('recinto') + this.count('mura');
      const tw = this.d.buildings.filter(b => BUILD[b.type].tower && !(b.build > 0));
      const upg = tw.filter(b => this.upgradeCost(b) != null).length;
      const slots = this.d.buildings.reduce((a, b) => a + (b.type === 'caserma' && !(b.build > 0) ? this.slots(b) : 0), 0), army = this.popUsed();
      const hp = this.castle ? Math.max(0, this.castle.hp / this.maxHp(this.castle)) : 0;
      const adv = towers < cap ? 'towers' : walls < 6 ? 'walls' : upg > 0 ? 'upgrade' : army < slots ? 'army' : !slots ? 'barracks' : this.d.castle < MAX_CASTLE ? 'castle' : 'upgrade';
      return { left, from, towers, cap, walls, upg, army, slots, fell: this.lostB.length, hp, kills: this.nightKills, adv };
    },

    // ---------- la notte di allenamento ----------
    /** Una notte finta, uguale alla prossima: niente premi, niente danni. Alla fine tutto torna com'era (endDrill). */
    startDrill(now = this.now || Date.now()) {
      if (this.status !== 'day' || this.drill || !this.attackers(this.nextNight).length) return false;
      const snap = JSON.stringify(toJSON0.call(this));
      if (!this.startNight(now, true)) return false;
      this.drill = { snap, at: now };
      this.events.push({ k: 'drillStart' });
      return true;
    },
    endDrill(won) {
      const rep = this.nightReport(), snap = this.drill.snap, now = this.now || Date.now();
      const keep = { rev: this.rev, fogRev: this.fogRev, uid: this.uid, events: this.events };
      const d = JSON.parse(snap); d.lastSeen = now;
      const w = new World(d, now, (now % 65521) + 1);
      for (const k of Object.keys(this)) delete this[k];
      Object.assign(this, w);
      this.rev = keep.rev + 1; this.fogRev = keep.fogRev + 1; this.uid = Math.max(this.uid, keep.uid + 1);
      this.events = keep.events; for (const e of w.events) this.events.push(e);
      this.away = null; this.flooded = 0; this.offRoad = 0; this.drill = null; this._dirty = true;
      this.events.push({ k: 'drill', won: !!won, rep });
      return true;
    },
    /** Durante l'allenamento si salva la partita di prima: chiudendo il gioco a metà non si perde niente. */
    toJSON() { return this.drill ? JSON.parse(this.drill.snap) : toJSON0.call(this); },
    checkTrophies() { if (!this.drill) checkTrophies0.call(this); },

    // ---------- tre missioni al giorno, premio della settimana, anticipo guadagnato ----------
    /** Le missioni di oggi: [{ i, k, need, have, done, claimed, reward }]. Scelte dal giorno fra quelle che il giocatore può fare. */
    challenges(now = this.now) {
      const day = Math.floor(now / DAY), C = this.d.chal, S = this.d.stats;
      if (!C || C.day !== day || !Array.isArray(C.list)) {
        const can = {
          train: this.count('caserma') > 0, trade: this.d.villages.some(v => v.state === 'ally' || v.state === 'colony'), sell: this.count('mercato') > 0,
          sail: (this.d.fleet || []).some(s => SHIPS[s.type] && !SHIPS[s.type].plain), gift: !!RULES().dipl && this.d.villages.some((v, i) => this.known(i) && v.state !== 'colony'),
          levels: !!RULES().levels && this.d.castle >= 2, explore: !!RULES().fog, harvest: this.count('campo') > 0,
        };
        const h = (i) => { let x = Math.imul(day + 1, 73856093) ^ Math.imul(i + 1, 19349663); x = Math.imul(x ^ (x >>> 13), 1274126177); return (x ^ (x >>> 16)) >>> 0; };
        const pool = DAILY.pool.map((q, i) => ({ q, o: h(i) })).filter(o => can[o.q[0]] !== false).sort((a, b) => a.o - b.o).map(o => o.q);
        const list = [];
        if (C && C.day === day && C.k) list.push({ k: C.k, need: C.need, base: C.base || 0, got: C.got ? 1 : 0 });      // la sfida unica di prima resta la prima delle tre
        for (const [k, need] of pool) { if (list.length >= DAILY.n) break; if (!list.some(o => o.k === k)) list.push({ k, need, base: S[k] || 0, got: 0 }); }
        this.d.chal = { day, list };
      }
      const reward = DAILY.reward + 10 * this.d.castle;
      return this.d.chal.list.map((o, i) => { const have = Math.max(0, Math.min(o.need, (S[o.k] || 0) - o.base)); return { i, k: o.k, need: o.need, have, done: have >= o.need, claimed: !!o.got, reward }; });
    },
    challenge(now = this.now) { return this.challenges(now)[0]; },
    challengesReady(now = this.now) { return this.challenges(now).filter(c => c.done && !c.claimed).length; },
    claimChallenge(now = this.now, i = 0) {
      const L = this.challenges(now), c = L[i];
      if (!c || !c.done || c.claimed) return 0;
      this.d.chal.list[i].got = 1; this.d.res.monete += c.reward;
      const W = this.week(now); this.d.week = { w: W.w, n: W.n + 1, got: W.claimed ? 1 : 0 };
      // tutte e tre: un anticipo della notte in più, per oggi
      if (this.d.chal.list.every(o => o.got) && this.d.bonusDay !== this.dayKey(now)) { this.d.bonusDay = this.dayKey(now); this.events.push({ k: 'earlyBonus' }); }
      return c.reward;
    },
    /** La settimana (da lunedì): { w, n, need, ready, claimed, prize }. */
    week(now = this.now) {
      const w = Math.floor((Math.floor(now / DAY) + 3) / 7), W = this.d.week && this.d.week.w === w ? this.d.week : { w, n: 0, got: 0 };
      const prize = { ...WEEK.prize, monete: WEEK.prize.monete + 50 * this.d.castle };
      return { w, n: Math.min(W.n, WEEK.need), need: WEEK.need, ready: W.n >= WEEK.need && !W.got, claimed: !!W.got, prize };
    },
    claimWeek(now = this.now) {
      const W = this.week(now);
      if (!W.ready) return null;
      this.d.week = { w: W.w, n: W.n, got: 1 }; this.gain(W.prize);
      return W.prize;
    },
    /** Gli anticipi di oggi: due, più uno se hai finito le tre missioni del giorno. */
    earlyMax(now) { return NIGHT.early + (this.d.bonusDay === this.dayKey(now) ? 1 : 0); },
    earlyLeft(now) { if (!RULES().clock || this.d.night < NIGHT.free) return Infinity; const e = this.d.early || {}; return Math.max(0, this.earlyMax(now) - (e.day === this.dayKey(now) ? e.n : 0)); },

    // ---------- «da fare adesso» ----------
    /** Le cose pronte che aspettano un tocco: [{ k, n, b?, i? }], le più utili prima. */
    todo(now = this.now) {
      const out = [], add = (k, n = 1, x) => { if (n > 0) out.push({ k, n, ...x }); };
      if (this.status !== 'day') return out;
      const B = this.d.buildings, g = this.goal();
      if (g && g.done) add('goal');
      const ff = this.foodFix(now); if (ff && ff.k !== 'wait') add('food', 1, { fix: ff.k, b: ff.b });
      add('rebuild', (this.d.rebuild || []).length);
      add('ripe', this.ripeFields(now).length);
      const empty = B.filter(b => b.type === 'campo' && !(b.build > 0) && !b.crop); add('sow', empty.length, { b: empty[0] });
      add('quest', this.questsReady());
      add('chal', this.challengesReady(now));
      if (this.week(now).ready) add('week');
      const n = this.nextNight;
      if (n <= NIGHT.guideNights + 2) { const want = Math.min(this.cap('arcieri').max, Math.max(this.towersWanted(n), 2)), miss = want - this.towers(); if (miss > 0 && this.afford(BUILD.arcieri.cost)) add('towers', miss); }
      const tw = B.filter(b => BUILD[b.type].tower && !(b.build > 0) && this.upgradeCost(b) != null && this.d.res.monete >= this.upgradeCost(b)); add('upgrade', tw.length, { b: tw[0] });
      if (this.castleCheck() === 'ok') add('castle');
      const lv = RULES().levels ? B.filter(b => b.type !== 'castello' && this.levelCheck(b) === 'ok') : []; add('level', lv.length, { b: lv[0] });
      const br = B.filter(b => b.type === 'caserma' && this.trainCheck(b) === 'ok'); add('train', br.reduce((a, b) => a + this.slots(b) - (b.units || []).length, 0), { b: br[0] });
      if (this.ready('bottega')) { const id = TECH_ORDER.find(k => this.techCheck(k) === 'ok'); if (id) add('tech', 1, { id }); }
      if (RULES().fog && this.d.trips.length < this.tripsMax() && this.d.res.monete >= FOG.cost && this.fogLeft()) add('scout', this.tripsMax() - this.d.trips.length);
      if (RULES().sea && (this.d.fleet || []).length) {
        const home = this.d.fleet.filter(s => !s.job && !SHIPS[s.type].plain);
        add('ships', home.filter(s => this.shipFit(s)).length);
        add('shipFix', this.d.fleet.filter(s => !s.job && s.hp < this.shipHpMax(s) * 0.6).length);
      }
      if (RULES().dipl) { const i = this.d.villages.findIndex((v, k) => this.giftCheck(k) === 'ok' && v.state !== 'ally'); if (i >= 0) add('gift', 1, { i }); }
      return out;
    },
    /** C'è ancora nebbia da esplorare? (contata ogni tanto: la nebbia cambia di rado) */
    fogLeft() {
      if (this._fogLeft && this._fogLeft.rev === this.fogRev) return this._fogLeft.v;
      let v = false; if (this.fogA) for (let i = 0; i < this.fogA.length; i++) if (!this.fogA[i]) { v = true; break; }
      this._fogLeft = { rev: this.fogRev, v };
      return v;
    },

    // ---------- trappole e fossati ----------
    /** Che cosa c'è sotto i piedi di un nemico: il fossato lo rallenta, la trappola scatta una volta per notte. Rende il moltiplicatore del passo. */
    underfoot(e) {
      if (e.ghost) return 1;
      const id = this.occ[idx(cell(e.x, COLS), cell(e.y, ROWS))];
      if (id <= 0) return 1;
      const b = this.byId.get(id), D = b && BUILD[b.type];
      if (!D || b.build > 0) return 1;
      if (D.moat) return e.boss ? (1 + TRAP.moat) / 2 : TRAP.moat;
      if (D.trap && !b.sprung) {
        b.sprung = 1; this.trapRev = (this.trapRev || 0) + 1;
        this.events.push({ k: 'trap', x: b.x, y: b.y });
        this.damage(e, TRAP.dmg * (1 + TRAP.perCastle * (this.d.castle - 1)), 'physical');
        if (!e.dead) this.applySlow(e, TRAP.slow, TRAP.slowT);
      }
      return 1;
    },

    // ---------- da dove arrivano ----------
    /** La strada che faranno i nemici di un popolo, dal suo cancello al castello (punti del mondo). Si rifà quando il villaggio cambia. */
    enemyPath(tribe) {
      const key = this.rev + '|' + this.d.buildings.length;
      this._paths = this._paths && this._paths.key === key ? this._paths : { key, by: {} };
      if (this._paths.by[tribe]) return this._paths.by[tribe];
      const F = this.dist, gt = TRIBES[tribe].gate, out = [];
      let c = gt.c, r = gt.r;
      for (let n = 0; n < 900; n++) {
        out.push({ x: (c + 0.5) * G, y: (r + 0.5) * G });
        let best = null, bd = F[idx(c, r)];
        for (const [dc, dr] of DIRS) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue; const v = F[idx(nc, nr)]; if (v < bd - 1e-4) { bd = v; best = [nc, nr]; } }
        if (!best) break;
        [c, r] = best;
        if (this.occ[idx(c, r)] === this.castle.id) break;
      }
      return (this._paths.by[tribe] = out);
    },

    // ---------- spostare più edifici insieme ----------
    /** Si possono spostare tutti di (dc, dr)? 'ok' oppure il primo motivo che lo impedisce; `bad` = gli id che non trovano posto. */
    groupCheck(ids, dc, dr) {
      const list = ids.map(id => this.byId.get(id)).filter(b => b && this.moveCheck(b) === 'ok');
      if (!list.length || this.status !== 'day') return { why: 'no', bad: [], list };
      const mine = [];
      for (const b of list) { const D = BUILD[b.type]; for (let rr = b.r; rr < b.r + D.h; rr++) for (let cc = b.c; cc < b.c + D.w; cc++) { mine.push([rr * COLS + cc, b.id]); this.occ[rr * COLS + cc] = 0; } }
      const bad = [], taken = new Set(); let why = 'ok';
      for (const b of list) {
        const D = BUILD[b.type]; let w = this.canPlace(b.type, b.c + dc, b.r + dr, true, -1);
        if (w === 'ok') for (let rr = b.r + dr; rr < b.r + dr + D.h; rr++) for (let cc = b.c + dc; cc < b.c + dc + D.w; cc++) { if (taken.has(rr * COLS + cc)) w = 'occupied'; taken.add(rr * COLS + cc); }
        if (w !== 'ok') { bad.push(b.id); if (why === 'ok') why = w; }
      }
      for (const [i, id] of mine) this.occ[i] = id;
      return { why, bad, list };
    },
    moveGroup(ids, dc, dr) {
      const chk = this.groupCheck(ids, dc, dr);
      if (chk.why !== 'ok' || (!dc && !dr)) return 0;
      for (const b of chk.list) { b.c += dc; b.r += dr; }
      this.rebuild(); this.rehome();
      for (const b of chk.list) { for (const s of this.soldiers) if (s.home === b.id) { s.x = s.hx; s.y = s.hy; } this.events.push({ k: 'placed', x: b.x, y: b.y, type: b.type }); }
      this.rev++;
      return chk.list.length;
    },

    // ---------- nome e stemma del villaggio ----------
    villageName() { return String(this.d.vname || this.d.pvpName || '').slice(0, BANNER.nameMax); },
    setVillageName(s) { this.d.vname = String(s || '').replace(/\s+/g, ' ').trim().slice(0, BANNER.nameMax); if (this.d.vname) this.d.pvpName = this.d.vname; this.rev++; return this.d.vname; },
    banner() { const b = this.d.banner || {}; return { sym: Math.max(0, Math.min(BANNER.syms - 1, b.sym | 0)), col: Math.max(0, Math.min(BANNER.cols.length - 1, b.col | 0)) }; },
    setBanner(sym, col) { const b = this.banner(); this.d.banner = { sym: sym == null ? b.sym : Math.max(0, Math.min(BANNER.syms - 1, sym | 0)), col: col == null ? b.col : Math.max(0, Math.min(BANNER.cols.length - 1, col | 0)) }; this.rev++; return this.d.banner; },
  });
}

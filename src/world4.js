// Le gemme e il negozio (20/11/2026, richiesta del titolare: «dobbiamo aggiungere lo shop così la gente può shoppare per avanzare,
// che sarebbe l'unico guadagno nostro»). Logica pura, come world.js: extend4(World) la aggiunge alla classe.
// Le gemme stanno nel salvataggio (d.gems). Si comprano con soldi veri (pay.js chiama grantPack quando il negozio del telefono dice
// che l'acquisto è andato) e un poco si trovano giocando: lo scrigno del giorno e il premio della settimana.
// Con le gemme: casse di materiali, «compra ciò che manca», un anticipo della notte in più, una spedizione che torna subito.
import { SHOP, NIGHT, GIFT7, BACK, CROPS, WEEKEND } from './data.js';

const DAY = 86400000, HOUR = 3600000;

export function extend4(World) {
  const RULES = () => World.RULES;
  const P = World.prototype, claimWeek0 = P.claimWeek, earlyMax0 = P.earlyMax, offline0 = P.offline, cropGain0 = P.cropGain, production0 = P.production, checkTrophies0 = P.checkTrophies;
  World.RULES.weekend = true;
  Object.assign(P, {
    gems() { return Math.max(0, Math.floor(this.d.gems || 0)); },

    // ---------- l'evento del fine settimana ----------
    /** { id, end, left } se è sabato o domenica (ora del telefono), altrimenti null. `forceEvent` serve alle prove. */
    weekend(now = this.now || Date.now()) {
      if (!RULES().weekend) return null;
      const d = new Date(now), wd = d.getDay();
      if (this.forceEvent) return { id: this.forceEvent, end: now + DAY, left: DAY };
      if (wd !== 6 && wd !== 0) return null;
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (wd === 6 ? 2 : 1)).getTime(), wk = Math.floor(end / (7 * DAY)), n = WEEKEND.order.length;
      return { id: WEEKEND.order[((wk % n) + n) % n], end, left: end - now };
    },
    evOn(id) { const e = this.weekend(); return !!e && e.id === id; },
    cropGain(crop) { return cropGain0.call(this, crop) * (this.evOn('harvest') ? WEEKEND.harvest : 1); },
    production() { const p = production0.call(this); if (this.evOn('plenty')) for (const k in p) p[k] *= WEEKEND.plenty; return p; },
    /** Ogni trofeo nuovo porta qualche gemma (non quelli già presi al primo controllo dopo l'avvio). */
    checkTrophies() {
      const n0 = Object.keys(this.d.trophy || {}).length; checkTrophies0.call(this);
      const n1 = Object.keys(this.d.trophy || {}).length;
      if (n1 > n0 && this._troReady) this.addGems(WEEKEND.trophy * (n1 - n0), 'trophy');
      this._troReady = true;
    },
    addGems(n, why) {
      n = Math.max(0, Math.floor(n)); if (!n) return this.gems();
      this.d.gems = this.gems() + n; (this.events || (this.events = [])).push({ k: 'gems', n, why }); return this.d.gems;
    },
    spendGems(n) {
      n = Math.ceil(n); if (!(n > 0) || this.gems() < n) return false;
      this.d.gems = this.gems() - n; this.d.gemsSpent = (this.d.gemsSpent || 0) + n; return true;
    },

    // ---------- le casse di materiali: crescono col castello ----------
    shopK() { return (1 + this.d.castle) / 2; },
    /** [{ i, res, n, gems, bigN, bigGems, locked }]: locked = il materiale non è ancora scoperto. */
    shopPacks() {
      const k = this.shopK();
      return SHOP.packs.map(([res, n, gems, tech], i) => {
        const q = Math.round(n * k / 10) * 10;
        return { i, res, n: q, gems, bigN: q * SHOP.big.k, bigGems: gems * SHOP.big.price, locked: !!tech && !this.d.tech[tech] };
      });
    },
    /** Compra la cassa i (big = quella grande). Rende quello che è arrivato, o null. */
    buyPack(i, big) {
      const p = this.shopPacks()[i]; if (!p || p.locked) return null;
      if (!this.spendGems(big ? p.bigGems : p.gems)) return null;
      const got = { [p.res]: big ? p.bigN : p.n }; this.gain(got); this.events.push({ k: 'shopBuy', got }); return got;
    },

    // ---------- lo scrigno del giorno: gratis, una volta al giorno ----------
    chestReady(now = this.now) { return (this.d.shop || {}).day !== this.dayKey(now); },
    chestLoot() { const o = {}, k = this.shopK(); for (const r in SHOP.chest.res) o[r] = Math.round(SHOP.chest.res[r] * k / 10) * 10; return o; },
    claimChest(now = this.now) {
      if (!this.chestReady(now)) return null;
      const got = this.chestLoot(); this.d.shop = { ...(this.d.shop || {}), day: this.dayKey(now) };
      const gems = SHOP.chest.gems * (this.evOn('gems') ? WEEKEND.chest : 1);
      this.gain(got); this.addGems(gems, 'chest'); this.events.push({ k: 'shopBuy', got });
      return { got, gems };
    },

    // ---------- «compra ciò che manca» ----------
    /** Quello che manca per pagare `cost` (k volte): { materiale: quanto }, o null se basta. */
    missing(cost, k = 1) {
      let o = null; if (!cost) return null;
      for (const r in cost) { const m = Math.ceil(cost[r] * k - Math.floor(this.d.res[r] || 0)); if (m > 0) { o = o || {}; o[r] = m; } }
      return o;
    },
    /** Quante gemme costa quello che manca. */
    gemsFor(miss) { let g = 0; for (const r in miss) g += miss[r] / (SHOP.perGem[r] || 5); return Math.max(1, Math.ceil(g)); },
    buyMissing(cost, k = 1) {
      const miss = this.missing(cost, k); if (!miss) return true;
      if (!this.spendGems(this.gemsFor(miss))) return false;
      this.gain(miss); this.events.push({ k: 'shopBuy', got: miss }); return true;
    },

    // ---------- un anticipo della notte in più (al più due al giorno) ----------
    earlyBought(now = this.now) { const e = this.d.earlyBuy; return e && e.day === this.dayKey(now) ? e.n : 0; },
    earlyMax(now) { return earlyMax0.call(this, now) + this.earlyBought(now); },
    /** 'ok' | 'off' (l'orologio non conta ancora) | 'max' | 'gems' */
    earlyBuyCheck(now = this.now) {
      if (!RULES().clock || this.d.night < NIGHT.free) return 'off';
      if (this.earlyBought(now) >= 2) return 'max';
      return this.gems() >= SHOP.early ? 'ok' : 'gems';
    },
    buyEarly(now = this.now) {
      if (this.earlyBuyCheck(now) !== 'ok' || !this.spendGems(SHOP.early)) return false;
      this.d.earlyBuy = { day: this.dayKey(now), n: this.earlyBought(now) + 1 }; return true;
    },

    // ---------- una spedizione torna subito ----------
    hurryCost(tr, now = this.now) { const h = Math.max(0, tr.at + tr.ms - now) / 3600000; return h <= 0 ? 0 : Math.max(SHOP.hurryMin, Math.ceil(h * SHOP.hurry)); },
    hurryTrip(id, now = this.now) {
      const tr = this.d.trips.find(x => x.id === id); if (!tr) return false;
      const g = this.hurryCost(tr, now); if (!g || !this.spendGems(g)) return false;
      tr.at = now - tr.ms; return true;
    },

    // ---------- un acquisto vero andato a buon fine ----------
    /** Dà le gemme del pacchetto `id`. `tx` = il numero dell'acquisto: lo stesso acquisto non vale due volte. Rende le gemme date (0 = niente). */
    grantPack(id, tx) {
      const p = SHOP.gemPacks.find(x => x.id === id); if (!p) return 0;
      const seen = this.d.txs || (this.d.txs = []);
      if (tx) { const key = String(tx).slice(-40); if (seen.includes(key)) return 0; seen.push(key); if (seen.length > 80) seen.shift(); }
      const n = p.gems * (this.firstBuy() ? SHOP.first : 1);
      this.d.paid = (this.d.paid || 0) + 1; this.addGems(n, 'buy'); return n;
    },
    /** Il primo acquisto vale doppio. */
    firstBuy() { return !this.d.paid; },

    // ---------- il regalo del giorno: sette giorni di fila, sempre più ricco, poi si ricomincia ----------
    daily(now) {
      const day = Math.floor(now / DAY);
      if (day <= this.d.dailyDay) return { available: false, streak: this.d.streak || 0 };
      const streak = day === this.d.dailyDay + 1 ? ((this.d.streak || 0) % GIFT7.length) + 1 : 1, gift = GIFT7[streak - 1];
      return { available: true, amount: gift.monete, streak, gift };
    },
    claimDaily(now) {
      const dly = this.daily(now); if (!dly.available) return 0;
      this.d.dailyDay = Math.floor(now / DAY); this.d.streak = dly.streak;
      const g = { ...dly.gift }, gems = (g.gems || 0) * (this.evOn('gems') ? WEEKEND.gift : 1); delete g.gems;
      this.gain(g); if (gems) this.addGems(gems, 'gift');
      return dly.amount;
    },

    // ---------- bentornato: chi manca da giorni trova qualche gemma ----------
    offline(now) {
      const gap = now - (this.d.lastSeen || now);
      offline0.call(this, now);
      if (gap >= BACK.days * DAY && this.d.night >= 1) {
        this.addGems(BACK.gems, 'back');
        this.away = this.away || { got: {}, mins: Math.round(gap / 60000) };
        this.away.back = { gems: BACK.gems, days: Math.floor(gap / DAY) };
      }
    },

    // ---------- gli avvisi da programmare quando il gioco si chiude: [{ k, at }] ----------
    // night: è l'ora della notte · scout: il primo esploratore torna · crop: tutti i campi sono maturi · gift: il regalo di domani ·
    // back, back2: due richiami se non si torna (dopo due e dopo cinque giorni)
    notifyPlan(now = this.now) {
      const out = [], later = (k, at) => { if (at > now + 5 * 60000) out.push({ k, at: Math.round(at) }); };
      if (RULES().clock && this.status === 'day' && this.d.nightAt) later('night', this.d.nightAt);
      let trip = 0; for (const tr of this.d.trips) { const e = tr.at + tr.ms; if (e > now && (!trip || e < trip)) trip = e; }
      if (trip) later('scout', trip);
      let crop = 0; const ck = this.cropK() || 1;
      for (const b of this.d.buildings) if (b.type === 'campo' && b.crop && CROPS[b.crop.crop]) { const e = b.crop.at + CROPS[b.crop.crop].secs * 1000 / ck; if (e > crop) crop = e; }
      if (crop) later('crop', crop);
      const d = new Date(now), midLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(), midUtc = (Math.floor(now / DAY) + 1) * DAY;
      later('gift', Math.max(midLocal, midUtc) + 9 * HOUR);
      if (RULES().weekend && !this.weekend(now)) { const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((6 - d.getDay() + 7) % 7 || 7), 10).getTime(); later('event', sat); }
      later('back', now + 48 * HOUR); if (out.length < 6) later('back2', now + 120 * HOUR);
      return out;
    },

    claimWeek(now) { const r = claimWeek0.call(this, now); if (r) this.addGems(SHOP.week, 'week'); return r; },
  });
}

// Le gemme e il negozio (20/11/2026, richiesta del titolare: «dobbiamo aggiungere lo shop così la gente può shoppare per avanzare,
// che sarebbe l'unico guadagno nostro»). Logica pura, come world.js: extend4(World) la aggiunge alla classe.
// Le gemme stanno nel salvataggio (d.gems). Si comprano con soldi veri (pay.js chiama grantPack quando il negozio del telefono dice
// che l'acquisto è andato) e un poco si trovano giocando: lo scrigno del giorno e il premio della settimana.
// Con le gemme: casse di materiali, «compra ciò che manca», un anticipo della notte in più, una spedizione che torna subito.
import { SHOP, NIGHT } from './data.js';

export function extend4(World) {
  const RULES = () => World.RULES;
  const P = World.prototype, claimWeek0 = P.claimWeek, earlyMax0 = P.earlyMax;
  Object.assign(P, {
    gems() { return Math.max(0, Math.floor(this.d.gems || 0)); },
    addGems(n, why) {
      n = Math.max(0, Math.floor(n)); if (!n) return this.gems();
      this.d.gems = this.gems() + n; this.events.push({ k: 'gems', n, why }); return this.d.gems;
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
      this.gain(got); this.addGems(SHOP.chest.gems, 'chest'); this.events.push({ k: 'shopBuy', got });
      return { got, gems: SHOP.chest.gems };
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
      this.d.paid = (this.d.paid || 0) + 1; this.addGems(p.gems, 'buy'); return p.gems;
    },

    claimWeek(now) { const r = claimWeek0.call(this, now); if (r) this.addGems(SHOP.week, 'week'); return r; },
  });
}

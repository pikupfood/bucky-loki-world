// Gli acquisti veri: Google Play Billing e App Store, attraverso il plugin Capacitor `@capgo/native-purchases` (8.9.6).
// Il gioco non ha build: il plugin si raggiunge da `window.Capacitor.Plugins.NativePurchases`, che c'è solo dentro l'app.
// Sul sito (browser) non si compra: `native()` è falso e il negozio lo dice.
//
// Il giro di un acquisto: purchaseProduct → il negozio del telefono incassa → `onPaid(id, numero)` dà le gemme e SALVA →
// solo dopo si «consuma» l'acquisto (Android), così lo stesso pacchetto si può ricomprare. Se l'app muore a metà, all'avvio
// `recover()` ritrova gli acquisti pagati e non consumati e li consegna (il numero dell'acquisto impedisce il doppione).
//
// NON C'È ANCORA una verifica dal server: le gemme le dà il telefono. Per un gioco quasi tutto in locale va bene per partire;
// prima che il mondo online conti qualcosa serve la verifica (ricevuta Apple / gettone Google) in una funzione Supabase.
import { SHOP } from './data.js';

export const state = { ready: false, prices: {}, busy: null, err: null, fake: false };
const IDS = SHOP.gemPacks.map(p => p.id);
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : null);
const plug = () => { const C = cap(); return C && C.Plugins ? C.Plugins.NativePurchases : null; };
const android = () => { const C = cap(); return !!C && C.getPlatform && C.getPlatform() === 'android'; };
let onPaid = () => 0;

/** Dentro l'app, col negozio del telefono a disposizione? (`fake` serve solo alle prove) */
export function native() { const C = cap(); return state.fake || !!(C && C.isNativePlatform && C.isNativePlatform() && plug()); }
/** Il prezzo da scrivere sul bottone: quello del negozio del telefono; se non ha risposto, quello di listino. */
export function price(id) { return state.prices[id] || (SHOP.gemPacks.find(p => p.id === id) || {}).eur || ''; }

async function deliver(tx) {
  const id = tx.productIdentifier, key = tx.purchaseToken || tx.transactionId || tx.orderId;
  if (!IDS.includes(id)) return 0;
  if (tx.purchaseState != null && String(tx.purchaseState) !== '1') return 0;      // Android: «in attesa» (es. pagamento in contanti) non è ancora pagato
  const n = onPaid(id, key);
  if (android() && tx.purchaseToken) { try { await plug().consumePurchase({ purchaseToken: tx.purchaseToken }); } catch (e) { /* si riprova al prossimo avvio */ } }
  return n;
}

/** All'avvio: i prezzi veri, e gli acquisti rimasti a metà. `paid(id, numero)` deve dare le gemme, salvare e rendere quante ne ha date. */
export async function init(paid) {
  onPaid = paid || onPaid;
  if (!native() || state.fake) return;
  try {
    const ok = await plug().isBillingSupported();
    if (!ok || !ok.isBillingSupported) { state.err = 'unsupported'; return; }
    const r = await plug().getProducts({ productIdentifiers: IDS, productType: 'inapp' });
    for (const p of (r && r.products) || []) if (p.identifier && p.priceString) state.prices[p.identifier] = p.priceString;
    state.ready = Object.keys(state.prices).length > 0;
    if (!state.ready) state.err = 'noProducts';
  } catch (e) { state.err = 'load'; }
  recover();
}
async function recover() {
  if (!android()) return;
  try { const r = await plug().getPurchases({ productType: 'inapp' }); for (const tx of (r && r.purchases) || []) await deliver(tx); } catch (e) { /* niente da recuperare */ }
}

/** Compra il pacchetto `id`. Rende { ok, gems } oppure { ok: false, why: 'web' | 'busy' | 'soon' | 'cancel' | 'pending' | 'fail' }. */
/** Si può comprare adesso? (dentro l'app, e il negozio del telefono ha dato i prodotti) */
export function open() { return state.fake || (native() && state.ready); }
export async function buy(id) {
  if (!native()) return { ok: false, why: 'web' };
  if (state.busy) return { ok: false, why: 'busy' };
  if (!state.ready && !state.fake) { init(); return { ok: false, why: 'soon' }; }      // il negozio del telefono non ha (ancora) dato i prodotti: si richiede, e intanto non si prova a comprare
  state.busy = id; state.err = null;
  try {
    if (state.fake) { await new Promise(r => setTimeout(r, 300)); return { ok: true, gems: onPaid(id, 'fake-' + Date.now()) }; }
    const tx = await plug().purchaseProduct({ productIdentifier: id, productType: 'inapp', quantity: 1, isConsumable: false });
    if (!tx) return { ok: false, why: 'fail' };
    if (!tx.productIdentifier) tx.productIdentifier = id;
    if (tx.purchaseState != null && String(tx.purchaseState) !== '1') return { ok: false, why: 'pending' };
    const gems = await deliver(tx);
    return gems ? { ok: true, gems } : { ok: false, why: 'fail' };
  } catch (e) {
    const m = String((e && (e.message || e.code)) || e).toLowerCase();
    return { ok: false, why: m.includes('cancel') ? 'cancel' : 'fail' };
  } finally { state.busy = null; }
}

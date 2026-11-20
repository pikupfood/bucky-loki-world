// Gli avvisi sul telefono (20/11/2026): «arriva la notte», «gli esploratori sono tornati», «il raccolto è pronto», «il regalo di oggi»,
// «i Tuzu ti aspettano». Avvisi LOCALI: li programma il telefono, niente server. Plugin `@capacitor/local-notifications` 8.3.1, raggiunto
// come gli altri (il gioco non ha build). Sul sito non esistono: `native()` è falso e non succede niente.
// `isExactNotification: false`: senza, su Android 12+ il plugin apre la pagina di sistema «Sveglie e promemoria» per chiedere l'ora esatta
// al secondo, che qui non serve (provato sull'emulatore il 20/11/2026: con il valore di default non programmava niente).
// Si programmano quando il gioco va in secondo piano (main.js: `planNotifs`), si tolgono quando torna davanti.
let P = null, tried = false;
function plug() {
  if (tried) return P; tried = true;
  try { const C = window.Capacitor; if (C && C.isNativePlatform && C.isNativePlatform()) P = C.registerPlugin ? C.registerPlugin('LocalNotifications') : (C.Plugins && C.Plugins.LocalNotifications) || null; } catch (e) { P = null; }
  return P;
}
const IDS = [1, 2, 3, 4, 5, 6];
export const native = () => !!plug();
/** Chiede il permesso (il telefono mostra la sua finestrella una volta sola). Rende vero se gli avvisi sono permessi. */
export async function ask() {
  const p = plug(); if (!p) return false;
  try { let r = await p.checkPermissions(); if (r.display !== 'granted' && r.display !== 'denied') r = await p.requestPermissions(); return r.display === 'granted'; } catch (e) { return false; }
}
export async function clear() { const p = plug(); if (!p) return; try { await p.cancel({ notifications: IDS.map(id => ({ id })) }); } catch (e) { /* niente da togliere */ } }
/** Programma gli avvisi: [{ at (ms), title, body }], al più sei. Quelli di prima si tolgono sempre. Senza permesso non fa niente (e non lo chiede). */
export async function plan(list) {
  const p = plug(); if (!p) return;
  await clear();
  if (!list || !list.length) return;
  try {
    const r = await p.checkPermissions(); if (r.display !== 'granted') { console.log('[avvisi] permesso: ' + r.display); return; }
    await p.schedule({ notifications: list.slice(0, IDS.length).map((n, i) => ({ id: IDS[i], title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true }, isExactNotification: false, smallIcon: 'ic_stat_tuzu' })) });
    console.log('[avvisi] programmati: ' + Math.min(list.length, IDS.length));
  } catch (e) { console.log('[avvisi] errore: ' + (e && e.message ? e.message : e)); }      // un avviso mancato non deve fermare il gioco
}

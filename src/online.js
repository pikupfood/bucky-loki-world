// Il mondo online: una mappa sola per tutti i giocatori (più i villaggi del computer), attacchi, alleanze, raduni, classifica.
// Qui c'è solo il filo col server (Supabase, tabelle e funzioni dw_*: vedi tools/dw_online.sql). Le regole stanno nel server:
// il gioco manda una fotografia del proprio villaggio (forza, soldati a casa, materiali) e riceve i rapporti delle battaglie.
import * as cloud from './cloud.js';

/** ready: le tabelle ci sono (null = non si sa) · me: il mio villaggio nel mondo · il resto: quello che tutti vedono */
export const state = { ready: null, me: null, villages: [], alliances: [], marches: [], troops: [], reports: [], incoming: [], msgs: [], visit: null, layKey: '', busy: false, err: '', at: 0, loadedAt: 0, offset: 0 };
let cfg = null;      // { getSnap(), onReports(list) -> ids, onSent(army) }
export function init(c) { cfg = c; }

const missing = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42883' || /does not exist|schema cache|Could not find/i.test(e.message || ''));
/** Il motivo di un rifiuto del server, in una parola (shield, army, busy, same_alliance, full, taken, name_needed…). */
export function why(e) { const m = (e && e.message) || ''; const k = ['not_signed_in', 'name_needed', 'not_joined', 'no_target', 'self', 'same_alliance', 'shield', 'army', 'busy', 'no_alliance', 'exists', 'closed', 'not_leader', 'already', 'taken', 'full', 'no_room'].find(x => m.includes(x)); return k || (missing(e) ? 'soon' : 'net'); }
async function rpc(fn, args) { const s = await cloud.getClient(), { data, error } = await s.rpc(fn, args || {}); if (error) throw error; return data; }
/** L'ora del server (i conti alla rovescia non dipendono dall'orologio del telefono). */
export const now = () => Date.now() + state.offset;

// ---------- le stesse formule del server, per mostrare i numeri prima di decidere ----------
export const UNIT_POW = { lancia: 10, arco: 11, corazza: 26, cavallo: 18, cura: 9, ariete: 22 };
export const armyPower = (a) => { let p = 0; for (const k in a || {}) p += (UNIT_POW[k] || 0) * (a[k] || 0); return p; };
export const armyCount = (a) => { let n = 0; for (const k in a || {}) if (UNIT_POW[k]) n += a[k] || 0; return n; };
export const levelOf = (v) => (v.kind === 'npc' ? Math.min(60, v.level + Math.floor(Math.sqrt(Math.max(0, now() - Date.parse(v.born)) / 172800000))) : v.castle);
export const defenseOf = (v) => (v.kind === 'npc' ? Math.round(22 * Math.pow(levelOf(v), 1.3)) : Math.max(30, v.power || 0));
export const travelSecs = (a, b) => Math.max(120, Math.min(14400, Math.round(40 * Math.hypot(a.x - b.x, a.y - b.y))));
export const shielded = (v) => !!v.shield_until && Date.parse(v.shield_until) > now();
export const byId = (id) => state.villages.find(v => v.id === id) || null;
export const allianceOf = (v) => (v && v.alliance_id ? state.alliances.find(a => a.id === v.alliance_id) || null : null);

/** Manda la fotografia del villaggio, fa avanzare il mondo, applica i rapporti nuovi. name: solo per entrare la prima volta o cambiare nome. */
export async function sync(name) {
  if (state.demo) return true;          // solo per le prove: un mondo finto messo a mano in state
  if (!cloud.state.user || state.ready === false) return false;
  try {
    // la pianta del villaggio pesa: parte solo quando è cambiata dall'ultima volta che il server l'ha presa
    const snap = cfg.getSnap(), lay = cfg.getLayout ? cfg.getLayout() : null, key = lay ? JSON.stringify(lay) : '';
    if (lay && key !== state.layKey) snap.layout = lay;
    const r = await rpc('dw_sync', { p_name: name || null, p_snap: snap });
    state.layKey = key;
    state.ready = true; state.me = r.me; state.err = ''; state.at = Date.now();
    if (r.now) state.offset = Date.parse(r.now) - Date.now();
    if (r.reports && r.reports.length) { const ids = cfg.onReports(r.reports); if (ids && ids.length) await rpc('dw_ack', { p_ids: ids }); }
    await watch();
    return true;
  } catch (e) { const k = why(e); if (k === 'soon') state.ready = false; state.err = k === 'name_needed' ? '' : k; if (k === 'name_needed') { state.ready = true; state.me = null; } return false; }
}
/** Chi sta marciando contro di me (si chiede a ogni giro, anche a mappa chiusa: così il gioco può avvisare). */
async function watch() {
  if (!state.me) { state.incoming = []; return; }
  try {
    const s = await cloud.getClient(), q = await s.from('dw_marches').select('id,village_id,target_id,status,kind,arrive_at').eq('target_id', state.me.id).eq('status', 'march').limit(10);
    if (q.error) return;
    const list = q.data || [], ids = [...new Set(list.map(m => m.village_id))];
    if (ids.length) { const n = await s.from('dw_villages').select('id,name').in('id', ids); if (!n.error) for (const m of list) m.from = ((n.data || []).find(v => v.id === m.village_id) || {}).name || ''; }
    state.incoming = list;
  } catch (e) { /* si riprova al prossimo giro */ }
}
/** Legge tutto il mondo: villaggi, alleanze, eserciti in marcia, i miei rapporti. */
export async function load() {
  if (state.demo) return true;
  if (!cloud.state.user || state.ready === false) return false;
  try {
    const s = await cloud.getClient();
    const [v, a, m, rp] = await Promise.all([
      s.from('dw_villages').select('id,user_id,kind,name,color,x,y,castle,night,level,born,power,score,wins,losses,alliance_id,shield_until,banner,week_pts').limit(5000),
      s.from('dw_alliances').select('*').limit(1000),
      s.from('dw_marches').select('*').neq('status', 'done').limit(500),
      s.from('dw_reports').select('*').order('at', { ascending: false }).limit(30),
    ]);
    for (const q of [v, a, m, rp]) if (q.error) throw q.error;
    state.villages = v.data || []; state.alliances = a.data || []; state.marches = m.data || []; state.reports = rp.data || [];
    const ids = state.marches.map(o => o.id);
    if (ids.length) { const tr = await s.from('dw_troops').select('*').in('march_id', ids); if (tr.error) throw tr.error; state.troops = tr.data || []; } else state.troops = [];
    state.ready = true; state.loadedAt = Date.now(); state.err = '';
    if (state.me && state.me.alliance_id) await msgs(); else state.msgs = [];
    if (state.me) state.me = byId(state.me.id) ? { ...state.me, ...byId(state.me.id) } : state.me;
    return true;
  } catch (e) { const k = why(e); if (k === 'soon') state.ready = false; state.err = k; return false; }
}
/** Una mossa: prima il server sa come sto adesso, poi la mossa, poi si rilegge il mondo. Rende '' se è andata, altrimenti il motivo. */
async function act(fn, args, sent) {
  if (state.busy) return 'busy';
  state.busy = true;
  try {
    await rpc('dw_sync', { p_name: null, p_snap: cfg.getSnap() });
    await rpc(fn, args);
    if (sent) cfg.onSent(sent);
    await sync(); await load();
    state.busy = false; return '';
  } catch (e) { state.busy = false; return why(e); }
}
/** In visita: la pianta di un villaggio (solo guardare). */
export async function visit(id) {
  state.visit = { id, loading: true };
  if (state.demo) { state.visit = { id, layout: cfg.getLayout ? cfg.getLayout() : [], banner: 0 }; return; }
  try { const s = await cloud.getClient(), q = await s.from('dw_villages').select('id,layout,banner').eq('id', id).limit(1); if (q.error) throw q.error; const r = (q.data || [])[0] || {}; state.visit = { id, layout: Array.isArray(r.layout) ? r.layout : [], banner: r.banner | 0 }; }
  catch (e) { state.visit = { id, layout: [], err: true }; }
}
/** I messaggi pronti della mia alleanza (il server mostra solo quelli). */
export async function msgs() {
  if (state.demo) return;
  try { const s = await cloud.getClient(), q = await s.from('dw_msgs').select('id,village_id,code,at').order('at', { ascending: false }).limit(20); state.msgs = q.error ? [] : q.data || []; } catch (e) { /* al prossimo giro */ }
}
export const msgSend = (code) => act('dw_msg_send', { p_code: code });
/** Ritira il premio della settimana scorsa: il server dice quante monete, il gioco le aggiunge. */
export async function weekClaim() {
  if (state.busy || state.demo) return 0;
  state.busy = true;
  try { const n = (await rpc('dw_week_claim', {})) | 0; if (n > 0 && cfg.onPrize) cfg.onPrize(n); await sync(); state.busy = false; return n; } catch (e) { state.busy = false; return 0; }
}
export const attack = (target, army) => act('dw_attack', { p_target: target, p_army: army }, army);
export const rallyOpen = (target, minutes, army) => act('dw_rally_open', { p_target: target, p_minutes: minutes, p_army: army }, army);
export const rallyJoin = (march, army) => act('dw_rally_join', { p_march: march, p_army: army }, army);
export const rallyLaunch = (march) => act('dw_rally_launch', { p_march: march });
export const allianceCreate = (name, tag) => act('dw_alliance_create', { p_name: name, p_tag: tag });
export const allianceJoin = (id) => act('dw_alliance_join', { p_alliance: id });
export const allianceLeave = () => act('dw_alliance_leave', {});
export const allianceKick = (id) => act('dw_alliance_kick', { p_village: id });
/** Entrare nel mondo col nome del villaggio (o cambiarlo). */
export async function join(name) { state.busy = true; const ok = await sync(name); if (ok) await load(); state.busy = false; return ok ? '' : state.err || 'name_needed'; }

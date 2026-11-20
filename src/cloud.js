// Account e salvataggio automatico nel cloud. È lo stesso account del gioco che sta alla radice di game.tuzu.my
// (stesso progetto Supabase, quindi chi è già entrato lì è già dentro anche qui). La partita sta nella tabella `difesa_saves`:
// una riga per giocatore, che solo lui può leggere e scrivere. Finché la tabella non c'è, il pannello dice che l'account arriva presto.
const SUPA_URL = 'https://bpipowfznqcnfxhezaez.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwaXBvd2Z6bnFjbmZ4aGV6YWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTM3ODQsImV4cCI6MjEwOTIyOTc4NH0.Zm5SMxenj1YOfAjWfpSXxjmc6VWQ8PS-ho7lExRe2nI';      // chiave pubblica (anon)
const LIB = 'https://esm.sh/@supabase/supabase-js@2.47.10', TABLE = 'difesa_saves', MARK = 'tuzu_difesa_cloud_at', PUSH_EVERY = 25000;

/** open: pannello aperto · user: chi è dentro · ready: la tabella c'è (null = non si sa ancora) · ask: due partite, quale tieni? */
export const state = { open: false, user: null, ready: null, busy: false, msg: '', bad: false, savedAt: 0, ask: null };
let cfg = null, supa = null, dirty = false, timer = null, lastPush = 0, box = null;
const t = (k, v) => (cfg ? cfg.t(k, v) : k);

export function init(c) {
  cfg = c;
  // chi è già entrato (qui o nel gioco alla radice) viene riconosciuto senza aprire niente
  // …e chi torna da Google ha il gettone nell'indirizzo: lo legge il cliente di Supabase appena nasce
  let back = false; try { back = /access_token=|error_description=|[?&]code=/.test(location.hash + location.search); } catch (e) { /* niente */ }
  try { if (back || Object.keys(localStorage).some(k => k.startsWith('sb-bpipowfznqcnfxhezaez-auth-token'))) boot(back); } catch (e) { /* senza memoria si gioca lo stesso */ }
  window.addEventListener('pagehide', () => { if (dirty && state.user) push(); });
}
export async function getClient() { return client(); }
async function client() {
  if (supa) return supa;
  const m = await import(/* @vite-ignore */ LIB);
  supa = m.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return supa;
}
const missing = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));
/** La tabella dei salvataggi c'è? (Si chiede senza essere entrati: 404 = no.) */
async function probe() {
  if (state.ready != null) return state.ready;
  try { const r = await fetch(SUPA_URL + '/rest/v1/' + TABLE + '?select=user_id&limit=1', { headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY } }); state.ready = r.status !== 404; }
  catch (e) { state.ready = null; }
  return state.ready;
}
async function boot(back) {
  try { const s = await client(), { data } = await s.auth.getSession(); state.user = data && data.session ? data.session.user : null; if (state.user) await sync(); }
  catch (e) { state.user = null; }
  if (back) {      // di ritorno da Google: si dice subito com'è andata
    state.open = true; if (!state.user) { state.msg = t('cloudErr'); state.bad = true; }
    try { if (/error_description=/.test(location.hash + location.search)) history.replaceState(null, '', location.pathname); } catch (e) { /* niente */ }
  }
  render();
}
const brief = (w) => ({ night: (w && w.night) || 0, castle: (w && w.castle) || 1 });
const isFresh = (w) => !w || ((w.night || 0) === 0 && (w.buildings || []).length <= 3);
/** Quale partita vale, quella di questo telefono o quella del cloud: 'push' | 'keep' | 'take' | 'ask'. (Esportata per le prove.) */
export function choose(local, cloudData, markSame) {
  if (!cloudData) return 'push';                           // sul cloud non c'è niente: ci va questa
  if (markSame) return 'keep';                             // il cloud è quello che abbiamo scritto noi l'ultima volta
  if (isFresh(local)) return 'take';                       // qui la partita è appena cominciata: si prende quella del cloud
  if (isFresh(cloudData)) return 'push';
  return 'ask';                                            // due partite vere: decide il giocatore
}
async function sync() {
  const s = await client();
  const { data, error } = await s.from(TABLE).select('data,updated_at').eq('user_id', state.user.id).maybeSingle();
  if (error) { if (missing(error)) state.ready = false; say(t(missing(error) ? 'cloudSoon' : 'cloudErr'), true); return; }
  state.ready = true;
  let mark = null; try { mark = localStorage.getItem(MARK); } catch (e) { /* niente */ }
  const local = cfg.getSave(), what = choose(local, data && data.data, !!data && mark === data.updated_at);
  if (what === 'push') await push(true);
  else if (what === 'keep') { state.savedAt = Date.parse(data.updated_at); if (dirty) touch(); }
  else if (what === 'take') take(data);
  else { state.ask = { row: data, local: brief(local), cloud: brief(data.data) }; state.open = true; }
}
function take(row) { try { localStorage.setItem(MARK, row.updated_at); } catch (e) { /* niente */ } cfg.onLoad(row.data); }
async function push(force) {
  if (!state.user || state.ready === false || state.ask) return false;
  if (!force && Date.now() - lastPush < 4000) return false;
  lastPush = Date.now(); dirty = false;
  try {
    const s = await client();
    let mark = null; try { mark = localStorage.getItem(MARK); } catch (e) { /* niente */ }
    // Il salvataggio automatico scrive solo se nel cloud c'è ancora quello che avevamo scritto noi: se nel frattempo ha salvato
    // un altro telefono non lo si copre, si rifà il confronto (e se serve si chiede al giocatore). force = l'ha deciso lui.
    const q = force || !mark ? s.from(TABLE).upsert({ user_id: state.user.id, data: cfg.getSave() }) : s.from(TABLE).update({ data: cfg.getSave() }).eq('user_id', state.user.id).eq('updated_at', mark);
    const { data, error } = await q.select('updated_at').maybeSingle();
    if (!error && !data && !force && mark) { await sync(); if (state.open) render(); return false; }
    if (error) { if (missing(error)) state.ready = false; say(t(missing(error) ? 'cloudSoon' : 'cloudErr'), true); return false; }
    if (data) { try { localStorage.setItem(MARK, data.updated_at); } catch (e) { /* niente */ } state.savedAt = Date.parse(data.updated_at); }
    if (state.open) render();
    return true;
  } catch (e) { say(t('cloudErr'), true); return false; }
}
/** Il gioco ha appena salvato sul telefono: fra poco la partita va anche nel cloud. */
export function touch() {
  dirty = true;
  if (!state.user || timer) return;
  timer = setTimeout(() => { timer = null; if (dirty) push(); }, Math.max(4000, PUSH_EVERY - (Date.now() - lastPush)));
}
function say(msg, bad) { state.msg = msg; state.bad = !!bad; if (state.open) render(); }
async function run(fn) { if (state.busy) return; state.busy = true; say(t('cloudWait')); try { await fn(); } catch (e) { say(t('cloudErr'), true); } state.busy = false; render(); }
const enter = (email, secret) => run(async () => {
  const s = await client(), { data, error } = await s.auth.signInWithPassword({ email, password: secret });
  if (error) { say(t('cloudBadLogin'), true); return; }
  state.user = data.user; state.msg = ''; await sync();
});
const register = (email, secret) => run(async () => {
  const s = await client(), { data, error } = await s.auth.signUp({ email, password: secret });
  if (error) { say(t(/already/i.test(error.message || '') ? 'cloudExists' : 'cloudErr'), true); return; }
  if (!data.session) { say(t('cloudConfirm')); return; }
  state.user = data.user; state.msg = ''; await sync();
});
/** Con Google: si esce dalla pagina e si torna già dentro. La partita resta sul telefono nel frattempo. */
// Dentro l'app (Capacitor) la pagina sta su https://localhost, che non è un indirizzo di ritorno ammesso: Supabase rimandava al sito tuzu.my
// (il titolare, 19/11/2026). Dall'app Google si apre nel browser del telefono e torna su game.tuzu.my/app-login, che riapre l'app con
// l'indirizzo com.nexlygo.tuzudifesa://auth?access_token=…: lo riceve main.js (appUrlOpen) e lo passa a fromUrl.
const NATIVE = (() => { try { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); } catch (e) { return false; } })();
const APP_BACK = 'https://game.tuzu.my/app-login';
// Su iPhone e iPad niente «Entra con Google»: Apple (regola 4.8) lo ammette solo accanto ad «Accedi con Apple». Lì si entra con email e parola d'ordine.
const IOS = (() => { try { return NATIVE && window.Capacitor.getPlatform() === 'ios'; } catch (e) { return false; } })();
const google = () => run(async () => {
  if (cfg.beforeLeave) cfg.beforeLeave();
  const s = await client();
  if (NATIVE) {
    const { data, error } = await s.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_BACK, skipBrowserRedirect: true } });
    if (error || !data || !data.url) { say(t('cloudErr'), true); return; }
    window.location.href = data.url; return;      // un indirizzo di fuori: Capacitor lo apre nel browser del telefono
  }
  const { error } = await s.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } });
  if (error) say(t('cloudErr'), true);
});
/** L'app è stata riaperta dal ritorno di Google: nell'indirizzo ci sono i due gettoni. Vero se si è entrati. */
export async function fromUrl(url) {
  const fail = () => { state.open = true; state.msg = t('cloudErr'); state.bad = true; render(); return false; };
  try {
    const q = new URLSearchParams(String(url).split(/[?#]/).slice(1).join('&')), at = q.get('access_token'), rt = q.get('refresh_token');
    if (!at || !rt) return fail();
    const s = await client(), { data, error } = await s.auth.setSession({ access_token: at, refresh_token: rt });
    if (error || !data || !data.session) return fail();
    state.user = data.session.user; state.msg = ''; state.bad = false; state.open = true; await sync(); render(); return true;
  } catch (e) { return fail(); }
}
/** Cancella l'account (Apple e Google lo pretendono dentro l'app). Usa la funzione «account» che il progetto Tuzu ha già: toglie l'utente,
 *  e con lui la partita nel cloud e il villaggio online (le tabelle del gioco hanno «on delete cascade»). La partita sul telefono resta. */
const erase = () => run(async () => {
  const s = await client(), { data } = await s.auth.getSession(), tok = data && data.session && data.session.access_token;
  if (!tok) { say(t('cloudErr'), true); return; }
  let ok = false;
  try { const r = await fetch(SUPA_URL + '/functions/v1/account', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + tok }, body: JSON.stringify({ action: 'delete' }) }); ok = r.ok && !!(await r.json()).deleted; } catch (e) { ok = false; }
  if (!ok) { state.del = false; say(t('cloudErr'), true); return; }
  try { await s.auth.signOut({ scope: 'local' }); } catch (e) { /* l'utente non c'è più: va bene */ }
  state.user = null; state.savedAt = 0; state.del = false; try { localStorage.removeItem(MARK); } catch (e) { /* niente */ }
  if (cfg.onErased) cfg.onErased();
  say(t('cloudDeleted'));
});
const leave = () => run(async () => { const s = await client(); await s.auth.signOut(); state.user = null; state.savedAt = 0; state.msg = ''; try { localStorage.removeItem(MARK); } catch (e) { /* niente */ } });

// ---------- il pannello (HTML vero sopra il gioco: così la tastiera del telefono funziona) ----------
const esc = (v) => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export function open() { state.open = true; state.msg = ''; render(); if (!state.user) probe().then(render); }
export function close() { state.open = false; state.del = false; render(); }
function render() {
  if (typeof document === 'undefined') return;
  if (!state.open) { if (box) box.style.display = 'none'; return; }
  if (!box) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(8,8,18,.74);font-family:"Trebuchet MS","Segoe UI",Roboto,sans-serif;color:#f5ecd7';
    document.body.appendChild(box);
  }
  box.style.display = 'flex';
  const btn = (id, label, bg) => `<button id="${id}" style="flex:1;min-height:46px;border-radius:12px;border:2px solid rgba(255,236,170,.7);background:${bg};color:#f5ecd7;font-weight:800;font-size:17px;font-family:inherit;cursor:pointer">${esc(label)}</button>`;
  const inp = (id, type, ph, ac) => `<input id="${id}" type="${type}" placeholder="${esc(ph)}" autocomplete="${ac}" autocapitalize="off" spellcheck="false" style="width:100%;box-sizing:border-box;min-height:44px;margin:6px 0;padding:8px 12px;border-radius:10px;border:2px solid rgba(233,196,106,.5);background:#2a2118;color:#f5ecd7;font-weight:600;font-size:16px;font-family:inherit">`;
  let body;
  if (state.ask) {
    const A = state.ask, col = (title, o) => `<div style="flex:1;text-align:center;font-size:14px;color:#cbbf9f">${esc(title)}<br><b style="color:#f5ecd7">${esc(t('cloudBrief', o.night).replace('{w}', o.castle))}</b></div>`;
    body = `<p style="margin:0 0 12px;font-size:15px;line-height:1.4">${esc(t('cloudAskText'))}</p>
      <div style="display:flex;gap:10px">${col(t('cloudHere'), A.local)}${col(t('cloudThere'), A.cloud)}</div>
      <div style="display:flex;gap:10px;margin-top:12px">${btn('acKeep', t('cloudKeepLocal'), '#3b3229')}${btn('acTake', t('cloudKeepCloud'), '#2f7d3a')}</div>`;
  } else if (state.user && state.del) {      // cancellare l'account: si chiede due volte, e si dice chiaro che cosa sparisce
    body = `<p style="margin:0 0 14px;font-size:15px;line-height:1.45;color:#ffcfc6">${esc(t('cloudDelText'))}</p>
      <div style="display:flex;gap:10px">${btn('acDelNo', t('cloudDelNo'), '#3b3229')}${btn('acDelYes', t('cloudDelYes'), '#a8322a')}</div>`;
  } else if (state.user) {
    const at = state.savedAt ? new Date(state.savedAt) : null, hh = at ? String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0') : '';
    body = `<p style="margin:0 0 6px;font-size:15px">${esc(t('cloudAs', state.user.email || ''))}</p>
      <p style="margin:0 0 14px;font-size:14px;color:#9ff0b4">${esc(at ? t('cloudSaved', hh) : t('cloudAuto'))}</p>
      <div style="display:flex;gap:10px">${btn('acSave', t('cloudSaveNow'), '#2f7d3a')}${btn('acOut', t('cloudOut'), '#7a3a2c')}</div>
      <button id="acDel" style="display:block;margin:14px auto 0;min-height:40px;padding:6px 14px;border:0;background:none;color:#e8897e;font-weight:700;font-size:14.5px;font-family:inherit;text-decoration:underline;cursor:pointer">${esc(t('cloudDel'))}</button>`;
  } else if (state.ready === false) {
    body = `<p style="margin:0 0 6px;font-size:15px;line-height:1.4">${esc(t('cloudSoon'))}</p>`;
  } else {
    const G = '<svg width="20" height="20" viewBox="0 0 48 48" style="flex:none"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.800 7.200l7.600 5.900c4.500-4.100 7-10.200 7-17.600z"/><path fill="#FBBC05" d="M10.500 28.600A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.200.800-4.600l-7.900-6.200A24 24 0 0 0 0 24c0 3.900.900 7.500 2.600 10.800l7.900-6.200z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z"/></svg>';
    body = `<p style="margin:0 0 10px;font-size:14.5px;line-height:1.4;color:#cbbf9f">${esc(t('cloudIntro'))}</p>
      ${IOS ? '<!--' : ''}<button id="acGoogle" style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:12px;border:0;background:#fff;color:#1f1f1f;font-weight:800;font-size:17px;font-family:inherit;cursor:pointer">${G}${esc(t('cloudGoogle'))}</button>
      <div style="display:flex;align-items:center;gap:10px;margin:12px 0 4px;color:#9a8f76;font-size:13px"><span style="flex:1;height:1px;background:rgba(233,196,106,.3)"></span>${esc(t('cloudOr'))}<span style="flex:1;height:1px;background:rgba(233,196,106,.3)"></span></div>${IOS ? '-->' : ''}
      ${inp('acMail', 'email', t('cloudEmail'), 'email')}${inp('acKey', 'password', t('cloudPass'), 'current-password')}
      <div style="display:flex;gap:10px;margin-top:8px">${btn('acIn', t('cloudIn'), '#2f7d3a')}${btn('acUp', t('cloudUp'), '#5b4a8a')}</div>`;
  }
  const keep = { m: (box.querySelector('#acMail') || {}).value || '', p: (box.querySelector('#acKey') || {}).value || '' };
  box.innerHTML = `<div style="width:min(92vw,430px);max-height:94vh;overflow:auto;background:#1a140e;border:2px solid rgba(233,196,106,.6);border-radius:16px;padding:16px 18px">
    <div style="font-weight:800;font-size:24px;color:#f2cf73;margin-bottom:10px">${esc(t(state.ask ? 'cloudAskTitle' : 'account'))}</div>
    ${body}
    <p style="min-height:18px;margin:10px 0 8px;font-size:14px;color:${state.bad ? '#e8897e' : '#cbbf9f'}">${esc(state.msg || '')}</p>
    ${state.ask ? '' : `<div style="display:flex">${btn('acClose', t('close'), '#3b3229')}</div>`}</div>`;
  const $ = (id) => box.querySelector('#' + id), on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  if ($('acMail')) { $('acMail').value = keep.m; $('acKey').value = keep.p; }
  const typed = () => { const m = ($('acMail').value || '').trim(), p = $('acKey').value || ''; if (!/^\S+@\S+\.\S+$/.test(m)) { say(t('cloudBadMail'), true); return null; } if (p.length < 6) { say(t('cloudShort'), true); return null; } return [m, p]; };
  on('acClose', close);
  on('acIn', () => { const c = typed(); if (c) enter(c[0], c[1]); });
  on('acUp', () => { const c = typed(); if (c) register(c[0], c[1]); });
  on('acOut', leave);
  on('acDel', () => { state.del = true; state.msg = ''; render(); });
  on('acDelNo', () => { state.del = false; render(); });
  on('acDelYes', erase);
  on('acGoogle', google);
  on('acSave', () => run(async () => { if (await push(true)) say(t('cloudDone')); }));
  on('acKeep', () => run(async () => { state.ask = null; await push(true); state.open = false; }));
  on('acTake', () => { const row = state.ask.row; state.ask = null; take(row); });
}

// ---------- una finestrella per scrivere una o due parole (il nome del villaggio, dell'alleanza) ----------
let askBox = null;
/** fields: [{ ph: testo d'esempio, max }] · cb(valori) viene chiamata solo se conferma. */
export function ask(title, fields, okLabel, cb) {
  if (typeof document === 'undefined') return;
  if (askBox) askBox.remove();
  askBox = document.createElement('div'); state.open = true;
  askBox.style.cssText = 'position:fixed;inset:0;z-index:21;display:flex;align-items:center;justify-content:center;background:rgba(8,8,18,.74);font-family:"Trebuchet MS","Segoe UI",Roboto,sans-serif;color:#f5ecd7';
  const inputs = fields.map((f, i) => '<input id="askF' + i + '" type="text" maxlength="' + (f.max || 20) + '" placeholder="' + esc(f.ph || '') + '" autocomplete="off" spellcheck="false" style="width:100%;box-sizing:border-box;min-height:44px;margin:6px 0;padding:8px 12px;border-radius:10px;border:2px solid rgba(233,196,106,.5);background:#2a2118;color:#f5ecd7;font-weight:600;font-size:16px;font-family:inherit">').join('');
  const btn = (id, label, bg) => '<button id="' + id + '" style="flex:1;min-height:46px;border-radius:12px;border:2px solid rgba(255,236,170,.7);background:' + bg + ';color:#f5ecd7;font-weight:800;font-size:17px;font-family:inherit;cursor:pointer">' + esc(label) + '</button>';
  askBox.innerHTML = '<div style="width:min(92vw,400px);background:#1a140e;border:2px solid rgba(233,196,106,.6);border-radius:16px;padding:16px 18px"><div style="font-weight:800;font-size:21px;color:#f2cf73;margin-bottom:8px">' + esc(title) + '</div>' + inputs + '<div style="display:flex;gap:10px;margin-top:10px">' + btn('askNo', t('close'), '#3b3229') + btn('askOk', okLabel, '#2f7d3a') + '</div></div>';
  document.body.appendChild(askBox);
  const done = (ok) => { const vals = fields.map((_, i) => (askBox.querySelector('#askF' + i).value || '').trim()); askBox.remove(); askBox = null; state.open = false; if (ok) cb(vals); };
  askBox.querySelector('#askNo').onclick = () => done(false);
  askBox.querySelector('#askOk').onclick = () => done(true);
  const first = askBox.querySelector('#askF0'); if (first) first.focus();
}

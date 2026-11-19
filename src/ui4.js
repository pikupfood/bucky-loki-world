// Lo schermo del MONDO online: la mappa di tutti i villaggi (giocatori e computer), gli attacchi e i raduni, la classifica,
// l'alleanza, i rapporti. Come gli altri file dell'interfaccia: ogni funzione riceve S (il fotogramma) e K (gli attrezzi di ui.js).
// ui.online = { tab: 'map' | 'rank' | 'ally' | 'reports', sel: id del villaggio scelto, cam: { x, y, z }, pick: scelta dei soldati, msg }
import { MY_COLOR, UNIT_ORDER } from './data.js';
import { t } from './i18n.js';
import { drawText } from './text.js';
import * as O from './online.js';
import { fmtH, clock, compass, tag } from './ui3.js';
import * as W from './ui5.js';
import * as cloud from './cloud.js';

const TAU = Math.PI * 2, TABS = ['map', 'rank', 'ally', 'reports'];
const secsLeft = (iso) => Math.max(0, (Date.parse(iso) - O.now()) / 1000);
const dark = (col) => col === '#3b3947';

/** Chi è per me questo villaggio: 'me' | 'ally' (stessa alleanza) | 'player' | 'npc' */
function rel(v) { const me = O.state.me; if (me && v.id === me.id) return 'me'; if (v.kind === 'npc') return 'npc'; return me && me.alliance_id && v.alliance_id === me.alliance_id ? 'ally' : 'player'; }
const RING = { me: '#ffd24a', ally: '#7fe6a0', player: '#ffffff', npc: '#8d93a6' };

/** Gli eserciti che marciano contro il mio villaggio (li vede chiunque: sulla mappa tutti vedono tutto). */
export function threats() {
  const st = O.state, me = st.me; if (!me) return [];
  const seen = new Set(), out = [];
  for (const m of [...st.marches, ...(st.incoming || [])]) { if (m.target_id !== me.id || m.status !== 'march' || seen.has(m.id) || secsLeft(m.arrive_at) <= 0) continue; seen.add(m.id); out.push(m); }
  return out.sort((a, b) => Date.parse(a.arrive_at) - Date.parse(b.arrive_at));
}

/** Il segnalino di un villaggio: quelli delle persone sono medaglioni di legno col bordo pieno e una bandierina,
 *  quelli del computer sono di pietra grigia, col bordo tratteggiato e un ingranaggio. */
function marker(S, K, v, x, y, r, big) {
  const { c } = S, k = rel(v), npc = v.kind === 'npc';
  c.beginPath(); c.arc(x, y + r * 0.14, r + 2.5, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = npc ? '#3d404b' : '#2a1d12'; c.fill();
  c.strokeStyle = npc ? '#1c1d24' : '#1a1009'; c.lineWidth = k === 'me' ? 6 : 4.8; c.stroke();
  c.strokeStyle = RING[k]; c.lineWidth = k === 'me' ? 3.2 : 2.3; if (npc) c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
  K.tuzu2d(c, x, y, r * 0.66, !npc && k === 'me' ? MY_COLOR : v.color, dark(v.color) ? '#ffffff' : undefined);
  if (!big) return;
  if (npc) {                       // l'ingranaggio: lo muove il computer
    const gx = x + r * 0.78, gy = y - r * 0.78, gr = Math.max(3.4, r * 0.34);
    c.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12, rr = i % 2 ? gr : gr * 0.68; c.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr); } c.closePath(); c.fillStyle = '#c3c6d0'; c.fill(); c.strokeStyle = '#2e313c'; c.lineWidth = 1.2; c.stroke();
  } else {                         // la bandierina: è di una persona
    const fx = x + r * 0.66, fy = y - r * 0.5;
    c.strokeStyle = '#2a1708'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx, fy + r * 0.2); c.lineTo(fx, fy - r * 0.8); c.stroke();
    c.beginPath(); c.moveTo(fx, fy - r * 0.8); c.lineTo(fx + r * 0.62, fy - r * 0.56); c.lineTo(fx, fy - r * 0.3); c.closePath(); c.fillStyle = RING[k] === '#ffffff' ? '#ff6a5a' : RING[k]; c.fill(); c.strokeStyle = '#2a1708'; c.lineWidth = 1; c.stroke();
  }
  if (O.shielded(v)) { c.beginPath(); c.arc(x, y, r + 5, 0, TAU); c.fillStyle = 'rgba(140,220,255,0.16)'; c.fill(); c.strokeStyle = 'rgba(150,226,255,0.95)'; c.lineWidth = 2; c.stroke(); }
}
/** Il cartiglio col nome: pergamena per le persone, pietra per il computer, oro per me. */
function nameTag(c, K, s, x, y, k, fs) {
  if (k === 'npc') { const w = K.width(c, s, fs, 800) + 12; c.beginPath(); c.roundRect(x - w / 2, y - (fs + 5) / 2, w, fs + 5, 5); c.fillStyle = 'rgba(48,50,60,0.86)'; c.fill(); c.strokeStyle = 'rgba(200,204,216,0.4)'; c.lineWidth = 1; c.stroke(); K.txt(c, s, x, y + 0.5, fs, '#dfe1ea', 'center', 800); return; }
  const w = K.width(c, s, fs, 800) + 14;
  c.beginPath(); c.roundRect(x - w / 2, y - (fs + 6) / 2, w, fs + 6, 5); c.fillStyle = k === 'me' ? '#ffe9a8' : k === 'ally' ? '#dff3d2' : '#f5e8c8'; c.fill(); c.strokeStyle = k === 'me' ? '#8a5a1c' : '#4e351d'; c.lineWidth = k === 'me' ? 1.8 : 1.3; c.stroke();
  K.txt(c, s, x, y + 0.5, fs, K.PEN, 'center', 800);
}
const REGIONS = [['heart', 0, -4], ['north', 0, -78], ['south', 0, 80], ['east', 80, 0], ['west', -80, 0]];

function drawMap(S, K, ax, ay, aw, ah) {
  const { c, ui, A } = S, U = ui.online, cam = U.cam, z = cam.z, st = O.state, pulse = 0.5 + Math.sin(ui.time * 5) * 0.5;
  const X = (wx) => ax + aw / 2 + (wx - cam.x) * z, Y = (wy) => ay + ah / 2 + (wy - cam.y) * z;
  const x0 = cam.x - aw / 2 / z, x1 = cam.x + aw / 2 / z, y0 = cam.y - ah / 2 / z, y1 = cam.y + ah / 2 / z;
  // la cornice di legno
  { const g = c.createLinearGradient(0, ay - 7, 0, ay + ah + 7); g.addColorStop(0, '#6a4a2e'); g.addColorStop(1, '#332215');
    c.beginPath(); c.roundRect(ax - 6, ay - 3, aw + 12, ah + 12, 15); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    c.beginPath(); c.roundRect(ax - 6, ay - 6, aw + 12, ah + 12, 15); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(16,10,5,0.95)'; c.lineWidth = 2.5; c.stroke(); }
  c.save(); c.beginPath(); c.roundRect(ax, ay, aw, ah, 10); c.clip();
  c.fillStyle = '#2a72a6'; c.fillRect(ax, ay, aw, ah);
  W.paint(c, X, Y, z, x0, y0, x1, y1);
  // il reticolo delle vecchie carte: una riga ogni 20 quadretti
  c.strokeStyle = 'rgba(60,40,20,0.1)'; c.lineWidth = 1; c.beginPath();
  for (let gx = Math.ceil(x0 / 20) * 20; gx <= x1; gx += 20) { c.moveTo(X(gx), ay); c.lineTo(X(gx), ay + ah); }
  for (let gy = Math.ceil(y0 / 20) * 20; gy <= y1; gy += 20) { c.moveTo(ax, Y(gy)); c.lineTo(ax + aw, Y(gy)); }
  c.stroke();
  if (z >= 8.5) W.decor(c, X, Y, z, x0, y0, x1, y1);
  // i nomi delle terre, scritti grandi e leggeri sulla carta (da lontano stanno sopra i segnalini, che sono solo puntini)
  const lands = () => { if (z < 19) { const fs = Math.max(13, Math.min(34, z * 2.3)); c.save(); c.globalAlpha = z < 9 ? 0.92 : z < 12 ? 0.6 : 0.6 * (19 - z) / 7;
    for (const [id, rx, ry] of REGIONS) { const px = X(rx), py = Y(ry); if (px < ax - 200 || px > ax + aw + 200 || py < ay - 40 || py > ay + ah + 40) continue; const s = t('on_reg_' + id); c.font = 'italic 700 ' + fs + 'px ' + K.SERIF; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#4e351d'; drawText(c, s, px, py, { stroke: 'rgba(255,248,225,0.75)', lw: Math.max(3, Math.round(fs / 6)) }); }
    c.restore(); } };
  if (z >= 9) lands();
  // gli eserciti in marcia e i raduni
  for (const m of st.marches) {
    const a = O.byId(m.village_id), b = O.byId(m.target_id); if (!a || !b) continue;
    const mine = st.me && (m.village_id === st.me.id || st.troops.some(q => q.march_id === m.id && q.village_id === st.me.id)), onMe = st.me && m.target_id === st.me.id, col = mine ? '#ffd24a' : onMe ? '#ff4a3a' : '#ff8a70';
    c.setLineDash(m.status === 'gather' ? [2, 6] : [7, 5]); c.lineCap = 'round';
    c.strokeStyle = 'rgba(30,16,8,0.6)'; c.lineWidth = 4.4; c.beginPath(); c.moveTo(X(a.x), Y(a.y)); c.lineTo(X(b.x), Y(b.y)); c.stroke();
    c.strokeStyle = col; c.lineWidth = 2.2; c.stroke(); c.setLineDash([]);
    if (m.status === 'march' && m.depart_at && m.arrive_at) {
      const p = Math.max(0, Math.min(1, (O.now() - Date.parse(m.depart_at)) / Math.max(1, Date.parse(m.arrive_at) - Date.parse(m.depart_at)))), px = X(a.x + (b.x - a.x) * p), py = Y(a.y + (b.y - a.y) * p);
      c.beginPath(); c.arc(px, py + 1.5, 10.5, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      c.beginPath(); c.arc(px, py, 9.5, 0, TAU); c.fillStyle = '#2a1d12'; c.fill(); c.strokeStyle = col; c.lineWidth = 2.4; c.stroke();
      K.tuzuIcon(c, 'lancia', px - 1, py + 2, 6.5, mine ? MY_COLOR : a.color);
    } else if (m.status === 'gather') { c.beginPath(); c.arc(X(b.x), Y(b.y), 16 + pulse * 5, 0, TAU); c.strokeStyle = 'rgba(255,220,120,0.9)'; c.lineWidth = 2.5; c.stroke(); }
  }
  // i villaggi (solo quelli dentro il riquadro)
  const r = Math.max(6, Math.min(20, z * 0.62)), big = z >= 8, names = z >= 11, danger = threats().length > 0;
  for (const v of st.villages) {
    const px = X(v.x), py = Y(v.y);
    if (px < ax - 30 || px > ax + aw + 30 || py < ay - 30 || py > ay + ah + 30) continue;
    const k = rel(v);
    if (k === 'me') { c.beginPath(); c.arc(px, py, r + 6 + pulse * 4, 0, TAU); c.strokeStyle = danger ? 'rgba(255,74,58,0.95)' : 'rgba(255,210,74,0.85)'; c.lineWidth = danger ? 3.5 : 2.5; c.stroke(); }
    if ((names || k !== 'npc') && (big || k === 'me')) { const al = O.allianceOf(v); nameTag(c, K, (al ? '[' + al.tag + '] ' : '') + v.name, px, py + r + 12, k, k === 'npc' ? 10.5 : 12); }
    marker(S, K, v, px, py, r, big);
    if (big) { const lv = String(O.levelOf(v)), bx = px - r * 0.82, by = py - r * 0.82; c.beginPath(); c.arc(bx, by, 7.5, 0, TAU); c.fillStyle = v.kind === 'npc' ? '#555a6c' : '#8a5a1c'; c.fill(); c.strokeStyle = 'rgba(255,244,214,0.85)'; c.lineWidth = 1.2; c.stroke(); K.txt(c, lv, bx, by + 0.5, 9.5, '#fff', 'center', 800); }
  }
  K.flushIcons(c);
  if (z < 9) lands();
  const sel = U.sel && O.byId(U.sel);
  if (sel) { c.beginPath(); c.arc(X(sel.x), Y(sel.y), r + 10 + pulse * 3, 0, TAU); c.strokeStyle = 'rgba(30,16,8,0.7)'; c.lineWidth = 5; c.setLineDash([6, 5]); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.stroke(); c.setLineDash([]); }
  // i bordi un po' in ombra, come una carta sotto vetro
  { const g = c.createRadialGradient(ax + aw / 2, ay + ah / 2, Math.min(aw, ah) * 0.45, ax + aw / 2, ay + ah / 2, Math.hypot(aw, ah) * 0.6); g.addColorStop(0, 'rgba(30,18,8,0)'); g.addColorStop(1, 'rgba(30,18,8,0.34)'); c.fillStyle = g; c.fillRect(ax, ay, aw, ah); }
  // casa mia è fuori dal riquadro: una freccia d'oro sul bordo dice da che parte sta
  if (st.me) { const hx = X(st.me.x), hy = Y(st.me.y); if (hx < ax || hx > ax + aw || hy < ay || hy > ay + ah) {
    const cx = ax + aw / 2, cy = ay + ah / 2, ang = Math.atan2(hy - cy, hx - cx), k = Math.min((aw / 2 - 26) / Math.abs(Math.cos(ang) || 1e-6), (ah / 2 - 26) / Math.abs(Math.sin(ang) || 1e-6)), px = cx + Math.cos(ang) * k, py = cy + Math.sin(ang) * k;
    c.save(); c.translate(px, py); c.rotate(ang); c.beginPath(); c.moveTo(15, 0); c.lineTo(-8, -11); c.lineTo(-3, 0); c.lineTo(-8, 11); c.closePath(); c.fillStyle = danger ? '#ff4a3a' : '#ffd24a'; c.fill(); c.strokeStyle = '#2a1708'; c.lineWidth = 2; c.stroke(); c.restore(); } }
  c.restore();
  c.beginPath(); c.roundRect(ax, ay, aw, ah, 10); c.strokeStyle = 'rgba(24,14,6,0.9)'; c.lineWidth = 3; c.stroke(); c.strokeStyle = 'rgba(233,196,106,0.85)'; c.lineWidth = 1.4; c.stroke();
  ui.onlineGeo = { ax, ay, aw, ah };
  ui.buttons.push({ x: ax, y: ay, w: aw, h: ah, tag: 'worldArea', fn: (lx, ly) => A.onlineTap(cam.x + (lx - ax - aw / 2) / z, cam.y + (ly - ay - ah / 2) / z) });
  compass(c, ax + aw - 40, ay + ah - 40, 25);
  // zoom, «casa mia» e «trovami un bersaglio»
  K.button(c, ui, ax + aw - 52, ay + 10, 42, 42, '+', { color: '#5c4330', fs: 24, r: 21, tag: 'wZoomIn' }, () => A.onlineZoom(1.3));
  K.button(c, ui, ax + aw - 52, ay + 58, 42, 42, '−', { color: '#5c4330', fs: 24, r: 21, tag: 'wZoomOut' }, () => A.onlineZoom(1 / 1.3));
  if (st.me) {
    K.button(c, ui, ax + aw - 52, ay + 106, 42, 42, '', { color: '#8a5a1c', r: 21, tag: 'wHome' }, A.onlineHome); K.buildIcon(c, 'castello', ax + aw - 31, ay + 128, 10, 0);
    K.button(c, ui, ax + aw - 52, ay + 154, 42, 42, '', { color: '#a8322a', r: 21, tag: 'wFind' }, A.onlineFind);
    { const tx = ax + aw - 31, ty = ay + 175; c.strokeStyle = '#fff3d6'; c.lineWidth = 2; c.beginPath(); c.arc(tx, ty, 9, 0, TAU); c.stroke(); c.beginPath(); c.arc(tx, ty, 4, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(tx - 13, ty); c.lineTo(tx - 6, ty); c.moveTo(tx + 6, ty); c.lineTo(tx + 13, ty); c.moveTo(tx, ty - 13); c.lineTo(tx, ty - 6); c.moveTo(tx, ty + 6); c.lineTo(tx, ty + 13); c.stroke(); }
  }
  // la legenda: la differenza fra persone e computer
  const lw = 62 + K.width(c, t('on_legPlayer'), 12.5, 800) + K.width(c, t('on_legNpc'), 12.5, 800), ly = ay + ah - 36;
  K.scroll(c, ax + 10, ly, lw, 26, 8);
  c.beginPath(); c.arc(ax + 25, ly + 13, 6.5, 0, TAU); c.fillStyle = '#2a1d12'; c.fill(); c.strokeStyle = '#8a2f24'; c.lineWidth = 2.2; c.stroke(); K.txt(c, t('on_legPlayer'), ax + 37, ly + 14, 12.5, K.PEN, 'left', 800);
  const lx2 = ax + 53 + K.width(c, t('on_legPlayer'), 12.5, 800); c.beginPath(); c.arc(lx2, ly + 13, 6.5, 0, TAU); c.fillStyle = '#3d404b'; c.fill(); c.strokeStyle = '#8d93a6'; c.lineWidth = 2; c.setLineDash([3, 2.5]); c.stroke(); c.setLineDash([]); K.txt(c, t('on_legNpc'), lx2 + 12, ly + 14, 12.5, K.PEN2, 'left', 800);
}

/** La scelta dei soldati: quanti e quali mandare. Rende la y dopo l'ultima riga. */
function picker(S, K, x, y, w) {
  const { c, world, ui, A } = S, P = ui.online.pick, have = world.pvpArmy(), tgt = O.byId(P.target), me = O.state.me;
  let yy = y;
  for (const u of UNIT_ORDER) {
    const max = have[u] || 0; if (!max) continue;
    const n = Math.min(max, P.army[u] || 0);
    K.card(c, x, yy, w, 40, !!n);
    K.txt(c, t('u_' + u), x + 44, yy + 21, 15, K.CREAM, 'left', 800);
    K.txt(c, n + '/' + max, x + w - 100, yy + 21, 16, K.CREAM, 'center', 800);
    K.tuzuIcon(c, u, x + 22, yy + 24, 10, MY_COLOR);
    K.button(c, ui, x + w - 172, yy + 4, 36, 32, '−', { color: '#5c4330', disabled: n <= 0, fs: 20, r: 9, tag: 'pk_' + u + '_m' }, () => A.onlinePick(u, -1));
    K.button(c, ui, x + w - 64, yy + 4, 36, 32, '+', { color: '#2f7d3a', disabled: n >= max, fs: 20, r: 9, tag: 'pk_' + u + '_p' }, () => A.onlinePick(u, 1));
    yy += 44;
  }
  if (yy === y) { K.wrap(c, t('on_noArmy'), x, yy + 12, w, 14.5, K.BAD, 20, 'left'); return yy + 50; }
  K.button(c, ui, x, yy + 2, 120, 32, t('on_all'), { color: '#5c4330', fs: 14, r: 9, tag: 'pkAll' }, () => A.onlinePick(null, 99));
  const pw = O.armyPower(P.army), df = tgt ? O.defenseOf(tgt) : 0, odds = pw < df * 0.9 ? 'low' : pw < df * 1.15 ? 'even' : 'good';
  K.txt(c, t('on_force') + ' ' + pw + (P.mode !== 'join' ? ' / ' + df : ''), x + 132, yy + 12, 14, K.CREAM, 'left', 800);
  if (P.mode === 'attack') K.txt(c, t('odds_' + odds), x + 132, yy + 30, 13.5, odds === 'low' ? K.BAD : odds === 'even' ? '#ffd24a' : '#9ff0b4', 'left', 800);
  yy += 44;
  if (P.mode === 'rally') {       // quanto si aspettano i compagni
    K.txt(c, t('on_wait'), x, yy + 12, 13.5, K.DIM, 'left', 700); yy += 24;
    [10, 60, 360].forEach((mn, i) => K.button(c, ui, x + i * ((w - 12) / 3 + 6), yy, (w - 12) / 3, 34, mn < 60 ? mn + ' min' : mn / 60 + ' h', { color: P.mins === mn ? '#8a5a1c' : '#5c4330', fs: 14.5, r: 9, tag: 'pkMin' + mn }, () => A.onlineMins(mn)));
    yy += 44;
  }
  if (tgt && me && P.mode !== 'join') { K.txt(c, t('on_march', fmtH(O.travelSecs(me, tgt) * 1000)), x, yy + 10, 13.5, K.DIM, 'left', 700); yy += 24; }
  const n = O.armyCount(P.army);
  K.button(c, ui, x, yy, w - 110, 46, t(P.mode === 'rally' ? 'on_rallyGo' : P.mode === 'join' ? 'on_joinGo' : 'on_go'), { color: '#a8322a', disabled: !n || O.state.busy, fs: 17, tag: 'pkGo' }, A.onlineGo);
  K.button(c, ui, x + w - 102, yy, 102, 46, t('on_back'), { color: '#5c4330', fs: 15, tag: 'pkBack' }, A.onlineBack);
  return yy + 56;
}

/** Il pannello accanto alla mappa: il villaggio scelto e cosa ci puoi fare, oppure i tuoi eserciti in marcia. */
function infoPanel(S, K, x, y, w, h) {
  const { c, ui, A } = S, U = ui.online, st = O.state, me = st.me, tw = w - 32;
  K.panel(c, x, y, w, h, 14, 0.96);
  let yy = y + 16;
  if (U.pick) { const tg = O.byId(U.pick.target); K.txt(c, t(U.pick.mode === 'rally' ? 'on_rallyTitle' : U.pick.mode === 'join' ? 'on_joinTitle' : 'on_attackTitle') + (tg ? ' · ' + tg.name : ''), x + 16, yy + 10, 17, '#ffe9a8', 'left', 800); picker(S, K, x + 16, yy + 30, tw); return; }
  for (const m of threats().slice(0, 2)) {
    const from = O.byId(m.village_id) || (st.incoming || []).find(q => q.id === m.id) || {};
    c.beginPath(); c.roundRect(x + 12, yy - 4, tw + 8, 36, 9); c.fillStyle = 'rgba(168,50,42,0.92)'; c.fill(); c.strokeStyle = 'rgba(255,220,200,0.6)'; c.lineWidth = 1.2; c.stroke();
    K.txt(c, t('on_threat', from.name || from.from || '?'), x + 22, yy + 8, K.fit(c, t('on_threat', from.name || from.from || '?'), tw - 14, 13.5, 800), '#fff3d6', 'left', 800);
    K.txt(c, t('on_arrive', fmtH(secsLeft(m.arrive_at) * 1000)), x + 22, yy + 23, 12, '#ffd9cf', 'left', 700);
    if (O.byId(m.village_id)) ui.buttons.push({ x: x + 12, y: yy - 4, w: tw + 8, h: 36, tag: 'wThreat', fn: () => A.onlineFocus(m.village_id) });
    yy += 42;
  }
  const v = U.sel && O.byId(U.sel);
  if (v) {
    const k = rel(v), al = O.allianceOf(v), lvl = O.levelOf(v);
    K.head(c, v.name, x + 62, yy + 10, K.fit(c, v.name, tw - 50, 20, 700, true), '#ffe9a8');
    K.txt(c, (v.kind === 'npc' ? t('on_npc') : t('on_player')) + ' · ' + t('level') + ' ' + lvl + (al ? ' · [' + al.tag + '] ' + al.name : ''), x + 62, yy + 32, 13, v.kind === 'npc' ? '#cfd2dc' : K.CREAM, 'left', 700);
    marker(S, K, v, x + 34, yy + 20, 18, true);
    yy += 58;
    K.txt(c, t('on_force') + ' ' + O.defenseOf(v) + (v.kind === 'player' ? '   ·   ' + t('on_score') + ' ' + v.score + '   ·   ' + t('on_wins') + ' ' + v.wins : ''), x + 16, yy, 14, K.CREAM, 'left', 700); yy += 22;
    if (me && k !== 'me') { K.txt(c, t('on_dist', Math.round(Math.hypot(v.x - me.x, v.y - me.y))) + ' · ' + t('on_march', fmtH(O.travelSecs(me, v) * 1000)), x + 16, yy, 13.5, K.DIM, 'left', 700); yy += 22; }
    if (O.shielded(v)) { K.txt(c, t('on_shield', fmtH(secsLeft(v.shield_until) * 1000)), x + 16, yy, 13.5, '#9fe9ff', 'left', 800); yy += 22; }
    yy += 6;
    if (k === 'me') { K.button(c, ui, x + 16, yy, tw, 42, t('on_rename'), { color: '#5c4330', fs: 16, tag: 'wRename' }, A.onlineRename); yy += 50; }
    else if (k === 'ally') { K.txt(c, t('on_isAlly'), x + 16, yy + 8, 14, '#9ff0b4', 'left', 800); yy += 30; }
    else if (me) {
      const open = st.marches.find(m => m.kind === 'rally' && m.status === 'gather' && m.target_id === v.id && me.alliance_id && m.alliance_id === me.alliance_id), sh = O.shielded(v);
      K.button(c, ui, x + 16, yy, tw, 46, t('attack'), { color: '#a8322a', disabled: sh, fs: 18, tag: 'wAttack' }, () => A.onlinePickOpen('attack', v.id)); yy += 54;
      if (me.alliance_id) { K.button(c, ui, x + 16, yy, tw, 42, t(open ? 'on_joinRally' : 'on_rally'), { color: '#5b4a8a', disabled: sh, fs: 16, tag: 'wRally' }, () => A.onlinePickOpen(open ? 'join' : 'rally', v.id, open && open.id)); yy += 50; }
    }
  } else { yy = K.wrap(c, t(me ? 'on_hint' : 'on_hintJoin'), x + 16, yy + 10, tw, 14.5, K.CREAM, 20, 'left') + 26; }
  if (U.msg && U.msgT > 0) { yy = K.wrap(c, U.msg, x + 16, yy + 6, tw, 14, U.bad ? K.BAD : '#9ff0b4', 19, 'left') + 22; }
  // i miei eserciti fuori casa
  if (!me) return;
  const mine = st.marches.filter(m => st.troops.some(q => q.march_id === m.id && q.village_id === me.id));
  if (!mine.length || yy + 60 > y + h) return;
  K.rule(c, x + 16, yy, tw); yy += 18;
  K.txt(c, t('on_myMarches'), x + 16, yy, 14.5, K.CREAM, 'left', 800); yy += 16;
  for (const m of mine) {
    if (yy + 40 > y + h - 6) break;
    const tg = O.byId(m.target_id), tr = st.troops.find(q => q.march_id === m.id && q.village_id === me.id), lead = m.village_id === me.id;
    K.card(c, x + 16, yy, tw, 38, false);
    K.txt(c, (m.kind === 'rally' ? '⚑ ' : '') + (tg ? tg.name : '?') + ' · ' + O.armyCount(tr && tr.army), x + 26, yy + 13, 13, K.CREAM, 'left', 800);
    K.txt(c, m.status === 'gather' ? t('on_gather', fmtH(secsLeft(m.gather_until) * 1000)) : t('on_arrive', fmtH(secsLeft(m.arrive_at) * 1000)), x + 26, yy + 28, 12, '#ffe9a8', 'left', 700);
    if (m.status === 'gather' && lead) K.button(c, ui, x + 16 + tw - 96, yy + 4, 90, 30, t('on_launch'), { color: '#a8322a', fs: 13, r: 8, tag: 'wLaunch' }, () => A.onlineLaunch(m.id));
    ui.buttons.push({ x: x + 16, y: yy, w: tw - 100, h: 38, tag: 'wMarch', fn: () => A.onlineFocus(m.target_id) });
    yy += 42;
  }
}

function rankTab(S, K, x, y, w, h) {
  const { c } = S, st = O.state, me = st.me, tall = S.tall, cw = tall ? w : (w - 14) / 2;
  const players = st.villages.filter(v => v.kind === 'player').sort((a, b) => b.score - a.score);
  const al = st.alliances.map(a => { const ms = st.villages.filter(v => v.alliance_id === a.id); return { a, n: ms.length, score: ms.reduce((s, v) => s + v.score, 0) }; }).sort((p, q) => q.score - p.score);
  const list = (lx, ly, lh, title, rows) => {
    K.panel(c, lx, ly, cw, lh, 14, 0.96); K.head(c, title, lx + 16, ly + 22, 18);
    let yy = ly + 44; const max = Math.floor((lh - 52) / 30);
    rows.slice(0, max).forEach((r, i) => { if (r.me) { c.beginPath(); c.roundRect(lx + 8, yy - 13, cw - 16, 28, 8); c.fillStyle = 'rgba(138,90,28,0.6)'; c.fill(); }
      K.txt(c, String(r.pos || i + 1), lx + 28, yy + 1, 14, i < 3 ? '#ffd24a' : K.DIM, 'center', 800); K.txt(c, r.name, lx + 50, yy + 1, 14.5, K.CREAM, 'left', 800); K.txt(c, r.info, lx + cw - 96, yy + 1, 12.5, K.DIM, 'right', 700); K.txt(c, String(r.score), lx + cw - 16, yy + 1, 15, '#ffe9a8', 'right', 800); if (r.id) S.ui.buttons.push({ x: lx + 8, y: yy - 13, w: cw - 16, h: 28, tag: 'wRankRow', fn: () => S.A.onlineShow(r.id) }); yy += 30; });
    if (!rows.length) K.txt(c, t('on_empty'), lx + 16, yy + 4, 14, K.DIM, 'left', 600);
  };
  const rows = players.map((v, i) => ({ id: v.id, pos: i + 1, name: (O.allianceOf(v) ? '[' + O.allianceOf(v).tag + '] ' : '') + v.name, info: t('level') + ' ' + v.castle + ' · ' + t('on_wins') + ' ' + v.wins, score: v.score, me: !!me && v.id === me.id }));
  const top = rows.slice(0, 50), mi = rows.findIndex(r => r.me);
  const lh = tall ? (h - 12) * 0.6 : h, maxRows = Math.floor((lh - 52) / 30);
  if (mi >= maxRows) top.splice(maxRows - 1, top.length, rows[mi]);       // se sono fuori dalla lista, la mia riga sta in fondo
  list(x, y, lh, t('on_rankPlayers') + ' · ' + players.length, top);
  list(tall ? x : x + cw + 14, tall ? y + lh + 12 : y, tall ? h - lh - 12 : h, t('on_rankAllies'), al.map(o => ({ name: '[' + o.a.tag + '] ' + o.a.name, info: t('on_members', o.n), score: o.score, me: !!me && me.alliance_id === o.a.id })));
}

function allyTab(S, K, x, y, w, h) {
  const { c, ui, A } = S, st = O.state, me = st.me;
  K.panel(c, x, y, w, h, 14, 0.96);
  if (!me) { K.wrap(c, t('on_hintJoin'), x + 18, y + 30, w - 36, 15, K.CREAM, 21, 'left'); return; }
  const mine = O.allianceOf(me);
  let yy = y + 26;
  if (!mine) {
    K.head(c, t('on_noAlliance'), x + 18, yy, 18);
    K.button(c, ui, x + w - 218, y + 8, 200, 38, t('on_create'), { color: '#2f7d3a', fs: 15.5, r: 10, tag: 'aCreate' }, A.onlineAllyCreate);
    yy += 30;
    const list = st.alliances.map(a => ({ a, n: st.villages.filter(v => v.alliance_id === a.id).length })).sort((p, q) => q.n - p.n);
    if (!list.length) K.wrap(c, t('on_noAlliances'), x + 18, yy + 10, w - 36, 14.5, K.DIM, 20, 'left');
    for (const o of list) {
      if (yy + 44 > y + h - 8) break;
      K.card(c, x + 14, yy, w - 28, 40, false);
      K.txt(c, '[' + o.a.tag + '] ' + o.a.name, x + 28, yy + 21, 15.5, K.CREAM, 'left', 800); K.txt(c, t('on_members', o.n) + '/20', x + w - 150, yy + 21, 13, K.DIM, 'right', 700);
      K.button(c, ui, x + w - 138, yy + 4, 120, 32, t('on_enter'), { color: '#5b4a8a', disabled: o.n >= 20 || st.busy, fs: 14.5, r: 9, tag: 'aJoin' }, () => A.onlineAllyJoin(o.a.id));
      yy += 46;
    }
    return;
  }
  const members = st.villages.filter(v => v.alliance_id === mine.id).sort((a, b) => b.score - a.score), lead = mine.leader === me.id;
  K.head(c, '[' + mine.tag + '] ' + mine.name, x + 18, yy, 20);
  K.txt(c, t('on_members', members.length) + '/20 · ' + t('on_score') + ' ' + members.reduce((s, v) => s + v.score, 0), x + 18, yy + 22, 13, K.DIM, 'left', 700);
  K.button(c, ui, x + w - 138, y + 10, 120, 36, t('on_leave'), { color: '#7a3a2c', disabled: st.busy, fs: 14.5, r: 10, tag: 'aLeave' }, A.onlineAllyLeave);
  yy += 44;
  const rallies = st.marches.filter(m => m.kind === 'rally' && m.alliance_id === mine.id);
  if (rallies.length) { K.txt(c, t('on_rallies'), x + 18, yy + 6, 14.5, K.CREAM, 'left', 800); yy += 22; }
  for (const m of rallies) {
    if (yy + 46 > y + h - 8) break;
    const tg = O.byId(m.target_id), ld = O.byId(m.village_id), trs = st.troops.filter(q => q.march_id === m.id), tot = trs.reduce((s, q) => s + O.armyCount(q.army), 0), pw = trs.reduce((s, q) => s + O.armyPower(q.army), 0), inIt = trs.some(q => q.village_id === me.id);
    c.beginPath(); c.roundRect(x + 14, yy, w - 28, 42, 10); c.fillStyle = 'rgba(138,90,28,0.35)'; c.fill();
    K.txt(c, '⚑ ' + (tg ? tg.name : '?') + ' · ' + t('on_by') + ' ' + (ld ? ld.name : '?'), x + 26, yy + 14, 14, K.CREAM, 'left', 800);
    K.txt(c, t('on_rallyInfo', tot) + ' · ' + t('on_force') + ' ' + pw + (tg ? ' / ' + O.defenseOf(tg) : '') + ' · ' + (m.status === 'gather' ? t('on_gather', fmtH(secsLeft(m.gather_until) * 1000)) : t('on_arrive', fmtH(secsLeft(m.arrive_at) * 1000))), x + 26, yy + 31, 12, '#ffe9a8', 'left', 700);
    if (m.status === 'gather') K.button(c, ui, x + w - 138, yy + 5, 120, 32, t(inIt ? 'on_addMore' : 'on_joinRally'), { color: '#5b4a8a', fs: 13.5, r: 9, tag: 'aRallyJoin' }, () => A.onlinePickOpen('join', m.target_id, m.id));
    yy += 48;
  }
  K.txt(c, t('on_membersTitle'), x + 18, yy + 6, 14.5, K.CREAM, 'left', 800); yy += 22;
  for (const v of members) {
    if (yy + 32 > y + h - 8) break;
    K.txt(c, (mine.leader === v.id ? '★ ' : '') + v.name, x + 26, yy + 8, 14.5, v.id === me.id ? '#ffe9a8' : K.CREAM, 'left', 800);
    K.txt(c, t('level') + ' ' + v.castle + ' · ' + t('on_force') + ' ' + O.defenseOf(v) + ' · ' + v.score, x + w - (lead && v.id !== me.id ? 110 : 22), yy + 8, 12.5, K.DIM, 'right', 700);
    if (lead && v.id !== me.id) K.button(c, ui, x + w - 100, yy - 6, 82, 28, t('on_kick'), { color: '#7a3a2c', fs: 12.5, r: 8, tag: 'aKick' }, () => A.onlineKick(v.id));
    yy += 32;
  }
}

/** Una riga di parole per un rapporto. */
export function reportLine(r) {
  const d = r.data || {}, lost = O.armyCount(d.sent) - O.armyCount(d.back);
  if (r.kind === 'won') return t('on_rWon', d.target) + (lost > 0 ? ' · ' + t('on_rLost', lost) : '');
  if (r.kind === 'lost') return t('on_rLostBattle', d.target) + ' · ' + t('on_rLost', lost);
  if (r.kind === 'bounced') return t('on_rBounced', d.target);
  if (r.kind === 'raided') return t('on_rRaided', d.by);
  if (r.kind === 'defended') return t('on_rDefended', d.by);
  return r.kind;
}
function reportsTab(S, K, x, y, w, h) {
  const { c } = S, st = O.state;
  K.panel(c, x, y, w, h, 14, 0.96);
  K.head(c, t('on_reports'), x + 18, y + 24, 18);
  let yy = y + 46;
  if (!st.reports.length) K.txt(c, t('on_empty'), x + 18, yy + 8, 14, K.DIM, 'left', 600);
  for (const r of st.reports) {
    if (yy + 46 > y + h - 8) break;
    const d = r.data || {}, good = r.kind === 'won' || r.kind === 'defended', loot = r.kind === 'won' ? d.loot : r.kind === 'raided' ? d.lost : null;
    c.beginPath(); c.roundRect(x + 14, yy, w - 28, 42, 10); c.fillStyle = good ? 'rgba(74,92,58,0.7)' : r.kind === 'bounced' ? 'rgba(255,255,255,0.07)' : 'rgba(122,58,44,0.6)'; c.fill();
    K.txt(c, (d.rally ? '⚑ ' : '') + reportLine(r), x + 26, yy + 14, 14, K.CREAM, 'left', 800);
    K.txt(c, clock(Date.parse(r.at) - O.state.offset), x + w - 26, yy + 14, 12, K.DIM, 'right', 700);
    if (loot) { const o = {}; for (const k in loot) if (loot[k] > 0) o[k] = loot[k]; if (Object.keys(o).length) { if (r.kind === 'won') K.costRowPlain(c, o, x + 26, yy + 31, 13); else K.txt(c, Object.keys(o).map(k => '−' + o[k] + ' ' + t('r_' + k)).join(' · '), x + 26, yy + 31, 12.5, K.BAD, 'left', 700); } }
    yy += 48;
  }
}

/** Tutto lo schermo del mondo. */
export function worldPanel(S, K) {
  const { c, ui, vw, vh, A } = S, U = ui.online, st = O.state, pad = 12, tall = S.tall;
  c.fillStyle = 'rgba(14,12,22,0.95)'; c.fillRect(0, 0, vw, vh); K.block(ui, 0, 0, vw, vh);
  // in alto: le schede e la chiusura
  const tw = Math.min(170, (vw - pad * 2 - 56 - 18) / 4);
  TABS.forEach((k, i) => K.button(c, ui, pad + i * (tw + 6), pad, tw, 42, t('on_tab_' + k), { color: U.tab === k ? '#8a5a1c' : '#5c4330', fs: tw < 140 ? 14 : 16.5, r: 10, tag: 'wTab_' + k }, () => A.onlineTab(k)));
  K.button(c, ui, vw - pad - 44, pad, 44, 42, '', { color: '#7a3a2c', r: 21, tag: 'wClose' }, A.onlineClose); K.cross(c, vw - pad - 22, pad + 21, 10);
  const x = pad, y = pad + 54, w = vw - pad * 2, h = vh - y - pad;
  // chi non è entrato, o il mondo che non c'è ancora
  const gate = !cloud.state.user ? 'on_needAccount' : st.ready === false ? 'on_soon' : st.ready == null ? 'on_loading' : null;
  if (gate) {
    // la carta del mondo si vede comunque: chi non è entrato capisce che cosa lo aspetta
    drawMap(S, K, x + 6, y + 6, w - 12, h - 12);
    c.fillStyle = 'rgba(14,12,22,0.5)'; c.beginPath(); c.roundRect(x + 6, y + 6, w - 12, h - 12, 10); c.fill(); K.block(ui, x, y, w, h);
    const bw = Math.min(560, w - 40), bh = gate === 'on_needAccount' ? 190 : 110, bx = vw / 2 - bw / 2, by = y + h / 2 - bh / 2;
    K.scroll(c, bx, by, bw, bh, 14);
    K.wrap(c, t(gate), vw / 2, by + 40, bw - 48, 17, K.PEN, 24);
    if (gate === 'on_needAccount') K.button(c, ui, vw / 2 - 150, by + bh - 70, 300, 52, t('cloudGoogle') + ' / ' + t('account'), { color: '#2f5d7a', fs: 17, tag: 'wAccount' }, A.onlineAccount);
    return;
  }
  if (!st.me && U.tab !== 'rank') {
    // prima volta: si dà un nome al villaggio e lo si mette sulla mappa
    if (U.tab === 'map') {
      const side = tall ? 0 : 340, ih = tall ? 150 : 0;
      drawMap(S, K, x, y, w - side - (side ? pad : 0), h - ih - (ih ? pad : 0));
      const px = tall ? x : x + w - side, py = tall ? y + h - ih : y, pw = tall ? w : side, ph = tall ? ih : h;
      K.panel(c, px, py, pw, ph, 14, 0.96);
      K.wrap(c, t('on_hintJoin'), px + 16, py + 24, pw - 32, 14.5, K.CREAM, 20, 'left');
      K.button(c, ui, px + 16, py + ph - 62, pw - 32, 48, t('on_join'), { color: '#2f7d3a', disabled: st.busy, fs: 18, tag: 'wJoin' }, A.onlineJoin);
      if (U.msg && U.msgT > 0) K.txt(c, U.msg, px + 16, py + ph - 78, 13.5, K.BAD, 'left', 700);
      return;
    }
  }
  if (U.tab === 'map') {
    const side = tall ? 0 : Math.min(360, w * 0.32), ih = tall ? Math.min(430, h * 0.42) : 0;
    drawMap(S, K, x, y, w - side - (side ? pad : 0), h - ih - (ih ? pad : 0));
    infoPanel(S, K, tall ? x : x + w - side, tall ? y + h - ih : y, tall ? w : side, tall ? ih : h);
  } else if (U.tab === 'rank') rankTab(S, K, x, y, w, h);
  else if (U.tab === 'ally') allyTab(S, K, x, y, w, h);
  else reportsTab(S, K, x, y, w, h);
  if (st.err && st.err !== 'soon') K.txt(c, t('on_net'), vw / 2, vh - 22, 13, K.BAD, 'center', 700);
}

/** L'icona del mondo (un globo). */
export function globeIcon(c, x, y, s) {
  c.beginPath(); c.arc(x, y, s, 0, TAU); c.fillStyle = '#4fb4de'; c.fill(); c.strokeStyle = '#17425c'; c.lineWidth = 1.8; c.stroke();
  c.save(); c.beginPath(); c.arc(x, y, s - 0.8, 0, TAU); c.clip();
  c.fillStyle = '#5fbf5a'; c.beginPath(); c.ellipse(x - s * 0.35, y - s * 0.25, s * 0.5, s * 0.4, 0.4, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + s * 0.45, y + s * 0.4, s * 0.45, s * 0.34, -0.3, 0, TAU); c.fill();
  c.restore();
}

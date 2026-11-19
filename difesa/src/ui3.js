// Interfaccia del secondo giro di tappe: la mappa intera (da lì si mandano gli esploratori), il rapporto di una spedizione,
// il dito del Tuzu guida, il gruppo di soldati scelto, i trofei. Come ui2.js: ogni funzione riceve S (il fotogramma) e K (gli attrezzi).
import { G, COLS, ROWS, WORLD_W, WORLD_H, TRIBES, MY_COLOR, RUINS, FOG, FW, FH, PEAKS, HILLS, NATURE, TRAITS, TROPHIES, BUILD } from './data.js';
import { t } from './i18n.js';

const TAU = Math.PI * 2;
/** L'ora di un momento, come su un orologio: 17:40. */
export function clock(ms) { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
/** Ore e minuti che mancano, in parole corte. */
export function fmtH(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '');
}

// ---------- la mappa intera ----------
let mini = null, miniRev = -1;
/** La mappa dipinta, rimpicciolita (si rifà solo quando cambiano le strade), con sopra montagne, colline e boschi (che nel gioco sono in 3D). */
function miniMap(src, rev = 0) {
  if ((mini && miniRev === rev) || !src) return mini;
  miniRev = rev;
  const k = 0.2, c0 = document.createElement('canvas'); c0.width = Math.round(WORLD_W * k); c0.height = Math.round(WORLD_H * k);
  const c = c0.getContext('2d');
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(src, 0, 0, c0.width, c0.height);
  c.setTransform(k, 0, 0, k, 0, 0);
  for (const h of HILLS) { c.beginPath(); c.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU); c.fillStyle = 'rgba(46,110,50,0.55)'; c.fill(); c.beginPath(); c.ellipse(h.x - h.rx * 0.18, h.y - h.ry * 0.22, h.rx * 0.6, h.ry * 0.55, 0, 0, TAU); c.fillStyle = 'rgba(120,180,90,0.5)'; c.fill(); }
  for (const n of NATURE) if (n.kind === 'tree') { c.beginPath(); c.arc((n.c + 0.5) * G, (n.r + 0.5) * G, 17, 0, TAU); c.fillStyle = n.tint > 3 ? 'rgba(34,92,60,0.85)' : 'rgba(52,128,62,0.85)'; c.fill(); }
  for (const p of [...PEAKS].sort((a, b) => a.y - b.y)) {
    const r = p.r * 1.15;
    c.beginPath(); c.moveTo(p.x - r, p.y + r * 0.5); c.lineTo(p.x, p.y - r * 1.1); c.lineTo(p.x + r, p.y + r * 0.5); c.closePath(); c.fillStyle = '#8f8c86'; c.fill();
    c.beginPath(); c.moveTo(p.x, p.y - r * 1.1); c.lineTo(p.x + r, p.y + r * 0.5); c.lineTo(p.x + r * 0.2, p.y + r * 0.5); c.closePath(); c.fillStyle = 'rgba(60,58,56,0.35)'; c.fill();
    if (p.snow) { c.beginPath(); c.moveTo(p.x - r * 0.34, p.y - r * 0.56); c.lineTo(p.x, p.y - r * 1.1); c.lineTo(p.x + r * 0.34, p.y - r * 0.56); c.closePath(); c.fillStyle = '#f4f6fb'; c.fill(); }
  }
  mini = c0;
  return mini;
}
/** L'icona della mappa (un foglio piegato in tre con un segnalino). */
export function mapIcon(c, x, y, s) {
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  const pts = [[-1.25, -0.7], [-0.42, -0.95], [0.42, -0.7], [1.25, -0.95], [1.25, 0.75], [0.42, 1], [-0.42, 0.75], [-1.25, 1]];
  c.beginPath(); pts.forEach(([px, py], i) => { if (i) c.lineTo(px * s, py * s); else c.moveTo(px * s, py * s); }); c.closePath();
  c.fillStyle = '#efe4c8'; c.fill(); c.strokeStyle = '#5c4a2e'; c.lineWidth = 1.8; c.stroke();
  c.beginPath(); c.moveTo(-0.42 * s, -0.95 * s); c.lineTo(-0.42 * s, 0.75 * s); c.moveTo(0.42 * s, -0.7 * s); c.lineTo(0.42 * s, 1 * s); c.strokeStyle = 'rgba(92,74,46,0.55)'; c.lineWidth = 1.3; c.stroke();
  c.beginPath(); c.arc(0.55 * s, -0.05 * s, 0.3 * s, 0, TAU); c.fillStyle = '#e0452f'; c.fill();
  c.restore();
}
/** Che cosa c'è in un punto della mappa: un villaggio noto, un popolo di cui si dice, una rovina, nuvole, o terra già vista. */
export function mapPick(world, x, y) {
  for (let i = 0; i < TRIBES.length; i++) {
    const vx = (TRIBES[i].c + 0.5) * G, vy = (TRIBES[i].r + 0.5) * G;
    if (Math.hypot(vx - x, vy - y) < 4.6 * G) return world.known(i) ? { kind: 'village', i, x: vx, y: vy } : { kind: 'fog', rumor: i, x: vx, y: vy };
  }
  for (const R of RUINS) { const rx = (R.c + 0.5) * G, ry = (R.r + 0.5) * G; if (!world.d.ruins[R.id] && world.seen(R.c, R.r) && Math.hypot(rx - x, ry - y) < 3.4 * G) return { kind: 'ruin', x: rx, y: ry, island: !!R.island }; }
  x = Math.max(G, Math.min(WORLD_W - G, x)); y = Math.max(G, Math.min(WORLD_H - G, y));
  return { kind: world.seen(Math.floor(x / G), Math.floor(y / G)) ? 'land' : 'fog', x, y };
}

export function mapPanel(S, K) {
  const { c, world, ui, vw, vh, A, now } = S, M = ui.map, pad = 12, side = Math.min(330, Math.max(270, vw * 0.25));
  c.fillStyle = 'rgba(14,12,22,0.93)'; c.fillRect(0, 0, vw, vh); K.block(ui, 0, 0, vw, vh);
  const aw = vw - side - pad * 3, ah = vh - pad * 2, k = Math.min(aw / WORLD_W, ah / WORLD_H), mw = WORLD_W * k, mh = WORLD_H * k, mx = pad + (aw - mw) / 2, my = pad + (ah - mh) / 2;
  const X = (x) => mx + x * k, Y = (y) => my + y * k, pulse = 0.5 + Math.sin(ui.time * 5) * 0.5;
  // il foglio
  c.save(); c.beginPath(); c.roundRect(mx, my, mw, mh, 10); c.clip();
  const img = miniMap(S.mapCv, S.roadRev);
  if (img) c.drawImage(img, mx, my, mw, mh); else { c.fillStyle = '#5f9f47'; c.fillRect(mx, my, mw, mh); }
  // il tuo villaggio: gli edifici come quadratini
  for (const b of world.d.buildings) {
    const D = BUILD[b.type]; if (D.deco) continue;
    c.fillStyle = b.type === 'castello' ? MY_COLOR : b.type === 'mura' || b.type === 'recinto' || b.type === 'cancello' ? '#6f6a64' : D.tower ? '#d8d2c4' : b.type === 'campo' ? '#c9a23c' : '#f1e6cc';
    c.fillRect(X(b.c * G), Y(b.r * G), Math.max(1.5, D.w * G * k), Math.max(1.5, D.h * G * k));
  }
  // le nuvole su quello che non hai visto
  if (S.fogCv && world.fogA.includes(0)) { c.globalAlpha = 0.97; c.drawImage(S.fogCv, mx, my, FW * FOG.cell * G * k, FH * FOG.cell * G * k); c.globalAlpha = 1; }
  // il pezzo che la camera guarda adesso
  if (S.cam) { const w = S.cam.dist * 1.5 * k, h = S.cam.dist * 0.82 * k; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6; c.strokeRect(X(S.cam.x) - w / 2, Y(S.cam.y) - h / 2 - h * 0.08, w, h); }
  c.restore();
  c.beginPath(); c.roundRect(mx, my, mw, mh, 10); c.strokeStyle = 'rgba(233,196,106,0.75)'; c.lineWidth = 2.5; c.stroke();
  ui.buttons.push({ x: mx, y: my, w: mw, h: mh, tag: 'mapArea', fn: (lx, ly) => A.mapTap((lx - mx) / k, (ly - my) / k) });
  ui.mapGeo = { mx, my, k };

  // rovine
  for (const R of RUINS) {
    if (!world.seen(R.c, R.r)) continue;
    const px = X((R.c + 0.5) * G), py = Y((R.r + 0.5) * G);
    if (world.d.ruins[R.id]) { c.beginPath(); c.arc(px, py, 4, 0, TAU); c.fillStyle = 'rgba(60,54,48,0.7)'; c.fill(); }
    else { c.beginPath(); c.moveTo(px, py - 9); c.lineTo(px + 7, py); c.lineTo(px, py + 9); c.lineTo(px - 7, py); c.closePath(); c.fillStyle = '#ffe27a'; c.fill(); c.strokeStyle = '#5c3a10'; c.lineWidth = 1.6; c.stroke(); K.txt(c, '?', px, py + 1, 11, '#5c3a10', 'center', 800); }
  }
  // il castello
  { const px = X(world.castle.x), py = Y(world.castle.y); c.beginPath(); c.arc(px, py, 13, 0, TAU); c.fillStyle = 'rgba(26,20,14,0.85)'; c.fill(); c.strokeStyle = MY_COLOR; c.lineWidth = 2.5; c.stroke(); K.buildIcon(c, 'castello', px, py, 8, 0); }
  // i villaggi: quelli che conosci col loro colore e il nome; degli altri si sa solo che ci sono
  TRIBES.forEach((T, i) => {
    const px = X((T.c + 0.5) * G), py = Y((T.r + 0.5) * G), v = world.d.villages[i];
    if (!world.known(i)) {
      c.beginPath(); c.arc(px, py, 12, 0, TAU); c.fillStyle = 'rgba(120,124,140,0.92)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.stroke();
      K.txt(c, '?', px, py + 1, 15, '#fff', 'center', 800);
      return;
    }
    const col = v.state === 'colony';
    c.beginPath(); c.arc(px, py, 14, 0, TAU); c.fillStyle = 'rgba(26,20,14,0.85)'; c.fill();
    c.strokeStyle = col ? MY_COLOR : v.state === 'ally' ? '#7fe6a0' : world.attackers(world.nextNight).includes(i) ? '#ff6a5a' : 'rgba(255,255,255,0.7)'; c.lineWidth = 2.5; c.stroke();
    K.tuzu2d(c, px, py, 9, col ? MY_COLOR : T.color, col ? '#2b2a33' : T.eyes);
    const nm = t('tr_' + T.id), w = K.width(c, nm, 11.5, 800) + 12;
    c.beginPath(); c.roundRect(px - w / 2, py + 16, w, 17, 8); c.fillStyle = 'rgba(26,20,14,0.8)'; c.fill(); K.txt(c, nm, px, py + 25, 11.5, K.CREAM, 'center', 800);
  });
  // le spedizioni in corso: la strada tratteggiata, dov'è adesso l'esploratore, la meta
  for (const tr of world.d.trips) {
    const s = world.tripFrom(tr), a = world.tripAt(tr, now);
    c.strokeStyle = tr.boat ? 'rgba(160,220,255,0.95)' : 'rgba(255,255,255,0.95)'; c.lineWidth = 2; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(X(s.x), Y(s.y)); c.lineTo(X(tr.x), Y(tr.y)); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(X(tr.x), Y(tr.y), 5 + pulse * 2, 0, TAU); c.strokeStyle = '#ffe27a'; c.lineWidth = 2.5; c.stroke();
    c.beginPath(); c.arc(X(a.x), Y(a.y), 11, 0, TAU); c.fillStyle = 'rgba(26,20,14,0.85)'; c.fill(); K.tuzuIcon(c, 'esplora', X(a.x), Y(a.y) + 2, 7, MY_COLOR);
    const s2 = fmtH(a.left), w = K.width(c, s2, 11.5, 800) + 12; c.beginPath(); c.roundRect(X(a.x) - w / 2, Y(a.y) - 31, w, 17, 8); c.fillStyle = 'rgba(26,20,14,0.85)'; c.fill(); K.txt(c, s2, X(a.x), Y(a.y) - 22, 11.5, '#ffe9a8', 'center', 800);
  }
  // il punto scelto
  const sel = M.sel;
  if (sel) { c.beginPath(); c.arc(X(sel.x), Y(sel.y), 15 + pulse * 5, 0, TAU); c.strokeStyle = '#fff'; c.lineWidth = 3; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]); }

  // ---- la colonna a destra: cosa hai scelto, e chi è in viaggio
  const x = vw - side - pad, y = pad, h = vh - pad * 2;
  K.panel(c, x, y, side, h, 14, 0.96);
  mapIcon(c, x + 32, y + 32, 13);
  K.txt(c, t('mapTitle'), x + 58, y + 33, 24, '#f2cf73', 'left', 800);
  K.button(c, ui, x + side - 52, y + 10, 42, 42, '', { color: '#3b3229', r: 21, tag: 'mapClose' }, A.mapClose); K.cross(c, x + side - 31, y + 31, 9);
  let yy = y + 78;
  const tw = side - 36;
  if (!sel) { yy = K.wrap(c, t('mapHint'), x + 18, yy, tw, 15.5, K.CREAM, 21, 'left') + 28; }
  else if (sel.kind === 'village') {
    const T = TRIBES[sel.i], v = world.village(sel.i), col = v.state === 'colony';
    K.tuzu2d(c, x + 36, yy + 8, 18, col ? MY_COLOR : T.color, col ? '#2b2a33' : T.eyes);
    K.txt(c, t('tr_' + T.id), x + 66, yy, 20, '#ffe9a8', 'left', 800);
    K.txt(c, col ? t('colony') : v.state === 'ally' ? t('allyTag') : t('level') + ' ' + v.level, x + 66, yy + 22, 14, K.DIM, 'left', 700);
    K.txt(c, t('chief') + ' ' + TRAITS[T.id].chief, x + 18, yy + 52, 14, K.CREAM, 'left', 600);
    K.button(c, ui, x + 18, yy + 72, tw, 48, t('mapGoVillage'), { color: '#2f7d3a', fs: 18, tag: 'mapGo' }, A.mapGo);
    yy += 140;
  } else if (sel.kind === 'land') {
    K.txt(c, t('mapLand'), x + 18, yy, 19, '#ffe9a8', 'left', 800);
    K.button(c, ui, x + 18, yy + 22, tw, 48, t('mapGo'), { color: '#2f7d3a', fs: 18, tag: 'mapGo' }, A.mapGo);
    yy += 92;
  } else {
    const chk = world.scoutCheck(sel.x, sel.y), ms = world.tripMs(sel.x, sel.y), boat = world.islandTrip(sel.x, sel.y);
    K.tuzuIcon(c, 'esplora', x + 36, yy + 10, 17, MY_COLOR);
    K.txt(c, t(sel.kind === 'ruin' ? 'ruinTitle' : sel.rumor != null ? 'rumorTitle' : 'fogTitle'), x + 66, yy + 2, 19, '#ffe9a8', 'left', 800);
    yy = K.wrap(c, t(sel.kind === 'ruin' ? (boat ? 'isleInfo' : 'ruinInfo') : sel.rumor != null ? 'rumorInfo' : 'fogInfo'), x + 18, yy + 40, tw, 14, K.DIM, 19, 'left') + 30;
    // quanto ci mette, e quanto costa
    c.beginPath(); c.arc(x + 30, yy, 10, 0, TAU); c.strokeStyle = '#ffe9a8'; c.lineWidth = 2.2; c.stroke(); c.beginPath(); c.moveTo(x + 30, yy - 6); c.lineTo(x + 30, yy); c.lineTo(x + 35, yy + 3); c.stroke();
    K.txt(c, t(boat ? 'tripBoat' : 'tripTakes', fmtH(ms)) + ' · ' + t('tripAt', clock(now + ms)), x + 48, yy + 1, 15, '#ffe9a8', 'left', 800);
    yy += 30; K.costRow(c, world, { monete: FOG.cost }, x + 20, yy, 17, 1, true);
    yy += 22; K.button(c, ui, x + 18, yy, tw, 52, t('sendScout'), { color: '#2f7d5a', disabled: chk !== 'ok', fs: 18, tag: 'scout' }, A.scout);
    yy += 66;
    if (chk !== 'ok') { K.txt(c, chk === 'full' ? t('scoutFull', world.tripsMax()) : chk === 'port' ? t('needPort') : t('why_cost'), x + 18, yy, 13.5, K.BAD, 'left', 700); yy += 22; }
    else { yy = K.wrap(c, t('tripNote'), x + 18, yy + 2, tw, 12.5, K.DIM, 16, 'left') + 22; }
  }
  if (M.msg && M.msgT > 0) { K.txt(c, M.msg, x + 18, yy, 14.5, '#9ff0b4', 'left', 800); yy += 26; }
  // chi è in viaggio
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 18, yy, tw, 1.5); yy += 22;
  K.txt(c, t('tripsOut') + ' ' + world.d.trips.length + '/' + world.tripsMax(), x + 18, yy, 15, K.CREAM, 'left', 800); yy += 18;
  for (const tr of world.d.trips) {
    if (yy + 50 > y + h - 66) break;
    const a = world.tripAt(tr, now), ask = M.recall === tr.id;
    c.beginPath(); c.roundRect(x + 18, yy, tw, 46, 10); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fill();
    K.tuzuIcon(c, 'esplora', x + 38, yy + 26, 9, MY_COLOR);
    if (ask) K.button(c, ui, x + 58, yy + 6, tw - 92, 34, t('recallAsk'), { color: '#7a3a2c', fs: 14, r: 9, tag: 'recallYes' }, () => A.recall(tr.id));
    else { K.bar(c, x + 60, yy + 28, tw - 96, 7, a.p, '#ffd24a'); K.txt(c, fmtH(a.left) + ' · ' + t('tripAt', clock(tr.at + tr.ms)), x + 60, yy + 15, 13, '#ffe9a8', 'left', 800); }
    K.button(c, ui, x + 18 + tw - 36, yy + 8, 30, 30, '', { color: ask ? '#3b3229' : '#4a3a34', r: 15, tag: 'recall' }, () => { M.recall = ask ? null : tr.id; }); K.cross(c, x + 18 + tw - 21, yy + 23, 6);
    yy += 52;
  }
  if (!world.d.trips.length) K.txt(c, t('tripsNone'), x + 18, yy + 6, 13, K.DIM, 'left', 600);
  K.button(c, ui, x + 18, y + h - 58, tw, 46, t('close'), { color: '#3b3229', fs: 19, tag: 'close' }, A.mapClose);
}

/** L'esploratore è tornato: cosa ha trovato. */
export function reportPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, R = world.d.reports[0];
  if (!R) return;
  K.dim(S, 0.66);
  const lines = R.found.length + (R.ruins ? 1 : 0) + R.items.length, w = 620, h = 236 + Math.max(1, lines) * 40, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  K.panel(c, x, y, w, h, 18, 0.97);
  c.beginPath(); c.arc(x + 64, y + 66, 40, 0, TAU); c.fillStyle = '#3a2f55'; c.fill(); c.strokeStyle = 'rgba(233,196,106,0.8)'; c.lineWidth = 2.5; c.stroke();
  K.tuzuIcon(c, 'esplora', x + 60, y + 78, 24, MY_COLOR);
  K.txt(c, t(R.boat ? 'reportBoat' : 'reportTitle'), x + 124, y + 48, 26, '#f2cf73', 'left', 800);
  K.txt(c, t('reportSub'), x + 124, y + 80, 15, K.DIM, 'left', 600);
  let yy = y + 138;
  for (const i of R.found) { const T = TRIBES[i]; K.tuzu2d(c, x + 46, yy, 14, T.color, T.eyes); K.txt(c, t('reportFound', t('tr_' + T.id)), x + 74, yy + 1, 18, K.CREAM, 'left', 800); yy += 40; }
  if (R.ruins) { c.beginPath(); c.moveTo(x + 46, yy - 13); c.lineTo(x + 57, yy); c.lineTo(x + 46, yy + 13); c.lineTo(x + 35, yy); c.closePath(); c.fillStyle = '#ffe27a'; c.fill(); K.txt(c, t('reportRuin'), x + 74, yy + 1, 18, K.CREAM, 'left', 800); K.costRowPlain(c, R.loot, x + 86 + K.width(c, t('reportRuin'), 18, 800), yy + 1, 17); yy += 40; }
  for (const it of R.items) { itemIcon(c, it, x + 46, yy, 13); K.txt(c, t('reportItem', t('it_' + it)), x + 74, yy + 1, 18, '#ffe9a8', 'left', 800); yy += 40; }
  if (!lines) K.wrap(c, t('reportNothing'), x + 34, yy, w - 68, 17, K.CREAM, 24, 'left');
  K.button(c, ui, x + 30, y + h - 74, 250, 54, t('reportMap'), { color: '#3b3229', fs: 19, tag: 'reportMap' }, A.reportMap);
  K.button(c, ui, x + w - 250, y + h - 74, 220, 54, t('ok'), { color: '#2f7d3a', fs: 22, tag: 'reportOk' }, A.reportOk);
}

/** Un oggetto dell'eroe, come icona. */
export function itemIcon(c, it, x, y, s) {
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = Math.max(1.4, s * 0.13); c.strokeStyle = 'rgba(30,20,10,0.75)';
  if (it === 'spada') { c.rotate(0.7); c.fillStyle = '#e9edf5'; c.beginPath(); c.roundRect(-s * 0.16, -s * 1.1, s * 0.32, s * 1.5, s * 0.1); c.fill(); c.stroke(); c.fillStyle = '#f2c230'; c.fillRect(-s * 0.5, s * 0.36, s, s * 0.2); c.fillRect(-s * 0.12, s * 0.5, s * 0.24, s * 0.5); }
  else if (it === 'scudo') { c.fillStyle = MY_COLOR; c.beginPath(); c.moveTo(-s * 0.8, -s * 0.8); c.lineTo(s * 0.8, -s * 0.8); c.lineTo(s * 0.8, s * 0.1); c.quadraticCurveTo(s * 0.6, s * 0.9, 0, s * 1.05); c.quadraticCurveTo(-s * 0.6, s * 0.9, -s * 0.8, s * 0.1); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f2c230'; c.beginPath(); c.arc(0, 0, s * 0.28, 0, TAU); c.fill(); }
  else if (it === 'stivali') { c.fillStyle = '#9b6b3d'; c.beginPath(); c.moveTo(-s * 0.5, -s); c.lineTo(s * 0.1, -s); c.lineTo(s * 0.1, s * 0.2); c.lineTo(s * 0.9, s * 0.5); c.lineTo(s * 0.9, s * 0.9); c.lineTo(-s * 0.5, s * 0.9); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f2c230'; c.fillRect(-s * 0.5, -s * 0.5, s * 0.6, s * 0.18); }
  else if (it === 'amuleto') { c.strokeStyle = '#f2c230'; c.beginPath(); c.arc(0, -s * 0.35, s * 0.7, Math.PI * 0.15, Math.PI * 0.85, true); c.stroke(); c.strokeStyle = 'rgba(30,20,10,0.75)'; c.fillStyle = '#7fe3ff'; c.beginPath(); c.moveTo(0, -s * 0.1); c.lineTo(s * 0.45, s * 0.4); c.lineTo(0, s * 1.05); c.lineTo(-s * 0.45, s * 0.4); c.closePath(); c.fill(); c.stroke(); }
  else { c.fillStyle = '#e8cf7a'; c.beginPath(); c.moveTo(-s, -s * 0.2); c.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.9, -s); c.lineTo(s * 1.05, -s * 0.2); c.quadraticCurveTo(s * 0.2, s * 0.6, -s, s * 0.3); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f2c230'; c.fillRect(-s * 1.1, -s * 0.3, s * 0.24, s * 0.7); }      // corno
  c.restore();
}

// ---------- il dito del Tuzu guida ----------
function hand(c, x, y, ang, s) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = '#fff6e6'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 2.2; c.lineJoin = 'round';
  c.beginPath(); c.roundRect(-13 * s, 20 * s, 28 * s, 23 * s, 8 * s); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(-20 * s, 25 * s, 10 * s, 15 * s, 5 * s); c.fill(); c.stroke();
  c.beginPath(); c.roundRect(-5.5 * s, 0, 11 * s, 30 * s, 5.5 * s); c.fill(); c.stroke();
  c.fillStyle = MY_COLOR; c.beginPath(); c.roundRect(-12 * s, 41 * s, 26 * s, 10 * s, 3 * s); c.fill(); c.stroke();
  c.restore();
}
const BUILD_STEP = { towers: ['dif', 'arcieri'], casa: ['eco', 'casa'], walls: ['mura', 'recinto'], campo: ['eco', 'campo'], strada: ['mura', 'strada'], aiuola: ['bel', 'aiuola'], segheria: ['eco', 'segheria'], cava: ['eco', 'cava'], caserma: ['dif', 'caserma'] };
/** Cosa indicare adesso: { tag } (un bottone) oppure { x, y, h } (un punto del mondo), o null. */
export function hintFor(S) {
  const { world, ui } = S, g = world.goal();
  if (!g || g.i > 18 || world.status !== 'day') return null;
  if (ui.map) return g.kind === 'explore' && !g.done && ui.map.sel && (ui.map.sel.kind === 'fog' || ui.map.sel.kind === 'ruin') ? { tag: 'scout' } : null;      // a mappa aperta si indica solo dentro la mappa
  if (g.done) return { tag: 'goalClaim' };
  const B = BUILD_STEP[g.kind];
  if (B) {
    if (ui.place) return ui.place.state && ui.place.state.ok ? { tag: 'placeOk' } : null;
    if (ui.build) return ui.build.cat !== B[0] ? { tag: 'cat_' + B[0] } : { tag: 'card_' + B[1] };
    return { tag: 'build' };
  }
  if (ui.build || ui.place) return null;
  if (g.kind === 'night') return { tag: 'night' };
  if (g.kind === 'explore') return { tag: 'map' };
  if (g.kind === 'castle') return ui.sel && ui.sel.b.type === 'castello' ? { tag: 'castleUp' } : { x: world.castle.x, y: world.castle.y + 30, h: 0 };
  if (g.kind === 'send' || g.kind === 'sendRock') {
    const want = g.kind === 'send' ? 'tree' : 'rock'; let best = null, bd = 1e12;
    for (const n of NATURE) { if (n.kind !== want || world.cutSet.has(n.id) || world.jobs.includes(n.id) || !world.seen(n.c, n.r)) continue; const dd = ((n.c + 0.5) * G - world.castle.x) ** 2 + ((n.r + 0.5) * G - world.castle.y) ** 2; if (dd < bd) { bd = dd; best = n; } }
    return best ? { x: (best.c + 0.5) * G, y: (best.r + 0.5) * G + 10, h: 0 } : null;
  }
  if (g.kind === 'harvest') { const b = world.d.buildings.find(o => o.type === 'campo' && !(o.build > 0) && (!o.crop || world.crop(o, S.now).ripe)); return b ? { x: b.x, y: b.y + 14, h: 0 } : null; }
  return null;
}
/** Disegna la mano che indica (dopo i bottoni: deve sapere dove sono). */
export function finger(S, K) {
  const { c, ui, vw, vh, P } = S, hint = hintFor(S);
  if (!hint) return;
  const bob = Math.sin(ui.time * 6) * 7;
  let x, y, up;
  if (hint.tag) {
    const b = ui.buttons.find(o => o.tag === hint.tag);
    if (!b) return;
    up = b.y + b.h / 2 < vh * 0.5; x = b.x + b.w / 2; y = up ? b.y + b.h + 4 : b.y - 4;
    c.beginPath(); c.roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 14); c.strokeStyle = 'rgba(255,246,200,' + (0.5 + Math.sin(ui.time * 6) * 0.4) + ')'; c.lineWidth = 3.5; c.stroke();
  } else {
    const p = P.pt(hint.x, hint.y, hint.h || 0);
    if (p.x < 30 || p.x > vw - 30 || p.y < 110 || p.y > vh - 110) return;
    up = false; x = p.x; y = p.y - 10;
  }
  hand(c, x, y + (up ? bob + 8 : -bob - 8), up ? 0 : Math.PI, 0.95);
  void K;
}

// ---------- il gruppo di soldati scelto ----------
export function squadBar(S, K) {
  const { c, world, ui, vw, A, P } = S;
  if (ui.squad == null) return;
  const list = world.soldiers.filter(s => !s.dead && s.ally == null && s.home === ui.squad);
  if (!list.length) { ui.squad = null; return; }
  for (const s of list) { K.tracePoly(c, P.circle(s.x, s.y, 17, 16)); c.strokeStyle = 'rgba(255,246,160,0.95)'; c.lineWidth = 2.5; c.stroke(); }
  const raid = world.status === 'raid', label = (ui.squad === 0 ? t('squadHero') : t('squadN', list.length)) + ' · ' + t('squadHint');
  const lw = K.width(c, label, 16.5, 800), w = lw + 96 + (raid ? 170 : 0), x = vw / 2 - w / 2, y = 108;
  K.panel(c, x, y, w, 46, 23, 0.92); K.block(ui, x, y, w, 46);
  K.tuzuIcon(c, ui.squad === 0 ? 'eroe' : list[0].type, x + 26, y + 26, 10, MY_COLOR);
  K.txt(c, label, x + 46, y + 24, 16.5, '#ffe9a8', 'left', 800);
  if (raid) K.button(c, ui, x + 56 + lw, y + 6, 160, 34, t('squadAttack'), { color: '#a8322a', fs: 14.5, r: 10, tag: 'squadAttack' }, A.squadAttack);
  K.button(c, ui, x + w - 42, y + 6, 34, 34, '', { color: '#3b3229', r: 17, tag: 'squadClose' }, A.squadClose); K.cross(c, x + w - 25, y + 23, 7);
}

// ---------- i trofei ----------
export function trophyGrid(S, K, x, y, w) {
  const { c, world } = S, list = world.trophies(), cols = 8, cw = (w - (cols - 1) * 8) / cols, ch = 92;
  list.forEach((T, k) => {
    const bx = x + (k % cols) * (cw + 8), by = y + Math.floor(k / cols) * (ch + 8), mx = bx + cw / 2;
    c.beginPath(); c.roundRect(bx, by, cw, ch, 10); c.fillStyle = T.done ? 'rgba(92,78,40,0.92)' : 'rgba(255,255,255,0.06)'; c.fill();
    // la medaglia
    c.beginPath(); c.moveTo(mx - 9, by + 8); c.lineTo(mx - 3, by + 26); c.lineTo(mx + 3, by + 26); c.lineTo(mx + 9, by + 8); c.closePath(); c.fillStyle = T.done ? '#c2452d' : '#55504a'; c.fill();
    c.beginPath(); c.arc(mx, by + 36, 15, 0, TAU); c.fillStyle = T.done ? '#f2c230' : '#6a655e'; c.fill(); c.strokeStyle = T.done ? '#8a6410' : '#3e3a36'; c.lineWidth = 2; c.stroke();
    K.txt(c, T.need >= 1000 ? Math.round(T.need / 1000) + 'k' : String(T.need), mx, by + 37, T.need >= 100 ? 11 : 13.5, T.done ? '#5c3a10' : '#b9b2a6', 'center', 800);
    K.txt(c, t('tro_' + T.k), mx, by + 64, 11.5, T.done ? '#ffe9a8' : K.DIM, 'center', 700);
    if (!T.done) K.bar(c, bx + 10, by + 78, cw - 20, 5, T.have / T.need, '#ffd24a'); else K.txt(c, '✓', mx, by + 80, 12, '#9ff0b4', 'center', 800);
  });
  const rows = Math.ceil(list.length / cols);
  return y + rows * (ch + 8);
}
void COLS; void ROWS; void TROPHIES;

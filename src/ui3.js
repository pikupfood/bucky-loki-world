// Interfaccia del secondo giro di tappe: la mappa intera (da lì si mandano gli esploratori), il rapporto di una spedizione,
// il dito del Tuzu guida, il gruppo di soldati scelto, i trofei. Come ui2.js: ogni funzione riceve S (il fotogramma) e K (gli attrezzi).
import { SHIPS, TECHS, TERRAIN, G, COLS, ROWS, WORLD_W, WORLD_H, TRIBES, MY_COLOR, RUINS, FOG, FW, FH, PEAKS, HILLS, NATURE, TRAITS, TROPHIES, BUILD, CROPS, TECH_ORDER, CASTLE_UP, UNITS, SHIP_ORDER } from './data.js';
import { t } from './i18n.js';
import { gem } from './ui8.js';

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
  for (const n of NATURE) if (n.kind === 'tree' && !n.wet) { c.beginPath(); c.arc((n.c + 0.5) * G, (n.r + 0.5) * G, 17, 0, TAU); c.fillStyle = n.tint > 3 ? 'rgba(34,92,60,0.85)' : 'rgba(52,128,62,0.85)'; c.fill(); }
  for (const p of [...PEAKS].sort((a, b) => a.y - b.y)) {
    const r = p.r * 1.15;
    c.beginPath(); c.moveTo(p.x - r, p.y + r * 0.5); c.lineTo(p.x, p.y - r * 1.1); c.lineTo(p.x + r, p.y + r * 0.5); c.closePath(); c.fillStyle = '#8f8c86'; c.fill();
    c.beginPath(); c.moveTo(p.x, p.y - r * 1.1); c.lineTo(p.x + r, p.y + r * 0.5); c.lineTo(p.x + r * 0.2, p.y + r * 0.5); c.closePath(); c.fillStyle = 'rgba(60,58,56,0.35)'; c.fill();
    if (p.snow) { c.beginPath(); c.moveTo(p.x - r * 0.34, p.y - r * 0.56); c.lineTo(p.x, p.y - r * 1.1); c.lineTo(p.x + r * 0.34, p.y - r * 0.56); c.closePath(); c.fillStyle = '#f4f6fb'; c.fill(); }
  }
  mini = c0;
  return mini;
}
let fogSk = null, fogKey = '';
/** Le nuvole della mappa diventano carta non ancora disegnata: color pergamena, con le righe e le nuvolette a penna delle vecchie carte. */
function oldPaper(src, key) {
  if (!src || typeof document === 'undefined') return src;
  if (fogSk && fogKey === key) return fogSk;
  fogKey = key;
  if (!fogSk) { fogSk = document.createElement('canvas'); fogSk.width = src.width; fogSk.height = src.height; }
  const w = fogSk.width, h = fogSk.height, c = fogSk.getContext('2d');
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f3e5c2'); g.addColorStop(1, '#dbc391'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(122,88,44,0.17)'; c.lineWidth = 1; c.beginPath(); const st = w / 14; for (let x = st / 2; x < w; x += st) { c.moveTo(x, 0); c.lineTo(x, h); } for (let y = st / 2; y < h; y += st) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.strokeStyle = 'rgba(122,88,44,0.34)'; c.lineWidth = 1.2; c.lineCap = 'round';
  for (let i = 0; i < 28; i++) { const x = rnd() * w, y = rnd() * h, q = 4 + rnd() * 4; c.beginPath(); c.arc(x, y, q, Math.PI, TAU); c.arc(x + q * 1.6, y, q * 0.72, Math.PI * 1.08, TAU); c.moveTo(x - q * 1.7, y); c.lineTo(x + q * 2.8, y); c.stroke(); }
  c.globalCompositeOperation = 'destination-in'; c.drawImage(src, 0, 0, w, h); c.globalCompositeOperation = 'source-over';
  return fogSk;
}
/** La rosa dei venti stampata sulla carta. */
export function compass(c, x, y, r) {
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = 'rgba(243,229,194,0.82)'; c.fill(); c.strokeStyle = 'rgba(78,53,29,0.85)'; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.78, 0, TAU); c.strokeStyle = 'rgba(78,53,29,0.4)'; c.lineWidth = 1; c.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, L = i % 2 ? r * 0.5 : r * 0.92, wd = i % 2 ? r * 0.1 : r * 0.17;
    c.save(); c.rotate(a);
    c.beginPath(); c.moveTo(0, -L); c.lineTo(wd, 0); c.lineTo(0, 0); c.closePath(); c.fillStyle = i === 0 ? '#a3321f' : '#4e351d'; c.fill();
    c.beginPath(); c.moveTo(0, -L); c.lineTo(-wd, 0); c.lineTo(0, 0); c.closePath(); c.fillStyle = i === 0 ? '#d9694f' : '#b89862'; c.fill();
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, r * 0.1, 0, TAU); c.fillStyle = '#e9c46a'; c.fill(); c.strokeStyle = '#4e351d'; c.lineWidth = 1; c.stroke();
  c.restore();
}
/** Un cartiglio di pergamena col nome, sotto un segnalino. */
export function tag(c, K, s, x, y, col) {
  const w = K.width(c, s, 11.5, 800) + 14;
  c.beginPath(); c.roundRect(x - w / 2, y - 8.5, w, 17, 5); c.fillStyle = '#f5e8c8'; c.fill(); c.strokeStyle = '#4e351d'; c.lineWidth = 1.3; c.stroke();
  K.txt(c, s, x, y + 0.5, 11.5, col || K.PEN, 'center', 800);
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
  const { c, world, ui, vw, vh, A, now } = S, M = ui.map, pad = 12;
  let side = Math.min(330, Math.max(270, vw * 0.25));
  c.fillStyle = 'rgba(14,12,22,0.93)'; c.fillRect(0, 0, vw, vh); K.block(ui, 0, 0, vw, vh);
  const tall = S.tall, aw = tall ? vw - pad * 2 : vw - side - pad * 3, ah = tall ? vh - pad * 3 - 400 : vh - pad * 2, k = Math.min(aw / WORLD_W, ah / WORLD_H), mw = WORLD_W * k, mh = WORLD_H * k, mx = pad + (aw - mw) / 2, hp = tall ? Math.min(470, vh - pad * 3 - mh) : 0, my = tall ? Math.max(pad, (vh - mh - pad - hp) / 2) : pad + (ah - mh) / 2;
  const X = (x) => mx + x * k, Y = (y) => my + y * k, pulse = 0.5 + Math.sin(ui.time * 5) * 0.5;
  // la cornice di legno, poi il foglio
  { const g = c.createLinearGradient(0, my - 7, 0, my + mh + 7); g.addColorStop(0, '#6a4a2e'); g.addColorStop(1, '#332215');
    c.beginPath(); c.roundRect(mx - 7, my - 4, mw + 14, mh + 14, 15); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    c.beginPath(); c.roundRect(mx - 7, my - 7, mw + 14, mh + 14, 15); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(16,10,5,0.95)'; c.lineWidth = 2.5; c.stroke();
    for (const [px, py] of [[mx - 0.5, my - 0.5], [mx + mw + 0.5, my - 0.5], [mx - 0.5, my + mh + 0.5], [mx + mw + 0.5, my + mh + 0.5]]) { c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fillStyle = '#e9c46a'; c.fill(); c.strokeStyle = 'rgba(40,24,8,0.9)'; c.lineWidth = 1; c.stroke(); } }
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
  if (S.fogCv && world.fogA.includes(0)) { let seen = 0; for (const v of world.fogA) seen += v ? 1 : 0; c.drawImage(oldPaper(S.fogCv, seen + ':' + Math.floor(ui.time)), mx, my, FW * FOG.cell * G * k, FH * FOG.cell * G * k); }
  compass(c, mx + 40, my + mh - 40, 26);
  // il pezzo che la camera guarda adesso
  if (S.cam) { const h = S.cam.dist * 0.82 * k, w = h * Math.max(0.4, Math.min(2.2, vw / vh)); c.strokeStyle = 'rgba(40,24,8,0.55)'; c.lineWidth = 3.4; c.strokeRect(X(S.cam.x) - w / 2, Y(S.cam.y) - h / 2 - h * 0.08, w, h); c.strokeStyle = '#ffe9a8'; c.lineWidth = 1.8; c.strokeRect(X(S.cam.x) - w / 2, Y(S.cam.y) - h / 2 - h * 0.08, w, h); }
  c.restore();
  c.beginPath(); c.roundRect(mx, my, mw, mh, 10); c.strokeStyle = 'rgba(24,14,6,0.9)'; c.lineWidth = 3; c.stroke(); c.strokeStyle = 'rgba(233,196,106,0.85)'; c.lineWidth = 1.4; c.stroke();
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
  { const px = X(world.castle.x), py = Y(world.castle.y); c.beginPath(); c.arc(px, py + 1.5, 16.5, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill(); c.beginPath(); c.arc(px, py, 15, 0, TAU); c.fillStyle = '#3a2f55'; c.fill(); c.strokeStyle = '#3a2614'; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#f2cf73'; c.lineWidth = 2.6; c.stroke(); K.buildIcon(c, 'castello', px, py, 9, 0); }
  // i villaggi: quelli che conosci col loro colore e il nome; degli altri si sa solo che ci sono
  TRIBES.forEach((T, i) => {
    const px = X((T.c + 0.5) * G), py = Y((T.r + 0.5) * G), v = world.d.villages[i];
    if (!world.known(i)) {
      c.beginPath(); c.arc(px, py + 1.5, 13, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
      { const g = c.createRadialGradient(px - 3, py - 4, 1, px, py, 12.5); g.addColorStop(0, '#c9523c'); g.addColorStop(1, '#7a2416'); c.beginPath(); c.arc(px, py, 12.5, 0, TAU); c.fillStyle = g; c.fill(); c.strokeStyle = '#4a130c'; c.lineWidth = 1.8; c.stroke(); c.beginPath(); c.arc(px, py, 9.5, 0, TAU); c.strokeStyle = 'rgba(255,220,190,0.35)'; c.lineWidth = 1; c.stroke(); }
      K.head(c, '?', px, py + 1, 15, '#ffe9d0', 'center');
      return;
    }
    const col = v.state === 'colony';
    c.beginPath(); c.arc(px, py + 1.5, 16, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.32)'; c.fill();
    c.beginPath(); c.arc(px, py, 14, 0, TAU); c.fillStyle = '#2a1d12'; c.fill(); c.strokeStyle = '#1a1009'; c.lineWidth = 5.5; c.stroke();
    c.strokeStyle = col ? MY_COLOR : v.state === 'ally' ? '#7fe6a0' : world.attackers(world.nextNight).includes(i) ? '#ff6a5a' : 'rgba(255,255,255,0.7)'; c.lineWidth = 2.5; c.stroke();
    K.tuzu2d(c, px, py, 9, col ? MY_COLOR : T.color, col ? '#2b2a33' : T.eyes);
    tag(c, K, t('tr_' + T.id), px, py + 27);
  });
  // le spedizioni in corso: la strada tratteggiata, dov'è adesso l'esploratore, la meta
  for (const tr of world.d.trips) {
    const s = world.tripFrom(tr), a = world.tripAt(tr, now);
    c.strokeStyle = tr.boat ? '#2f6f9a' : '#7a2c1e'; c.lineWidth = 2.2; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(X(s.x), Y(s.y)); c.lineTo(X(tr.x), Y(tr.y)); c.stroke(); c.setLineDash([]);
    { const ex = X(tr.x), ey = Y(tr.y), q = 5 + pulse * 1.5; c.strokeStyle = '#7a2c1e'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - q, ey - q); c.lineTo(ex + q, ey + q); c.moveTo(ex + q, ey - q); c.lineTo(ex - q, ey + q); c.stroke(); }
    c.beginPath(); c.arc(X(a.x), Y(a.y), 11, 0, TAU); c.fillStyle = 'rgba(26,20,14,0.85)'; c.fill(); K.tuzuIcon(c, 'esplora', X(a.x), Y(a.y) + 2, 7, MY_COLOR);
    tag(c, K, fmtH(a.left), X(a.x), Y(a.y) - 23);
  }
  // il punto scelto
  const sel = M.sel;
  if (sel) { c.beginPath(); c.arc(X(sel.x), Y(sel.y), 15 + pulse * 5, 0, TAU); c.strokeStyle = 'rgba(40,24,8,0.7)'; c.lineWidth = 5; c.setLineDash([6, 5]); c.stroke(); c.strokeStyle = '#ffe27a'; c.lineWidth = 2.6; c.stroke(); c.setLineDash([]); }

  // ---- la colonna a destra: cosa hai scelto, e chi è in viaggio
  const x = tall ? pad : vw - side - pad, y = tall ? my + mh + pad : pad, h = tall ? hp : vh - pad * 2;
  if (tall) side = vw - pad * 2;
  K.panel(c, x, y, side, h, 14, 0.96);
  mapIcon(c, x + 32, y + 32, 13);
  K.head(c, t('mapTitle'), x + 58, y + 33, 25);
  K.rule(c, x + 18, y + 60, side - 36);
  K.button(c, ui, x + side - 52, y + 10, 42, 42, '', { color: '#5c4330', r: 21, tag: 'mapClose' }, A.mapClose); K.cross(c, x + side - 31, y + 31, 9);
  let yy = y + 78;
  const tw = side - 36;
  if (!sel) { yy = K.wrap(c, t('mapHint'), x + 18, yy, tw, 15.5, K.CREAM, 21, 'left') + 28; }
  else if (sel.kind === 'village') {
    const T = TRIBES[sel.i], v = world.village(sel.i), col = v.state === 'colony';
    K.tuzu2d(c, x + 36, yy + 8, 18, col ? MY_COLOR : T.color, col ? '#2b2a33' : T.eyes);
    K.head(c, t('tr_' + T.id), x + 66, yy, 20, '#ffe9a8');
    K.txt(c, col ? t('colony') : v.state === 'ally' ? t('allyTag') : t('level') + ' ' + v.level, x + 66, yy + 22, 14, K.DIM, 'left', 700);
    K.txt(c, t('chief') + ' ' + TRAITS[T.id].chief, x + 18, yy + 52, 14, K.CREAM, 'left', 600);
    K.button(c, ui, x + 18, yy + 72, tw, 48, t('mapGoVillage'), { color: '#2f7d3a', fs: 18, tag: 'mapGo' }, A.mapGo);
    yy += 140;
  } else if (sel.kind === 'land') {
    K.head(c, t('mapLand'), x + 18, yy, 19, '#ffe9a8');
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
  K.rule(c, x + 18, yy, tw); yy += 22;
  K.txt(c, t('tripsOut') + ' ' + world.d.trips.length + '/' + world.tripsMax(), x + 18, yy, 15, K.CREAM, 'left', 800); yy += 18;
  for (const tr of world.d.trips) {
    if (yy + 50 > y + h - 66) break;
    const a = world.tripAt(tr, now), ask = M.recall === tr.id;
    K.card(c, x + 18, yy, tw, 46, false);
    K.tuzuIcon(c, 'esplora', x + 38, yy + 26, 9, MY_COLOR);
    if (ask) K.button(c, ui, x + 58, yy + 6, tw - 92, 34, t('recallAsk'), { color: '#7a3a2c', fs: 14, r: 9, tag: 'recallYes' }, () => A.recall(tr.id));
    else { const hg = world.hurryCost(tr, now), hw = hg ? 72 : 0; K.bar(c, x + 60, yy + 28, tw - 96 - hw, 7, a.p, '#ffd24a'); K.txt(c, fmtH(a.left) + ' · ' + t('tripAt', clock(tr.at + tr.ms)), x + 60, yy + 15, K.fit(c, fmtH(a.left) + ' · ' + t('tripAt', clock(tr.at + tr.ms)), tw - 96 - hw, 13, 800), '#ffe9a8', 'left', 800);
      if (hg) { const hx = x + 18 + tw - 36 - 70; K.button(c, ui, hx, yy + 8, 64, 30, '', { color: '#7a2f8a', r: 9, tag: 'hurry' }, () => A.hurry(tr.id)); K.txt(c, String(hg), hx + 40, yy + 24, 14, '#ffe3fb', 'center', 800); gem(c, hx + 16, yy + 23, 7); } }
    K.button(c, ui, x + 18 + tw - 36, yy + 8, 30, 30, '', { color: ask ? '#5c4330' : '#6b4a2c', r: 15, tag: 'recall' }, () => { M.recall = ask ? null : tr.id; }); K.cross(c, x + 18 + tw - 21, yy + 23, 6);
    yy += 52;
  }
  if (!world.d.trips.length) K.txt(c, t('tripsNone'), x + 18, yy + 6, 13, K.DIM, 'left', 600);
  K.button(c, ui, x + 18, y + h - 58, tw, 46, t('close'), { color: '#6b4a2c', fs: 19, tag: 'close' }, A.mapClose);
}

/** L'esploratore è tornato: cosa ha trovato. */
export function reportPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, R = world.d.reports[0];
  if (!R) return;
  K.dim(S, 0.66);
  const lines = R.found.length + (R.ruins ? 1 : 0) + R.items.length, w = 620, h = 236 + Math.max(1, lines) * 40, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  K.scroll(c, x, y, w, h, 16);
  { const g = c.createRadialGradient(x + 64, y + 54, 4, x + 64, y + 66, 40); g.addColorStop(0, '#6a58a0'); g.addColorStop(1, '#2c2344'); c.beginPath(); c.arc(x + 64, y + 66, 43, 0, TAU); c.fillStyle = '#3a2614'; c.fill(); c.beginPath(); c.arc(x + 64, y + 66, 40, 0, TAU); c.fillStyle = g; c.fill(); c.strokeStyle = '#e9c46a'; c.lineWidth = 3; c.stroke(); }
  K.tuzuIcon(c, 'esplora', x + 60, y + 78, 24, MY_COLOR);
  K.head(c, t(R.boat ? 'reportBoat' : 'reportTitle'), x + 124, y + 48, 27, K.PENRED, 'left', false);
  K.txt(c, t('reportSub'), x + 124, y + 80, 15, K.PEN2, 'left', 700);
  K.rule(c, x + 30, y + 114, w - 60, '122,84,40');
  let yy = y + 144;
  for (const i of R.found) { const T = TRIBES[i]; K.tuzu2d(c, x + 46, yy, 14, T.color, T.eyes); K.txt(c, t('reportFound', t('tr_' + T.id)), x + 74, yy + 1, 18, K.PEN, 'left', 800); yy += 40; }
  if (R.ruins) { c.beginPath(); c.moveTo(x + 46, yy - 13); c.lineTo(x + 57, yy); c.lineTo(x + 46, yy + 13); c.lineTo(x + 35, yy); c.closePath(); c.fillStyle = '#f2b830'; c.fill(); c.strokeStyle = '#5c3a10'; c.lineWidth = 1.5; c.stroke(); K.txt(c, t('reportRuin'), x + 74, yy + 1, 18, K.PEN, 'left', 800); K.costRowPlain(c, R.loot, x + 86 + K.width(c, t('reportRuin'), 18, 800), yy + 1, 17, K.PEN); yy += 40; }
  for (const it of R.items) { itemIcon(c, it, x + 46, yy, 13); K.txt(c, t('reportItem', t('it_' + it)), x + 74, yy + 1, 18, '#8a5a1c', 'left', 800); yy += 40; }
  if (!lines) K.wrap(c, t('reportNothing'), x + 34, yy, w - 68, 17, K.PEN, 24, 'left');
  K.button(c, ui, x + 30, y + h - 74, 250, 54, t('reportMap'), { color: '#6b4a2c', fs: 19, tag: 'reportMap' }, A.reportMap);
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
const BUILD_STEP = { morale: ['bel', 'fontana'], porto: ['acqua', 'porto'], ponte: ['acqua', 'ponte'], towers: ['dif', 'arcieri'], casa: ['eco', 'casa'], walls: ['mura', 'recinto'], campo: ['eco', 'campo'], strada: ['mura', 'strada'], aiuola: ['bel', 'aiuola'], segheria: ['eco', 'segheria'], cava: ['eco', 'cava'], caserma: ['dif', 'caserma'] };
/** Cosa indicare adesso: { tag } (un bottone) oppure { x, y, h } (un punto del mondo), o null. */
// I consigli di posto, tenuti da parte finché il villaggio non cambia (cercarli a ogni fotogramma costerebbe).
const MEMO = new Map();
const memo = (world, key, fn) => { const k = world.rev + '|' + world.d.buildings.length + '|' + key, m = MEMO.get(key); if (m && m.k === k) return m.v; const v = fn(); MEMO.set(key, { k, v }); return v; };
/** Un posto libero per un edificio, il più vicino al castello (le torri: dalla parte da cui arrivano i primi nemici). */
function spot(world, type) {
  return memo(world, 'spot_' + type, () => {
    const D = BUILD[type], c0 = Math.floor(world.castle.x / G), r0 = Math.floor(world.castle.y / G), T = TRIBES[world.attackers(world.nextNight)[0] ?? 0];
    const dx = T.c - c0, dy = T.r - r0, L = Math.hypot(dx, dy) || 1, px = c0 + (D.tower ? dx / L * 4 : 0), py = r0 + (D.tower ? dy / L * 4 : 3);
    let best = null, bd = 1e9;
    for (let r = r0 - 9; r <= r0 + 9; r++) for (let c = c0 - 9; c <= c0 + 9; c++) { if (world.canPlace(type, c, r) !== 'ok') continue; const d = (c + D.w / 2 - px) ** 2 + (r + D.h / 2 - py) ** 2; if (d < bd) { bd = d; best = { c, r }; } }
    return best;
  });
}
/** Una fila libera lunga n per un pezzo che si tira in fila, vicino al castello: [inizio, fine]. */
function lineSpot(world, type, n) {
  return memo(world, 'line_' + type + n, () => {
    const c0 = Math.floor(world.castle.x / G), r0 = Math.floor(world.castle.y / G);
    for (let d = 3; d < 12; d++) for (const r of [r0 + d, r0 - d]) for (let c = c0 - 6; c <= c0 + 2; c++) { let ok = true; for (let k = 0; k < n && ok; k++) if (world.canPlace(type, c + k, r) !== 'ok') ok = false; if (ok) return [{ c, r }, { c: c + n - 1, r }]; }
    return null;
  });
}
/** Dato l'inizio scelto dal giocatore, dove finire una fila di n pezzi. */
function lineEnd(world, type, a, n) {
  for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { let k = 1; while (k < n && world.canPlace(type, a.c + dc * k, a.r + dr * k) === 'ok') k++; if (k >= Math.min(n, 3)) return { c: a.c + dc * (k - 1), r: a.r + dr * (k - 1) }; }
  return null;
}
/** Un punto ancora coperto dalle nuvole, il più vicino al castello (sulla mappa intera: lì si manda il primo esploratore). */
function fogSpot(world) {
  return memo(world, 'fog' + world.fogRev, () => {
    for (let R = 500; R < 4200; R += 220) for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + 0.4, x = world.castle.x + Math.cos(a) * R, y = world.castle.y + Math.sin(a) * R * 0.8, c = Math.floor(x / G), r = Math.floor(y / G); if (c > 3 && r > 3 && c < COLS - 4 && r < ROWS - 4 && !world.seen(c, r)) return { x, y }; }
    return null;
  });
}
/** Dove toccare l'acqua per un ponte: il punto più vicino al castello da cui il ponte si stende da riva a riva (corto, ma lungo almeno `need`). */
function bridgeSpot(world, need) {
  return memo(world, 'bridge' + need + '|' + world.fogRev, () => {
    const c0 = Math.floor(world.castle.x / G), r0 = Math.floor(world.castle.y / G); let best = null, bd = 1e9;
    for (let r = Math.max(2, r0 - 34); r <= Math.min(ROWS - 3, r0 + 34); r++) for (let c = Math.max(2, c0 - 34); c <= Math.min(COLS - 3, c0 + 34); c++) {
      if (TERRAIN[r * COLS + c] !== 3 || !world.seen(c, r)) continue;
      const d = (c - c0) ** 2 + (r - r0) ** 2; if (d >= bd) continue;
      const sp = world.bridgeSpan(c, r); if (sp && sp.n >= need && sp.n <= 9) { bd = d; best = { c, r }; }
    }
    return best;
  });
}
const at = (b, dy = 20) => (b ? { x: b.x, y: b.y + dy, h: 0 } : null);
/** Un quadretto di terra libera vicino a (x, y): lì si possono mandare i soldati (su un edificio il tocco sceglierebbe l'edificio). */
function freeNear(world, x, y) {
  const c0 = Math.floor(x / G), r0 = Math.floor(y / G);
  for (let d = 0; d < 9; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
    if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue;
    const c = c0 + dc, r = r0 + dr, px = (c + 0.5) * G, py = (r + 0.5) * G;
    if (c > 2 && r > 2 && c < COLS - 3 && r < ROWS - 3 && !world.buildingAt(c, r) && !world.natAt(c, r) && world.walkable(px, py)) return { x: px, y: py, h: 0 };
  }
  return { x, y, h: 0 };
}
/** L'albero o la roccia più vicina al castello fra quelli in vista e non ancora in lista. */
function nat(world, kind) {
  let best = null, bd = 1e12;
  for (const n of NATURE) { if (n.kind !== kind || world.cutSet.has(n.id) || world.jobs.includes(n.id) || !world.seen(n.c, n.r)) continue; const dd = ((n.c + 0.5) * G - world.castle.x) ** 2 + ((n.r + 0.5) * G - world.castle.y) ** 2; if (dd < bd) { bd = dd; best = n; } }
  return best ? { x: (best.c + 0.5) * G, y: (best.r + 0.5) * G + 10, h: 0 } : null;
}
/** Mancano i materiali per `cost`? undefined = no, si può pagare. Altrimenti che cosa indicare per procurarseli: un albero, una roccia, o niente (le monete arrivano da sole). */
function lack(world, cost) {
  if (!cost || world.afford(cost)) return undefined;
  const R = world.d.res;
  if ((cost.legna || 0) > (R.legna || 0)) return nat(world, 'tree');
  if ((cost.pietra || 0) > (R.pietra || 0)) return nat(world, 'rock');
  return null;
}
/**
 * Che cosa indicare adesso: un bottone (tag), un punto del mondo (x, y), un punto dell'interfaccia (ux, uy) o il gesto di trascinare (swipe).
 * Regola del titolare (19/11/2026): «all'inizio dobbiamo assistere il giocatore in tutto». Per i primi obiettivi OGNI passo ha il suo dito:
 * anche dentro la mappa, mentre si posa un edificio, mentre si tira una fila. Un obiettivo nuovo fra i primi va aggiunto qui.
 */
export function hintFor(S) {
  const { world, ui } = S, g = world.goal();
  if (ui.resInfo || !g || world.status !== 'day' || world.drill || ui.multi || ui.todo || ui.vBanner) return null;
  let kind = g.kind, food = false;
  // conquistare vuole un esercito: senza soldati la guida passa prima dalla caserma
  if (kind === 'conquer' && !g.done && world.popUsed() < 4) kind = world.count('caserma') ? 'army' : 'caserma';
  // servono altri soldati ma le caserme sono piene: se il castello ne permette un'altra, si costruisce quella
  if (kind === 'army' && !g.done && !world.d.buildings.some(o => o.type === 'caserma' && (o.units || []).length < world.slots(o))) { const cp = world.cap('caserma'); if (cp.have < cp.max) kind = 'caserma'; }
  let B = BUILD_STEP[kind] || (BUILD[kind] ? [BUILD[kind].cat, kind] : null);
  if (ui.map) {      // dentro la mappa: tocca le nuvole, poi «Manda un esploratore», poi chiudi
    if (kind !== 'explore') return null;
    if (g.done) return { tag: 'mapClose' };
    if (ui.map.sel && (ui.map.sel.kind === 'fog' || ui.map.sel.kind === 'ruin')) return { tag: 'scout' };
    const f = fogSpot(world), M = ui.mapGeo; return f && M ? { ux: M.mx + f.x * M.k, uy: M.my + f.y * M.k } : null;
  }
  // obiettivo fatto: si ritira il premio. Se c'è un pannello grande aperto sopra (le scoperte, la flotta…), prima lo si chiude: il bottone del premio sta sotto.
  if (g.done) return ui.tech || ui.settings || ui.quests || ui.roles ? { tag: 'close' } : ui.fleet ? { tag: 'fleetClose' } : { tag: 'goalClaim' };
  // pannelli che il giocatore ha aperto da sé: lì il dito tace (nelle scoperte e nella flotta parla solo se l'obiettivo è quello)
  if (ui.quests || ui.settings || ui.roles || (ui.tech && kind !== 'tech') || (ui.fleet && kind !== 'ship' && kind !== 'sail')) return null;
  if (kind === 'move') return { swipe: true };
  // prima della notte: se mancano torri (e ci sono i materiali) la guida ne fa costruire un'altra; se manca la legna, manda a un albero
  if (kind === 'night' && world.towers() < world.towersWanted()) B = ['dif', 'arcieri'];
  else {      // il cibo non basta per stanotte: prima quello (un campo da raccogliere, da seminare, o da costruire)
    const ff = world.foodFix(S.now);
    if (ff && ff.k === 'build') { B = ['eco', 'campo']; food = true; }
    else if (ff && ff.b) {
      if (ui.place) return { tag: 'placeCancel' };
      if (ui.build) return { tag: 'buildClose' };
      if (ff.k === 'plant' && ui.sel && ui.sel.b === ff.b) return { tag: 'crop_' + Object.keys(CROPS)[0] };
      return ui.sel ? { tag: 'selClose' } : at(ff.b, 14);
    }
  }
  // un edificio che non si può (ancora) fare: castello troppo basso, scoperta che manca, limite raggiunto. Lì il dito non indica niente.
  if (B && !food && kind !== 'night') { const D0 = BUILD[B[1]], cp = world.cap(B[1]); if (D0.min > world.d.castle || (D0.tech && !world.d.tech[D0.tech]) || cp.have >= cp.max) B = null; }
  if (B && !ui.place) { const L = lack(world, BUILD[B[1]].cost); if (L !== undefined) return ui.build ? { tag: 'buildClose' } : L; }
  if (B) {
    if (ui.place) {
      const st = ui.place.state, D = BUILD[B[1]];
      if (ui.place.type !== B[1]) return { tag: 'placeCancel' };      // sta posando un'altra cosa: prima si esce
      if (!food && kind === 'night' && world.towers() >= world.towersWanted()) return { tag: 'placeCancel' };
      if (st && st.ok && st.why === 'ok') return { tag: 'placeOk' };
      if (B[1] === 'ponte') { const q = bridgeSpot(world, Math.max(1, Math.min(6, g.need - g.have))); return q ? { x: (q.c + 0.5) * G, y: (q.r + 0.5) * G, h: 0, far: true } : null; }
      if (D.line) { const n = Math.max(2, Math.min(8, g.need - g.have)), q = ui.place.a ? lineEnd(world, B[1], ui.place.a, n) : (lineSpot(world, B[1], n) || [null])[0]; return q ? { x: (q.c + 0.5) * G, y: (q.r + 0.5) * G, h: 0 } : null; }
      const q = spot(world, B[1]); return q ? { x: (q.c + D.w / 2) * G, y: (q.r + D.h / 2) * G, h: 0 } : null;
    }
    if (ui.build) return ui.build.cat !== B[0] ? { tag: 'cat_' + B[0] } : { tag: 'card_' + B[1] };
    return { tag: 'build' };
  }
  // il catalogo o la posa sono ancora aperti ma l'obiettivo è un altro: il dito indica la ✕ per uscire (un giocatore nuovo restava lì)
  if (ui.place) return { tag: 'placeCancel' };
  if (ui.build) return { tag: 'buildClose' };
  if (kind === 'night') {
    if (world.clockOn() && !world.nightDue(S.now) && world.earlyLeft(S.now) <= 0) return null;      // anticipi finiti: sul bottone c'è il tempo che manca, non c'è niente da premere
    // torri al completo: se una si può potenziare, la guida lo fa fare (una per notte, dalla quarta)
    if (world.nextNight >= 4 && world.nextNight <= 8) { const up = world.d.buildings.filter(o => o.type === 'arcieri' && !(o.build > 0)), lv = up.reduce((a, o) => a + (o.lvl || 0), 0), b = up.find(o => world.upgradeCost(o) != null && world.d.res.monete >= world.upgradeCost(o)); if (b && lv < world.nextNight - 3) return ui.sel ? (ui.sel.b === b ? { tag: 'upgrade' } : { tag: 'selClose' }) : at(b, 10); }
    return { tag: 'night' };
  }
  if (kind === 'level') {
    const b = world.d.buildings.find(o => world.levelCheck(o) === 'ok') || world.d.buildings.find(o => o.type === 'casa' && !(o.build > 0));
    if (b && world.levelCheck(b) !== 'ok') { const L = lack(world, world.levelCost(b)); if (L !== undefined) return ui.sel ? { tag: 'selClose' } : L; return null; }
    if (ui.sel) return ui.sel.b === b ? { tag: 'levelUp' } : { tag: 'selClose' };
    return at(b);
  }
  if (kind === 'sell') { if (ui.sel && ui.sel.b.type === 'mercato') return { tag: ui.sell ? 'sell_legna' : 'marketMode' }; return at(world.d.buildings.find(o => o.type === 'mercato')); }
  if (kind === 'order') { if (ui.squad != null) return freeNear(world, world.castle.x + 170, world.castle.y + 190); const free = (o) => !world.buildingAt(Math.floor(o.x / G), Math.floor((o.y + 6) / G)), L = world.soldiers.filter(o => !o.dead && o.ally == null), sd = L.find(free) || L[0]; return sd ? { x: sd.x, y: sd.y + 6, h: 0 } : null; }      // ai piedi di un soldato che non sta davanti a un edificio: lì il tocco prende lui, non la casa
  if (kind === 'explore') return { tag: 'map' };
  if (kind === 'castle') {
    const chk = world.castleCheck();
    if (chk === 'cost') { const L = lack(world, (CASTLE_UP[world.d.castle] || {}).cost); if (L !== undefined) return ui.sel ? { tag: 'selClose' } : L; }
    if (chk !== 'ok') return null;      // servono altre notti: lo dice la guida, qui non c'è niente da toccare
    return ui.sel && ui.sel.b.type === 'castello' ? { tag: 'castleUp' } : { x: world.castle.x, y: world.castle.y + 30, h: 0 };
  }
  if (kind === 'send' || kind === 'sendRock') return ui.sel ? { tag: 'selClose' } : nat(world, kind === 'send' ? 'tree' : 'rock');
  if (kind === 'harvest') {
    if (ui.sel && ui.sel.b.type === 'campo' && !ui.sel.b.crop) return { tag: 'crop_' + Object.keys(CROPS)[0] };
    return at(world.d.buildings.find(o => o.type === 'campo' && !(o.build > 0) && (!o.crop || world.crop(o, S.now).ripe)), 14);
  }
  if (kind === 'army') {
    { const L = lack(world, UNITS.lancia.cost); if (L !== undefined) return ui.sel ? { tag: 'selClose' } : L; }
    if (ui.sel && ui.sel.b.type === 'caserma') return { tag: 'train_lancia' };
    return at(world.d.buildings.find(o => o.type === 'caserma' && !(o.build > 0) && (o.units || []).length < world.slots(o)));
  }
  if (kind === 'tech') {
    // la prima scoperta che si può fare adesso; se a tutte mancano i materiali, si va a prenderli (mai un bottone che non fa niente)
    const okId = TECH_ORDER.find(k => world.techCheck(k) === 'ok');
    if (!okId) { const nd = TECH_ORDER.find(k => world.techCheck(k) === 'cost'), L = nd ? lack(world, TECHS[nd].cost) : null; return !L ? null : ui.tech ? { tag: 'close' } : ui.sel ? { tag: 'selClose' } : L; }
    if (ui.tech) return { tag: 'tech_' + okId };
    if (ui.sel && ui.sel.b.type === 'bottega') return { tag: 'techOpen' };
    return at(world.d.buildings.find(o => o.type === 'bottega' && !(o.build > 0)));
  }
  if (['village', 'gift', 'ally', 'trade'].includes(kind)) {
    if (ui.vsel != null && kind !== 'village') return { tag: kind };
    let best = null, bd = 1e12;
    world.d.villages.forEach((v, i) => { if (!world.known(i)) return; if (kind === 'trade' && v.state !== 'ally' && v.state !== 'colony') return; const T = TRIBES[i], x = (T.c + 0.5) * G, y = (T.r + 0.5) * G, d = (x - world.castle.x) ** 2 + (y - world.castle.y) ** 2; if (d < bd) { bd = d; best = { x, y, h: 40 }; } });
    return best;
  }
  if (kind === 'conquer') {      // il villaggio libero più debole fra quelli conosciuti: lo si tocca, poi «Attacca»
    let best = -1, bl = 99;
    world.d.villages.forEach((v, i) => { if (world.known(i) && v.state === 'free' && v.level < bl) { bl = v.level; best = i; } });
    if (best < 0) return { tag: 'map' };
    if (ui.vsel != null) return ui.vsel === best ? { tag: 'attack' } : { tag: 'vClose' };
    const T = TRIBES[best]; return { x: (T.c + 0.5) * G, y: (T.r + 0.5) * G, h: 40, far: true };
  }
  if (kind === 'ship' || kind === 'sail') {      // la flotta: bottone dell'àncora, scheda giusta, nave o partenza
    if (!world.fleetSlots()) return null;
    if (!ui.fleet) return ui.sel ? { tag: 'selClose' } : { tag: 'fleetHud' };
    // per salpare serve una nave che parte (il peschereccio resta in porto): la guida fa costruire prima quella
    const sailers = SHIP_ORDER.filter(k => !SHIPS[k].plain), can = world.d.fleet.some(s => !SHIPS[s.type].plain && world.shipFit(s));
    if (kind === 'ship' || !can) { if (ui.fleet.tab !== 'ships') return { tag: 'fleetTab_ships' }; const ty = sailers.find(k => world.shipCheck(k) === 'ok') || (kind === 'ship' ? SHIP_ORDER.find(k => world.shipCheck(k) === 'ok') : null); return ty ? { tag: 'shNew_' + ty } : null; }
    return ui.fleet.tab !== 'trade' ? { tag: 'fleetTab_trade' } : { tag: 'trGo' };
  }
  return null;
}
/** Disegna la mano che indica (dopo i bottoni: deve sapere dove sono). */
export function finger(S, K, tagOnly) {
  const { c, ui, vw, vh, P } = S, hint = hintFor(S);
  if (!hint || (tagOnly && !hint.tag)) return;
  const bob = Math.sin(ui.time * 6) * 7;
  let x, y, up;
  if (hint.swipe) { hand(c, vw / 2 + Math.sin(ui.time * 2.4) * 120, vh * 0.56, Math.PI, 1.05); return; }      // il gesto: trascina
  if (hint.ux != null) { const r = 26 + Math.sin(ui.time * 6) * 5; c.beginPath(); c.arc(hint.ux, hint.uy, r, 0, TAU); c.strokeStyle = 'rgba(255,246,200,0.9)'; c.lineWidth = 3.5; c.stroke(); hand(c, hint.ux, hint.uy - 18 - bob, Math.PI, 0.95); return; }
  if (hint.tag) {
    const b = ui.buttons.find(o => o.tag === hint.tag) || (hint.tag.startsWith('card_') ? ui.buttons.find(o => o.tag === 'buildPage') : null);      // la carta è nell'altra pagina
    if (!b) return;
    up = b.y + b.h / 2 < vh * 0.5; x = b.x + b.w / 2; y = up ? b.y + b.h + 4 : b.y - 4;
    c.beginPath(); c.roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 14); c.strokeStyle = 'rgba(255,246,200,' + (0.5 + Math.sin(ui.time * 6) * 0.4) + ')'; c.lineWidth = 3.5; c.stroke();
    // dentro un pannello la mano sta di lato: sopra o sotto coprirebbe le scritte
    if (tagOnly || (S.tall && !up && b.y > vh - 120)) { const left = b.x + b.w / 2 < vw / 2; hand(c, left ? b.x + b.w + 26 + bob : b.x - 26 - bob, b.y + b.h / 2, left ? -Math.PI / 2 : Math.PI / 2, 0.95); return; }
  } else {
    const p = P.pt(hint.x, hint.y, hint.h || 0);
    if (p.x < 30 || p.x > vw - 30 || p.y < 110 || p.y > vh - 110) {      // fuori dallo schermo: se è una meta lontana (un villaggio), la mano sta sul bordo e indica da che parte andare
      if (!hint.far) return;
      const cx = Math.max(70, Math.min(vw - 70, p.x)), cy = Math.max(170, Math.min(vh - 170, p.y)), th = Math.atan2(p.y - cy, p.x - cx);
      hand(c, cx - Math.cos(th) * (bob + 8), cy - Math.sin(th) * (bob + 8), th + Math.PI / 2, 0.95); return;
    }
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
  const lw = K.width(c, label, 16.5, 800), w = lw + 118 + (raid ? 170 : 0), x = vw / 2 - w / 2, y = S.tall ? 228 : 108;
  K.panel(c, x, y, w, 52, 26, 0.92); K.block(ui, x, y, w, 52);
  K.tuzuIcon(c, ui.squad === 0 ? 'eroe' : list[0].type, x + 26, y + 29, 10, MY_COLOR);
  K.txt(c, label, x + 46, y + 27, 16.5, '#ffe9a8', 'left', 800);
  if (raid) K.button(c, ui, x + 56 + lw, y + 9, 160, 34, t('squadAttack'), { color: '#a8322a', fs: 14.5, r: 10, tag: 'squadAttack' }, A.squadAttack);
  // la ✕ è grande, e tutta la parte destra della striscia la preme (su un telefono 34 punti erano pochi: il titolare non riusciva a chiudere)
  K.button(c, ui, x + w - 52, y + 4, 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'squadClose' }, A.squadClose); K.cross(c, x + w - 30, y + 26, 9);
  ui.buttons.push({ x: x + w - (raid ? 62 : 84), y: y - 8, w: raid ? 70 : 92, h: 68, tag: 'squadCloseWide', fn: A.squadClose });
}

// ---------- i trofei ----------
export function trophyGrid(S, K, x, y, w) {
  const { c, world } = S, list = world.trophies(), cols = w < 760 ? 4 : 8, cw = (w - (cols - 1) * 8) / cols, ch = 92;
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

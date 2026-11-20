// Il negozio (20/11/2026): il bottone con la gemma, il pannello a due schede (Materiali, Gemme), il foglio «Ti manca».
// Ogni funzione riceve (S, K): K è la cassetta degli attrezzi di ui.js. Regola Samsung: prima le scritte, poi le icone.
import { SHOP, GIFT7 } from './data.js';
import { t } from './i18n.js';
import * as pay from './pay.js';

const TAU = Math.PI * 2;

/** La gemma: un taglio a brillante, solo linee dritte. Centro (x, y), mezza larghezza s. */
export function gem(c, x, y, s) {
  const P = [[-1, -0.25], [-0.5, -0.85], [0.5, -0.85], [1, -0.25], [0, 0.95]];
  c.beginPath(); P.forEach(([px, py], i) => (i ? c.lineTo(x + px * s, y + py * s) : c.moveTo(x + px * s, y + py * s))); c.closePath();
  c.fillStyle = '#e25bd0'; c.fill(); c.strokeStyle = '#5a1458'; c.lineWidth = Math.max(1.2, s * 0.14); c.lineJoin = 'round'; c.stroke();
  c.beginPath(); c.moveTo(x - 0.5 * s, y - 0.85 * s); c.lineTo(x - 0.28 * s, y - 0.25 * s); c.lineTo(x + 0.28 * s, y - 0.25 * s); c.lineTo(x + 0.5 * s, y - 0.85 * s); c.closePath(); c.fillStyle = '#ffb3f3'; c.fill();
  c.beginPath(); c.moveTo(x - s, y - 0.25 * s); c.lineTo(x + s, y - 0.25 * s); c.moveTo(x - 0.28 * s, y - 0.25 * s); c.lineTo(x, y + 0.95 * s); c.lineTo(x + 0.28 * s, y - 0.25 * s); c.strokeStyle = 'rgba(90,20,88,0.55)'; c.lineWidth = Math.max(1, s * 0.09); c.stroke();
  c.beginPath();
}

/** Il bottone del negozio nella colonna a destra: la gemma, e sotto quante ne hai. Un pallino rosso se lo scrigno del giorno è pronto. */
export function shopButton(S, K, x, y) {
  const { c, world, ui, A, now } = S, n = world.gems();
  K.button(c, ui, x, y, 54, 48, '', { color: '#6a2f7a', tag: 'shopHud' }, A.shopOpen);
  K.txt(c, n > 9999 ? Math.floor(n / 1000) + 'k' : String(n), x + 27, y + 37, 13.5, '#ffe3fb', 'center', 800);
  gem(c, x + 27, y + 17, 11);
  if (world.chestReady(now)) { c.beginPath(); c.arc(x + 50, y + 4, 9, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.beginPath(); }
}

/** «N» con la gemma accanto, centrati in (cx, y). */
function gemLabel(c, K, s, cx, y, fs, col) {
  const w = K.width(c, s, fs, 800), g = fs * 0.5;
  K.txt(c, s, cx + g + 3, y, fs, col || K.CREAM, 'center', 800);
  gem(c, cx - w / 2 - 2, y - 1, g);
}

export function shopPanel(S, K) {
  const { c, world, ui, vw, vh, A, now } = S, sh = ui.shop || {}, tab = sh.tab || 0;
  K.dim(S, 0.62);
  const w = Math.min(700, vw - 16), h = 562, x = vw / 2 - w / 2, y = Math.max(6, vh / 2 - h / 2);
  K.panel(c, x, y, w, h, 18, 0.96);
  K.head(c, t('shop'), x + 26, y + 40, 27, '#f2cf73', 'left');
  // quante gemme hai, e la X per chiudere
  const gs = String(world.gems()), gw = K.width(c, gs, 22, 800) + 58;
  c.beginPath(); c.roundRect(x + w - 76 - gw, y + 16, gw, 44, 22); c.fillStyle = 'rgba(40,14,48,0.85)'; c.fill(); c.strokeStyle = 'rgba(255,170,245,0.6)'; c.lineWidth = 1.6; c.stroke();
  K.txt(c, gs, x + w - 76 - gw + 44, y + 39, 22, '#ffe3fb', 'left', 800);
  gem(c, x + w - 76 - gw + 24, y + 37, 12);
  K.button(c, ui, x + w - 64, y + 16, 46, 44, '', { color: '#5c4330', r: 22, tag: 'shopClose' }, A.shopClose); K.cross(c, x + w - 41, y + 38, 8);
  // le due schede
  const tw = (w - 60) / 2;
  [[0, t('shopTabRes')], [1, t('shopTabGems')]].forEach(([k, s]) => K.button(c, ui, x + 26 + k * (tw + 8), y + 74, tw, 44, s, { color: tab === k ? '#8a5a1c' : '#5c4330', fs: 20, tag: 'shopTab' + k }, () => A.shopTab(k)));
  const top = y + 130;
  if (tab === 0) {
    // lo scrigno del giorno
    const ready = world.chestReady(now), loot = world.chestLoot();
    K.card(c, x + 26, top, w - 52, 62, ready);
    K.txt(c, t('shopChest'), x + 44, top + 22, K.fit(c, t('shopChest'), w - 300, 19, 800), K.CREAM, 'left', 800);
    if (ready) K.button(c, ui, x + w - 26 - 170, top + 8, 160, 46, t('shopOpenChest'), { color: '#2f7d3a', fs: 19, tag: 'shopChest' }, A.shopChest);
    else K.txt(c, t('shopTomorrow'), x + w - 26 - 90, top + 32, K.fit(c, t('shopTomorrow'), 170, 15, 700), K.DIM, 'center', 700);
    { let lx = x + 44; const parts = Object.keys(loot).map(r => [r, '+' + loot[r]]); parts.push(['gem', '+' + SHOP.chest.gems]);
      for (const [, s] of parts) { K.txt(c, s, lx + 22, top + 46, 15, K.GOLD, 'left', 800); lx += 22 + K.width(c, s, 15, 800) + 14; }
      lx = x + 44; for (const [r, s] of parts) { if (r === 'gem') gem(c, lx + 9, top + 45, 7.5); else { c.beginPath(); K.RES_ICON[r](c, lx + 9, top + 45, 7.5); } lx += 22 + K.width(c, s, 15, 800) + 14; }
      K.flushIcons(c); c.beginPath(); }
    // le casse: due colonne
    const packs = world.shopPacks(), cw = (w - 60) / 2, ch = 92;
    packs.forEach((p, i) => {
      const cx = x + 26 + (i % 2) * (cw + 8), cy = top + 72 + Math.floor(i / 2) * (ch + 8), name = t('r_' + p.res);
      K.card(c, cx, cy, cw, ch, false);
      const big = '+' + p.n, bw = K.width(c, big, 22, 800);
      K.txt(c, big, cx + 46, cy + 25, 22, K.RES_COL[p.res], 'left', 800);
      K.txt(c, name, cx + 46 + bw + 8, cy + 26, K.fit(c, name, cw - 70 - bw, 16, 700), K.DIM, 'left', 700);
      c.beginPath(); K.RES_ICON[p.res](c, cx + 24, cy + 24, 11); K.flushIcons(c); c.beginPath();
      if (p.locked) { K.txt(c, t('shopLocked'), cx + cw / 2, cy + 66, K.fit(c, t('shopLocked'), cw - 30, 15, 700), K.DIM, 'center', 700); return; }
      const b1 = (cw - 28) * 0.42, b2 = cw - 28 - b1 - 8, can1 = world.gems() >= p.gems, can2 = world.gems() >= p.bigGems;
      K.button(c, ui, cx + 14, cy + 46, b1, 38, '', { color: can1 ? '#7a2f8a' : '#4c3a52', r: 10, tag: 'shopPack' + i }, () => A.shopPack(i, false));
      K.button(c, ui, cx + 22 + b1, cy + 46, b2, 38, '', { color: can2 ? '#7a2f8a' : '#4c3a52', r: 10, tag: 'shopBig' + i }, () => A.shopPack(i, true));
      gemLabel(c, K, String(p.gems), cx + 14 + b1 / 2, cy + 66, 17);
      gemLabel(c, K, '×' + SHOP.big.k + ' · ' + p.bigGems, cx + 22 + b1 + b2 / 2, cy + 66, 17);
    });
    // un anticipo della notte in più
    const ek = world.earlyBuyCheck(now), ey = top + 72 + 3 * (ch + 8) + 2;
    if (ek !== 'off') {
      K.txt(c, t('shopEarly'), x + 30, ey + 24, K.fit(c, t('shopEarly'), w - 250, 17, 700), ek === 'max' ? K.DIM : K.CREAM, 'left', 700);
      if (ek === 'max') K.txt(c, t('shopEarlyMax'), x + w - 30, ey + 24, K.fit(c, t('shopEarlyMax'), 200, 14, 700), K.DIM, 'right', 700);
      else { K.button(c, ui, x + w - 26 - 150, ey, 150, 42, '', { color: ek === 'ok' ? '#7a2f8a' : '#4c3a52', r: 10, tag: 'shopEarly' }, A.shopEarly); gemLabel(c, K, String(SHOP.early), x + w - 26 - 75, ey + 22, 18); }
    }
  } else {
    const can = pay.open(), rh = 86;
    SHOP.gemPacks.forEach((p, i) => {
      const cy = top + i * (rh + 8), best = i === 1, busy = pay.state.busy === p.id;
      K.card(c, x + 26, cy, w - 52, rh, best);
      const s = t('shopGemsN', p.gems);
      K.txt(c, s, x + 96, cy + (best ? 34 : 44), K.fit(c, s, w - 360, 24, 800), '#ffe3fb', 'left', 800);
      if (best) K.txt(c, t('shopBest'), x + 96, cy + 61, K.fit(c, t('shopBest'), w - 360, 14.5, 700), '#ffe9a8', 'left', 700);
      for (let g = 0; g <= Math.min(2, i); g++) gem(c, x + 52 + g * 9, cy + 44 - g * 5, 15 - g * 2);
      const label = busy ? t('shopBusy') : pay.price(p.id);
      K.button(c, ui, x + w - 26 - 196, cy + 14, 180, 58, label, { color: can ? '#2f7d3a' : '#4a4640', fs: 22, tag: 'shopBuy' + i }, () => A.shopBuy(p.id));
    });
    const first = !sh.msg && can && world.firstBuy(), note = sh.msg || (can ? (first ? t('shopFirst') : '') : pay.native() ? t('shopSoon') : t('shopWeb'));
    if (note) K.wrap(c, note, vw / 2, top + 4 * (rh + 8) + 20, w - 70, first ? 17 : 15.5, sh.good ? '#9ff0b4' : first ? '#ffd24a' : '#f0d9b0', 20, 'center');
  }
}

/** «Ti manca»: quello che serve per l'azione appena provata, e quante gemme costa averlo subito. */
export function needPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, N = ui.need; if (!N) return;
  const miss = world.missing(N.cost, N.k || 1);
  if (!miss) { ui.need = null; return; }
  K.dim(S, 0.62);
  const w = Math.min(540, vw - 16), h = 330, x = vw / 2 - w / 2, y = Math.max(6, vh / 2 - h / 2), price = world.gemsFor(miss), ok = world.gems() >= price;
  K.panel(c, x, y, w, h, 18, 0.96);
  K.head(c, t('needTitle'), vw / 2, y + 44, 27, '#f2cf73', 'center');
  // quello che manca, in fila al centro
  { const keys = Object.keys(miss), fs = keys.length > 3 ? 19 : 23; let tw = 0; for (const r of keys) tw += fs + 7 + K.width(c, String(miss[r]), fs, 800) + 18; tw -= 18;
    let lx = vw / 2 - tw / 2; for (const r of keys) { K.txt(c, String(miss[r]), lx + fs + 7, y + 102, fs, K.RES_COL[r], 'left', 800); lx += fs + 7 + K.width(c, String(miss[r]), fs, 800) + 18; }
    lx = vw / 2 - tw / 2; for (const r of keys) { c.beginPath(); K.RES_ICON[r](c, lx + fs / 2, y + 101, fs / 2); lx += fs + 7 + K.width(c, String(miss[r]), fs, 800) + 18; }
    K.flushIcons(c); c.beginPath(); }
  // quante gemme hai
  { const s = t('needHave', world.gems()); K.txt(c, s, vw / 2, y + 148, K.fit(c, s, w - 60, 16, 700), ok ? K.DIM : K.BAD, 'center', 700); }
  const bw = Math.min(340, w - 60);
  if (ok) { const lab = t('needBuy') + '  ' + price; K.button(c, ui, vw / 2 - bw / 2, y + 176, bw, 58, lab, { color: '#7a2f8a', fs: 23, dx: -10, tag: 'needBuy' }, A.needBuy); gem(c, vw / 2 + K.width(c, lab, 23, 800) / 2 + 8, y + 204, 11); }
  else { K.button(c, ui, vw / 2 - bw / 2, y + 176, bw, 58, t('needGems'), { color: '#2f7d3a', fs: 22, tag: 'needGems' }, A.needGems); }
  K.button(c, ui, vw / 2 - 110, y + h - 70, 220, 48, t('close'), { color: '#5c4330', fs: 21, tag: 'needClose' }, A.needClose);
}

/** Il regalo del giorno: sette caselle, quella di oggi accesa, le passate con la spunta. */
export function giftPanel(S, K) {
  const { c, world, ui, vw, vh, A, now } = S, d = world.daily(now);
  if (!d.available) { ui.daily = false; return; }
  K.dim(S, 0.6);
  const w = Math.min(680, vw - 16), h = 372, x = vw / 2 - w / 2, y = Math.max(6, vh / 2 - h / 2), n = GIFT7.length, gap = 6, cw = (w - 36 - gap * (n - 1)) / n, ch = 128, cy = y + 112;
  K.panel(c, x, y, w, h, 18, 0.96);
  K.title2(c, t('daily'), vw / 2, y + 50, 34, '#f2cf73');
  K.txt(c, t('giftHint'), vw / 2, y + 88, K.fit(c, t('giftHint'), w - 40, 16, 600), '#cfd8ff', 'center', 600);
  const extra = (g) => { for (const k in g) if (k !== 'monete') return [k, g[k]]; return null; };
  for (let i = 0; i < n; i++) K.card(c, x + 18 + i * (cw + gap), cy, cw, ch, i + 1 === d.streak);
  for (let i = 0; i < n; i++) {      // prima tutte le scritte
    const bx = x + 18 + i * (cw + gap), g = GIFT7[i], past = i + 1 < d.streak, e = extra(g);
    c.globalAlpha = past ? 0.45 : 1;
    K.txt(c, String(i + 1), bx + cw / 2, cy + 18, 15, i + 1 === d.streak ? '#ffe9a8' : K.DIM, 'center', 800);
    K.txt(c, '+' + g.monete, bx + cw / 2, cy + 68, K.fit(c, '+' + g.monete, cw - 8, 17, 800), K.GOLD, 'center', 800);
    if (e) K.txt(c, '+' + e[1], bx + cw / 2 + 9, cy + 106, K.fit(c, '+' + e[1], cw - 30, 15, 800), e[0] === 'gems' ? '#ffb3f3' : K.RES_COL[e[0]], 'center', 800);
    c.globalAlpha = 1;
  }
  for (let i = 0; i < n; i++) {      // poi le icone
    const bx = x + 18 + i * (cw + gap), g = GIFT7[i], past = i + 1 < d.streak, e = extra(g);
    c.globalAlpha = past ? 0.45 : 1;
    c.beginPath(); K.coin(c, bx + cw / 2, cy + 44, 10); c.beginPath();
    if (e) { const ew = K.width(c, '+' + e[1], 15, 800); if (e[0] === 'gems') gem(c, bx + cw / 2 - ew / 2 - 3, cy + 105, 7); else { c.beginPath(); K.RES_ICON[e[0]](c, bx + cw / 2 - ew / 2 - 3, cy + 105, 7); } }
    c.globalAlpha = 1;
    if (past) K.check(c, bx + cw - 14, cy + 16, 7, '#9ff0b4');
  }
  K.flushIcons(c); c.beginPath();
  K.button(c, ui, vw / 2 - 140, y + h - 104, 280, 72, t('claim'), { color: '#2f7d3a', fs: 28, tag: 'claimDaily' }, A.claimDaily);
}

/** Una stella a cinque punte (solo linee dritte). */
function star(c, x, y, r, col) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; if (i) c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); else c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  c.closePath(); c.fillStyle = col || '#ffd24a'; c.fill(); c.strokeStyle = '#6b4a10'; c.lineWidth = Math.max(1.2, r * 0.14); c.lineJoin = 'round'; c.stroke(); c.beginPath();
}
const left = (ms) => { const h = Math.max(1, Math.ceil(ms / 3600000)); return h + ' h'; };      // solo ore: «g» per giorni vale in italiano e basta
/** Il bottone dell'evento del fine settimana (c'è solo di sabato e domenica): la stella, e sotto quanto manca. */
export function eventButton(S, K, x, y) {
  const { c, world, ui, A, now } = S, e = world.weekend(now); if (!e) return;
  K.button(c, ui, x, y, 54, 48, '', { color: '#8a5a1c', tag: 'eventHud' }, A.evInfo);
  K.txt(c, left(e.left).replace(/ /g, ''), x + 27, y + 37, 12.5, '#ffe9a8', 'center', 800);
  star(c, x + 27, y + 17, 11);
}
export function eventPanel(S, K) {
  const { c, world, ui, vw, vh, A, now } = S, e = world.weekend(now);
  if (!e) { ui.evInfo = false; return; }
  K.dim(S, 0.62);
  const w = Math.min(540, vw - 16), h = 320, x = vw / 2 - w / 2, y = Math.max(6, vh / 2 - h / 2);
  K.panel(c, x, y, w, h, 18, 0.96);
  K.txt(c, t('evTitle'), vw / 2, y + 36, K.fit(c, t('evTitle'), w - 40, 16, 700), '#cfd8ff', 'center', 700);
  K.head(c, t('ev_' + e.id + '_t'), vw / 2, y + 96, K.fit(c, t('ev_' + e.id + '_t'), w - 60, 30, 700, true), '#f2cf73', 'center');
  K.wrap(c, t('ev_' + e.id), vw / 2, y + 142, w - 60, 17, K.CREAM, 23, 'center');
  { const s = t('evLeft', left(e.left)); K.txt(c, s, vw / 2, y + 206, K.fit(c, s, w - 60, 16, 700), '#ffe9a8', 'center', 700); }
  star(c, vw / 2, y + 62, 13);
  K.button(c, ui, vw / 2 - 110, y + h - 70, 220, 48, t('close'), { color: '#5c4330', fs: 21, tag: 'evClose' }, A.evInfo);
}

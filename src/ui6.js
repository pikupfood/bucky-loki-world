// La FLOTTA: le navi (costruire, migliorare, riparare), il commercio per mare, le esplorazioni, le battaglie, e il rapporto di chi torna.
// Come gli altri file dell'interfaccia: ogni funzione riceve S (il fotogramma) e K (gli attrezzi di ui.js).
// ui.fleet = { tab: 'ships' | 'trade' | 'explore' | 'war', ship: id del mercantile scelto, buy, res, tier, n, page, scrap: id da smontare (chiede conferma) }
import { SHIPS, SHIP_ORDER, SHIP_MAX, SEA, SELL_ORDER, TRADE_ORDER, TRIBES, MY_COLOR, villageLoot } from './data.js';
import { t } from './i18n.js';
import { fmtH, clock, itemIcon } from './ui3.js';

const TAU = Math.PI * 2, TABS = ['ships', 'trade', 'explore', 'war'];
const HULL = { mercantile: ['#9b6b3d', '#f4ecd6', '#e2b866'], veliero: ['#2f6fa8', '#ffffff', '#cfe6f5'], guerra: ['#4a3a34', '#c0392b', '#f2c230'] };      // scafo, vele, fregi

/** Un'ancora (l'icona della flotta). */
export function anchorIcon(c, x, y, s, col = '#fff3d6') {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = Math.max(1.6, s * 0.18); c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.arc(0, -s * 0.78, s * 0.22, 0, TAU); c.stroke();
  c.beginPath(); c.moveTo(0, -s * 0.56); c.lineTo(0, s * 0.9); c.moveTo(-s * 0.42, -s * 0.2); c.lineTo(s * 0.42, -s * 0.2); c.stroke();
  c.beginPath(); c.arc(0, s * 0.18, s * 0.72, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
  c.restore();
}
/** Una nave vista di fianco (la prua a destra): scafo curvo, vele gonfie, e a ogni livello qualcosa in più
 *  (castello di poppa dal 2, secondo albero e vela alta dal 3, bandiera lunga dal 4, terzo albero al 5). */
export function shipIcon(c, type, x, y, s, lvl = 0) {
  const [hull, sail, trim] = HULL[type] || HULL.mercantile, masts = lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1, dark = 'rgba(30,16,6,0.82)';
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.ellipse(0.06 * s, s * 0.64, s * 1.22, s * 0.15, 0, 0, TAU); c.fillStyle = 'rgba(94,195,234,0.6)'; c.fill();
  for (let i = 0; i < masts; i++) {
    const mid = (masts - 1) / 2, mx = masts === 1 ? 0.04 * s : (i - mid) * s * 0.6 + 0.04 * s, mh = s * (1.28 - Math.abs(i - mid) * 0.16), top = s * 0.12 - mh;
    c.strokeStyle = '#5c3a1e'; c.lineWidth = Math.max(1.2, s * 0.085); c.beginPath(); c.moveTo(mx, s * 0.14); c.lineTo(mx, top); c.stroke();
    c.lineWidth = Math.max(0.8, s * 0.05); c.strokeStyle = 'rgba(40,24,8,0.6)';
    if (type === 'veliero') {            // vele triangolari
      c.beginPath(); c.moveTo(mx + s * 0.07, top + s * 0.08); c.quadraticCurveTo(mx + s * 0.52, s * -0.1, mx + s * 0.58, s * 0.04); c.lineTo(mx + s * 0.07, s * 0.04); c.closePath(); c.fillStyle = sail; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(mx - s * 0.06, top + s * 0.2); c.quadraticCurveTo(mx - s * 0.36, s * -0.12, mx - s * 0.4, s * 0.04); c.lineTo(mx - s * 0.06, s * 0.04); c.closePath(); c.fillStyle = trim; c.fill(); c.stroke();
    } else {                              // vele quadre gonfie; sopra, dal livello 3, una vela piccola
      const big = lvl >= 2 ? 0.52 : 0.72, w = s * 0.36, y0 = top + mh * (1 - big) * 0.55, y1 = s * 0.0;
      const drawSail = (ya, yb, ww, col) => { c.beginPath(); c.moveTo(mx - ww, ya); c.lineTo(mx + ww, ya); c.quadraticCurveTo(mx + ww * 1.5, (ya + yb) / 2, mx + ww * 0.95, yb); c.lineTo(mx - ww * 0.95, yb); c.quadraticCurveTo(mx - ww * 0.55, (ya + yb) / 2, mx - ww, ya); c.closePath(); c.fillStyle = col; c.fill(); c.stroke(); };
      drawSail(y0, y1, w, sail);
      if (type === 'guerra') { c.save(); c.globalAlpha = 0.28; c.fillStyle = '#fff3d6'; c.fillRect(mx - w * 0.3, y0 + 1, w * 0.36, y1 - y0 - 2); c.restore(); }
      if (lvl >= 2) drawSail(top + s * 0.06, y0 - s * 0.05, w * 0.72, type === 'guerra' ? '#f4ecd6' : trim);
    }
    c.beginPath(); c.moveTo(mx, top); c.lineTo(mx + s * (lvl >= 3 ? 0.46 : 0.3), top + s * 0.08); c.lineTo(mx, top + s * 0.17); c.closePath(); c.fillStyle = i === Math.floor(mid) ? MY_COLOR : trim; c.fill();
  }
  c.strokeStyle = '#5c3a1e'; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(s * 1.02, -s * 0.02); c.lineTo(s * 1.42, -s * 0.24); c.stroke();                 // il bompresso
  if (lvl >= 1 || type === 'guerra') { c.beginPath(); c.rect(-s * 1.04, -s * 0.2, s * 0.5, s * 0.3); c.fillStyle = hull; c.fill(); c.strokeStyle = dark; c.lineWidth = Math.max(1, s * 0.07); c.stroke(); c.fillStyle = trim; c.fillRect(-s * 1.06, -s * 0.25, s * 0.54, s * 0.08); }      // il castello di poppa
  c.beginPath(); c.moveTo(-s * 1.08, s * 0.02); c.lineTo(-s * 0.6, s * 0.11); c.lineTo(s * 0.72, s * 0.11); c.quadraticCurveTo(s * 1.02, s * 0.08, s * 1.22, -s * 0.12); c.quadraticCurveTo(s * 1.04, s * 0.5, s * 0.64, s * 0.62); c.lineTo(-s * 0.72, s * 0.62); c.quadraticCurveTo(-s * 1.02, s * 0.56, -s * 1.08, s * 0.02); c.closePath();
  c.fillStyle = hull; c.fill(); c.strokeStyle = dark; c.lineWidth = Math.max(1.2, s * 0.08); c.stroke();
  c.strokeStyle = trim; c.lineWidth = Math.max(1, s * 0.09); c.beginPath(); c.moveTo(-s * 0.94, s * 0.25); c.quadraticCurveTo(0, s * 0.3, s * 1.0, s * 0.16); c.stroke();
  if (type === 'guerra') { c.fillStyle = '#16100c'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * s * 0.42 - s * 0.02, s * 0.43, s * 0.07, 0, TAU); c.fill(); } }
  if (type === 'mercantile') { c.fillStyle = '#d9b46a'; c.strokeStyle = dark; c.lineWidth = Math.max(0.8, s * 0.04); c.fillRect(s * 0.3, -s * 0.07, s * 0.24, s * 0.18); c.strokeRect(s * 0.3, -s * 0.07, s * 0.24, s * 0.18); c.fillStyle = '#c08e58'; c.fillRect(s * 0.57, -s * 0.02, s * 0.18, s * 0.13); }
  if (type === 'veliero') { c.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * s * 0.4, s * 0.43, s * 0.055, 0, TAU); c.fill(); } }
  c.restore();
}
const shipName = (s) => t('sn_' + s.type + '_' + s.lvl);
const left = (s, now) => Math.max(0, s.job.at + s.job.ms - now);

function shipsTab(S, K, x, y, w, h) {
  const { c, world, ui, A, now } = S, F = world.d.fleet, U = ui.fleet, tall = S.tall;
  const newH = tall ? 232 : 118, rowH = 58, listH = h - newH - 12, all = Math.max(1, Math.floor(listH / rowH)), per = F.length > all ? Math.max(1, Math.floor((listH - 36) / rowH)) : all, pages = Math.max(1, Math.ceil(F.length / per));      // con più pagine, l'ultima riga lascia il posto alle frecce
  U.page = Math.max(0, Math.min(pages - 1, U.page || 0));
  if (!F.length) K.wrap(c, t(world.harbours().length ? 'sea_empty' : 'sea_noPort'), x + w / 2, y + listH / 2 - 10, Math.min(520, w - 40), 16.5, K.CREAM, 23);
  F.slice(U.page * per, U.page * per + per).forEach((s, i) => {
    const ry = y + i * rowH, mx = world.shipHpMax(s), up = world.shipUpCheck(s), fix = world.repairCost(s), ask = U.scrap === s.id;
    K.card(c, x, ry, w, rowH - 6, !s.job && s.hp >= mx);
    shipIcon(c, s.type, x + 34, ry + 22, 17, s.lvl);
    K.head(c, shipName(s), x + 70, ry + 17, 16.5, '#ffe9a8');
    K.txt(c, t('level') + ' ' + (s.lvl + 1) + ' · ' + t('ship_' + s.type), x + 70, ry + 38, 12.5, K.DIM, 'left', 700);
    const sx = x + (tall ? 250 : 300);
    if (s.job) { K.txt(c, t('sea_job_' + s.job.kind), sx, ry + 17, 13.5, '#9fe9ff', 'left', 800); K.txt(c, t('sea_back', fmtH(left(s, now))) + ' · ' + clock(s.job.at + s.job.ms), sx, ry + 37, 12.5, K.CREAM, 'left', 700); return; }
    K.txt(c, t(world.shipFit(s) ? 'sea_inPort' : 'sea_broken'), sx, ry + 17, 13.5, world.shipFit(s) ? '#9ff0b4' : K.BAD, 'left', 800);
    K.bar(c, sx, ry + 32, tall ? 90 : 120, 8, s.hp / mx);
    let bx = x + w - 8;
    bx -= 44; K.button(c, ui, bx, ry + 7, 40, 38, ask ? '?' : '', { color: ask ? '#a8322a' : '#6b4a2c', fs: 18, r: 10, tag: 'shScrap' + s.id }, () => A.fleetScrap(s.id)); if (!ask) K.cross(c, bx + 20, ry + 26, 7);
    if (fix) { const bw = 110; bx -= bw + 6; K.button(c, ui, bx, ry + 7, bw, 38, t('sea_fix'), { color: '#2f5d7a', disabled: !world.afford(fix), fs: 14.5, r: 10, tag: 'shFix' + s.id }, () => A.fleetRepair(s.id)); K.costRow(c, world, fix, bx - 8 - 62, ry + 26, 13, 1, true); }
    else if (up !== 'max') {
      const cost = world.shipUpCost(s), bw = tall ? 110 : 120; bx -= bw + 6;
      K.button(c, ui, bx, ry + 7, bw, 38, t('sea_up'), { color: '#2f7d3a', disabled: up !== 'ok', fs: 14.5, r: 10, tag: 'shUp' + s.id }, () => A.fleetUp(s.id));
      if (up === 'port') K.txt(c, t('sea_needPortLvl'), bx - 8, ry + 26, 12, K.BAD, 'right', 700); else if (!tall) K.costRow(c, world, cost, bx - 8 - 150, ry + 26, 13, 1, true);
    } else K.txt(c, t('sea_max'), bx - 10, ry + 26, 13, '#ffe27a', 'right', 800);
  });
  if (pages > 1) { K.button(c, ui, x + w - 150, y + listH - 34, 44, 30, '‹', { color: '#5c4330', disabled: U.page <= 0, fs: 20, r: 9, tag: 'shPrev' }, () => A.fleetPage(-1)); K.txt(c, (U.page + 1) + '/' + pages, x + w - 78, y + listH - 18, 13.5, K.CREAM, 'center', 800); K.button(c, ui, x + w - 50, y + listH - 34, 44, 30, '›', { color: '#5c4330', disabled: U.page >= pages - 1, fs: 20, r: 9, tag: 'shNext' }, () => A.fleetPage(1)); }
  // una nave nuova
  const ny = y + h - newH, cols = tall ? 1 : 3, cw = (w - (cols - 1) * 10) / cols, ch = tall ? 70 : 92;
  K.rule(c, x, ny, w); K.txt(c, t('sea_new') + ' · ' + t('sea_slots', F.length, world.fleetSlots()), x, ny + 15, 13.5, K.DIM, 'left', 800);
  SHIP_ORDER.forEach((ty, i) => {
    const bx = x + (i % cols) * (cw + 10), by = ny + 26 + Math.floor(i / cols) * (ch + 6), chk = world.shipCheck(ty), ok = chk === 'ok';
    K.card(c, bx, by, cw, ch, ok);
    shipIcon(c, ty, bx + 36, by + ch / 2 - 6, 18, 0);
    K.head(c, t('ship_' + ty), bx + 74, by + 20, 16, ok ? '#ffe9a8' : '#b9b2a4');
    K.txt(c, t('sk_' + ty), bx + 74, by + 40, 12, K.DIM, 'left', 600);
    if (chk === 'ok' || chk === 'cost') K.costRow(c, world, SHIPS[ty].cost, bx + 74, by + ch - 16, 13.5, 1, true);
    else K.txt(c, t('sea_e_' + chk), bx + 74, by + ch - 16, 12.5, K.BAD, 'left', 700);
    ui.buttons.push({ x: bx, y: by, w: cw, h: ch, tag: 'shNew_' + ty, fn: () => A.fleetBuild(ty) });
  });
}

/** Una fila di bottoni a scelta; rende la y dopo la fila. */
function chips(S, K, x, y, w, items, sel, tag, fn, h = 38) {
  const { c, ui } = S, n = items.length, bw = (w - (n - 1) * 6) / n;
  items.forEach((it, i) => K.button(c, ui, x + i * (bw + 6), y, bw, h, it.label, { color: it.id === sel ? '#8a5a1c' : '#5c4330', disabled: !!it.off, fs: K.fit(c, it.label, bw - 10, 15, 800), r: 9, tag: tag + it.id }, () => fn(it.id)));
  return y + h + 10;
}
function tradeTab(S, K, x, y, w, h) {
  const { c, world, ui, A } = S, U = ui.fleet, idle = world.d.fleet.filter(s => s.type === 'mercantile' && world.shipFit(s));
  if (!idle.length) { K.wrap(c, t('sea_noMerchant'), x + w / 2, y + h / 2 - 10, Math.min(520, w - 40), 16.5, K.CREAM, 23); return; }
  const s = idle.find(q => q.id === U.ship) || idle[0]; U.ship = s.id;
  let yy = y;
  if (idle.length > 1) yy = chips(S, K, x, yy, w, idle.slice(0, 5).map(q => ({ id: q.id, label: shipName(q) + ' ' + (q.lvl + 1) })), s.id, 'trShip', A.fleetPick, 34);
  const two = !S.tall, lw = two ? w * 0.56 : w, rx = two ? x + lw + 16 : x;
  yy = chips(S, K, x, yy, lw, [{ id: 0, label: t('sea_sell') }, { id: 1, label: t('sea_buy') }], U.buy ? 1 : 0, 'trMode', (k) => A.fleetBuy(!!k));
  const list = (U.buy ? TRADE_ORDER : SELL_ORDER).map(r => ({ id: r, label: t('r_' + r), off: !world.tradeUnit(r, U.buy) }));
  if (!list.some(o => o.id === U.res && !o.off)) U.res = (list.find(o => !o.off) || list[0]).id;
  yy = chips(S, K, x, yy, lw, list, U.res, 'trRes_', A.fleetRes);
  yy = chips(S, K, x, yy, lw, SEA.trade.map((R, i) => ({ id: i, label: t('sea_route' + i) + ' · ' + fmtH(world.shipMs(s, R.mins)) })), U.tier, 'trTier', A.fleetTier);
  const hold = SHIPS.mercantile.hold[s.lvl];
  if (!(U.n > 0) || U.n > hold) U.n = hold;
  const q = world.tradeQuote(s, U.tier, U.res, U.n, U.buy), R = SEA.trade[U.tier];
  // quanta merce
  K.button(c, ui, x, yy, 46, 40, '−', { color: '#5c4330', fs: 22, r: 10, tag: 'trLess' }, () => A.fleetAmount(-1));
  K.button(c, ui, x + 150, yy, 46, 40, '+', { color: '#5c4330', fs: 22, r: 10, tag: 'trMore' }, () => A.fleetAmount(1));
  K.txt(c, String(q ? q.n : 0), x + 98, yy + 21, 20, K.CREAM, 'center', 800);
  K.txt(c, t('sea_hold', hold), x + 208, yy + 21, 13.5, K.DIM, 'left', 700);
  // il conto, e via
  const qy = two ? y + (idle.length > 1 ? 44 : 0) : yy + 54, qw = two ? w - lw - 16 : w, qh = two ? Math.min(h - (qy - y), 236) : 236;      // in verticale era 186: il bottone «Salpa» copriva l'avviso dei pirati
  K.scroll(c, rx, qy, qw, qh, 12);
  shipIcon(c, 'mercantile', rx + 38, qy + 34, 19, s.lvl);
  K.head(c, shipName(s), rx + 76, qy + 24, 17, K.PENRED, 'left', false);
  K.txt(c, t('level') + ' ' + (s.lvl + 1), rx + 76, qy + 45, 12.5, K.PEN2, 'left', 800);
  if (q && q.n > 0) {
    const line = U.buy ? '−' + q.coins + ' ' + t('r_monete') + '  →  +' + q.n + ' ' + t('r_' + U.res) : '−' + q.n + ' ' + t('r_' + U.res) + '  →  +' + q.coins + ' ' + t('r_monete');
    K.txt(c, line, rx + 18, qy + 80, K.fit(c, line, qw - 36, 17, 800), K.PEN, 'left', 800);
    K.txt(c, t('sea_back', fmtH(q.ms)) + ' · ' + clock(S.now + q.ms), rx + 18, qy + 104, 13.5, K.PEN2, 'left', 800);
  } else K.txt(c, t(U.buy ? 'why_cost' : 'sea_nothing'), rx + 18, qy + 88, 14.5, K.PENBAD, 'left', 800);
  if (R.risk > 0) { const esc = world.hasEscort(), far = !esc && world.hasFaro(); K.wrap(c, t(esc ? 'sea_escort' : far ? 'sea_faro' : 'sea_pirateRisk'), rx + 18, qy + 128, qw - 36, 12.5, esc ? K.PENOK : far ? K.PEN2 : K.PENBAD, 16, 'left'); }
  K.button(c, ui, rx + 16, qy + qh - 60, qw - 32, 46, t('sea_go'), { color: '#2f7d3a', disabled: !q || q.n <= 0, fs: 19, tag: 'trGo' }, A.fleetSail);
}

function exploreTab(S, K, x, y, w, h) {
  const { c, world, ui, A } = S, idle = world.d.fleet.filter(s => s.type === 'veliero' && world.shipFit(s));
  if (!idle.length) { K.wrap(c, t('sea_noVeliero'), x + w / 2, y + h / 2 - 10, Math.min(520, w - 40), 16.5, K.CREAM, 23); return; }
  const s = idle.reduce((a, b) => (b.lvl > a.lvl ? b : a), idle[0]), tall = S.tall, cols = tall ? 1 : 3, cw = (w - (cols - 1) * 12) / cols, ch = tall ? 124 : Math.min(h - 40, 250);
  shipIcon(c, 'veliero', x + 22, y + 8, 14, s.lvl); K.txt(c, shipName(s) + ' · ' + t('level') + ' ' + (s.lvl + 1) + ' · ' + t('sea_ready', idle.length), x + 50, y + 12, 14, K.CREAM, 'left', 800);
  SEA.explore.forEach((E, i) => {
    const bx = x + (i % cols) * (cw + 12), by = y + 34 + Math.floor(i / cols) * (ch + 10);
    K.scroll(c, bx, by, cw, ch, 12);
    K.head(c, t('sea_ex' + i), bx + 16, by + 24, 18, K.PENRED, 'left', false);
    K.txt(c, fmtH(world.shipMs(s, E.mins)) + ' · ' + t('tripAt', clock(S.now + world.shipMs(s, E.mins))), bx + 16, by + 47, 13, K.PEN2, 'left', 800);
    K.wrap(c, t('sea_exd' + i), bx + 16, by + 70, tall ? cw - 190 : cw - 32, 13, K.PEN, 17, 'left');
    if (tall) K.button(c, ui, bx + cw - 160, by + ch - 58, 144, 44, t('sea_go'), { color: '#2f7d5a', fs: 17, tag: 'exGo' + i }, () => A.fleetExplore(s.id, i));
    else K.button(c, ui, bx + 14, by + ch - 58, cw - 28, 44, t('sea_go'), { color: '#2f7d5a', fs: 17, tag: 'exGo' + i }, () => A.fleetExplore(s.id, i));
  });
}

function warTab(S, K, x, y, w, h) {
  const { c, world, ui, A } = S, list = world.warShips(), pw = world.warPower();
  K.txt(c, t('sea_power') + ' ' + pw + ' · ' + t('sea_ready', list.length), x, y + 12, 15, list.length ? K.CREAM : K.BAD, 'left', 800);
  list.slice(0, 8).forEach((s, i) => shipIcon(c, 'guerra', x + w - 26 - i * 40, y + 8, 13, s.lvl));
  const rows = [{ kind: 'pirates', i: -1, name: t('sea_pirates') + ' · ' + t('level') + ' ' + world.d.sea.pirates, def: world.pirateDef(), loot: { monete: 120 * world.d.sea.pirates, legna: 60 * world.d.sea.pirates }, mins: SEA.fightMins, note: t('sea_pirNote') }];
  TRIBES.forEach((T, i) => { if (!world.seaRaidOk(i)) return; const L = villageLoot(T, world.d.villages[i].level), loot = {}; for (const k in L) loot[k] = Math.round(L[k] * 0.5); rows.push({ kind: 'raid', i, T, name: t('sea_raid') + ': ' + t('tr_' + T.id) + ' · ' + t('level') + ' ' + world.d.villages[i].level, def: world.seaRaidDef(i), loot, mins: SEA.raidMins, note: t('sea_raidNote') }); });
  const rowH = 70, max = Math.max(1, Math.floor((h - 30) / rowH));
  rows.slice(0, max).forEach((r, k) => {
    const ry = y + 30 + k * rowH, odds = pw < r.def * 0.9 ? 'low' : pw < r.def * 1.15 ? 'even' : 'good';
    K.card(c, x, ry, w, rowH - 8, false);
    if (r.T) K.tuzu2d(c, x + 30, ry + 30, 15, r.T.color, r.T.eyes); else { c.beginPath(); c.arc(x + 30, ry + 30, 17, 0, TAU); c.fillStyle = '#1c1410'; c.fill(); c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.stroke(); K.txt(c, '☠', x + 30, ry + 31, 19, '#f5ecd7', 'center', 800); }
    K.head(c, r.name, x + 60, ry + 18, K.fit(c, r.name, w - 250, 16, 700, true), '#ffe9a8');
    K.txt(c, t('on_force') + ' ' + r.def + ' · ' + fmtH(r.mins * 60000), x + 60, ry + 39, 12.5, K.DIM, 'left', 700);
    K.costRowPlain(c, r.loot, x + 60 + K.width(c, t('on_force') + ' ' + r.def + ' · ' + fmtH(r.mins * 60000), 12.5, 700) + 14, ry + 39, 12.5);
    if (list.length) K.txt(c, t('odds_' + odds), x + w - 150, ry + 49, 12, odds === 'low' ? K.BAD : odds === 'even' ? '#ffd24a' : '#9ff0b4', 'right', 800);
    K.button(c, ui, x + w - 140, ry + 9, 130, 44, t(r.kind === 'raid' ? 'sea_land' : 'sea_attack'), { color: '#a8322a', disabled: !list.length, fs: 16, tag: 'warGo_' + r.kind + (r.i >= 0 ? r.i : '') }, () => A.fleetWar(r.kind, r.i));
  });
  if (!list.length) K.txt(c, t('sea_noWar'), x, y + h - 10, 13.5, K.BAD, 'left', 700);
}

/** Tutto lo schermo della flotta. */
export function fleetPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, U = ui.fleet, tall = S.tall;
  K.dim(S, 0.66);
  const w = Math.min(1000, vw - 16), h = Math.min(vh - 16, tall ? 980 : 560), x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  K.panel(c, x, y, w, h, 16, 0.97);
  anchorIcon(c, x + 34, y + 32, 15, '#f2cf73');
  K.head(c, t('fleet'), x + 60, y + 32, 25);
  K.txt(c, t('sea_slots', world.d.fleet.length, world.fleetSlots()), x + 74 + K.width(c, t('fleet'), 25, 700, true), y + 35, 14, K.DIM, 'left', 800);
  K.button(c, ui, x + w - 54, y + 10, 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'fleetClose' }, A.fleetClose); K.cross(c, x + w - 32, y + 32, 10);
  const tw = (w - 32 - 3 * 6) / 4;
  TABS.forEach((k, i) => K.button(c, ui, x + 16 + i * (tw + 6), y + 62, tw, 40, t('sea_tab_' + k), { color: U.tab === k ? '#8a5a1c' : '#5c4330', fs: K.fit(c, t('sea_tab_' + k), tw - 10, 16, 800), r: 10, tag: 'fleetTab_' + k }, () => A.fleetTab(k)));
  const ix = x + 18, iy = y + 114, iw = w - 36, ih = h - 132;
  if (U.tab === 'ships') shipsTab(S, K, ix, iy, iw, ih);
  else if (U.tab === 'trade') tradeTab(S, K, ix, iy, iw, ih);
  else if (U.tab === 'explore') exploreTab(S, K, ix, iy, iw, ih);
  else warTab(S, K, ix, iy, iw, ih);
}

/** Una nave è tornata: che cosa porta. */
export function seaReport(S, K) {
  const { c, world, ui, vw, vh, A } = S, R = world.d.seaReports[0];
  if (!R) return;
  K.dim(S, 0.66);
  const fight = R.kind === 'pirates' || R.kind === 'raid', w = Math.min(620, vw - 20), h = 318, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  K.scroll(c, x, y, w, h, 16);
  const title = t(R.kind === 'trade' ? 'sea_rTrade' : R.kind === 'explore' ? 'sea_rExplore' : R.win ? 'sea_rWin' : 'sea_rLose');
  K.ribbon(c, vw / 2, y - 19, Math.min(w - 40, K.width(c, title, 22, 700, true) + 90), 42, title, fight ? (R.win ? '#2f7d3a' : '#8a2f24') : '#2f5d7a', 22);
  shipIcon(c, fight ? 'guerra' : R.ship, x + 62, y + 76, 30, R.lvl || 0);
  let yy = y + 60; const tx = x + 124, tw = w - 148;
  if (R.kind === 'trade') {
    const line = R.buy ? t('sea_rBought', R.n + ' ' + t('r_' + R.res)) : t('sea_rSold', R.n + ' ' + t('r_' + R.res));
    K.txt(c, line, tx, yy, K.fit(c, line, tw, 18, 800), K.PEN, 'left', 800); yy += 34;
    K.costRowPlain(c, R.got, tx, yy, 22, K.PEN); yy += 40;
    if (R.robbed) yy = K.wrap(c, t('sea_rRobbed'), tx, yy, tw, 14.5, K.PENBAD, 20, 'left') + 26;
  } else if (R.kind === 'explore') {
    K.txt(c, t('sea_ex' + R.tier), tx, yy, 18, K.PEN, 'left', 800); yy += 34;
    K.costRowPlain(c, R.loot, tx, yy, 17, K.PEN); yy += 36;
    for (const i of R.found || []) { const T = TRIBES[i]; K.tuzu2d(c, tx + 12, yy, 12, T.color, T.eyes); K.txt(c, t('reportFound', t('tr_' + T.id)), tx + 34, yy + 1, 16, K.PEN, 'left', 800); yy += 32; }
    for (const it of R.items || []) { itemIcon(c, it, tx + 12, yy, 11); K.txt(c, t('reportItem', t('it_' + it)), tx + 34, yy + 1, 16, '#8a5a1c', 'left', 800); yy += 32; }
  } else {
    const who = R.kind === 'raid' ? t('tr_' + TRIBES[R.i].id) : t('sea_pirates') + ' ' + t('level') + ' ' + R.plv;
    K.txt(c, who, tx, yy, 18, K.PEN, 'left', 800); yy += 30;
    K.txt(c, t('sea_rForces', R.a, R.d), tx, yy, 15, K.PEN2, 'left', 800); yy += 34;
    if (R.win) { K.costRowPlain(c, R.loot, tx, yy, 17, K.PEN); yy += 34; }
    yy = K.wrap(c, t(R.win ? (R.kind === 'raid' ? 'sea_rRaidWin' : 'sea_rPirUp') : 'sea_rHurt', R.win && R.kind !== 'raid' ? world.d.sea.pirates : ''), tx, yy, tw, 14, R.win ? K.PEN2 : K.PENBAD, 19, 'left') + 24;
  }
  K.button(c, ui, x + 26, y + h - 70, 210, 50, t('fleet'), { color: '#6b4a2c', fs: 18, tag: 'seaFleet' }, A.seaFleet);
  K.button(c, ui, x + w - 236, y + h - 70, 210, 50, t('ok'), { color: '#2f7d3a', fs: 21, tag: 'seaOk' }, A.seaOk);
  void SHIP_MAX;
}

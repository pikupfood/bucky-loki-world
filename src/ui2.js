// Pannelli e pezzi d'interfaccia delle tappe più recenti: guida compatta, «In arrivo» in basso, abitanti e mestieri,
// caserma con sei unità, poteri dell'eroe, eventi, racconto, esplorazione, cantieri, tempo.
// Ogni funzione riceve S (lo stato del fotogramma) e K (gli attrezzi da disegno di ui.js).
import { G, BUILD, UNITS, UNIT_ORDER, TRIBES, MY_COLOR, ROLES, RUINS, FOG, HERO, HERO_POWERS, HERO_ITEMS, DIFF_ORDER, GOALS, FOOD } from './data.js';
import { itemIcon } from './ui3.js';
import { tribeMark } from './ui7.js';
import { t, has } from './i18n.js';

const TAU = Math.PI * 2, INK = '#2b2a33';

/** Il Tuzu guida col cappello giallo, dentro un tondo. */
export function guideFace(S, K, x, y, r, color = MY_COLOR, hat = true) {
  const { c, ui } = S, bob = Math.sin(ui.time * 2.6) * r * 0.06;
  K.flushIcons(c);
  c.beginPath(); c.arc(x, y + 2, r + 3, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
  c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fillStyle = '#3a2614'; c.fill();
  { const g = c.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#6a58a0'); g.addColorStop(1, '#2c2344'); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = g; c.fill(); }
  { const g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.5, '#e9c46a'); g.addColorStop(1, '#a8782a'); c.strokeStyle = g; c.lineWidth = 3; c.stroke(); }
  c.save(); c.beginPath(); c.arc(x, y, r - 1.5, 0, TAU); c.clip(); K.tuzu2dNow(c, x, y + r * 0.24 + bob, r * 0.8, color); c.restore();
  if (!hat) return;
  c.beginPath(); c.moveTo(x - r * 0.52, y - r * 0.52 + bob); c.lineTo(x + r * 0.06, y - r * 1.3 + bob); c.lineTo(x + r * 0.52, y - r * 0.52 + bob); c.closePath(); c.fillStyle = '#f2c230'; c.fill(); c.strokeStyle = '#8a6410'; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.arc(x + r * 0.06, y - r * 1.3 + bob, r * 0.1, 0, TAU); c.fillStyle = '#fff'; c.fill();
}

/** Il Tuzu guida: sempre in vista. Compatto di solito; col consiglio su come fare nei primi obiettivi (o se tocchi il suo viso). */
export function guide(S, K) {
  const { c, world, ui, A } = S;
  if (ui.screen !== 'play') return;
  const g = world.goal(), open = ui.guideOpen == null ? !!g : ui.guideOpen;
  // il cibo non basta per stanotte: il consiglio della guida diventa quello (se le torri ci sono già)
  const fn = world.status === 'day' && g && !g.done && !(g.kind === 'night' && world.towers() < world.towersWanted()) ? world.foodNeed() : null, ff = fn && fn.short ? world.foodFix(S.now) : null;
  const tipS = ff && ff.k !== 'wait' ? t('gt_food', fn.have, fn.need) : g && has('gt_' + g.kind) ? t('gt_' + g.kind) : '', tip = !!g && !g.done && open && !!tipS;      // il consiglio resta aperto per tutti i primi obiettivi
  // il pannello si allunga quanto serve: un consiglio di tre o quattro righe (o in una lingua più lunga) finiva sopra la barra
  const x = 14, y = S.tall ? 120 : 66, w = 366, nl = tip ? Math.max(2, Math.ceil(K.width(c, tipS, 12.5, 600) / (w - 104))) : 0, h = tip ? 68 + nl * 15 : 68, fx = x + 36, fy = y + 36;
  K.scroll(c, x, y, w, h, 14); K.block(ui, x, y, w, h); ui.guideH = h;
  guideFace(S, K, fx, fy + 2, 26);
  ui.buttons.push({ x, y, w: 72, h, tag: 'guideToggle', fn: A.guideToggle });
  if (!g) { K.head(c, t('goalsDone'), x + 76, y + 26, 16.5, K.PEN, 'left', false); K.txt(c, t('goalsDone2'), x + 76, y + 48, 12.5, K.PEN2, 'left', 700); return; }
  // il frammento della Lanterna e a che punto sei degli obiettivi
  const sh = world.shardCount(), count = (sh ? '◆ ' + sh + '/' + TRIBES.length + '   ' : '') + (g.i + 1) + '/' + GOALS.length, cwid = K.width(c, count, 11, 800);
  const ttl = t('g_' + g.kind, g.need);
  K.head(c, ttl, x + 76, y + 19, K.fit(c, ttl, w - 96 - cwid, 16.5, 700, true), K.PEN, 'left', false);
  K.txt(c, count, x + w - 12, y + 16, 11, K.PEN2, 'right', 800);
  if (g.done) {
    const pulse = 0.5 + Math.sin(ui.time * 6) * 0.5;
    K.button(c, ui, x + 76, y + 31, 132, 31, t('claim'), { color: '#2f7d3a', fs: 16, r: 10, stroke: 'rgba(255,236,170,' + (0.6 + pulse * 0.4) + ')', tag: 'goalClaim' }, A.claimGoal);
    K.costRowPlain(c, g.reward, x + 218, y + 47, 14.5, K.PEN);
    c.beginPath(); c.arc(fx + 22, fy - 20, 10, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); K.txt(c, '!', fx + 22, fy - 19, 14, '#fff', 'center', 800);
    return;
  }
  let yy = y + 38;
  if (tip) { K.wrap(c, tipS, x + 76, yy, w - 90, 12.5, ff && ff.k !== 'wait' ? K.PENRED : K.PEN, 15, 'left'); yy = y + 48 + nl * 15; } else yy = y + 46;
  if (g.need > 1) { K.bar(c, x + 76, yy - 5, 110, 8, g.have / g.need, '#e9a820'); K.txt(c, g.have + '/' + g.need, x + 194, yy, 12.5, K.PEN, 'left', 800); }
  K.costRowPlain(c, g.reward, x + (g.need > 1 ? 246 : 76), yy, 13, K.PEN);
}

/** Chi arriva stanotte e da dove: una striscia in basso, fra «Costruisci» e «Inizia notte». */
export function incoming(S, K) {
  const { c, world, vw, vh } = S, n = world.nextNight, from = world.attackers(n), x = S.tall ? 14 : 234, y = S.tall ? vh - 14 - 66 - 76 : vh - 14 - 66, maxW = S.tall ? vw - 28 : vw - x - 256;      // in verticale sta sopra i due bottoni grandi
  if (maxW < 200) return;
  if (!from.length) { const s = t('quietInfo'), pw = Math.min(maxW, K.width(c, s, 16, 700) + 56); K.panel(c, x, y + 10, pw, 46); K.moon(c, x + 24, y + 33, 9); K.txt(c, s, x + 42, y + 34, 16, '#cfd8ff', 'left', 700); return; }
  const sum = world.waveSum(n), types = Object.keys(sum), T0 = TRIBES[from[0]];
  const step = (ty) => Math.max(62, 17 + K.width(c, '×' + sum[ty], 15, 800) + 27);      // un numero di tre cifre finiva sotto l'icona dopo
  const iw = K.width(c, t('incoming'), 14, 700), pw = Math.min(maxW, Math.max(26 + iw + types.reduce((a, ty) => a + step(ty), 0), 60 + from.length * 40 + K.width(c, t('from'), 13, 600)));
  K.panel(c, x, y, pw, 66, 12, 0.86);
  K.txt(c, t('incoming'), x + 12, y + 19, 14, K.DIM, 'left', 700);
  let xx = x + 12 + iw + 22;
  for (const ty of types) { if (xx + step(ty) - 12 > x + pw) break; K.enemyIcon(c, ty, xx, y + 21, 0.72, T0.color, T0.eyes); K.txt(c, '×' + sum[ty], xx + 17, y + 21, 15, K.CREAM, 'left', 800); xx += step(ty); }
  K.txt(c, t('from'), x + 12, y + 48, 13, K.DIM, 'left', 600); xx = x + 12 + K.width(c, t('from'), 13, 600) + 14;
  for (const i of from) { const T = TRIBES[i]; K.tuzu2d(c, xx, y + 47, 8, T.color, T.eyes); tribeMark(c, i, xx + 18, y + 47, 7.5); xx += 39; }
  if (from.length <= 2 && xx + 90 < x + pw) K.txt(c, from.map(i => t('tr_' + TRIBES[i].id)).join(', '), xx, y + 48, 13, K.CREAM, 'left', 700);
  // nemico mai visto: una riga sopra che dice come affrontarlo
  const fresh = types.find(ty => ty !== 'orco' && !world.d.seen[ty]);
  if (fresh) {
    const tip = t('tip_' + fresh), head = t('newEnemy') + ': ' + t('e_' + fresh), tw = Math.min(maxW + 220, Math.max(K.width(c, tip, 13.5, 700), K.width(c, head, 15, 700, true)) + 74);      // l'intestazione è scritta col carattere a grazie: va misurata con quello
    K.scroll(c, x, y - 58, tw, 50, 12);
    K.enemyIcon(c, fresh, x + 26, y - 32, 0.9, T0.color, T0.eyes);
    K.head(c, head, x + 52, y - 43, 15, K.PENRED, 'left', false); K.txt(c, tip, x + 52, y - 23, 13.5, K.PEN, 'left', 700);
  }
}

/** I due poteri dell'eroe, in battaglia. right = dove finisce lo spazio libero; rende dove comincia quello che ha occupato. */
export function heroButtons(S, K, right, cy) {
  const { c, world, ui, A } = S;
  if (!world.heroUnit()) return right;
  const r = 30; let cx = right - r;
  const HB = world.heroBonus();
  for (const k of HERO_POWERS) {
    if (k === 'heal' && world.d.hero.lvl < HERO.heal.lvl) continue;
    const cd = world.heroCd[k], ready = cd <= 0, on = k === 'shout' && world.shoutT > 0;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fillStyle = on ? '#c2452d' : ready ? (k === 'shout' ? '#a8552d' : k === 'heal' ? '#2f8f5b' : '#6b3fa0') : '#33303a'; c.fill();
    c.strokeStyle = ready ? 'rgba(255,236,170,0.85)' : 'rgba(255,255,255,0.2)'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = ready ? '#ffe9a8' : '#8a8478'; c.fillStyle = c.strokeStyle; c.lineWidth = 3; c.lineCap = 'round';
    if (k === 'slam') { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); c.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); c.stroke(); } c.beginPath(); c.arc(cx, cy, 5, 0, TAU); c.fill(); }
    else if (k === 'heal') { c.lineWidth = 7; c.beginPath(); c.moveTo(cx - 12, cy); c.lineTo(cx + 12, cy); c.moveTo(cx, cy - 12); c.lineTo(cx, cy + 12); c.stroke(); }
    else { c.beginPath(); c.moveTo(cx - 13, cy - 4); c.lineTo(cx - 3, cy - 9); c.lineTo(cx - 3, cy + 9); c.lineTo(cx - 13, cy + 4); c.closePath(); c.fill(); for (const rr of [8, 14]) { c.beginPath(); c.arc(cx - 2, cy, rr, -0.7, 0.7); c.stroke(); } }
    if (!ready) { c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, cd / (HERO[k].cd * HB.cd))); c.closePath(); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fill(); }
    ui.buttons.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, tag: 'hero_' + k, fn: () => A.heroPower(k) });
    cx -= r * 2 + 8;
  }
  return cx + r - 2;
}

/** Il corpo del pannello della caserma: sei tipi di soldato, la guardia, il punto di raccolta. (x, y, w, h = il pannello) */
export function barracks(S, K, b, x, y, w, h) {
  const { c, world, ui, A } = S, tall = w < 820;
  const units = b.units || [], SL = world.slots(b), room = units.length < SL, noPop = room && world.popUsed() >= world.popMax();
  const head = t('soldiers') + ' ' + units.length + '/' + SL + (b.build > 0 ? ' · ' + t('building') : noPop ? ' · ' + t('needHouses') : '');
  K.txt(c, head, x + 82, y + 54, 16, noPop ? K.BAD : K.DIM);
  units.forEach((u, k) => K.tuzuIcon(c, u, x + 104 + K.width(c, head, 16) + k * 30, y + 50, 11, MY_COLOR));
  { const lc = world.levelCheck(b), ix = x + w - 262; if (lc !== 'none' && lc !== 'max') { K.button(c, ui, ix, y + 47, 104, 26, t('improve'), { color: '#2f7d3a', disabled: lc !== 'ok', fs: 13, r: 8, tag: 'levelUp' }, () => A.levelUp(b)); K.costRow(c, world, world.levelCost(b), ix + 112, y + 60, 13, 1, true); } }
  // demolire, guardia e raccolta: in alto a destra, oppure (in verticale) su una riga loro accanto a «Sposta»
  const by = y + 80, bx0 = x + 128;
  K.button(c, ui, bx0, by, 92, 36, t(ui.demoAsk === b.id ? 'sure' : 'demolish'), { color: ui.demoAsk === b.id ? '#a8322a' : '#7a3a2c', fs: 13.5, r: 10, tag: 'demolish' }, () => A.demolish(b));
  K.button(c, ui, bx0 + 100, by, 150, 36, t('stay') + ': ' + (b.stay ? t('on') : t('off')), { color: b.stay ? '#8a5a1c' : '#5c4330', fs: 14.5, r: 10, tag: 'stay' }, () => A.stay(b));
  K.button(c, ui, bx0 + 256, by, 166, 36, world.d.rally ? t('rallyOff') : t('rally'), { color: '#5c4330', fs: 14.5, r: 10, tag: 'rally' }, world.d.rally ? A.rallyClear : A.rallyPick);
  const cols = tall ? 3 : UNIT_ORDER.length, gap = 6, ch = 106, cw = tall ? (w - 32 - gap * (cols - 1)) / cols : 134, y0 = y + 126;
  UNIT_ORDER.forEach((u, k) => {
    const U = UNITS[u], bx = x + 16 + (k % cols) * (cw + gap), cy = y0 + Math.floor(k / cols) * (ch + gap), chk = world.trainCheck(b, u), ok = chk === 'ok', shut = chk === 'castle' || chk === 'tech';
    K.card(c, bx, cy, cw, ch, ok);
    c.globalAlpha = shut ? 0.4 : 1; K.tuzuIcon(c, u, bx + 22, cy + 30, 13, MY_COLOR); c.globalAlpha = 1;
    K.txt(c, t('u_' + u), bx + 42, cy + 18, 13.5, shut ? '#9a948a' : K.CREAM, 'left', 800);
    K.txt(c, String(U.hp), bx + 58, cy + 39, 12.5, K.DIM, 'left', 700); K.heart(c, bx + 48, cy + 38, 4.6, '#ff7f9f');
    K.wrap(c, has('ud_' + u) ? t('ud_' + u) : t('dmg') + ' ' + U.dmg + (U.range ? ' · ' + t('ranged') : ''), bx + 9, cy + 58, cw - 16, 11.5, K.DIM, 13, 'left');
    if (chk === 'castle') K.txt(c, t('needCastle', U.min), bx + 9, cy + 91, 12, K.DIM, 'left', 700);
    else if (chk === 'tech') K.txt(c, t('needTech', t('t_' + U.tech)), bx + 9, cy + 91, 12, K.DIM, 'left', 700);
    else if (chk === 'full') K.txt(c, t('full'), bx + 9, cy + 91, 12.5, K.DIM, 'left', 700);
    else K.costRow(c, world, U.cost, bx + 9, cy + 91, 13, 1, true);
    ui.buttons.push({ x: bx, y: cy, w: cw, h: ch, tag: 'train_' + u, fn: () => A.train(b, u) });
  });
  void h;
}

/** Gli abitanti e i loro mestieri. */
export function rolesPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S;
  K.dim(S, 0.6);
  const w = 640, h = 500, x = vw / 2 - w / 2, y = vh / 2 - h / 2, max = world.workersMax();
  let used = 0; for (const r of ROLES) used += world.d.roles[r] || 0;
  K.panel(c, x, y, w, h, 18, 0.96);
  K.title2(c, t('rolesTitle'), vw / 2, y + 38, 32, '#f2cf73');
  K.txt(c, t('rolesFree', Math.max(0, max - used)) + ' · ' + t('rolesAll', max), vw / 2, y + 72, 15, K.CREAM, 'center', 700);
  ROLES.forEach((r, k) => {
    const ry = y + 92 + k * 66, n = world.d.roles[r] || 0;
    c.beginPath(); c.roundRect(x + 20, ry, w - 40, 58, 12); c.fillStyle = n ? 'rgba(74,92,58,0.9)' : 'rgba(255,255,255,0.06)'; c.fill();
    K.tuzuIcon(c, { bosco: 'ascia', pietra: 'piccone', campi: 'falce', cantiere: 'martello' }[r], x + 44, ry + 34, 14, MY_COLOR);
    K.txt(c, t('ro_' + r), x + 80, ry + 20, 17, K.CREAM, 'left', 800);
    K.txt(c, t('rod_' + r), x + 80, ry + 41, 12.5, K.DIM, 'left', 600);
    K.button(c, ui, x + w - 172, ry + 9, 44, 40, '−', { color: '#5c4330', disabled: n <= 0, fs: 24, r: 10, tag: 'role_' + r + '_m' }, () => A.role(r, -1));
    K.txt(c, String(n), x + w - 104, ry + 30, 22, K.CREAM, 'center', 800);
    K.button(c, ui, x + w - 80, ry + 9, 44, 40, '+', { color: '#2f7d3a', disabled: used >= max, fs: 24, r: 10, tag: 'role_' + r + '_p' }, () => A.role(r, 1));
  });
  { const st = world.fedState(), need = world.mouths(), have = world.foodStock();      // da mangiare
    K.RES_ICON.cibo(c, x + 36, y + 372, 10);
    K.txt(c, t('foodLine', have, need) + ' · ' + t('food_' + st), x + 54, y + 373, 14.5, st === 'hungry' || (st !== 'off' && have < need) ? K.BAD : st === 'full' ? '#9ff0b4' : K.CREAM, 'left', 700); }
  K.wrap(c, t('moraleTip'), vw / 2, y + 400, w - 60, 13, K.DIM, 17);
  K.button(c, ui, vw / 2 - 100, y + h - 54, 200, 42, t('close'), { color: '#5c4330', fs: 19, tag: 'close' }, A.roles);
}

/** Una riga che dice cosa comporta una scelta: costi, guadagni, morale, il resto. */
function effects(S, K, o, x, y, ev) {
  const { c, world } = S;
  let yy = y;
  if (o.cost) { K.costRow(c, world, o.cost, x, yy, 15, 1, true); yy += 24; }
  if (o.gain) { K.costRowPlain(c, o.gain, x, yy, 15); yy += 24; }
  const parts = [];
  if (o.mood) parts.push(t('morale') + ' ' + (o.mood > 0 ? '+' : '−') + Math.abs(o.mood));
  if (o.lose) for (const r in o.lose) parts.push('−' + o.lose[r] + ' ' + t('r_' + r));
  if (o.extra) parts.push(t('ev_plusWorker'));
  if (o.ally != null) parts.push(t('ally'));
  if (o.more) parts.push(t(o.more > 0 ? 'ev_allyMore' : 'ev_allyLess', Math.abs(o.more)));
  if (o.needArmy) parts.push(t('ev_needArmy', o.needArmy));
  if (o.rel) parts.push(t('rel') + ' ' + (o.rel > 0 ? '+' : '−') + Math.abs(o.rel));
  if (o.calm) parts.push(t('ev_calm'));
  if (o.rage) parts.push(t('ev_rage'));
  if (o.pact != null) parts.push(t('ev_pact', t('tr_' + TRIBES[o.pact].id)));
  if (o.betray) parts.push(t('ev_betray'));
  if (o.weaken != null) parts.push(t('ev_weaken', t('tr_' + TRIBES[o.weaken].id)));
  if (!parts.length && !o.cost && !o.gain) parts.push(t('ev_nothing'));
  if (parts.length) K.wrap(c, parts.join(' · '), x, yy, 270, 14, o.mood < 0 || o.lose || o.more < 0 || o.rage || o.betray || o.rel < 0 ? K.BAD : '#9ff0b4', 19, 'left');
  void ev;
}
/** Un evento a sorpresa: chi parla, cosa succede, due scelte. */
export function eventPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, ev = world.d.event;
  if (!ev) return;
  const o = world.eventOpts(ev), T = ev.i != null ? TRIBES[ev.i] : null;
  K.dim(S, 0.62);
  const w = 680, h = 372, x = vw / 2 - w / 2, y = vh / 2 - h / 2, bw = (w - 60) / 2;
  K.scroll(c, x, y, w, h, 16);
  const ttl = t('ev_' + ev.id);
  K.ribbon(c, vw / 2, y - 19, Math.min(w - 60, K.width(c, ttl, 23, 700, true) + 90), 42, ttl, T ? '#8a2f24' : '#5b4a8a', 23);
  guideFace(S, K, x + 64, y + 86, 40, T ? T.color : MY_COLOR, !T);
  if (T) K.head(c, t('tr_' + T.id), x + 124, y + 50, 16, K.PENRED, 'left', false);
  K.wrap(c, t('evt_' + ev.id, T ? t('tr_' + T.id) : '', ev.j != null ? t('tr_' + TRIBES[ev.j].id) : ''), x + 124, y + (T ? 78 : 62), w - 154, 16.5, K.PEN, 22, 'left');
  [0, 1].forEach((k) => {
    const bx = x + 20 + k * (bw + 20), by = y + 168, can = (!o[k].cost || world.afford(o[k].cost)) && !(o[k].needArmy && world.popUsed() < o[k].needArmy);
    K.panel(c, bx, by, bw, 184, 13, 0.97);
    K.button(c, ui, bx + 14, by + 14, bw - 28, 52, t('ev' + (k ? 'b' : 'a') + '_' + ev.id), { color: k ? '#6b4a2c' : '#2f7d3a', disabled: !can, fs: 19, tag: 'event' + k }, () => A.eventChoose(k));
    effects(S, K, o[k], bx + 20, by + 92, ev);
  });
}

/** Un capitolo del racconto: il Tuzu guida, il testo, e a che punto è la Lanterna. */
export function storyPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, k = ui.story;
  K.dim(S, 0.74);
  const w = Math.min(760, vw - 16), h = w < 760 ? 450 : 410, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
  K.scroll(c, x, y, w, h, 18);
  K.ribbon(c, vw / 2, y - 18, 230, 38, t('chapter', k + 1), '#5b4a8a', 18);
  guideFace(S, K, x + 86, y + 118, 56);
  K.head(c, t('st' + k + 't'), x + 170, y + 62, K.fit(c, t('st' + k + 't'), w - 200, 29, 700, true), K.PENRED, 'left', false);
  K.rule(c, x + 170, y + 86, Math.min(300, w - 210), '122,44,30');
  K.wrap(c, t('st' + k), x + 170, y + 116, w - 200, 17.5, K.PEN, 25, 'left');
  // la Lanterna: un frammento per popolo
  const n = world.shardCount(), lx = x + 170, ly = y + h - 104;
  K.txt(c, t('lantern') + ' ' + n + '/' + TRIBES.length, lx, ly, 14, '#8a5a1c', 'left', 800);
  TRIBES.forEach((T, i) => {
    const px = lx + 14 + i * 30, py = ly + 30, got = !!world.d.shards[i];
    c.beginPath(); c.moveTo(px, py - 12); c.lineTo(px + 9, py); c.lineTo(px, py + 12); c.lineTo(px - 9, py); c.closePath();
    c.fillStyle = got ? (T.id === 'neri' ? '#8f86b0' : T.color) : 'rgba(110,80,40,0.16)'; c.fill(); c.strokeStyle = got ? '#4e351d' : 'rgba(110,80,40,0.45)'; c.lineWidth = 1.6; c.stroke();
  });
  K.button(c, ui, x + w - 230, y + h - 74, 200, 52, t('goOn'), { color: '#2f7d3a', fs: 22, tag: 'storyOk' }, A.storyOk);
}

/** Hai toccato le nuvole (o delle rovine): puoi mandarci un esploratore. */
export function fogPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, f = ui.fogSel, w = 600, h = 128, x = vw / 2 - w / 2, y = vh - h - 12, chk = world.scoutCheck();
  K.panel(c, x, y, w, h, 14, 0.95); K.block(ui, x, y, w, h);
  K.tuzuIcon(c, 'esplora', x + 42, y + 42, 19, MY_COLOR);
  K.head(c, t(f.ruin ? 'ruinTitle' : 'fogTitle'), x + 78, y + 26, 21, '#ffe9a8');
  K.txt(c, t(f.ruin ? 'ruinInfo' : 'fogInfo'), x + 78, y + 52, 14.5, K.DIM, 'left', 600);
  K.button(c, ui, x + w - 52, y + 8, 42, 42, '', { color: '#5c4330', r: 21, tag: 'fogClose' }, A.fogClose); K.cross(c, x + w - 31, y + 29, 9);
  K.button(c, ui, x + 20, y + h - 56, 280, 46, t('sendScout'), { color: '#2f7d5a', disabled: chk !== 'ok', fs: 18, tag: 'scout' }, A.scout);
  K.costRow(c, world, { monete: FOG.cost }, x + 316, y + h - 33, 17, 1, true);
  if (chk === 'busy' || chk === 'full') K.txt(c, t(chk === 'full' ? 'scoutFull' : 'scoutBusy'), x + 380, y + h - 32, 13.5, K.BAD, 'left', 700);
}

/** Segni sopra il mondo: cantieri, rovine da prendere, punto di raccolta, dove andrà l'esploratore, pioggia e neve. */
export function marks(S, K) {
  const { c, world, ui, vw, vh, P } = S, bob = Math.sin(ui.time * 3.4) * 3;
  if (ui.screen !== 'play') return;
  const on = (p, m) => p.x > -m && p.x < vw + m && p.y > -m && p.y < vh + m;
  for (const b of world.d.buildings) {
    if (!(b.build > 0)) continue;
    const p = P.pt(b.x, b.y, 60), wd = 54 * P.sc(b.x, b.y);
    if (on(p, 60)) K.bar(c, p.x - wd / 2, p.y, wd, 6, 1 - b.build / (BUILD[b.type].time || 1), '#ffd24a');
  }
  for (const R of RUINS) {
    if (world.d.ruins[R.id] || !world.seen(R.c, R.r)) continue;
    const p = P.pt((R.c + 0.5) * G, (R.r + 0.5) * G, 70);
    if (!on(p, 30)) continue;
    K.bubble(c, p.x, p.y + bob, 13, '#ffe27a'); K.txt(c, '?', p.x, p.y + bob + 1, 17, '#5c3a10', 'center', 800);
  }
  if (world.d.rally) {
    const R = world.d.rally, p = P.pt(R.x, R.y, 0), q = P.pt(R.x, R.y, 54);
    if (on(p, 40)) { c.strokeStyle = '#4a3020'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + 20, q.y + 7); c.lineTo(q.x, q.y + 14); c.closePath(); c.fillStyle = MY_COLOR; c.fill(); c.strokeStyle = 'rgba(20,14,30,0.6)'; c.lineWidth = 1.5; c.stroke(); }
  }
  if (ui.fogSel) { const f = ui.fogSel, k = 0.5 + Math.sin(ui.time * 5) * 0.5; K.tracePoly(c, P.circle(f.x, f.y, 60 + k * 14, 26)); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.setLineDash([8, 7]); c.stroke(); c.setLineDash([]); }
  if (ui.rallyPick) { const s = t('rallyPick'), w = K.width(c, s, 19) + 96, hy = S.tall ? 228 : 108, x0 = vw / 2 - w / 2; K.panel(c, x0, hy, w, 52, 26, 0.9); K.txt(c, s, x0 + 22, hy + 27, 19, '#ffe9a8', 'left'); K.button(c, ui, x0 + w - 52, hy + 4, 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'rallyCancel' }, S.A.rallyCancel); K.cross(c, x0 + w - 30, hy + 26, 9); }
  // pioggia e neve
  const wt = world.d.weather;
  if (wt === 'pioggia' || wt === 'neve') {
    c.save();
    if (wt === 'pioggia') { c.strokeStyle = 'rgba(200,225,255,0.5)'; c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i < 90; i++) { const x = (i * 137.5 + ui.time * 140) % (vw + 60) - 30, y = (i * 71.3 + ui.time * 620) % (vh + 40) - 20; c.moveTo(x, y); c.lineTo(x - 5, y + 16); } c.stroke(); c.fillStyle = 'rgba(40,60,90,0.1)'; c.fillRect(0, 0, vw, vh); }
    else { c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 80; i++) { const x = (i * 137.5 + Math.sin(ui.time * 0.8 + i) * 22 + ui.time * 12) % (vw + 40) - 20, y = (i * 53.7 + ui.time * (36 + (i % 5) * 9)) % (vh + 20) - 10; c.beginPath(); c.arc(x, y, 1.6 + (i % 3) * 0.8, 0, TAU); c.fill(); } }
    c.restore();
  }
}

/** Al mattino, se la notte ha distrutto qualcosa: un bottone per rifarlo tutto, col costo. */
/** Due o più campi maturi: un tocco li raccoglie tutti e li risemina uguali. */
export function harvestPill(S, K) {
  const { c, world, ui, vw, A, now } = S;
  if (world.status !== 'day') return;
  const n = world.ripeFields(now).length;
  if (n < 2) return;
  const label = t('harvestAll', n), w = K.width(c, label, 16, 800) + 70, busy = world.d.rebuild && world.d.rebuild.length && world.rebuildPlan().n, x = S.tall ? 14 : vw / 2 - w / 2, y = S.tall ? (ui.guideH || 68) + 130 : busy ? 114 : 64;
  K.button(c, ui, x, y, w, 44, label, { color: '#8a5a1c', fs: 16, r: 22, dx: 14, tag: 'harvestAll' }, A.harvestAll);
  K.coin(c, x + 26, y + 22, 10);
}
export function rebuildPill(S, K) {
  const { c, world, ui, vw, A } = S;
  if (!world.d.rebuild || !world.d.rebuild.length || world.status !== 'day') return;
  const P = world.rebuildPlan();
  if (!P.n) return;
  const label = t('rebuildN', P.n), lw = K.width(c, label, 16, 800), keys = Object.keys(P.cost).length, w = lw + 60 + keys * 70 + 46, x = S.tall ? vw - 14 - w - (world.fleetSlots() ? 62 : 0) : vw / 2 - w / 2, y = S.tall ? 166 : 64, ok = world.afford(P.cost);
  K.panel(c, x, y, w, 44, 22, 0.93);
  K.button(c, ui, x + 5, y + 5, lw + 34, 34, label, { color: '#2f7d3a', disabled: !ok, fs: 16, r: 17, tag: 'rebuild' }, A.rebuild);
  K.costRow(c, world, P.cost, x + lw + 50, y + 23, 15, 1, true);
  K.button(c, ui, x + w - 39, y + 5, 34, 34, '', { color: '#5c4330', r: 17, tag: 'rebuildSkip' }, A.rebuildSkip); K.cross(c, x + w - 22, y + 22, 7);
}

/** Quanto rende il villaggio: una riga per risorsa, al minuto; per il cibo anche quanto se ne mangia a notte. (Si apre toccando le risorse.) */
export function resPanel(S, K) {
  const { c, world, ui, A } = S, prod = world.production(), keys = ['monete', 'legna', 'pietra'];
  if (world.d.tech.ferro || world.d.res.ferro >= 1) keys.push('ferro');
  if (world.d.tech.cristallo || world.d.res.cristallo >= 1) keys.push('cristallo');
  keys.push('grano', 'cibo');
  const x = 14, y = S.tall ? 118 : 64, w = 366, h = 62 + keys.length * 30 + 46;
  K.panel(c, x, y, w, h, 14, 0.97); ui.buttons.push({ x, y, w, h, tag: 'resClose', fn: A.resInfo });
  K.head(c, t('resTitle'), x + 16, y + 24, 18);
  keys.forEach((k, i) => {
    const yy = y + 56 + i * 30, v = prod[k] || 0, s = (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + ' ' + t('perMin');
    K.txt(c, String(Math.floor(world.d.res[k] || 0)), x + 44, yy + 1, 16, K.RES_COL[k], 'left', 800);
    K.txt(c, t('r_' + k), x + 104, yy + 1, 14, K.DIM, 'left', 600);
    K.txt(c, v ? s : '—', x + w - 16, yy + 1, 15, v > 0 ? '#9ff0b4' : K.DIM, 'right', 800);
    K.RES_ICON[k](c, x + 24, yy, 9);
  });
  const st = world.fedState(), yy = y + 56 + keys.length * 30 + 6;
  K.wrap(c, t('eatLine', world.mouths()) + (st === 'off' ? ' · ' + t('food_off') : ''), x + 16, yy, w - 32, 13.5, st === 'hungry' ? K.BAD : K.CREAM, 18, 'left');
}

/** Gli oggetti che l'eroe ha trovato: una fila di icone (quelli che mancano, in ombra). */
export function heroItems(S, K, x, y) {
  const { c, world } = S, it = world.d.hero.items || {};
  HERO_ITEMS.forEach((k, i) => { c.globalAlpha = it[k] ? 1 : 0.22; c.beginPath(); c.arc(x + i * 34, y, 14, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill(); itemIcon(c, k, x + i * 34, y, 9); c.globalAlpha = 1; });
}

/** Nelle impostazioni: musica e account, difficoltà, qualità. (cx = centro, y = riga) */
export function settingsExtra(S, K, cx, y) {
  const { c, world, ui, A } = S;
  K.button(c, ui, cx - 228, y, 222, 42, t('music') + ': ' + (ui.music ? t('on') : t('off')), { color: '#5c4330', fs: 17, tag: 'music' }, A.music);
  K.button(c, ui, cx + 6, y, 222, 42, t('account') + (ui.cloud && ui.cloud.user ? ' ✓' : ''), { color: '#2f5d7a', fs: 17, tag: 'account' }, A.account);
  K.txt(c, t('quality'), cx, y + 146, 15, K.DIM, 'center', 700);
  ['auto', 2, 1, 0].forEach((q, k) => K.button(c, ui, cx - 228 + k * 115, y + 160, 110, 42, t('q_lv' + q), { color: ui.q === q ? '#8a5a1c' : '#5c4330', fs: 15.5, tag: 'q_' + q }, () => A.quality(q)));
  { const nm = world.villageName(), s = t('vBanner') + (nm ? ': ' + nm : ''); K.button(c, ui, cx - 228, y + 216, 456, 42, s, { color: '#5b4a8a', fs: 17, tag: 'vBannerOpen' }, A.vBannerOpen); }
  K.txt(c, t('difficulty'), cx, y + 68, 15, K.DIM, 'center', 700);
  DIFF_ORDER.forEach((d, k) => K.button(c, ui, cx - 228 + k * 154, y + 82, 148, 42, t('diff_' + d), { color: world.d.diff === d ? '#8a5a1c' : '#5c4330', fs: 16.5, tag: 'diff_' + d }, () => A.diff(d)));
}
/** Sul titolo, per una partita nuova: la scelta della difficoltà. */
export function titleDiff(S, K, cx, y) {
  const { c, ui, A } = S;
  DIFF_ORDER.forEach((d, k) => K.button(c, ui, cx - 228 + k * 154, y, 148, 40, t('diff_' + d), { color: ui.diffPick === d ? '#8a5a1c' : '#5c4330', fs: 16.5, tag: 'pick_' + d }, () => A.diffPick(d)));
}
void INK; void FOOD; void BUILD;

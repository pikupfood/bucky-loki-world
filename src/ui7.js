// I pannelli del terzo giro (20/11/2026): «Da fare adesso», «perché hai perso» e il foglio dell'allenamento, le missioni di oggi,
// le frecce «arrivano da qui», i simboli dei popoli, «sposta più cose», nome e stemma del villaggio.
// Ogni funzione riceve (S, K): K è la cassetta degli attrezzi di ui.js.
import { G, BUILD, TRIBES, MY_COLOR, BANNER, NIGHT } from './data.js';
import { t } from './i18n.js';

const TAU = Math.PI * 2;

// ---------- i simboli dei popoli: una forma per popolo, così non conta solo il colore ----------
/** Il simbolo del popolo i (0-8) dentro un tondino scuro, centrato in (x, y), raggio s. */
export function tribeMark(c, i, x, y, s, col) {
  const T = TRIBES[i]; if (!T) return;
  c.save(); c.translate(x, y);
  c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fillStyle = 'rgba(24,16,10,0.88)'; c.fill(); c.strokeStyle = col || T.color; c.lineWidth = Math.max(1.2, s * 0.16); c.stroke();
  c.fillStyle = col || T.color; c.strokeStyle = col || T.color; c.lineJoin = 'round'; c.lineCap = 'round';
  const r = s * 0.56, poly = (n, rot = -Math.PI / 2, k = 1) => { c.beginPath(); for (let j = 0; j < n; j++) { const a = rot + j * TAU / n; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } c.closePath(); c.fill(); };
  switch (i % 9) {
    case 0: poly(3, -Math.PI / 2, 1.12); break;                                   // triangolo
    case 1: c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.fill(); break;        // tondo
    case 2: c.lineWidth = s * 0.28; c.beginPath(); c.moveTo(-r, -r * 0.35); c.lineTo(-r * 0.3, r * 0.35); c.lineTo(r * 0.3, -r * 0.35); c.lineTo(r, r * 0.35); c.stroke(); break;      // onda
    case 3: { c.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * TAU / 10, k = j % 2 ? 0.48 : 1.15; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } c.closePath(); c.fill(); break; }      // stella
    case 4: poly(4, 0, 1.1); break;                                               // rombo
    case 5: c.fillRect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64); break;          // quadrato
    case 6: c.lineWidth = s * 0.3; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); c.stroke(); break;      // croce
    case 7: c.lineWidth = s * 0.26; c.beginPath(); c.arc(0, 0, r * 0.78, 0, TAU); c.stroke(); break;      // anello
    default: poly(6, 0, 1.08);                                                    // esagono
  }
  c.restore();
}

// ---------- lo stemma del villaggio ----------
/** Lo stemma: uno scudo del colore scelto col simbolo dentro. */
export function bannerIcon(c, sym, col, x, y, s) {
  const C = BANNER.cols[col] || BANNER.cols[0];
  c.save(); c.translate(x, y);
  c.beginPath(); c.moveTo(-s * 0.8, -s); c.lineTo(s * 0.8, -s); c.lineTo(s * 0.8, s * 0.15); c.quadraticCurveTo(s * 0.8, s * 0.8, 0, s * 1.1); c.quadraticCurveTo(-s * 0.8, s * 0.8, -s * 0.8, s * 0.15); c.closePath();
  c.fillStyle = C; c.fill(); c.strokeStyle = '#e9c46a'; c.lineWidth = Math.max(1.5, s * 0.12); c.stroke();
  const ink = col === 5 ? '#3a2a1a' : '#fff6e0', r = s * 0.42;
  c.fillStyle = ink; c.strokeStyle = ink; c.lineJoin = 'round'; c.lineCap = 'round'; c.translate(0, -s * 0.08);
  const poly = (n, rot, k = 1) => { c.beginPath(); for (let j = 0; j < n; j++) { const a = rot + j * TAU / n; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } c.closePath(); c.fill(); };
  switch (sym) {
    case 0: { c.beginPath(); c.moveTo(-r, r * 0.6); c.lineTo(-r, -r * 0.5); c.lineTo(-r * 0.45, 0); c.lineTo(0, -r * 0.8); c.lineTo(r * 0.45, 0); c.lineTo(r, -r * 0.5); c.lineTo(r, r * 0.6); c.closePath(); c.fill(); break; }      // corona
    case 1: { c.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * TAU / 10, k = j % 2 ? 0.46 : 1.1; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } c.closePath(); c.fill(); break; }      // stella
    case 2: c.fillRect(-r * 0.9, -r * 0.2, r * 1.8, r * 0.95); c.fillRect(-r * 0.9, -r * 0.8, r * 0.45, r * 0.7); c.fillRect(-r * 0.22, -r * 0.8, r * 0.45, r * 0.7); c.fillRect(r * 0.45, -r * 0.8, r * 0.45, r * 0.7); break;      // torre
    case 3: c.lineWidth = s * 0.14; c.beginPath(); c.moveTo(-r * 0.8, r * 0.8); c.lineTo(r * 0.7, -r * 0.7); c.moveTo(r * 0.8, r * 0.8); c.lineTo(-r * 0.7, -r * 0.7); c.stroke(); break;      // due lance
    case 4: { c.beginPath(); c.moveTo(0, r * 0.95); c.bezierCurveTo(-r * 1.5, -r * 0.2, -r * 0.5, -r * 1.1, 0, -r * 0.35); c.bezierCurveTo(r * 0.5, -r * 1.1, r * 1.5, -r * 0.2, 0, r * 0.95); c.fill(); break; }      // cuore
    case 5: poly(3, -Math.PI / 2, 1.05); c.fillRect(-r * 0.16, r * 0.4, r * 0.32, r * 0.55); break;      // albero
    case 6: { c.beginPath(); c.arc(0, 0, r * 0.9, 0.5, TAU - 0.5); c.arc(r * 0.42, 0, r * 0.66, TAU - 0.9, 0.9, true); c.closePath(); c.fill(); break; }      // luna
    default: { c.beginPath(); c.moveTo(-r, r * 0.2); c.quadraticCurveTo(0, r * 1.2, r, r * 0.2); c.closePath(); c.fill(); c.fillRect(-r * 0.07, -r * 0.9, r * 0.14, r * 1.1); c.beginPath(); c.moveTo(r * 0.1, -r * 0.85); c.lineTo(r * 0.8, -r * 0.05); c.lineTo(r * 0.1, -r * 0.05); c.closePath(); c.fill(); }      // nave
  }
  c.restore();
}

/** Il nome e lo stemma del villaggio, sopra il castello (solo se il giocatore li ha scelti). */
export function homeLabel(S, K) {
  const { c, world, ui, vw, vh, P } = S;
  if (ui.screen !== 'play' || (!world.d.vname && !world.d.banner) || !world.castle) return;
  const p = P.pt(world.castle.x, world.castle.y, 170); if (p.x < 60 || p.x > vw - 60 || p.y < 120 || p.y > vh - 110) return;
  const B = world.banner(), s = world.villageName(), w = (s ? K.width(c, s, 15, 800) + 14 : 0) + 38;
  c.beginPath(); c.roundRect(p.x - w / 2, p.y - 13, w, 26, 13); c.fillStyle = 'rgba(40,26,52,0.86)'; c.fill(); c.strokeStyle = 'rgba(233,196,106,0.7)'; c.lineWidth = 1.5; c.stroke();
  if (s) K.txt(c, s, p.x - w / 2 + 34, p.y + 1, 15, K.CREAM, 'left', 800);
  bannerIcon(c, B.sym, B.col, p.x - w / 2 + 17, p.y - 1, 9);
}

// ---------- «arrivano da qui»: frecce sul percorso dei nemici ----------
/** Di giorno, mentre prepari le difese (e sempre nelle prime notti): frecce che corrono verso il castello lungo la strada dei nemici. */
export function enemyArrows(S, K) {
  const { c, world, ui, vw, vh, P } = S;
  if (world.status !== 'day' || ui.multi || ui.map || ui.online) return;
  const pl = ui.place && BUILD[ui.place.type], defCat = (k) => k === 'dif' || k === 'mura';
  const show = world.nextNight <= NIGHT.free || (ui.build && defCat(ui.build.cat)) || (pl && defCat(pl.cat));
  if (!show) return;
  const from = world.attackers(world.nextNight);
  for (const i of from) {
    if (!world.known(i) && world.nextNight > 1) continue;
    const path = world.enemyPath(i), T = TRIBES[i], n = path.length; if (n < 6) continue;
    const a0 = Math.max(0, n - 26);
    let first = null;
    for (let k = a0; k < n - 1; k++) {
      const u = (ui.time * 1.3) % 1;
      const A = path[k], B = path[k + 1], x = A.x + (B.x - A.x) * u, y = A.y + (B.y - A.y) * u;
      const p = P.pt(x, y, 0), q = P.pt(x + (B.x - A.x) * 0.3, y + (B.y - A.y) * 0.3, 0);
      if (p.x < -20 || p.x > vw + 20 || p.y < 60 || p.y > vh - 60) continue;
      const ang = Math.atan2(q.y - p.y, q.x - p.x), s = Math.max(8, Math.min(15, Math.hypot(q.x - p.x, q.y - p.y) * 1.1));
      c.save(); c.translate(p.x, p.y); c.rotate(ang); c.globalAlpha = 0.35 + 0.6 * Math.sin(Math.PI * u);
      c.beginPath(); c.moveTo(-s, -s * 0.8); c.lineTo(s * 0.4, 0); c.lineTo(-s, s * 0.8); c.lineWidth = s * 0.62; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = 'rgba(30,14,8,0.85)'; c.stroke();
      c.lineWidth = s * 0.34; c.strokeStyle = T.color; c.stroke();
      c.restore();
    }
    for (let k = a0; k < n; k++) { const p = P.pt(path[k].x, path[k].y, 0); if (p.x > 90 && p.x < vw - 90 && p.y > 130 && p.y < vh - 130) { first = p; break; } }
    if (first) {
      const s = t('comeFrom'), w = K.width(c, s, 14, 800) + 46;
      K.panel(c, first.x - w / 2, first.y - 44, w, 28, 14, 0.9);
      K.txt(c, s, first.x - w / 2 + 34, first.y - 29, 14, '#ffe9a8', 'left', 800);
      tribeMark(c, i, first.x - w / 2 + 17, first.y - 30, 10);
    }
  }
}

// ---------- «Da fare adesso» ----------
export function todoIcon(c, x, y, s) { listIcon(c, x, y, s); }
function listIcon(c, x, y, s) {
  c.fillStyle = '#f5ecd7'; c.beginPath(); c.roundRect(x - s * 0.8, y - s, s * 1.6, s * 2, s * 0.22); c.fill();
  c.strokeStyle = '#2f7d3a'; c.lineWidth = s * 0.2; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { const yy = y - s * 0.55 + i * s * 0.55; c.beginPath(); c.moveTo(-s * 0.55 + x, yy); c.lineTo(-s * 0.38 + x, yy + s * 0.16); c.lineTo(-s * 0.12 + x, yy - s * 0.16); c.stroke(); }
  c.fillStyle = '#8a6a3a'; for (let i = 0; i < 3; i++) c.fillRect(x + s * 0.05, y - s * 0.62 + i * s * 0.55, s * 0.55, s * 0.16);
}
/** Il bottone in alto a destra, col numero delle cose pronte. */
export function todoButton(S, K, x, y) {
  const { c, world, ui, A, now } = S;
  const key = Math.floor(ui.time * 2);      // la lista si ricalcola due volte al secondo, non a ogni fotogramma
  if (!ui._todo || ui._todo.key !== key || ui._todo.rev !== world.rev) ui._todo = { key, rev: world.rev, list: world.todo(now) };
  const n = ui._todo.list.length;
  K.button(c, ui, x, y, 54, 48, '', { color: n ? '#2f6b3a' : '#5c4330', tag: 'todoHud' }, A.todo);
  listIcon(c, x + 27, y + 24, 12);
  if (n) { c.beginPath(); c.arc(x + 50, y + 4, 11, 0, TAU); c.fillStyle = '#e0452f'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); K.txt(c, String(n), x + 50, y + 5, 14, '#fff', 'center', 800); }
}
export function todoPanel(S, K) {
  const { c, world, ui, vw, vh, A, now } = S;
  K.dim(S, 0.6);
  const rh = 54, list = world.todo(now).slice(0, Math.max(3, Math.min(7, Math.floor((vh - 240) / rh)))), canDrill = world.attackers(world.nextNight).length > 0;
  const w = Math.min(600, vw - 16), h = 76 + Math.max(1, list.length) * rh + 86 + 60, x = vw / 2 - w / 2, y = Math.max(8, vh / 2 - h / 2);
  K.panel(c, x, y, w, h, 18, 0.96);
  K.head(c, t('todoTitle'), vw / 2, y + 40, 28, '#f2cf73', 'center');
  K.rule(c, x + 40, y + 62, w - 80);
  let yy = y + 76;
  if (!list.length) { K.txt(c, t('todoNone'), vw / 2, yy + 26, K.fit(c, t('todoNone'), w - 60, 17, 600), K.DIM, 'center', 600); yy += rh; }
  list.forEach((o, i) => {
    K.card(c, x + 18, yy, w - 36, rh - 6, o.k === 'goal' || o.k === 'week');
    const s = t('td_' + o.k, o.n);
    K.txt(c, s, x + 36, yy + 25, K.fit(c, s, w - 210, 17.5, 700), o.k === 'food' ? '#ffb4a8' : K.CREAM, 'left', 700);
    K.button(c, ui, x + w - 150, yy + 4, 118, 40, t('todoGo'), { color: '#2f7d3a', fs: 18, tag: 'todo' + i }, () => A.todoGo(o));
    yy += rh;
  });
  // in fondo: la notte di allenamento
  K.card(c, x + 18, yy + 6, w - 36, 72, false);
  K.txt(c, t('drillBtn'), x + 36, yy + 30, K.fit(c, t('drillBtn'), w - 230, 18.5, 800), '#ffe9a8', 'left', 800);
  K.txt(c, t('drillInfo'), x + 36, yy + 55, K.fit(c, t('drillInfo'), w - 230, 14, 600), K.DIM, 'left', 600);
  K.button(c, ui, x + w - 172, yy + 16, 140, 52, t('drillGo'), { color: canDrill ? '#34406a' : '#4a4038', fs: 19, tag: 'drill' }, A.drill);
  K.button(c, ui, vw / 2 - 110, y + h - 58, 220, 46, t('close'), { color: '#5c4330', fs: 21, tag: 'close' }, A.todo);
}

// ---------- il foglio della notte: «perché hai perso» e l'esito dell'allenamento ----------
function nightSheet(S, K, o) {
  const { c, ui, vw, vh, A } = S, rep = o.rep || {};
  K.dim(S, 0.62);
  const w = Math.min(600, vw - 16), h = 92 + (o.sub ? 44 : 0) + (o.penalty != null ? 36 : 0) + Math.ceil(o.facts.length / 2) * 44 + 8 + 96 + 88, x = vw / 2 - w / 2, y0 = Math.max(6, vh / 2 - h / 2);
  K.panel(c, x, y0, w, h, 18, 0.96);
  K.title2(c, o.title, vw / 2, y0 + 54, K.fit(c, o.title, w - 60, 40, 700, true), o.color);
  let y = y0 + 92;
  if (o.sub) { K.wrap(c, o.sub, vw / 2, y, w - 70, 16.5, K.CREAM, 22); y += 44; }
  if (o.penalty != null) { const s = '−' + o.penalty, tw = K.width(c, s, 26, 800); K.txt(c, s, vw / 2 + 12, y + 2, 26, K.BAD, 'center', 800); K.coin(c, vw / 2 + 12 - tw / 2 - 18, y, 12); y += 36; }
  // quattro fatti, due per riga
  const facts = o.facts, cw = (w - 56) / 2;
  facts.forEach((f, i) => {
    const fx = x + 22 + (i % 2) * (cw + 12), fy = y + Math.floor(i / 2) * 44;
    K.card(c, fx, fy, cw, 38, false);
    K.txt(c, f.s, fx + (f.mark != null ? 40 : 14), fy + 20, K.fit(c, f.s, cw - (f.mark != null ? 52 : 26), 16, 700), f.bad ? '#ffb4a8' : K.CREAM, 'left', 700);
    if (f.mark != null) tribeMark(c, f.mark, fx + 21, fy + 19, 11);
  });
  y += Math.ceil(facts.length / 2) * 44 + 8;
  // il consiglio, su pergamena
  const adv = t('adv_' + rep.adv, rep.cap);
  K.scroll(c, x + 22, y, w - 44, 96, 12);
  K.head(c, t('advTitle'), x + 44, y + 26, 17, K.PENRED, 'left', false);
  K.wrap(c, adv, x + 44, y + 52, w - 96, 15.5, K.PEN, 20, 'left');
  K.tuzu2d(c, x + w - 50, y + 30, 13, MY_COLOR);
  const by = y0 + h - 70, bw = (w - 60) / 2;
  K.button(c, ui, x + 22, by, bw, 54, t('lostFix'), { color: '#8a5a1c', fs: 21, tag: 'lostFix' }, () => A.lostFix(rep.adv));
  K.button(c, ui, x + 38 + bw, by, bw, 54, o.ok, { color: '#2f7d3a', fs: 21, tag: o.okTag }, o.okFn);
}
export function lostPanel(S, K) {
  const { ui, A } = S, rep = ui.lost.rep || { adv: 'towers', cap: 4, left: 0, towers: 0, fell: 0, from: -1 };
  nightSheet(S, K, {
    title: t('lose'), color: '#ff8a80', penalty: ui.lost.penalty, rep, ok: t('again'), okTag: 'lostOk', okFn: A.lostOk,
    facts: [
      { s: t('lostLeft', rep.left), bad: true },
      rep.from >= 0 ? { s: t('lostFrom', t('tr_' + TRIBES[rep.from].id)), mark: rep.from } : { s: t('lostKills', rep.kills || 0) },
      { s: t('lostTowers', rep.towers, rep.cap), bad: rep.towers < rep.cap },
      { s: t('lostFell', rep.fell) },
    ],
  });
}
export function drillPanel(S, K) {
  const { ui, A } = S, D = ui.drillEnd, rep = D.rep;
  nightSheet(S, K, {
    title: t(D.won ? 'drillWon' : 'drillLost'), color: D.won ? '#9ff0b4' : '#ff8a80', sub: t('drillText'), rep, ok: t('close'), okTag: 'drillOk', okFn: A.drillOk,
    facts: [
      { s: t('lostKills', rep.kills || 0) },
      { s: t('lostLeft', rep.left), bad: rep.left > 0 },
      { s: t('lostHp', Math.round((rep.hp || 0) * 100)), bad: rep.hp < 0.5 },
      { s: t('lostFell', rep.fell), bad: rep.fell > 0 },
    ],
  });
}
/** Durante l'allenamento: una striscia che lo ricorda, con «Basta così». */
export function drillStrip(S, K) {
  const { c, world, ui, vw, A } = S;
  if (!world.drill) return;
  const s = t('drillOn'), sw = K.width(c, s, 16.5, 800), bw = Math.max(120, K.width(c, t('drillStop'), 15, 800) + 30), w = sw + bw + 62, x = vw / 2 - w / 2, y = S.tall ? 236 : 66;
  K.panel(c, x, y, w, 46, 23, 0.94); K.block(ui, x, y, w, 46);
  K.txt(c, s, x + 22, y + 24, 16.5, '#bcd0ff', 'left', 800);
  K.button(c, ui, x + w - bw - 8, y + 6, bw, 34, t('drillStop'), { color: '#7a3a2c', fs: 15, r: 10, tag: 'drillStop' }, A.drillStop);
}

// ---------- le missioni di oggi (scheda del pannello Missioni) ----------
export function todayTab(S, K, x, y, w) {
  const { c, world, ui, A, now } = S, L = world.challenges(now), W = world.week(now);
  const row = (ry, title, have, goal, ready, reward, tag, fn, done) => {
    K.card(c, x + 20, ry, w - 40, 76, ready);
    K.txt(c, title, x + 38, ry + 24, K.fit(c, title, w - 260, 19, 800), K.CREAM, 'left', 800);
    K.bar(c, x + 38, ry + 47, Math.min(320, w - 300), 13, have / goal, ready ? '#ffd24a' : '#6fd45a');
    K.txt(c, have + '/' + goal, x + 50 + Math.min(320, w - 300), ry + 54, 16, K.DIM);
    const bx = x + w - 196, bw = 160;
    if (ready) K.button(c, ui, bx, ry + 10, bw, 56, t('claim') + (reward ? ' +' + reward : ''), { color: '#2f7d3a', fs: 19, tag }, fn);
    else if (done) K.check(c, bx + bw / 2, ry + 38, 12, '#9ff0b4');
    else if (reward) { const rs = '+' + reward, rw = K.width(c, rs, 22, 800); K.txt(c, rs, bx + bw / 2 + 14, ry + 39, 22, K.GOLD, 'center', 800); K.coin(c, bx + bw / 2 + 14 - rw / 2 - 17, ry + 38, 11); }
  };
  L.forEach((ch, i) => row(y + i * 84, ch.k === 'nights' && ch.need === 1 ? t('q_night1') : t('q_' + ch.k, ch.need), ch.have, ch.need, ch.done && !ch.claimed, ch.reward, 'claimChal' + i, () => A.claimChallenge(i), ch.claimed));
  row(y + 3 * 84, t('weekTitle'), W.n, W.need, W.ready, W.prize.monete, 'claimWeek', A.claimWeek, W.claimed);
  const all = L.length > 0 && L.every(ch => ch.claimed), s = t(all ? 'todayAllDone' : 'todayAll');
  K.txt(c, s, x + w / 2, y + 4 * 84 + 14, K.fit(c, s, w - 50, 15.5, 700), all ? '#9ff0b4' : '#bcd0ff', 'center', 700);
}

// ---------- «sposta più cose» ----------
const outline = (c, P, b, dc, dr, col) => {
  const D = BUILD[b.type], x0 = (b.c + dc) * G, y0 = (b.r + dr) * G, x1 = x0 + D.w * G, y1 = y0 + D.h * G;
  const q = [P.pt(x0, y0, 0), P.pt(x1, y0, 0), P.pt(x1, y1, 0), P.pt(x0, y1, 0)];
  c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
  c.fillStyle = col.replace('1)', '0.28)'); c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();
};
/** I contorni degli edifici scelti (e dell'anteprima dello spostamento) e la striscia coi bottoni. */
export function multiBar(S, K) {
  const { c, world, ui, vw, vh, A, P } = S, M = ui.multi;
  if (!M) return;
  M.ids = M.ids.filter(id => world.byId.has(id));
  const list = M.ids.map(id => world.byId.get(id));
  let chk = null;
  if (M.to) { chk = world.groupCheck(M.ids, M.to.dc, M.to.dr); for (const b of list) outline(c, P, b, M.to.dc, M.to.dr, chk.bad.includes(b.id) ? 'rgba(255,90,70,1)' : 'rgba(120,235,130,1)'); }
  for (const b of list) outline(c, P, b, 0, 0, 'rgba(255,226,120,1)');
  const n = list.length, s = t(M.step === 'place' ? 'moveManyWhere' : 'moveManyHint'), sw = K.width(c, s, 16, 800);
  const okW = 150, w = Math.min(vw - 16, sw + okW + 112), x = vw / 2 - w / 2, y = S.tall ? 228 : 108;
  K.panel(c, x, y, w, 56, 26, 0.94); K.block(ui, x, y, w, 56);
  K.txt(c, s, x + 24, y + 29, K.fit(c, s, w - okW - 96, 16, 800), '#ffe9a8', 'left', 800);
  if (M.step === 'pick') K.button(c, ui, x + w - okW - 60, y + 8, okW, 40, t('moveManyGo', n), { color: n ? '#2f7d3a' : '#4a4038', fs: 16, r: 10, tag: 'multiGo' }, A.multiGo);
  else K.button(c, ui, x + w - okW - 60, y + 8, okW, 40, t('moveManyOk'), { color: chk && chk.why === 'ok' && (M.to.dc || M.to.dr) ? '#2f7d3a' : '#4a4038', fs: 16, r: 10, tag: 'multiOk' }, A.multiOk);
  K.button(c, ui, x + w - 52, y + 6, 44, 44, '', { color: '#7a3a2c', r: 22, tag: 'multiClose' }, A.multiClose); K.cross(c, x + w - 30, y + 28, 9);
  void vh;
}

// ---------- nome e stemma del villaggio ----------
export function bannerPanel(S, K) {
  const { c, world, ui, vw, vh, A } = S, B = world.banner();
  K.dim(S, 0.62);
  const w = Math.min(560, vw - 16), h = 430, x = vw / 2 - w / 2, y = Math.max(6, vh / 2 - h / 2);
  K.panel(c, x, y, w, h, 18, 0.96);
  K.head(c, t('vBanner'), vw / 2, y + 40, 27, '#f2cf73', 'center');
  const name = world.villageName() || t('vNameNone');
  K.txt(c, name, vw / 2 + 26, y + 92, K.fit(c, name, w - 250, 24, 800), K.CREAM, 'center', 800);
  bannerIcon(c, B.sym, B.col, vw / 2 - Math.min(w - 250, K.width(c, name, 24, 800)) / 2 - 6, y + 90, 19);
  K.button(c, ui, vw / 2 - 130, y + 122, 260, 44, t('vName'), { color: '#5b4a8a', fs: 18, tag: 'vName' }, A.vName);
  const cw = (w - 48) / 8;
  for (let i = 0; i < BANNER.syms; i++) {
    const bx = x + 24 + i * cw, on = i === B.sym;
    K.button(c, ui, bx + 3, y + 186, cw - 6, 70, '', { color: on ? '#8a5a1c' : '#4a3828', tag: 'vSym' + i }, () => A.vBanner(i, null));
    bannerIcon(c, i, B.col, bx + cw / 2, y + 219, 20);
  }
  BANNER.cols.forEach((col, i) => {
    const bx = x + 24 + i * cw, on = i === B.col;
    K.button(c, ui, bx + 3, y + 270, cw - 6, 54, '', { color: on ? '#8a5a1c' : '#4a3828', tag: 'vCol' + i }, () => A.vBanner(null, i));
    c.beginPath(); c.arc(bx + cw / 2, y + 297, 15, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = on ? '#ffe9a8' : 'rgba(0,0,0,0.5)'; c.lineWidth = on ? 3 : 1.5; c.stroke();
  });
  K.button(c, ui, vw / 2 - 110, y + h - 62, 220, 48, t('close'), { color: '#5c4330', fs: 22, tag: 'close' }, A.vBannerClose);
}

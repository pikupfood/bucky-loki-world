// Avvio: scena 3D + interfaccia 2D, camera (trascina, pizzica, rotella), costruzione a quadretti, salvataggio.
import { World } from './world.js';
import { G, COLS, ROWS, BUILD, TOWERS, CASTLE, NATURE } from './data.js';
import { Scene3D } from './scene3d.js';
import { drawUi } from './ui.js';
import { stepFx, parts, ring, text } from './fx.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import * as audio from './audio.js';

const glCanvas = document.getElementById('gl');
const uiCanvas = document.getElementById('ui');
const ctx = uiCanvas.getContext('2d');
const scene = new Scene3D(glCanvas);

const KEY = 'tuzu_difesa_v3';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
const world = new World(saved.world, Date.now(), (Date.now() & 0xffff) + 1);

const ui = {
  screen: 'title', speed: 1, sound: saved.sound !== false, moved: !!saved.moved,
  build: null, place: null, sel: null, aiming: false,
  quests: false, settings: false, daily: false, lost: null, away: world.away,
  buttons: [], fx: [], fxTop: [], night: 0, shake: 0, flash: 0, time: 0, banner: null, toast: null,
};
world.away = null;
function save() { try { localStorage.setItem(KEY, JSON.stringify({ world, lang: getLang(), sound: ui.sound, moved: ui.moved, cam: scene.view })); } catch (e) { /* senza memoria si gioca lo stesso */ } }

const browserLang = (navigator.language || 'it').slice(0, 2);
setLang(saved.lang || (LANGS.includes(browserLang) ? browserLang : 'it'));
audio.setSound(ui.sound);

// qualità grafica: 2 = piena, 1 = meno pixel, 0 = meno pixel e niente ombre (scende da sola se il telefono fatica)
let quality = 2, slow = 0;
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* non tutti i telefoni vibrano */ } }
function toast(str) { ui.toast = { str, t: 0, T: 2 }; audio.play('no'); }

// ---------- schermo ----------
const view = { cw: 1, ch: 1, us: 1, vw: 1280, vh: 720, dpr: 1, portrait: false };
function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  view.cw = cw; view.ch = ch; view.portrait = ch > cw;
  view.dpr = Math.min(window.devicePixelRatio || 1, quality === 2 ? 2 : quality === 1 ? 1.5 : 1);
  const small = ch < 520;                                  // sui telefoni l'interfaccia è più grande
  view.us = Math.min(ch / (small ? 580 : 720), cw / (small ? 1040 : 1180));
  view.vw = cw / view.us; view.vh = ch / view.us;
  uiCanvas.width = Math.round(cw * view.dpr); uiCanvas.height = Math.round(ch * view.dpr);
  scene.resize(cw, Math.max(1, ch), view.dpr);
}
window.addEventListener('resize', resize);

// proiezione mondo -> interfaccia
const P = {
  pt(x, y, h) { const p = scene.project(x, y, h || 0); p.x /= view.us; p.y /= view.us; return p; },
  sc(x, y) { return scene.scaleAt(x, y) / view.us; },
  circle(x, y, r, n = 28) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; out.push(P.pt(x + Math.cos(a) * r, y + Math.sin(a) * r, 0)); } return out; },
};

// ---------- costruzione a quadretti ----------
const cellFree = (c, r) => c >= 2 && r >= 2 && c < COLS - 2 && r < ROWS - 2 && world.occ[r * COLS + c] === 0 && !world.natAt(c, r);
/** Il quadretto in alto a sinistra di un edificio centrato sul punto del terreno g. */
function cellFor(type, g) { const D = BUILD[type]; return { c: Math.floor(g.x / G - D.w / 2 + 0.5), r: Math.floor(g.y / G - D.h / 2 + 0.5) }; }
/** Stato dell'anteprima: quadretti verdi/rossi, se si può confermare e perché no. */
function placeState() {
  const pl = ui.place, D = BUILD[pl.type];
  if (D.line) {
    if (!pl.a) return { line: true, cells: [], ok: false, why: 'pickStart', n: 0 };
    const b = pl.b || pl.a, cells = world.lineCells(pl.a.c, pl.a.r, b.c, b.r), chk = world.lineCheck(pl.type, cells);
    const good = new Set(chk.good.map(q => q.c + ',' + q.r));
    return { line: true, cells: cells.map(q => ({ c: q.c, r: q.r, ok: good.has(q.c + ',' + q.r) })), ok: chk.ok, why: chk.ok ? (pl.b ? 'ok' : 'pickEnd') : chk.why, n: Math.max(1, chk.good.length) };
  }
  if (pl.c == null) return { cells: [], ok: false, why: 'pick', n: 1 };
  const why = world.canPlace(pl.type, pl.c, pl.r), cells = [];
  for (let r = pl.r; r < pl.r + D.h; r++) for (let c = pl.c; c < pl.c + D.w; c++) cells.push({ c, r, ok: cellFree(c, r) && why !== 'occupied' });
  if (why === 'occupied' && cells.every(k => cellFree(k.c, k.r))) cells.forEach(k => { k.ok = false; });     // c'è un nemico sopra
  return { cells, ok: why === 'ok', why, n: 1, at: { x: (pl.c + D.w / 2) * G, y: (pl.r + D.h / 2) * G } };
}
function inGhost(g) {
  const pl = ui.place; if (!pl || !g) return false;
  const c = Math.floor(g.x / G), r = Math.floor(g.y / G), D = BUILD[pl.type];
  if (D.line) { const e = pl.b || pl.a; return !!e && e.c === c && e.r === r; }
  return pl.c != null && c >= pl.c && c < pl.c + D.w && r >= pl.r && r < pl.r + D.h;
}
function moveGhost(g) {
  const pl = ui.place; if (!pl || !g) return;
  const k = cellFor(pl.type, g);
  if (BUILD[pl.type].line) { if (pl.a) pl.b = k; else pl.a = k; } else { pl.c = k.c; pl.r = k.r; }
}
function confirmPlace() {
  const pl = ui.place; if (!pl) return;
  const st = placeState();
  if (!st.ok) { toast(t('why_' + (st.why.startsWith('pick') ? 'pick' : st.why))); return; }
  if (BUILD[pl.type].line) { world.placeLine(pl.type, st.cells); pl.a = null; pl.b = null; }
  else {
    world.place(pl.type, pl.c, pl.r); pl.c = null;
    const cp = world.cap(pl.type);
    if (cp.have >= cp.max) ui.place = null;       // raggiunto il limite: si torna alla scelta
  }
  save();
}

// ---------- azioni ----------
const closeAll = () => { ui.build = null; ui.place = null; ui.sel = null; ui.aiming = false; };
const A = {
  play() { ui.screen = 'play'; ui.daily = world.daily(Date.now()).available; audio.play('tap'); },
  buildOpen() { ui.sel = null; ui.aiming = false; ui.build = { cat: ui.lastCat || 'dif' }; audio.play('tap'); },
  buildClose() { ui.build = null; ui.place = null; audio.play('tap'); },
  cat(cat) { ui.build.cat = cat; ui.lastCat = cat; audio.play('tap'); },
  pick(type) {
    const D = BUILD[type];
    if (D.min > world.d.castle) { toast(t('needCastle', D.min)); return; }
    const cp = world.cap(type);
    if (cp.have >= cp.max) { toast(t('why_cap')); return; }
    ui.place = { type, c: null, r: null, a: null, b: null };
    if (!D.line) {      // l'anteprima parte dal posto libero più vicino al centro dello schermo
      const g = scene.pick(view.cw / 2, view.ch * 0.46);
      if (g) {
        const k = cellFor(type, g);
        find: for (let rad = 0; rad <= 9; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
          if (world.canPlace(type, k.c + dc, k.r + dr, true) === 'ok') { ui.place.c = k.c + dc; ui.place.r = k.r + dr; break find; }
        }
        if (ui.place.c == null) moveGhost(g);
      }
    }
    audio.play('tap');
  },
  placeConfirm() { confirmPlace(); },
  placeCancel() { ui.place = null; audio.play('tap'); },
  selClose() { ui.sel = null; },
  demolish(b) { if (world.demolish(b)) { ui.sel = null; save(); } },
  upgrade(b) { if (!world.upgrade(b)) toast(t('why_cost')); else save(); },
  castleUp() { if (!world.upgradeCastle()) toast(t('why_cost')); else save(); },
  plant(b, crop) { if (world.plant(b, crop, Date.now())) { ui.sel = null; audio.play('build'); save(); } else toast(t('why_cost')); },
  train(b) { if (!world.train(b)) toast(t(world.trainCheck(b) === 'pop' ? 'needHouses' : 'why_cost')); else save(); },
  start() { if (world.startNight()) { closeAll(); save(); } },
  speed() { ui.speed = ui.speed === 1 ? 2 : 1; audio.play('tap'); },
  aim() { if (world.spellCd <= 0) { ui.aiming = !ui.aiming; ui.sel = null; audio.play('tap'); } else audio.play('no'); },
  home() { scene.setView((CASTLE.c + CASTLE.w / 2) * G, (CASTLE.r + CASTLE.h / 2) * G + 20, 1150); audio.play('tap'); },
  quests() { ui.quests = !ui.quests; ui.sel = null; audio.play('tap'); },
  claimQuest(i) { const n = world.claimQuest(i); if (n) { audio.play('cleared'); buzz(20); save(); } },
  settings() { ui.settings = !ui.settings; ui.sel = null; audio.play('tap'); },
  lang(l) { setLang(l); save(); audio.play('tap'); },
  sound() { ui.sound = !ui.sound; audio.setSound(ui.sound); save(); audio.play('tap'); },
  claimDaily() { const n = world.claimDaily(Date.now()); ui.daily = false; if (n) { audio.play('cleared'); save(); } },
  lostOk() { ui.lost = null; audio.play('tap'); },
  awayOk() { ui.away = null; audio.play('coin'); },
};

// ---------- tocchi ----------
function hitButton(clientX, clientY) {
  const lx = clientX / view.us, ly = clientY / view.us;
  for (let i = ui.buttons.length - 1; i >= 0; i--) {
    const b = ui.buttons[i];
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) { b.fn(); return true; }
  }
  return false;
}
const TALL = { castello: 120, arcieri: 84, mago: 90, catapulta: 56, braciere: 66, radici: 44, casa: 60, caserma: 66, segheria: 50, cava: 50, cancello: 52, mura: 40, recinto: 26 };
/** L'edificio sotto il dito: prima i quadretti della base, poi il corpo (che sullo schermo sta più in su). */
function buildingUnder(clientX, clientY, g) {
  const b0 = world.buildingAt(Math.floor(g.x / G), Math.floor(g.y / G));
  if (b0) return b0;
  let best = null;
  for (const b of world.d.buildings) {
    const H = TALL[b.type]; if (!H || b.type === 'recinto' || b.type === 'mura') continue;
    const p0 = scene.project(b.x, b.y, 0), p1 = scene.project(b.x, b.y, H), hw = BUILD[b.type].w * G / 2 * scene.scaleAt(b.x, b.y);
    if (Math.abs(clientX - p0.x) < hw && clientY > p1.y && clientY < p0.y && (!best || b.y > best.y)) best = b;
  }
  return best;
}
/** Un tocco sul mondo (non su un bottone). kind: 'touch' | 'mouse'. */
function worldTap(clientX, clientY, kind) {
  if (ui.screen !== 'play') return;
  const g = scene.pick(clientX, clientY);
  if (!g) return;
  if (ui.place) {
    const pl = ui.place, line = BUILD[pl.type].line;
    if (kind === 'mouse') { const second = !line || !!pl.a; moveGhost(g); if (second) confirmPlace(); return; }
    if (inGhost(g) && (!line || pl.b || pl.a)) { if (line && !pl.b) pl.b = pl.a; confirmPlace(); return; }
    moveGhost(g); audio.play('tap');
    return;
  }
  if (ui.aiming) { if (world.castSpell(g.x, g.y)) ui.aiming = false; else audio.play('no'); return; }
  const b = buildingUnder(clientX, clientY, g), now = Date.now();
  if (b) {
    if (b.type === 'campo' && world.crop(b, now).ripe) {
      const got = world.harvest(b, now);
      text(ui.fxTop, b.x, b.y, 40, '+' + got, '#ffd24a', 24, 1.1); parts(ui.fxTop, b.x, b.y, 20, 12, '#ffe27a', 110, 0.6, 4, 240); audio.play('coin'); save(); ui.sel = null;
      return;
    }
    ui.sel = { b }; ui.build = null; audio.play('tap');
    return;
  }
  const c = Math.floor(g.x / G), r = Math.floor(g.y / G), n = world.natAt(c, r) || world.natAt(c, r + 1);
  if (n) { world.chop(n); save(); return; }
  ui.sel = null;
}
/** Per le prove: un tocco completo (bottone oppure mondo) in pixel dello schermo. */
function tap(clientX, clientY, kind = 'touch') { audio.unlock(); if (view.portrait) return; if (!hitButton(clientX, clientY)) worldTap(clientX, clientY, kind); }

const ptrs = new Map();
let gest = null;
function pinchInfo() { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
uiCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); audio.unlock();
  if (view.portrait) return;
  try { uiCanvas.setPointerCapture(e.pointerId); } catch (err) { /* puntatori finti nelle prove */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { if (gest && gest.mode === 'ui') return; const p = pinchInfo(); gest = { mode: 'pinch', d: p.d, g0: scene.pick(p.mx, p.my) }; return; }
  if (ptrs.size > 2) return;
  if (hitButton(e.clientX, e.clientY)) { gest = { mode: 'ui' }; return; }
  const g0 = scene.pick(e.clientX, e.clientY);
  gest = { mode: 'pending', x0: e.clientX, y0: e.clientY, g0, kind: e.pointerType === 'mouse' ? 'mouse' : 'touch', onGhost: e.pointerType !== 'mouse' && inGhost(g0) };
});
uiCanvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse' && ui.place && ui.screen === 'play') { const lx = e.clientX / view.us, ly = e.clientY / view.us; if (!ui.buttons.some(b => lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h)) moveGhost(scene.pick(e.clientX, e.clientY)); } return; }
  p.x = e.clientX; p.y = e.clientY;
  if (!gest || ui.screen !== 'play') return;
  if (gest.mode === 'pinch' && ptrs.size >= 2) {
    const q = pinchInfo();
    scene.zoomAt(gest.d / q.d, q.mx, q.my); gest.d = q.d;
    if (gest.g0) scene.dragTo(gest.g0, q.mx, q.my);
    ui.moved = true;
  } else if (gest.mode === 'pending') {
    if (Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > (gest.kind === 'mouse' ? 5 : 9)) gest.mode = gest.onGhost ? 'ghost' : 'pan';
  }
  if (gest.mode === 'pan' && gest.g0) { scene.dragTo(gest.g0, e.clientX, e.clientY); ui.moved = true; }
  else if (gest.mode === 'ghost') moveGhost(scene.pick(e.clientX, e.clientY));
});
function pointerEnd(e, cancelled) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gest && gest.mode === 'pending' && !cancelled) worldTap(gest.x0, gest.y0, gest.kind);
  if (ptrs.size === 0) gest = null;
  else if (gest && gest.mode === 'pinch') { const q = [...ptrs.values()][0]; gest = { mode: 'pan', g0: scene.pick(q.x, q.y) }; }
}
uiCanvas.addEventListener('pointerup', (e) => pointerEnd(e, false));
uiCanvas.addEventListener('pointercancel', (e) => pointerEnd(e, true));
uiCanvas.addEventListener('wheel', (e) => { e.preventDefault(); if (ui.screen !== 'play' || view.portrait) return; scene.zoomAt(e.deltaY > 0 ? 1.12 : 0.89, e.clientX, e.clientY); ui.moved = true; }, { passive: false });
uiCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (e.key === 'Escape') back();
  else if (e.key === ' ' && ui.screen === 'play' && world.status === 'day' && !ui.place) A.start();
  else if (e.key === 'f') A.speed();
  else if (e.key === 'b' && ui.screen === 'play') { if (ui.build) A.buildClose(); else A.buildOpen(); }
  else if (e.key === 'Enter' && ui.place) confirmPlace();
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
// tasto indietro del telefono: chiude ciò che è aperto, poi esce
function back() {
  if (ui.lost) ui.lost = null;
  else if (ui.away) ui.away = null;
  else if (ui.quests || ui.settings) { ui.quests = ui.settings = false; }
  else if (ui.place) ui.place = null;
  else if (ui.build) ui.build = null;
  else if (ui.sel || ui.aiming) { ui.sel = null; ui.aiming = false; }
  else if (CapApp) { save(); CapApp.exitApp(); }
}
let CapApp = null;
try { const C = window.Capacitor; if (C && C.isNativePlatform && C.isNativePlatform()) { CapApp = C.registerPlugin('App'); CapApp.addListener('backButton', back); } } catch (e) { CapApp = null; }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); return; }
  setTimeout(kick, 250);      // al rientro dall'app in secondo piano
  if (world.status === 'day') { world.offline(Date.now()); if (world.away) { ui.away = world.away; world.away = null; } }
});

// ---------- eventi del mondo -> effetti e suoni ----------
const KILL_COL = { orco: '#86b552', predone: '#c79a6b', bruto: '#9c7f7a', spettro: '#bfe9ff', capo: '#6f9c42', campione: '#a070ff' };
function handleEvents() {
  for (const ev of world.events) {
    switch (ev.k) {
      case 'placed': buzz(12); ring(ui.fx, ev.x, ev.y, 10, 70, 0.4, '#ffe9a8', 4); parts(ui.fx, ev.x, ev.y, 10, 12, '#d9c7a0', 100, 0.5, 4, 260); audio.play('build'); break;
      case 'demolished': parts(ui.fx, ev.x, ev.y, 14, 12, '#b9a98a', 110, 0.5, 4, 260); audio.play('coin'); break;
      case 'upgrade': ring(ui.fx, ev.x, ev.y, 8, ev.castle ? 130 : 64, 0.5, '#ffd24a', 4); parts(ui.fx, ev.x, ev.y, 40, ev.castle ? 30 : 16, '#ffe27a', 120, 0.7, 3.5, 200); audio.play('up'); buzz(15); break;
      case 'chop': parts(ui.fx, ev.x, ev.y, 18, 10, ev.kind === 'tree' ? '#4f9a4b' : '#a9abb5', 110, 0.5, 4, 280); text(ui.fxTop, ev.x, ev.y, 30, '+' + ev.gain, ev.kind === 'tree' ? '#e0b98a' : '#dfe1ea', 20, 0.8); audio.play('chop', 0.04); buzz(8); break;
      case 'train': ring(ui.fx, ev.x, ev.y, 10, 60, 0.45, '#6fb7ff', 4); audio.play('up'); break;
      case 'nightStart': audio.play('horn'); ui.banner = { str: `${t('night')} ${ev.night}`, color: '#cfd8ff', t: 0, T: 2.2 }; break;
      case 'spawn': ring(ui.fx, ev.x, ev.y, 14, ev.boss ? 110 : 56, 0.5, '#d9a8ff', ev.boss ? 5 : 3); break;
      case 'shot': audio.play(ev.type, 0.07); break;
      case 'burn': audio.play('burn', 0.45); break;
      case 'hit': parts(ui.fx, ev.x, ev.y, 20, 3, '#fff3c4', 70, 0.22, 2.6); break;
      case 'slash': parts(ui.fx, ev.x, ev.y, 18, 3, '#ffffff', 70, 0.22, 2.6); audio.play('slash', 0.1); break;
      case 'burst': ring(ui.fx, ev.x, ev.y, 6, ev.r, 0.3, '#c79bff', 4); parts(ui.fx, ev.x, ev.y, 18, 8, '#d9b8ff', 120, 0.35, 3.5); audio.play('burst', 0.08); break;
      case 'impact': ring(ui.fx, ev.x, ev.y, 10, ev.r, 0.35, '#e8d2a6', 5); parts(ui.fx, ev.x, ev.y, 6, 14, '#b89a6a', 150, 0.55, 4.5, 320); ui.shake = Math.max(ui.shake, 0.18); audio.play('impact', 0.1); break;
      case 'pulse': ring(ui.fx, ev.x, ev.y, 14, ev.r, 0.55, '#7fe6a0', 3.5); audio.play('pulse', 0.25); break;
      case 'spell':
        ui.fxTop.push({ k: 'bolt', x: ev.x, y: ev.y, seed: Math.floor(Math.random() * 100), t: 0, T: 0.3 });
        ring(ui.fxTop, ev.x, ev.y, 10, ev.r, 0.45, '#ffe27a', 6); parts(ui.fxTop, ev.x, ev.y, 10, 22, '#fff6c9', 220, 0.5, 4.5, 300);
        ui.shake = 0.3; buzz(40); audio.play('impact'); audio.play('burst');
        break;
      case 'kill':
        parts(ui.fx, ev.x, ev.y, 18, ev.boss ? 26 : 9, KILL_COL[ev.type] || '#fff', ev.boss ? 190 : 110, 0.5, ev.boss ? 6 : 4, 260);
        text(ui.fxTop, ev.x, ev.y, 34, '+' + ev.reward, '#ffd24a', ev.boss ? 26 : 17, 0.8);
        audio.play(ev.boss ? 'impact' : 'kill', 0.05); if (ev.boss) ui.shake = 0.4;
        break;
      case 'struck': parts(ui.fx, ev.x, ev.y, 16, 3, '#d9c7a0', 80, 0.3, 3, 220); audio.play('wall', 0.18); break;
      case 'destroyed': ring(ui.fx, ev.x, ev.y, 8, 60, 0.4, '#ff8a6a', 4); parts(ui.fx, ev.x, ev.y, 12, 16, '#b9a98a', 150, 0.6, 4.5, 300); ui.shake = Math.max(ui.shake, 0.15); audio.play('impact', 0.1); buzz(25); break;
      case 'soldierDown': parts(ui.fx, ev.x, ev.y, 16, 10, '#6fb7ff', 110, 0.5, 4, 260); break;
      case 'castleHit': if (ui.flash < 0.12) { ui.flash = 0.4; buzz(30); } ui.shake = Math.max(ui.shake, 0.12); parts(ui.fx, ev.x, ev.y, 40, 3, '#d9c7a0', 110, 0.4, 3.5, 260); audio.play('leak', 0.5); break;
      case 'nightWon':
        ui.banner = { str: `${t('cleared')}  +${ev.reward}`, color: '#ffe9a8', t: 0, T: 2.6 };
        audio.play(ev.night % 5 === 0 ? 'won' : 'cleared'); buzz([30, 60, 30]); ui.aiming = false; ui.speed = 1; save();
        if (world.daily(Date.now()).available) ui.daily = true;
        break;
      case 'nightLost': ui.lost = { penalty: ev.penalty, night: ev.night }; ui.aiming = false; ui.speed = 1; ui.place = null; audio.play('lost'); buzz(120); save(); break;
    }
  }
  world.events.length = 0;
}

// ---------- ciclo ----------
let last = performance.now(), saveT = 0;
// Su alcuni WebView Android la prima tela 3D creata all'avvio resta vuota finché non viene riallocata.
// kick() la rialloca (cambia di un soffio la risoluzione e la rimette al fotogramma dopo).
let frames = 0, kicks = 0;
const probe = document.createElement('canvas'); probe.width = probe.height = 8;
function kick() {
  kicks++;
  scene.r.setPixelRatio(view.dpr * 0.96);
  requestAnimationFrame(() => scene.r.setPixelRatio(view.dpr));
}
/** Vero se la tela 3D appena disegnata è completamente vuota. Va chiamata subito dopo scene.render(). */
function blank() {
  try {
    const x = probe.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 8, 8); x.drawImage(glCanvas, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  } catch (e) { return false; }
}

function frame(now) {
  const raw = (now - last) / 1000, real = Math.max(0, Math.min(0.1, raw)); last = now;
  // se per un paio di secondi i fotogrammi sono lenti, abbasso la qualità (una tacca alla volta)
  if (!document.hidden && raw < 0.25) {
    slow = raw > 1 / 27 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 90 && quality > 0) { quality--; slow = 0; scene.setShadows(quality >= 1); resize(); console.log('[tuzu] qualita -> ' + quality); }
  }
  tick(real);
  frames++;
  if (frames === 2) kick();                                           // sempre, una volta, appena partiti
  else if ((frames === 20 || frames === 60 || frames === 150 || frames % 600 === 0) && kicks < 8 && !view.portrait && blank()) { console.log('[tuzu] tela 3D vuota: la rialloco'); kick(); }
  requestAnimationFrame(frame);
}

/** Un fotogramma: aggiorna e disegna. (Le prove lo chiamano a mano quando la scheda è in secondo piano.) */
function tick(real) {
  ui.time += real;
  if (view.portrait) { drawRotate(); return; }
  const now = Date.now(), modal = ui.screen !== 'play' || ui.quests || ui.settings || ui.daily || ui.lost || ui.away;

  if (!modal) {
    const isNight = world.status === 'night', steps = isNight ? ui.speed * 2 : 1, dt = isNight ? real / 2 : real;      // passi piccoli: stabile anche a x2
    for (let i = 0; i < steps; i++) { world.update(dt, now); handleEvents(); }
    // camera da tastiera
    const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (kx || ky) { const v = scene.view, sp = v.dist * 0.9 * real; scene.setView(v.x + kx * sp, v.y + ky * sp); ui.moved = true; }
    saveT += real; if (saveT > 12) { saveT = 0; save(); }
  }
  stepFx(ui.fx, real * (world.status === 'night' ? ui.speed : 1)); stepFx(ui.fxTop, real);
  ui.night += ((world.status === 'night' ? 1 : 0) - ui.night) * Math.min(1, real * 1.6);
  if (ui.sel && !world.byId.has(ui.sel.b.id)) ui.sel = null;
  if (ui.place) { const st = ui.place.state = placeState(); scene.setGhost({ type: ui.place.type, cells: st.cells, at: st.at || null, line: !!st.line }); }
  else scene.setGhost(null);
  scene.showGrid(ui.screen === 'play' && !!(ui.build || ui.place));
  scene.sync(world, ui.time, now);
  scene.setNight(ui.night);

  if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - real);
  if (ui.flash > 0) ui.flash = Math.max(0, ui.flash - real);
  if (ui.banner) ui.banner.t += real;
  if (ui.toast) ui.toast.t += real;
  const sh = ui.shake * 12;
  glCanvas.style.transform = sh > 0.1 ? `translate(${(Math.random() - 0.5) * sh}px,${(Math.random() - 0.5) * sh}px)` : '';
  scene.render();

  const k = view.us * view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawUi({ c: ctx, world, ui, vw: view.vw, vh: view.vh, P, A, now });
}

function drawRotate() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = '#0d0b12'; ctx.fillRect(0, 0, view.cw, view.ch);
  ctx.fillStyle = '#f5ecd7'; ctx.font = '700 22px "Trebuchet MS","Segoe UI",Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⟳  ' + t('rotate'), view.cw / 2, view.ch / 2);
}

// Solo per le prove: compone 3D + interfaccia in un'immagine e la manda al server locale (tools/shots/).
async function shot(name) {
  tick(0.016);
  const c = document.createElement('canvas'), w = 1280;
  c.width = w; c.height = Math.round(w * view.ch / view.cw);
  const x = c.getContext('2d');
  x.drawImage(glCanvas, 0, 0, c.width, c.height); x.drawImage(uiCanvas, 0, 0, c.width, c.height);
  const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
  await fetch('/__shot?name=' + name, { method: 'POST', body: b });
  return name;
}
/** Per le prove: cancella il salvataggio e ricarica. */
function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* niente */ } window.removeEventListener('pagehide', save); location.reload(); }

// Se il telefono toglie il contesto grafico (succede quando l'app va in secondo piano), lo riprendo e ricostruisco la scena.
glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.log('[tuzu] contesto 3D perso'); });
glCanvas.addEventListener('webglcontextrestored', () => { console.log('[tuzu] contesto 3D ripreso'); scene.build(); });
window.addEventListener('error', (e) => console.log('[tuzu] errore: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('pagehide', save);

scene.build();
resize();
if (saved.cam && isFinite(saved.cam.x)) scene.setView(saved.cam.x, saved.cam.y, saved.cam.dist);
console.log('[tuzu] avvio ' + view.cw + 'x' + view.ch + ' dpr ' + view.dpr + ' gl ' + (scene.r.getContext().isContextLost() ? 'PERSO' : 'ok') + ' ' + scene.r.capabilities.maxTextureSize);
window.__tuzu = { world, ui, view, scene, A, tap, P, save, shot, tick, back, kick, blank, reset, NATURE, TOWERS, get quality() { return quality; }, get kicks() { return kicks; } };   // per le prove automatiche
requestAnimationFrame(frame);

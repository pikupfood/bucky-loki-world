// Avvio: scena 3D + interfaccia 2D, schermate (titolo, villaggio, battaglia), tocchi, salvataggio.
import { Game } from './game.js';
import { LEVELS, ENDLESS } from './data.js';
import { Meta, BUILDING_ORDER, PLOTS } from './meta.js';
import { Scene3D } from './scene3d.js';
import { VILLAGE } from './ground.js';
import { drawUi } from './ui.js';
import { stepFx, parts, ring, text } from './fx.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import * as audio from './audio.js';

const glCanvas = document.getElementById('gl');
const uiCanvas = document.getElementById('ui');
const ctx = uiCanvas.getContext('2d');
const scene = new Scene3D(glCanvas);

const KEY = 'tuzu_difesa_v2';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
const meta = new Meta(saved.meta);
let game = null;

const ui = {
  screen: 'title', paused: false, speed: 1, sel: null, aiming: false, sound: saved.sound !== false,
  vsel: null, levels: false, quests: false, settings: false, daily: false, result: null,
  buttons: [], fx: [], fxTop: [], night: 0, shake: 0, flash: 0, time: 0, banner: null,
};
function save() { try { localStorage.setItem(KEY, JSON.stringify({ meta: meta.toJSON(), lang: getLang(), sound: ui.sound })); } catch (e) { /* senza memoria si gioca lo stesso */ } }

const browserLang = (navigator.language || 'it').slice(0, 2);
setLang(saved.lang || (LANGS.includes(browserLang) ? browserLang : 'it'));
audio.setSound(ui.sound);

// qualità grafica: 2 = piena, 1 = meno pixel, 0 = meno pixel e niente ombre (scende da sola se il telefono fatica)
let quality = 2, slow = 0;
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* non tutti i telefoni vibrano */ } }

// ---------- schermo ----------
const view = { cw: 1, ch: 1, us: 1, vw: 1280, vh: 720, dpr: 1, portrait: false };
function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  view.cw = cw; view.ch = ch; view.portrait = ch > cw;
  view.dpr = Math.min(window.devicePixelRatio || 1, quality === 2 ? 2 : quality === 1 ? 1.5 : 1);
  view.us = Math.min(ch / 720, cw / 1180);
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

// ---------- cambi di schermata ----------
function enterVillage() {
  game = null;
  Object.assign(ui, { screen: ui.screen === 'title' ? 'title' : 'village', paused: false, sel: null, aiming: false, vsel: null, levels: false, quests: false, settings: false, result: null, night: 0, banner: null });
  ui.fx.length = 0; ui.fxTop.length = 0;
  scene.showVillage();
  ui.daily = ui.screen === 'village' && meta.daily(Date.now()).available;
}
function startBattle(level) {
  game = new Game(level, meta.mods(), (Date.now() & 0xffff) + 1);
  Object.assign(ui, { screen: 'battle', paused: false, speed: 1, sel: null, aiming: false, vsel: null, levels: false, quests: false, settings: false, daily: false, result: null, night: 0, banner: null });
  ui.fx.length = 0; ui.fxTop.length = 0;
  scene.showBattle(level);
  audio.play('tap');
}
function startLevel(i) { if (meta.levelOpen(i)) startBattle(LEVELS[i]); }
function startEndless() { if (meta.endlessOpen()) startBattle(ENDLESS); }

// ---------- azioni ----------
const A = {
  play() { ui.screen = 'village'; ui.daily = meta.daily(Date.now()).available; audio.play('tap'); },
  village() { ui.screen = 'village'; enterVillage(); audio.play('tap'); },
  startLevel, startEndless,
  levels() { ui.levels = !ui.levels; ui.vsel = null; audio.play('tap'); },
  quests() { ui.quests = !ui.quests; ui.vsel = null; audio.play('tap'); },
  claimQuest(i) { const n = meta.claimQuest(i); if (n) { audio.play('cleared'); buzz(20); save(); } },
  settings() { ui.settings = !ui.settings; ui.vsel = null; audio.play('tap'); },
  vclose() { ui.vsel = null; },
  pause() { if (!game || game.over) return; ui.paused = !ui.paused; ui.sel = null; ui.aiming = false; audio.play('tap'); },
  speed() { ui.speed = ui.speed === 1 ? 2 : 1; audio.play('tap'); },
  start() {
    for (const ty in game.level.summary(game.wave)) meta.d.seen[ty] = 1;     // d'ora in poi questi nemici sono "già visti"
    if (game.startWave()) ui.sel = null;
  },
  restart() { if (game.level.endless) startEndless(); else startLevel(game.level.id); },
  aim() { if (game.spellCd <= 0) { ui.aiming = !ui.aiming; ui.sel = null; audio.play('tap'); } else audio.play('no'); },
  build(spot, type) { if (game.build(spot, type)) ui.sel = null; else audio.play('no'); },
  upgrade(tw) { if (!game.upgrade(tw)) audio.play('no'); },
  sell(tw) { if (game.sell(tw)) ui.sel = null; },
  lang(l) { setLang(l); save(); audio.play('tap'); },
  sound() { ui.sound = !ui.sound; audio.setSound(ui.sound); save(); audio.play('tap'); },
  upgradeBuilding(id) {
    if (!meta.upgrade(id)) { audio.play('no'); return; }
    const s = VILLAGE.slots[id];
    ring(ui.fxTop, s.x, s.y, 20, 110, 0.6, '#ffd24a', 5); parts(ui.fxTop, s.x, s.y, 40, 22, '#ffe27a', 150, 0.8, 5, 260);
    audio.play('up'); save();
  },
  plant(i, crop) { if (meta.plant(i, crop, Date.now())) { ui.vsel = null; audio.play('build'); save(); } else audio.play('no'); },
  claimDaily() { const n = meta.claimDaily(Date.now()); ui.daily = false; if (n) { audio.play('cleared'); save(); } },
};

// ---------- tocchi ----------
function tap(clientX, clientY) {
  audio.unlock();
  if (view.portrait) return;
  const lx = clientX / view.us, ly = clientY / view.us;
  for (let i = ui.buttons.length - 1; i >= 0; i--) {
    const b = ui.buttons[i];
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) { b.fn(); return; }
  }
  const g = scene.pick(clientX, clientY);
  if (!g) return;
  if (ui.screen === 'battle') {
    if (!game || ui.paused || game.over) return;
    if (ui.aiming) { if (game.castSpell(g.x, g.y)) ui.aiming = false; else audio.play('no'); return; }
    let hit = null, best = 1e9;
    // le torri sono alte: il tocco sul corpo cade un po' più "in su" della base
    for (const tw of game.towers) { const d = Math.hypot(tw.x - g.x, (tw.y - 22 - g.y) * 0.8); if (d < 50 && d < best) { best = d; hit = { kind: 'tower', tower: tw }; } }
    if (!hit) game.level.spots.forEach((s, i) => { if (game.spotTower[i]) return; const d = Math.hypot(s.x - g.x, s.y - g.y); if (d < 48 && d < best) { best = d; hit = { kind: 'spot', idx: i }; } });
    ui.sel = hit;
    if (hit) audio.play('tap');
  } else if (ui.screen === 'village') {
    const now = Date.now();
    for (let i = 0; i < PLOTS; i++) {
      const s = VILLAGE.plots[i];
      if (Math.abs(g.x - s.x) < 52 && Math.abs(g.y - s.y + 6) < 46) {
        const got = meta.harvest(i, now);
        if (got) { text(ui.fxTop, s.x, s.y, 40, '+' + got, '#ffd24a', 24, 1.1); parts(ui.fxTop, s.x, s.y, 20, 12, '#ffe27a', 110, 0.6, 4, 240); audio.play('coin'); save(); ui.vsel = null; }
        else { ui.vsel = { kind: 'p', i }; audio.play('tap'); }
        return;
      }
    }
    let hit = null, best = 1e9;
    for (const id of BUILDING_ORDER) {
      const s = VILLAGE.slots[id], r = id === 'castello' ? 100 : id === 'mura' ? 80 : 64, dx = g.x - s.x, dy = g.y - s.y;
      if (Math.abs(dx) < r && dy > -r * 1.7 && dy < r * 0.75) { const d = Math.abs(dx) + Math.abs(dy + r * 0.4); if (d < best) { best = d; hit = { kind: 'b', id }; } }
    }
    ui.vsel = hit;
    if (hit) audio.play('tap');
  }
}
uiCanvas.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(e.clientX, e.clientY); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p') { if (ui.screen === 'battle') A.pause(); }
  else if (e.key === ' ' && ui.screen === 'battle' && game && game.status === 'build') A.start();
  else if (e.key === 'f' && ui.screen === 'battle') A.speed();
});
// tasto indietro del telefono: chiude ciò che è aperto, poi mette in pausa, poi esce
function back() {
  if (ui.screen === 'battle') { if (ui.sel || ui.aiming) { ui.sel = null; ui.aiming = false; } else if (game && game.over) A.village(); else A.pause(); }
  else if (ui.vsel) ui.vsel = null;
  else if (ui.levels || ui.quests || ui.settings) { ui.levels = ui.quests = ui.settings = false; }
  else if (CapApp) CapApp.exitApp();
}
let CapApp = null;
try { const C = window.Capacitor; if (C && C.isNativePlatform && C.isNativePlatform()) { CapApp = C.registerPlugin('App'); CapApp.addListener('backButton', back); } } catch (e) { CapApp = null; }

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(kick, 250);      // al rientro dall'app in secondo piano
  if (document.hidden && ui.screen === 'battle' && game && !game.over) { ui.paused = true; ui.sel = null; } });

// ---------- eventi di battaglia -> effetti e suoni ----------
const KILL_COL = { orco: '#86b552', predone: '#c79a6b', bruto: '#9c7f7a', spettro: '#bfe9ff', capo: '#6f9c42', campione: '#a070ff' };
function handleEvents() {
  const L = game.level;
  for (const ev of game.events) {
    switch (ev.k) {
      case 'burn': audio.play('burn', 0.45); break;
      case 'build': buzz(12); ring(ui.fx, ev.x, ev.y, 10, 70, 0.4, '#ffe9a8', 4); parts(ui.fx, ev.x, ev.y, 10, 12, '#d9c7a0', 100, 0.5, 4, 260); audio.play('build'); break;
      case 'upgrade': ring(ui.fx, ev.x, ev.y, 8, 64, 0.5, '#ffd24a', 4); parts(ui.fx, ev.x, ev.y, 40, 16, '#ffe27a', 120, 0.7, 3.5, 200); audio.play('up'); break;
      case 'sell': audio.play('coin'); break;
      case 'wave': audio.play('horn'); ui.banner = { str: `${t('night')} ${game.wave + 1}`, color: '#cfd8ff', t: 0, T: 2.2 }; break;
      case 'spawn': ring(ui.fx, L.portal.x, L.portal.y, 14, ev.boss ? 110 : 56, 0.5, '#d9a8ff', ev.boss ? 5 : 3); break;
      case 'shot': audio.play(ev.type, 0.07); break;
      case 'hit': parts(ui.fx, ev.x, ev.y, 20, 3, '#fff3c4', 70, 0.22, 2.6); break;
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
        text(ui.fxTop, ev.x, ev.y, 34, '+' + ev.reward, '#9ff0b4', ev.boss ? 26 : 17, 0.8);
        meta.track('kills');
        audio.play(ev.boss ? 'impact' : 'kill', 0.05); if (ev.boss) ui.shake = 0.4;
        break;
      case 'leak': ring(ui.fxTop, L.gate.x + 10, L.gate.y, 16, 100, 0.5, '#ff5a4a', 6); ui.flash = 0.5; ui.shake = Math.max(ui.shake, 0.35); buzz(70); audio.play('leak', 0.15); break;
      case 'waveEnd': meta.track('nights'); ui.banner = { str: `${t('cleared')}  +${ev.bonus}`, color: '#ffe9a8', t: 0, T: 2.4 }; audio.play('cleared'); break;
      case 'won': case 'lost':
        ui.sel = null; ui.aiming = false;
        if (ev.k === 'won') meta.track('nights');
        ui.result = L.endless ? meta.finishEndless(game.wave) : meta.finish(L.id, ev.k === 'won', game.lives / game.maxLives);
        save(); buzz(ev.k === 'won' ? [30, 60, 30] : 120); audio.play(ev.k);
        break;
    }
  }
  game.events.length = 0;
}

// ---------- ciclo ----------
let last = performance.now();
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

  if (ui.screen === 'battle' && game) {
    if (!ui.paused && !game.over) {
      const steps = ui.speed * 2, dt = real / 2;      // passi piccoli: stabile anche a x2
      for (let i = 0; i < steps; i++) { game.update(dt); handleEvents(); }
      stepFx(ui.fx, real * ui.speed); stepFx(ui.fxTop, real * ui.speed);
    }
    ui.night += ((game.status === 'wave' ? 1 : 0) - ui.night) * Math.min(1, real * 1.6);
    if (ui.sel && ui.sel.kind === 'tower' && !game.towers.includes(ui.sel.tower)) ui.sel = null;
    scene.syncBattle(game, ui.time);
    scene.setNight(ui.night);
  } else {
    stepFx(ui.fxTop, real);
    scene.syncVillage(meta, Date.now(), ui.time);
    scene.setNight(0);
  }
  if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - real);
  if (ui.flash > 0) ui.flash = Math.max(0, ui.flash - real);
  if (ui.banner) ui.banner.t += real;
  const sh = ui.shake * 12;
  glCanvas.style.transform = sh > 0.1 ? `translate(${(Math.random() - 0.5) * sh}px,${(Math.random() - 0.5) * sh}px)` : '';
  scene.render();

  const k = view.us * view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawUi({ c: ctx, game, meta, ui, vw: view.vw, vh: view.vh, P, A, now: Date.now() });
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

// Se il telefono toglie il contesto grafico (succede quando l'app va in secondo piano), lo riprendo e ricostruisco la scena.
glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.log('[tuzu] contesto 3D perso'); });
glCanvas.addEventListener('webglcontextrestored', () => { console.log('[tuzu] contesto 3D ripreso'); if (ui.screen === 'battle' && game) scene.showBattle(game.level); else scene.showVillage(); });
window.addEventListener('error', (e) => console.log('[tuzu] errore: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));

resize();
enterVillage();
console.log('[tuzu] avvio ' + view.cw + 'x' + view.ch + ' dpr ' + view.dpr + ' gl ' + (scene.r.getContext().isContextLost() ? 'PERSO' : 'ok') + ' ' + scene.r.capabilities.maxTextureSize);
window.__tuzu = { get game() { return game; }, meta, ui, view, scene, A, tap, P, save, shot, tick, back, kick, blank, get quality() { return quality; }, get kicks() { return kicks; } };   // per le prove automatiche
requestAnimationFrame(frame);

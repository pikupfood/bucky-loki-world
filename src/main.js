// Avvio: scena 3D + interfaccia 2D, camera (trascina, pizzica, rotella), costruzione a quadretti, salvataggio.
import { World } from './world.js';
import { G, COLS, ROWS, BUILD, BUILD_CATS, SHIPS, TOWERS, CASTLE, NATURE, TRIBES, MY_COLOR, TERRAIN, RUINS, HERO, LEVEL_MIN, UNITS as UNIT_DEFS } from './data.js';
import { Scene3D } from './scene3d.js';
import { drawUi } from './ui.js';
import { stepFx, parts, ring, text, smoke, chips, arc } from './fx.js';
import { mapPick } from './ui3.js';
import * as cloud from './cloud.js';
import * as online from './online.js';
import { reportLine, threats } from './ui4.js';
import { t, setLang, getLang, LANGS } from './i18n.js';
import * as audio from './audio.js';

const glCanvas = document.getElementById('gl');
const uiCanvas = document.getElementById('ui');
const ctx = uiCanvas.getContext('2d');
const scene = new Scene3D(glCanvas);

const NEWS_KEY = 'tuzu_difesa_news', NEWS_V = 4;      // si alza a ogni aggiornamento grosso: chi ha già giocato vede una volta il foglio «Novità»
const KEY = 'tuzu_difesa_v3';       // la chiave resta questa: i salvataggi vecchi li converte World
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
const world = new World(saved.world, Date.now(), (Date.now() & 0xffff) + 1);

const ui = {
  screen: 'title', speed: 1, sound: saved.sound !== false, moved: !!saved.moved, seenVillage: !!saved.seenVillage,
  build: null, place: null, sel: null, vsel: null, aiming: false,
  quests: false, settings: false, tech: false, daily: false, lost: null, away: world.away,
  online: null, onlineNew: 0, fleet: null, seaOpen: false, news: false, newsDue: false,
  map: null, squad: null, qtab: 0, reportOpen: false, q: saved.q === 0 || saved.q === 1 || saved.q === 2 ? saved.q : 'auto', cloud: cloud.state,
  roles: false, story: null, rallyPick: false, fogSel: null, guideOpen: null, music: saved.music !== false, newGame: !saved.world, diffPick: 'normale',
  buttons: [], fx: [], fxTop: [], night: 0, shake: 0, flash: 0, time: 0, banner: null, bannerQ: [], toast: null,
};
world.away = null;
let frozen = false;      // dopo reset() non si salva più: altrimenti la pagina che si chiude riscrive il salvataggio
function save() { if (frozen) return; try { localStorage.setItem(KEY, JSON.stringify({ world, lang: getLang(), sound: ui.sound, music: ui.music, moved: ui.moved, seenVillage: ui.seenVillage, cam: scene.view, q: ui.q, qa: quality })); } catch (e) { /* senza memoria si gioca lo stesso */ } cloud.touch(); }

const browserLang = (navigator.language || 'it').slice(0, 2);
setLang(saved.lang || (LANGS.includes(browserLang) ? browserLang : 'it'));
audio.setSound(ui.sound); audio.setMusic(ui.music);

// qualità grafica: 2 = piena, 1 = meno pixel, 0 = meno pixel e niente ombre (scende da sola se il telefono fatica)
let quality = ui.q === 'auto' ? (saved.qa === 0 || saved.qa === 1 ? saved.qa : 2) : ui.q, slow = 0, skip = 0;
function setQuality(q) { quality = q; scene.setShadows(q >= 1); scene.setPost(q === 2); resize(); }
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* non tutti i telefoni vibrano */ } }
function toast(str) { ui.toast = { str, t: 0, T: 2 }; audio.play('no'); }
/** Una scritta grande al centro; se ce n'è già una, aspetta il suo turno. */
function banner(str, color, T = 2.4) { ui.bannerQ.push({ str, color, t: 0, T }); }

// ---------- schermo ----------
const view = { cw: 1, ch: 1, us: 1, vw: 1280, vh: 720, dpr: 1, portrait: false };
function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  view.cw = cw; view.ch = ch; view.portrait = false;        // una volta in verticale si chiedeva di girare il telefono: ora si gioca in tutti e due i versi
  view.dpr = Math.min(window.devicePixelRatio || 1, quality === 2 ? 2 : quality === 1 ? 1.5 : 1);
  const small = ch < 520;                                  // sui telefoni l'interfaccia è più grande
  // Schermo «alto» (telefono in verticale, o un pieghevole aperto tenuto dritto): l'interfaccia si disegna larga 720 e i pannelli si impilano.
  view.tall = ch > cw * 1.12;
  view.us = view.tall ? Math.min(1.3, cw / 720) : Math.min(ch / (small ? 580 : 720), cw / (small ? 1040 : 1180));
  view.vw = cw / view.us; view.vh = ch / view.us;
  uiCanvas.width = Math.round(cw * view.dpr); uiCanvas.height = Math.round(ch * view.dpr);
  view.gl = view.dpr * (quality === 0 ? 0.8 : 1);            // a qualità bassa il 3D si disegna un po' più piccolo; l'interfaccia resta nitida
  scene.resize(cw, Math.max(1, ch), view.gl);
}
window.addEventListener('resize', resize);

// proiezione mondo -> interfaccia
const P = {
  pt(x, y, h) { const p = scene.project(x, y, h || 0); p.x /= view.us; p.y /= view.us; return p; },
  sc(x, y) { return scene.scaleAt(x, y) / view.us; },
  circle(x, y, r, n = 28) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; out.push(P.pt(x + Math.cos(a) * r, y + Math.sin(a) * r, 0)); } return out; },
};

// ---------- costruzione a quadretti ----------
const cellFree = (c, r, self = 0) => c >= 2 && r >= 2 && c < COLS - 2 && r < ROWS - 2 && (world.occ[r * COLS + c] === 0 || world.occ[r * COLS + c] === self) && !world.natAt(c, r) && world.villageAt(c, r) < 0 && !TERRAIN[r * COLS + c];
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
  const why = pl.move ? world.moveCheck(world.byId.get(pl.move), pl.c, pl.r) : world.canPlace(pl.type, pl.c, pl.r), cells = [];
  for (let r = pl.r; r < pl.r + D.h; r++) for (let c = pl.c; c < pl.c + D.w; c++) cells.push({ c, r, ok: cellFree(c, r, pl.move || 0) && why !== 'occupied' });
  if (why === 'occupied' && cells.every(k => cellFree(k.c, k.r, pl.move || 0))) cells.forEach(k => { k.ok = false; });     // c'è un nemico sopra
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
  if (!st.ok) { toast(t(st.why === 'no' ? 'notNow' : 'why_' + (st.why.startsWith('pick') ? 'pick' : st.why))); return; }
  if (pl.move) { world.moveBuilding(world.byId.get(pl.move), pl.c, pl.r); ui.place = null; save(); return; }
  if (BUILD[pl.type].line) { world.placeLine(pl.type, st.cells); pl.a = null; pl.b = null; }
  else {
    world.place(pl.type, pl.c, pl.r); pl.c = null;
    const cp = world.cap(pl.type);
    if (cp.have >= cp.max) ui.place = null;       // raggiunto il limite: si torna alla scelta
  }
  save();
}

// ---------- azioni ----------
const UNITS_MSG = { full: 'full', pop: 'needHouses', busy: 'notNow' };
const world_unit = (type) => UNIT_DEFS[type] || {};
const closeAll = () => { ui.resInfo = false; ui.build = null; ui.place = null; ui.sel = null; ui.vsel = null; ui.tech = false; ui.aiming = false; ui.roles = false; ui.fogSel = null; ui.rallyPick = false; ui.map = null; ui.online = null; ui.fleet = null; };
const A = {
  play() { if (ui.newGame) { world.setDiff(ui.diffPick); ui.newGame = false; save(); } ui.screen = 'play'; ui.daily = world.daily(Date.now()).available; audio.play('tap'); },
  diffPick(k) { ui.diffPick = k; audio.play('tap'); },
  diff(k) { if (world.setDiff(k)) { save(); audio.play('tap'); } },
  music() { ui.music = !ui.music; audio.setMusic(ui.music); save(); audio.play('tap'); },
  roles() { ui.roles = !ui.roles; ui.sel = null; ui.vsel = null; audio.play('tap'); },
  role(r, d) { world.setRole(r, (world.d.roles[r] || 0) + d); save(); audio.play('tap'); },
  stay(b) { if (world.toggleStay(b)) { save(); audio.play('tap'); } },
  rallyPick() { ui.rallyPick = true; ui.sel = null; audio.play('tap'); },
  rallyClear() { world.setRally(null); save(); audio.play('tap'); },
  heroPower(k) { if (world.heroPower(k)) audio.play(k === 'shout' ? 'shout' : 'impact'); else audio.play('no'); },
  eventChoose(k) { if (world.eventChoose(k)) { audio.play('coin'); save(); } else toast(t('why_cost')); },
  storyOk() { world.storySeen(); ui.story = null; audio.play('page'); save(); },
  // la mappa intera: da lì si mandano gli esploratori (ci mettono ore vere)
  mapOpen() { closeAll(); ui.squad = null; ui.map = { sel: null, msg: '', msgT: 0 }; audio.play('page'); },
  mapClose() { ui.map = null; audio.play('tap'); },
  mapTap(x, y) { if (!ui.map) return; ui.map.sel = mapPick(world, x, y); ui.map.msgT = 0; audio.play('tap'); },
  mapGo() { const p = ui.map && ui.map.sel; if (!p) return; scene.setView(p.x, p.y + 60, Math.min(scene.view.dist, 1300)); ui.moved = true; ui.map = null; if (p.kind === 'village') { ui.vsel = p.i; ui.seenVillage = true; } audio.play('tap'); save(); },
  scout() { const M = ui.map, p = M && M.sel; if (!p) return; if (world.sendScout(p.x, p.y, Date.now())) { M.msg = t('scoutGone'); M.msgT = 5; M.sel = null; save(); } else audio.play('no'); },
  reportOk() { world.reportSeen(); audio.play('tap'); save(); },
  reportMap() { const R = world.reportSeen(); save(); A.mapOpen(); if (R) ui.map.sel = mapPick(world, R.x, R.y); },
  levelUp(b) { if (world.levelUp(b)) save(); else { const w = world.levelCheck(b); toast(w === 'castle' ? t('needCastle', world.levelMin(b)) : w === 'cost' ? t('why_cost') : t('notNow')); } },
  gift(i) { if (world.gift(i)) save(); else toast(t(world.giftCheck(i) === 'done' ? 'giftDone' : 'why_cost')); },
  squadClose() { ui.squad = null; audio.play('tap'); },
  squadAttack() { if (world.orderAttack(ui.squad)) audio.play('horn'); },
  qtab(k) { ui.qtab = k; audio.play('tap'); },
  claimChallenge() { const n = world.claimChallenge(Date.now()); if (n) { audio.play('cleared'); buzz(20); save(); } },
  rebuild() { const n = world.rebuildLost(); if (n) { audio.play('build'); save(); } else toast(t('why_cost')); },
  rebuildSkip() { world.d.rebuild = []; audio.play('tap'); save(); },
  // ---------- novità ----------
  newsOpen() { ui.settings = false; ui.news = true; audio.play('page'); },
  newsOk() { ui.news = false; try { localStorage.setItem(NEWS_KEY, String(NEWS_V)); } catch (e) { /* niente */ } audio.play('tap'); },
  newsAccount() { A.newsOk(); cloud.open(); },
  // ---------- la flotta ----------
  fleetOpen(tab) { closeAll(); ui.squad = null; ui.fleet = { tab: typeof tab === 'string' ? tab : 'ships', ship: null, buy: false, res: 'legna', tier: 0, n: 0, page: 0, scrap: null }; audio.play('page'); },
  fleetClose() { ui.fleet = null; audio.play('tap'); },
  fleetTab(k) { ui.fleet.tab = k; ui.fleet.scrap = null; audio.play('tap'); },
  fleetPage(d) { ui.fleet.page = (ui.fleet.page || 0) + d; audio.play('tap'); },
  fleetBuild(type) { const k = world.shipCheck(type); if (world.buildShip(type)) save(); else toast(t(k === 'cost' ? 'why_cost' : k === 'busy' ? 'notNow' : 'sea_e_' + k)); },
  fleetUp(id) { const s = world.ship(id); if (world.shipUp(s)) save(); else toast(t(world.shipUpCheck(s) === 'port' ? 'sea_needPortLvl' : 'why_cost')); },
  fleetRepair(id) { if (world.repairShip(world.ship(id))) { audio.play('build'); save(); } else toast(t('why_cost')); },
  fleetScrap(id) { const U = ui.fleet; if (U.scrap !== id) { U.scrap = id; audio.play('tap'); return; } U.scrap = null; if (world.scrapShip(world.ship(id))) { audio.play('coin'); save(); } },
  fleetPick(id) { ui.fleet.ship = id; ui.fleet.n = 0; audio.play('tap'); },
  fleetBuy(b) { ui.fleet.buy = !!b; audio.play('tap'); },
  fleetRes(r) { ui.fleet.res = r; audio.play('tap'); },
  fleetTier(i) { ui.fleet.tier = i; audio.play('tap'); },
  fleetAmount(d) { const U = ui.fleet, s = world.ship(U.ship); if (!s) return; const hold = SHIPS.mercantile.hold[s.lvl], step = Math.max(10, Math.round(hold / 6 / 10) * 10); U.n = Math.max(step, Math.min(hold, (U.n || hold) + d * step)); audio.play('tap'); },
  fleetSail() { const U = ui.fleet, s = world.ship(U.ship); if (world.sendTrade(s, U.tier, U.res, U.n, U.buy, Date.now())) { U.tab = 'ships'; save(); } else toast(t('notNow')); },
  fleetExplore(id, tier) { if (world.sendExplore(world.ship(id), tier, Date.now())) { ui.fleet.tab = 'ships'; save(); } else toast(t('notNow')); },
  fleetWar(kind, i) { if (world.sendWar(kind, i, Date.now())) { ui.fleet.tab = 'ships'; save(); } else toast(t(world.warShips().length ? 'notNow' : 'sea_noWar')); },
  seaOk() { world.seaSeen(); audio.play('tap'); save(); },
  seaFleet() { world.seaSeen(); save(); A.fleetOpen(); },
  // ---------- il mondo online ----------
  onlineOpen() {
    closeAll(); ui.squad = null; ui.onlineNew = 0;
    const me = online.state.me;
    ui.online = { tab: 'map', sel: null, pick: null, msg: '', msgT: 0, bad: false, cam: { x: me ? me.x : 0, y: me ? me.y : 0, z: view.tall ? 17 : 22 }, loadT: 99 };
    audio.play('page'); onlineRefresh(true);
  },
  onlineClose() { ui.online = null; audio.play('tap'); },
  onlineTab(k) { ui.online.tab = k; ui.online.pick = null; audio.play('tap'); },
  onlineAccount() { ui.online = null; cloud.open(); },
  onlineZoom(f) { const c = ui.online.cam; c.z = Math.max(3.5, Math.min(44, c.z * f)); },
  onlineHome() { const me = online.state.me, U = ui.online; if (me) { U.cam.x = me.x; U.cam.y = me.y; U.sel = me.id; U.pick = null; } audio.play('tap'); },
  onlineFocus(id) { const v = online.byId(id), U = ui.online; if (v) { U.cam.x = v.x; U.cam.y = v.y; U.sel = id; } },
  onlineShow(id) { const U = ui.online; U.tab = 'map'; U.pick = null; A.onlineFocus(id); if (U.cam.z < 14) U.cam.z = 18; audio.play('tap'); },
  /** Il villaggio del computer più vicino che il mio esercito può battere con margine. */
  onlineFind() {
    const me = online.state.me, U = ui.online; if (!me) return;
    const pw = online.armyPower(world.pvpArmy()); let best = null, bd = 1e9;
    for (const v of online.state.villages) { if (v.kind !== 'npc' || online.shielded(v) || online.defenseOf(v) * 1.15 > pw) continue; const d = Math.hypot(v.x - me.x, v.y - me.y); if (d < bd) { bd = d; best = v; } }
    if (!best) { onlineSay(t(pw ? 'on_findNone' : 'on_noArmy'), true); audio.play('no'); return; }
    U.pick = null; A.onlineFocus(best.id); if (U.cam.z < 14) U.cam.z = 18; onlineSay(t('on_findOk', best.name), false); audio.play('tap');
  },
  onlineTap(wx, wy) {
    const U = ui.online; let best = null, bd = Math.max(1.4, 22 / U.cam.z) ** 2;
    for (const v of online.state.villages) { const dd = (v.x - wx) ** 2 + (v.y - wy) ** 2; if (dd < bd) { bd = dd; best = v; } }
    U.sel = best ? best.id : null; U.pick = null; U.msgT = 0; audio.play('tap');
  },
  onlineJoin() { cloud.ask(t('on_nameTitle'), [{ ph: t('on_namePh'), max: 18 }], t('on_join'), async ([name]) => { if (name.length < 3) { onlineSay(t('on_nameShort'), true); return; } world.d.pvpName = name; const k = await online.join(name); if (k) onlineSay(t('on_e_' + k), true); else { A.onlineHome(); save(); } }); },
  onlineRename() { cloud.ask(t('on_nameTitle'), [{ ph: t('on_namePh'), max: 18 }], t('ok'), async ([name]) => { if (name.length < 3) { onlineSay(t('on_nameShort'), true); return; } world.d.pvpName = name; const k = await online.join(name); if (k) onlineSay(t('on_e_' + k), true); save(); }); },
  onlinePickOpen(mode, target, march) { const U = ui.online; U.tab = 'map'; U.sel = target; U.pick = { mode, target, march: march || null, army: {}, mins: 60 }; A.onlineFocus(target); audio.play('tap'); },
  onlinePick(u, d) { const P = ui.online.pick, have = world.pvpArmy(); if (!P) return; if (u == null) { P.army = { ...have }; } else { const n = Math.max(0, Math.min(have[u] || 0, (P.army[u] || 0) + d)); if (n) P.army[u] = n; else delete P.army[u]; } audio.play('tap'); },
  onlineMins(m) { ui.online.pick.mins = m; audio.play('tap'); },
  onlineBack() { ui.online.pick = null; audio.play('tap'); },
  async onlineGo() {
    const U = ui.online, P = U.pick; if (!P || online.state.busy) return;
    const army = {}; for (const k in P.army) if (P.army[k] > 0) army[k] = P.army[k];
    const k = P.mode === 'rally' ? await online.rallyOpen(P.target, P.mins, army) : P.mode === 'join' ? await online.rallyJoin(P.march, army) : await online.attack(P.target, army);
    if (!ui.online) return;
    if (k) { onlineSay(t('on_e_' + k), true); audio.play('no'); } else { ui.online.pick = null; onlineSay(t(P.mode === 'attack' ? 'on_sent' : 'on_rallySent'), false); audio.play('horn'); save(); }
  },
  async onlineLaunch(id) { const k = await online.rallyLaunch(id); if (k) onlineSay(t('on_e_' + k), true); else audio.play('horn'); },
  onlineAllyCreate() { cloud.ask(t('on_create'), [{ ph: t('on_allyPh'), max: 20 }, { ph: t('on_tagPh'), max: 4 }], t('on_create'), async ([name, tag]) => { const k = await online.allianceCreate(name, tag); if (k) onlineSay(t('on_e_' + k), true); }); },
  async onlineAllyJoin(id) { const k = await online.allianceJoin(id); if (k) onlineSay(t('on_e_' + k), true); else audio.play('won'); },
  async onlineAllyLeave() { const k = await online.allianceLeave(); if (k) onlineSay(t('on_e_' + k), true); },
  async onlineKick(id) { const k = await online.allianceKick(id); if (k) onlineSay(t('on_e_' + k), true); },
  quality(q) { ui.q = q; slow = 0; setQuality(q === 'auto' ? 2 : q); save(); audio.play('tap'); },
  account() { ui.settings = false; cloud.open(); audio.play('tap'); },
  guideToggle() { const g = world.goal(); ui.guideOpen = !(ui.guideOpen == null ? !!g && g.i < 12 : ui.guideOpen); audio.play('tap'); },
  buildOpen() { ui.sel = null; ui.vsel = null; ui.aiming = false; ui.build = { cat: ui.lastCat || 'dif' }; audio.play('tap'); },
  buildClose() { if (ui.build && world.seeBuilds(BUILD_CATS[ui.build.cat])) save(); ui.build = null; ui.place = null; audio.play('tap'); },
  cat(cat) { if (world.seeBuilds(BUILD_CATS[ui.build.cat])) save(); ui.build.cat = cat; ui.lastCat = cat; audio.play('tap'); },
  pick(type) {
    const D = BUILD[type];
    if (D.min > world.d.castle) { toast(t('needCastle', D.min)); return; }
    if (D.tech && !world.d.tech[D.tech]) { toast(t('why_tech')); return; }
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
  move(b) { if (world.moveCheck(b) !== 'ok') { toast(t('notNow')); return; } ui.place = { type: b.type, move: b.id, c: b.c, r: b.r, a: null, b: null }; ui.sel = null; ui.build = null; audio.play('tap'); },
  marketMode() { ui.sell = !ui.sell; audio.play('tap'); },
  sell(r) { if (world.sell(r)) save(); else audio.play('no'); },
  recall(id) { if (world.recallTrip(id)) { ui.map.recall = null; audio.play('coin'); save(); } },
  // demolire chiede conferma: il primo tocco prepara («Sicuro?»), il secondo demolisce
  demolish(b) { if (ui.demoAsk !== b.id) { ui.demoAsk = b.id; ui.demoT = 3; audio.play('tap'); return; } ui.demoAsk = null; if (world.demolish(b)) { ui.sel = null; save(); } },
  resInfo() { ui.resInfo = !ui.resInfo; audio.play('tap'); },
  plantAll() { ui.plantAll = !ui.plantAll; audio.play('tap'); },
  upgrade(b) { if (!world.upgrade(b)) toast(t('why_cost')); else save(); },
  castleUp() { if (!world.upgradeCastle()) toast(t('why_cost')); else save(); },
  plant(b, crop) {
    if (!world.plant(b, crop, Date.now())) { toast(t('why_cost')); return; }
    if (ui.plantAll) for (const o of world.d.buildings) if (o.type === 'campo' && !o.crop && !(o.build > 0)) world.plant(o, crop, Date.now());      // «semina tutti»: finché bastano le monete
    ui.sel = null; audio.play('build'); save();
  },
  train(b, type) {
    if (world.train(b, type)) { save(); return; }
    const why = world.trainCheck(b, type), U = UNITS_MSG[why];
    toast(why === 'castle' ? t('needCastle', world_unit(type).min) : why === 'tech' ? t('why_tech') : t(U || 'why_cost'));
  },
  tech() { ui.tech = !ui.tech; audio.play('tap'); },
  research(id) { if (!world.research(id)) toast(t('why_cost')); else save(); },
  buy(r) { if (world.buy(r)) save(); else toast(t(world.buyCheck(r) === 'tech' ? 'why_tech' : 'why_cost')); },
  vClose() { ui.vsel = null; },
  claimGoal() { if (world.claimGoal()) save(); },
  moraleInfo() { A.roles(); },
  ally(i) { if (world.ally(i)) save(); else { const w = world.allyCheck(i); toast(w === 'castle' ? t('needCastle', Math.min(5, world.d.villages[i].level)) : w === 'max' ? t('maxAllies') : w === 'cost' ? t('why_cost') : t('notNow')); } },
  breakAlly(i) { if (world.breakAlly(i)) save(); },
  trade(i) { if (world.trade(i)) save(); else { const w = world.tradeCheck(i); toast(t(w === 'done' ? 'tradeDone' : w === 'tech' ? 'why_tech' : w === 'cost' ? 'why_cost' : 'notNow')); } },
  attack(i) { if (world.startRaid(i)) { closeAll(); save(); } else { const w = world.raidCheck(i); toast(t(w === 'noarmy' ? 'needArmy' : w === 'ally' ? 'isAlly' : 'notNow')); } },
  retreat() { if (world.retreat()) save(); },
  start() { if (world.startNight()) { closeAll(); save(); } },
  speed() { ui.speed = ui.speed === 1 ? 2 : 1; audio.play('tap'); },
  aim() { if (world.spellCd <= 0) { ui.aiming = !ui.aiming; ui.sel = null; audio.play('tap'); } else audio.play('no'); },
  home() { scene.setView((CASTLE.c + CASTLE.w / 2) * G, (CASTLE.r + CASTLE.h / 2) * G + 20, view.tall ? 1900 : 1150); audio.play('tap'); },
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
function hitButton(clientX, clientY, pad = 0) {
  const lx = clientX / view.us, ly = clientY / view.us;
  for (let i = ui.buttons.length - 1; i >= 0; i--) {
    const b = ui.buttons[i];
    if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) { b.fn(lx, ly); return true; }
  }
  if (pad) {       // un dito è più largo di un cursore: vale il bottone piccolo più vicino, entro il margine
    let best = null, bd = pad * pad;
    for (const b of ui.buttons) { if (!b.tag || (b.w > 130 && b.h > 60)) continue; const dx = Math.max(b.x - lx, 0, lx - b.x - b.w), dy = Math.max(b.y - ly, 0, ly - b.y - b.h), dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = b; } }
    if (best) { best.fn(lx, ly); return true; }
  }
  return false;
}
const DUMMY = 0; void DUMMY;
void HERO;
const TALL = { scalo: 70, fontana: 46, taverna: 66, statua: 50, mulino: 76, fucina: 66, lampione: 40, albero: 40, castello: 120, arcieri: 84, mago: 90, catapulta: 56, braciere: 66, radici: 44, casa: 60, caserma: 66, segheria: 50, cava: 50, cancello: 52, mura: 40, recinto: 26, bottega: 60, mercato: 50, miniera: 46, cristalliera: 46, porto: 40 };
/** Il villaggio sotto il dito: la piazza attorno alla casa del capo, oppure la casa stessa (che sullo schermo sta più in su). */
function villageUnder(clientX, clientY, g) {
  for (let i = 0; i < TRIBES.length; i++) {
    if (!world.known(i)) continue;
    const x = (TRIBES[i].c + 0.5) * G, y = (TRIBES[i].r + 0.5) * G;
    if (Math.hypot(x - g.x, y - g.y) < 2.4 * G) return i;
    const p = scene.project(x, y, 50);
    if (Math.hypot(clientX - p.x, clientY - p.y) < 62 * scene.scaleAt(x, y)) return i;
  }
  return -1;
}
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
  if (!ui.place && !ui.aiming && !ui.rallyPick) {      // i soldati: un tocco sceglie il gruppo, il tocco dopo dice dove andare
    const reach = Math.max(30, 26 / Math.max(0.05, scene.scaleAt(g.x, g.y))), near = world.squadNear(g.x, g.y, reach);
    if (ui.squad != null) {
      if (near >= 0 && near !== ui.squad) { ui.squad = near; audio.play('tap'); return; }
      if (world.raid && Math.hypot(g.x - world.raid.x, g.y - world.raid.y) < 110) { A.squadAttack(); return; }
      if (near < 0) { if (world.order(ui.squad, g.x, g.y)) audio.play('tap'); else toast(t('orderBad')); return; }
    } else if (near >= 0 && !world.buildingAt(Math.floor(g.x / G), Math.floor(g.y / G))) { ui.squad = near; ui.sel = null; ui.vsel = null; ui.build = null; audio.play('hey'); return; }
  }
  if (world.status === 'raid') return;
  if (ui.place) {
    const pl = ui.place, line = BUILD[pl.type].line;
    if (kind === 'mouse') { const second = !line || !!pl.a; moveGhost(g); if (second) confirmPlace(); return; }
    if (inGhost(g) && (!line || pl.b || pl.a)) { if (line && !pl.b) pl.b = pl.a; confirmPlace(); return; }
    moveGhost(g); audio.play('tap');
    return;
  }
  if (ui.aiming) { if (world.castSpell(g.x, g.y)) ui.aiming = false; else audio.play('no'); return; }
  if (ui.rallyPick) { if (world.setRally(g.x, g.y) === 'ok') { ui.rallyPick = false; save(); audio.play('build'); } else toast(t('rallyBad')); return; }
  // le nuvole e le rovine: si apre la mappa su quel punto, e da lì parte l'esploratore
  if (!world.seen(Math.floor(g.x / G), Math.floor(g.y / G))) { A.mapOpen(); ui.map.sel = mapPick(world, g.x, g.y); return; }
  { const R = RUINS.find(o => !world.d.ruins[o.id] && Math.hypot((o.c + 0.5) * G - g.x, (o.r + 0.5) * G - g.y) < 70); if (R) { A.mapOpen(); ui.map.sel = mapPick(world, (R.c + 0.5) * G, (R.r + 0.5) * G); return; } }
  const vi = villageUnder(clientX, clientY, g);
  if (vi >= 0) { ui.vsel = vi; ui.seenVillage = true; ui.sel = null; ui.build = null; audio.play('tap'); save(); return; }
  const b = buildingUnder(clientX, clientY, g), now = Date.now();
  ui.vsel = null;
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
  if (n) { const r = world.assign(n); if (r === 'full') toast(t('jobsFull')); else if (r === 'ok' || r === 'cancel') audio.play('tap'); return; }
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
  if (ui.online && ptrs.size === 2) { const p = pinchInfo(); gest = { mode: 'wpinch', d: p.d }; return; }
  if (ui.online && ptrs.size === 1) { const lx = e.clientX / view.us, ly = e.clientY / view.us; let top = null; for (let i = ui.buttons.length - 1; i >= 0; i--) { const b = ui.buttons[i]; if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) { top = b; break; } } if (top && top.tag === 'worldArea') { gest = { mode: 'wpan', x0: e.clientX, y0: e.clientY, cx: ui.online.cam.x, cy: ui.online.cam.y, moved: false, fn: top.fn }; return; } }
  if (ptrs.size === 2) { if (gest && gest.mode === 'ui') return; const p = pinchInfo(); gest = { mode: 'pinch', d: p.d, g0: scene.pick(p.mx, p.my) }; return; }
  if (ptrs.size > 2) return;
  if (hitButton(e.clientX, e.clientY, e.pointerType === 'mouse' ? 0 : 10)) { gest = { mode: 'ui' }; return; }
  const g0 = scene.pick(e.clientX, e.clientY);
  gest = { mode: 'pending', x0: e.clientX, y0: e.clientY, g0, kind: e.pointerType === 'mouse' ? 'mouse' : 'touch', onGhost: e.pointerType !== 'mouse' && inGhost(g0) };
});
uiCanvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse' && ui.place && ui.screen === 'play') { const lx = e.clientX / view.us, ly = e.clientY / view.us; if (!ui.buttons.some(b => lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h)) moveGhost(scene.pick(e.clientX, e.clientY)); } return; }
  p.x = e.clientX; p.y = e.clientY;
  if (gest && ui.online && gest.mode === 'wpan') { const dx = e.clientX - gest.x0, dy = e.clientY - gest.y0; if (Math.hypot(dx, dy) > 8) gest.moved = true; if (gest.moved) { const z = ui.online.cam.z * view.us; ui.online.cam.x = Math.max(-110, Math.min(110, gest.cx - dx / z)); ui.online.cam.y = Math.max(-110, Math.min(110, gest.cy - dy / z)); } return; }
  if (gest && ui.online && gest.mode === 'wpinch' && ptrs.size >= 2) { const q = pinchInfo(); A.onlineZoom(q.d / gest.d); gest.d = q.d; return; }
  if (!gest || ui.screen !== 'play') return;
  if (gest.mode === 'pinch' && ptrs.size >= 2) {
    const q = pinchInfo();
    scene.zoomAt(gest.d / q.d, q.mx, q.my); gest.d = q.d;
    if (gest.g0) scene.dragTo(gest.g0, q.mx, q.my);
    ui.moved = true;
  } else if (gest.mode === 'pending') {
    if (Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > (gest.kind === 'mouse' ? 5 : 9)) gest.mode = gest.onGhost ? 'ghost' : 'pan';
  }
  if (gest.mode === 'pan' && gest.g0) { scene.dragTo(gest.g0, e.clientX, e.clientY); ui.moved = true; ui.follow = false; }
  else if (gest.mode === 'ghost') moveGhost(scene.pick(e.clientX, e.clientY));
});
function pointerEnd(e, cancelled) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gest && gest.mode === 'wpan' && !gest.moved && !cancelled && ui.online) gest.fn(gest.x0 / view.us, gest.y0 / view.us);
  if (gest && gest.mode === 'pending' && !cancelled) worldTap(gest.x0, gest.y0, gest.kind);
  if (ptrs.size === 0) gest = null;
  else if (gest && gest.mode === 'pinch') { const q = [...ptrs.values()][0]; gest = { mode: 'pan', g0: scene.pick(q.x, q.y) }; }
}
uiCanvas.addEventListener('pointerup', (e) => pointerEnd(e, false));
uiCanvas.addEventListener('pointercancel', (e) => pointerEnd(e, true));
uiCanvas.addEventListener('wheel', (e) => { e.preventDefault(); if (ui.online) { if (ui.online.tab === 'map') A.onlineZoom(e.deltaY > 0 ? 0.88 : 1.14); return; } if (ui.screen !== 'play' || view.portrait) return; scene.zoomAt(e.deltaY > 0 ? 1.12 : 0.89, e.clientX, e.clientY); ui.moved = true; }, { passive: false });
uiCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

const keys = {};
window.addEventListener('keydown', (e) => {
  if (cloud.state.open) { if (e.key === 'Escape') cloud.close(); return; }      // si sta scrivendo l'email: i tasti non sono comandi
  keys[e.key] = true;
  if (e.key === 'Escape') back();
  else if (e.key === ' ' && ui.screen === 'play' && world.status === 'day' && !ui.place && !ui.tech) A.start();
  else if (e.key === 'f') A.speed();
  else if (e.key === 'b' && ui.screen === 'play') { if (ui.build) A.buildClose(); else A.buildOpen(); }
  else if (e.key === 'm' && ui.screen === 'play' && !cloud.state.open) { if (ui.map) A.mapClose(); else A.mapOpen(); }
  else if (e.key === 'Enter' && ui.place) confirmPlace();
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
// tasto indietro del telefono: chiude ciò che è aperto, poi esce
function back() {
  if (ui.lost) ui.lost = null;
  else if (ui.away) ui.away = null;
  else if (cloud.state.open) cloud.close();
  else if (ui.story != null) A.storyOk();
  else if (ui.news) A.newsOk();
  else if (ui.reportOpen) A.reportOk();
  else if (ui.seaOpen) A.seaOk();
  else if (ui.fleet) A.fleetClose();
  else if (ui.online) { if (ui.online.pick) ui.online.pick = null; else ui.online = null; }
  else if (ui.map) ui.map = null;
  else if (ui.squad != null) ui.squad = null;
  else if (ui.quests || ui.settings || ui.tech || ui.roles) { ui.quests = ui.settings = ui.tech = ui.roles = false; }
  else if (ui.fogSel || ui.rallyPick) { ui.fogSel = null; ui.rallyPick = false; }
  else if (ui.place) ui.place = null;
  else if (ui.build) ui.build = null;
  else if (ui.sel || ui.vsel != null || ui.aiming) { ui.sel = null; ui.vsel = null; ui.aiming = false; }
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
const tribeCol = (i) => { const T = TRIBES[i]; return !T ? '#fff' : T.id === 'neri' ? '#8f86b0' : T.color; };
const RES_FX = { monete: '#ffd24a', legna: '#e0b98a', pietra: '#dfe1ea', ferro: '#c5ccdb', cristallo: '#9fe9ff' };
function handleEvents() {
  for (const ev of world.events) {
    switch (ev.k) {
      case 'placed': buzz(12); ring(ui.fx, ev.x, ev.y, 10, 70, 0.4, '#ffe9a8', 4); parts(ui.fx, ev.x, ev.y, 10, 12, '#d9c7a0', 100, 0.5, 4, 260); audio.play('build'); break;
      case 'demolished': parts(ui.fx, ev.x, ev.y, 14, 12, '#b9a98a', 110, 0.5, 4, 260); audio.play('coin'); break;
      case 'upgrade': ring(ui.fx, ev.x, ev.y, 8, ev.castle ? 130 : 64, 0.5, '#ffd24a', 4); parts(ui.fx, ev.x, ev.y, 40, ev.castle ? 30 : 16, '#ffe27a', 120, 0.7, 3.5, 200); audio.play('up'); buzz(15); break;
      case 'chop': { const col = { tree: '#4f9a4b', rock: '#a9abb5', iron: '#c0683c', crystal: '#8fe8ff' }[ev.kind], tc = { tree: RES_FX.legna, rock: RES_FX.pietra, iron: RES_FX.ferro, crystal: RES_FX.cristallo }[ev.kind]; parts(ui.fx, ev.x, ev.y, 18, 10, col, 110, 0.5, 4, 280); text(ui.fxTop, ev.x, ev.y, 30, '+' + ev.gain, tc, 20, 0.8); audio.play('chop', 0.04); buzz(8); break; }
      case 'unknown': toast(t('unknown')); break;
      case 'job': ring(ui.fx, ev.x, ev.y, 8, 36, 0.35, '#ffe9a8', 3); break;
      case 'built': ring(ui.fx, ev.x, ev.y, 10, 76, 0.45, '#ffe9a8', 4); parts(ui.fx, ev.x, ev.y, 20, 12, '#d9c7a0', 110, 0.5, 4, 260); audio.play('build', 0.3); break;
      case 'harvested': text(ui.fxTop, ev.x, ev.y, 40, '+' + ev.gain, '#ffd24a', 20, 1); break;
      case 'rally': ring(ui.fx, ev.x, ev.y, 10, 90, 0.5, MY_COLOR, 4); break;
      case 'heroUp': banner(t('heroUp', ev.lvl), '#ffe9a8', 2.6); audio.play('heroUp'); buzz(20); ring(ui.fxTop, ev.x, ev.y, 12, 120, 0.7, '#ffe27a', 5); break;
      case 'heroDown': banner(t('heroDown'), '#ff8a80', 2.6); audio.play('sad'); parts(ui.fx, ev.x, ev.y, 16, 14, MY_COLOR, 130, 0.6, 4, 260); break;
      case 'heroPower': if (ev.kind === 'slam') { ring(ui.fxTop, ev.x, ev.y, 10, ev.r, 0.4, '#ffe27a', 6); parts(ui.fxTop, ev.x, ev.y, 8, 20, '#fff6c9', 200, 0.5, 4.5, 300); ui.shake = 0.3; } else { ring(ui.fxTop, ev.x, ev.y, 20, 260, 0.9, '#ff9d2a', 5); } buzz(30); break;
      case 'grew': banner(t('grew'), '#ffd0c8', 2.6); break;
      case 'war': banner(`${t('tr_' + TRIBES[ev.a].id)} ${t('beat')} ${t('tr_' + TRIBES[ev.b].id)}`, '#cfd8ff', 2.8); break;
      case 'event': audio.play('event'); break;
      case 'shard': banner(t('shardGot', ev.n), '#ffe27a', 3); audio.play('won'); break;
      case 'found': banner(`${t('found')}: ${t('tr_' + TRIBES[ev.i].id)}`, '#9fe9ff', 2.8); audio.play('hey'); ring(ui.fxTop, ev.x, ev.y, 20, 220, 0.9, '#ffffff', 5); break;
      case 'ruin': { banner(t('ruinGot'), '#ffe27a', 2.6); if (ev.item) banner(t('itemGot', t('it_' + ev.item)), '#ffe9a8', 2.8); audio.play('cleared'); let k = 0; for (const r in ev.loot) text(ui.fxTop, ev.x + k++ * 64, ev.y, 60, '+' + ev.loot[r], RES_FX[r], 24, 1.6); save(); break; }
      case 'scout': audio.play('hey'); break;
      case 'tripDone': audio.play('hey'); buzz(20); break;
      case 'shipNew': banner(t('sea_built'), '#9fe9ff', 2.2); audio.play('build'); break;
      case 'shipUp': audio.play('cleared'); break;
      case 'shipOut': audio.play('horn'); break;
      case 'shipBack': audio.play(ev.win === 0 || ev.robbed ? 'sad' : 'hey'); buzz(20); break;
      case 'pvp': banner(reportLine({ kind: ev.kind, data: ev.data }), ev.kind === 'won' || ev.kind === 'defended' ? '#9ff0b4' : ev.kind === 'bounced' ? '#cfd8ff' : '#ff8a80', 3.4); audio.play(ev.kind === 'won' || ev.kind === 'defended' ? 'won' : 'sad'); buzz(30); if (!ui.online) ui.onlineNew = (ui.onlineNew || 0) + 1; save(); break;
      case 'meal': if (ev.fed < 0.5) { banner(t('hungry'), '#ff8a80', 2.8); audio.play('sad'); } break;
      case 'gift': audio.play('coin'); parts(ui.fxTop, ev.x, ev.y, 60, 14, '#ff8fb0', 120, 0.9, 4.5, 160); break;
      case 'order': ring(ui.fx, ev.x, ev.y, 8, 54, 0.4, '#fff6a0', 4); break;
      case 'trophy': banner(t('trophy') + ': ' + t('tro_' + ev.kind) + ' ' + ev.need, '#ffe27a', 2.8); audio.play('won'); buzz(20); save(); break;
      case 'goal': { audio.play('cleared'); buzz(20); const g = scene.pick(210 * view.us, 120 * view.us) || { x: world.castle.x, y: world.castle.y }; let k = 0; for (const r in ev.reward) text(ui.fxTop, g.x + k++ * 70, g.y, 20, '+' + ev.reward[r], RES_FX[r], 26, 1.5); break; }
      case 'tech': banner(t('discovered', t('t_' + ev.id)), '#9fe9ff', 2.6); audio.play('won'); buzz(20); save(); break;
      case 'bought': audio.play('coin'); break;
      case 'sold': audio.play('coin'); text(ui.fxTop, world.castle.x, world.castle.y, 120, '+' + ev.n, '#ffd24a', 22, 0.9); break;
      case 'train': ring(ui.fx, ev.x, ev.y, 10, 60, 0.45, '#6fb7ff', 4); audio.play('up'); break;
      case 'nightStart': audio.play('horn'); banner(`${t('night')} ${ev.night}`, '#cfd8ff', 2.2); break;
      case 'spawn': ring(ui.fx, ev.x, ev.y, 14, ev.boss ? 110 : 56, 0.5, tribeCol(ev.tribe), ev.boss ? 5 : 3); break;
      case 'raidStart': closeAll(); audio.play('horn'); banner(`${t('raidOn')} · ${t('tr_' + TRIBES[ev.i].id)}`, '#ffd0c8', 2.2); ui.follow = true; break;
      case 'hallShot': parts(ui.fx, ev.tx, ev.ty, 18, 5, '#d9c7a0', 90, 0.3, 3, 240); audio.play('wall', 0.2); break;
      case 'conquered': { scene.cheer(6);
        banner(t('conquered'), '#ffe9a8', 2.8); audio.play('won'); buzz([30, 60, 30]); ui.speed = 1;
        ring(ui.fxTop, ev.x, ev.y, 20, 220, 0.8, MY_COLOR, 6); parts(ui.fxTop, ev.x, ev.y, 60, 34, '#ffe27a', 220, 0.9, 4.5, 260);
        let k = 0; for (const r in ev.loot) text(ui.fxTop, ev.x - 60 + k++ * 60, ev.y, 90, '+' + ev.loot[r], RES_FX[r], 24, 1.6);
        save();
        break;
      }
      case 'raidLost': banner(t('raidLost'), '#ff8a80', 2.6); audio.play('lost'); buzz(120); ui.speed = 1; save(); break;
      case 'retreat': banner(t('retreated'), '#cfd8ff', 2); ui.speed = 1; audio.play('tap'); break;
      case 'allied': banner(`${t('allied')}: ${t('tr_' + TRIBES[ev.i].id)}`, '#9ff0b4', 2.6); audio.play('won'); buzz(20); ring(ui.fxTop, ev.x, ev.y, 20, 200, 0.8, MY_COLOR, 6); parts(ui.fxTop, ev.x, ev.y, 60, 26, '#bfe9a8', 200, 0.9, 4.5, 260); break;
      case 'allyEnd': banner(`${t('allyEnd')}: ${t('tr_' + TRIBES[ev.i].id)}`, '#ffd0c8', 2.6); break;
      case 'traded': { audio.play('coin'); let k = 0; for (const r in ev.get) text(ui.fxTop, ev.x + k++ * 60, ev.y, 90, '+' + ev.get[r], RES_FX[r], 24, 1.4); break; }
      case 'revolt': banner(`${t('revolt')}: ${t('tr_' + TRIBES[ev.i].id)}`, '#ff8a80', 2.8); break;
      case 'quietNight':
        banner(`${t('quiet')}  +${ev.reward}`, '#cfd8ff', 2.4); audio.play('cleared'); save();
        if (world.daily(Date.now()).available) ui.daily = true;
        break;
      case 'shot': audio.play(ev.type, 0.07); break;
      case 'burn': audio.play('burn', 0.45); break;
      case 'hit': parts(ui.fx, ev.x, ev.y, 20, 3, '#fff3c4', 70, 0.22, 2.6); break;
      case 'slash': parts(ui.fx, ev.x, ev.y, 18, 3, '#ffffff', 70, 0.22, 2.6); arc(ui.fx, ev.x, ev.y, Math.random() * 6.283, '#ffffff', 17, 0.22); audio.play('slash', 0.1); break;
      case 'burst': ring(ui.fx, ev.x, ev.y, 6, ev.r, 0.3, '#c79bff', 4); parts(ui.fx, ev.x, ev.y, 18, 8, '#d9b8ff', 120, 0.35, 3.5); audio.play('burst', 0.08); break;
      case 'impact': chips(ui.fx, ev.x, ev.y, 6, 7, ['#8d8f96', '#b89a6a', '#6f6a64'], 150, 1.2); for (let i = 0; i < 3; i++) smoke(ui.fx, ev.x, ev.y, 6, '#b8a88a', 11, 0.9, 0.45); ring(ui.fx, ev.x, ev.y, 10, ev.r, 0.35, '#e8d2a6', 5); parts(ui.fx, ev.x, ev.y, 6, 14, '#b89a6a', 150, 0.55, 4.5, 320); ui.shake = Math.max(ui.shake, 0.18); audio.play('impact', 0.1); break;
      case 'pulse': ring(ui.fx, ev.x, ev.y, 14, ev.r, 0.55, '#7fe6a0', 3.5); audio.play('pulse', 0.25); break;
      case 'spell':
        ui.fxTop.push({ k: 'bolt', x: ev.x, y: ev.y, seed: Math.floor(Math.random() * 100), t: 0, T: 0.3 });
        ring(ui.fxTop, ev.x, ev.y, 10, ev.r, 0.45, '#ffe27a', 6); parts(ui.fxTop, ev.x, ev.y, 10, 22, '#fff6c9', 220, 0.5, 4.5, 300);
        ui.shake = 0.3; buzz(40); audio.play('impact'); audio.play('burst');
        break;
      case 'kill':
        parts(ui.fx, ev.x, ev.y, 18, ev.boss ? 26 : 9, tribeCol(ev.tribe), ev.boss ? 190 : 110, 0.5, ev.boss ? 6 : 4, 260);
        text(ui.fxTop, ev.x, ev.y, 34, '+' + ev.reward, '#ffd24a', ev.boss ? 26 : 17, 0.8);
        audio.play(ev.boss ? 'impact' : 'kill', 0.05); if (ev.boss) ui.shake = 0.4;
        break;
      case 'struck': parts(ui.fx, ev.x, ev.y, 16, 3, '#d9c7a0', 80, 0.3, 3, 220); chips(ui.fx, ev.x, ev.y, 18, 2, ['#b9a98a', '#8f8a80'], 90, 1); audio.play('wall', 0.18); break;
      case 'destroyed': chips(ui.fx, ev.x, ev.y, 22, 18, ['#b9a98a', '#8f8a80', '#6f4526', '#d9c7a0'], 170, 2.4); for (let i = 0; i < 6; i++) smoke(ui.fx, ev.x, ev.y, 10 + i * 5, '#4a4440', 15, 1.8, 0.6); ring(ui.fx, ev.x, ev.y, 8, 60, 0.4, '#ff8a6a', 4); parts(ui.fx, ev.x, ev.y, 12, 16, '#b9a98a', 150, 0.6, 4.5, 300); ui.shake = Math.max(ui.shake, 0.15); audio.play('impact', 0.1); buzz(25); break;
      case 'soldierDown': parts(ui.fx, ev.x, ev.y, 16, 10, MY_COLOR, 110, 0.5, 4, 260); buzz(15); break;
      case 'castleHit': if (ui.flash < 0.12) { ui.flash = 0.4; buzz(30); } ui.shake = Math.max(ui.shake, 0.12); parts(ui.fx, ev.x, ev.y, 40, 3, '#d9c7a0', 110, 0.4, 3.5, 260); audio.play('leak', 0.5); break;
      case 'nightWon': scene.cheer(5);
        banner(`${t('cleared')}  +${ev.reward}`, '#ffe9a8', 2.6);
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
  scene.r.setPixelRatio(view.gl * 0.96);
  requestAnimationFrame(() => scene.r.setPixelRatio(view.gl));
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
  if (quality === 0 && (skip++ & 1)) { requestAnimationFrame(frame); return; }      // a qualità bassa, un fotogramma sì e uno no: il telefono scalda meno
  const raw = (now - last) / 1000, real = Math.max(0, Math.min(0.1, raw)); last = now;
  // se per un paio di secondi i fotogrammi sono lenti, abbasso la qualità (una tacca alla volta)
  if (ui.q === 'auto' && !document.hidden && raw < 0.25) {
    slow = raw > 1 / 27 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 90 && quality > 0) { slow = 0; setQuality(quality - 1); save(); console.log('[tuzu] qualita -> ' + quality); }
  }
  tick(real);
  frames++;
  if (frames === 2) kick();                                           // sempre, una volta, appena partiti
  else if ((frames === 20 || frames === 60 || frames === 150 || frames % 600 === 0) && kicks < 8 && !view.portrait && blank()) { console.log('[tuzu] tela 3D vuota: la rialloco'); kick(); }
  requestAnimationFrame(frame);
}

function onlineSay(msg, bad) { if (ui.online) { ui.online.msg = msg; ui.online.msgT = 6; ui.online.bad = !!bad; ui.online.tab = ui.online.tab || 'map'; } else toast(msg); }
/** Sincronizza col mondo (manda la fotografia, riceve i rapporti) e, a schermo aperto, rilegge tutto. */
let onlineBusy = false;
async function onlineRefresh(full) {
  if (onlineBusy || !cloud.state.user || online.state.ready === false) return;
  onlineBusy = true;
  try { await online.sync(); if (full || ui.online) await online.load(); if (ui.online && ui.online.cam && online.state.me && ui.online.loadT === 99) { ui.online.cam.x = online.state.me.x; ui.online.cam.y = online.state.me.y; ui.online.loadT = 0; } } catch (e) { /* si riprova al prossimo giro */ }
  onlineBusy = false;
}
let onlineT = 20;
const warned = new Set();

/** Fumo dagli edifici malconci e polvere sotto chi corre: piccole cose che fanno sembrare vera una battaglia. */
let fxT = 0;
function ambientFx() {
  if (world.status === 'day') {        // di giorno: un filo di fumo dai camini (solo da vicino, e pochi alla volta)
    if (ui.fx.length > 90 || scene.view.dist > 1900 || Math.random() < 0.45) return;
    const list = world.d.buildings.filter(b => (b.type === 'casa' || b.type === 'fucina' || b.type === 'taverna') && !(b.build > 0));
    const b = list[Math.floor(Math.random() * list.length)];
    if (b) { const p = scene.project(b.x, b.y, 60); if (p.x > -40 && p.x < view.cw + 40 && p.y > -40 && p.y < view.ch + 40) smoke(ui.fx, b.x + (b.type === 'casa' ? 18 : 12), b.y - 14, b.type === 'casa' ? 72 : 80, b.type === 'fucina' ? '#8a8480' : '#efeae2', 5.5, 2.4, 0.3); }
    return;
  }
  if (ui.fx.length > 260) return;
  let n = 0;
  for (const b of world.d.buildings) {
    if (n > 12 || BUILD[b.type].deco) continue;
    const f = b.hp / world.maxHp(b); if (f >= 0.6) continue;
    n++; smoke(ui.fx, b.x, b.y, (TALL[b.type] || 30) * 0.8, f < 0.3 ? '#3a3532' : '#6a6460', 10, 1.7, 0.5);
    if (f < 0.3) parts(ui.fx, b.x + (Math.random() - 0.5) * 22, b.y, (TALL[b.type] || 30) * 0.5, 1, '#ff9d2a', 26, 0.5, 4.5);
  }
  if (world.raid && world.raid.hp < world.raid.maxHp * 0.6) { smoke(ui.fx, world.raid.x, world.raid.y, 90, '#4a4440', 14, 1.8, 0.55); if (world.raid.hp < world.raid.maxHp * 0.3) parts(ui.fx, world.raid.x + (Math.random() - 0.5) * 50, world.raid.y, 60, 2, '#ff9d2a', 30, 0.6, 5); }
  let k = 0;
  for (const e of world.enemies) { if (k > 9) break; if ((e.id + frames) % 4 === 0 && !e.foe && !e.guard && !e.ghost && !e.tb) { k++; smoke(ui.fx, e.x, e.y, 2, '#cdb892', 4.5, 0.6, 0.34); } }
  for (const sd of world.soldiers) if (sd.raid && !sd.target && (sd.id + frames) % 5 === 0) smoke(ui.fx, sd.x, sd.y, 2, '#cdb892', 4.5, 0.6, 0.3);
}

/** Un fotogramma: aggiorna e disegna. (Le prove lo chiamano a mano quando la scheda è in secondo piano.) */
function tick(real) {
  ui.time += real;
  if (view.portrait) { drawRotate(); return; }
  audio.musicTick(ui.screen !== 'play' ? 'day' : world.status);
  if (ui.moved) world.note('move');
  if (ui.seenVillage) world.note('village');
  if (ui.newsDue && ui.screen === 'play' && world.status === 'day' && !ui.lost && !ui.away && !ui.daily && ui.story == null && !cloud.state.open) { ui.newsDue = false; ui.news = true; }
  ui.eventOpen = ui.screen === 'play' && !ui.news && !!world.d.event && world.status === 'day' && !ui.lost && !ui.away && !ui.daily && ui.story == null;
  if (ui.screen === 'play' && ui.story == null && world.status === 'day' && !ui.lost && !ui.away && !ui.daily && world.storyDue() >= 0) { ui.story = world.storyDue(); audio.play('page'); closeAll(); }
  ui.reportOpen = ui.screen === 'play' && world.d.reports.length > 0 && world.status === 'day' && !ui.lost && !ui.away && !ui.daily && ui.story == null && !ui.eventOpen;
  ui.seaOpen = ui.screen === 'play' && world.d.seaReports.length > 0 && world.status === 'day' && !ui.reportOpen && !ui.lost && !ui.away && !ui.daily && ui.story == null && !ui.eventOpen && !ui.online && !ui.map;
  if (ui.map && ui.map.msgT > 0) ui.map.msgT -= real;
  if (ui.online && ui.online.msgT > 0) ui.online.msgT -= real;
  for (const m of threats()) if (!warned.has(m.id)) { warned.add(m.id); banner(t('on_threat', m.from || (online.byId(m.village_id) || {}).name || '?'), '#ff8a80', 3.6); audio.play('horn'); buzz(40); }
  ui.onlineDanger = threats().length;
  onlineT += real; if (onlineT > (ui.online ? 20 : 120)) { onlineT = 0; if (ui.screen === 'play' && (ui.online || world.status === 'day')) onlineRefresh(false); }
  if (ui.screen === 'play' && (ui.map || ui.reportOpen || ui.settings || ui.quests)) world.stepTrips(Date.now());
  if (ui.screen === 'play' && (ui.fleet || ui.seaOpen || ui.map || ui.settings || ui.quests)) world.stepFleet(Date.now());      // a pannello aperto il mondo è fermo, ma le spedizioni no
  const now = Date.now(), modal = ui.screen !== 'play' || ui.quests || ui.settings || ui.tech || ui.daily || ui.lost || ui.away || ui.roles || ui.story != null || ui.eventOpen || ui.news || ui.map || ui.fleet || ui.seaOpen || ui.online || ui.reportOpen || cloud.state.open;

  if (!modal) {
    const fight = world.status !== 'day', steps = fight ? ui.speed * 2 : 1, dt = fight ? real / 2 : real;      // passi piccoli: stabile anche a x2
    for (let i = 0; i < steps; i++) { world.update(dt, now); handleEvents(); }
    // camera da tastiera
    const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (kx || ky) { const v = scene.view, sp = v.dist * 0.9 * real; scene.setView(v.x + kx * sp, v.y + ky * sp); ui.moved = true; ui.follow = false; }
    if (world.status === 'raid' && ui.follow && world.soldiers.length) {
      let sx = 0, sy = 0; for (const sd of world.soldiers) { sx += sd.x; sy += sd.y; }
      const v = scene.view, n = world.soldiers.length, k = Math.min(1, real * 3), R = world.raid;
      // in marcia si guarda l'esercito; arrivati, il punto a metà fra l'esercito e la casa del capo
      const near = Math.hypot(sx / n - R.x, sy / n - R.y) < 420, tx = near ? (sx / n + R.x) / 2 : sx / n, ty = (near ? (sy / n + R.y) / 2 : sy / n) + 40;
      scene.setView(v.x + (tx - v.x) * k, v.y + (ty - v.y) * k, v.dist + (Math.min(v.dist, 1150) - v.dist) * k);
    }
    saveT += real; if (saveT > 12) { saveT = 0; save(); }
    fxT += real; if (fxT > 0.2) { fxT = 0; ambientFx(); }
  }
  stepFx(ui.fx, real * (world.status !== 'day' ? ui.speed : 1)); stepFx(ui.fxTop, real);
  ui.night += ((world.status === 'night' ? 1 : 0) - ui.night) * Math.min(1, real * 1.6);
  if (ui.sel && !world.byId.has(ui.sel.b.id)) ui.sel = null;
  if (ui.place) { const st = ui.place.state = placeState(); scene.setGhost({ type: ui.place.type, cells: st.cells, at: st.at || null, line: !!st.line }); }
  else scene.setGhost(null);
  scene.showGrid(ui.screen === 'play' && !!(ui.build || ui.place));
  scene.setCalm(!!(ui.build || ui.place));
  scene.sync(world, ui.time, now);
  scene.setNight(ui.night);

  if (ui.demoAsk != null) { ui.demoT -= real; if (ui.demoT <= 0 || !ui.sel || ui.sel.b.id !== ui.demoAsk) ui.demoAsk = null; }
  if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - real);
  if (ui.flash > 0) ui.flash = Math.max(0, ui.flash - real);
  if (ui.banner) { ui.banner.t += real; if (ui.banner.t >= ui.banner.T) ui.banner = null; }
  if (!ui.banner && ui.bannerQ.length) ui.banner = ui.bannerQ.shift();
  if (ui.toast) ui.toast.t += real;
  const sh = ui.shake * 12;
  glCanvas.style.transform = sh > 0.1 ? `translate(${(Math.random() - 0.5) * sh}px,${(Math.random() - 0.5) * sh}px)` : '';
  scene.render();

  const k = view.us * view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawUi({ c: ctx, world, ui, vw: view.vw, vh: view.vh, tall: view.tall, P, A, now, mapCv: scene.mapCv, fogCv: scene.fogCv, cam: scene.view, roadRev: scene.roadRev });
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
function reset() { frozen = true; try { localStorage.removeItem(KEY); } catch (e) { /* niente */ } window.removeEventListener('pagehide', save); location.reload(); }

// Se il telefono toglie il contesto grafico (succede quando l'app va in secondo piano), lo riprendo e ricostruisco la scena.
glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.log('[tuzu] contesto 3D perso'); });
glCanvas.addEventListener('webglcontextrestored', () => { console.log('[tuzu] contesto 3D ripreso'); scene.build(); });
window.addEventListener('error', (e) => console.log('[tuzu] errore: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('pagehide', save);

scene.build();
if (quality < 2) { scene.setShadows(quality >= 1); scene.setPost(false); }
resize();
if (view.tall && !(saved.cam && isFinite(saved.cam.x))) scene.setView((CASTLE.c + CASTLE.w / 2) * G, (CASTLE.r + CASTLE.h / 2) * G + 20, 1900);      // a schermo alto si parte più da lontano: di lato si vede meno
// chi ha già una partita vede una volta che cosa c'è di nuovo; chi comincia adesso no (per lui è tutto nuovo)
try { const seenNews = +(localStorage.getItem(NEWS_KEY) || 0); if (seenNews < NEWS_V) { if (world.d.night > 0 || world.d.buildings.length > 3) ui.newsDue = true; else localStorage.setItem(NEWS_KEY, String(NEWS_V)); } } catch (e) { /* niente */ }
if (world.flooded) setTimeout(() => { banner(t('riverMoved', world.flooded), '#9fe9ff', 5); save(); }, 2600);
online.init({ getSnap: () => world.pvpSnap(), onSent: (army) => { world.pvpSend(army); save(); }, onReports: (list) => { for (const r of list) world.pvpApply(r); save(); return list.map(r => r.id); } });
cloud.init({ key: KEY, beforeLeave: () => save(), getSave: () => JSON.parse(JSON.stringify(world)), t, onLoad: (data) => { frozen = true; try { const cur = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; cur.world = data; localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* niente */ } window.removeEventListener('pagehide', save); location.reload(); } });
if (saved.cam && isFinite(saved.cam.x) && saved.world && saved.world.map === 3) scene.setView(saved.cam.x, saved.cam.y, saved.cam.dist);      // la mappa vecchia era più piccola
console.log('[tuzu] avvio ' + view.cw + 'x' + view.ch + ' dpr ' + view.dpr + ' gl ' + (scene.r.getContext().isContextLost() ? 'PERSO' : 'ok') + ' ' + scene.r.capabilities.maxTextureSize);
window.__tuzu = { world, ui, view, scene, A, tap, P, save, shot, tick, back, kick, blank, reset, NATURE, TOWERS, TRIBES, cloud, online, get quality() { return quality; }, get kicks() { return kicks; } };   // per le prove automatiche
requestAnimationFrame(frame);

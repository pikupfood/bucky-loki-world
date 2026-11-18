// Mondo in 3D visto dall'alto (three.js): battaglia e villaggio. Le coordinate di gioco (x, y)
// diventano (x, altezza, z = y). L'interfaccia resta in 2D sopra e usa project()/pick().
import * as THREE from '../vendor/three.module.min.js';
import { WORLD_W, WORLD_H, WALL_X, ENEMIES, mulberry32 } from './data.js';
import { THEMES, VILLAGE, paintBattle, paintVillage } from './ground.js';
import { PLOTS, BUILDING_ORDER } from './meta.js';

// ---------- mattoncini: geometrie e materiali condivisi ----------
const geos = new Map(), mats = new Map();
function geom(key, make) { let g = geos.get(key); if (!g) { g = make(); geos.set(key, g); } return g; }
function M(color, o) {
  const key = color + (o ? JSON.stringify(o) : '');
  let m = mats.get(key);
  if (!m) {
    m = o && o.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: o.a != null, opacity: o.a ?? 1, side: o.double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.a == null })
      : new THREE.MeshLambertMaterial({ color, emissive: o && o.e ? o.e : 0x000000, emissiveIntensity: o && o.ei != null ? o.ei : 1, transparent: !!(o && o.a != null), opacity: o && o.a != null ? o.a : 1, flatShading: !!(o && o.flat) });
    mats.set(key, m);
  }
  return m;
}
function put(parent, g, m, x, y, z, shadow) {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow !== false; mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}
const box = (p, w, h, d, col, x, y, z, o) => put(p, geom(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), M(col, o), x, y, z, !(o && o.ns));
const cyl = (p, rt, rb, h, col, x, y, z, o) => put(p, geom(`c${rt}|${rb}|${h}|${(o && o.seg) || 14}`, () => new THREE.CylinderGeometry(rt, rb, h, (o && o.seg) || 14)), M(col, o && o.mat), x, y, z, !(o && o.ns));
const cone = (p, r, h, col, x, y, z, o) => put(p, geom(`k${r}|${h}|${(o && o.seg) || 14}`, () => new THREE.ConeGeometry(r, h, (o && o.seg) || 14)), M(col, o && o.mat), x, y, z, !(o && o.ns));
const sph = (p, r, col, x, y, z, o) => put(p, geom(`s${r}`, () => new THREE.SphereGeometry(r, 14, 10)), M(col, o), x, y, z, !(o && o.ns));
const octa = (p, r, col, x, y, z, o) => put(p, geom(`o${r}`, () => new THREE.OctahedronGeometry(r)), M(col, o), x, y, z, false);
function pyramid(p, r, h, col, x, y, z, sx = 1, sz = 1) { const m = cone(p, r, h, col, x, y, z, { seg: 4 }); m.rotation.y = Math.PI / 4; m.scale.set(sx, 1, sz); return m; }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }

const STONE = '#a3a4b0', STONE_D = '#7d7e8a', WOOD = '#9b6b3d', WOOD_L = '#c08e58', WOOD_D = '#6f4526', CREAM = '#efe4c8', GOLDC = '#f2c230';

// ---------- torri ----------
function makeTower(type, level) {
  const g = grp(null);
  cyl(g, 30, 33, 10, STONE, 0, 5, 0);
  cyl(g, 24, 24, 2, '#bcbdc8', 0, 10.5, 0, { ns: true });
  const u = { type, level };
  if (type === 'arcieri') {
    cyl(g, 16, 21, 44, WOOD, 0, 32, 0);
    for (let i = 0; i <= level; i++) cyl(g, 19.4 - i * 1.4, 20.2 - i * 1.4, 3, GOLDC, 0, 20 + i * 9, 0, { ns: true });
    cyl(g, 24, 21, 6, WOOD_L, 0, 57, 0);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; box(g, 8, 8, 8, WOOD, Math.cos(a) * 21, 64, Math.sin(a) * 21, { ns: true }); }
    const t = grp(g, 0, 66, 0);
    box(t, 26, 4, 5, WOOD_D, 3, 2, 0, { ns: true });
    box(t, 4, 3, 30, '#3d2a17', 9, 3, 0, { ns: true });
    u.bolt = cone(t, 2.6, 9, '#d5d9e2', 19, 2.5, 0, { ns: true }); u.bolt.rotation.z = -Math.PI / 2;
    if (level >= 1) { cyl(g, 1, 1, 26, WOOD_D, -14, 78, -14, { ns: true }); box(g, 12, 8, 1, level >= 2 ? '#c2452d' : '#2f8f5b', -8, 86, -14, { ns: true }); }
    u.turret = t;
  } else if (type === 'mago') {
    cyl(g, 12, 17, 26, STONE_D, 0, 23, 0);
    cyl(g, 15, 13, 4, '#b7b8c6', 0, 38, 0, { ns: true });
    const s = 1 + level * 0.16;
    const c = octa(g, 12, '#9b5cf0', 0, 64 + level * 4, 0, { e: 0x6a2fd0, ei: 0.9, flat: true });
    c.scale.set(s, 1.7 * s, s); c.castShadow = true;
    u.crystal = c; u.baseY = 64 + level * 4;
    u.halo = sph(g, 22, '#c9a2ff', 0, u.baseY, 0, { basic: true, a: 0.18, ns: true });
    u.orbit = grp(g, 0, u.baseY, 0);
    for (let i = 0; i < level; i++) sph(u.orbit, 2.6, '#f3e6ff', Math.cos(i * Math.PI) * 20, 0, Math.sin(i * Math.PI) * 20, { basic: true, ns: true });
  } else if (type === 'catapulta') {
    const t = grp(g, 0, 11, 0);
    box(t, 42, 7, 28, '#8a5a33', 0, 6, 0);
    for (const [wx, wz] of [[-14, -16], [14, -16], [-14, 16], [14, 16]]) { const w = cyl(t, 7, 7, 4, '#4c2f17', wx, 5, wz); w.rotation.x = Math.PI / 2; }
    box(t, 4, 20, 4, WOOD_D, 6, 18, -9); box(t, 4, 20, 4, WOOD_D, 6, 18, 9);
    const arm = grp(t, 6, 27, 0);
    box(arm, 36, 3.2, 4, WOOD_L, -15, 0, 0, { ns: true });
    sph(arm, 6.5, WOOD_D, -32, 1, 0, { ns: true });
    u.rock = sph(arm, 5 + level, '#8d8f96', -32, 5, 0, { ns: true });
    for (let i = 0; i <= level; i++) box(t, 3, 3, 30, GOLDC, -16 + i * 6, 10.5, 0, { ns: true });
    u.turret = t; u.arm = arm;
  } else if (type === 'braciere') {
    cyl(g, 12, 17, 18, STONE_D, 0, 19, 0);
    cyl(g, 21, 14, 10, '#55565e', 0, 33, 0);
    const coal = sph(g, 16, '#ff7a1a', 0, 37, 0, { e: 0xff4a00, ei: 1, ns: true }); coal.scale.y = 0.35;
    u.flames = [];
    for (let i = 0; i < 3 + level; i++) {
      const a = i * 2.4, h = 22 + level * 5 - (i % 3) * 5;
      const f = cone(g, 6 - (i % 2) * 1.5, h, i % 2 ? '#ffe27a' : '#ff9d2a', Math.cos(a) * 6, 50, Math.sin(a) * 6, { ns: true, mat: { basic: true, a: 0.92 } });
      f.userData.h = h; u.flames.push(f);
    }
    u.halo = sph(g, 26, '#ff9d2a', 0, 46, 0, { basic: true, a: 0.14, ns: true });
  } else {
    const m = sph(g, 19, '#5a4a2f', 0, 11, 0); m.scale.y = 0.55;
    const n = 6 + level * 2; u.vines = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, v = grp(g, 0, 14, 0);
      v.rotation.y = -a;
      const st = cyl(v, 1.4, 3.6, 26 + level * 4, '#2f7d4f', 9, 9, 0, { ns: true }); st.rotation.z = -0.95;
      sph(v, 3.6, '#6fd68f', 20 + level * 2, 17 + level, 0, { ns: true });
      u.vines.push(v);
    }
    u.bud = sph(g, 7 + level, '#8ff0b0', 0, 27, 0, { e: 0x3fd070, ei: 0.8, ns: true });
    u.halo = sph(g, 18, '#8ff0b0', 0, 27, 0, { basic: true, a: 0.16, ns: true });
  }
  g.userData = u;
  return g;
}

function makeSpot() {
  const g = grp(null);
  cyl(g, 30, 33, 6, '#9c9da8', 0, 3, 0, { ns: true }).receiveShadow = true;
  cyl(g, 23, 23, 1.5, '#84858f', 0, 6.4, 0, { ns: true });
  box(g, 18, 1.5, 4.5, '#fff0b4', 0, 7.6, 0, { ns: true, e: 0x554422 });
  box(g, 4.5, 1.5, 18, '#fff0b4', 0, 7.6, 0, { ns: true, e: 0x554422 });
  return g;
}

// ---------- nemici ----------
const SKIN = {
  orco: { body: '#4a5a3a', skin: '#86b552', dark: '#2f3a26' },
  predone: { body: '#7a3f26', skin: '#c79a6b', dark: '#4a2415' },
  bruto: { body: '#5a4a4a', skin: '#9c7f7a', dark: '#352b2b' },
  capo: { body: '#3d4a2c', skin: '#6f9c42', dark: '#232b18' },
  campione: { body: '#2b2140', skin: '#5a4a78', dark: '#150f22' },
};
function makeEnemy(type) {
  const g = grp(null), s = ENEMIES[type].r / 15 * 1.3, inner = grp(g);   // un po' più grandi: si devono leggere bene dall'alto
  inner.scale.setScalar(s);
  const u = { inner, s, legs: [] };
  if (type === 'spettro') {
    const b = sph(inner, 11, '#cfeeff', 0, 24, 0, { a: 0.82, e: 0x224455 }); b.scale.y = 1.15;
    const t = cone(inner, 10.5, 20, '#a8dcf5', 0, 9, 0, { mat: { a: 0.7 } }); t.rotation.x = Math.PI;
    sph(inner, 2.2, '#1b3142', 9, 26, 4, { ns: true }); sph(inner, 2.2, '#1b3142', 9, 26, -4, { ns: true });
    u.ghost = true;
  } else {
    const k = SKIN[type];
    u.legs.push(sph(inner, 4.4, k.dark, 0, 4, 5.5, { ns: true }), sph(inner, 4.4, k.dark, 0, 4, -5.5, { ns: true }));
    const b = sph(inner, 10.5, k.body, 0, 15, 0); b.scale.y = 1.05;
    sph(inner, 8.6, k.skin, 2, 29, 0);
    const eye = type === 'campione' ? '#ff4a4a' : '#ffe066';
    sph(inner, 1.8, eye, 9.3, 30, 3.2, { basic: true, ns: true }); sph(inner, 1.8, eye, 9.3, 30, -3.2, { basic: true, ns: true });
    if (type !== 'predone') { cone(inner, 1.3, 4, '#ffffff', 9, 25.5, 3, { ns: true }); cone(inner, 1.3, 4, '#ffffff', 9, 25.5, -3, { ns: true }); }
    if (type === 'predone') { const h = cone(inner, 9.5, 13, '#8f2a22', 1, 37, 0, { ns: true }); h.rotation.z = 0.2; }
    if (type === 'bruto' || type === 'capo' || type === 'campione') {
      const h1 = cone(inner, 2.4, 11, '#efe9d8', 1, 38, 5.5, { ns: true }); h1.rotation.x = 0.5;
      const h2 = cone(inner, 2.4, 11, '#efe9d8', 1, 38, -5.5, { ns: true }); h2.rotation.x = -0.5;
      sph(inner, 5, '#6b6c76', 0, 22, 10, { ns: true }); sph(inner, 5, '#6b6c76', 0, 22, -10, { ns: true });
    }
    if (type === 'capo' || type === 'campione') { const c = box(inner, 2, 22, 18, type === 'capo' ? '#a8322a' : '#5b1f8a', -9, 15, 0, { ns: true }); c.rotation.z = -0.25; }
    const w = cyl(inner, 1.6, 1.6, 20, WOOD_D, 8, 20, 10, { ns: true }); w.rotation.z = -0.5;
    sph(inner, 4, type === 'campione' ? '#8a4fe0' : type === 'predone' ? '#cfd3dc' : '#7b5230', 13, 28, 10, { ns: true });
    if (type === 'campione') u.aura = sph(inner, 30, '#aa46ff', 0, 18, 0, { basic: true, a: 0.13, ns: true });
  }
  g.userData = u;
  return g;
}

// ---------- pezzi di scenario ----------
function makeHouse(roof, s = 1) {
  const g = grp(null);
  box(g, 44, 26, 36, CREAM, 0, 13, 0);
  box(g, 45, 3, 37, '#6b4a2b', 0, 14, 0, { ns: true });
  pyramid(g, 36, 24, roof, 0, 38, 0, 1, 0.86);
  box(g, 9, 14, 1.5, '#6b4226', 2, 7, 18.4, { ns: true });
  box(g, 7, 7, 1.5, '#ffd97a', -13, 16, 18.4, { ns: true, e: 0xffb040, ei: 0.7 });
  box(g, 7, 7, 1.5, '#ffd97a', 14, 16, 18.4, { ns: true, e: 0xffb040, ei: 0.7 });
  g.scale.setScalar(s);
  return g;
}
function makeKeep(s = 1) {
  const g = grp(null);
  box(g, 64, 78, 58, '#9a9ba4', 0, 39, 0);
  for (let i = 0; i < 4; i++) { box(g, 11, 10, 11, '#9a9ba4', -26 + i * 17.3, 83, 24, { ns: true }); box(g, 11, 10, 11, '#9a9ba4', -26 + i * 17.3, 83, -24, { ns: true }); }
  box(g, 16, 26, 2, '#4a3020', 0, 13, 29.5, { ns: true });
  box(g, 8, 12, 2, '#ffd97a', -18, 50, 29.5, { ns: true, e: 0xffb040, ei: 0.7 }); box(g, 8, 12, 2, '#ffd97a', 18, 50, 29.5, { ns: true, e: 0xffb040, ei: 0.7 });
  cyl(g, 1.4, 1.4, 44, '#4a3020', 0, 110, 0, { ns: true });
  box(g, 26, 14, 1, '#2f8f5b', 13, 124, 0, { ns: true });
  g.scale.setScalar(s);
  return g;
}

/** Bosco: tutti gli alberi in 3 sole chiamate di disegno (istanze). items: [{x,z,r,pal:[base,cima]}] */
function makeForest(items) {
  const g = grp(null), n = items.length;
  if (!n) return g;
  const trunk = new THREE.InstancedMesh(geom('ftrunk', () => new THREE.CylinderGeometry(0.16, 0.22, 1, 7)), M('#5b3b22'), n);
  const c1 = new THREE.InstancedMesh(geom('fcan', () => new THREE.SphereGeometry(1, 10, 8)), M('#ffffff'), n);
  const c2 = new THREE.InstancedMesh(geom('fcan', () => new THREE.SphereGeometry(1, 10, 8)), M('#ffffff'), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  items.forEach((t, i) => {
    const r = t.r;
    m.compose(new THREE.Vector3(t.x, r * 0.6, t.z), q, new THREE.Vector3(r, r * 1.3, r)); trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(t.x, r * 1.55, t.z), q, new THREE.Vector3(r, r * 0.95, r)); c1.setMatrixAt(i, m); c1.setColorAt(i, col.set(t.pal[0]));
    m.compose(new THREE.Vector3(t.x - r * 0.12, r * 2.15, t.z - r * 0.1), q, new THREE.Vector3(r * 0.68, r * 0.62, r * 0.68)); c2.setMatrixAt(i, m); c2.setColorAt(i, col.set(t.pal[1]));
  });
  for (const im of [trunk, c1, c2]) { im.castShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
  return g;
}
function makeRocks(items) {
  const g = grp(null);
  if (!items.length) return g;
  const im = new THREE.InstancedMesh(geom('rock', () => new THREE.DodecahedronGeometry(1)), M('#8d8f96', { flat: true }), items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach((r, i) => { q.setFromEuler(e.set(r.a, r.a * 2, 0)); m.compose(new THREE.Vector3(r.x, r.r * 0.45, r.z), q, new THREE.Vector3(r.r, r.r * 0.7, r.r)); im.setMatrixAt(i, m); });
  im.castShadow = true; g.add(im);
  return g;
}

// ---------- edifici del villaggio ----------
function makeBuilding(id, level) {
  const g = grp(null);
  if (level <= 0) {         // cantiere: fondamenta e cartello
    box(g, 70, 3, 56, '#c9b58a', 0, 1.5, 0, { ns: true });
    for (const [x, z] of [[-33, -26], [33, -26], [-33, 26], [33, 26]]) cyl(g, 2.2, 2.2, 16, WOOD_D, x, 8, z);
    box(g, 22, 12, 2, WOOD_L, 0, 22, 20); cyl(g, 1.6, 1.6, 22, WOOD_D, 0, 11, 20);
    g.userData = { site: true };
    return g;
  }
  const u = {};
  if (id === 'castello') {
    box(g, 96, 66, 72, '#a3a4b0', 0, 33, 0);
    for (let i = 0; i < 5; i++) box(g, 11, 9, 11, '#a3a4b0', -40 + i * 20, 70, 31, { ns: true });
    for (const [x, z] of [[-50, -36], [50, -36], [-50, 36], [50, 36]]) { cyl(g, 16, 18, 88, '#b2b3be', x, 44, z); cone(g, 20, 30, '#2f8f5b', x, 103, z); if (level >= 3) sph(g, 3.5, GOLDC, x, 120, z, { ns: true }); }
    box(g, 22, 34, 2, '#4a3020', 0, 17, 37, { ns: true });
    for (const x of [-26, 26]) box(g, 9, 13, 2, '#ffd97a', x, 44, 37, { ns: true, e: 0xffb040, ei: 0.7 });
    if (level >= 2) { box(g, 40, 30, 40, '#b2b3be', 0, 81, -6); pyramid(g, 32, 26, '#2f8f5b', 0, 109, -6); }
    cyl(g, 1.6, 1.6, 50, '#4a3020', 0, level >= 2 ? 140 : 96, -6, { ns: true });
    box(g, 28, 15, 1, level >= 5 ? GOLDC : '#2f8f5b', 14, level >= 2 ? 156 : 112, -6, { ns: true });
  } else if (id === 'fucina') {
    box(g, 62, 32, 50, '#8f8f98', 0, 16, 0);
    pyramid(g, 46, 24, '#5a4038', 0, 44, 0, 1, 0.84);
    box(g, 13, 46, 13, '#6f6f78', 20, 40, -12);
    u.ember = sph(g, 6, '#ff8a2a', 20, 65, -12, { e: 0xff5a00, ei: 1, ns: true });
    box(g, 16, 8, 9, '#3a3a42', -12, 4, 34); box(g, 10, 5, 7, '#3a3a42', -12, 10, 34, { ns: true });
    box(g, 12, 16, 2, '#ff9d3a', 0, 9, 25.6, { ns: true, e: 0xff6a00, ei: 0.9 });
  } else if (id === 'santuario') {
    cyl(g, 38, 40, 8, '#e4e0ee', 0, 4, 0);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; cyl(g, 3.6, 3.6, 34, '#f1eef8', Math.cos(a) * 28, 25, Math.sin(a) * 28); }
    cyl(g, 34, 34, 5, '#e4e0ee', 0, 44.5, 0);
    const d = sph(g, 30, '#8a5fd6', 0, 47, 0); d.scale.y = 0.62;
    u.crystal = octa(g, 9, '#c9a2ff', 0, 80, 0, { e: 0x7a3fe0, ei: 1, flat: true }); u.crystal.scale.y = 1.6;
    u.baseY = 80;
  } else if (id === 'mercato') {
    for (const [x, c1] of [[-24, '#c2452d'], [24, '#2f7fb8']]) {
      box(g, 36, 12, 22, WOOD, x, 6, 0);
      for (const [px, pz] of [[-16, -10], [16, -10], [-16, 10], [16, 10]]) cyl(g, 1.4, 1.4, 30, WOOD_D, x + px, 15, pz, { ns: true });
      for (let i = 0; i < 4; i++) { const a = box(g, 10, 2.5, 30, i % 2 ? '#f5ecd7' : c1, x - 15 + i * 10, 31, 0); a.rotation.x = 0.12; }
      sph(g, 4, '#e0452f', x - 8, 15, 2, { ns: true }); sph(g, 4, '#f1c232', x + 2, 15, -3, { ns: true }); sph(g, 4, '#6fd45a', x + 10, 15, 3, { ns: true });
    }
    box(g, 14, 12, 14, WOOD_L, 0, 6, 26);
  } else if (id === 'vedetta') {
    cyl(g, 12, 16, 84, WOOD, 0, 42, 0);
    cyl(g, 22, 20, 5, WOOD_L, 0, 86, 0);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; cyl(g, 1.4, 1.4, 16, WOOD_D, Math.cos(a) * 19, 96, Math.sin(a) * 19, { ns: true }); }
    cone(g, 26, 22, '#b5482f', 0, 115, 0);
    box(g, 6, 9, 2, '#ffd97a', 0, 60, 13.5, { ns: true, e: 0xffb040, ei: 0.7 });
  } else if (id === 'mura') {
    box(g, 120, 34, 16, '#9a9ba4', 0, 17, 0);
    for (let i = 0; i < 7; i++) box(g, 9, 8, 16, '#9a9ba4', -54 + i * 18, 38, 0, { ns: true });
    box(g, 22, 26, 17, '#4a3020', 0, 13, 0, { ns: true });
    for (const x of [-68, 68]) { cyl(g, 14, 15, 52, '#b2b3be', x, 26, 0); cone(g, 18, 22, '#b5482f', x, 63, 0); }
  } else if (id === 'mulino') {
    cyl(g, 15, 24, 64, CREAM, 0, 32, 0);
    cone(g, 20, 22, '#8a5a33', 0, 75, 0);
    box(g, 9, 14, 2, '#6b4226', 0, 7, 23.5, { ns: true });
    u.blades = grp(g, 0, 58, 22);
    cyl(u.blades, 3, 3, 6, WOOD_D, 0, 0, 0, { ns: true }).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const b = grp(u.blades); b.rotation.z = i * Math.PI / 2; box(b, 7, 44, 1.5, '#f5ecd7', 0, 24, 2); box(b, 1.6, 48, 2, WOOD_D, 0, 24, 1, { ns: true }); }
  } else {  // campi: il fienile
    box(g, 58, 34, 46, '#a8322a', 0, 17, 0);
    pyramid(g, 46, 26, '#5a4038', 0, 47, 0, 1, 0.8);
    box(g, 20, 24, 2, '#f5ecd7', 0, 12, 23.4, { ns: true }); box(g, 15, 20, 2.4, '#7a2520', 0, 11, 23.6, { ns: true });
    cyl(g, 9, 9, 12, '#e3c66a', 44, 6, 12).rotation.z = Math.PI / 2; cyl(g, 9, 9, 12, '#e3c66a', 44, 6, -12).rotation.z = Math.PI / 2;
  }
  g.scale.setScalar(0.82 + level * 0.06);
  g.userData = u;
  return g;
}

const CROP_COL = { grano: ['#b9c24a', '#e8c64a'], carote: ['#4f9a4b', '#f08a2a'], zucche: ['#4f9a4b', '#f0822a'], uva: ['#4f9a4b', '#7a3fb0'] };
function makePlot(state) {
  const g = grp(null);
  if (state.locked) {
    box(g, 88, 4, 70, '#8b8b83', 0, 2, 0, { ns: true });
    const a = box(g, 96, 3, 8, WOOD_D, 0, 6, 0, { ns: true }); a.rotation.y = 0.65;
    const b = box(g, 96, 3, 8, WOOD_D, 0, 6, 0, { ns: true }); b.rotation.y = -0.65;
    return g;
  }
  box(g, 92, 5, 74, '#6f4a2a', 0, 2.5, 0, { ns: true });
  box(g, 84, 2, 66, '#8a5f38', 0, 5.6, 0, { ns: true });
  for (let i = 0; i < 3; i++) box(g, 80, 1.6, 6, '#6a4526', 0, 6.6, -22 + i * 22, { ns: true });
  if (!state.crop) return g;
  const ph = state.ripe ? 3 : Math.min(2, Math.floor(state.progress * 3)), sc = 0.45 + ph * 0.19, col = CROP_COL[state.crop];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
    const x = -30 + k * 20, z = -22 + r * 22;
    if (state.crop === 'grano') { const c = cone(g, 4 * sc, 26 * sc, ph === 3 ? col[1] : col[0], x, 6 + 13 * sc, z); c.castShadow = ph >= 2; }
    else if (state.crop === 'carote') { cone(g, 6 * sc, 14 * sc, col[0], x, 6 + 7 * sc, z, { ns: true }); if (ph === 3) sph(g, 3, col[1], x, 7.5, z + 4, { ns: true }); }
    else if (state.crop === 'zucche') { const l = sph(g, 7 * sc, col[0], x, 7, z, { ns: true }); l.scale.y = 0.4; if (ph >= 2) { const p = sph(g, (ph === 3 ? 7.5 : 4.5), col[1], x + 3, ph === 3 ? 11 : 9, z + 2); p.scale.y = 0.8; } }
    else { cyl(g, 1.2, 1.2, 24 * sc, WOOD_D, x, 6 + 12 * sc, z, { ns: true }); sph(g, 7 * sc, col[0], x, 6 + 22 * sc, z); if (ph === 3) { sph(g, 3, col[1], x + 4, 6 + 16 * sc, z + 3, { ns: true }); sph(g, 3, col[1], x - 3, 6 + 18 * sc, z + 4, { ns: true }); } }
  }
  return g;
}

// ---------- la scena ----------
export class Scene3D {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cam = new THREE.PerspectiveCamera(30, 1, 60, 7000);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector2();
    this.w = 1; this.h = 1;
    this.scene = null; this.mode = null; this.tex = null;
    this.bounds = { x0: 150, x1: 1450, z0: 20, z1: 700 };
    this.pads = { top: 0.17, bottom: 0.03 };
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h;
    this.r.setPixelRatio(dpr); this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.fit();
  }

  /** Avvicina la camera il più possibile tenendo tutto il campo dentro lo schermo (sotto la barra in alto). */
  fit() {
    const b = this.bounds, cam = this.cam, pitch = 57 * Math.PI / 180;
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const target = new THREE.Vector3((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
    const pts = [[b.x0, 0, b.z0], [b.x1, 0, b.z0], [b.x0, 0, b.z1], [b.x1, 0, b.z1], [b.x0, 90, b.z0], [b.x1, 90, b.z0]];
    const yMax = 1 - this.pads.top * 2, yMin = -1 + this.pads.bottom * 2;
    const place = (d) => { cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateMatrixWorld(); };
    const range = () => { let lo = 9, hi = -9, mx = 0; for (const p of pts) { this.v.set(p[0], p[1], p[2]).project(cam); lo = Math.min(lo, this.v.y); hi = Math.max(hi, this.v.y); mx = Math.max(mx, Math.abs(this.v.x)); } return { lo, hi, mx }; };
    let d = 2000;
    for (let pass = 0; pass < 4; pass++) {
      let a = 200, z = 7000;
      for (let i = 0; i < 26; i++) { d = (a + z) / 2; place(d); const r = range(); if (r.mx <= 0.985 && r.hi - r.lo <= yMax - yMin) z = d; else a = d; }
      d = z; place(d);
      const r = range(), shift = (yMax + yMin) / 2 - (r.hi + r.lo) / 2;      // centra in verticale nella fascia libera
      target.z += shift * d * Math.tan(cam.fov * Math.PI / 360) / Math.sin(pitch);
    }
    place(d);
    this.target = target;
  }

  /** Da coordinate di gioco a pixel CSS dello schermo. */
  project(x, y, h = 0) { this.v.set(x, h, y).project(this.cam); return { x: (this.v.x + 1) / 2 * this.w, y: (1 - this.v.y) / 2 * this.h }; }
  /** Pixel CSS per unità di mondo in quel punto (per dimensionare gli effetti 2D). */
  scaleAt(x, y) { const a = this.project(x - 20, y), b = this.project(x + 20, y); return (b.x - a.x) / 40; }
  /** Dal tocco al punto sul terreno. */
  pick(cx, cy) {
    this.v2.set(cx / this.w * 2 - 1, -(cy / this.h) * 2 + 1);
    this.ray.setFromCamera(this.v2, this.cam);
    const hit = this.ray.ray.intersectPlane(this.plane, this.v);
    return hit ? { x: hit.x, y: hit.z } : null;
  }

  _base(grass, canvas) {
    if (this.tex) this.tex.dispose();
    const s = new THREE.Scene();
    const gc = new THREE.Color(grass);
    s.background = gc.clone().multiplyScalar(0.8);
    s.fog = new THREE.Fog(s.background, 2600, 5200);
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a9a70, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1d8, 1.75);
    sun.position.set(800 - 520, 1000, 360 - 330); sun.target.position.set(800, 0, 360);
    sun.castShadow = this.shadowsOn !== false; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -1150; sc.right = 1150; sc.top = 760; sc.bottom = -760; sc.near = 100; sc.far = 2600;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
    s.add(sun, sun.target);
    this.sun = sun; this.hemi = s.children[0];
    const big = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), M(grass));
    big.rotation.x = -Math.PI / 2; big.position.set(800, -0.6, 360); big.receiveShadow = true; s.add(big);
    this.tex = new THREE.CanvasTexture(canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), new THREE.MeshLambertMaterial({ map: this.tex }));
    map.rotation.x = -Math.PI / 2; map.position.set(WORLD_W / 2, 0, WORLD_H / 2); map.receiveShadow = true; s.add(map);
    this.scene = s;
    return s;
  }

  // ---------- battaglia ----------
  showBattle(L) {
    const th = THEMES[L.theme], cv = document.createElement('canvas');
    const ponds = paintBattle(cv, L, 1.5);
    const s = this._base(th.grass, cv);
    this.mode = 'battle'; this.level = L;
    this.bounds = { x0: 150, x1: 1450, z0: 20, z1: 700 }; this.pads = { top: 0.17, bottom: 0.03 };
    const rnd = mulberry32(21 + L.id * 7);
    const pal = () => th.trees[Math.floor(rnd() * th.trees.length)];
    const dead = ['#3b3046', '#5a4a66'];

    // alberi dentro la mappa (lontani da sentiero, piazzole, stagni) e bosco attorno
    const trees = [], rocks = [];
    const free = (x, y, m) => x < WALL_X - 46 && L.dist(x, y) >= 60 + m && !L.spots.some(p => Math.hypot(p.x - x, p.y - y) < 58 + m) && !ponds.some(p => Math.hypot(p.x - x, p.y - y) < p.r + 14);
    let tries = 0; const want = th.dense ? 95 : 62;
    while (trees.length < want && tries++ < 5000) {
      const x = rnd() * (WALL_X - 30), y = rnd() * WORLD_H, edge = Math.min(x, y, WORLD_H - y);
      if (edge > 130 && rnd() < (th.dense ? 0.55 : 0.78)) continue;
      if (!free(x, y, 8) || trees.some(t => Math.hypot(t.x - x, t.z - y) < 30)) continue;
      trees.push({ x, z: y, r: 16 + rnd() * 10, pal: Math.hypot(x - L.portal.x, y - L.portal.y) < 170 ? dead : pal() });
    }
    for (let i = 0; i < 260; i++) {
      const x = -900 + rnd() * 3400, z = -700 + rnd() * 2200;
      if (x > -40 && x < WORLD_W + 40 && z > -40 && z < WORLD_H + 40) continue;
      trees.push({ x, z, r: 20 + rnd() * 16, pal: pal() });
    }
    tries = 0;
    while (rocks.length < 24 && tries++ < 800) { const x = rnd() * (WALL_X - 40), y = 30 + rnd() * (WORLD_H - 50); if (free(x, y, -8)) rocks.push({ x, z: y, r: 6 + rnd() * 9, a: rnd() * 3 }); }
    s.add(makeForest(trees), makeRocks(rocks));

    // borgo: palizzata, cancello, case, mastio
    const gy = L.gate.y, pal2 = [];
    for (let y = -40; y < WORLD_H + 50; y += 15) if (y < gy - 46 || y > gy + 46) pal2.push(y);
    const logs = new THREE.InstancedMesh(geom('log', () => new THREE.CylinderGeometry(8, 8.5, 40, 8)), M('#8a5a33'), pal2.length);
    const tips = new THREE.InstancedMesh(geom('logtip', () => new THREE.ConeGeometry(8, 12, 8)), M('#b98954'), pal2.length);
    const m4 = new THREE.Matrix4();
    pal2.forEach((y, i) => { const x = WALL_X + Math.sin(y * 0.11) * 2; m4.makeTranslation(x, 20, y); logs.setMatrixAt(i, m4); m4.makeTranslation(x, 46, y); tips.setMatrixAt(i, m4); });
    logs.castShadow = true; tips.castShadow = true; s.add(logs, tips);
    for (const y of [gy - 56, gy + 56]) { const t = grp(s, WALL_X, 0, y); box(t, 34, 64, 34, '#9a9ba4', 0, 32, 0); pyramid(t, 30, 26, '#b5482f', 0, 77, 0); box(t, 2, 12, 9, '#ffd97a', -17.5, 44, 0, { ns: true, e: 0xffb040, ei: 0.8 }); }
    const roofs = ['#b5482f', '#a8552d', '#9c4a2a'];
    const hs = [[1395, 110], [1408, 230], [1400, 455], [1392, 570], [1408, 675], [1490, 175], [1500, 430], [1486, 555], [1575, 105], [1570, 620], [1478, 55], [1660, 250], [1670, 480], [1760, 150], [1750, 600]];
    hs.forEach((h, i) => { if (Math.abs(h[1] - gy) < 62 && h[0] < 1440) return; const g = makeHouse(roofs[i % 3], 1.15); g.position.set(h[0], 0, h[1]); g.rotation.y = -0.25 + (i % 3) * 0.2; s.add(g); });
    const keep = makeKeep(1.2); keep.position.set(1570, 0, gy + (gy > 360 ? -150 : 150)); s.add(keep);

    // portale: arco di pietra con il vortice dell'Èrebo
    const p0 = L.path[0], p1 = L.path[8], pa = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const portal = grp(s, L.portal.x, 0, L.portal.y); portal.rotation.y = -pa;
    for (const z of [-34, 34]) { box(portal, 16, 76, 16, '#4d4458', 0, 38, z); cone(portal, 9, 16, '#3a3246', 0, 84, z, { seg: 4 }); }
    box(portal, 18, 12, 86, '#4d4458', 0, 80, 0);
    const disc = put(portal, geom('pdisc', () => new THREE.CircleGeometry(30, 28)), M('#7a35d6', { basic: true, a: 0.85, double: true }), 0, 40, 0, false); disc.rotation.y = Math.PI / 2; disc.scale.y = 1.2;
    this.swirl = grp(portal, 1.5, 40, 0);
    for (let i = 0; i < 3; i++) { const t = put(this.swirl, geom('pring' + i, () => new THREE.TorusGeometry(9 + i * 8, 1.6, 6, 22, 4.2)), M('#ecd9ff', { basic: true, a: 0.75 - i * 0.15 }), 0, 0, 0, false); t.rotation.y = Math.PI / 2; t.userData.sp = 1.6 + i * 0.6; }
    for (let i = 0; i < 5; i++) { const a = 1.3 + i * 0.9; const st = box(s, 12, 22 + (i % 2) * 10, 11, '#4d4458', L.portal.x + Math.cos(a) * 70 - 14, 12, L.portal.y + Math.sin(a) * 52); st.rotation.y = a; }

    // piazzole
    this.spots = L.spots.map(sp => { const g = makeSpot(); g.position.set(sp.x, 0, sp.y); s.add(g); return g; });
    this.towers = new Map(); this.enemies = new Map(); this.projs = new Map();
    this.fit();
  }

  syncBattle(game, time) {
    const s = this.scene;
    for (let i = 0; i < this.spots.length; i++) this.spots[i].visible = !game.spotTower[i];

    // torri
    const seen = new Set();
    for (const t of game.towers) {
      seen.add(t.id);
      let g = this.towers.get(t.id);
      if (!g || g.userData.level !== t.level) { if (g) s.remove(g); g = makeTower(t.type, t.level); g.position.set(t.x, 0, t.y); s.add(g); this.towers.set(t.id, g); }
      const u = g.userData, f = Math.max(0, t.fireAnim);
      if (u.turret) u.turret.rotation.y = -t.angle;
      if (u.bolt) u.bolt.visible = f <= 0;
      if (u.crystal) { u.crystal.position.y = u.baseY + Math.sin(time * 2.4 + t.x) * 3; u.crystal.rotation.y = time * 0.9; u.halo.position.y = u.crystal.position.y; u.halo.scale.setScalar(1 + (f > 0 ? 0.5 : 0) + Math.sin(time * 3) * 0.05); u.orbit.position.y = u.crystal.position.y; u.orbit.rotation.y = time * 2; }
      if (u.arm) { const k = f / 0.45; u.arm.rotation.z = 0.25 - 2.45 * Math.sin(k * Math.PI); u.rock.visible = f <= 0; }
      if (u.flames) { const b = t.burning ? 1.4 : 1; u.flames.forEach((fm, i) => { const k = b * (0.85 + Math.sin(time * 11 + i * 2.1) * 0.18); fm.scale.set(1, k, 1); fm.position.y = 38 + fm.userData.h * k / 2; }); u.halo.scale.setScalar(b + Math.sin(time * 7) * 0.06); }
      if (u.vines) { const k = f / 0.5; u.vines.forEach((v, i) => { v.rotation.z = Math.sin(time * 1.6 + i * 1.7) * 0.08 + k * 0.22; }); u.bud.scale.setScalar(1 + k * 0.5); u.halo.scale.setScalar(1 + k * 1.6); }
    }
    for (const [id, g] of this.towers) if (!seen.has(id)) { s.remove(g); this.towers.delete(id); }

    // nemici
    seen.clear();
    for (const e of game.enemies) {
      seen.add(e.id);
      let g = this.enemies.get(e.id);
      if (!g) { g = makeEnemy(e.type); s.add(g); this.enemies.set(e.id, g); }
      const u = g.userData, w = Math.sin(e.anim * Math.PI * 2);
      g.position.set(e.x, 0, e.y); g.rotation.y = -e.ang;
      const pop = u.s * (1 + Math.max(0, e.hit) * 1.6);
      u.inner.scale.setScalar(pop);
      if (u.ghost) { u.inner.position.y = 6 + Math.sin(time * 3 + e.anim) * 3; }
      else { u.inner.position.y = Math.abs(w) * 2.4 * u.s; u.inner.rotation.x = w * 0.09; u.legs[0].position.x = w * 4; u.legs[1].position.x = -w * 4; }
      if (u.aura) u.aura.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
    }
    for (const [id, g] of this.enemies) if (!seen.has(id)) { s.remove(g); this.enemies.delete(id); }

    // proiettili
    const live = new Set(game.projs);
    for (const p of game.projs) {
      let g = this.projs.get(p);
      if (!g) {
        g = grp(s);
        if (p.k === 'arrow') { const a = cyl(g, 1.1, 1.1, 22, '#e9dcb6', 0, 0, 0, { ns: true }); a.rotation.z = Math.PI / 2; const h = cone(g, 2.6, 7, '#d5d9e2', 13, 0, 0, { ns: true }); h.rotation.z = -Math.PI / 2; }
        else if (p.k === 'orb') { sph(g, 6.5, '#f6e9ff', 0, 0, 0, { basic: true, ns: true }); sph(g, 13, '#b98cff', 0, 0, 0, { basic: true, a: 0.4, ns: true }); }
        else { put(g, geom('rock', () => new THREE.DodecahedronGeometry(1)), M('#8d8f96', { flat: true }), 0, 0, 0).scale.setScalar(8); }
        this.projs.set(p, g);
      }
      g.position.set(p.x, p.h || 20, p.y);
      if (p.k === 'arrow') g.rotation.y = -p.ang; else if (p.k === 'boulder') g.rotation.x = time * 6;
    }
    for (const [p, g] of this.projs) if (!live.has(p)) { s.remove(g); this.projs.delete(p); }

    if (this.swirl) for (const t of this.swirl.children) t.rotation.x = time * t.userData.sp;
  }

  /** Ombre accese o spente (si spengono da sole se il telefono fatica). */
  setShadows(on) { this.shadowsOn = on; if (this.sun) this.sun.castShadow = on; }

  /** Di notte la luce si fa fredda e bassa (il velo scuro con le luci lo disegna l'interfaccia sopra). */
  setNight(n) {
    if (!this.sun) return;
    this.sun.intensity = 1.75 - n * 0.75;
    this.sun.color.setRGB(1 - n * 0.3, 0.945 - n * 0.2, 0.85 + n * 0.1);
    this.hemi.intensity = 1.25 - n * 0.3;
  }

  // ---------- villaggio ----------
  showVillage() {
    const cv = document.createElement('canvas');
    paintVillage(cv, 1.5);
    const s = this._base(THEMES.borgo.grass, cv);
    this.mode = 'village';
    this.bounds = VILLAGE.bounds; this.pads = { top: 0.15, bottom: 0.04 };
    const rnd = mulberry32(5), th = THEMES.borgo, V = VILLAGE;
    const pal = () => th.trees[Math.floor(rnd() * th.trees.length)];
    const near = (x, y, d) => Object.values(V.slots).some(p => Math.hypot(p.x - x, p.y - y) < d) || V.plots.some(p => Math.hypot(p.x - x, p.y - y) < d - 20) || Math.hypot(x - V.center.x, (y - V.center.y) * 1.4) < 170 || Math.hypot(x - 1150, y - 610) < 100;
    const trees = [], rocks = [];
    let tries = 0;
    while (trees.length < 46 && tries++ < 4000) {
      const x = 30 + rnd() * 1540, y = 20 + rnd() * 690;
      if (near(x, y, 120) || (Math.abs(x - V.center.x) < 44 && y > V.center.y) || trees.some(t => Math.hypot(t.x - x, t.z - y) < 40)) continue;
      trees.push({ x, z: y, r: 17 + rnd() * 10, pal: pal() });
    }
    for (let i = 0; i < 260; i++) { const x = -900 + rnd() * 3400, z = -700 + rnd() * 2200; if (x > -40 && x < WORLD_W + 40 && z > -40 && z < WORLD_H + 40) continue; trees.push({ x, z, r: 20 + rnd() * 16, pal: pal() }); }
    for (let i = 0; i < 14; i++) { const x = 60 + rnd() * 1480, y = 40 + rnd() * 650; if (!near(x, y, 100)) rocks.push({ x, z: y, r: 6 + rnd() * 7, a: rnd() * 3 }); }
    s.add(makeForest(trees), makeRocks(rocks));
    // pozzo in piazza
    const well = grp(s, V.center.x, 0, V.center.y);
    cyl(well, 20, 22, 16, '#a3a4b0', 0, 8, 0); cyl(well, 16, 16, 2, '#4f9fc4', 0, 16.5, 0, { ns: true });
    for (const x of [-18, 18]) cyl(well, 1.8, 1.8, 34, WOOD_D, x, 25, 0); pyramid(well, 28, 14, '#b5482f', 0, 48, 0);
    // staccionata attorno ai campi
    const fx0 = 240, fx1 = 470, fz0 = 420, fz1 = 708;
    for (let x = fx0; x <= fx1; x += 23) { cyl(s, 1.8, 1.8, 14, WOOD_D, x, 7, fz0, { ns: true }); }
    for (let z = fz0; z <= fz1; z += 24) { cyl(s, 1.8, 1.8, 14, WOOD_D, fx0, 7, z, { ns: true }); cyl(s, 1.8, 1.8, 14, WOOD_D, fx1, 7, z, { ns: true }); }
    box(s, fx1 - fx0, 2, 2, WOOD_L, (fx0 + fx1) / 2, 11, fz0, { ns: true }); box(s, 2, 2, fz1 - fz0, WOOD_L, fx0, 11, (fz0 + fz1) / 2, { ns: true }); box(s, 2, 2, fz1 - fz0, WOOD_L, fx1, 11, (fz0 + fz1) / 2, { ns: true });
    // abitanti (i Chlòri): vanno e vengono fra la piazza e gli edifici
    this.folk = [];
    const robes = ['#3f8f5b', '#b5482f', '#c9a23a', '#5b6fb5', '#8a5fd6', '#2f7d6b', '#c26a8a'];
    const stops = Object.values(V.slots).map(p => ({ x: p.x, y: p.y + 60 })).concat([{ x: 355, y: 520 }, { x: V.center.x, y: 690 }, { x: 1150, y: 540 }]);
    for (let i = 0; i < 7; i++) {
      const g = grp(s); cone(g, 6.5, 17, robes[i % robes.length], 0, 8.5, 0); sph(g, 4.6, '#a9dd8f', 0, 20, 0); cone(g, 5.6, 5, '#6b4a2b', 0, 25.5, 0, { ns: true });
      const a = stops[Math.floor(rnd() * stops.length)];
      this.folk.push({ g, x: a.x, y: a.y, path: [], sp: 22 + rnd() * 14, wait: rnd() * 3, ph: rnd() * 6 });
    }
    this.stops = stops; this._vt = 0;
    this.bMesh = {}; this.bKey = {}; this.pMesh = []; this.pKey = [];
    this.fit();
  }

  syncVillage(meta, now, time) {
    const s = this.scene, V = VILLAGE, dt = Math.max(0, Math.min(0.1, time - this._vt));
    this._vt = time;
    for (const f of this.folk) {
      if (f.wait > 0) f.wait -= dt;
      else if (!f.path.length) { const to = this.stops[Math.floor(Math.random() * this.stops.length)]; f.path = [{ x: V.center.x + (Math.random() - 0.5) * 150, y: V.center.y + (Math.random() - 0.5) * 100 }, to]; }
      else {
        const to = f.path[0], dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy), st = f.sp * dt;
        if (d <= st + 1) { f.x = to.x; f.y = to.y; f.path.shift(); if (!f.path.length) f.wait = 1 + Math.random() * 5; }
        else { f.x += dx / d * st; f.y += dy / d * st; f.g.rotation.y = -Math.atan2(dy, dx); }
      }
      f.g.position.set(f.x, f.wait > 0 ? 0 : Math.abs(Math.sin(time * 9 + f.ph)) * 1.6, f.y);
    }
    for (const id of BUILDING_ORDER) {
      const l = meta.lvl(id);
      if (this.bKey[id] !== l) {
        if (this.bMesh[id]) s.remove(this.bMesh[id]);
        const g = makeBuilding(id, l); g.position.set(V.slots[id].x, 0, V.slots[id].y); s.add(g);
        g.userData.base = g.scale.x; g.userData.pop = this.bKey[id] === undefined ? 1 : 0;   // appena costruito: spunta con un rimbalzo
        this.bMesh[id] = g; this.bKey[id] = l;
      }
      const u = this.bMesh[id].userData;
      if (u.pop < 1) { u.pop = Math.min(1, u.pop + dt * 2.2); const k = u.pop - 1; this.bMesh[id].scale.setScalar(u.base * (0.35 + 0.65 * (1 + 2.7 * k * k * k + 1.7 * k * k))); }
      if (u.blades) u.blades.rotation.z = time * 0.9;
      if (u.crystal) { u.crystal.position.y = u.baseY + Math.sin(time * 2) * 3; u.crystal.rotation.y = time; }
      if (u.ember) u.ember.scale.setScalar(1 + Math.sin(time * 7) * 0.15);
    }
    for (let i = 0; i < PLOTS; i++) {
      const st = meta.plot(i, now);
      const key = st.locked ? 'L' : st.empty ? 'E' : st.crop + (st.ripe ? 3 : Math.min(2, Math.floor(st.progress * 3)));
      if (this.pKey[i] !== key) {
        if (this.pMesh[i]) s.remove(this.pMesh[i]);
        const g = makePlot(st); g.position.set(V.plots[i].x, 0, V.plots[i].y); s.add(g);
        this.pMesh[i] = g; this.pKey[i] = key;
      }
    }
  }

  render() { if (this.scene) this.r.render(this.scene, this.cam); }
}

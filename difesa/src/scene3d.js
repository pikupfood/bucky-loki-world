// Mondo in 3D visto dall'alto (three.js): una sola mappa a quadretti, camera che si sposta e si avvicina.
// Tutti gli abitanti sono Tuzu: la forma è quella del logo, cambia solo il colore del popolo.
// Le coordinate di gioco (x, y) diventano (x, altezza, z = y). L'interfaccia resta in 2D sopra e usa project()/pick().
import * as THREE from '../vendor/three.module.min.js';
import { G, COLS, ROWS, WORLD_W, WORLD_H, CASTLE, TRIBES, MY_COLOR, ENEMIES, NATURE, mulberry32 } from './data.js';
import { GRASS, TREE_PAL, DEAD_PAL, paintWorld } from './ground.js';

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
/** I pezzi che la scena muove (li tiene in userData): non vanno fusi. */
function movers(g) { const out = []; for (const k in g.userData) { const v = g.userData[k]; if (Array.isArray(v)) { for (const o of v) if (o && o.isObject3D) out.push(o); } else if (v && v.isObject3D) out.push(v); } return out; }

// ---------- i Tuzu ----------
// La sagoma del logo (viewBox 150, metà destra del tracciato) fatta girare attorno all'asse: alta 1, larga 0,98.
function blobGeo() {
  const pts = [], bz = (a, b, c, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(bz(0, 35, 61, 61, t) / 124, bz(0, 0, 20, 56, t) / 124)); }
  for (let i = 1; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(bz(61, 61, 37, 0, t) / 124, bz(56, 96, 124, 124, t) / 124)); }
  return new THREE.LatheGeometry(pts, 18);
}
function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), ind = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    if (g.index) { const a = g.index.array; for (let k = 0; k < a.length; k++) ind[io + k] = a[k] + vo; io += a.length; }
    else { for (let k = 0; k < n; k++) ind[io + k] = vo + k; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(new THREE.BufferAttribute(ind, 1));
  return out;
}
/** Fonde le maglie ferme di un modello: una sola per materiale (e per ombra sì/no). Così un edificio costa poche
 *  chiamate di disegno invece di venti. keep = i pezzi che si muovono, da lasciare come sono. */
function bake(root, keep = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map(), gone = [], m4 = new THREE.Matrix4();
  const live = (o) => { for (let p = o; p && p !== root; p = p.parent) if (keep.includes(p)) return true; return false; };
  root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || live(m)) return;
    const key = m.material.uuid + (m.castShadow ? 's' : 'n');
    let b = buckets.get(key);
    if (!b) { b = { mat: m.material, shadow: m.castShadow, geos: [] }; buckets.set(key, b); }
    const g = m.geometry.clone(); g.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld)); b.geos.push(g); gone.push(m);
  });
  for (const m of gone) m.parent.remove(m);
  for (const b of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeos(b.geos), b.mat);
    mesh.castShadow = b.shadow; mesh.userData.baked = true; root.add(mesh);
    for (const g of b.geos) g.dispose();
  }
  return root;
}
/** Toglie un modello dalla scena e libera le maglie fuse. */
function drop(scene, g) { scene.remove(g); g.traverse((m) => { if (m.userData.baked) m.geometry.dispose(); }); }

// Il viso guarda un po' in su (la camera sta in alto): si gira attorno al centro del corpo e si spinge in fuori.
function tiltFace(g) { g.translate(0, -0.45, 0); g.rotateZ(0.5); g.scale(1.09, 1.09, 1.09); g.translate(0, 0.45, 0); return g; }
/** Verso dove guarda un Tuzu che si muove nella direzione ang: sempre verso la camera, girato un po' dalla parte in cui va. */
const facing = (ang) => Math.PI / 2 - Math.cos(ang) * 0.8;
// Il viso del logo: due occhi tondi e il sorriso, sul davanti (+x).
function faceGeo() {
  const eye = (z) => { const g = new THREE.SphereGeometry(0.066, 10, 8); g.scale(0.45, 1, 1); g.translate(0.452, 0.45, z); return g; };
  const smile = new THREE.TorusGeometry(0.11, 0.021, 6, 12, 2.3);
  smile.rotateZ(Math.PI + (Math.PI - 2.3) / 2); smile.rotateY(Math.PI / 2); smile.translate(0.45, 0.35, 0);
  return tiltFace(mergeGeos([eye(0.153), eye(-0.153), smile]));
}
function shineGeo() {
  const dot = (z) => { const g = new THREE.SphereGeometry(0.022, 6, 5); g.translate(0.484, 0.47, z); return g; };
  return tiltFace(mergeGeos([dot(0.133), dot(-0.173)]));
}
const BLOB_CAP = 360;
/** Quanto è alto un Tuzu, per tipo. */
const TUZU_H = { lancia: 32, arco: 30, corazza: 38, villager: 25 };
for (const k in ENEMIES) TUZU_H[k] = ENEMIES[k].r * 2.5;

const IRON = '#aeb4c2', IRON_D = '#6f7684';
/** Quello che un Tuzu porta addosso: è l'unica cosa che distingue un tipo dall'altro. Misure per un Tuzu alto 1. */
function makeGear(kind) {
  const g = grp(null), u = {};
  const arm = u.arm = grp(g, 0.12, 0.42, 0.5);       // il braccio con l'arma: ruota quando colpisce
  const crown = (r, y, col) => { cyl(g, r, r * 0.92, 0.1, col, 0, y, 0, { ns: true }); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; cone(g, 0.045, 0.13, col, Math.cos(a) * r * 0.86, y + 0.11, Math.sin(a) * r * 0.86, { ns: true, seg: 5 }); } };
  const cap = (r, y, col, sy = 0.62) => { const h = sph(g, r, col, 0, y, 0, { ns: true }); h.scale.y = sy; return h; };
  const club = (len, head, col) => { const w = cyl(arm, 0.035, 0.035, len, WOOD_D, 0.1, len * 0.4, 0, { ns: true }); w.rotation.z = -0.5; sph(arm, head, col, 0.1 + len * 0.42, len * 0.76, 0, { ns: true }); };
  if (kind === 'orco') club(0.5, 0.11, '#7b5230');
  else if (kind === 'predone') {
    const b = put(g, geom('band', () => new THREE.TorusGeometry(0.335, 0.035, 6, 16)), M('#f4f1ea'), 0, 0.88, 0, false); b.rotation.x = Math.PI / 2;
    const f1 = cone(g, 0.05, 0.3, '#f4f1ea', -0.2, 1.06, 0.12, { ns: true, seg: 5 }); f1.rotation.z = 0.5;
    const d = box(arm, 0.3, 0.04, 0.025, '#d5d9e2', 0.2, 0.08, 0, { ns: true }); d.rotation.z = 0.2;
  } else if (kind === 'bruto') {
    cap(0.4, 0.8, IRON_D, 0.7);
    for (const z of [-0.3, 0.3]) { const h = cone(g, 0.07, 0.3, '#efe9d8', 0, 1.1, z, { ns: true, seg: 6 }); h.rotation.x = z * 1.4; }
    club(0.62, 0.17, '#55565e');
  } else if (kind === 'capo') { crown(0.2, 1.0, GOLDC); club(0.6, 0.15, '#7b5230'); }
  else if (kind === 'campione') {
    crown(0.22, 1.0, GOLDC);
    const c = box(g, 0.05, 0.62, 0.74, '#7a1f2a', -0.47, 0.36, 0, { ns: true }); c.rotation.z = -0.22;
    club(0.66, 0.18, '#f2c230');
    u.aura = sph(g, 0.82, '#ffd24a', 0, 0.45, 0, { basic: true, a: 0.12, ns: true });
  } else if (kind === 'lancia') {
    cap(0.33, 0.88, IRON); cone(g, 0.05, 0.2, '#c2452d', 0, 1.14, 0, { ns: true, seg: 6 });
    cyl(arm, 0.025, 0.025, 1.35, WOOD_D, 0.12, 0.3, 0, { ns: true }); cone(arm, 0.06, 0.2, '#e1e5ee', 0.12, 1.07, 0, { ns: true, seg: 6 });
    const sh = cyl(g, 0.22, 0.22, 0.05, '#c2452d', 0.3, 0.4, -0.46, { ns: true }); sh.rotation.x = Math.PI / 2;
  } else if (kind === 'arco') {
    cone(g, 0.3, 0.36, '#2f8f5b', -0.03, 1.02, 0, { ns: true, seg: 10 });
    const b = put(arm, geom('bow', () => new THREE.TorusGeometry(0.3, 0.025, 5, 12, Math.PI)), M(WOOD_L), 0.24, 0.12, 0, false); b.rotation.z = -Math.PI / 2;
    cyl(arm, 0.008, 0.008, 0.6, '#f4f1ea', 0.24, 0.12, 0, { ns: true });
    const q = cyl(g, 0.07, 0.07, 0.36, WOOD_D, -0.4, 0.6, -0.2, { ns: true }); q.rotation.z = 0.4;
  } else if (kind === 'corazza') {
    cap(0.42, 0.78, IRON, 0.78); box(g, 0.34, 0.2, 0.05, GOLDC, 0.02, 1.08, 0, { ns: true });
    box(g, 0.05, 0.56, 0.46, IRON_D, 0.36, 0.38, -0.5, { ns: true }); box(g, 0.06, 0.2, 0.16, GOLDC, 0.38, 0.4, -0.5, { ns: true });
    box(arm, 0.58, 0.06, 0.035, '#e1e5ee', 0.36, 0.14, 0, { ns: true }); box(arm, 0.04, 0.16, 0.05, GOLDC, 0.1, 0.14, 0, { ns: true });
  } else return null;
  g.userData = u;
  return g;
}

/** Una capanna tonda col tetto del colore del popolo. */
function makeHut(color, s) {
  const g = grp(null);
  cyl(g, 20, 22, 20, '#e6d6b4', 0, 10, 0, { seg: 10 });
  cone(g, 28, 26, color, 0, 33, 0, { seg: 10 });
  box(g, 8, 13, 2, '#5c3a1e', 0, 6.5, 21, { ns: true });
  g.scale.setScalar(s);
  return g;
}
/** Il villaggio di un popolo: la casa del capo con lo stendardo, le capanne, il fuoco. */
function makeVillage(T, rnd) {
  const g = grp(null), u = {}, col = T.color, dark = new THREE.Color(col).multiplyScalar(0.78).getStyle();
  const hall = u.hall = grp(g);
  cyl(hall, 44, 48, 34, '#e9dcc0', 0, 17, 0, { seg: 14 });
  cyl(hall, 50, 50, 5, '#8a6a44', 0, 35, 0, { seg: 14, ns: true });
  cone(hall, 58, 52, col, 0, 63, 0, { seg: 14 });
  sph(hall, 7, GOLDC, 0, 92, 0, { ns: true });
  box(hall, 16, 24, 3, '#5c3a1e', 0, 12, 46.5, { ns: true });
  for (const x of [-24, 24]) box(hall, 9, 9, 3, '#ffd97a', x, 20, 44, { ns: true, e: 0xffb040, ei: 0.7 });
  cyl(g, 1.8, 1.8, 96, '#4a3020', 58, 48, 26, { ns: true });
  u.flag = box(g, 30, 18, 1.2, col, 74, 86, 26, { ns: true });
  // le capanne: tutto attorno, ma non sulla strada verso il castello
  const out = Math.atan2(T.gate.r - T.r, T.gate.c - T.c);
  for (let k = 0; k < 6; k++) {
    const a = out + 0.85 + k * (Math.PI * 2 - 1.7) / 5, rad = 128 + rnd() * 34;
    const h = makeHut(k % 2 ? dark : col, 0.95 + rnd() * 0.3); h.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad); h.rotation.y = -a + Math.PI / 2 + Math.PI; g.add(h);
  }
  const fx = Math.cos(out) * 96, fz = Math.sin(out) * 96;
  for (let i = 0; i < 5; i++) { const a = i * 1.257; sph(g, 4.5, '#8d8f96', fx + Math.cos(a) * 11, 3, fz + Math.sin(a) * 11, { ns: true }); }
  u.fire = cone(g, 6.5, 20, '#ff9d2a', fx, 11, fz, { ns: true, mat: { basic: true, a: 0.92 } });
  cone(g, 3.6, 12, '#ffe27a', fx, 8, fz, { ns: true, mat: { basic: true, a: 0.95 } });
  g.userData = u;
  return g;
}

// ---------- edifici ----------
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
function makeCastle(level) {
  const g = grp(null);
  box(g, 96, 66, 72, '#a3a4b0', 0, 33, 0);
  for (let i = 0; i < 5; i++) box(g, 11, 9, 11, '#a3a4b0', -40 + i * 20, 70, 31, { ns: true });
  for (const [x, z] of [[-50, -36], [50, -36], [-50, 36], [50, 36]]) { cyl(g, 16, 18, 88, '#b2b3be', x, 44, z); cone(g, 20, 30, '#2f8f5b', x, 103, z); if (level >= 3) sph(g, 3.5, GOLDC, x, 120, z, { ns: true }); }
  box(g, 22, 34, 2, '#4a3020', 0, 17, 37, { ns: true });
  for (const x of [-26, 26]) box(g, 9, 13, 2, '#ffd97a', x, 44, 37, { ns: true, e: 0xffb040, ei: 0.7 });
  if (level >= 2) { box(g, 40, 30, 40, '#b2b3be', 0, 81, -6); pyramid(g, 32, 26, '#2f8f5b', 0, 109, -6); }
  if (level >= 4) for (const x of [-26, 26]) box(g, 3, 18, 1, GOLDC, x, 22, 37.6, { ns: true });
  cyl(g, 1.6, 1.6, 50, '#4a3020', 0, level >= 2 ? 140 : 96, -6, { ns: true });
  box(g, 28, 15, 1, level >= 5 ? GOLDC : '#2f8f5b', 14, level >= 2 ? 156 : 112, -6, { ns: true });
  g.scale.setScalar(0.84);
  return g;
}

const CROP_COL = { grano: ['#b9c24a', '#e8c64a'], carote: ['#4f9a4b', '#f08a2a'], zucche: ['#4f9a4b', '#f0822a'], uva: ['#4f9a4b', '#7a3fb0'] };
function makePlot(state) {
  const g = grp(null);
  box(g, 92, 5, 74, '#6f4a2a', 0, 2.5, 0, { ns: true });
  box(g, 84, 2, 66, '#8a5f38', 0, 5.6, 0, { ns: true });
  for (let i = 0; i < 3; i++) box(g, 80, 1.6, 6, '#6a4526', 0, 6.6, -22 + i * 22, { ns: true });
  g.scale.set(0.84, 1, 1.04);
  if (!state || !state.crop) return g;
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

function makeSawmill() {
  const g = grp(null), u = {};
  box(g, 68, 3, 60, '#b89a6a', 0, 1.5, 0, { ns: true });
  for (const [x, z] of [[-29, -24], [29, -24], [-29, 4], [29, 4]]) cyl(g, 2.6, 2.6, 36, WOOD_D, x, 19, z);
  const roof = box(g, 72, 4, 40, '#8a5a33', 0, 40, -10); roof.rotation.x = -0.16;
  box(g, 44, 10, 14, WOOD, 0, 8, -10);
  u.blade = cyl(g, 11, 11, 1.6, '#cfd3dc', 0, 17, -10, { seg: 16 }); u.blade.rotation.x = Math.PI / 2;
  for (const [y, z] of [[7, 16], [7, 26], [15, 21]]) { const l = cyl(g, 5, 5, 40, '#9b6b3d', 0, y, z); l.rotation.z = Math.PI / 2; }
  for (const x of [-20.5, 20.5]) for (const [y, z] of [[7, 16], [7, 26], [15, 21]]) { const e = cyl(g, 3.4, 3.4, 0.6, '#e2c08c', x, y, z, { ns: true }); e.rotation.z = Math.PI / 2; }
  g.userData = u;
  return g;
}

function makeQuarry() {
  const g = grp(null);
  box(g, 70, 3, 62, '#9c968a', 0, 1.5, 0, { ns: true });
  const rock = (x, y, z, sx, sy, sz, col, a) => { const m = put(g, geom('rock', () => new THREE.DodecahedronGeometry(1)), M(col, { flat: true }), x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(a, a * 2, 0); return m; };
  rock(-14, 15, -10, 25, 21, 22, '#8d8f96', 0.4); rock(10, 9, -18, 15, 12, 14, '#7d7f86', 1.3); rock(-22, 6, 16, 9, 8, 9, '#9a9ca4', 2.1);
  box(g, 16, 10, 12, '#b9bac4', 16, 8, 14); box(g, 14, 9, 12, '#a9aab4', 0, 7.5, 20); box(g, 14, 9, 11, '#c4c5cf', 14, 18, 15);
  cyl(g, 2.2, 2.2, 46, WOOD_D, 28, 23, -6);
  box(g, 34, 3, 3, WOOD, 14, 46, -6);
  cyl(g, 0.7, 0.7, 20, '#3d2a17', 0, 35, -6, { ns: true });
  box(g, 7, 6, 6, '#c4c5cf', 0, 23, -6);
  return g;
}

function makeBarracks() {
  const g = grp(null);
  box(g, 64, 30, 52, '#8f8f98', 0, 15, 0);
  for (let i = 0; i < 5; i++) { box(g, 8, 7, 8, '#8f8f98', -28 + i * 14, 33.5, 22, { ns: true }); box(g, 8, 7, 8, '#8f8f98', -28 + i * 14, 33.5, -22, { ns: true }); }
  box(g, 34, 14, 26, '#7d7e8a', 0, 37, 0);
  pyramid(g, 26, 18, '#a8322a', 0, 53, 0, 1, 0.78);
  box(g, 14, 20, 2, '#4a3020', 0, 10, 26.4, { ns: true });
  for (const [x, col] of [[-20, '#c2452d'], [20, '#2f7fb8']]) { const s = cyl(g, 6.5, 6.5, 2, col, x, 18, 26.6, { ns: true }); s.rotation.x = Math.PI / 2; const b = cyl(g, 2.2, 2.2, 2.6, GOLDC, x, 18, 26.8, { ns: true }); b.rotation.x = Math.PI / 2; }
  cyl(g, 1.3, 1.3, 30, '#4a3020', 26, 60, -18, { ns: true });
  box(g, 16, 10, 1, '#c2452d', 34, 70, -18, { ns: true });
  return g;
}

function makeWorkshop() {
  const g = grp(null), u = {};
  box(g, 58, 26, 44, '#e9dcc0', 0, 13, 0);
  box(g, 59, 3, 45, '#6b4a2b', 0, 14, 0, { ns: true });
  pyramid(g, 44, 26, '#7b5cc9', 0, 39, 0, 1, 0.8);
  cyl(g, 5, 5, 20, '#8d8f96', 18, 44, -8);
  box(g, 10, 15, 1.5, '#5c3a1e', -10, 7.5, 22.4, { ns: true });
  const w = cyl(g, 6, 6, 1.5, '#9ff0ff', 12, 15, 22.4, { ns: true, mat: { e: 0x3fd0ff, ei: 0.8 } }); w.rotation.x = Math.PI / 2;
  box(g, 18, 9, 12, WOOD, 36, 4.5, 16);
  u.flask = sph(g, 5, '#8ff0b0', 33, 14, 16, { e: 0x3fd070, ei: 0.9, ns: true });
  sph(g, 3.4, '#c9a2ff', 41, 12.4, 17, { e: 0x7a3fe0, ei: 0.9, ns: true });
  const t = cyl(g, 2.4, 3.4, 26, GOLDC, -14, 52, 4, { ns: true }); t.rotation.z = 0.9;
  g.userData = u;
  return g;
}

function makeMine(ore, glow) {
  const g = grp(null), u = {};
  box(g, 70, 3, 62, '#8a8072', 0, 1.5, 0, { ns: true });
  const rock = (x, y, z, sx, sy, sz, col, a) => { const m = put(g, geom('rock', () => new THREE.DodecahedronGeometry(1)), M(col, { flat: true }), x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(a, a * 2, 0); return m; };
  rock(-6, 16, -10, 33, 25, 25, '#77706a', 0.5); rock(18, 9, -16, 16, 13, 14, '#6a645e', 1.4);
  box(g, 20, 22, 6, '#1d1a1c', -6, 11, 13, { ns: true });
  for (const x of [-17, 5]) box(g, 4, 26, 5, WOOD_D, x, 13, 15);
  box(g, 30, 4, 6, WOOD, -6, 27, 15);
  for (const x of [-11, -1]) box(g, 1.6, 1.2, 26, '#55565e', x, 3.6, 28, { ns: true });
  const cart = u.cart = grp(g, -6, 0, 30);
  box(cart, 15, 8, 12, WOOD, 0, 9, 0);
  for (const [x, z] of [[-4, -2], [3, 1], [-1, 3]]) { const m = put(cart, geom('rock', () => new THREE.DodecahedronGeometry(1)), M(ore, glow ? { flat: true, e: glow, ei: 0.7 } : { flat: true }), x, 14.5, z, false); m.scale.setScalar(4.2); m.rotation.set(x, z, 0); }
  if (glow) for (const [x, y, z, k] of [[22, 12, 8, 1], [28, 8, 0, 0.7], [16, 7, 16, 0.6]]) { const c = octa(g, 7, ore, x, y, z, { e: glow, ei: 0.8, flat: true }); c.scale.set(k, 1.9 * k, k); c.castShadow = true; }
  else { rock(24, 5, 12, 8, 7, 8, ore, 2.2); rock(30, 4, 2, 6, 5, 6, ore, 0.9); }
  g.userData = u;
  return g;
}

function makeMarket() {
  const g = grp(null);
  box(g, 66, 3, 56, '#b89a6a', 0, 1.5, 0, { ns: true });
  for (const [x, z] of [[-28, -20], [28, -20], [-28, 20], [28, 20]]) cyl(g, 2.2, 2.2, 38, WOOD_D, x, 19, z);
  for (let i = 0; i < 6; i++) { const b = box(g, 11, 2.4, 50, i % 2 ? '#f4f1ea' : '#c2452d', -27.5 + i * 11, 40 - Math.abs(i - 2.5) * 1.6, 0); b.rotation.z = (i - 2.5) * -0.06; }
  box(g, 50, 12, 14, WOOD, 0, 6, 12);
  box(g, 52, 2, 16, WOOD_L, 0, 13, 12, { ns: true });
  for (const [x, col] of [[-16, '#e8c64a'], [-4, '#f08a2a'], [8, '#7a3fb0']]) sph(g, 4.4, col, x, 17, 12, { ns: true });
  for (let i = 0; i < 3; i++) cyl(g, 3.4, 3.4, 1.6, GOLDC, 19, 14.8 + i * 1.7, 12, { ns: true });
  box(g, 14, 12, 12, WOOD_L, -18, 6, -12); box(g, 12, 10, 12, WOOD, -4, 5, -14);
  const sack = sph(g, 8, '#d9c7a0', 14, 6, -12); sack.scale.y = 0.85;
  return g;
}

function makeGate(vertical) {
  const g = grp(null);
  for (const x of [-15, 15]) { box(g, 10, 40, 14, '#9a9ba4', x, 20, 0); pyramid(g, 9, 9, '#b5482f', x, 44.5, 0); }
  box(g, 22, 6, 8, '#8a5a33', 0, 33, 0, { ns: true });
  box(g, 20, 28, 4, '#8a5a33', 0, 14, 0);
  for (const x of [-6, 0, 6]) box(g, 1, 28, 4.6, '#5c3a1e', x, 14, 0, { ns: true });
  box(g, 20, 2.4, 5, '#55565e', 0, 9, 0, { ns: true }); box(g, 20, 2.4, 5, '#55565e', 0, 21, 0, { ns: true });
  if (vertical) g.rotation.y = Math.PI / 2;
  return g;
}

const ROOFS = ['#b5482f', '#a8552d', '#9c4a2a', '#b8603a'];
/** Il modello di un edificio. o: { lvl, castle, crop, id, vertical } */
function makeModel(type, o = {}) {
  let g;
  if (type === 'castello') g = makeCastle(o.castle || 1);
  else if (type === 'casa') g = makeHouse(ROOFS[(o.id || 0) % ROOFS.length], 1.3);
  else if (type === 'campo') g = makePlot(o.crop);
  else if (type === 'segheria') g = makeSawmill();
  else if (type === 'cava') g = makeQuarry();
  else if (type === 'caserma') g = makeBarracks();
  else if (type === 'bottega') g = makeWorkshop();
  else if (type === 'mercato') g = makeMarket();
  else if (type === 'miniera') g = makeMine('#c0683c', 0);
  else if (type === 'cristalliera') g = makeMine('#7fe3ff', 0x2fb8e0);
  else if (type === 'cancello') g = makeGate(o.vertical);
  else { g = makeTower(type, o.lvl || 0); g.scale.setScalar(1.08); }
  return bake(g, movers(g));
}

const ghostMats = new Map();
function ghostify(g) {
  g.traverse((m) => {
    if (!m.isMesh) return;
    let gm = ghostMats.get(m.material);
    if (!gm) { gm = m.material.clone(); gm.transparent = true; gm.opacity = 0.62; gm.depthWrite = false; ghostMats.set(m.material, gm); }
    m.material = gm; m.castShadow = false;
  });
  return g;
}

const PITCH = 55 * Math.PI / 180, DIST_MIN = 430, DIST_MAX = 3000, WALL_CAP = 1200;
const c3cache = new Map();
function c3(col) { let c = c3cache.get(col); if (!c) { c = new THREE.Color(col); c3cache.set(col, c); } return c; }
/** Chi lavora accanto a un edificio (dx, dy dal centro). */
const WORKER = { segheria: [46, 30], cava: [-46, 34], miniera: [34, 44], cristalliera: [34, 44], bottega: [-40, 40], mercato: [0, 44] };
const wallish = (b) => !!b && (b.type === 'recinto' || b.type === 'mura' || b.type === 'cancello');

// ---------- la scena ----------
export class Scene3D {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cam = new THREE.PerspectiveCamera(30, 1, 40, 9000);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector2();
    this.w = 1; this.h = 1;
    this.scene = null; this.tex = null;
    this.dir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    this.target = new THREE.Vector3((CASTLE.c + CASTLE.w / 2) * G, 0, (CASTLE.r + CASTLE.h / 2) * G + 20);
    this.dist = 1150;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h;
    this.r.setPixelRatio(dpr); this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.place();
  }

  // ---------- camera ----------
  place() {
    const cam = this.cam, t = this.target;
    cam.position.copy(t).addScaledVector(this.dir, this.dist); cam.lookAt(t); cam.updateMatrixWorld();
    if (this.sun) {
      const S = Math.max(650, Math.min(2300, this.dist * 0.8)), sc = this.sun.shadow.camera;
      this.sun.position.set(t.x - 520, 1000, t.z - 330); this.sun.target.position.set(t.x, 0, t.z); this.sun.target.updateMatrixWorld();
      if (sc.right !== S) { sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.updateProjectionMatrix(); }
    }
  }
  /** Sposta la camera: (x, y) è il punto della mappa al centro dello schermo, dist la lontananza. */
  setView(x, y, dist = this.dist) {
    this.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, dist));
    this.target.x = Math.max(60, Math.min(WORLD_W - 60, x)); this.target.z = Math.max(60, Math.min(WORLD_H - 20, y));
    this.place();
  }
  get view() { return { x: this.target.x, y: this.target.z, dist: this.dist }; }
  /** Trascinamento: il punto del terreno g0 resta sotto il dito che ora è in (cx, cy). */
  dragTo(g0, cx, cy) { const g = this.pick(cx, cy); if (g) this.setView(this.target.x + g0.x - g.x, this.target.z + g0.y - g.y); }
  /** Zoom tenendo fermo il punto sotto (cx, cy). f > 1 allontana. */
  zoomAt(f, cx, cy) {
    const a = this.pick(cx, cy);
    this.setView(this.target.x, this.target.z, this.dist * f);
    const b = this.pick(cx, cy);
    if (a && b) this.setView(this.target.x + a.x - b.x, this.target.z + a.y - b.y);
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

  // ---------- costruzione della scena ----------
  build() {
    if (this.tex) this.tex.dispose();
    const s = new THREE.Scene(), gc = new THREE.Color(GRASS);
    s.background = gc.clone().multiplyScalar(0.8);
    s.fog = new THREE.Fog(s.background, 4200, 8200);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a70, 1.25); s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1d8, 1.75);
    sun.castShadow = this.shadowsOn !== false; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 100; sun.shadow.camera.far = 4200; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
    s.add(sun, sun.target); this.sun = sun;
    const big = new THREE.Mesh(new THREE.PlaneGeometry(14000, 12000), M(GRASS));
    big.rotation.x = -Math.PI / 2; big.position.set(WORLD_W / 2, -0.6, WORLD_H / 2); big.receiveShadow = true; s.add(big);
    const cv = document.createElement('canvas'); paintWorld(cv, 0.8);
    this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), new THREE.MeshLambertMaterial({ map: this.tex }));
    map.rotation.x = -Math.PI / 2; map.position.set(WORLD_W / 2, 0, WORLD_H / 2); map.receiveShadow = true; s.add(map);
    this.scene = s;

    const mk = (geo, mat, n, shadow = true) => { const im = new THREE.InstancedMesh(geo, mat, n); im.castShadow = shadow; im.frustumCulled = false; s.add(im); return im; };
    const canopy = geom('fcan', () => new THREE.SphereGeometry(1, 8, 6)), trunkG = geom('ftrunk', () => new THREE.CylinderGeometry(0.16, 0.22, 1, 6));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
    const tree = (im3, i, x, z, r, pal) => {
      im3[0].setMatrixAt(i, m4.compose(P3.set(x, r * 0.6, z), q, S3.set(r, r * 1.3, r)));
      im3[1].setMatrixAt(i, m4.compose(P3.set(x, r * 1.55, z), q, S3.set(r, r * 0.95, r))); im3[1].setColorAt(i, col.set(pal[0]));
      im3[2].setMatrixAt(i, m4.compose(P3.set(x - r * 0.12, r * 2.15, z - r * 0.1), q, S3.set(r * 0.68, r * 0.62, r * 0.68))); im3[2].setColorAt(i, col.set(pal[1]));
    };
    this._tree = tree; this._m4 = m4; this._q = q; this._P3 = P3; this._S3 = S3; this._col = col;

    // bosco attorno alla mappa (fisso)
    const rnd = mulberry32(21), outer = [];
    for (let i = 0; i < 520; i++) {
      const x = -1100 + rnd() * (WORLD_W + 2200), z = -900 + rnd() * (WORLD_H + 1700);
      if (x > -30 && x < WORLD_W + 30 && z > -30 && z < WORLD_H + 30) continue;
      outer.push({ x, z, r: 20 + rnd() * 16, pal: TREE_PAL[Math.floor(rnd() * TREE_PAL.length)] });
    }
    const o3 = [mk(trunkG, M('#5b3b22'), outer.length), mk(canopy, M('#ffffff'), outer.length), mk(canopy, M('#ffffff'), outer.length)];
    outer.forEach((t, i) => tree(o3, i, t.x, t.z, t.r, t.pal));

    // natura dentro la mappa: alberi e rocce che si possono togliere
    this.trees = NATURE.filter(n => n.kind === 'tree'); this.rocks = NATURE.filter(n => n.kind === 'rock');
    this.t3 = [mk(trunkG, M('#5b3b22'), this.trees.length), mk(canopy, M('#ffffff'), this.trees.length), mk(canopy, M('#ffffff'), this.trees.length)];
    this.rockIM = mk(geom('rock', () => new THREE.DodecahedronGeometry(1)), M('#8d8f96', { flat: true }), this.rocks.length);
    // giacimenti: ferro (roccia rugginosa con le vene chiare) e cristallo (punte azzurre)
    this.irons = NATURE.filter(n => n.kind === 'iron'); this.crystals = NATURE.filter(n => n.kind === 'crystal');
    this.ironIM = mk(geom('rock', () => new THREE.DodecahedronGeometry(1)), M('#8a4f36', { flat: true }), this.irons.length);
    this.ironDot = mk(geom('oreDot', () => new THREE.OctahedronGeometry(1)), M('#f0a060', { flat: true, e: 0x803010, ei: 0.5 }), this.irons.length * 3, false);
    this.crysIM = mk(geom('crys', () => new THREE.OctahedronGeometry(1)), M('#8fe8ff', { flat: true, e: 0x2fb8e0, ei: 0.75 }), this.crystals.length * 3);
    this.cutN = -1;

    // mura e recinti a istanze
    this.wallBase = mk(geom('wallB', () => new THREE.BoxGeometry(G, 30, G)), M('#9a9ba4'), WALL_CAP);
    this.wallTop = mk(geom('wallT', () => new THREE.BoxGeometry(22, 9, 22)), M('#b2b3be'), WALL_CAP);
    this.post = mk(geom('fpost', () => new THREE.CylinderGeometry(3.2, 3.8, 24, 7)), M(WOOD_D), WALL_CAP);
    this.rail = mk(geom('frail', () => new THREE.BoxGeometry(G, 3.4, 2.6)), M(WOOD_L), WALL_CAP * 4, false);
    this.wallBase.count = this.wallTop.count = this.post.count = this.rail.count = 0;
    this.rev = -1;

    // i villaggi degli altri popoli
    const vr = mulberry32(77);
    this.villages = TRIBES.map((T) => { const g = makeVillage(T, vr); bake(g, [g.userData.flag, g.userData.fire]); g.position.set((T.c + 0.5) * G, 0, (T.r + 0.5) * G); s.add(g); return g; });

    // i Tuzu: un solo corpo e un solo viso, disegnati a istanze (il colore è per istanza)
    const bg = geom('tuzu', blobGeo), fg = geom('tuzuFace', faceGeo);
    this.blobIM = mk(bg, new THREE.MeshLambertMaterial({ color: 0xffffff }), BLOB_CAP);
    this.ghostIM = mk(bg, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, emissive: 0x334455 }), 80, false);
    this.faceIM = mk(fg, new THREE.MeshBasicMaterial({ color: 0x2b2a33 }), BLOB_CAP, false);
    this.faceLightIM = mk(fg, new THREE.MeshBasicMaterial({ color: 0xffffff }), 120, false);
    this.shineIM = mk(geom('tuzuShine', shineGeo), new THREE.MeshBasicMaterial({ color: 0xffffff }), BLOB_CAP, false);
    this._bq = new THREE.Quaternion(); this._up = new THREE.Vector3(0, 1, 0);
    this.gear = new Map(); this.nb = this.ng = this.nf = this.nl = 0;
    for (const im of [this.blobIM, this.ghostIM, this.faceIM, this.faceLightIM, this.shineIM]) im.count = 0;

    // quadretti (si vedono solo mentre si costruisce)
    const pts = [], x0 = 2 * G, x1 = (COLS - 2) * G, z0 = 2 * G, z1 = (ROWS - 2) * G;
    for (let c = 2; c <= COLS - 2; c++) pts.push(c * G, 0, z0, c * G, 0, z1);
    for (let r = 2; r <= ROWS - 2; r++) pts.push(x0, 0, r * G, x1, 0, r * G);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false }));
    this.grid.position.y = 0.7; this.grid.visible = false; this.grid.renderOrder = 2; s.add(this.grid);
    // ombra chiara sull'area dove si può costruire
    this.gridArea = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.07, depthWrite: false }));
    this.gridArea.rotation.x = -Math.PI / 2; this.gridArea.position.set((x0 + x1) / 2, 0.5, (z0 + z1) / 2); this.gridArea.visible = false; this.gridArea.renderOrder = 1; s.add(this.gridArea);

    // anteprima di costruzione: quadretti verdi/rossi e sagoma
    const tileG = new THREE.PlaneGeometry(G - 3, G - 3); tileG.rotateX(-Math.PI / 2);
    this.tiles = new THREE.InstancedMesh(tileG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), 256);
    this.tiles.frustumCulled = false; this.tiles.renderOrder = 3; this.tiles.position.y = 1; this.tiles.count = 0; s.add(this.tiles);
    this.ghostBox = new THREE.InstancedMesh(new THREE.BoxGeometry(G - 6, 1, G - 6), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }), 256);
    this.ghostBox.frustumCulled = false; this.ghostBox.count = 0; s.add(this.ghostBox);
    this.ghosts = {}; this.ghostOn = null;

    this.bMesh = new Map(); this.projs = new Map();
    this._seen = new Set(); this.ready = false; this._t = 0;
    this.place();
  }

  showGrid(on) { if (this.grid) { this.grid.visible = on; this.gridArea.visible = on; } }

  /** Anteprima: null oppure { type, cells: [{c, r, ok}], at: {x, y} | null (centro della sagoma), line } */
  setGhost(spec) {
    const m4 = this._m4, q = this._q, P3 = this._P3, S3 = this._S3, col = this._col;
    if (this.ghostOn && (!spec || !spec.at || this.ghostOn !== this.ghosts[spec.type])) { this.ghostOn.visible = false; this.ghostOn = null; }
    if (!spec) { this.tiles.count = 0; this.ghostBox.count = 0; return; }
    const n = Math.min(256, spec.cells.length);
    q.identity();
    for (let i = 0; i < n; i++) {
      const k = spec.cells[i];
      this.tiles.setMatrixAt(i, m4.compose(P3.set((k.c + 0.5) * G, 0, (k.r + 0.5) * G), q, S3.set(1, 1, 1)));
      this.tiles.setColorAt(i, col.set(k.ok ? 0x4fe36a : 0xff4d3d));
    }
    this.tiles.count = n; this.tiles.instanceMatrix.needsUpdate = true; if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    if (spec.line) {
      const h = spec.type === 'mura' ? 30 : 20;
      for (let i = 0; i < n; i++) {
        const k = spec.cells[i];
        this.ghostBox.setMatrixAt(i, m4.compose(P3.set((k.c + 0.5) * G, h / 2, (k.r + 0.5) * G), q, S3.set(spec.type === 'mura' ? 1.1 : 0.4, h, spec.type === 'mura' ? 1.1 : 0.4)));
        this.ghostBox.setColorAt(i, col.set(k.ok ? (spec.type === 'mura' ? 0xc9cad6 : 0xc08e58) : 0xff6a5a));
      }
      this.ghostBox.count = n; this.ghostBox.instanceMatrix.needsUpdate = true; if (this.ghostBox.instanceColor) this.ghostBox.instanceColor.needsUpdate = true;
    } else {
      this.ghostBox.count = 0;
      if (spec.at) {
        let g = this.ghosts[spec.type];
        if (!g) { g = ghostify(makeModel(spec.type, { castle: 1, id: 0 })); this.ghosts[spec.type] = g; this.scene.add(g); }
        g.visible = true; g.position.set(spec.at.x, 2, spec.at.y); this.ghostOn = g;
      }
    }
  }

  _walls(world) {
    const m4 = this._m4, q = this._q, P3 = this._P3, S3 = this._S3, qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    let nw = 0, np = 0, nr = 0;
    q.identity(); S3.set(1, 1, 1);
    for (const b of world.d.buildings) {
      if (b.type === 'mura' && nw < WALL_CAP) {
        this.wallBase.setMatrixAt(nw, m4.compose(P3.set(b.x, 15, b.y), q, S3));
        this.wallTop.setMatrixAt(nw, m4.compose(P3.set(b.x, 34.5, b.y), q, S3)); nw++;
      } else if (b.type === 'recinto' && np < WALL_CAP) {
        this.post.setMatrixAt(np++, m4.compose(P3.set(b.x, 12, b.y), q, S3));
        for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const o = world.buildingAt(b.c + dc, b.r + dr);
          if (!wallish(o)) continue;
          if ((dc < 0 || dr < 0) && o.type === 'recinto') continue;      // quel tratto lo disegna l'altro paletto
          const half = o.type === 'recinto' ? 0.5 : 0.36;
          for (const y of [8, 17]) if (nr < WALL_CAP * 4) this.rail.setMatrixAt(nr++, m4.compose(P3.set(b.x + dc * G * half, y, b.y + dr * G * half), dc ? q : qy, S3.set(half * 2, 1, 1)));
          S3.set(1, 1, 1);
        }
      }
    }
    this.wallBase.count = this.wallTop.count = nw; this.post.count = np; this.rail.count = nr;
    for (const im of [this.wallBase, this.wallTop, this.post, this.rail]) im.instanceMatrix.needsUpdate = true;
  }

  _nature(world) {
    const m4 = this._m4, q = this._q, P3 = this._P3, S3 = this._S3, e = new THREE.Euler(), rq = new THREE.Quaternion();
    q.identity();
    this.trees.forEach((n, i) => {
      const x = (n.c + 0.5) * G, z = (n.r + 0.5) * G;
      if (world.cutSet.has(n.id)) { m4.makeScale(0, 0, 0); for (const im of this.t3) im.setMatrixAt(i, m4); }
      else this._tree(this.t3, i, x, z, 15 * n.size, TREE_PAL[n.tint % TREE_PAL.length]);
    });
    this.rocks.forEach((n, i) => {
      const r = world.cutSet.has(n.id) ? 0 : 13 * n.size;
      rq.setFromEuler(e.set(n.tint, n.tint * 2, 0));
      this.rockIM.setMatrixAt(i, m4.compose(P3.set((n.c + 0.5) * G, r * 0.45, (n.r + 0.5) * G), rq, S3.set(r, r * 0.75, r)));
    });
    this.irons.forEach((n, i) => {
      const gone = world.cutSet.has(n.id), r = gone ? 0 : 14 * n.size, x = (n.c + 0.5) * G, z = (n.r + 0.5) * G;
      rq.setFromEuler(e.set(n.tint, n.tint * 2, 0));
      this.ironIM.setMatrixAt(i, m4.compose(P3.set(x, r * 0.45, z), rq, S3.set(r, r * 0.8, r)));
      for (let k = 0; k < 3; k++) { const a = n.tint + k * 2.1, d = gone ? 0 : 3.2; this.ironDot.setMatrixAt(i * 3 + k, m4.compose(P3.set(x + Math.cos(a) * r * 0.62, r * 0.62 + k * 2, z + Math.sin(a) * r * 0.62), rq, S3.set(d, d, d))); }
    });
    this.crystals.forEach((n, i) => {
      const gone = world.cutSet.has(n.id), x = (n.c + 0.5) * G, z = (n.r + 0.5) * G;
      for (let k = 0; k < 3; k++) {
        const a = n.tint * 1.3 + k * 2.1, r = gone ? 0 : (k ? 4.5 : 7) * n.size, d = k ? 9 : 0;
        rq.setFromEuler(e.set(k ? 0.35 : 0, a, k ? 0.3 : 0));
        this.crysIM.setMatrixAt(i * 3 + k, m4.compose(P3.set(x + Math.cos(a) * d, r * 1.7, z + Math.sin(a) * d), rq, S3.set(r, r * 2.3, r)));
      }
    });
    for (const im of [...this.t3, this.rockIM, this.ironIM, this.ironDot, this.crysIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.cutN = world.cutSet.size;
  }

  /** Disegna un Tuzu: (x, y) sul terreno, lift = altezza del salto, H = statura, squash = schiacciamento (1 = fermo). */
  tuzu(x, y, lift, ang, H, squash, color, light, ghost) {
    const k = 1 / Math.sqrt(squash), m4 = this._m4;
    m4.compose(this._P3.set(x, lift, y), this._bq.setFromAxisAngle(this._up, -facing(ang)), this._S3.set(H * k, H * squash, H * k));
    if (ghost) { if (this.ng >= 80) return; this.ghostIM.setMatrixAt(this.ng, m4); this.ghostIM.setColorAt(this.ng++, c3(color)); }
    else { if (this.nb >= BLOB_CAP) return; this.blobIM.setMatrixAt(this.nb, m4); this.blobIM.setColorAt(this.nb++, c3(color)); }
    if (light) { if (this.nl < 120) this.faceLightIM.setMatrixAt(this.nl++, m4); }
    else if (this.nf < BLOB_CAP) { this.shineIM.setMatrixAt(this.nf, m4); this.faceIM.setMatrixAt(this.nf++, m4); }
  }
  /** Gli accessori di un Tuzu (uno per creatura viva), allineati al suo corpo. */
  gearFor(id, kind, x, y, lift, ang, H) {
    let g = this.gear.get(id);
    if (g === undefined) { g = makeGear(kind); if (g) this.scene.add(g); this.gear.set(id, g); }
    this._live.add(id);
    if (!g) return null;
    g.position.set(x, lift, y); g.rotation.y = -facing(ang); g.scale.setScalar(H);
    return g.userData;
  }

  /** Allinea la scena al mondo di gioco. */
  sync(world, time, now) {
    const s = this.scene, dt = Math.max(0, Math.min(0.1, time - this._t));
    this._t = time;
    if (this.cutN !== world.cutSet.size) this._nature(world);
    if (this.rev !== world.rev) { this._walls(world); this.rev = world.rev; }

    // edifici
    const seen = this._seen; seen.clear();
    for (const b of world.d.buildings) {
      if (b.type === 'recinto' || b.type === 'mura') continue;
      seen.add(b.id);
      let key, crop = null, vertical = false;
      if (b.type === 'campo') { const st = world.crop(b, now); crop = st.empty ? null : st; key = st.empty ? 'E' : st.crop + (st.ripe ? 3 : Math.min(2, Math.floor(st.progress * 3))); }
      else if (b.type === 'castello') key = 'C' + world.d.castle;
      else if (b.type === 'cancello') { vertical = (wallish(world.buildingAt(b.c, b.r - 1)) || wallish(world.buildingAt(b.c, b.r + 1))) && !(wallish(world.buildingAt(b.c - 1, b.r)) || wallish(world.buildingAt(b.c + 1, b.r))); key = vertical ? 'V' : 'H'; }
      else key = 'L' + (b.lvl || 0);
      let o = this.bMesh.get(b.id);
      if (!o || o.key !== key) {
        const fresh = !o;
        if (o) drop(s, o.g);
        const g = makeModel(b.type, { lvl: b.lvl || 0, castle: world.d.castle, crop, id: b.id, vertical });
        g.position.set(b.x, 0, b.y); s.add(g);
        o = { g, key, sx: g.scale.x, sy: g.scale.y, sz: g.scale.z, pop: (fresh && this.ready) || (!fresh && b.type !== 'campo') ? 0 : 1 };
        this.bMesh.set(b.id, o);
      }
      const g = o.g, u = g.userData;
      if (o.pop < 1 || b.hitT > 0) {      // appena costruito spunta con un rimbalzo; colpito, trema
        o.pop = Math.min(1, o.pop + dt * 2.6);
        const k = o.pop - 1, e = 0.35 + 0.65 * (1 + 2.7 * k * k * k + 1.7 * k * k), w = b.hitT > 0 ? 1 + Math.sin(time * 60) * 0.03 : 1;
        g.scale.set(o.sx * e * w, o.sy * e, o.sz * e * w);
      } else if (g.scale.x !== o.sx) g.scale.set(o.sx, o.sy, o.sz);
      if (u.blade) u.blade.rotation.y = time * 5;
      if (u.type) {       // torre
        const f = Math.max(0, b.fireAnim || 0);
        if (u.turret) u.turret.rotation.y = -(b.angle || 0);
        if (u.bolt) u.bolt.visible = f <= 0;
        if (u.crystal) { u.crystal.position.y = u.baseY + Math.sin(time * 2.4 + b.x) * 3; u.crystal.rotation.y = time * 0.9; u.halo.position.y = u.crystal.position.y; u.halo.scale.setScalar(1 + (f > 0 ? 0.5 : 0) + Math.sin(time * 3) * 0.05); u.orbit.position.y = u.crystal.position.y; u.orbit.rotation.y = time * 2; }
        if (u.arm) { const k = f / 0.45; u.arm.rotation.z = 0.25 - 2.45 * Math.sin(k * Math.PI); u.rock.visible = f <= 0; }
        if (u.flames) { const bb = b.burning ? 1.4 : 1; u.flames.forEach((fm, i) => { const k = bb * (0.85 + Math.sin(time * 11 + i * 2.1) * 0.18); fm.scale.set(1, k, 1); fm.position.y = 38 + fm.userData.h * k / 2; }); u.halo.scale.setScalar(bb + Math.sin(time * 7) * 0.06); }
        if (u.vines) { const k = f / 0.5; u.vines.forEach((v, i) => { v.rotation.z = Math.sin(time * 1.6 + i * 1.7) * 0.08 + k * 0.22; }); u.bud.scale.setScalar(1 + k * 0.5); u.halo.scale.setScalar(1 + k * 1.6); }
      }
    }
    for (const [id, o] of this.bMesh) if (!seen.has(id)) { drop(s, o.g); this.bMesh.delete(id); }
    this.ready = true;

    // i Tuzu: nemici, soldati, abitanti
    this.nb = this.ng = this.nf = this.nl = 0;
    const live = this._live || (this._live = new Set()); live.clear();
    for (const e of world.enemies) {
      const T = TRIBES[e.tribe] || TRIBES[0], H = TUZU_H[e.type] * (1 + Math.max(0, e.hit) * 1.4);
      const hop = Math.abs(Math.sin(e.anim * Math.PI)), lunge = e.striking > 0 ? Math.sin(e.striking / 0.25 * Math.PI) * 9 : 0;
      const x = e.x + Math.cos(e.ang) * lunge, y = e.y + Math.sin(e.ang) * lunge;
      const lift = e.ghost ? 7 + Math.sin(time * 3 + e.anim) * 3 : hop * H * 0.13, sq = e.ghost ? 1 : 0.94 + hop * 0.14;
      this.tuzu(x, y, lift, e.ang, H, sq, T.color, T.eyes !== '#2b2a33', e.ghost);
      const u = this.gearFor('e' + e.id, e.type, x, y, lift, e.ang, H);
      if (u) { u.arm.rotation.z = e.striking > 0 ? -1.3 * Math.sin(e.striking / 0.25 * Math.PI) : 0; if (u.aura) u.aura.scale.setScalar(1 + Math.sin(time * 4) * 0.08); }
    }
    for (const sd of world.soldiers) {
      const H = TUZU_H[sd.type] * (1 + Math.max(0, sd.hit) * 1.4), hop = Math.abs(Math.sin(sd.anim));
      const lift = hop * H * 0.12;
      this.tuzu(sd.x, sd.y, lift, sd.ang, H, 0.95 + hop * 0.12, MY_COLOR, false, false);
      const u = this.gearFor('s' + sd.id, sd.type, sd.x, sd.y, lift, sd.ang, H);
      if (u) u.arm.rotation.z = sd.strike > 0 ? -1.2 * Math.sin(sd.strike / 0.2 * Math.PI) : 0;
    }
    for (const [id, g] of this.gear) if (!live.has(id)) { if (g) s.remove(g); this.gear.delete(id); }
    // gli abitanti del tuo regno: di giorno girano fra le case e lavorano, di notte stanno al riparo
    if (world.status !== 'night') {
      let n = 0;
      for (const b of world.d.buildings) {
        if (n >= 44) break;
        if (b.type === 'casa') {
          for (let k = 0; k < 2; k++) {
            const ph = time * 0.32 + b.id * 1.7 + k * 2.6, f = (p) => [b.x + Math.cos(p) * 54 + Math.cos(p * 2.3 + b.id) * 12, b.y + 60 + Math.sin(p * 1.3 + k) * 15];
            const [px, py] = f(ph), [qx, qy] = f(ph + 0.05), hop = Math.abs(Math.sin(time * 5 + b.id + k * 2));
            this.tuzu(px, py, hop * 3, Math.atan2(qy - py, qx - px), TUZU_H.villager * (k ? 0.82 : 1), 0.95 + hop * 0.1, MY_COLOR, false, false); n++;
          }
        } else if (WORKER[b.type]) {
          const o = WORKER[b.type], hop = Math.max(0, Math.sin(time * 4 + b.id * 2.2));
          this.tuzu(b.x + o[0], b.y + o[1], hop * 5, Math.atan2(-o[1], -o[0]), TUZU_H.villager, 1 - hop * 0.02 + (1 - hop) * 0.02, MY_COLOR, false, false); n++;
        }
      }
    }
    // i villaggi: chi ci abita, lo stendardo (viola se è una tua colonia), i colpi dell'assalto
    TRIBES.forEach((T, i) => {
      const v = world.d.villages[i], g = this.villages[i], u = g.userData, R = world.raid && world.raid.i === i ? world.raid : null;
      const fc = v.state === 'colony' ? MY_COLOR : T.color;
      if (u.flagCol !== fc) { u.flag.material = M(fc); u.flagCol = fc; }
      u.flag.rotation.y = Math.sin(time * 2.2 + i) * 0.18;
      u.fire.scale.y = 0.85 + Math.sin(time * 12 + i) * 0.18;
      const w = R && R.hitT > 0 ? 1 + Math.sin(time * 60) * 0.012 : 1; g.scale.set(w, 1, w);
      if (R) return;                                       // sotto assalto sono fuori i difensori
      for (let k = 0; k < 5; k++) {
        const dir = k % 2 ? 1 : -1, a = time * 0.22 * dir + k * 1.26 + i, rad = 150 + (k % 3) * 26 + Math.sin(time * 0.5 + k) * 10;
        const hop = Math.abs(Math.sin(time * 4.6 + k * 1.9 + i));
        this.tuzu(g.position.x + Math.cos(a) * rad, g.position.z + Math.sin(a) * rad * 0.8, hop * 3.4, a + dir * Math.PI / 2, TUZU_H.villager * (0.85 + (k % 3) * 0.12), 0.95 + hop * 0.1, T.color, T.eyes !== '#2b2a33', false);
      }
    });
    this.blobIM.count = this.nb; this.ghostIM.count = this.ng; this.faceIM.count = this.shineIM.count = this.nf; this.faceLightIM.count = this.nl;
    for (const im of [this.blobIM, this.ghostIM, this.faceIM, this.faceLightIM, this.shineIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }

    // proiettili
    const liveP = new Set(world.projs);
    for (const p of world.projs) {
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
    for (const [p, g] of this.projs) if (!liveP.has(p)) { s.remove(g); this.projs.delete(p); }

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

  render() { if (this.scene) this.r.render(this.scene, this.cam); }
}

// Mondo in 3D visto dall'alto (three.js): una sola mappa a quadretti, camera che si sposta e si avvicina.
// Tutti gli abitanti sono Tuzu: la forma è quella del logo, cambia solo il colore del popolo.
// Stile «giocattolo morbido»: forme tonde, superfici lisce con un alone chiaro sui bordi, luce calda;
// in uscita un passaggio di rifinitura (bordi dello schermo sfocati come in una miniatura, bagliori, colori caldi).
// Le coordinate di gioco (x, y) diventano (x, altezza, z = y). L'interfaccia resta in 2D sopra e usa project()/pick().
import * as THREE from '../vendor/three.module.min.js';
import { RIVERS, RIVER_AT } from './data.js';
import { G, COLS, ROWS, WORLD_W, WORLD_H, CASTLE, TRIBES, MY_COLOR, ENEMIES, NATURE, PEAKS, HILLS, LAKES, BUILD, RUINS, FOG, FW, FH, lakeEdge, mulberry32, ISLAND, TRAITS, TERRAIN, LEVELS } from './data.js';
import { GRASS, SEA, paintWorld, paintBuiltRoads, bridgeSpots } from './ground.js';

// ---------- mattoncini: geometrie e materiali condivisi ----------
const geos = new Map(), mats = new Map();
function geom(key, make) { let g = geos.get(key); if (!g) { g = make(); geos.set(key, g); } return g; }
/** Alone chiaro sui bordi (come la plastica morbida controluce) e, per la pelle dei Tuzu, un po' di luce propria. */
function soften(m, rim = 0.2, glow = 0) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      'float rimK = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);\n\toutgoingLight += diffuseColor.rgb * (rimK * ' + rim.toFixed(2) + ' + ' + glow.toFixed(2) + ');\n\t#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'soft' + rim + '|' + glow;
  return m;
}
/** Una scatola con gli spigoli arrotondati (facce 3×3, gli spigoli seguono un raggio r; le normali sono lisce). */
function roundBoxGeo(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), p = g.attributes.position, n = g.attributes.normal, S = [w / 2, h / 2, d / 2], v = [0, 0, 0], q = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    let len = 0;
    for (let a = 0; a < 3; a++) { const sg = Math.sign(v[a]), inner = S[a] - r, t = Math.abs(v[a]) > S[a] * 0.5 ? sg * S[a] : sg * inner; q[a] = sg * inner; v[a] = t - q[a]; len += v[a] * v[a]; }
    len = Math.sqrt(len) || 1;
    p.setXYZ(i, q[0] + v[0] / len * r, q[1] + v[1] / len * r, q[2] + v[2] / len * r); n.setXYZ(i, v[0] / len, v[1] / len, v[2] / len);
  }
  return g;
}
function M(color, o) {
  const key = color + (o ? JSON.stringify(o) : '');
  let m = mats.get(key);
  if (!m) {
    m = o && o.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: o.a != null, opacity: o.a ?? 1, side: o.double ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.a == null })
      : soften(new THREE.MeshLambertMaterial({ color, emissive: o && o.e ? o.e : 0x000000, emissiveIntensity: o && o.ei != null ? o.ei : 1, transparent: !!(o && o.a != null), opacity: o && o.a != null ? o.a : 1, flatShading: !!(o && o.flat) }));
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
// tonde solo le parti grosse: una scatola tonda costa nove volte una a spigoli
const box = (p, w, h, d, col, x, y, z, o) => { const mn = Math.min(w, h, d), r = mn >= 8 ? Math.min(3.6, mn * 0.22) : 0; return put(p, geom(`b${w}|${h}|${d}`, () => (r ? roundBoxGeo(w, h, d, r) : new THREE.BoxGeometry(w, h, d))), M(col, o), x, y, z, !(o && o.ns)); };
const cyl = (p, rt, rb, h, col, x, y, z, o) => put(p, geom(`c${rt}|${rb}|${h}|${(o && o.seg) || 14}`, () => new THREE.CylinderGeometry(rt, rb, h, (o && o.seg) || 14)), M(col, o && o.mat), x, y, z, !(o && o.ns));
const cone = (p, r, h, col, x, y, z, o) => put(p, geom(`k${r}|${h}|${(o && o.seg) || 14}`, () => new THREE.ConeGeometry(r, h, (o && o.seg) || 14)), M(col, o && o.mat), x, y, z, !(o && o.ns));
const sph = (p, r, col, x, y, z, o) => put(p, geom(`s${r}`, () => new THREE.SphereGeometry(r, 14, 10)), M(col, o), x, y, z, !(o && o.ns));
/** Un sasso o un cespuglio tondo (poche facce, ma liscio). */
const ball = (p, r, col, x, y, z, o) => put(p, geom(`i${r}`, () => new THREE.IcosahedronGeometry(r, r < 3 ? 0 : 1)), M(col, o), x, y, z, !(o && o.ns));
const octa = (p, r, col, x, y, z, o) => put(p, geom(`o${r}`, () => new THREE.OctahedronGeometry(r)), M(col, o), x, y, z, false);
function pyramid(p, r, h, col, x, y, z, sx = 1, sz = 1) { const m = cone(p, r, h, col, x, y, z, { seg: 4 }); m.rotation.y = Math.PI / 4; m.scale.set(sx, 1, sz); return m; }
/** Tetto a due falde, col colmo lungo x: largo w, alto h, profondo d. */
function roofGeo(w, h, d) {
  const x = w / 2, z = d / 2, v = [
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
    x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0,
    -x, 0, -z, -x, 0, z, -x, h, 0, x, 0, z, x, 0, -z, x, h, 0,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  return g;
}
const roof = (p, w, h, d, col, x, y, z, o) => put(p, geom(`r${w}|${h}|${d}`, () => roofGeo(w, h, d)), M(col, o), x, y, z, !(o && o.ns));
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }

const STONE = '#a3a4b0', STONE_D = '#7d7e8a', WOOD = '#9b6b3d', WOOD_L = '#c08e58', WOOD_D = '#6f4526', CREAM = '#efe4c8', GOLDC = '#f2c230';

// ---------- torri ----------
function makeTower(type, level) {
  const g = grp(null);
  cyl(g, 30, 35, 9, STONE, 0, 4.5, 0, { seg: 18 });
  { const rim = put(g, geom('trim', () => new THREE.TorusGeometry(29.5, 3.2, 7, 20)), M('#c4c5d0'), 0, 9.4, 0, false); rim.rotation.x = Math.PI / 2; }
  cyl(g, 27, 27, 2.6, '#b4b5c0', 0, 10.6, 0, { seg: 18, ns: true });
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.4, b = ball(g, 5.4, i % 2 ? STONE_D : '#b8b9c4', Math.cos(a) * 34.5, 2.6, Math.sin(a) * 34.5, { ns: true }); b.scale.y = 0.75; }
  cyl(g, 0.9, 0.9, 26, WOOD_D, -25, 20, 19, { ns: true, seg: 5 }); box(g, 11, 7, 0.8, MY_COLOR, -19.5, 29, 19, { ns: true });
  const u = { type, level };
  if (type === 'arcieri') {
    cyl(g, 16, 21, 44, WOOD, 0, 32, 0, { seg: 16 });
    for (let i = 0; i <= level; i++) cyl(g, 19.4 - i * 1.4, 20.2 - i * 1.4, 3, GOLDC, 0, 20 + i * 9, 0, { ns: true, seg: 16 });
    cyl(g, 25, 21, 6, WOOD_L, 0, 57, 0, { seg: 16 });
    { const rim = put(g, geom('trimA', () => new THREE.TorusGeometry(24.4, 2, 6, 18)), M(WOOD_D), 0, 60.4, 0, false); rim.rotation.x = Math.PI / 2; }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.52, b = box(g, 9, 9, 8, WOOD, Math.cos(a) * 21, 64.5, Math.sin(a) * 21, { ns: true }); b.rotation.y = -a + Math.PI / 2; }
    box(g, 6, 10, 3, '#3d2a17', 0, 40, 17.2, { ns: true }); box(g, 9, 2, 4, WOOD_L, 0, 34, 18, { ns: true });
    const t = grp(g, 0, 66, 0);
    box(t, 26, 4, 5, WOOD_D, 3, 2, 0, { ns: true });
    box(t, 4, 3, 30, '#3d2a17', 9, 3, 0, { ns: true });
    u.bolt = cone(t, 2.6, 9, '#d5d9e2', 19, 2.5, 0, { ns: true }); u.bolt.rotation.z = -Math.PI / 2;
    if (level >= 1) { cyl(g, 1, 1, 26, WOOD_D, -14, 78, -14, { ns: true }); box(g, 12, 8, 1, level >= 2 ? '#c2452d' : '#2f8f5b', -8, 86, -14, { ns: true }); }
    u.turret = t;
  } else if (type === 'mago') {
    cyl(g, 12, 17, 26, STONE_D, 0, 23, 0, { seg: 16 });
    cyl(g, 16, 13, 4, '#b7b8c6', 0, 38, 0, { ns: true, seg: 16 });
    { const rim = put(g, geom('trimM', () => new THREE.TorusGeometry(14.6, 1.6, 6, 18)), M('#8f6fe0'), 0, 28, 0, false); rim.rotation.x = Math.PI / 2; }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; ball(g, 2.8, '#c9a7ff', Math.cos(a) * 13.4, 41.6, Math.sin(a) * 13.4, { ns: true, e: 0x6a2fd0, ei: 0.5 }); }
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
    cyl(g, 12, 17, 18, STONE_D, 0, 19, 0, { seg: 16 });
    cyl(g, 21, 14, 10, '#55565e', 0, 33, 0, { seg: 16 });
    { const rim = put(g, geom('trimB', () => new THREE.TorusGeometry(20.6, 1.8, 6, 18)), M(GOLDC), 0, 38, 0, false); rim.rotation.x = Math.PI / 2; }
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
  return new THREE.LatheGeometry(pts, 14);
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
function mergeTone(list, tones) {
  const g = mergeGeos(list), col = new Float32Array(g.attributes.position.count * 3);
  let o = 0;
  list.forEach((p, k) => { const n = p.attributes.position.count; for (let i = 0; i < n; i++) { col[(o + i) * 3] = col[(o + i) * 3 + 1] = col[(o + i) * 3 + 2] = tones[k]; } o += n; });
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Fonde le maglie ferme di un modello: una sola per materiale (e per ombra sì/no). Così un edificio costa poche
 *  chiamate di disegno invece di venti. keep = i pezzi che si muovono, da lasciare come sono. */
const shaded = new Map();
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
  let top = 1; for (const b of buckets.values()) for (const g of b.geos) { g.computeBoundingBox(); top = Math.max(top, g.boundingBox.max.y); }
  for (const b of buckets.values()) {
    const geo = mergeGeos(b.geos);
    let mat = b.mat;
    if (mat.isMeshLambertMaterial) {
      const p = geo.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.66 + 0.42 * Math.min(1, Math.max(0, y / (top * 0.8))) - (y < 4 ? 0.08 : 0); col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k * (0.96 + 0.04 * Math.min(1, y / top)); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      mat = shaded.get(b.mat); if (!mat) { mat = b.mat.clone(); mat.vertexColors = true; shaded.set(b.mat, mat); }
    }
    const mesh = new THREE.Mesh(geo, mat);
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
function faceGeo(kind = 0) {
  const eye = (z, k = 1) => { const g = new THREE.SphereGeometry(0.08 * k, 12, 9); g.scale(0.42, 1.08, 1); g.translate(0.45, 0.455, z); return g; };
  const arc = (r, tube, len, up, y, z = 0) => { const g = new THREE.TorusGeometry(r, tube, 6, 12, len); g.rotateZ((up ? 0 : Math.PI) + (Math.PI - len) / 2); g.rotateY(Math.PI / 2); g.translate(0.45, y, z); return g; };
  const brow = (z, tilt) => { const g = new THREE.BoxGeometry(0.03, 0.034, 0.15); g.rotateX(tilt); g.translate(0.475, 0.585, z); return g; };
  let parts;
  if (kind === 1) parts = [eye(0.153), eye(-0.153), brow(0.15, 0.5), brow(-0.15, -0.5), arc(0.1, 0.021, 1.9, true, 0.25)];             // arrabbiato
  else if (kind === 2) parts = [eye(0.153, 1.2), eye(-0.153, 1.2), arc(0.05, 0.02, Math.PI * 2, true, 0.3)];                           // sorpreso
  else if (kind === 3) parts = [eye(0.153), eye(-0.153), brow(0.15, -0.45), brow(-0.15, 0.45), arc(0.09, 0.021, 1.9, true, 0.24)];     // triste
  else if (kind === 4) parts = [arc(0.062, 0.021, Math.PI, true, 0.43, 0.153), arc(0.062, 0.021, Math.PI, true, 0.43, -0.153), arc(0.13, 0.024, 2.6, false, 0.37)];   // felicissimo
  else parts = [eye(0.153), eye(-0.153), arc(0.11, 0.021, 2.3, false, 0.35)];
  return tiltFace(mergeGeos(parts));
}
function shineGeo() {
  const dot = (z, r, y) => { const g = new THREE.SphereGeometry(r, 7, 5); g.translate(0.487, y, z); return g; };
  return tiltFace(mergeGeos([dot(0.128, 0.03, 0.482), dot(-0.178, 0.03, 0.482), dot(0.172, 0.014, 0.432), dot(-0.134, 0.014, 0.432)]));
}
// Le guance rosa: due dischetti appoggiati sul viso, ai lati del sorriso.
function cheekGeo() {
  const one = (k) => { const g = new THREE.SphereGeometry(0.078, 10, 7); g.scale(0.16, 0.7, 1); g.rotateY(-k * 0.66); g.translate(0.392, 0.335, k * 0.285); return g; };
  return tiltFace(mergeGeos([one(1), one(-1)]));
}
// Braccine ai fianchi e piedini davanti, del colore del corpo.
function limbGeo() {
  const part = (r, sx, sy, sz, x, y, z, tilt) => { const g = new THREE.SphereGeometry(r, 7, 5); g.scale(sx, sy, sz); if (tilt) g.rotateX(tilt); g.translate(x, y, z); return g; };
  return mergeGeos([part(0.1, 0.9, 1.4, 0.8, 0.1, 0.36, 0.49, 0.5), part(0.1, 0.9, 1.4, 0.8, 0.1, 0.36, -0.49, -0.5), part(0.11, 1.3, 0.6, 0.95, 0.21, 0.045, 0.2), part(0.11, 1.3, 0.6, 0.95, 0.21, 0.045, -0.2)]);
}
const BLOB_CAP = 360;
/** Quanto è alto un Tuzu, per tipo. */
const TUZU_H = { lancia: 32, arco: 30, corazza: 38, cavallo: 36, cura: 30, ariete: 38, eroe: 46, eroina: 42, villager: 25 };
const ROLE_GEAR = { bosco: 'ascia', pietra: 'piccone', campi: 'falce', cantiere: 'martello' };
for (const k in ENEMIES) TUZU_H[k] = ENEMIES[k].r * 2.5;

const IRON = '#aeb4c2', IRON_D = '#6f7684';
const ROLE_HAT = { ascia: '#3f8f4a', piccone: '#8d8f96', falce: '#e8c64a', martello: '#c2452d' };
/** Quello che un Tuzu porta addosso: è l'unica cosa che distingue un tipo dall'altro. Misure per un Tuzu alto 1. */
function makeGear(kind) {
  if (kind.startsWith('sp_')) {      // il soldato speciale di un popolo: l'attrezzatura di base più uno stendardo sulla schiena, del suo colore
    const T = TRIBES.find(t => 'sp_' + t.id === kind), g = makeGear0(ENEMIES[kind].gear) || grp(null), col = T ? T.color : '#ffffff';
    if (!g.userData.arm) g.userData = { arm: grp(g, 0.12, 0.42, 0.5) };
    cyl(g, 0.022, 0.022, 1.25, WOOD_D, -0.34, 0.9, -0.1, { ns: true, seg: 5 });
    box(g, 0.03, 0.34, 0.3, col, -0.34, 1.32, 0.07, { ns: true }); ball(g, 0.05, GOLDC, -0.34, 1.55, -0.1, { ns: true });
    return g;
  }
  return makeGear0(kind);
}
function makeGear0(kind) {
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
  } else if (kind === 'cavallo') {
    cap(0.34, 0.88, IRON); cone(g, 0.07, 0.34, '#3f9cf2', -0.06, 1.18, 0, { ns: true, seg: 6 }).rotation.z = 0.5;
    const l = cyl(arm, 0.028, 0.028, 1.7, WOOD_L, 0.5, 0.2, 0, { ns: true, seg: 5 }); l.rotation.z = -1.2; cone(arm, 0.06, 0.22, '#e1e5ee', 1.38, 0.52, 0, { ns: true, seg: 6 }).rotation.z = -1.2 - Math.PI / 2 + Math.PI / 2 - 0.37;
    box(g, 0.05, 0.5, 0.6, '#3f6fb5', -0.46, 0.34, 0, { ns: true }).rotation.z = -0.22;
  } else if (kind === 'cura') {
    cap(0.42, 0.8, '#f4f1ea', 0.74); box(g, 0.05, 0.2, 0.07, '#e0452f', 0.43, 0.84, 0, { ns: true }); box(g, 0.05, 0.07, 0.2, '#e0452f', 0.43, 0.84, 0, { ns: true });
    cyl(arm, 0.028, 0.028, 1.1, WOOD_D, 0.12, 0.26, 0, { ns: true, seg: 5 }); ball(arm, 0.1, '#8ff0b0', 0.12, 0.86, 0, { e: 0x3fd070, ei: 0.9, ns: true });
  } else if (kind === 'ariete') {
    cap(0.36, 0.86, IRON_D, 0.66);
    const l = cyl(g, 0.16, 0.16, 1.5, WOOD, 0.5, 0.36, 0, { seg: 8 }); l.rotation.z = Math.PI / 2;
    const h = cyl(g, 0.2, 0.14, 0.26, IRON_D, 1.3, 0.36, 0, { seg: 8, ns: true }); h.rotation.z = -Math.PI / 2;
    for (const x of [0.1, 0.8]) { const r = cyl(g, 0.175, 0.175, 0.07, IRON, x, 0.36, 0, { seg: 8, ns: true }); r.rotation.z = Math.PI / 2; }
  } else if (kind === 'eroe') {
    crown(0.2, 1.0, GOLDC);
    box(g, 0.05, 0.66, 0.78, '#c2452d', -0.47, 0.38, 0, { ns: true }).rotation.z = -0.22;
    box(arm, 0.66, 0.07, 0.04, '#e9edf5', 0.42, 0.16, 0, { ns: true }); box(arm, 0.05, 0.2, 0.06, GOLDC, 0.1, 0.16, 0, { ns: true });
    const sh = cyl(g, 0.26, 0.26, 0.05, MY_COLOR, 0.32, 0.4, -0.5, { ns: true, seg: 10 }); sh.rotation.x = Math.PI / 2; const bs = cyl(g, 0.1, 0.1, 0.06, GOLDC, 0.32, 0.4, -0.53, { ns: true, seg: 8 }); bs.rotation.x = Math.PI / 2;
    u.aura = sph(g, 0.78, '#ffe9a0', 0, 0.45, 0, { basic: true, a: 0.1, ns: true });
  } else if (kind === 'esplora') {
    cone(g, 0.36, 0.3, '#3f7a66', 0, 1.0, 0, { ns: true, seg: 10 }); cone(g, 0.04, 0.34, '#f4f1ea', -0.14, 1.2, 0.1, { ns: true, seg: 5 }).rotation.z = 0.5;
    const t = cyl(arm, 0.05, 0.035, 0.34, GOLDC, 0.3, 0.24, 0, { ns: true, seg: 6 }); t.rotation.z = -Math.PI / 2;
  } else if (ROLE_HAT[kind]) {
    // un mestiere: lo stesso cappello di paglia con un nastro del colore del mestiere, e in mano il suo attrezzo
    cone(g, 0.4, 0.13, '#e8cf7a', 0, 0.98, 0, { ns: true, seg: 10 }); cyl(g, 0.2, 0.22, 0.12, '#d9bd62', 0, 1.02, 0, { ns: true, seg: 8 }); cyl(g, 0.215, 0.225, 0.045, ROLE_HAT[kind], 0, 1.0, 0, { ns: true, seg: 8 });
    cyl(arm, 0.028, 0.028, 0.66, WOOD_D, 0.1, 0.28, 0, { ns: true, seg: 5 });
    if (kind === 'ascia') { box(arm, 0.24, 0.2, 0.04, IRON, 0.2, 0.55, 0, { ns: true }); box(arm, 0.05, 0.22, 0.05, '#e9edf5', 0.33, 0.55, 0, { ns: true }); }
    else if (kind === 'piccone') { const p = put(arm, geom('pick', () => new THREE.TorusGeometry(0.26, 0.03, 5, 10, Math.PI * 0.7)), M(IRON), 0.1, 0.36, 0, false); p.rotation.z = Math.PI * 0.15; }
    else if (kind === 'falce') { const p = put(arm, geom('sickle', () => new THREE.TorusGeometry(0.2, 0.022, 5, 10, Math.PI * 0.9)), M('#e9edf5'), 0.28, 0.6, 0, false); p.rotation.z = -Math.PI * 0.1; }
    else { box(arm, 0.26, 0.14, 0.14, IRON_D, 0.1, 0.6, 0, { ns: true }); }
  } else if (kind === 'eroina') {
    cone(g, 0.33, 0.42, '#19a08c', -0.03, 1.02, 0, { ns: true, seg: 10 }); crown(0.16, 0.92, GOLDC);
    box(g, 0.05, 0.62, 0.72, '#19a08c', -0.47, 0.38, 0, { ns: true }).rotation.z = -0.22;
    const b = put(arm, geom('bow', () => new THREE.TorusGeometry(0.3, 0.025, 5, 12, Math.PI)), M(GOLDC), 0.26, 0.14, 0, false); b.rotation.z = -Math.PI / 2;
    cyl(arm, 0.008, 0.008, 0.6, '#f4f1ea', 0.26, 0.14, 0, { ns: true });
    const q = cyl(g, 0.07, 0.07, 0.38, WOOD_D, -0.4, 0.62, -0.22, { ns: true }); q.rotation.z = 0.4;
    u.aura = sph(g, 0.74, '#a8fff0', 0, 0.45, 0, { basic: true, a: 0.1, ns: true });
  } else if (kind === 'ordigno') {
    // la catapulta nemica: un carro con le ruote e il braccio, spinto dal Tuzu che ci sta dietro
    cap(0.36, 0.86, IRON_D, 0.66);
    const car = grp(g, 0.95, 0, 0);
    box(car, 1.1, 0.14, 0.8, WOOD, 0, 0.3, 0, { ns: true });
    for (const [x, z] of [[-0.4, 0.44], [0.4, 0.44], [-0.4, -0.44], [0.4, -0.44]]) { const w = cyl(car, 0.24, 0.24, 0.1, WOOD_D, x, 0.24, z, { seg: 10, ns: true }); w.rotation.x = Math.PI / 2; }
    for (const z of [-0.3, 0.3]) { const p = box(car, 0.1, 0.7, 0.1, WOOD_D, 0.1, 0.66, z, { ns: true }); p.rotation.z = 0.2; }
    const a2 = u.arm = grp(car, 0.1, 0.95, 0);
    box(a2, 1.3, 0.09, 0.1, WOOD_L, -0.35, 0, 0, { ns: true }); ball(a2, 0.17, '#8d8f96', -0.98, 0.1, 0, { ns: true }); box(a2, 0.26, 0.26, 0.3, IRON_D, 0.36, -0.1, 0, { ns: true });
    g.userData = u;
    return g;
  } else if (kind === 'attrezzo') {
    cone(g, 0.4, 0.13, '#e8cf7a', 0, 0.98, 0, { ns: true, seg: 10 }); cyl(g, 0.2, 0.22, 0.12, '#d9bd62', 0, 1.02, 0, { ns: true, seg: 8 });
    cyl(arm, 0.028, 0.028, 0.62, WOOD_D, 0.1, 0.26, 0, { ns: true, seg: 5 }); box(arm, 0.22, 0.15, 0.05, IRON, 0.19, 0.55, 0, { ns: true });
  } else return null;
  g.userData = u;
  return g;
}

/** Una capanna: tonda col tetto a punta, oppure lunga col tetto a falde. Il tetto ha il colore del popolo. */
function makeHut(color, s, long, style = 'cono') {
  const g = grp(null);
  if (!long && style !== 'cono') {
    cyl(g, 20, 23, 18, '#e6d6b4', 0, 9, 0, { seg: 9 }); cyl(g, 24, 24, 2.4, WOOD_D, 0, 18.6, 0, { seg: 9, ns: true });
    if (style === 'cupola') { const d = sph(g, 24, color, 0, 19, 0); d.scale.y = 0.82; ball(g, 3.4, GOLDC, 0, 40, 0, { ns: true }); }
    else if (style === 'piatto') { cyl(g, 25, 25, 7, color, 0, 23, 0, { seg: 9 }); for (let i = 0; i < 6; i++) { const a = i * 1.047; box(g, 8, 6, 8, color, Math.cos(a) * 20, 29, Math.sin(a) * 20, { ns: true }); } }
    else if (style === 'guglia') { cone(g, 26, 14, color, 0, 26, 0, { seg: 9 }); cone(g, 13, 44, color, 0, 50, 0, { seg: 9 }); octa(g, 3, GOLDC, 0, 74, 0); }
    else { cone(g, 34, 13, color, 0, 25, 0, { seg: 9 }); cyl(g, 14, 16, 8, '#e6d6b4', 0, 33, 0, { seg: 9, ns: true }); cone(g, 24, 15, color, 0, 44, 0, { seg: 9 }); ball(g, 2.6, GOLDC, 0, 53, 0, { ns: true }); }      // pagoda
    box(g, 8, 13, 2, '#5c3a1e', 0, 6.5, 21.6, { ns: true });
    g.scale.setScalar(s);
    return g;
  }
  if (long) {
    box(g, 46, 4, 30, '#9a8f86', 0, 2, 0, { ns: true }); box(g, 42, 15, 26, '#e6d6b4', 0, 11, 0); roof(g, 52, 19, 36, color, 0, 18, 0);
    box(g, 54, 2, 3, WOOD_D, 0, 37.6, 0, { ns: true }); box(g, 8, 12, 2, '#5c3a1e', 4, 9.5, 13.4, { ns: true }); box(g, 7, 6, 2, '#ffd97a', -11, 12, 13.2, { ns: true, e: 0xffb040, ei: 0.7 });
  } else {
    cyl(g, 20, 23, 18, '#e6d6b4', 0, 9, 0, { seg: 9 }); cyl(g, 24, 24, 2.4, WOOD_D, 0, 18.6, 0, { seg: 9, ns: true });
    cone(g, 30, 27, color, 0, 32, 0, { seg: 9 }); cyl(g, 2.6, 3.4, 5, WOOD_D, 0, 47, 0, { seg: 5, ns: true });
    box(g, 8, 13, 2, '#5c3a1e', 0, 6.5, 21.6, { ns: true });
  }
  g.scale.setScalar(s);
  return g;
}
/** Il villaggio di un popolo: la casa del capo con lo stendardo, capanne sparse, covoni, pozzo, steccati, il fuoco. */
function makeVillage(T, rnd) {
  const g = grp(null), u = {}, col = T.color, dark = new THREE.Color(col).multiplyScalar(0.78).getStyle(), lite = new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.22).getStyle();
  const hall = grp(g);
  cyl(hall, 50, 54, 5, '#9a8f86', 0, 2.5, 0, { seg: 12, ns: true });
  cyl(hall, 43, 47, 34, '#e9dcc0', 0, 21, 0, { seg: 12 });
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; box(hall, 3, 34, 3, WOOD_D, Math.cos(a) * 45, 21, Math.sin(a) * 45, { ns: true }); }
  cyl(hall, 52, 52, 4, WOOD_D, 0, 39, 0, { seg: 12, ns: true });
  cone(hall, 60, 46, col, 0, 64, 0, { seg: 12 }); cone(hall, 34, 30, dark, 0, 86, 0, { seg: 12 });
  octa(hall, 7, GOLDC, 0, 106, 0, { e: 0x8a6410, ei: 0.4 });
  { const st = (TRAITS[T.id] || {}).roof; if (st === 'cupola') { const d = sph(hall, 20, lite, 0, 98, 0, { ns: true }); d.scale.y = 0.6; } else if (st === 'guglia') cone(hall, 9, 40, dark, 0, 118, 0, { seg: 8, ns: true }); else if (st === 'pagoda') cone(hall, 46, 10, lite, 0, 92, 0, { seg: 12, ns: true }); else if (st === 'piatto') for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box(hall, 9, 8, 9, dark, Math.cos(a) * 44, 45, Math.sin(a) * 44, { ns: true }); } }
  box(hall, 17, 25, 3, '#4a2f17', 0, 16, 46, { ns: true }); box(hall, 21, 3, 4, WOOD_D, 0, 30, 46, { ns: true });
  for (const x of [-25, 25]) box(hall, 9, 10, 3, '#ffd97a', x, 24, 41, { ns: true, e: 0xffb040, ei: 0.75 });
  cyl(g, 1.8, 2.2, 104, '#4a3020', 60, 52, 28, { ns: true, seg: 6 });
  u.flag = box(g, 32, 19, 1.2, col, 77, 93, 28, { ns: true });
  // capanne sparse: niente cerchio perfetto, e la strada verso il castello resta libera
  const out = Math.atan2(T.gate.r - T.r, T.gate.c - T.c), spots = [];
  for (let guard = 0; spots.length < 8 && guard < 300; guard++) {
    const a = rnd() * Math.PI * 2, rad = 104 + rnd() * 108, x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.92;
    let da = Math.abs(a - out); if (da > Math.PI) da = Math.PI * 2 - da; da = Math.min(da, Math.abs(da - Math.PI * 2));
    if (da < 0.45 || spots.some(p => Math.hypot(p.x - x, p.z - z) < 66)) continue;
    spots.push({ x, z });
    const h = makeHut([col, dark, lite][spots.length % 3], 0.8 + rnd() * 0.5, spots.length % 3 === 0, (TRAITS[T.id] || {}).roof);
    h.position.set(x, 0, z); h.rotation.y = Math.atan2(x, z) + Math.PI + (rnd() - 0.5) * 1.2; g.add(h);
  }
  const free = (x, z, d) => Math.hypot(x, z) > 74 && !spots.some(p => Math.hypot(p.x - x, p.z - z) < d);
  for (let i = 0, n = 0; n < 5 && i < 60; i++) {         // covoni
    const a = rnd() * 6.283, rad = 90 + rnd() * 110, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (!free(x, z, 44)) continue; n++;
    cyl(g, 8, 9, 9, '#e3c35a', x, 4.5, z, { seg: 8 }); cone(g, 9.5, 8, '#d1ae48', x, 13, z, { seg: 8 });
  }
  for (let i = 0, n = 0; n < 3 && i < 60; i++) {         // tratti di steccato
    const a = rnd() * 6.283, rad = 170 + rnd() * 34, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    let da = Math.abs(a - out); if (da > Math.PI) da = Math.PI * 2 - da;
    if (da < 0.6 || !free(x, z, 40)) continue; n++;
    const fg = grp(g, x, 0, z); fg.rotation.y = -a + Math.PI / 2;
    for (let k = -2; k <= 2; k++) cyl(fg, 2, 2.4, 15, WOOD_D, k * 15, 7.5, 0, { seg: 5 });
    box(fg, 62, 2.2, 1.8, WOOD_L, 0, 6, 0, { ns: true }); box(fg, 62, 2.2, 1.8, WOOD_L, 0, 12, 0, { ns: true });
  }
  { const a = out + 2.4, x = Math.cos(a) * 86, z = Math.sin(a) * 86;      // il pozzo
    cyl(g, 9, 10, 9, '#9a9ba4', x, 4.5, z, { seg: 8 }); cyl(g, 7, 7, 1, '#3fa7d6', x, 8.2, z, { seg: 8, ns: true });
    for (const dx of [-8, 8]) box(g, 2, 20, 2, WOOD_D, x + dx, 10, z, { ns: true }); roof(g, 24, 8, 16, dark, x, 20, z); }
  const fx = Math.cos(out) * 98, fz = Math.sin(out) * 98;
  for (let i = 0; i < 6; i++) { const a = i * 1.047; octa(g, 5, '#8d8f96', fx + Math.cos(a) * 11, 2.5, fz + Math.sin(a) * 11); }
  for (let i = 0; i < 3; i++) { const l = cyl(g, 2, 2, 16, WOOD_D, fx, 3, fz, { seg: 5, ns: true }); l.rotation.set(Math.PI / 2, 0, i * 1.05); }
  u.fire = cone(g, 6.5, 20, '#ff9d2a', fx, 12, fz, { ns: true, seg: 6, mat: { basic: true, a: 0.92 } });
  cone(g, 3.6, 12, '#ffe27a', fx, 9, fz, { ns: true, seg: 6, mat: { basic: true, a: 0.95 } });
  for (const k of [-1, 1]) { const a = out + k * 0.34, x = Math.cos(a) * 190, z = Math.sin(a) * 190;      // due stendardi all'ingresso
    cyl(g, 1.6, 2, 54, '#4a3020', x, 27, z, { seg: 5 }); box(g, 3, 20, 13, col, x, 42, z, { ns: true }).rotation.y = -a; octa(g, 3.4, GOLDC, x, 56, z); }
  g.userData = u;
  return g;
}

// ---------- edifici ----------
const WALLS = ['#f1e6cc', '#ecdcc0', '#f4ead6'], FLOWER = ['#ff8fb0', '#fff0a0', '#ff6f6f'];
/** Una casa a graticcio: zoccolo di pietra, travi a vista, tetto a falde con la gronda, camino, fiori alle finestre. */
function makeHouse(id, lvl = 0) {
  const g = grp(null), roofC = lvl >= 2 ? '#7b5cc9' : ROOFS[id % ROOFS.length], wall = WALLS[id % 3];
  box(g, 60, 5, 50, '#8f8f98', 0, 2.5, 0);
  box(g, 54, 24, 44, wall, 0, 17, 0);
  for (const x of [-27, 27]) for (const z of [-22, 22]) box(g, 3.2, 25, 3.2, WOOD_D, x, 17.5, z, { ns: true });
  box(g, 55.4, 2.6, 45.4, WOOD_D, 0, 16.4, 0, { ns: true }); box(g, 55.4, 2.6, 45.4, WOOD_D, 0, 28.6, 0, { ns: true });
  for (const x of [-21, 21]) { const d = box(g, 2.2, 15, 1, WOOD_D, x, 22.5, 22.3, { ns: true }); d.rotation.z = x > 0 ? 0.7 : -0.7; }
  roof(g, 44, 21, 54, wall, 0, 29, 0).rotation.y = Math.PI / 2;                                  // timpani
  for (const k of [-1, 1]) { const sl = box(g, 42, 3.4, 60, roofC, k * 16.4, 41.6, 0); sl.rotation.z = -k * 0.66; const ed = box(g, 42.6, 1.2, 61.6, '#7a3a26', k * 16.6, 39.6, 0, { ns: true }); ed.rotation.z = -k * 0.66; }
  box(g, 4.6, 3, 62, WOOD_D, 0, 54.6, 0, { ns: true });                                          // colmo
  for (const z of [-22.6, 22.6]) { box(g, 2.2, 20, 1, WOOD_D, 0, 39, z, { ns: true }); box(g, 30, 2.2, 1, WOOD_D, 0, 38, z, { ns: true }); }
  box(g, 8, 20, 8, '#9a8f86', 15, 48, -12); box(g, 10.4, 3, 10.4, '#6f6660', 15, 59, -12, { ns: true });
  box(g, 11, 17, 2, '#6b4226', -1, 13.5, 22.2, { ns: true }); box(g, 13.4, 2.2, 2.6, WOOD_D, -1, 22.8, 22.2, { ns: true }); box(g, 15, 2, 7, '#8f8f98', -1, 5.4, 25, { ns: true });
  octa(g, 1.1, GOLDC, 2.6, 13, 23.6);
  for (const x of [-17, 15]) {
    box(g, 9, 9, 1.6, '#ffd97a', x, 20, 22.2, { ns: true, e: 0xffb040, ei: 0.75 }); box(g, 1.1, 9, 2, WOOD_D, x, 20, 22.5, { ns: true }); box(g, 9, 1.1, 2, WOOD_D, x, 20, 22.5, { ns: true });
    box(g, 11, 2.6, 3.6, '#5f8f4a', x, 14, 23.4, { ns: true });
    for (let k = 0; k < 3; k++) ball(g, 1.7, FLOWER[(k + id) % 3], x - 3.4 + k * 3.4, 16.4, 24.2, { ns: true });
  }
  for (const z of [-9, 9]) { box(g, 1.6, 9, 9, '#ffd97a', 27.2, 20, z, { ns: true, e: 0xffb040, ei: 0.75 }); box(g, 2, 1.1, 9, WOOD_D, 27.4, 20, z, { ns: true }); }
  if (id % 3 === 0) { cyl(g, 4.6, 4.6, 9, WOOD, 30, 4.5, 20, { seg: 8 }); cyl(g, 4.9, 4.9, 1.2, '#55565e', 30, 6.6, 20, { seg: 8, ns: true }); }
  else if (id % 3 === 1) { for (let i = 0; i < 3; i++) { const l = cyl(g, 2.4, 2.4, 14, WOOD_L, -31.5, 2.4 + (i === 2 ? 4.2 : 0), -6 + (i === 2 ? 2.5 : i * 5), { seg: 6 }); l.rotation.x = Math.PI / 2; } }
  else { ball(g, 7.5, '#4c9c50', 31, 5, -14); ball(g, 5.5, '#57a857', 30, 4, -4); }
  if (lvl >= 1) {        // livello 2: un'ala in più col suo tettuccio e un abbaino
    box(g, 22, 18, 26, wall, -36, 13, -6); const sl = box(g, 27, 3, 31, roofC, -37, 24.5, -6); sl.rotation.z = 0.5; box(g, 1.4, 8, 8, '#ffd97a', -47.4, 14, -6, { ns: true, e: 0xffb040, ei: 0.75 });
    box(g, 9, 9, 9, wall, -15, 46, 14, { ns: true }); roof(g, 12, 6, 11, roofC, -15, 50.5, 14); box(g, 5, 5, 1.2, '#ffd97a', -15, 46, 18.8, { ns: true, e: 0xffb040, ei: 0.75 });
  }
  if (lvl >= 2) {        // livello 3: una torretta col tetto viola e la bandiera del tuo popolo
    cyl(g, 9, 10, 46, wall, 30, 27, -18, { seg: 9 }); cyl(g, 10.6, 10.6, 2.4, WOOD_D, 30, 49, -18, { seg: 9, ns: true }); cone(g, 13, 18, roofC, 30, 60, -18, { seg: 9 });
    cyl(g, 0.8, 0.8, 16, WOOD_D, 30, 76, -18, { seg: 5, ns: true }); box(g, 10, 6, 0.8, MY_COLOR, 35.4, 80, -18, { ns: true });
    box(g, 4, 6, 1.2, '#ffd97a', 30, 36, -8.4, { ns: true, e: 0xffb040, ei: 0.75 });
  }
  g.scale.setScalar(1.2 + lvl * 0.03);
  return g;
}
/** Un edificio migliorato si riconosce: uno stendardo viola al livello 2, due con la punta d'oro al livello 3. */
function levelMarks(g, lvl, w = 34, h = 44) {
  for (let k = 0; k < lvl; k++) {
    const x = (k ? -1 : 1) * w, z = -w * 0.7;
    cyl(g, 1.3, 1.6, h + 26, WOOD_D, x, (h + 26) / 2, z, { seg: 6 }); box(g, 14, 20, 1, MY_COLOR, x + 8, h + 12, z, { ns: true });
    if (lvl >= 2) octa(g, 3.2, GOLDC, x, h + 29, z);
  }
  if (lvl >= 2) for (const [x, z] of [[-w, w * 0.8], [w, w * 0.8]]) { cyl(g, 4, 5, 9, '#8f8f98', x, 4.5, z, { seg: 8 }); ball(g, 4.4, GOLDC, x, 12, z, { e: 0x8a6410, ei: 0.35 }); }
}
const ROT_Q = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * Math.PI / 4));
const RAIL_Q = [0, 1, 2, 3].map(i => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * Math.PI / 2));

// ---------- navi ----------
/** Lo scafo: una barca vera, con la prua a punta, la poppa tronca e il bordo che sale alle estremità. Lunga L (lungo z, prua verso +z), larga B, alta H. */
function hullGeo(L, B, H) {
  const n = 10, st = [], v = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, z = (t - 0.5) * L, w = (B / 2) * (t < 0.2 ? 0.7 + 0.3 * t / 0.2 : Math.pow(Math.max(0, 1 - Math.pow((t - 0.2) / 0.8, 2.3)), 0.85));
    st.push([z, Math.max(0.05, w), H * (1 + 0.34 * Math.pow(Math.abs(2 * t - 1), 2)), -H * 0.4 + H * 1.1 * Math.pow(Math.max(0, t - 0.6) / 0.4, 2.2)]);
  }
  const tri = (a, b, c) => v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < n; i++) {
    const [z0, w0, d0, k0] = st[i], [z1, w1, d1, k1] = st[i + 1];
    const L0 = [-w0, d0, z0], R0 = [w0, d0, z0], K0 = [0, k0, z0], L1 = [-w1, d1, z1], R1 = [w1, d1, z1], K1 = [0, k1, z1];
    tri(L0, K0, K1); tri(L0, K1, L1); tri(R0, K1, K0); tri(R0, R1, K1); tri(L0, L1, R1); tri(L0, R1, R0);
  }
  { const [z0, w0, d0, k0] = st[0]; tri([-w0, d0, z0], [w0, d0, z0], [0, k0, z0]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  return g;
}
/** Una vela gonfia di vento (visibile da tutte e due le parti). w × h, pancia verso +z; taper = 1 la fa triangolare. */
function sailGeo(w, h, belly, taper = 0) {
  const nu = 4, nv = 4, P = (i, j) => { const u = i / nu, q = j / nv; return [(u - 0.5) * w * (1 - taper * q), q * h, belly * Math.sin(Math.PI * u) * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, q * 1.05)))]; }, v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); tri(a, b, c); tri(a, c, d); tri(a, c, b); tri(a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  return g;
}
const SHIP_LOOK = { mercantile: ['#9b6b3d', '#e2b866', '#f4ecd6'], veliero: ['#2f6fa8', '#f4f1ea', '#ffffff'], guerra: ['#4a3a34', '#c0392b', '#c0392b'], pesca: ['#b5482f', '#f4f1ea', '#f4f1ea'] };
/** Una nave: scafo, coperta, alberi e vele; cresce con il livello (più lunga, più alberi, castello di poppa, bandiere). La prua guarda +z. */
function makeShip(kind, lvl = 0) {
  const g = grp(null), small = kind === 'pesca', L = small ? 30 : 42 + lvl * 4.5, B = Math.round(L * 0.36), H = Math.round(L * 0.17), [hull, trim, sail] = SHIP_LOOK[kind] || SHIP_LOOK.mercantile;
  put(g, geom('hull' + L, () => hullGeo(L, B, H)), M(hull, { flat: true }), 0, 0, 0);
  box(g, B * 0.72, 1, L * 0.62, WOOD_L, 0, H * 1.02, -L * 0.04, { ns: true });                                  // la coperta
  for (const sx of [-1, 1]) box(g, 1.2, 1.6, L * 0.6, trim, sx * B * 0.43, H * 1.12, -L * 0.05, { ns: true });  // il bordo colorato
  if (!small && (lvl >= 1 || kind === 'guerra')) { box(g, B * 0.74, H * 0.8, L * 0.2, hull, 0, H * 1.42, -L * 0.37); box(g, B * 0.8, 1.2, L * 0.22, trim, 0, H * 1.86, -L * 0.37, { ns: true }); ball(g, 1.5, '#ffd97a', 0, H * 2.2, -L * 0.46, { ns: true, e: 0xffb040, ei: 0.9 }); }
  const masts = small ? 1 : lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1;
  for (let i = 0; i < masts; i++) {
    const mid = (masts - 1) / 2, mz = masts === 1 ? L * 0.03 : (i - mid) * L * 0.29 + L * 0.02, mh = Math.round(L * (0.98 - Math.abs(i - mid) * 0.14));
    cyl(g, 0.8, 1.2, mh, WOOD_D, 0, H + mh / 2, mz, { seg: 6, ns: true });
    if (kind === 'veliero' || small) {        // vela triangolare, lungo la nave
      const sm = put(g, geom('sailT' + mh, () => sailGeo(mh * 0.62, mh * 0.8, mh * 0.1, 1)), M(sail), 1.2, H + mh * 0.12, mz + mh * 0.3, false); sm.rotation.y = -Math.PI / 2;
      if (!small && i === masts - 1) { const jib = put(g, geom('sailJ' + mh, () => sailGeo(mh * 0.4, mh * 0.6, mh * 0.07, 1)), M(trim), 1, H + mh * 0.16, mz + mh * 0.74, false); jib.rotation.y = -Math.PI / 2; }
    } else {                                  // vele quadre, di traverso: una grande e sopra, dal livello 3, una piccola
      const sw = Math.round(B * 1.5), sh = Math.round(mh * (lvl >= 2 ? 0.44 : 0.6));
      const brace = 0.5;
      put(g, geom('sailQ' + sw + '|' + sh, () => sailGeo(sw, sh, sw * 0.18)), M(sail), 0, H + mh * 0.16, mz + 1.4, false).rotation.y = brace;
      const yard = cyl(g, 0.6, 0.6, sw * 1.06, WOOD_D, 0, H + mh * 0.16 + sh, mz + 1, { seg: 5, ns: true }); yard.rotation.z = Math.PI / 2; yard.rotation.y = brace;
      if (lvl >= 2) (put(g, geom('sailQ' + Math.round(sw * 0.7) + '|' + Math.round(sh * 0.6), () => sailGeo(Math.round(sw * 0.7), Math.round(sh * 0.6), sw * 0.12)), M(kind === 'guerra' ? '#f4ecd6' : trim), 0, H + mh * 0.2 + sh, mz + 1.4, false)).rotation.y = brace;
    }
    box(g, 0.6, 3.6, 7.5, i === Math.floor(mid) ? MY_COLOR : trim, 0, H + mh + 1.4, mz - 3.8, { ns: true });         // la bandiera
  }
  if (!small) { const bs = cyl(g, 0.6, 0.8, L * 0.3, WOOD_D, 0, H * 1.55, L * 0.52, { seg: 5, ns: true }); bs.rotation.x = Math.PI / 2 - 0.32; }
  if (kind === 'mercantile') { box(g, 5, 5, 5, '#d9b46a', -B * 0.14, H * 1.02 + 3, L * 0.2, { ns: true }); box(g, 4.4, 4.4, 4.4, '#c08e58', B * 0.16, H * 1.02 + 2.7, L * 0.25, { ns: true }); cyl(g, 2.6, 2.6, 5.4, WOOD, B * 0.05, H * 1.02 + 3, -L * 0.14, { seg: 8, ns: true }); if (lvl >= 3) box(g, 6, 5, 6, '#b5482f', 0, H * 1.02 + 3, L * 0.1, { ns: true }); }
  if (kind === 'guerra') {
    const nc = 2 + Math.min(2, lvl >> 1);
    for (const sx of [-1, 1]) for (let k = 0; k < nc; k++) { const cz = (k - (nc - 1) / 2) * L * 0.16, cn = cyl(g, 1.3, 1.6, 6, '#22201f', sx * B * 0.5, H * 0.72, cz, { seg: 6, ns: true }); cn.rotation.z = Math.PI / 2; box(g, 0.6, 3.4, 3.4, k % 2 ? '#f2c230' : '#c0392b', sx * B * 0.47, H * 1.34, cz + L * 0.06, { ns: true }); }
    if (lvl >= 3) { const ram = cone(g, 2.2, 9, GOLDC, 0, H * 0.3, L * 0.5, { seg: 6, ns: true }); ram.rotation.x = Math.PI / 2; }
  }
  if (kind === 'pesca') for (let i = 0; i < 3; i++) ball(g, 1.8, '#9fd8ef', (i - 1) * 3, H * 1.02 + 1.6, -L * 0.2, { ns: true });
  return g;
}

/** Il Porticciolo: la capanna dei pescatori su un pontile, le reti, le casse, un lampione; una barca da pesca va e viene,
 *  e se una nave della flotta è qui all'ormeggio la si vede. A ogni livello: una bandiera, poi il tetto nuovo e un secondo molo. */
function makePort(lvl = 0, ships) {
  const g = grp(null), u = {};
  box(g, 72, 5, 36, WOOD, 0, 5, 12); for (const [x, z] of [[-31, 27], [31, 27], [-31, -3], [31, -3], [0, 27]]) cyl(g, 3, 3.6, 13, WOOD_D, x, 4, z, { seg: 6 });
  for (let i = -3; i <= 3; i++) box(g, 9.4, 0.8, 34, i % 2 ? WOOD_L : '#b07f4c', i * 10, 7.8, 12, { ns: true });                    // le assi
  box(g, 16, 3, 46, WOOD_L, 0, 5.6, 48); for (const z of [34, 50, 66]) for (const x of [-8, 8]) cyl(g, 2.2, 2.7, 14, WOOD_D, x, 4, z, { seg: 6 });
  box(g, 36, 19, 26, '#efe2c4', -14, 17, -12); roof(g, 42, 14, 32, lvl >= 2 ? '#b5482f' : '#3f7fb5', -14, 26.5, -12); box(g, 8, 12, 1.6, '#6b4226', -14, 13.5, 1.4, { ns: true });
  box(g, 6, 6, 1.4, '#ffd97a', -25, 18, 1.4, { ns: true, e: 0xffb040, ei: 0.7 }); cyl(g, 2.2, 2.6, 9, '#8d8479', -2, 32, -16, { seg: 6 });                          // la finestra accesa, il camino
  for (const x of [14, 30]) cyl(g, 1.2, 1.5, 27, WOOD_D, x, 16.5, -12, { seg: 5 }); { const net = put(g, geom('net', () => sailGeo(18, 13, 2.4)), M('#d9d2b8'), 22, 13, -12, false); net.rotation.y = 0.04; }   // la rete stesa
  for (const [x, z] of [[20, 10], [27, 15]]) { cyl(g, 4.2, 4.2, 8, WOOD, x, 11.6, z, { seg: 8 }); cyl(g, 4.5, 4.5, 1, '#55565e', x, 13.2, z, { seg: 8, ns: true }); }
  box(g, 7, 6, 7, '#d9b46a', 8, 11, 20, { ns: true }); box(g, 5.4, 5, 5.4, '#c08e58', 9, 16.4, 20, { ns: true });
  cyl(g, 1.1, 1.4, 24, WOOD_D, -30, 19, 26, { seg: 5 }); ball(g, 2.8, '#ffe27a', -30, 32, 26, { ns: true, e: 0xffc040, ei: 1 });                                 // il lampione del molo
  for (let i = 0; i < 3; i++) ball(g, 2.2, '#9fd8ef', -4 + i * 4, 9.6, 19, { ns: true });
  { const row = grp(g, 22, 1.2, 40); put(row, geom('hull18', () => hullGeo(18, 7, 3)), M('#7a5230', { flat: true }), 0, 0, 0, false); row.rotation.y = 0.5; }       // una barchetta a remi legata al molo
  if (lvl >= 1) { cyl(g, 1.2, 1.5, 34, WOOD_D, -36, 22, -24, { seg: 5 }); box(g, 0.7, 9, 13, MY_COLOR, -36, 33, -17, { ns: true }); }
  if (lvl >= 2) { box(g, 14, 3, 40, WOOD_L, -28, 5.6, 46); for (const z of [34, 62]) cyl(g, 2.2, 2.7, 14, WOOD_D, -36, 4, z, { seg: 6 }); octa(g, 3, GOLDC, -14, 42, -12); }
  const boat = u.boat = makeShip('pesca'); boat.position.set(-22, 1, 100); g.add(boat);
  u.moored = [];
  if (ships && ships[0]) { const m = makeShip(ships[0].type, ships[0].lvl); m.position.set(34, 1, 62); m.scale.setScalar(0.8); g.add(m); u.moored.push(m); }
  g.userData = u;
  return g;
}
/** Il Porto: banchina di pietra, magazzini, il faro con la luce che gira, la gru, e le navi della flotta all'ormeggio (fino a tre).
 *  Cresce a ogni livello: la gru, un secondo magazzino, il faro più alto, le bandiere, i fregi d'oro. */
function makeBigPort(lvl = 0, ships) {
  const g = grp(null), u = {}, S1 = '#a9aab6', S2 = '#c4c5d0';
  box(g, 116, 8, 44, S1, 0, 4, 10); box(g, 118, 2, 46, S2, 0, 8.6, 10, { ns: true });                                                   // la banchina di pietra
  for (let i = -5; i <= 5; i++) cyl(g, 2.2, 2.6, 5, '#55565e', i * 11, 11.4, 30, { seg: 6, ns: true });                                   // le bitte
  for (const x of [-34, 4, 42]) { box(g, 14, 3, 56, WOOD_L, x, 6, 58); for (const z of [38, 56, 80]) for (const q of [-7, 7]) cyl(g, 2.2, 2.7, 15, WOOD_D, x + q, 4, z, { seg: 6 }); }      // tre moli
  box(g, 40, 22, 26, '#efe2c4', -30, 20.5, -6); roof(g, 46, 15, 32, '#3f7fb5', -30, 31.5, -6); box(g, 10, 14, 1.6, '#6b4226', -30, 16.5, 7.4, { ns: true });
  for (const x of [-42, -18]) box(g, 6, 6, 1.4, '#ffd97a', x, 22, 7.4, { ns: true, e: 0xffb040, ei: 0.7 });
  box(g, 30, 20, 24, '#d9c7a0', 12, 19.5, -8); roof(g, 36, 12, 30, '#b5482f', 12, 29.5, -8); box(g, 12, 13, 1.6, '#55402a', 12, 16, 4.4, { ns: true });               // il magazzino
  if (lvl >= 2) { box(g, 24, 16, 20, '#e6d6b0', 40, 17.5, -10); roof(g, 30, 10, 26, '#6b8f4a', 40, 25.5, -10); }
  // il faro: più alto a ogni livello, a fasce bianche e rosse, con la luce che gira
  { const fh = 44 + lvl * 7, fx = -52, fz = -12;
    cyl(g, 9, 10.5, 8, S1, fx, 12.5, fz, { seg: 10 });
    for (let k = 0; k < 4; k++) cyl(g, 6.2 - k * 0.5, 6.8 - k * 0.5, fh / 4, k % 2 ? '#c0392b' : '#f4f1ea', fx, 16.5 + fh / 8 + k * fh / 4, fz, { seg: 10 });
    cyl(g, 7.4, 7.4, 2, '#55565e', fx, 17.5 + fh, fz, { seg: 10, ns: true }); cyl(g, 3.6, 3.6, 7, '#ffe27a', fx, 22 + fh, fz, { seg: 8, ns: true, mat: { e: 0xffc040, ei: 1 } }); cone(g, 6.4, 8, '#c0392b', fx, 29.5 + fh, fz, { seg: 10, ns: true });
    const beam = u.beam = grp(g, fx, 22 + fh, fz); const bm = put(beam, geom('beam', () => new THREE.ConeGeometry(9, 70, 10, 1, true)), M('#fff3c4', { basic: true, a: 0.16, double: true }), 0, 0, 38, false); bm.rotation.x = -Math.PI / 2; }
  // casse, botti, sacchi
  for (const [x, z, col] of [[-6, 22, '#d9b46a'], [0, 24, '#c08e58'], [-3, 23, '#d9b46a']]) box(g, 7, 6.5, 7, col, x, 12.9 + (col === '#d9b46a' && x === -3 ? 6.5 : 0), z, { ns: true });
  for (const [x, z] of [[24, 24], [31, 22], [27.5, 27]]) { cyl(g, 4, 4, 8, WOOD, x, 13.6, z, { seg: 8 }); cyl(g, 4.3, 4.3, 1, '#55565e', x, 15, z, { seg: 8, ns: true }); }
  if (lvl >= 1) {        // la gru: palo, braccio, fune e una cassa appesa
    cyl(g, 2, 2.8, 40, WOOD_D, 52, 29.6, 20, { seg: 6 }); const arm = box(g, 3, 3, 34, WOOD_D, 52, 46, 34, { ns: true }); arm.rotation.x = -0.28;
    cyl(g, 0.4, 0.4, 20, '#3d2a17', 52, 40, 48, { seg: 4, ns: true }); box(g, 7, 6, 7, '#d9b46a', 52, 28, 48, { ns: true });
  }
  // bandiere (una in più a ogni livello) e, in cima, i fregi d'oro
  for (let k = 0; k <= Math.min(3, lvl); k++) { const x = -44 + k * 30, z = -22; cyl(g, 1.1, 1.4, 30, WOOD_D, x, 44 + (k === 0 ? 4 : 0), z, { seg: 5 }); box(g, 0.7, 9, 14, k % 2 ? '#f4ecd6' : MY_COLOR, x, 54 + (k === 0 ? 4 : 0), z + 7.4, { ns: true }); }
  if (lvl >= 3) for (const x of [-30, 12]) octa(g, 3.4, GOLDC, x, 49 - (x > 0 ? 5 : 0), -6 - (x > 0 ? 2 : 0));
  if (lvl >= 4) { box(g, 120, 1.6, 2, GOLDC, 0, 10.4, 32.4, { ns: true }); for (const x of [-58, 58]) { cyl(g, 3, 3.6, 12, S2, x, 15, 30, { seg: 8 }); ball(g, 4, GOLDC, x, 23, 30, { e: 0x8a6410, ei: 0.4 }); } }
  // le navi all'ormeggio
  u.moored = [];
  (ships || []).slice(0, 3).forEach((sh, i) => { const m = makeShip(sh.type, sh.lvl); m.position.set([-15, 23, 61][i], 1, 62); g.add(m); u.moored.push(m); });
  g.userData = u;
  return g;
}

/** Il castello: mastio merlato, quattro torri d'angolo coi tetti viola del tuo popolo, portone, stendardi. */
function makeCastle(level) {
  const g = grp(null), ROOF = '#7b5cc9', ROOF_D = '#6247a8', S1 = '#a9aab6', S2 = '#bfc0cc', S3c = '#8f909c', rr = mulberry32(5);
  box(g, 124, 6, 104, S3c, 0, 3, 0);
  box(g, 92, 58, 72, S1, 0, 35, 0);
  box(g, 96, 3.4, 76, S3c, 0, 62.4, 0, { ns: true });
  for (let i = 0; i < 6; i++) for (const z of [-34, 34]) box(g, 9, 8, 6, S2, -40 + i * 16, 68, z, { ns: true });
  for (let i = 0; i < 4; i++) for (const x of [-44, 44]) box(g, 6, 8, 9, S2, x, 68, -24 + i * 16, { ns: true });
  for (let i = 0; i < 18; i++) box(g, 8 + rr() * 5, 4.6, 1.8, i % 2 ? S2 : S3c, -40 + rr() * 80, 10 + rr() * 46, 36.3, { ns: true });
  for (const [x, z] of [[-50, -38], [50, -38], [-50, 38], [50, 38]]) {
    cyl(g, 17, 21, 84, S2, x, 42, z, { seg: 10 }); cyl(g, 20.5, 20.5, 5, S3c, x, 85, z, { seg: 10, ns: true });
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; box(g, 6, 7, 6, S2, x + Math.cos(a) * 17, 91, z + Math.sin(a) * 17, { ns: true }); }
    cone(g, 18, 36, z > 0 ? ROOF : ROOF_D, x, 106, z, { seg: 10 });
    octa(g, level >= 3 ? 4.4 : 2.6, level >= 3 ? GOLDC : S2, x, 126, z);
    box(g, 3, 10, 1.4, '#3a2f3f', x, 58, z + (z > 0 ? 19.4 : -19.4), { ns: true });
    cyl(g, 22, 23, 4, S3c, x, 2, z, { seg: 10, ns: true });
  }
  box(g, 32, 46, 7, S2, 0, 23, 38); box(g, 36, 4, 9, S3c, 0, 47.6, 38, { ns: true });
  for (let i = 0; i < 3; i++) box(g, 7, 6, 7, S2, -12 + i * 12, 52.4, 38, { ns: true });
  box(g, 20, 28, 2, '#3a2416', 0, 14, 41.8, { ns: true });
  { const a = cyl(g, 10, 10, 2, '#3a2416', 0, 28, 41.8, { seg: 12, ns: true }); a.rotation.x = Math.PI / 2; }
  for (const x of [-5, 0, 5]) box(g, 1.3, 36, 2.6, '#22140c', x, 18, 42.2, { ns: true });
  for (const y of [9, 21]) box(g, 20, 1.8, 2.8, '#55565e', 0, y, 42.4, { ns: true });
  for (const x of [-20, 20]) { box(g, 2, 9, 2, WOOD_D, x, 30, 42.4, { ns: true }); octa(g, 3.2, '#ffb040', x, 37, 42.4, { e: 0xff7a00, ei: 1 }); }
  for (const x of [-31, 31]) {
    box(g, 9, 13, 2, '#ffd97a', x, 46, 36.6, { ns: true, e: 0xffb040, ei: 0.75 }); box(g, 11.4, 2, 3.2, S3c, x, 38.8, 36.8, { ns: true });
    box(g, 10, 21, 1, MY_COLOR, x, 23, 36.9, { ns: true }); box(g, 11.4, 2, 1.6, WOOD_D, x, 34, 37, { ns: true });
    if (level >= 4) box(g, 10, 2.4, 1.3, GOLDC, x, 14.4, 37.2, { ns: true });
  }
  for (const z of [-18, 0, 18]) for (const x of [-46.4, 46.4]) box(g, 1.6, 11, 6, '#ffd97a', x, 44, z, { ns: true, e: 0xffb040, ei: 0.7 });
  let top = 66;
  if (level >= 2) {
    box(g, 42, 36, 42, S2, 0, 82, -6); box(g, 46, 3.4, 46, S3c, 0, 100.6, -6, { ns: true });
    for (let i = 0; i < 3; i++) for (const k of [-1, 1]) { box(g, 8, 7, 6, S2, -15 + i * 15, 105.6, -6 + k * 20, { ns: true }); box(g, 6, 7, 8, S2, k * 20, 105.6, -21 + i * 15, { ns: true }); }
    for (const x of [-10, 10]) box(g, 6, 11, 1.6, '#ffd97a', x, 86, 15.2, { ns: true, e: 0xffb040, ei: 0.7 });
    pyramid(g, 27, 32, ROOF, 0, 118, -6); top = 134;
  }
  cyl(g, 1.6, 1.6, 46, '#4a3020', 0, top + 20, -6, { ns: true, seg: 6 });
  box(g, 28, 16, 1, level >= 5 ? GOLDC : MY_COLOR, 14.6, top + 34, -6, { ns: true });
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
  box(g, 70, 4, 62, '#b89a6a', 0, 2, 0);
  for (const [x, z] of [[-29, -26], [29, -26], [-29, 6], [29, 6]]) cyl(g, 2.8, 3.2, 34, WOOD_D, x, 19, z, { seg: 6 });
  for (const k of [-1, 1]) { const sl = box(g, 40, 3.2, 44, '#c2512f', k * 17, 46, -10); sl.rotation.z = -k * 0.5; }
  box(g, 4.4, 3, 46, WOOD_D, 0, 56, -10, { ns: true });
  box(g, 46, 10, 15, WOOD, 0, 9, -10);
  u.blade = cyl(g, 12, 12, 1.6, '#d5d9e2', 0, 19, -10, { seg: 16 }); u.blade.rotation.x = Math.PI / 2;
  for (const [y, z] of [[7.5, 17], [7.5, 28], [16, 22.5]]) { const l = cyl(g, 5.4, 5.4, 42, '#9b6b3d', 0, y, z, { seg: 8 }); l.rotation.z = Math.PI / 2; }
  for (const x of [-21.6, 21.6]) for (const [y, z] of [[7.5, 17], [7.5, 28], [16, 22.5]]) { const e = cyl(g, 3.8, 3.8, 0.7, '#e2c08c', x, y, z, { ns: true, seg: 8 }); e.rotation.z = Math.PI / 2; }
  for (let i = 0; i < 4; i++) box(g, 22, 1.6, 9, i % 2 ? WOOD_L : '#d7ab73', -22, 5 + i * 1.8, -24 + (i % 2), { ns: true });      // assi già tagliate
  g.userData = u;
  return g;
}

function makeQuarry() {
  const g = grp(null);
  box(g, 70, 3, 62, '#9c968a', 0, 1.5, 0, { ns: true });
  const rock = (x, y, z, r, sx, sy, sz, col) => { const m = ball(g, r, col, x, y, z); m.scale.set(sx, sy, sz); return m; };
  rock(-15, 12, -11, 19, 1.2, 0.95, 1.05, '#8d8f96'); rock(-7, 24, -15, 11, 1.15, 1, 1, '#a2a4ac'); rock(9, 8, -20, 12, 1.2, 0.85, 1, '#7d7f86'); rock(-26, 5, 4, 8, 1.1, 0.8, 1, '#9a9ca4');
  box(g, 16, 10, 12, '#b9bac4', 17, 8, 15); box(g, 14, 9, 12, '#a9aab4', 2, 7.5, 21); box(g, 14, 9, 11, '#c4c5cf', 15, 18, 16);      // i blocchi già squadrati
  cyl(g, 2.6, 3.2, 46, WOOD_D, 28, 23, -6, { seg: 8 });                                                                              // la gru
  box(g, 36, 3.4, 3.4, WOOD, 13, 46, -6, { ns: true });
  { const br = box(g, 20, 2.4, 2.4, WOOD_D, 21, 38.5, -6, { ns: true }); br.rotation.z = -0.8; }
  cyl(g, 0.7, 0.7, 19, '#3d2a17', 0, 36, -6, { ns: true, seg: 5 });
  box(g, 9, 8, 8, '#c4c5cf', 0, 23, -6);
  box(g, 17, 6, 12, WOOD, -20, 9, 24); box(g, 19, 1.6, 14, WOOD_D, -20, 5.4, 24, { ns: true });                                     // il carretto
  for (const z of [17, 31]) { const w = cyl(g, 4.6, 4.6, 2, '#4c2f17', -20, 4.6, z, { seg: 10 }); w.rotation.x = Math.PI / 2; }
  ball(g, 4.2, '#a9aab4', -23, 14, 23, { ns: true }); ball(g, 3.6, '#8d8f96', -17, 14, 25.5, { ns: true }); ball(g, 3, '#c4c5cf', -20, 16.6, 22, { ns: true });
  return g;
}

function makeBarracks() {
  const g = grp(null);
  box(g, 72, 5, 62, '#8a8b94', 0, 2.5, 0);
  box(g, 60, 26, 48, '#a3a4ae', 0, 18, 0);
  box(g, 64, 3.4, 52, '#7d7e8a', 0, 31.6, 0, { ns: true });
  for (let i = 0; i < 5; i++) for (const z of [-24, 24]) box(g, 8, 7, 6, '#bcbdc8', -26 + i * 13, 36.4, z, { ns: true });
  for (let i = 0; i < 3; i++) for (const x of [-30, 30]) box(g, 6, 7, 8, '#bcbdc8', x, 36.4, -13 + i * 13, { ns: true });
  for (const [x, z] of [[-32, -26], [32, -26], [-32, 26], [32, 26]]) { cyl(g, 9, 11, 46, '#b4b5c0', x, 23, z, { seg: 8 }); cone(g, 11.5, 18, '#b0372a', x, 55, z, { seg: 8 }); }
  box(g, 36, 14, 26, '#8f909c', 0, 38, 0); roof(g, 26, 14, 36, '#8f909c', 0, 45, 0).rotation.y = Math.PI / 2;
  for (const k of [-1, 1]) { const sl = box(g, 26, 3, 34, '#b0372a', k * 10.4, 53.4, 0); sl.rotation.z = -k * 0.62; }
  box(g, 16, 22, 2.4, '#3a2416', 0, 16, 24.6, { ns: true }); box(g, 20, 3, 3.4, WOOD_D, 0, 28, 24.8, { ns: true });
  for (const [x, col] of [[-19, '#c2452d'], [19, MY_COLOR]]) { const sh = cyl(g, 7, 7, 2, col, x, 19, 24.8, { ns: true, seg: 10 }); sh.rotation.x = Math.PI / 2; const b = cyl(g, 2.4, 2.4, 2.8, GOLDC, x, 19, 25.2, { ns: true, seg: 8 }); b.rotation.x = Math.PI / 2; }
  cyl(g, 1.4, 1.4, 34, '#4a3020', 0, 72, 0, { ns: true, seg: 6 }); box(g, 20, 12, 1, MY_COLOR, 10.6, 82, 0, { ns: true });
  // il manichino e la rastrelliera delle armi
  cyl(g, 1.6, 1.6, 20, WOOD_D, -30, 10, 36, { seg: 5 }); ball(g, 5, '#e3c35a', -30, 22, 36); box(g, 14, 2.4, 2.4, WOOD_D, -30, 15, 36, { ns: true });
  box(g, 22, 2, 3, WOOD, 26, 12, 36, { ns: true }); for (const x of [18, 34]) box(g, 2, 14, 3, WOOD_D, x, 7, 36, { ns: true });
  for (let i = 0; i < 3; i++) { cyl(g, 0.8, 0.8, 22, WOOD_L, 20 + i * 6, 12, 37.6, { ns: true, seg: 4 }); cone(g, 1.8, 5, '#e1e5ee', 20 + i * 6, 25, 37.6, { ns: true, seg: 5 }); }
  g.scale.setScalar(0.96);
  return g;
}

/** Le rovine: colonne spezzate attorno a un forziere, che sparisce quando l'hai preso. */
function makeRuin(id) {
  const g = grp(null), u = {}, rr = mulberry32(900 + id);
  box(g, 76, 4, 60, '#9a9588', 0, 2, 0, { ns: true });
  for (let i = 0; i < 5; i++) { const a = i * 1.257 + rr(), h = 14 + rr() * 34, x = Math.cos(a) * 26, z = Math.sin(a) * 20; cyl(g, 5.4, 6.4, h, '#c9c4b4', x, 4 + h / 2, z, { seg: 8 }); if (h > 30) cyl(g, 7.4, 7.4, 3.4, '#b5b0a0', x, 5.6 + h, z, { seg: 8, ns: true }); }
  for (let i = 0; i < 4; i++) { const b = box(g, 12, 8, 9, i % 2 ? '#b5b0a0' : '#a39e90', -30 + rr() * 60, 7, -22 + rr() * 44); b.rotation.set(rr() * 0.6, rr() * 3, rr() * 0.4); }
  for (let i = 0; i < 3; i++) ball(g, 5 + rr() * 3, '#57a857', -32 + rr() * 64, 4, -26 + rr() * 52, { ns: true });
  const ch = u.chest = grp(g, 0, 4, 2);
  box(ch, 16, 10, 11, '#8a5a33', 0, 5, 0); box(ch, 17, 4, 12, '#6f4526', 0, 11, 0, { ns: true }); box(ch, 3, 5, 12.6, GOLDC, 0, 8, 0, { ns: true });
  u.glow = ball(ch, 5, '#ffe27a', 0, 20, 0, { basic: true, a: 0.5, ns: true });
  g.userData = u;
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
  for (const [x, z] of [[-28, -20], [28, -20], [-28, 20], [28, 20]]) { cyl(g, 2.4, 2.9, 38, WOOD_D, x, 19, z, { seg: 8 }); ball(g, 3.2, GOLDC, x, 40.4, z, { ns: true }); }
  for (let i = 0; i < 6; i++) {
    const col = i % 2 ? '#f4f1ea' : '#c2452d', x = -27.5 + i * 11, y = 41 - Math.abs(i - 2.5) * 1.9;
    const b = box(g, 11, 2.6, 50, col, x, y, 0); b.rotation.z = (i - 2.5) * -0.075;
    for (const z of [-25.4, 25.4]) { const d = cyl(g, 5.5, 5.5, 1.8, col, x, y - 1.6, z, { seg: 10, ns: true }); d.rotation.x = Math.PI / 2; }      // il bordo a festoni
  }
  box(g, 50, 12, 14, WOOD, 0, 6, 12);
  box(g, 52, 2, 16, WOOD_L, 0, 13, 12, { ns: true });
  for (const [x, col] of [[-17, '#e8c64a'], [-5, '#f08a2a'], [7, '#7a3fb0']]) { for (const dx of [-2.6, 2.6]) sph(g, 3, col, x + dx, 16.6, 12, { ns: true }); sph(g, 3, col, x, 20.4, 12, { ns: true }); }
  for (let i = 0; i < 3; i++) cyl(g, 3.4, 3.4, 1.6, GOLDC, 19, 14.8 + i * 1.7, 12, { ns: true, seg: 10 });
  cyl(g, 6.4, 5.6, 14, WOOD, 19, 7, -13, { seg: 10 }); for (const y of [4, 10]) cyl(g, 6.7, 6.7, 1.3, '#55565e', 19, y, -13, { seg: 10, ns: true });     // la botte
  box(g, 14, 12, 12, WOOD_L, -18, 6, -12); box(g, 12, 10, 12, WOOD, -4, 5, -14);
  { const sack = sph(g, 7, '#d9c7a0', 6, 5.4, -4); sack.scale.y = 0.85; }
  box(g, 18, 9, 1.6, WOOD_L, 0, 29, 26.4, { ns: true }); { const coin = cyl(g, 3.2, 3.2, 1, GOLDC, 0, 29, 27.4, { seg: 10, ns: true }); coin.rotation.x = Math.PI / 2; }      // l'insegna
  return g;
}

/** Due falde di tetto spesse, col colmo verso la camera. */
function gable(g, halfW, depth, y, rise, col) {
  const len = Math.hypot(halfW, rise) + 3, ang = Math.atan2(rise, halfW);
  for (const k of [-1, 1]) { const sl = box(g, len, 3.4, depth, col, k * halfW / 2, y + rise / 2 + 1.4, 0); sl.rotation.z = -k * ang; }
  box(g, 4.6, 3, depth + 2, WOOD_D, 0, y + rise + 2.4, 0, { ns: true });
}
function makeFountain() {
  const g = grp(null), u = {};
  cyl(g, 35, 37, 9, '#b9bac6', 0, 4.5, 0, { seg: 14 }); cyl(g, 37.5, 37.5, 3, '#cfd0da', 0, 9.6, 0, { seg: 14, ns: true });
  cyl(g, 31, 31, 2, '#5ec3ea', 0, 9.4, 0, { seg: 14, ns: true, mat: { e: 0x1f7fb0, ei: 0.45 } });
  cyl(g, 5, 8, 22, '#cfd0da', 0, 20, 0, { seg: 8 }); cyl(g, 15, 8, 5, '#b9bac6', 0, 32, 0, { seg: 12 });
  cyl(g, 13, 13, 1.4, '#7fd4f0', 0, 34.4, 0, { seg: 12, ns: true, mat: { e: 0x1f7fb0, ei: 0.45 } });
  cyl(g, 2.4, 3.4, 9, '#cfd0da', 0, 39, 0, { seg: 6 });
  u.jets = [];
  for (let i = 0; i < 5; i++) { const a = i * 1.257, j = cone(g, 2.2, 13, '#d9f3ff', Math.cos(a) * 7, 38, Math.sin(a) * 7, { ns: true, seg: 5, mat: { basic: true, a: 0.7 } }); j.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); u.jets.push(j); }
  u.jets.push(cone(g, 3, 16, '#d9f3ff', 0, 50, 0, { ns: true, seg: 6, mat: { basic: true, a: 0.75 } }));
  g.userData = u;
  return g;
}
function makeTavern() {
  const g = grp(null);
  box(g, 68, 5, 58, '#8f8f98', 0, 2.5, 0);
  box(g, 62, 28, 50, '#f0dcb4', 0, 19, 0);
  for (const x of [-31, 31]) for (const z of [-25, 25]) box(g, 3.4, 29, 3.4, WOOD_D, x, 19.5, z, { ns: true });
  box(g, 63.4, 2.6, 51.4, WOOD_D, 0, 33, 0, { ns: true }); box(g, 63.4, 2.6, 51.4, WOOD_D, 0, 18, 0, { ns: true });
  roof(g, 50, 24, 62, '#f0dcb4', 0, 33.6, 0).rotation.y = Math.PI / 2;
  gable(g, 37, 68, 33, 27, '#3f7a66');
  box(g, 9, 22, 9, '#9a8f86', -18, 56, -14); box(g, 11.4, 3, 11.4, '#6f6660', -18, 68, -14, { ns: true });
  box(g, 13, 19, 2, '#6b4226', 0, 14.5, 25.4, { ns: true }); box(g, 16, 2.4, 2.8, WOOD_D, 0, 25, 25.6, { ns: true });
  for (const x of [-20, 20]) { box(g, 11, 10, 1.6, '#ffd97a', x, 22, 25.3, { ns: true, e: 0xffb040, ei: 0.85 }); box(g, 1.2, 10, 2, WOOD_D, x, 22, 25.6, { ns: true }); }
  box(g, 2, 2, 12, WOOD_D, 30, 34, 30, { ns: true }); box(g, 14, 11, 1.4, '#8a5a33', 30, 27, 35.4, { ns: true }); cyl(g, 3, 2.6, 6, GOLDC, 30, 27, 36.6, { ns: true, seg: 8 });   // l'insegna col boccale
  for (const [x, z] of [[-27, 34], [-18, 35]]) { cyl(g, 5.4, 5.4, 10, WOOD, x, 5, z, { seg: 8 }); cyl(g, 5.7, 5.7, 1.4, '#55565e', x, 7.4, z, { seg: 8, ns: true }); }
  box(g, 20, 2, 9, WOOD_L, 14, 8, 36, { ns: true }); for (const x of [6, 22]) box(g, 2, 8, 7, WOOD_D, x, 4, 36, { ns: true });
  g.scale.setScalar(1.06);
  return g;
}
function makeStatue() {
  const g = grp(null);
  box(g, 28, 5, 28, '#9a9ba4', 0, 2.5, 0); box(g, 21, 12, 21, '#bcbdc8', 0, 11, 0); box(g, 24, 3, 24, '#9a9ba4', 0, 18.4, 0, { ns: true });
  const b = put(g, geom('tuzu', blobGeo), M('#d5d6e0'), 0, 20, 0); b.scale.setScalar(22); b.rotation.y = -Math.PI / 2;
  const fc = put(g, geom('tuzuFace', faceGeo), M('#8f909c'), 0, 20, 0, false); fc.scale.setScalar(22); fc.rotation.y = -Math.PI / 2;
  cyl(g, 5, 4.4, 3.4, GOLDC, 0, 43.4, 0, { seg: 8, ns: true });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ball(g, 2.4, i % 2 ? '#ff8fb0' : '#fff0a0', Math.cos(a) * 17, 2.4, Math.sin(a) * 17, { ns: true }); }
  return g;
}
/** Il Faro: scoglio, torre a fasce, ballatoio, lanterna con la luce che gira, e la casetta del guardiano. */
function makeLighthouse() {
  const g = grp(null), u = {}, fx = -8, fz = -2, fh = 62;
  cyl(g, 33, 36, 7, STONE_D, -2, 3.5, 2, { seg: 12 }); cyl(g, 28, 31, 5, STONE, -2, 9, 2, { seg: 12 });
  cyl(g, 12.5, 14.5, 9, '#8f909c', fx, 15.5, fz, { seg: 12 });
  for (let k = 0; k < 5; k++) cyl(g, 10.4 - k * 0.9, 11.3 - k * 0.9, fh / 5, k % 2 ? '#f4f1ea' : '#c0392b', fx, 20 + fh / 10 + k * fh / 5, fz, { seg: 12 });
  cyl(g, 10.5, 10.5, 2.4, '#55565e', fx, 21.2 + fh, fz, { seg: 12, ns: true });
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; cyl(g, 0.7, 0.7, 6, '#3d3e46', fx + Math.cos(a) * 9.6, 25 + fh, fz + Math.sin(a) * 9.6, { seg: 5, ns: true }); }
  cyl(g, 5.2, 5.2, 9, '#ffe27a', fx, 27 + fh, fz, { seg: 8, ns: true, mat: { e: 0xffc040, ei: 1 } });
  cone(g, 8.6, 10, '#c0392b', fx, 36.5 + fh, fz, { seg: 12, ns: true }); ball(g, 1.8, GOLDC, fx, 42.5 + fh, fz, { ns: true });
  const beam = u.beam = grp(g, fx, 27 + fh, fz); const bm = put(beam, geom('beam2', () => new THREE.ConeGeometry(12, 96, 10, 1, true)), M('#fff3c4', { basic: true, a: 0.16, double: true }), 0, 0, 52, false); bm.rotation.x = -Math.PI / 2;
  box(g, 6, 10, 1.6, '#5c3a1e', fx, 16.5, fz + 13.8, { ns: true });
  box(g, 26, 16, 22, '#efe4c8', 21, 19.5, 10); roof(g, 30, 10, 26, '#b5482f', 21, 27.5, 10);
  box(g, 6, 10, 1.4, '#6b4226', 17, 16.5, 21.4, { ns: true }); box(g, 6, 6, 1.4, '#ffd97a', 27, 20.5, 21.3, { ns: true, e: 0xffb040, ei: 0.8 });
  g.userData = u;
  return g;
}
/** Il Giardino: prato con la siepe attorno, un vialetto, un alberello al centro, cespugli in fiore e due panchine. */
function makeGarden() {
  const g = grp(null);
  box(g, 74, 2, 74, '#6fae52', 0, 1, 0, { ns: true });
  for (const [x, z, w, d] of [[-22, -34, 30, 6], [22, -34, 30, 6], [-22, 34, 30, 6], [22, 34, 30, 6], [-34, 0, 6, 62], [34, 0, 6, 62]]) box(g, w, 9, d, '#3f8f4a', x, 5.5, z);
  box(g, 12, 0.8, 74, '#d9c39a', 0, 2.3, 0, { ns: true }); cyl(g, 14, 14, 0.8, '#d9c39a', 0, 2.4, 0, { seg: 12, ns: true });
  cyl(g, 9, 9.6, 3, '#9a9ba4', 0, 3.6, 0, { seg: 12 }); cyl(g, 7.6, 7.6, 1, '#7a5634', 0, 5.3, 0, { seg: 12, ns: true });
  cyl(g, 1.6, 2, 14, '#6a4528', 0, 12, 0, { seg: 6 }); ball(g, 10, '#57a857', 0, 24, 0); ball(g, 7, '#6bb35a', 5, 29, 2); ball(g, 6.5, '#4c9c50', -5, 27, -3);
  for (let i = 0; i < 6; i++) { const a = i * 1.047; ball(g, 1.6, i % 2 ? '#ff8fb0' : '#fff0a0', Math.cos(a) * 6, 6.4, Math.sin(a) * 6, { ns: true }); }
  const FL = ['#ff8fb0', '#fff0a0', '#ff6f6f', '#c9b6ff', '#ffffff'];
  for (const [x, z] of [[-21, -20], [21, -20], [-21, 20], [21, 20]]) { ball(g, 6.4, '#4c9c50', x, 5.4, z); for (let i = 0; i < 5; i++) { const a = i * 1.257 + x; ball(g, 1.8, FL[i], x + Math.cos(a) * 4.6, 9.6, z + Math.sin(a) * 4.6, { ns: true }); } }
  for (const sx of [-1, 1]) { box(g, 5, 1.6, 16, WOOD_L, sx * 15, 6.4, 0, { ns: true }); box(g, 1.4, 6.4, 16, WOOD_L, sx * 17.6, 9.4, 0, { ns: true }); for (const z of [-6.5, 6.5]) box(g, 4.4, 4, 1.6, WOOD_D, sx * 15, 3.8, z, { ns: true }); }
  return g;
}
/** Il Pozzo: vera di pietra, acqua, due pali, il tettuccio e il secchio appeso. */
function makeWell() {
  const g = grp(null);
  cyl(g, 13, 14.4, 12, STONE, 0, 6, 0, { seg: 12 }); cyl(g, 10.2, 10.2, 0.8, '#3d8fc0', 0, 12.2, 0, { seg: 12, ns: true, mat: { e: 0x1f7fb0, ei: 0.4 } });
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box(g, 5.4, 2.6, 4.4, i % 2 ? '#c4c5d0' : '#b2b3be', Math.cos(a) * 12, 12.6, Math.sin(a) * 12, { ns: true }).rotation.y = -a + Math.PI / 2; }
  for (const sx of [-1, 1]) box(g, 2.6, 22, 2.6, WOOD_D, sx * 12.2, 23, 0, { ns: true });
  box(g, 28, 1.8, 1.8, WOOD, 0, 30, 0, { ns: true }); box(g, 0.7, 9, 0.7, '#d9c39a', 0, 25.5, 0, { ns: true }); cyl(g, 3, 2.4, 4.4, WOOD_L, 0, 19, 0, { seg: 8, ns: true });
  roof(g, 30, 8, 19, '#b5482f', 0, 32.5, 0);
  return g;
}
/** La Panchina: due assi e uno schienale. */
function makeBench() {
  const g = grp(null);
  for (const x of [-10, 10]) { box(g, 2.4, 8, 9, WOOD_D, x, 4, 0, { ns: true }); box(g, 2.4, 9, 2, WOOD_D, x, 12, -4.2, { ns: true }); }
  box(g, 27, 2, 10, WOOD_L, 0, 8.6, 0.6); box(g, 27, 3.4, 1.8, WOOD_L, 0, 12.4, -4.6); box(g, 27, 3.4, 1.8, WOOD_L, 0, 16.6, -4.9);
  return g;
}
/** Lo Stendardo: un palo con la bandiera lunga del tuo popolo, e il fregio d'oro. */
function makeBanner() {
  const g = grp(null);
  cyl(g, 7, 8.4, 4, STONE, 0, 2, 0, { seg: 8 }); cyl(g, 1.5, 1.8, 50, WOOD_D, 0, 28, 0, { seg: 6 }); ball(g, 2.8, GOLDC, 0, 54.6, 0, { ns: true });
  box(g, 20, 1.6, 1.6, WOOD_D, 3, 49, 0, { ns: true });
  box(g, 15, 24, 1, MY_COLOR, 4.5, 36.4, 0.2); box(g, 15, 3, 1.2, GOLDC, 4.5, 46.6, 0.2, { ns: true }); box(g, 15, 2, 1.2, GOLDC, 4.5, 25.2, 0.2, { ns: true });
  ball(g, 3.2, '#ffffff', 4.5, 37, 1, { ns: true });
  return g;
}
/** Il Mulino ad acqua: casa di pietra, tetto di paglia, e la grande ruota che gira. */
function makeWaterMill() {
  const g = grp(null), u = {};
  box(g, 70, 6, 60, STONE_D, -2, 3, 0); box(g, 46, 30, 44, '#d9cdb4', -10, 21, -2); box(g, 46, 8, 44, STONE, -10, 10, -2, { ns: true });
  roof(g, 54, 20, 52, '#a8763c', -10, 36, -2);
  box(g, 10, 16, 2, '#6b4226', -10, 15, 20.4, { ns: true }); box(g, 8, 8, 2, '#ffd97a', -24, 24, 20.3, { ns: true, e: 0xffb040, ei: 0.75 });
  box(g, 20, 3, 6, WOOD_D, 20, 21, 0, { ns: true });                                   // l'asse della ruota
  const wheel = u.wheel = grp(g, 27, 21, 0);
  for (let i = 0; i < 8; i++) { const arm = grp(wheel); arm.rotation.x = i * Math.PI / 4; box(arm, 2, 2, 20, WOOD_D, 0, 0, 10, { ns: true }); box(arm, 9, 1.6, 8, WOOD_L, 0, 0, 20, { ns: true }); }
  for (const sx of [-4, 4]) { const ring = put(wheel, geom('wheelRing', () => new THREE.TorusGeometry(19, 1.3, 5, 16)), M(WOOD_D), sx, 0, 0, false); ring.rotation.y = Math.PI / 2; }
  for (const [x, z] of [[-30, 26], [-22, 28]]) { const sk = ball(g, 6, '#e3d2a4', x, 9, z); sk.scale.y = 0.85; }
  g.userData = u;
  return g;
}
function makeMill() {
  const g = grp(null), u = {};
  cyl(g, 30, 32, 5, '#8f8f98', 0, 2.5, 0, { seg: 10 });
  cyl(g, 19, 27, 50, '#f1e6cc', 0, 30, 0, { seg: 10 }); cyl(g, 21, 21, 3, WOOD_D, 0, 55, 0, { seg: 10, ns: true });
  cone(g, 23, 22, '#c2512f', 0, 67, 0, { seg: 10 });
  box(g, 10, 16, 2, '#6b4226', 0, 13, 26.2, { ns: true }); box(g, 8, 8, 2, '#ffd97a', 0, 38, 21.6, { ns: true, e: 0xffb040, ei: 0.75 });
  const hub = u.sails = grp(g, 0, 50, 24);
  cyl(hub, 3.4, 3.4, 5, WOOD_D, 0, 0, 0, { seg: 8, ns: true }).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const arm = grp(hub); arm.rotation.z = i * Math.PI / 2; box(arm, 2.2, 38, 1.6, WOOD_D, 0, 19, 0); box(arm, 11, 27, 0.9, '#f4f1ea', 6, 22, 0.4, { ns: true }); }
  for (const [x, z] of [[24, 14], [28, 6]]) { const sk = ball(g, 6.5, '#e3d2a4', x, 5, z); sk.scale.y = 0.85; }
  g.userData = u;
  return g;
}
function makeForge() {
  const g = grp(null), u = {};
  box(g, 66, 5, 56, '#77787f', 0, 2.5, 0);
  box(g, 56, 24, 44, '#8b8c96', 0, 17, 0);
  roof(g, 44, 18, 56, '#8b8c96', 0, 29, 0).rotation.y = Math.PI / 2;
  gable(g, 34, 60, 29, 21, '#4b4d5a');
  box(g, 14, 30, 14, '#6f7078', 16, 52, -12); box(g, 17, 4, 17, '#55565e', 16, 68, -12, { ns: true });
  u.glow = ball(g, 5.5, '#ff9d2a', 16, 71, -12, { e: 0xff5a00, ei: 1, ns: true });
  box(g, 18, 16, 2, '#2a1a10', -8, 13, 22.2, { ns: true }); box(g, 12, 10, 1.6, '#ff9d2a', -8, 11, 22.6, { ns: true, e: 0xff5a00, ei: 1 });
  box(g, 9, 9, 1.6, '#ffd97a', 16, 20, 22.2, { ns: true, e: 0xffb040, ei: 0.8 });
  box(g, 12, 5, 7, '#55565e', 30, 7.5, 30); box(g, 16, 4, 8, '#3d3e46', 30, 12, 30, { ns: true }); box(g, 5, 5, 6, '#3d3e46', 30, 2.5, 30, { ns: true });      // l'incudine
  cyl(g, 6, 6, 9, WOOD, -30, 4.5, 30, { seg: 8 }); for (let i = 0; i < 3; i++) box(g, 1.4, 16, 1.4, '#aeb4c2', -32 + i * 2.4, 13, 30, { ns: true });
  g.userData = u;
  return g;
}

function makeGate(vertical) {
  const g = grp(null);
  for (const x of [-15, 15]) {
    cyl(g, 7.6, 8.8, 42, '#a3a4ae', x, 21, 0, { seg: 12 }); cyl(g, 9.4, 8, 3, '#bcbdc8', x, 43, 0, { seg: 12, ns: true });
    cone(g, 10.4, 15, '#b0372a', x, 52, 0, { seg: 12 }); ball(g, 2, GOLDC, x, 60, 0, { ns: true });
  }
  box(g, 22, 8, 10, '#8f909c', 0, 34, 0);
  for (const x of [-7, 0, 7]) box(g, 5, 4, 10.6, '#bcbdc8', x, 39.8, 0, { ns: true });
  box(g, 20, 29, 4, '#8a5a33', 0, 14.5, 0);
  for (const x of [-6, 0, 6]) box(g, 1, 28, 4.6, '#5c3a1e', x, 14, 0, { ns: true });
  box(g, 20, 2.4, 5, '#55565e', 0, 9, 0, { ns: true }); box(g, 20, 2.4, 5, '#55565e', 0, 21, 0, { ns: true });
  for (const z of [-3, 3]) ball(g, 1.5, GOLDC, 3.4, 15, z, { ns: true });
  if (vertical) g.rotation.y = Math.PI / 2;
  return g;
}

const ROOFS = ['#c2512f', '#b0472b', '#a8552d', '#c96a3a', '#8f4a3a'];
/** Il modello di un edificio. o: { lvl, castle, crop, id, vertical } */
function makeModel(type, o = {}) {
  let g;
  if (type === 'castello') g = makeCastle(o.castle || 1);
  else if (type === 'casa') g = makeHouse(o.id || 0, o.lvl || 0);
  else if (type === 'porto') g = makePort(o.lvl || 0, o.ships);
  else if (type === 'scalo') g = makeBigPort(o.lvl || 0, o.ships);
  else if (type === 'campo') g = makePlot(o.crop);
  else if (type === 'segheria') g = makeSawmill();
  else if (type === 'cava') g = makeQuarry();
  else if (type === 'caserma') g = makeBarracks();
  else if (type === 'bottega') g = makeWorkshop();
  else if (type === 'mercato') g = makeMarket();
  else if (type === 'fontana') g = makeFountain();
  else if (type === 'taverna') g = makeTavern();
  else if (type === 'statua') g = makeStatue();
  else if (type === 'faro') g = makeLighthouse();
  else if (type === 'giardino') g = makeGarden();
  else if (type === 'pozzo') g = makeWell();
  else if (type === 'panchina') g = makeBench();
  else if (type === 'stendardo') g = makeBanner();
  else if (type === 'mulinoacqua') g = makeWaterMill();
  else if (type === 'mulino') g = makeMill();
  else if (type === 'fucina') g = makeForge();
  else if (type === 'miniera') g = makeMine('#c0683c', 0);
  else if (type === 'cristalliera') g = makeMine('#7fe3ff', 0x2fb8e0);
  else if (type === 'cancello') g = makeGate(o.vertical);
  else { g = makeTower(type, o.lvl || 0); g.scale.setScalar(1.08); }
  if (LEVELS[type] && type !== 'casa' && type !== 'scalo' && type !== 'porto' && o.lvl) { const k = g.scale.x; levelMarks(g, o.lvl, 34 / k, (type === 'caserma' || type === 'mulino' ? 56 : 40) / k); g.scale.multiplyScalar(1 + o.lvl * 0.05); }
  if (o.rot) g.rotation.y = o.rot;
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

const PITCH = 55 * Math.PI / 180, DIST_MIN = 430, DIST_MAX = 3400, WALL_CAP = 1200, AO_CAP = 420;
// alberi: latifoglie (tre chiome a poligoni) e pini (tre coni). tint 0-3 = latifoglia, 4-5 = pino
const LEAF = [['#3f8f4a', '#57a857', '#4c9c50'], ['#57a857', '#6bb35a', '#4c9c50'], ['#2f7a3b', '#3f8f4a', '#57a857'], ['#d98a2b', '#e3a83a', '#c8742a']];
const PINE = [['#2c6e49', '#337a52', '#3d8a5c'], ['#255e40', '#2c6e49', '#35805a']];
const UP = new THREE.Vector3(0, 1, 0);
const c3cache = new Map();
function c3(col) { let c = c3cache.get(col); if (!c) { c = new THREE.Color(col); c3cache.set(col, c); } return c; }
/** Chi lavora accanto a un edificio (dx, dy dal centro). */
const WORKER = { segheria: [46, 30], cava: [-46, 34], miniera: [34, 44], cristalliera: [34, 44], bottega: [-40, 40], mercato: [0, 44], mulino: [-34, 40], fucina: [4, 46], taverna: [26, 50], fontana: [44, 30] };
const DECO_CAP = 900, PLANT_CAP = 260, FLOWERS = ['#ff8fb0', '#fff0a0', '#ff6f6f', '#c9b6ff', '#ffffff'];
const wallish = (b) => !!b && (b.type === 'recinto' || b.type === 'mura' || b.type === 'cancello');

// ---------- la scena ----------
export class Scene3D {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.12;      // colori più pieni, luci che non «bruciano»
    this.cam = new THREE.PerspectiveCamera(30, 1, 40, 9000);
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector2();
    this.w = 1; this.h = 1;
    this.scene = null; this.tex = null;
    this.dir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    this.target = new THREE.Vector3((CASTLE.c + CASTLE.w / 2) * G, 0, (CASTLE.r + CASTLE.h / 2) * G + 20);
    this.dist = 1150;
    this.finish = true; this.calm = false; this.nightK = 0;
    this._initPost();
  }

  /** Prepara il passaggio di rifinitura. Se il telefono non regge le tele a colori estesi, si disegna diretto. */
  _initPost() {
    const r = this.r;
    this.postOk = r.capabilities.isWebGL2 && (r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    if (!this.postOk) return;
    r.info.autoReset = false;
    const rt = (o) => new THREE.WebGLRenderTarget(4, 4, Object.assign({ type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }, o));
    this.rtA = rt({ depthBuffer: true, samples: 4 }); this.rtB = rt(); this.rtC = rt();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const vs = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main() { vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + d * 1.385).rgb + texture2D(t, vUv - d * 1.385).rgb) * 0.316; c += (texture2D(t, vUv + d * 3.231).rgb + texture2D(t, vUv - d * 3.231).rgb) * 0.0703; gl_FragColor = vec4(min(c, vec3(8.0)), 1.0); }',
    });
    this.outMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, b: { value: null }, exposure: { value: 0.9 }, dof: { value: 1 }, bloom: { value: 0.3 }, night: { value: 0 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: [
        'uniform sampler2D t; uniform sampler2D b; uniform float exposure; uniform float dof; uniform float bloom; uniform float night; varying vec2 vUv;',
        'vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
        'void main() {',
        '  vec3 sharp = texture2D(t, vUv).rgb, soft = texture2D(b, vUv).rgb;',
        '  float k = smoothstep(0.25, 0.6, abs(vUv.y - 0.46)) * dof;',                       // nitido al centro, sfocato in alto e in basso
        '  vec3 c = mix(sharp, soft, k);',
        '  c += max(soft - vec3(1.35), 0.0) * bloom + soft * 0.015;',                         // bagliore delle parti più chiare, e un velo morbido
        '  c = aces(c * exposure);',
        '  c = pow(c, vec3(1.0 / 2.2));',
        '  float l = dot(c, vec3(0.299, 0.587, 0.114));',
        '  c = mix(vec3(l), c, 1.13) * mix(vec3(1.02, 1.0, 0.975), vec3(0.95, 0.98, 1.06), night);',   // più saturo; caldo di giorno, freddo di notte
        '  gl_FragColor = vec4(c, 1.0);',
        '}'].join('\n'),
    });
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat); this.fsQuad.frustumCulled = false;
    this.fsScene = new THREE.Scene(); this.fsScene.add(this.fsQuad);
  }
  /** Non tutti i telefoni sanno disegnare su queste tele: si prova una volta; se non va, prima senza antialias, poi niente rifinitura. */
  _testPost() {
    const r = this.r, gl = r.getContext(), ok = (t) => { r.setRenderTarget(t); const good = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; r.setRenderTarget(null); return good; };
    try {
      if (!ok(this.rtA)) { const w = this.rtA.width, h = this.rtA.height; this.rtA.dispose(); this.rtA = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); }
      if (!ok(this.rtA) || !ok(this.rtB)) this.postOk = false;
    } catch (e) { this.postOk = false; }
    if (!this.postOk) console.log('[tuzu] rifinitura non disponibile su questo dispositivo');
  }
  /** Rifinitura accesa o spenta (si spegne da sola se il telefono fatica). */
  setPost(on) { this.finish = !!on; }
  /** Con la griglia di costruzione aperta la sfocatura si attenua: serve vedere bene dove si mette. */
  setCalm(on) { this.calm = on; }

  resize(w, h, dpr) {
    this.w = w; this.h = h;
    this.r.setPixelRatio(dpr); this.r.setSize(w, h, false);
    if (this.postOk) { const W = Math.max(4, Math.round(w * dpr)), H = Math.max(4, Math.round(h * dpr)); this.rtA.setSize(W, H); this.rtB.setSize(W >> 2, H >> 2); this.rtC.setSize(W >> 2, H >> 2); if (!this._tested) { this._tested = true; this._testPost(); } }
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.place();
  }

  // ---------- camera ----------
  place() {
    if (this.tT) { const sh = this.dist < 2100 && this.shadowsOn !== false; if (sh !== this._treeSh) { this._treeSh = sh; for (const z of this.tT.zones) z.trunk.castShadow = z.leaf.castShadow = z.pine.castShadow = sh; } }
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
    const s = new THREE.Scene();
    s.background = new THREE.Color('#a8cdb4');                     // foschia chiara all'orizzonte: dà profondità
    s.fog = new THREE.Fog(s.background, 3000, 8600);
    this.hemi = new THREE.HemisphereLight(0xeaf2ff, 0x8fae6c, 1.5); s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffe4b8, 2.5);
    sun.castShadow = this.shadowsOn !== false; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 100; sun.shadow.camera.far = 4600; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 1.5;
    s.add(sun, sun.target); this.sun = sun;
    const big = new THREE.Mesh(new THREE.PlaneGeometry(22000, 20000), M(SEA, { smooth: true }));      // fuori dalla mappa c'è il mare
    big.rotation.x = -Math.PI / 2; big.position.set(WORLD_W / 2, -0.6, WORLD_H / 2); big.receiveShadow = true; s.add(big);
    const cv = document.createElement('canvas'); paintWorld(cv, 0.5); this.mapCv = cv; this.baseCv = null; this.roadSig = ''; this.roadBox = null; this.roadRev = 0;
    this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    // la grana del terreno: una piccola trama che si ripete e si moltiplica sul dipinto. Da vicino dà fili d'erba e sassolini nitidi
    // (il dipinto ha 20 punti per quadretto e da vicino è morbido); da lontano si media da sola e non si vede.
    const det = document.createElement('canvas'); det.width = det.height = 256;
    { const d = det.getContext('2d'), rn = mulberry32(7); d.fillStyle = '#808080'; d.fillRect(0, 0, 256, 256);
      const dot = (x, y, r, col) => { d.fillStyle = col; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { d.beginPath(); d.arc(x + ox, y + oy, r, 0, Math.PI * 2); d.fill(); } };
      for (let i = 0; i < 1500; i++) { const v = rn() < 0.5 ? 255 : 0; dot(rn() * 256, rn() * 256, 0.7 + rn() * 1.9, `rgba(${v},${v},${v},${0.14 + rn() * 0.26})`); }
      d.lineCap = 'round'; for (let i = 0; i < 520; i++) { const x = rn() * 256, y = rn() * 256, a = -Math.PI / 2 + (rn() - 0.5) * 0.9, l = 3 + rn() * 5, v = rn() < 0.55 ? 255 : 0; d.strokeStyle = `rgba(${v},${v},${v},${0.2 + rn() * 0.3})`; d.lineWidth = 0.9 + rn() * 0.7; d.beginPath(); d.moveTo(x, y); d.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); d.stroke(); } }
    this.detTex = new THREE.CanvasTexture(det); this.detTex.wrapS = this.detTex.wrapT = THREE.RepeatWrapping; this.detTex.anisotropy = 4;
    const gm = new THREE.MeshLambertMaterial({ map: this.tex });
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.uDet = { value: this.detTex };
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform sampler2D uDet;\nvoid main() {').replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= 0.74 + 0.52 * texture2D( uDet, vMapUv * vec2( ' + (WORLD_W / 110).toFixed(2) + ', ' + (WORLD_H / 110).toFixed(2) + ' ) ).r;');
    };
    const map = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), gm);
    map.rotation.x = -Math.PI / 2; map.position.set(WORLD_W / 2, 0, WORLD_H / 2); map.receiveShadow = true; s.add(map);
    this.scene = s;

    const mk = (geo, mat, n, shadow = true) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); im.castShadow = shadow; im.frustumCulled = false; s.add(im); return im; };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
    this._m4 = m4; this._q = q; this._P3 = P3; this._S3 = S3; this._col = col;
    const rnd = mulberry32(21);

    // alberi: una chioma fusa (tre palle, o tre coni per i pini) più il tronco, a istanze.
    // La mappa è divisa in zone: ogni zona ha le sue istanze, così fuori dallo schermo non si disegna niente.
    const ball3 = (x, y, z, sx, sy) => { const g = new THREE.SphereGeometry(1, 7, 4); g.scale(sx, sy, sx); g.translate(x, y, z); return g; };
    const cone3 = (y, w, h) => { const g = new THREE.ConeGeometry(1, 1, 7, 1, true); g.scale(w, h, w); g.translate(0, y, 0); return g; };
    const leafG = geom('leaf3', () => mergeTone([ball3(0, 1.62, 0, 1.06, 0.94), ball3(0.56, 1.3, 0.05, 0.72, 0.66), ball3(-0.34, 2.12, -0.12, 0.7, 0.64)], [1, 0.84, 1.14]));
    const pineG = geom('pine3', () => mergeTone([cone3(1.12, 1.02, 1.36), cone3(1.86, 0.77, 1.22), cone3(2.6, 0.52, 1.08)], [0.88, 1, 1.14]));
    const trunkG = geom('ftrunk', () => new THREE.CylinderGeometry(0.15, 0.22, 1, 5));
    const tintMat = soften(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));
    const ZONE = 1200, ZX = Math.ceil(WORLD_W / ZONE), ZY = Math.ceil(WORLD_H / ZONE);
    /** list: [{ x, z, tint }] (tint 0-3 latifoglia, 4-5 pino). one = un'unica zona (per gli alberi che si spostano). */
    const treeSet = (list, shadow, one) => {
      const zones = new Map(), at = [];
      for (const t of list) {
        const k = one ? 0 : Math.max(0, Math.min(ZX - 1, Math.floor(t.x / ZONE))) + Math.max(0, Math.min(ZY - 1, Math.floor(t.z / ZONE))) * ZX;
        let z = zones.get(k); if (!z) { z = { n: 0, nl: 0, np: 0 }; zones.set(k, z); }
        at.push({ z, ti: z.n++, si: t.tint < 4 ? z.nl++ : z.np++ });
      }
      for (const z of zones.values()) { z.trunk = mk(trunkG, M('#6a4528'), z.n, shadow); z.leaf = mk(leafG, tintMat, z.nl, shadow); z.pine = mk(pineG, tintMat, z.np, shadow); z.trunk.count = z.n; z.leaf.count = z.nl; z.pine.count = z.np; }
      return { at, zones: [...zones.values()], one: !!one };
    };
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    /** tint dice la specie e deve essere quella con cui è stato creato l'insieme. r = 0 nasconde l'albero. */
    const tree = (T, i, x, z, r, tint, seed, y0 = 0) => {
      const a = T.at[i], pine = tint >= 4, im = pine ? a.z.pine : a.z.leaf;
      if (r <= 0) { a.z.trunk.setMatrixAt(a.ti, zero); im.setMatrixAt(a.si, zero); return; }
      q.setFromAxisAngle(UP, seed);
      a.z.trunk.setMatrixAt(a.ti, m4.compose(P3.set(x, y0 + r * (pine ? 0.42 : 0.62), z), q, S3.set(r * (pine ? 0.9 : 1), r * (pine ? 0.84 : 1.24), r * (pine ? 0.9 : 1))));
      im.setMatrixAt(a.si, m4.compose(P3.set(x, y0, z), q, S3.set(r, r, r)));
      im.setColorAt(a.si, col.set(self._leafCol ? self._leafCol(tint) : pine ? PINE[tint - 4][1] : LEAF[tint][0]));
    };
    /** Dopo aver cambiato gli alberi. Le zone fisse si ritagliano sullo schermo (la prima volta se ne calcola l'ingombro). */
    const flush = (T) => {
      for (const z of T.zones) for (const im of [z.trunk, z.leaf, z.pine]) {
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        if (!T.one && !im.userData.fit) { im.userData.fit = true; im.computeBoundingSphere(); im.frustumCulled = true; }
      }
    };
    this._tree = tree; this._flush = flush;
    const self = this;
    // i colori degli alberi seguono la stagione
    const SEASON_LEAF = { primavera: ['#4c9c50', '#6bbf5a', '#3f8f4a', '#f3a6c8'], estate: ['#3f8f4a', '#57a857', '#2f7a3b', '#4c9c50'], autunno: ['#d98a2b', '#e3a83a', '#c8552a', '#b8862f'], inverno: ['#e3ecf1', '#d3e0e8', '#eef3f6', '#c3d2da'] };
    const SEASON_PINE = { inverno: ['#4c7f6c', '#5f927e'] };
    this._leafCol = (tint) => (tint >= 4 ? (SEASON_PINE[self.season] || [PINE[0][1], PINE[1][1]])[tint - 4] : (SEASON_LEAF[self.season] || SEASON_LEAF.estate)[tint]);

    // colline: cupole d'erba, con qualche albero in cima
    const hillIM = mk(geom('hill', () => new THREE.SphereGeometry(1, 20, 12)), M('#ffffff'), HILLS.length, true);
    hillIM.receiveShadow = true;
    const deco = [];                                              // alberi fissi: sulle colline e fuori dalla mappa
    HILLS.forEach((H, i) => {
      q.setFromAxisAngle(UP, H.rot);
      hillIM.setMatrixAt(i, m4.compose(P3.set(H.x, -H.h * 0.3, H.y), q, S3.set(H.rx, H.h * 1.3, H.ry)));
      hillIM.setColorAt(i, col.set(['#62a352', '#5a9a4c', '#6aa95a'][i % 3]));
      for (let k = 0; k < 6; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 0.62, y = H.h * (1.3 * Math.sqrt(Math.max(0, 1 - d * d)) - 0.3); deco.push({ x: H.x + Math.cos(a) * d * H.rx, z: H.y + Math.sin(a) * d * H.ry, r: 13 + rnd() * 9, tint: Math.floor(rnd() * 6), seed: rnd() * 6.283, y: y - 2 }); }
    });
    hillIM.instanceMatrix.needsUpdate = true; hillIM.instanceColor.needsUpdate = true;
    for (let i = 0; i < 640; i++) {                               // il bosco attorno alla mappa
      const x = -1300 + rnd() * (WORLD_W + 2600), z = -1100 + rnd() * (WORLD_H + 2100);
      if (x > -30 && x < WORLD_W + 30 && z > -30 && z < WORLD_H + 30) continue;
      deco.push({ x, z, r: 20 + rnd() * 18, tint: Math.floor(rnd() * 6), seed: rnd() * 6.283, y: 0 });
    }
    const dT = treeSet(deco, false);
    this._deco = () => { deco.forEach((t, i) => tree(dT, i, t.x, t.z, t.r, t.tint, t.seed, t.y)); flush(dT); };
    this._deco();

    // montagne: coni a facce nette, con la neve in cima; attorno alla mappa, cime più grandi che sfumano nella foschia
    const peaks = [];
    for (const p of PEAKS) {
      peaks.push({ x: p.x, z: p.y, r: p.r, h: p.h, rot: p.rot, snow: p.snow, k: rnd() });
      for (let j = 0; j < 1; j++) { const a = p.rot + j * 2.6 + 1, d = p.r * 0.62; peaks.push({ x: p.x + Math.cos(a) * d, z: p.y + Math.sin(a) * d, r: p.r * (0.5 + rnd() * 0.2), h: p.h * (0.42 + rnd() * 0.2), rot: rnd() * 6.283, snow: false, k: rnd() }); }
    }
    for (let i = 0; i < 110; i++) {
      const side = i % 4, t = rnd(), off = 380 + rnd() * 1500;
      const x = side < 2 ? -400 + t * (WORLD_W + 800) : side === 2 ? -off : WORLD_W + off, z = side === 0 ? -off : side === 1 ? WORLD_H + off * 0.8 : -400 + t * (WORLD_H + 800);
      const r = 230 + rnd() * 300; peaks.push({ x, z, r, h: r * (1.5 + rnd() * 1.1), rot: rnd() * 6.283, snow: true, k: rnd(), far: true });
    }
    // cime arrotondate: un cono liscio con la punta smussata
    const peakG = geom('peak', () => { const pts = []; for (let i = 0; i <= 5; i++) { const u = i / 5; pts.push(new THREE.Vector2(i === 5 ? 0 : (1 - u) * (1 + 0.14 * Math.sin(u * Math.PI)) + 0.04, u - 0.5 - (u > 0.7 ? (u - 0.7) * (u - 0.7) * 0.9 : 0))); } return new THREE.LatheGeometry(pts, 8); });
    const cA = new THREE.Color('#7d7872'), cB = new THREE.Color('#a39c92'), groups = new Map();
    for (const p of peaks) { const k = p.far ? -1 : Math.max(0, Math.min(ZX - 1, Math.floor(p.x / ZONE))) + Math.max(0, Math.min(ZY - 1, Math.floor(p.z / ZONE))) * ZX; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const [k, list] of groups) {
      const rock = mk(peakG, M('#ffffff'), list.length, k >= 0), snowy = list.filter(p => p.snow), snow = mk(peakG, M('#f6f8fc'), snowy.length, false);
      list.forEach((p, i) => { q.setFromAxisAngle(UP, p.rot); rock.setMatrixAt(i, m4.compose(P3.set(p.x, p.h / 2 - 2, p.z), q, S3.set(p.r, p.h, p.r))); rock.setColorAt(i, col.copy(cA).lerp(cB, p.k)); });
      snowy.forEach((p, i) => { q.setFromAxisAngle(UP, p.rot); snow.setMatrixAt(i, m4.compose(P3.set(p.x, p.h * 0.842, p.z), q, S3.set(p.r * 0.345, p.h * 0.32, p.r * 0.345))); });
      rock.count = list.length; snow.count = snowy.length;
      for (const im of [rock, snow]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.frustumCulled = true; }
    }

    // laghi: uno specchio d'acqua sopra il fondale dipinto
    this.water = [];
    for (const L of LAKES) {
      const sh = new THREE.Shape();
      for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2, e = lakeEdge(L, a) * 0.97, x = Math.cos(a) * L.rx * e, y = -Math.sin(a) * L.ry * e; if (k) sh.lineTo(x, y); else sh.moveTo(x, y); }
      const mat = new THREE.MeshLambertMaterial({ color: 0x49b4e2, transparent: true, opacity: 0.78, emissive: 0x0e4f70, emissiveIntensity: 0.35 });
      const w = new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), mat);
      w.rotation.x = -Math.PI / 2; w.position.set(L.x, 0.5, L.y); w.receiveShadow = true; s.add(w); this.water.push(w);
    }

    // fiumi: un nastro d'acqua lungo il corso (si ferma a guadi e ponti, e dentro i laghi dove c'è già lo specchio)
    for (const R of RIVERS) {
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const pos = [], ind = [];
          run.forEach((p, i) => { const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, hw = 93; pos.push(p.x + nx * hw, 0.5, p.y + ny * hw, p.x - nx * hw, 0.5, p.y - ny * hw); if (i) { const k = i * 2; ind.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
          const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(ind); geo.computeVertexNormals();
          const w = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x49b4e2, transparent: true, opacity: 0.74, emissive: 0x0e4f70, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
          w.receiveShadow = true; s.add(w); this.water.push(w);
        }
        run = [];
      };
      for (const p of R.pts) { const c = Math.floor(p.x / G), r = Math.floor(p.y / G); if (c >= 0 && r >= 0 && c < COLS && r < ROWS && RIVER_AT[r * COLS + c] === 1) run.push(p); else flush(); }
      flush();
    }
    // i ponti di pietra delle strade: due parapetti e quattro pilastrini
    for (const B of bridgeSpots()) {
      const g = grp(null, B.x, 0, B.y), off = (B.main ? 17 : 12) + 20; g.rotation.y = Math.atan2(B.dx, B.dy);
      const bl = Math.round(B.len + 40);
      for (const sx of [-1, 1]) { box(g, 7, 9, bl, STONE, sx * off, 4.5, 0); box(g, 9, 3, bl + 4, '#c4c5d0', sx * off, 10, 0, { ns: true }); for (const sz of [-1, 0, 1]) { cyl(g, 6.5, 7.5, 16, STONE_D, sx * off, 8, sz * bl / 2, { seg: 8 }); ball(g, 5, '#c4c5d0', sx * off, 18, sz * bl / 2, { ns: true }); } }
      s.add(bake(g));
    }

    // barche che vanno e vengono: una per ogni tratto lungo di fiume (fra un ponte o un guado e l'altro) e una vela su ogni lago.
    // Sono solo figura (non sono navi della flotta): fanno vedere che per quell'acqua si naviga.
    this.boats = []; this.sails = [];
    { let n = 0;
      const boat = (kind, scale) => { const g = bake(makeShip(kind, 0)); g.scale.setScalar(scale); s.add(g); return g; };
      for (const R of RIVERS) {
        let run = [];
        const flush = () => { if (run.length >= 46 && this.boats.length < 9) { this.boats.push({ g: boat(n % 3 === 0 ? 'mercantile' : 'pesca', n % 3 === 0 ? 0.78 : 0.92), pts: run, ph: n * 1.7, sp: 24 + (n % 3) * 7 }); n++; } run = []; };
        for (const p of R.pts) { const c = Math.floor(p.x / G), r = Math.floor(p.y / G); if (c >= 0 && r >= 0 && c < COLS && r < ROWS && RIVER_AT[r * COLS + c] === 1) run.push(p); else flush(); }
        flush();
      }
      LAKES.forEach((L, i) => { this.boats.push({ g: boat(i % 2 ? 'veliero' : 'pesca', i % 2 ? 0.7 : 0.9), lake: L, k: i === 4 ? 0.66 : 0.5, dir: i % 2 ? 1 : -1, ph: i * 2.1 }); });
    }

    // Gabbiani e pesci: solo figura, due disegni in tutto (a istanze). Un gabbiano gira sopra ogni lago (tre su quello di casa);
    // in ogni lago ogni sette secondi salta un pesce. Dove c'è nebbia non si vedono.
    { const tri = [], T3 = (...v) => tri.push(...v);
      for (const k of [-1, 1]) { T3(0, 0, -1.6, k * 9, 3.2, 0.6, 0, 0, 1.8); T3(k * 9, 3.2, 0.6, k * 4.5, 1.9, 2.6, 0, 0, 1.8); }      // le due ali a punta
      T3(-1.2, -0.3, -3.2, 1.2, -0.3, -3.2, 0, -0.3, 3.6);                                                                           // il corpicino
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); gg.computeVertexNormals();
      this.gulls = []; LAKES.forEach((L, i) => { for (let k = 0; k < (i === 0 ? 3 : 1); k++) this.gulls.push({ L, r: 0.42 + k * 0.2, sp: (0.16 + k * 0.05) * (i % 2 ? -1 : 1), ph: i * 1.9 + k * 2.4, h: 78 + k * 16 }); });
      this.gullIM = new THREE.InstancedMesh(gg, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, emissive: 0x666666 }), this.gulls.length);
      this.gullIM.castShadow = true; this.gullIM.frustumCulled = false; s.add(this.gullIM);
      const fg = new THREE.ConeGeometry(2.4, 10, 5); fg.rotateX(Math.PI / 2);                                                        // la punta guarda avanti
      this.fish = LAKES.map((L, i) => ({ L, ph: i * 3.3, a: i * 1.7 }));
      this.fishIM = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: 0xff9d5c, emissive: 0x5a2a10 }), this.fish.length);
      this.fishIM.frustumCulled = false; s.add(this.fishIM);
      this._up = new THREE.Vector3(0, 1, 0); this._eu = new THREE.Euler(); }

    { const ix = (ISLAND.c + 0.5) * G, iz = (ISLAND.r + 0.5) * G, R = (ISLAND.rad + 0.62) * G;       // l'isola: sabbia attorno, prato sopra
      const sand = new THREE.Mesh(geom('isl', () => new THREE.SphereGeometry(1, 18, 8)), M('#d8c79a')); sand.scale.set(R, 5, R * 0.94); sand.position.set(ix, 0.4, iz); sand.receiveShadow = true; s.add(sand);
      const top = new THREE.Mesh(geom('isl', () => new THREE.SphereGeometry(1, 18, 8)), M(GRASS)); top.scale.set(R * 0.84, 6.4, R * 0.78); top.position.set(ix, 0.8, iz); top.receiveShadow = true; s.add(top); }
    this.railIM = mk(geom('bridgeRail', () => mergeGeos([[0, 10.4, -(G / 2 - 2.5), G + 1, 2, 2.2], [0, 6.6, -(G / 2 - 2.5), G + 1, 1.4, 1.6], [-(G / 2 - 3), 6, -(G / 2 - 2.5), 3, 12, 3], [G / 2 - 3, 6, -(G / 2 - 2.5), 3, 12, 3]].map(([x, y, z, w, h, d]) => { const m = new THREE.BoxGeometry(w, h, d); m.translate(x, y, z); return m; }))), M(WOOD_D), 1600);
    this.railIM.count = 0;
    this.bridgeIM = mk(geom('bridgeDeck', () => mergeGeos([[0, 3.4, 0, G + 0.6, 2.8, G + 0.6], [-G / 4, 4.9, 0, 0.8, 0.3, G], [G / 4, 4.9, 0, 0.8, 0.3, G], [0, 4.9, 0, 0.8, 0.3, G], [0, 0, 0, 5, 7, 5]].map(([x, y, z, w, h, d]) => { const m = new THREE.BoxGeometry(w, h, d); m.translate(x, y, z); return m; }))), M(WOOD_L), 400);
    this.bridgeIM.count = 0;
    this.bridgeIM.count = 0;

    // neve d'inverno: un velo bianco sopra il prato
    this.snow = new THREE.Mesh(new THREE.PlaneGeometry(22000, 20000), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.snow.rotation.x = -Math.PI / 2; this.snow.position.set(WORLD_W / 2, 0.35, WORLD_H / 2); this.snow.receiveShadow = true; this.snow.visible = false; s.add(this.snow);
    this.mapMat = map.material;
    // nuvole sopra la mappa non esplorata (alte 150: coprono alberi e villaggi; le cime più alte spuntano)
    this.fogCv = document.createElement('canvas'); this.fogCv.width = FW * 8; this.fogCv.height = FH * 8;
    this.fogTex = new THREE.CanvasTexture(this.fogCv); this.fogTex.colorSpace = THREE.SRGBColorSpace;
    this.fogMat = new THREE.MeshBasicMaterial({ map: this.fogTex, transparent: true, depthWrite: false, color: 0xf2f6fc, fog: false });
    const FWU = FW * FOG.cell * G, FHU = FH * FOG.cell * G;
    this.fogMesh = new THREE.Mesh(new THREE.PlaneGeometry(FWU, FHU), this.fogMat);
    this.fogMesh.rotation.x = -Math.PI / 2; this.fogMesh.position.set(FWU / 2, 150, FHU / 2 + 105); this.fogMesh.renderOrder = 5; s.add(this.fogMesh);      // +105: così, vista di sbieco, copre il punto giusto a terra
    this.fogRev = -1;
    // rovine
    this.ruins = RUINS.map((R) => { const g = makeRuin(R.id); bake(g, [g.userData.chest]); g.position.set((R.c + 0.5) * G, 0, (R.r + 0.5) * G); g.rotation.y = R.id * 0.9; s.add(g); return g; });

    // ombra d'appoggio sotto gli edifici: una macchia scura sfumata, che li «pianta» per terra
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    { const x = sc.getContext('2d'), gr = x.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.26)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
    const aoG = new THREE.PlaneGeometry(1, 1); aoG.rotateX(-Math.PI / 2);
    this.aoIM = new THREE.InstancedMesh(aoG, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }), AO_CAP);
    this.aoIM.frustumCulled = false; this.aoIM.renderOrder = 1; this.aoIM.position.y = 0.8; this.aoIM.count = 0; s.add(this.aoIM);

    // natura dentro la mappa: alberi e rocce che si possono togliere
    this.trees = NATURE.filter(n => n.kind === 'tree'); this.rocks = NATURE.filter(n => n.kind === 'rock');
    this.tT = treeSet(this.trees.map(n => ({ x: (n.c + 0.5) * G, z: (n.r + 0.5) * G, tint: n.tint })), true);
    this.rockIM = mk(geom('rock', () => new THREE.DodecahedronGeometry(1)), M('#8d8f96', { flat: true }), this.rocks.length);
    // giacimenti: ferro (roccia rugginosa con le vene chiare) e cristallo (punte azzurre)
    this.irons = NATURE.filter(n => n.kind === 'iron'); this.crystals = NATURE.filter(n => n.kind === 'crystal');
    this.ironIM = mk(geom('rock', () => new THREE.DodecahedronGeometry(1)), M('#8a4f36', { flat: true }), this.irons.length);
    this.ironDot = mk(geom('oreDot', () => new THREE.OctahedronGeometry(1)), M('#f0a060', { flat: true, e: 0x803010, ei: 0.5 }), this.irons.length * 3, false);
    this.crysIM = mk(geom('crys', () => new THREE.OctahedronGeometry(1)), M('#8fe8ff', { flat: true, e: 0x2fb8e0, ei: 0.75 }), this.crystals.length * 3);
    this.cutN = -1;

    // mura e recinti a istanze
    this.wallBase = mk(geom('wallB', () => roundBoxGeo(G, 30, G, 4)), M('#a3a4ae'), WALL_CAP);
    this.wallTop = mk(geom('wallT', () => mergeGeos([[-11, -11], [11, -11], [-11, 11], [11, 11]].map(([x, z]) => { const m = new THREE.BoxGeometry(12, 9, 12); m.translate(x, 0, z); return m; }))), M('#bcbdc8'), WALL_CAP);      // quattro merli
    this.post = mk(geom('fpost', () => new THREE.CylinderGeometry(3.2, 3.8, 24, 7)), M(WOOD_D), WALL_CAP);
    this.rail = mk(geom('frail', () => new THREE.BoxGeometry(G, 3.4, 2.6)), M(WOOD_L), WALL_CAP * 4, false);
    this.wallBase.count = this.wallTop.count = this.post.count = this.rail.count = 0;
    this.rev = -1;
    this.roadIM = mk(geom('roadT', () => new THREE.BoxGeometry(G + 0.4, 1.4, G + 0.4)), M('#d2b07c'), DECO_CAP, false); this.roadIM.receiveShadow = true;
    this.bedIM = mk(geom('bedB', () => roundBoxGeo(32, 6, 32, 2.6)), M('#7a5634'), DECO_CAP, false);
    this.hedgeIM = mk(geom('hedge', () => roundBoxGeo(35, 17, 35, 7)), M('#ffffff'), DECO_CAP, true);              // siepi: un cubo verde tondo per quadretto
    this.paveIM = mk(geom('pave', () => new THREE.BoxGeometry(39.4, 1.4, 39.4)), M('#ffffff'), DECO_CAP, false); this.paveIM.receiveShadow = true;      // lastricato
    // trappole (una tavola con le punte) e fossati (terra scura con l'acqua dentro)
    this.trapIM = mk(geom('trapB', () => new THREE.BoxGeometry(31, 2.2, 31)), M('#8a5a34'), DECO_CAP, false); this.trapIM.receiveShadow = true;
    this.spikeIM = mk(geom('trapS', () => mergeGeos([[-9, -9], [9, -9], [0, 0], [-9, 9], [9, 9], [0, -10], [0, 10], [-10, 0], [10, 0]].map(([x, z]) => { const m = new THREE.ConeGeometry(2.6, 11, 6); m.translate(x, 6.5, z); return m; }))), M('#d4d7e0'), DECO_CAP, false);
    this.moatIM = mk(geom('moatB', () => new THREE.BoxGeometry(G + 7, 1.3, G + 7)), M('#4b3521'), DECO_CAP, false); this.moatIM.receiveShadow = true;
    this.moatW = mk(geom('moatW', () => new THREE.BoxGeometry(G + 0.3, 0.6, G + 0.3)), M('#3a7fa6'), DECO_CAP, false);      // l'acqua copre tutto il quadretto: i pezzi vicini si uniscono, il bordo di terra resta solo attorno
    this.bedLeaf = mk(geom('bedL', () => new THREE.SphereGeometry(1, 7, 4)), M('#4f9a4b'), DECO_CAP, false);
    this.bedFlower = mk(geom('bedF', () => new THREE.IcosahedronGeometry(1, 0)), M('#ffffff'), DECO_CAP * 4, false);
    this.lampPole = mk(geom('lampP', () => new THREE.CylinderGeometry(1.5, 2.4, 34, 6)), M('#3d3e46'), 300);
    this.lampHead = mk(geom('lampH', () => new THREE.SphereGeometry(5.2, 9, 7)), M('#ffe9a0', { e: 0xffc040, ei: 1 }), 300, false);
    this.plantT = treeSet(Array.from({ length: PLANT_CAP }, (_, i) => ({ x: 0, z: 0, tint: i % 4 })), true, true);
    for (let i = 0; i < PLANT_CAP; i++) tree(this.plantT, i, 0, 0, 0, i % 4, 0);
    for (const im of [this.roadIM, this.bedIM, this.bedLeaf, this.bedFlower, this.lampPole, this.lampHead]) im.count = 0;

    // i villaggi degli altri popoli
    const vr = mulberry32(77);
    this.villages = TRIBES.map((T) => { const g = makeVillage(T, vr); bake(g, [g.userData.flag, g.userData.fire]); g.position.set((T.c + 0.5) * G, 0, (T.r + 0.5) * G); s.add(g); return g; });
    this.vAO = TRIBES.map((T) => ({ x: (T.c + 0.5) * G, z: (T.r + 0.5) * G, w: 150, d: 140 }));

    // i Tuzu: un solo corpo e un solo viso, disegnati a istanze (il colore è per istanza)
    const bg = geom('tuzu', blobGeo), fg = geom('tuzuFace', faceGeo);
    const skin = soften(new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 22, specular: 0x26262e }), 0.3, 0.03);      // pelle morbida, appena lucida
    this.blobIM = mk(bg, skin, BLOB_CAP);
    this.limbIM = mk(geom('tuzuLimb', limbGeo), skin, BLOB_CAP);
    this.cheekIM = mk(geom('tuzuCheek', cheekGeo), new THREE.MeshBasicMaterial({ color: 0xff7f9f, transparent: true, opacity: 0.62, depthWrite: false }), BLOB_CAP, false);
    this.ghostIM = mk(bg, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, emissive: 0x334455 }), 80, false);
    const ink = new THREE.MeshBasicMaterial({ color: 0x2b2a33 }), chalk = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.faces = [0, 1, 2, 3, 4].map(k => mk(geom('tuzuFace' + (k || ''), () => faceGeo(k)), ink, k < 2 ? BLOB_CAP : 160, false));
    this.facesL = [0, 1].map(k => mk(geom('tuzuFace' + (k || ''), () => faceGeo(k)), chalk, 120, false));
    this.nFace = [0, 0, 0, 0, 0]; this.nFaceL = [0, 0];
    this.shineIM = mk(geom('tuzuShine', shineGeo), new THREE.MeshBasicMaterial({ color: 0xffffff }), BLOB_CAP, false);
    this._bq = new THREE.Quaternion(); this._up = new THREE.Vector3(0, 1, 0);
    this.gear = new Map(); this.nb = this.ng = this.nf = this.nl = 0;
    for (const im of [this.blobIM, this.limbIM, this.cheekIM, this.ghostIM, this.shineIM, ...this.faces, ...this.facesL]) im.count = 0;
    void fg;

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
        g.visible = true; g.position.set(spec.at.x, 2, spec.at.y); g.rotation.y = spec.rot || 0; this.ghostOn = g;
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
    let na = 0;
    for (const v of this.vAO) this.aoIM.setMatrixAt(na++, m4.compose(P3.set(v.x, 0, v.z), q.identity(), S3.set(v.w, 1, v.d)));
    for (const b of world.d.buildings) {
      if (na >= AO_CAP || b.type === 'recinto' || b.type === 'mura' || b.type === 'campo' || b.type === 'cancello' || BUILD[b.type].deco) continue;
      const k = b.type === 'castello' ? 190 : BUILD[b.type].w === 1 ? 64 : 122;
      this.aoIM.setMatrixAt(na++, m4.compose(P3.set(b.x, 0, b.y + 4), q, S3.set(k, 1, k * 0.9)));
    }
    this.aoIM.count = na; this.aoIM.instanceMatrix.needsUpdate = true;
    // strade, aiuole, lampioni, alberi piantati
    let nR = 0, nB = 0, nF = 0, nL = 0, nT = 0, nBr = 0, nRail = 0, nH = 0, nP = 0, nTr = 0, nMo = 0;
    const col = this._col, isBr = (c, r) => { const o = world.buildingAt(c, r); return !!o && o.type === 'ponte'; }, dry = (c, r) => TERRAIN[r * COLS + c] !== 3;
    for (const b of world.d.buildings) {
      if (!BUILD[b.type].deco) continue;
      if (b.type === 'ponte') {        // corre verso un altro pezzo di ponte; un pezzo solo, verso la riva più vicina
        const hz = isBr(b.c - 1, b.r) || isBr(b.c + 1, b.r), vt = isBr(b.c, b.r - 1) || isBr(b.c, b.r + 1);
        const alongX = hz ? true : vt ? false : dry(b.c - 1, b.r) || dry(b.c + 1, b.r);
        if (nBr < 400) this.bridgeIM.setMatrixAt(nBr++, m4.compose(P3.set(b.x, 0, b.y), alongX ? qy : q, S3.set(1, 1, 1)));      // le assi corrono per il verso del ponte
        // il parapetto solo dove di fianco c'è acqua aperta: 0 nord, 1 ovest, 2 sud, 3 est
        [[0, -1], [-1, 0], [0, 1], [1, 0]].forEach(([dc, dr], i) => { const cc = b.c + dc, rr = b.r + dr; if (nRail < 1600 && cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && !dry(cc, rr) && !isBr(cc, rr)) this.railIM.setMatrixAt(nRail++, m4.compose(P3.set(b.x, 0, b.y), RAIL_Q[i], S3.set(1, 1, 1))); });
        continue;
      }
      if (b.type === 'strada') continue;        // le strade sono dipinte sulla mappa (più sotto)
      if (b.type === 'trappola') { if (nTr < DECO_CAP) { m4.compose(P3.set(b.x, 1.1, b.y), ROT_Q[0], S3.set(1, 1, 1)); this.trapIM.setMatrixAt(nTr, m4); this.spikeIM.setMatrixAt(nTr++, m4); } continue; }
      if (b.type === 'fossato') { if (nMo < DECO_CAP) { this.moatIM.setMatrixAt(nMo, m4.compose(P3.set(b.x, 0.7, b.y), ROT_Q[0], S3.set(1, 1, 1))); this.moatW.setMatrixAt(nMo++, m4.compose(P3.set(b.x, 1.5, b.y), ROT_Q[0], S3.set(1, 1, 1))); } continue; }
      if (b.type === 'siepe') { if (nH < DECO_CAP) { this.hedgeIM.setMatrixAt(nH, m4.compose(P3.set(b.x, 8.5, b.y), ROT_Q[0], S3.set(1, 1, 1))); this.hedgeIM.setColorAt(nH++, col.set((b.c + b.r) % 2 ? '#3f8f4a' : '#4c9c50')); } continue; }
      if (b.type === 'piazza') { if (nP < DECO_CAP) { this.paveIM.setMatrixAt(nP, m4.compose(P3.set(b.x, 0.8, b.y), ROT_Q[0], S3.set(1, 1, 1))); this.paveIM.setColorAt(nP++, col.set((b.c + b.r) % 2 ? '#d8d0bf' : '#c6bdaa')); } continue; }
      if (b.type === 'aiuola' && nB < DECO_CAP) {
        const qb = ROT_Q[(b.rot || 0) % 8];
        this.bedIM.setMatrixAt(nB, m4.compose(P3.set(b.x, 3, b.y), qb, S3.set(1, 1, 1)));
        this.bedLeaf.setMatrixAt(nB++, m4.compose(P3.set(b.x, 6.4, b.y), qb, S3.set(13, 4.6, 13)));
        for (let k = 0; k < 4; k++) { const a = b.id * 1.3 + k * 1.571 - (b.rot || 0) * Math.PI / 4; this.bedFlower.setMatrixAt(nF, m4.compose(P3.set(b.x + Math.cos(a) * 7.5, 10.5, b.y + Math.sin(a) * 7.5), q, S3.set(3.3, 3.3, 3.3))); this.bedFlower.setColorAt(nF++, col.set(FLOWERS[(b.id + k) % FLOWERS.length])); }
      } else if (b.type === 'lampione' && nL < 300) {
        this.lampPole.setMatrixAt(nL, m4.compose(P3.set(b.x, 17, b.y), q, S3.set(1, 1, 1)));
        this.lampHead.setMatrixAt(nL++, m4.compose(P3.set(b.x, 37, b.y), q, S3.set(1, 1, 1)));
      } else if (b.type === 'albero' && nT < PLANT_CAP) { this._tree(this.plantT, nT, b.x, b.y, 15 + (b.id % 5), nT % 4, b.id * 1.7); nT++; }
    }
    // le strade costruite: dipinte sulla mappa, come quelle che c'erano già (si ridipinge solo quando cambiano)
    { const cells = []; let sig = ''; for (const b of world.d.buildings) if (b.type === 'strada') { cells.push({ c: b.c, r: b.r }); sig += b.c + ',' + b.r + ';'; }
      if (sig !== this.roadSig) {
        if (!this.baseCv) { this.baseCv = document.createElement('canvas'); this.baseCv.width = this.mapCv.width; this.baseCv.height = this.mapCv.height; this.baseCv.getContext('2d').drawImage(this.mapCv, 0, 0); }
        this.roadBox = paintBuiltRoads(this.mapCv, this.baseCv, 0.5, cells, this.roadBox); this.roadSig = sig; this.roadRev++; this.tex.needsUpdate = true;
      } }
    for (let i = nT; i < (this._plantN || 0); i++) this._tree(this.plantT, i, 0, 0, 0, i % 4, 0);
    this._plantN = nT; this._flush(this.plantT);
    this.bridgeIM.count = nBr; this.bridgeIM.instanceMatrix.needsUpdate = true;
    this.railIM.count = nRail; this.railIM.instanceMatrix.needsUpdate = true;
    this.roadIM.count = nR; this.bedIM.count = this.bedLeaf.count = nB; this.bedFlower.count = nF; this.lampPole.count = this.lampHead.count = nL;
    this.hedgeIM.count = nH; this.paveIM.count = nP;
    this.trapIM.count = this.spikeIM.count = nTr; this.moatIM.count = this.moatW.count = nMo;
    for (const im of [this.trapIM, this.spikeIM, this.moatIM, this.moatW]) im.instanceMatrix.needsUpdate = true;
    for (const im of [this.roadIM, this.bedIM, this.bedLeaf, this.bedFlower, this.lampPole, this.lampHead, this.hedgeIM, this.paveIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    q.identity(); S3.set(1, 1, 1);
    q.identity(); S3.set(1, 1, 1);
    for (const im of [this.wallBase, this.wallTop, this.post, this.rail]) im.instanceMatrix.needsUpdate = true;
  }

  _nature(world) {
    const m4 = this._m4, q = this._q, P3 = this._P3, S3 = this._S3, e = new THREE.Euler(), rq = new THREE.Quaternion();
    q.identity();
    this.trees.forEach((n, i) => {
      const x = (n.c + 0.5) * G, z = (n.r + 0.5) * G;
      this._tree(this.tT, i, x, z, world.cutSet.has(n.id) ? 0 : 15 * n.size, n.tint === 3 && n.id % 3 ? 1 : n.tint, n.id * 1.7);      // (3 → 1: resta una latifoglia)
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
    this._flush(this.tT);
    for (const im of [this.rockIM, this.ironIM, this.ironDot, this.crysIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.cutN = world.cutSet.size;
  }

  /** Disegna un Tuzu: (x, y) sul terreno, lift = altezza del salto, H = statura, squash = schiacciamento (1 = fermo). */
  tuzu(x, y, lift, ang, H, squash, color, light, ghost, expr = 0) {
    const k = 1 / Math.sqrt(squash), m4 = this._m4;
    m4.compose(this._P3.set(x, lift, y), this._bq.setFromAxisAngle(this._up, -facing(ang)), this._S3.set(H * k, H * squash, H * k));
    if (ghost) { if (this.ng >= 80) return; this.ghostIM.setMatrixAt(this.ng, m4); this.ghostIM.setColorAt(this.ng++, c3(color)); }
    else { if (this.nb >= BLOB_CAP) return; this.blobIM.setMatrixAt(this.nb, m4); this.limbIM.setMatrixAt(this.nb, m4); this.cheekIM.setMatrixAt(this.nb, m4); this.limbIM.setColorAt(this.nb, c3(color)); this.blobIM.setColorAt(this.nb++, c3(color)); }
    if (light) { const k = expr === 1 ? 1 : 0; if (this.nFaceL[k] < 120) this.facesL[k].setMatrixAt(this.nFaceL[k]++, m4); return; }
    if (this.nFace[expr] >= (expr < 2 ? BLOB_CAP : 160)) expr = 0;
    if (this.nFace[expr] >= BLOB_CAP) return;
    this.faces[expr].setMatrixAt(this.nFace[expr]++, m4);
    if (expr !== 4 && this.nf < BLOB_CAP) this.shineIM.setMatrixAt(this.nf++, m4);
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

  /** Tutti contenti per qualche secondo (una notte vinta, un villaggio conquistato). */
  cheer(secs = 4) { this.cheerT = secs; }
  setSeason(season) {
    this.season = season; this.cutN = -1;
    if (this._deco) this._deco();
    const tint = { primavera: 0xffffff, estate: 0xfff4da, autunno: 0xf6dcae, inverno: 0xdfe8f5 }[season] || 0xffffff;
    this.mapMat.color.setHex(tint);
    this.snow.visible = season === 'inverno'; this.snow.material.opacity = season === 'inverno' ? 0.5 : 0;
  }
  /** Ridisegna le nuvole: bianche dove non hai esplorato, niente dove hai visto. */
  _fog(world) {
    const c = this.fogCv.getContext('2d'), small = document.createElement('canvas'); small.width = FW; small.height = FH;
    const x = small.getContext('2d'), img = x.createImageData(FW, FH);
    for (let i = 0; i < FW * FH; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = world.fogA[i] ? 0 : 255; }
    x.putImageData(img, 0, 0);
    c.clearRect(0, 0, this.fogCv.width, this.fogCv.height); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.filter = 'blur(5px)'; c.drawImage(small, 0, 0, this.fogCv.width, this.fogCv.height); c.filter = 'none';
    this.fogTex.needsUpdate = true; this.fogRev = world.fogRev;
  }

  /** Allinea la scena al mondo di gioco. */
  sync(world, time, now) {
    const s = this.scene, dt = Math.max(0, Math.min(0.1, time - this._t));
    this._t = time;
    if (world.season !== this.season) this.setSeason(world.season);
    // le barche di figura e le navi della flotta in partenza o in arrivo
    for (const B of this.boats || []) {
      let x, y, ang;
      if (B.lake) { const a = time * 0.05 * B.dir + B.ph; x = B.lake.x + Math.cos(a) * B.lake.rx * B.k; y = B.lake.y + Math.sin(a) * B.lake.ry * B.k; ang = Math.atan2(-Math.sin(a) * B.lake.rx * B.dir, Math.cos(a) * B.lake.ry * B.dir); }
      else { const len = B.pts.length - 1, u = (time * B.sp / 15 + B.ph * 40) % (len * 2), f = u <= len ? u : len * 2 - u, i = Math.min(len - 1, Math.floor(f)), k = f - i, p = B.pts[i], q2 = B.pts[i + 1], dir = u <= len ? 1 : -1; x = p.x + (q2.x - p.x) * k; y = p.y + (q2.y - p.y) * k; ang = Math.atan2((q2.x - p.x) * dir, (q2.y - p.y) * dir); }
      B.g.visible = world.seen(Math.floor(x / G), Math.floor(y / G));
      if (!B.g.visible) continue;
      B.g.position.set(x, 1 + Math.sin(time * 2 + B.ph) * 0.6, y);
      let d = ang - B.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); B.g.rotation.y += d * Math.min(1, dt * 2.2 + (B.init ? 0 : 1)); B.init = true;
      B.g.rotation.z = Math.sin(time * 1.3 + B.ph) * 0.03;
    }
    if (this.gullIM) {
      const m4 = this._m4, q = this._q, P3 = this._P3, S3 = this._S3;
      this.gulls.forEach((g, i) => {
        const a = time * g.sp + g.ph, x = g.L.x + Math.cos(a) * g.L.rx * g.r, y = g.L.y + Math.sin(a) * g.L.ry * g.r;
        const k = world.seen(Math.floor(x / G), Math.floor(y / G)) ? 1.5 : 0.0001, glide = Math.sin(time * 0.5 + g.ph) > 0.25;      // ogni tanto plana ad ali ferme
        q.setFromAxisAngle(this._up, Math.atan2(-Math.sin(a) * g.L.rx * g.sp, Math.cos(a) * g.L.ry * g.sp));
        m4.compose(P3.set(x, g.h + Math.sin(time * 0.8 + g.ph) * 6, y), q, S3.set(k, k * (glide ? 0.45 : Math.sin(time * 7 + g.ph * 3)), k));
        this.gullIM.setMatrixAt(i, m4);
      });
      this.gullIM.instanceMatrix.needsUpdate = true;
      this.fish.forEach((F, i) => {
        const tt = time + F.ph, n = Math.floor(tt / 7), u = (tt - n * 7) / 0.9;                                                      // un salto di 0,9 secondi ogni 7
        const ang = F.a + n * 2.4, rr = 0.2 + ((n * 37) % 10) / 26, x = F.L.x + Math.cos(ang) * F.L.rx * rr, y = F.L.y + Math.sin(ang) * F.L.ry * rr;
        const hx = Math.cos(ang + 1.3), hy = Math.sin(ang + 1.3), on = u < 1 && world.seen(Math.floor(x / G), Math.floor(y / G));
        this._eu.set(-(1 - 2 * u) * 1.1, Math.atan2(hx, hy), 0, 'YXZ'); q.setFromEuler(this._eu);
        m4.compose(P3.set(x + hx * (u - 0.5) * 26, Math.sin(Math.min(1, u) * Math.PI) * 15 - 3, y + hy * (u - 0.5) * 26), q, S3.setScalar(on ? 1 : 0.0001));
        this.fishIM.setMatrixAt(i, m4);
      });
      this.fishIM.instanceMatrix.needsUpdate = true;
    }
    for (let n = (this.sails || []).length - 1; n >= 0; n--) {
      const S = this.sails[n]; S.d += dt * 62;
      let i = 0, acc = S.d; while (i < S.pts.length - 2 && acc > S.seg[i]) { acc -= S.seg[i]; i++; }
      const p = S.pts[i], q2 = S.pts[i + 1], k = Math.min(1, acc / (S.seg[i] || 1)), x = p.x + (q2.x - p.x) * k, y = p.y + (q2.y - p.y) * k, left = S.total - S.d;
      S.g.position.set(x, 1 + Math.sin(time * 2.2) * 0.6, y);
      let d = Math.atan2(q2.x - p.x, q2.y - p.y) - S.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); S.g.rotation.y += d * Math.min(1, dt * 3 + (S.d < 4 ? 1 : 0));
      const sc = S.arriving ? Math.min(1, 0.15 + S.d / 90) * Math.min(1, Math.max(0, left / 40 + 0.4)) : Math.min(1, Math.max(0, left / 110));
      S.g.scale.setScalar(Math.max(0.01, sc));
      if (left <= 0) { drop(s, S.g); this.sails.splice(n, 1); }
    }
    if (this.fogRev !== world.fogRev) this._fog(world);
    this.fogMesh.visible = world.fogA.includes(0);
    this.fogMat.opacity = 0.96; this.fogMat.color.setRGB(0.95 - this.nightK * 0.6, 0.965 - this.nightK * 0.55, 0.99 - this.nightK * 0.4);
    RUINS.forEach((R, i) => { const u = this.ruins[i].userData; u.chest.visible = !world.d.ruins[R.id]; if (u.chest.visible) u.glow.scale.setScalar(1 + Math.sin(time * 3 + i) * 0.25); });
    if (this.cutN !== world.cutSet.size) this._nature(world);
    if (this.rev !== world.rev) { this._walls(world); this.rev = world.rev; }

    // edifici
    const seen = this._seen; seen.clear();
    for (const b of world.d.buildings) {
      if (b.type === 'recinto' || b.type === 'mura' || BUILD[b.type].deco) continue;
      seen.add(b.id);
      let key, crop = null, vertical = false;
      if (b.type === 'campo') { const st = world.crop(b, now); crop = st.empty ? null : st; key = st.empty ? 'E' : st.crop + (st.ripe ? 3 : Math.min(2, Math.floor(st.progress * 3))); }
      else if (b.type === 'castello') key = 'C' + world.d.castle;
      else if (b.type === 'cancello') { vertical = (wallish(world.buildingAt(b.c, b.r - 1)) || wallish(world.buildingAt(b.c, b.r + 1))) && !(wallish(world.buildingAt(b.c - 1, b.r)) || wallish(world.buildingAt(b.c + 1, b.r))); key = vertical ? 'V' : 'H'; }
      else key = 'L' + (b.lvl || 0);
      let rot = (b.rot || 0) * Math.PI / 4, ships = null;
      if (b.type === 'scalo' || b.type === 'porto') { const big = b.type === 'scalo', docks = world.d.buildings.filter(x => x.type === b.type && !(x.build > 0)), k = docks.indexOf(b), idle = world.d.fleet.filter(q => !q.job), nBig = world.d.buildings.filter(x => x.type === 'scalo' && !(x.build > 0)).length; ships = k < 0 ? [] : big ? idle.slice(k * 3, k * 3 + 3) : idle.slice(nBig * 3 + k, nBig * 3 + k + 1); key += '|' + ships.map(q => q.type[0] + q.lvl).join(''); }
      if (b.type === 'porto' || b.type === 'scalo') {      // verso l'acqua più vicina
        let wx = 0, wy = 0; const c0 = Math.floor(b.x / G), r0 = Math.floor(b.y / G);
        for (let rr = r0 - 5; rr <= r0 + 5; rr++) for (let cc = c0 - 5; cc <= c0 + 5; cc++) { if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || TERRAIN[rr * COLS + cc] !== 3) continue; const dx = (cc + 0.5) * G - b.x, dy = (rr + 0.5) * G - b.y, dd = dx * dx + dy * dy || 1; wx += dx / dd; wy += dy / dd; }
        if (wx || wy) rot = Math.round(Math.atan2(wx, wy) / (Math.PI / 2)) * (Math.PI / 2);
      }
      if (rot) key += '|r' + Math.round(rot * 10);
      let o = this.bMesh.get(b.id);
      if (!o || o.key !== key) {
        const fresh = !o;
        if (o) drop(s, o.g);
        const g = makeModel(b.type, { lvl: b.lvl || 0, castle: world.d.castle, crop, id: b.id, vertical, rot, ships });
        g.position.set(b.x, 0, b.y); s.add(g);
        o = { g, key, sx: g.scale.x, sy: g.scale.y, sz: g.scale.z, pop: (fresh && this.ready) || (!fresh && b.type !== 'campo') ? 0 : 1 };
        this.bMesh.set(b.id, o);
      }
      const g = o.g, u = g.userData;
      if (g.position.x !== b.x || g.position.z !== b.y) g.position.set(b.x, g.position.y, b.y);      // un edificio spostato: il modello lo segue (prima restava dov'era)
      if (b.build > 0) {               // in cantiere: cresce dal basso, un po' traballante
        const p = 1 - b.build / (BUILD[b.type].time || 1), w = 1 + Math.sin(time * 22 + b.id) * 0.012;
        g.scale.set(o.sx * w, o.sy * (0.16 + 0.84 * p), o.sz * w); o.pop = 1; o.site = true;
      } else if (o.site) { o.site = false; o.pop = 0.55; }
      else if (o.pop < 1 || b.hitT > 0) {      // appena costruito spunta con un rimbalzo; colpito, trema
        o.pop = Math.min(1, o.pop + dt * 2.6);
        const k = o.pop - 1, e = 0.35 + 0.65 * (1 + 2.7 * k * k * k + 1.7 * k * k), w = b.hitT > 0 ? 1 + Math.sin(time * 60) * 0.03 : 1;
        g.scale.set(o.sx * e * w, o.sy * e, o.sz * e * w);
      } else if (g.scale.x !== o.sx) g.scale.set(o.sx, o.sy, o.sz);
      if (u.boat) { const ph = time * 0.3 + b.id, sw = Math.sin(ph); u.boat.position.z = 100 + sw * 26; u.boat.position.x = -22 + Math.sin(ph * 0.5) * 6; u.boat.rotation.y = Math.cos(ph) > 0 ? 0 : Math.PI; u.boat.position.y = 1 + Math.sin(time * 2.2 + b.id) * 0.7; u.boat.rotation.z = Math.sin(time * 1.7 + b.id) * 0.05; }
      if (u.moored) for (let i = 0; i < u.moored.length; i++) { const m = u.moored[i]; m.position.y = 1 + Math.sin(time * 1.6 + i * 2.1 + b.id) * 0.8; m.rotation.z = Math.sin(time * 1.1 + i * 1.7 + b.id) * 0.035; }
      if (u.beam) u.beam.rotation.y = time * 0.9;
      if (u.wheel) u.wheel.rotation.x = time * 1.1;
      if (u.blade) u.blade.rotation.y = time * 5;
      if (u.sails) u.sails.rotation.z = time * 0.9;
      if (u.jets) u.jets.forEach((j, i) => { j.scale.y = 0.8 + Math.sin(time * 6 + i * 1.3) * 0.22; });
      if (u.glow) u.glow.scale.setScalar(1 + Math.sin(time * 5 + b.id) * 0.18);
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
    this.nb = this.ng = this.nf = this.nl = 0; this.nFace.fill(0); this.nFaceL.fill(0);
    if (this.cheerT > 0) this.cheerT -= dt;
    const joy = this.cheerT > 0, morale = world.morale(), mood = joy || morale >= 80 ? 4 : morale < 30 ? 3 : 0, fight = world.status !== 'day';
    const live = this._live || (this._live = new Set()); live.clear();
    for (const e of world.enemies) {
      const T = TRIBES[e.tribe] || TRIBES[0], H = TUZU_H[e.type] * (1 + Math.max(0, e.hit) * 1.4);
      const hop = Math.abs(Math.sin(e.anim * Math.PI)), lunge = e.striking > 0 ? Math.sin(e.striking / 0.25 * Math.PI) * 9 : 0;
      const x = e.x + Math.cos(e.ang) * lunge, y = e.y + Math.sin(e.ang) * lunge;
      const lift = e.ghost ? 7 + Math.sin(time * 3 + e.anim) * 3 : hop * H * 0.13, sq = e.ghost ? 1 : 0.94 + hop * 0.14;
      this.tuzu(x, y, lift, e.ang, H, sq, T.color, T.eyes !== '#2b2a33', e.ghost, e.hit > 0 ? 2 : 1);
      const u = this.gearFor('e' + e.id, e.type, x, y, lift, e.ang, H);
      if (u && e.siege) u.arm.rotation.z = e.striking > 0 ? 1.5 * Math.sin(e.striking / 0.4 * Math.PI) : 0;
      else if (u) { u.arm.rotation.z = e.striking > 0 ? -1.3 * Math.sin(e.striking / 0.25 * Math.PI) : 0; if (u.aura) u.aura.scale.setScalar(1 + Math.sin(time * 4) * 0.08); }
    }
    for (const sd of world.soldiers) {
      const H = TUZU_H[sd.type] * (1 + Math.max(0, sd.hit) * 1.4), hop = Math.abs(Math.sin(sd.anim));
      const lift = hop * H * 0.12;
      const AT = sd.ally != null ? TRIBES[sd.ally] : null;
      this.tuzu(sd.x, sd.y, lift, sd.ang, H, 0.95 + hop * 0.12, AT ? AT.color : MY_COLOR, !!AT && AT.eyes !== '#2b2a33', false, sd.hit > 0 ? 2 : joy ? 4 : fight ? 1 : 0);
      const u = this.gearFor('s' + sd.id, sd.type, sd.x, sd.y, lift, sd.ang, H);
      if (u) { u.arm.rotation.z = sd.strike > 0 ? -1.2 * Math.sin(sd.strike / 0.2 * Math.PI) : 0; if (u.aura) u.aura.scale.setScalar((world.shoutT > 0 ? 1.5 : 1) + Math.sin(time * 4) * 0.08); }
    }
    if (world.status !== 'night') for (let wi = 0; wi < world.workers.length; wi++) {
      const wk = world.workers[wi], gk = ROLE_GEAR[world.roleOf(wi)] || 'attrezzo';
      const H = TUZU_H.villager * 1.04, work = wk.state === 'work', hop = Math.abs(Math.sin(work ? wk.anim : wk.anim * 1.2 + wk.id)), lift = hop * (work ? 2 : 3.2);
      this.tuzu(wk.x, wk.y, lift, work ? -Math.PI / 2 + 0.6 : wk.ang, H, 0.95 + hop * 0.1, MY_COLOR, false, false, mood);
      const u = this.gearFor('w' + wk.id + gk, gk, wk.x, wk.y, lift, work ? -Math.PI / 2 + 0.6 : wk.ang, H);
      if (u) u.arm.rotation.z = work ? -1.25 * Math.abs(Math.sin(wk.anim)) : 0;
    }
    for (const sc of world.scouts) {
      const hop = Math.abs(Math.sin(time * 9 + sc.id)), H = TUZU_H.villager * 1.05;
      this.tuzu(sc.x, sc.y, hop * 4, sc.ang, H, 0.95 + hop * 0.1, MY_COLOR, false, false, 0);
      this.gearFor('x' + sc.id, 'esplora', sc.x, sc.y, hop * 4, sc.ang, H);
    }
    { let nc = 0; for (const b of world.d.buildings) { if (!(b.build > 0) || nc >= 6) continue; nc++;
      const hop = Math.abs(Math.sin(time * 8 + b.id)), x = b.x - 34, y = b.y + 40, H = TUZU_H.villager;
      this.tuzu(x, y, hop * 2, 0.3, H, 0.96 + hop * 0.08, MY_COLOR, false, false, 0);
      const u = this.gearFor('c' + b.id, 'martello', x, y, hop * 2, 0.3, H); if (u) u.arm.rotation.z = -1.25 * hop;
    } }
    for (const [id, g] of this.gear) if (!live.has(id)) { if (g) s.remove(g); this.gear.delete(id); }
    // gli abitanti del tuo regno: di giorno girano fra le case e lavorano, di notte stanno al riparo
    if (world.status !== 'night') {
      let n = 0;
      for (const b of world.d.buildings) {
        if (n >= 44) break;
        if (b.type === 'casa') {
          for (let k = 0; k < 1; k++) {
            const ph = time * 0.32 + b.id * 1.7 + k * 2.6, f = (p) => [b.x + Math.cos(p) * 54 + Math.cos(p * 2.3 + b.id) * 12, b.y + 60 + Math.sin(p * 1.3 + k) * 15];
            const [px, py] = f(ph), [qx, qy] = f(ph + 0.05), hop = Math.abs(Math.sin(time * 5 + b.id + k * 2));
            this.tuzu(px, py, hop * 3, Math.atan2(qy - py, qx - px), TUZU_H.villager * (k ? 0.82 : 1), 0.95 + hop * 0.1, MY_COLOR, false, false, mood); n++;
          }
        } else if (WORKER[b.type]) {
          const o = WORKER[b.type], hop = Math.max(0, Math.sin(time * 4 + b.id * 2.2));
          this.tuzu(b.x + o[0], b.y + o[1], hop * 5, Math.atan2(-o[1], -o[0]), TUZU_H.villager, 1 - hop * 0.02 + (1 - hop) * 0.02, MY_COLOR, false, false, mood); n++;
        }
      }
    }
    // i villaggi: chi ci abita, lo stendardo (viola se è una tua colonia), i colpi dell'assalto
    TRIBES.forEach((T, i) => {
      const v = world.d.villages[i], g = this.villages[i], u = g.userData, R = world.raid && world.raid.i === i ? world.raid : null;
      g.visible = world.known(i); if (!g.visible) return;
      const fc = v.state === 'colony' ? MY_COLOR : T.color;
      if (u.flagCol !== fc) { u.flag.material = M(fc); u.flagCol = fc; }
      u.flag.rotation.y = Math.sin(time * 2.2 + i) * 0.18;
      u.fire.scale.y = 0.85 + Math.sin(time * 12 + i) * 0.18;
      const w = R && R.hitT > 0 ? 1 + Math.sin(time * 60) * 0.012 : 1; g.scale.set(w, 1, w);
      const fc2 = v.state === 'ally' ? '#ffffff' : null; void fc2;
      if (R) return;                                       // sotto assalto sono fuori i difensori
      if (Math.hypot(g.position.x - this.target.x, g.position.z - this.target.z) > this.dist * 1.5 + 500) return;      // lontano dalla camera: non si vedono
      for (let k = 0; k < 6; k++) {
        const f = (t) => { let x = Math.cos(t * (0.9 + k * 0.17) + k * 2.2 + i) * (96 + k * 16) + Math.sin(t * 2.1 + k) * 34, z = Math.sin(t * (0.7 + k * 0.13) + k * 1.3) * (84 + k * 14) + Math.cos(t * 1.7 + k * 2) * 26; const d = Math.hypot(x, z); if (d < 78) { x *= 78 / (d || 1); z *= 78 / (d || 1); } return [x, z]; };
        const t = time * 0.13 + i * 3, [px, pz] = f(t), [qx, qz] = f(t + 0.02), hop = Math.abs(Math.sin(time * 4.6 + k * 1.9 + i));
        this.tuzu(g.position.x + px, g.position.z + pz, hop * 3.4, Math.atan2(qz - pz, qx - px), TUZU_H.villager * (0.82 + (k % 3) * 0.13), 0.95 + hop * 0.1, T.color, T.eyes !== '#2b2a33', false, v.state === 'colony' ? 3 : v.state === 'ally' ? 4 : 0);
      }
    });
    this.blobIM.count = this.limbIM.count = this.cheekIM.count = this.nb; this.ghostIM.count = this.ng; this.shineIM.count = this.nf;
    this.faces.forEach((im, k) => { im.count = this.nFace[k]; }); this.facesL.forEach((im, k) => { im.count = this.nFaceL[k]; });
    for (const im of [this.blobIM, this.limbIM, this.cheekIM, this.ghostIM, this.shineIM, ...this.faces, ...this.facesL]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }

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

  /** Una nave della flotta che parte dal porto b (o ci torna): la si vede fare un tratto sull'acqua, poi sparisce lontano (o compare da lontano e attracca). */
  sail(world, type, lvl, b, arriving) {
    if (!b || !this.sails || this.sails.length >= 4) return;
    const c0 = Math.floor(b.x / G), r0 = Math.floor(b.y / G), wet = (i) => TERRAIN[i] === 3 && !world.occ[i];
    let start = -1, bd = 1e9;
    for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) { const c = c0 + dc, r = r0 + dr; if (c < 0 || r < 0 || c >= COLS || r >= ROWS || !wet(r * COLS + c)) continue; const d = dc * dc + dr * dr; if (d < bd) { bd = d; start = r * COLS + c; } }
    if (start < 0) return;
    const dist = new Map([[start, 0]]), prev = new Map(), queue = [start]; let far = start;
    while (queue.length) {
      const i = queue.shift(), d = dist.get(i); if (d >= 30) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc; if (dist.has(ni) || !wet(ni) || (dc && dr && (!wet(r * COLS + nc) || !wet(nr * COLS + c)))) continue;
        dist.set(ni, d + 1); prev.set(ni, i); queue.push(ni);
        if (d + 1 > dist.get(far)) far = ni;
      }
    }
    let pts = []; for (let i = far; i != null; i = prev.get(i)) pts.push({ x: (i % COLS + 0.5) * G, y: (((i / COLS) | 0) + 0.5) * G });
    if (pts.length < 4) return;
    pts.reverse();
    for (let k = 0; k < 2; k++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q2 = pts[i + 1]; o.push({ x: p.x * 0.75 + q2.x * 0.25, y: p.y * 0.75 + q2.y * 0.25 }, { x: p.x * 0.25 + q2.x * 0.75, y: p.y * 0.25 + q2.y * 0.75 }); } o.push(pts[pts.length - 1]); pts = o; }
    if (arriving) pts.reverse();
    const seg = []; let total = 0; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); seg.push(L); total += L; }
    const g = bake(makeShip(type, lvl)); g.position.set(pts[0].x, 1, pts[0].y); g.rotation.y = Math.atan2(pts[1].x - pts[0].x, pts[1].y - pts[0].y); this.scene.add(g);
    this.sails.push({ g, pts, seg, total, d: 0, arriving: !!arriving });
  }

  /** Di notte la luce si fa fredda e bassa (il velo scuro con le luci lo disegna l'interfaccia sopra). */
  setNight(n) {
    if (!this.sun) return;
    this.sun.intensity = 2.5 - n * 1.4;
    this.sun.color.setRGB(1 - n * 0.4, 0.93 - n * 0.22, 0.78 + n * 0.2);
    this.hemi.intensity = 1.5 - n * 0.55;
    for (const w of this.water) w.material.emissiveIntensity = 0.35 - n * 0.2;
    this.nightK = n;
  }

  render() {
    if (!this.scene) return;
    const r = this.r;
    if (!this.postOk || !this.finish) { r.setRenderTarget(null); r.info.reset(); r.render(this.scene, this.cam); this.calls = r.info.render.calls; this.tris = r.info.render.triangles; return; }
    r.info.reset();
    r.setRenderTarget(this.rtA); r.render(this.scene, this.cam);
    this.calls = r.info.render.calls; this.tris = r.info.render.triangles;
    const q = this.fsQuad, B = this.blurMat, w = this.rtB.width, h = this.rtB.height;
    const pass = (src, dst, dx, dy) => { B.uniforms.t.value = src.texture; B.uniforms.d.value.set(dx, dy); r.setRenderTarget(dst); r.render(this.fsScene, this.fsCam); };
    q.material = B;
    pass(this.rtA, this.rtB, 1 / w, 0); pass(this.rtB, this.rtC, 0, 1 / h); pass(this.rtC, this.rtB, 2 / w, 0); pass(this.rtB, this.rtC, 0, 2 / h);
    const U = this.outMat.uniforms;
    U.t.value = this.rtA.texture; U.b.value = this.rtC.texture; U.night.value = this.nightK;
    U.dof.value = (this.calm ? 0.3 : 1) * Math.max(0.3, Math.min(0.95, 1.25 - this.dist / 2600));      // da lontano meno sfocato: la mappa si deve leggere
    U.bloom.value = 0.3 + this.nightK * 0.7;
    q.material = this.outMat;
    r.setRenderTarget(null); r.render(this.fsScene, this.fsCam);
  }
}

// Mondo in 3D visto dall'alto (three.js): una sola mappa a quadretti, camera che si sposta e si avvicina.
// Tutti gli abitanti sono Tuzu: la forma è quella del logo, cambia solo il colore del popolo.
// Stile «giocattolo morbido»: forme tonde, superfici lisce con un alone chiaro sui bordi, luce calda;
// in uscita un passaggio di rifinitura (bordi dello schermo sfocati come in una miniatura, bagliori, colori caldi).
// Le coordinate di gioco (x, y) diventano (x, altezza, z = y). L'interfaccia resta in 2D sopra e usa project()/pick().
import * as THREE from '../vendor/three.module.min.js';
import { G, COLS, ROWS, WORLD_W, WORLD_H, CASTLE, TRIBES, MY_COLOR, ENEMIES, NATURE, PEAKS, HILLS, LAKES, BUILD, lakeEdge, mulberry32 } from './data.js';
import { GRASS, paintWorld } from './ground.js';

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
  cyl(g, 29, 35, 11, STONE, 0, 5.5, 0, { seg: 10 });
  cyl(g, 25, 25, 2.4, '#c4c5d0', 0, 11.6, 0, { seg: 10, ns: true });
  for (let i = 0; i < 5; i++) { const a = i * 1.257 + 0.4, b = box(g, 9, 6, 7, i % 2 ? STONE_D : '#b8b9c4', Math.cos(a) * 33, 3, Math.sin(a) * 33, { ns: true }); b.rotation.y = -a; }
  cyl(g, 0.9, 0.9, 26, WOOD_D, -25, 20, 19, { ns: true, seg: 5 }); box(g, 11, 7, 0.8, MY_COLOR, -19.5, 29, 19, { ns: true });
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
function faceGeo() {
  const eye = (z) => { const g = new THREE.SphereGeometry(0.08, 12, 9); g.scale(0.42, 1.08, 1); g.translate(0.45, 0.455, z); return g; };
  const smile = new THREE.TorusGeometry(0.11, 0.021, 6, 12, 2.3);
  smile.rotateZ(Math.PI + (Math.PI - 2.3) / 2); smile.rotateY(Math.PI / 2); smile.translate(0.45, 0.35, 0);
  return tiltFace(mergeGeos([eye(0.153), eye(-0.153), smile]));
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
  } else if (kind === 'attrezzo') {
    cone(g, 0.4, 0.13, '#e8cf7a', 0, 0.98, 0, { ns: true, seg: 10 }); cyl(g, 0.2, 0.22, 0.12, '#d9bd62', 0, 1.02, 0, { ns: true, seg: 8 });
    cyl(arm, 0.028, 0.028, 0.62, WOOD_D, 0.1, 0.26, 0, { ns: true, seg: 5 }); box(arm, 0.22, 0.15, 0.05, IRON, 0.19, 0.55, 0, { ns: true });
  } else return null;
  g.userData = u;
  return g;
}

/** Una capanna: tonda col tetto a punta, oppure lunga col tetto a falde. Il tetto ha il colore del popolo. */
function makeHut(color, s, long) {
  const g = grp(null);
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
    const h = makeHut([col, dark, lite][spots.length % 3], 0.8 + rnd() * 0.5, spots.length % 3 === 0);
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
function makeHouse(id) {
  const g = grp(null), roofC = ROOFS[id % ROOFS.length], wall = WALLS[id % 3];
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
  g.scale.setScalar(1.2);
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
  for (const x of [-15, 15]) { box(g, 10, 40, 14, '#9a9ba4', x, 20, 0); pyramid(g, 9, 9, '#b5482f', x, 44.5, 0); }
  box(g, 22, 6, 8, '#8a5a33', 0, 33, 0, { ns: true });
  box(g, 20, 28, 4, '#8a5a33', 0, 14, 0);
  for (const x of [-6, 0, 6]) box(g, 1, 28, 4.6, '#5c3a1e', x, 14, 0, { ns: true });
  box(g, 20, 2.4, 5, '#55565e', 0, 9, 0, { ns: true }); box(g, 20, 2.4, 5, '#55565e', 0, 21, 0, { ns: true });
  if (vertical) g.rotation.y = Math.PI / 2;
  return g;
}

const ROOFS = ['#c2512f', '#b0472b', '#a8552d', '#c96a3a', '#8f4a3a'];
/** Il modello di un edificio. o: { lvl, castle, crop, id, vertical } */
function makeModel(type, o = {}) {
  let g;
  if (type === 'castello') g = makeCastle(o.castle || 1);
  else if (type === 'casa') g = makeHouse(o.id || 0);
  else if (type === 'campo') g = makePlot(o.crop);
  else if (type === 'segheria') g = makeSawmill();
  else if (type === 'cava') g = makeQuarry();
  else if (type === 'caserma') g = makeBarracks();
  else if (type === 'bottega') g = makeWorkshop();
  else if (type === 'mercato') g = makeMarket();
  else if (type === 'fontana') g = makeFountain();
  else if (type === 'taverna') g = makeTavern();
  else if (type === 'statua') g = makeStatue();
  else if (type === 'mulino') g = makeMill();
  else if (type === 'fucina') g = makeForge();
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
    const big = new THREE.Mesh(new THREE.PlaneGeometry(22000, 20000), M(GRASS, { smooth: true }));
    big.rotation.x = -Math.PI / 2; big.position.set(WORLD_W / 2, -0.6, WORLD_H / 2); big.receiveShadow = true; s.add(big);
    const cv = document.createElement('canvas'); paintWorld(cv, 0.5);
    this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), new THREE.MeshLambertMaterial({ map: this.tex }));
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
      im.setColorAt(a.si, col.set(pine ? PINE[tint - 4][1] : LEAF[tint][0]));
    };
    /** Dopo aver cambiato gli alberi. Le zone fisse si ritagliano sullo schermo (la prima volta se ne calcola l'ingombro). */
    const flush = (T) => {
      for (const z of T.zones) for (const im of [z.trunk, z.leaf, z.pine]) {
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        if (!T.one && !im.userData.fit) { im.userData.fit = true; im.computeBoundingSphere(); im.frustumCulled = true; }
      }
    };
    this._tree = tree; this._flush = flush;

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
    deco.forEach((t, i) => tree(dT, i, t.x, t.z, t.r, t.tint, t.seed, t.y)); flush(dT);

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
    this.wallTop = mk(geom('wallT', () => roundBoxGeo(22, 9, 22, 2.6)), M('#bcbdc8'), WALL_CAP);
    this.post = mk(geom('fpost', () => new THREE.CylinderGeometry(3.2, 3.8, 24, 7)), M(WOOD_D), WALL_CAP);
    this.rail = mk(geom('frail', () => new THREE.BoxGeometry(G, 3.4, 2.6)), M(WOOD_L), WALL_CAP * 4, false);
    this.wallBase.count = this.wallTop.count = this.post.count = this.rail.count = 0;
    this.rev = -1;
    this.roadIM = mk(geom('roadT', () => new THREE.BoxGeometry(G + 0.4, 1.4, G + 0.4)), M('#d2b07c'), DECO_CAP, false); this.roadIM.receiveShadow = true;
    this.bedIM = mk(geom('bedB', () => roundBoxGeo(32, 6, 32, 2.6)), M('#7a5634'), DECO_CAP, false);
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
    this.faceIM = mk(fg, new THREE.MeshBasicMaterial({ color: 0x2b2a33 }), BLOB_CAP, false);
    this.faceLightIM = mk(fg, new THREE.MeshBasicMaterial({ color: 0xffffff }), 120, false);
    this.shineIM = mk(geom('tuzuShine', shineGeo), new THREE.MeshBasicMaterial({ color: 0xffffff }), BLOB_CAP, false);
    this._bq = new THREE.Quaternion(); this._up = new THREE.Vector3(0, 1, 0);
    this.gear = new Map(); this.nb = this.ng = this.nf = this.nl = 0;
    for (const im of [this.blobIM, this.limbIM, this.cheekIM, this.ghostIM, this.faceIM, this.faceLightIM, this.shineIM]) im.count = 0;

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
    let na = 0;
    for (const v of this.vAO) this.aoIM.setMatrixAt(na++, m4.compose(P3.set(v.x, 0, v.z), q.identity(), S3.set(v.w, 1, v.d)));
    for (const b of world.d.buildings) {
      if (na >= AO_CAP || b.type === 'recinto' || b.type === 'mura' || b.type === 'campo' || b.type === 'cancello' || BUILD[b.type].deco) continue;
      const k = b.type === 'castello' ? 190 : BUILD[b.type].w === 1 ? 64 : 122;
      this.aoIM.setMatrixAt(na++, m4.compose(P3.set(b.x, 0, b.y + 4), q, S3.set(k, 1, k * 0.9)));
    }
    this.aoIM.count = na; this.aoIM.instanceMatrix.needsUpdate = true;
    // strade, aiuole, lampioni, alberi piantati
    let nR = 0, nB = 0, nF = 0, nL = 0, nT = 0;
    const col = this._col;
    for (const b of world.d.buildings) {
      if (!BUILD[b.type].deco) continue;
      if (b.type === 'strada' && nR < DECO_CAP) this.roadIM.setMatrixAt(nR++, m4.compose(P3.set(b.x, 0.5, b.y), q, S3.set(1, 1, 1)));
      else if (b.type === 'aiuola' && nB < DECO_CAP) {
        this.bedIM.setMatrixAt(nB, m4.compose(P3.set(b.x, 3, b.y), q, S3.set(1, 1, 1)));
        this.bedLeaf.setMatrixAt(nB++, m4.compose(P3.set(b.x, 6.4, b.y), q, S3.set(13, 4.6, 13)));
        for (let k = 0; k < 4; k++) { const a = b.id * 1.3 + k * 1.571; this.bedFlower.setMatrixAt(nF, m4.compose(P3.set(b.x + Math.cos(a) * 7.5, 10.5, b.y + Math.sin(a) * 7.5), q, S3.set(3.3, 3.3, 3.3))); this.bedFlower.setColorAt(nF++, col.set(FLOWERS[(b.id + k) % FLOWERS.length])); }
      } else if (b.type === 'lampione' && nL < 300) {
        this.lampPole.setMatrixAt(nL, m4.compose(P3.set(b.x, 17, b.y), q, S3.set(1, 1, 1)));
        this.lampHead.setMatrixAt(nL++, m4.compose(P3.set(b.x, 37, b.y), q, S3.set(1, 1, 1)));
      } else if (b.type === 'albero' && nT < PLANT_CAP) { this._tree(this.plantT, nT, b.x, b.y, 15 + (b.id % 5), nT % 4, b.id * 1.7); nT++; }
    }
    for (let i = nT; i < (this._plantN || 0); i++) this._tree(this.plantT, i, 0, 0, 0, i % 4, 0);
    this._plantN = nT; this._flush(this.plantT);
    this.roadIM.count = nR; this.bedIM.count = this.bedLeaf.count = nB; this.bedFlower.count = nF; this.lampPole.count = this.lampHead.count = nL;
    for (const im of [this.roadIM, this.bedIM, this.bedLeaf, this.bedFlower, this.lampPole, this.lampHead]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
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
  tuzu(x, y, lift, ang, H, squash, color, light, ghost) {
    const k = 1 / Math.sqrt(squash), m4 = this._m4;
    m4.compose(this._P3.set(x, lift, y), this._bq.setFromAxisAngle(this._up, -facing(ang)), this._S3.set(H * k, H * squash, H * k));
    if (ghost) { if (this.ng >= 80) return; this.ghostIM.setMatrixAt(this.ng, m4); this.ghostIM.setColorAt(this.ng++, c3(color)); }
    else { if (this.nb >= BLOB_CAP) return; this.blobIM.setMatrixAt(this.nb, m4); this.limbIM.setMatrixAt(this.nb, m4); this.cheekIM.setMatrixAt(this.nb, m4); this.limbIM.setColorAt(this.nb, c3(color)); this.blobIM.setColorAt(this.nb++, c3(color)); }
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
      if (b.type === 'recinto' || b.type === 'mura' || BUILD[b.type].deco) continue;
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
      const AT = sd.ally != null ? TRIBES[sd.ally] : null;
      this.tuzu(sd.x, sd.y, lift, sd.ang, H, 0.95 + hop * 0.12, AT ? AT.color : MY_COLOR, !!AT && AT.eyes !== '#2b2a33', false);
      const u = this.gearFor('s' + sd.id, sd.type, sd.x, sd.y, lift, sd.ang, H);
      if (u) u.arm.rotation.z = sd.strike > 0 ? -1.2 * Math.sin(sd.strike / 0.2 * Math.PI) : 0;
    }
    if (world.status !== 'night') for (const wk of world.workers) {
      const H = TUZU_H.villager * 1.04, work = wk.state === 'work', hop = Math.abs(Math.sin(work ? wk.anim : wk.anim * 1.2 + wk.id)), lift = hop * (work ? 2 : 3.2);
      this.tuzu(wk.x, wk.y, lift, work ? -Math.PI / 2 + 0.6 : wk.ang, H, 0.95 + hop * 0.1, MY_COLOR, false, false);
      const u = this.gearFor('w' + wk.id, 'attrezzo', wk.x, wk.y, lift, work ? -Math.PI / 2 + 0.6 : wk.ang, H);
      if (u) u.arm.rotation.z = work ? -1.25 * Math.abs(Math.sin(wk.anim)) : 0;
    }
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
      const fc2 = v.state === 'ally' ? '#ffffff' : null; void fc2;
      if (R) return;                                       // sotto assalto sono fuori i difensori
      if (Math.hypot(g.position.x - this.target.x, g.position.z - this.target.z) > this.dist * 1.5 + 500) return;      // lontano dalla camera: non si vedono
      for (let k = 0; k < 6; k++) {
        const f = (t) => { let x = Math.cos(t * (0.9 + k * 0.17) + k * 2.2 + i) * (96 + k * 16) + Math.sin(t * 2.1 + k) * 34, z = Math.sin(t * (0.7 + k * 0.13) + k * 1.3) * (84 + k * 14) + Math.cos(t * 1.7 + k * 2) * 26; const d = Math.hypot(x, z); if (d < 78) { x *= 78 / (d || 1); z *= 78 / (d || 1); } return [x, z]; };
        const t = time * 0.13 + i * 3, [px, pz] = f(t), [qx, qz] = f(t + 0.02), hop = Math.abs(Math.sin(time * 4.6 + k * 1.9 + i));
        this.tuzu(g.position.x + px, g.position.z + pz, hop * 3.4, Math.atan2(qz - pz, qx - px), TUZU_H.villager * (0.82 + (k % 3) * 0.13), 0.95 + hop * 0.1, T.color, T.eyes !== '#2b2a33', false);
      }
    });
    this.blobIM.count = this.limbIM.count = this.cheekIM.count = this.nb; this.ghostIM.count = this.ng; this.faceIM.count = this.shineIM.count = this.nf; this.faceLightIM.count = this.nl;
    for (const im of [this.blobIM, this.limbIM, this.cheekIM, this.ghostIM, this.faceIM, this.faceLightIM, this.shineIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }

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

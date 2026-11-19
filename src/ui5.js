// La terra del MONDO online: un continente dipinto, uguale per tutti i giocatori (nasce da numeri fissi, mai dal caso).
// Due strati: una pittura a bassa definizione fatta una volta sola (mare, coste, colore delle terre, macchie di bosco)
// e, da vicino, i disegni nitidi (alberi, cime, laghi, colline, dune) solo per il pezzo che si guarda.
const TAU = Math.PI * 2;
export const SPAN = 128;            // il mondo dipinto va da -SPAN a +SPAN quadretti
const PX = 4;                       // punti della pittura per quadretto
const STEP = 7;                     // i villaggi del computer stanno su una griglia larga 7: i disegni vanno nei vuoti in mezzo

/** Un numero fra 0 e 1 che dipende solo da (x, y, s). */
export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t), clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** Fin dove arriva la terra in una direzione: una costa frastagliata. */
export const coastR = (a) => 121 + 6 * Math.sin(3 * a + 1) + 3.5 * Math.sin(7 * a + 2.2) + 2 * Math.sin(13 * a + 0.7);
export const isLand = (x, y, m = 0) => Math.hypot(x, y) < coastR(Math.atan2(y, x)) - m;
/** Che terra è: il cuore verde al centro, poi neve a nord, sabbia a sud, bosco rosso a est, colline a ovest. */
export function biome(x, y) {
  if (Math.hypot(x, y) < 34) return 'heart';
  return Math.abs(y) >= Math.abs(x) ? (y < 0 ? 'north' : 'south') : (x > 0 ? 'east' : 'west');
}
const GROUND = { heart: [112, 178, 86], north: [206, 222, 222], south: [228, 202, 134], east: [176, 172, 92], west: [136, 192, 102] };

/** Il vuoto (gx, gy) della griglia: dov'è il suo centro e che cosa ci cresce. */
export function hole(gx, gy) {
  const x = gx * STEP + 3.5 + (hash(gx, gy, 1) - 0.5) * 1.6, y = gy * STEP + 3.5 + (hash(gx, gy, 2) - 0.5) * 1.6;
  if (!isLand(x, y, 5)) return { x, y, kind: isLand(x, y, -14) && !isLand(x, y, -3) ? 'sea' : null, b: null };
  const b = biome(x, y), h = hash(gx, gy, 5);
  let kind = null;
  if (b === 'heart') kind = h < 0.28 ? 'forest' : h < 0.36 ? 'lake' : h < 0.5 ? 'hills' : null;
  else if (b === 'north') kind = h < 0.34 ? 'forest' : h < 0.62 ? 'peaks' : h < 0.7 ? 'lake' : null;
  else if (b === 'south') kind = h < 0.36 ? 'dunes' : h < 0.52 ? 'peaks' : h < 0.62 ? 'oasis' : null;
  else if (b === 'east') kind = h < 0.5 ? 'forest' : h < 0.62 ? 'hills' : h < 0.7 ? 'lake' : null;
  else kind = h < 0.38 ? 'hills' : h < 0.62 ? 'forest' : h < 0.72 ? 'lake' : h < 0.82 ? 'peaks' : null;
  return { x, y, kind, b };
}

let tex = null;
/** La pittura di fondo (si fa alla prima apertura: un milione di punti, una frazione di secondo). */
export function worldTex() {
  if (tex || typeof document === 'undefined') return tex;
  const N = SPAN * 2 * PX, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d'), img = c.createImageData(N, N), D = img.data;
  for (let j = 0; j < N; j++) {
    const y = (j + 0.5) / PX - SPAN;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / PX - SPAN, d = Math.hypot(x, y), e = d - coastR(Math.atan2(y, x)) - (noise(x / 9, y / 9, 3) - 0.5) * 5;
      let r = 0, g = 0, b = 0, sr = 0, sg = 0, sb = 0;
      if (e > -0.35) {                       // mare: chiaro vicino alla costa, blu al largo
        const t = sm(clamp(e / 10)), w = 0.94 + 0.12 * noise(x / 6, y / 6, 4);
        sr = (104 + (40 - 104) * t) * w; sg = (196 + (112 - 196) * t) * w; sb = (204 + (166 - 204) * t) * w;
      }
      if (e < 0.35) {
        const k = sm(clamp((d - 26) / 36)), n = Math.max(0, -y) ** 3, s = Math.max(0, y) ** 3, ea = Math.max(0, x) ** 3, we = Math.max(0, -x) ** 3, tot = n + s + ea + we || 1;
        const H = GROUND.heart, mix = (q) => H[q] + ((GROUND.north[q] * n + GROUND.south[q] * s + GROUND.east[q] * ea + GROUND.west[q] * we) / tot - H[q]) * k;
        const w = 0.9 + 0.13 * noise(x / 5, y / 5, 6) + 0.08 * noise(x / 15, y / 15, 7);
        r = mix(0) * w; g = mix(1) * w; b = mix(2) * w;
        if (e > -2.4) { const t = Math.min(1, (e + 2.4) / 2.4); r += (238 - r) * t; g += (222 - g) * t; b += (172 - b) * t; }      // la spiaggia
      }
      if (e > -0.35) { const m = e >= 0.35 ? 1 : (e + 0.35) / 0.7; r += (sr - r) * m; g += (sg - g) * m; b += (sb - b) * m; }      // la riva sfuma: niente scalini
      const p = (j * N + i) * 4; D[p] = r; D[p + 1] = g; D[p + 2] = b; D[p + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  // le macchie sotto boschi, montagne e laghi: da lontano si vedono solo queste
  const P = (v) => (v + SPAN) * PX, G = Math.ceil(SPAN / STEP);
  const blob = (x, y, rad, col, a) => { const g = c.createRadialGradient(P(x), P(y), 0, P(x), P(y), rad * PX); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(0.6, 'rgba(' + col + ',' + a * 0.7 + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.beginPath(); c.arc(P(x), P(y), rad * PX, 0, TAU); c.fill(); };
  for (let gy = -G; gy <= G; gy++) for (let gx = -G; gx <= G; gx++) {
    const h = hole(gx, gy);
    if (h.kind === 'forest') blob(h.x, h.y, 3.1, h.b === 'north' ? '58,104,92' : h.b === 'east' ? '178,84,44' : '46,120,60', 0.62);
    else if (h.kind === 'peaks') blob(h.x, h.y, 3, h.b === 'south' ? '168,120,70' : '124,126,134', 0.6);
    else if (h.kind === 'lake' || h.kind === 'oasis') blob(h.x, h.y, 2, h.b === 'north' ? '206,234,244' : '72,170,216', 0.9);
    else if (h.kind === 'hills') blob(h.x, h.y, 3, '168,214,112', 0.42);
    else if (h.kind === 'dunes') blob(h.x, h.y, 3, '244,224,160', 0.5);
  }
  tex = cv;
  return tex;
}
/** Disegna il pezzo di pittura che si vede. X, Y: da quadretti a punti dello schermo; z: punti per quadretto. */
export function paint(c, X, Y, z, x0, y0, x1, y1) {
  const t = worldTex(); if (!t) return;
  const a0 = Math.max(-SPAN, x0), b0 = Math.max(-SPAN, y0), a1 = Math.min(SPAN, x1), b1 = Math.min(SPAN, y1);
  if (a1 <= a0 || b1 <= b0) return;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(t, (a0 + SPAN) * PX, (b0 + SPAN) * PX, (a1 - a0) * PX, (b1 - b0) * PX, X(a0), Y(b0), (a1 - a0) * z, (b1 - b0) * z);
}

const TREE = { heart: ['#2f8a48', '#58b85e'], west: ['#3a9450', '#6cc46a'], east: ['#b9482a', '#e88a34'], north: ['#2f6b62', '#eef4f6'], south: ['#3f9a50', '#74c868'] };
/** I disegni nitidi dei vuoti che si vedono: alberi, cime, laghi, colline, dune, e le onde in mare. */
export function decor(c, X, Y, z, x0, y0, x1, y1) {
  const u = z, g0x = Math.floor((x0 - 8) / STEP), g1x = Math.ceil((x1 + 8) / STEP), g0y = Math.floor((y0 - 8) / STEP), g1y = Math.ceil((y1 + 8) / STEP);
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
    const h = hole(gx, gy); if (!h.kind) continue;
    const px = X(h.x), py = Y(h.y), R = (i, s) => hash(gx * 31 + i, gy * 17 + i, s);
    if (h.kind === 'sea') {
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = Math.max(1, u * 0.09);
      for (let i = 0; i < 2; i++) { const wx = px + (R(i, 20) - 0.5) * u * 4, wy = py + (R(i, 21) - 0.5) * u * 4; c.beginPath(); c.arc(wx, wy, u * 0.34, Math.PI * 1.15, Math.PI * 1.85); c.arc(wx + u * 0.62, wy, u * 0.34, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    } else if (h.kind === 'forest') {
      const n = 5 + Math.floor(R(0, 9) * 4), col = TREE[h.b] || TREE.heart, pts = [];
      for (let i = 0; i < n; i++) pts.push([(R(i, 10) - 0.5) * 4.2, (R(i, 11) - 0.5) * 3.4]);
      pts.sort((a, b) => a[1] - b[1]);
      for (const [ox, oy] of pts) {
        const tx = px + ox * u, ty = py + oy * u, s = u * (0.44 + R(Math.round(ox * 9), 12) * 0.16);
        c.beginPath(); c.ellipse(tx + s * 0.15, ty + s * 0.75, s * 0.8, s * 0.3, 0, 0, TAU); c.fillStyle = 'rgba(20,40,20,0.22)'; c.fill();
        if (h.b === 'north') {         // abeti con la neve in punta
          c.beginPath(); c.moveTo(tx, ty - s * 1.5); c.lineTo(tx + s * 0.8, ty + s * 0.7); c.lineTo(tx - s * 0.8, ty + s * 0.7); c.closePath(); c.fillStyle = col[0]; c.fill();
          c.beginPath(); c.moveTo(tx, ty - s * 1.5); c.lineTo(tx + s * 0.36, ty - s * 0.52); c.lineTo(tx - s * 0.36, ty - s * 0.52); c.closePath(); c.fillStyle = col[1]; c.fill();
        } else {
          c.beginPath(); c.arc(tx, ty, s, 0, TAU); c.fillStyle = col[0]; c.fill();
          c.beginPath(); c.arc(tx - s * 0.24, ty - s * 0.28, s * 0.6, 0, TAU); c.fillStyle = col[1]; c.fill();
        }
      }
    } else if (h.kind === 'peaks') {
      const n = 2 + Math.floor(R(0, 13) * 2), sand = h.b === 'south';
      for (let i = 0; i < n; i++) {
        const tx = px + (i - (n - 1) / 2) * u * 1.5 + (R(i, 14) - 0.5) * u * 0.6, ty = py + (R(i, 15) - 0.5) * u * 1.2 + (i % 2) * u * 0.5, w = u * (1.25 + R(i, 16) * 0.5), hh = w * 1.25;
        c.beginPath(); c.ellipse(tx, ty + hh * 0.5, w * 1.05, w * 0.3, 0, 0, TAU); c.fillStyle = 'rgba(30,30,40,0.2)'; c.fill();
        c.beginPath(); c.moveTo(tx - w, ty + hh * 0.5); c.lineTo(tx, ty - hh * 0.5); c.lineTo(tx + w, ty + hh * 0.5); c.closePath(); c.fillStyle = sand ? '#d4a264' : '#a9abb4'; c.fill();
        c.beginPath(); c.moveTo(tx, ty - hh * 0.5); c.lineTo(tx + w, ty + hh * 0.5); c.lineTo(tx + w * 0.18, ty + hh * 0.5); c.closePath(); c.fillStyle = sand ? '#a87440' : '#7c7e8a'; c.fill();
        if (!sand) { c.beginPath(); c.moveTo(tx, ty - hh * 0.5); c.lineTo(tx + w * 0.34, ty - hh * 0.16); c.lineTo(tx + w * 0.1, ty - hh * 0.22); c.lineTo(tx - w * 0.08, ty - hh * 0.1); c.lineTo(tx - w * 0.34, ty - hh * 0.16); c.closePath(); c.fillStyle = '#f6f8fc'; c.fill(); }
      }
    } else if (h.kind === 'lake' || h.kind === 'oasis') {
      const ice = h.b === 'north';
      c.beginPath(); c.ellipse(px, py, u * 1.7, u * 1.1, (R(0, 17) - 0.5) * 0.6, 0, TAU); c.fillStyle = ice ? '#d8eef6' : '#4fb0e0'; c.fill(); c.strokeStyle = ice ? '#ffffff' : 'rgba(232,246,255,0.75)'; c.lineWidth = Math.max(1, u * 0.12); c.stroke();
      c.beginPath(); c.ellipse(px - u * 0.4, py - u * 0.25, u * 0.7, u * 0.3, -0.2, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill();
      if (h.kind === 'oasis') for (let i = 0; i < 3; i++) {        // le palme attorno all'acqua
        const tx = px + (i - 1) * u * 1.5, ty = py - u * 0.9 + (i % 2) * u * 1.9;
        c.strokeStyle = '#8a5a2c'; c.lineWidth = Math.max(1.2, u * 0.14); c.beginPath(); c.moveTo(tx, ty + u * 0.7); c.quadraticCurveTo(tx + u * 0.15, ty, tx, ty - u * 0.3); c.stroke();
        c.strokeStyle = '#3f9a50'; c.lineWidth = Math.max(1.4, u * 0.2); for (let q = 0; q < 5; q++) { const a = -Math.PI / 2 + (q - 2) * 0.62; c.beginPath(); c.moveTo(tx, ty - u * 0.3); c.quadraticCurveTo(tx + Math.cos(a) * u * 0.5, ty - u * 0.3 + Math.sin(a) * u * 0.5, tx + Math.cos(a) * u * 0.75, ty - u * 0.12 + Math.sin(a) * u * 0.4); c.stroke(); }
      }
    } else if (h.kind === 'hills') {
      for (let i = 0; i < 3; i++) {
        const tx = px + (i - 1) * u * 1.5, ty = py + (i % 2 ? -u * 0.5 : u * 0.4), w = u * (1.3 + R(i, 18) * 0.5);
        c.beginPath(); c.moveTo(tx - w, ty + w * 0.3); c.quadraticCurveTo(tx, ty - w * 0.95, tx + w, ty + w * 0.3); c.closePath(); c.fillStyle = h.b === 'east' ? '#b8b860' : '#8fce6a'; c.fill();
        c.beginPath(); c.moveTo(tx - w * 0.55, ty - w * 0.08); c.quadraticCurveTo(tx - w * 0.1, ty - w * 0.62, tx + w * 0.35, ty - w * 0.2); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = Math.max(1, u * 0.12); c.stroke();
      }
    } else if (h.kind === 'dunes') {
      for (let i = 0; i < 3; i++) {
        const tx = px + (i - 1) * u * 1.7, ty = py + (i % 2 ? -u * 0.6 : u * 0.5), w = u * (1.4 + R(i, 19) * 0.5);
        c.beginPath(); c.moveTo(tx - w, ty + w * 0.22); c.quadraticCurveTo(tx - w * 0.2, ty - w * 0.6, tx + w, ty + w * 0.22); c.quadraticCurveTo(tx, ty + w * 0.02, tx - w, ty + w * 0.22); c.fillStyle = '#f2dc9c'; c.fill();
        c.beginPath(); c.moveTo(tx - w * 0.2, ty - w * 0.34); c.quadraticCurveTo(tx + w * 0.5, ty - w * 0.2, tx + w, ty + w * 0.22); c.strokeStyle = 'rgba(170,124,60,0.55)'; c.lineWidth = Math.max(1, u * 0.1); c.stroke();
      }
    }
  }
}

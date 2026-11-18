// Icone 2D di torri e nemici, usate nei menu e nei pannelli.
const TAU = Math.PI * 2;
function ell(c, x, y, rx, ry, fill, stroke, lw) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.5; c.stroke(); }
}
function circ(c, x, y, r, fill, stroke, lw) { ell(c, x, y, r, r, fill, stroke, lw); }
function poly(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.5; c.lineJoin = 'round'; c.stroke(); }
}

// ---------- torri ----------
function towerBase(c, x, y) {
  ell(c, x + 5, y + 14, 36, 14, 'rgba(0,0,0,0.26)');
  ell(c, x, y + 8, 30, 20, '#5f606a');
  c.fillStyle = '#74757f'; c.fillRect(x - 30, y, 60, 8);
  ell(c, x, y, 30, 20, '#9c9da8', '#55565e', 1.5);
  ell(c, x, y - 1, 23, 14.5, '#b2b3be');
}

function pips(c, x, y, level) {
  for (let i = 0; i <= level; i++) circ(c, x - level * 5 + i * 10, y + 19, 3.6, '#ffd24a', '#7a5a10', 1);
}

/** Disegna una torre. t: {type, level, x, y, angle, fireAnim} */
export function drawTower(c, t, time) {
  const { x, y } = t, L = t.level;
  towerBase(c, x, y);
  if (t.type === 'arcieri') {
    poly(c, [x - 17, y + 2, x - 13, y - 30, x + 13, y - 30, x + 17, y + 2], '#9b6b3d', '#5c3a1e', 2);
    poly(c, [x - 17, y + 2, x - 13, y - 30, x - 6, y - 30, x - 8, y + 2], 'rgba(255,255,255,0.14)');
    c.strokeStyle = '#5c3a1e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 15, y - 13); c.lineTo(x + 15, y - 13); c.stroke();
    ell(c, x, y - 30, 19, 9, '#c08e58', '#5c3a1e', 2);
    for (let i = -1; i <= 1; i++) { c.fillStyle = '#9b6b3d'; c.strokeStyle = '#5c3a1e'; c.beginPath(); c.rect(x + i * 13 - 4, y - 41 + Math.abs(i) * 3, 8, 8); c.fill(); c.stroke(); }
    c.save(); c.translate(x, y - 36); c.rotate(t.angle);
    const pull = t.fireAnim > 0 ? 0 : 5;
    c.strokeStyle = '#3d2a17'; c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.arc(-6, 0, 15, -1.15, 1.15); c.stroke();
    const ex = -6 + Math.cos(1.15) * 15, ey = Math.sin(1.15) * 15;
    c.strokeStyle = '#efe6cf'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex, -ey); c.lineTo(ex - pull, 0); c.lineTo(ex, ey); c.stroke();
    if (pull) { c.strokeStyle = '#d8c9a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - pull, 0); c.lineTo(16, 0); c.stroke(); poly(c, [16, -3, 22, 0, 16, 3], '#b9bcc6'); }
    c.restore();
  } else if (t.type === 'mago') {
    poly(c, [x - 15, y + 2, x - 10, y - 16, x + 10, y - 16, x + 15, y + 2], '#7d7e8c', '#484954', 2);
    ell(c, x, y - 16, 10, 5, '#a3a4b3', '#484954', 1.5);
    const s = 1 + L * 0.16, cy = y - 40 - L * 3 + Math.sin(time * 2.4 + x) * 3;
    const glow = 0.3 + (t.fireAnim > 0 ? 0.5 : 0) + Math.sin(time * 3 + x) * 0.06;
    const gr = c.createRadialGradient(x, cy, 2, x, cy, 34 * s);
    gr.addColorStop(0, `rgba(196,150,255,${glow})`); gr.addColorStop(1, 'rgba(196,150,255,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, cy, 34 * s, 0, TAU); c.fill();
    poly(c, [x, cy - 17 * s, x + 10 * s, cy, x, cy + 17 * s, x - 10 * s, cy], '#8a4fe0', '#f0e2ff', 1.6);
    poly(c, [x, cy - 17 * s, x + 10 * s, cy, x, cy + 2 * s], '#b98cff');
    poly(c, [x, cy - 17 * s, x - 10 * s, cy, x - 2 * s, cy - 2 * s], '#d9c2ff');
    for (let i = 0; i < L; i++) { const a = time * 2 + i * Math.PI; circ(c, x + Math.cos(a) * 17, cy + Math.sin(a) * 7, 2.6, '#f3e6ff'); }
  } else if (t.type === 'catapulta') {
    c.save(); c.translate(x, y - 10); c.rotate(t.angle);
    c.fillStyle = '#8a5a33'; c.strokeStyle = '#4c2f17'; c.lineWidth = 2;
    c.beginPath(); c.roundRect(-20, -15, 40, 30, 4); c.fill(); c.stroke();
    c.fillStyle = '#6f4526'; c.fillRect(-20, -15, 40, 6); c.fillRect(-20, 9, 40, 6);
    circ(c, -14, -17, 5, '#4c2f17'); circ(c, 14, -17, 5, '#4c2f17'); circ(c, -14, 17, 5, '#4c2f17'); circ(c, 14, 17, 5, '#4c2f17');
    const f = Math.max(0, t.fireAnim) / 0.45;
    const len = -20 + 38 * Math.sin(f * Math.PI);   // il braccio scatta in avanti e torna
    c.strokeStyle = '#c08e58'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(10, 0); c.lineTo(len, 0); c.stroke();
    circ(c, len, 0, 8, '#6f4526', '#4c2f17', 2);
    if (f <= 0) circ(c, len, 0, 5.5 + L, '#8d8f96', '#55565e', 1.2);
    c.restore();
  } else if (t.type === 'braciere') {
    poly(c, [x - 16, y + 2, x - 11, y - 18, x + 11, y - 18, x + 16, y + 2], '#7d7e8c', '#484954', 2);
    ell(c, x, y - 18, 17, 7, '#55565e', '#33343c', 1.5);
    ell(c, x, y - 19, 13, 5, '#ff7a1a');
    const fl = 1 + Math.sin(time * 9 + x) * 0.1 + L * 0.16;
    poly(c, [x - 10, y - 20, x - 4, y - 20 - 14 * fl, x, y - 26, x + 5, y - 20 - 24 * fl, x + 10, y - 20], '#ff9d2a');
    poly(c, [x - 5, y - 20, x, y - 20 - 14 * fl, x + 5, y - 20], '#ffe27a');
  } else {
    ell(c, x, y - 4, 20, 11, '#5a4a2f', '#3a2f1c', 1.5);
    const pulse = Math.max(0, t.fireAnim) / 0.5;
    c.lineCap = 'round';
    const n = 6 + L;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.sin(time * 1.6 + i * 1.7) * 0.18;
      const len = 22 + L * 4 + pulse * 6;
      const tx = x + Math.cos(a) * len, ty = y - 8 + Math.sin(a) * len * 0.55 - 6;
      c.strokeStyle = '#2f7d4f'; c.lineWidth = 4.2;
      c.beginPath(); c.moveTo(x, y - 6); c.quadraticCurveTo(x + Math.cos(a) * len * 0.45, y - 26 - L * 2, tx, ty); c.stroke();
      circ(c, tx, ty, 3.6, '#6fd68f');
    }
    const gr = c.createRadialGradient(x, y - 14, 1, x, y - 14, 20 + pulse * 14);
    gr.addColorStop(0, `rgba(130,255,170,${0.55 + pulse * 0.4})`); gr.addColorStop(1, 'rgba(130,255,170,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y - 14, 20 + pulse * 14, 0, TAU); c.fill();
    circ(c, x, y - 14, 6.5, '#8ff0b0', '#2f7d4f', 1.5);
  }
  pips(c, x, y, L);
}

// ---------- nemici ----------
const SKIN = {
  orco: { body: '#4a5a3a', skin: '#86b552', dark: '#2f3a26' },
  predone: { body: '#7a3f26', skin: '#c79a6b', dark: '#4a2415' },
  bruto: { body: '#5a4a4a', skin: '#9c7f7a', dark: '#352b2b' },
  capo: { body: '#3d4a2c', skin: '#6f9c42', dark: '#232b18' },
  campione: { body: '#2b2140', skin: '#5a4a78', dark: '#150f22' },
};

/** Disegna un nemico. e: {type, x, y, ang, anim, r, hp, maxHp, hit, slowF, boss} */
export function drawEnemy(c, e, time) {
  const s = e.r / 15, dir = Math.cos(e.ang) >= -0.01 ? 1 : -1;
  const step = Math.sin(e.anim * TAU);
  if (e.type === 'campione') {
    const gr = c.createRadialGradient(e.x, e.y - 20, 4, e.x, e.y - 20, 70);
    gr.addColorStop(0, 'rgba(170,70,255,0.35)'); gr.addColorStop(1, 'rgba(170,70,255,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(e.x, e.y - 20, 70, 0, TAU); c.fill();
  }
  ell(c, e.x + 2, e.y + 2, e.r * 0.95, e.r * 0.42, 'rgba(0,0,0,0.28)');
  if (e.slowF < 1) { c.strokeStyle = 'rgba(110,230,150,0.9)'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(e.x, e.y + 1, e.r * 1.05, e.r * 0.5, 0, 0, TAU); c.stroke(); }

  c.save();
  c.translate(e.x, e.y);
  c.scale(dir * s, s);
  if (e.type === 'spettro') {
    const fl = Math.sin(time * 3 + e.anim) * 2.5 - 6;
    c.globalAlpha = 0.86;
    c.beginPath(); c.arc(0, -18 + fl, 11.5, Math.PI, 0);
    c.lineTo(11.5, -2 + fl);
    for (let i = 0; i < 4; i++) { const wx = 11.5 - (i + 0.5) * 5.75; c.quadraticCurveTo(wx + 1.4, 4 + fl + Math.sin(time * 6 + i) * 1.5, wx - 2.9, -2 + fl); }
    c.closePath();
    const gg = c.createLinearGradient(0, -30, 0, 4); gg.addColorStop(0, '#e9fbff'); gg.addColorStop(1, '#8fd0ee');
    c.fillStyle = gg; c.fill(); c.strokeStyle = '#4a8fb0'; c.lineWidth = 1.4; c.stroke();
    ell(c, 2, -19 + fl, 2.2, 3.2, '#1b3142'); ell(c, 8, -19 + fl, 2, 3, '#1b3142');
    c.globalAlpha = 1;
  } else {
    const k = SKIN[e.type] || SKIN.orco, bob = Math.abs(step) * 1.6;
    ell(c, -5, -1 + Math.max(0, step) * -3, 4.4, 3.2, k.dark);
    ell(c, 5, -1 + Math.max(0, -step) * -3, 4.4, 3.2, k.dark);
    if (e.type === 'capo' || e.type === 'campione') poly(c, [-9, -19 - bob, -15, 1, -5, -3], e.type === 'capo' ? '#a8322a' : '#5b1f8a');
    ell(c, 0, -11 - bob, 10.5, 10, k.body, k.dark, 1.5);
    c.fillStyle = k.dark; c.fillRect(-10, -9 - bob, 20, 3.5);
    if (e.type === 'bruto' || e.type === 'campione') { ell(c, -8, -17 - bob, 5, 4, '#6b6c76', k.dark, 1.2); ell(c, 8, -17 - bob, 5, 4, '#6b6c76', k.dark, 1.2); }
    // arma
    c.strokeStyle = '#6b4226'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(9, -9 - bob); c.lineTo(16, -21 - bob + step * 1.5); c.stroke();
    if (e.type === 'predone') poly(c, [14, -22 - bob, 19, -30 - bob, 18, -20 - bob], '#cfd3dc');
    else circ(c, 16.5, -22.5 - bob + step * 1.5, 4, e.type === 'campione' ? '#8a4fe0' : '#7b5230', k.dark, 1.2);
    // testa
    circ(c, 2, -25 - bob, 8.6, k.skin, k.dark, 1.5);
    if (e.type === 'predone') poly(c, [-7, -24 - bob, 2, -38 - bob, 10, -27 - bob, 2, -30 - bob], '#8f2a22', '#4a1510', 1.2);
    if (e.type === 'bruto' || e.type === 'campione' || e.type === 'capo') {
      poly(c, [-4, -31 - bob, -9, -40 - bob, -1, -33 - bob], '#efe9d8', '#8d866f', 1);
      poly(c, [7, -32 - bob, 12, -41 - bob, 9, -31 - bob], '#efe9d8', '#8d866f', 1);
    }
    circ(c, 5.5, -26 - bob, 1.8, e.type === 'campione' ? '#ff4a4a' : '#ffe066');
    if (e.type !== 'predone') poly(c, [5, -20.5 - bob, 7.5, -24 - bob, 8.5, -20 - bob], '#fff');
  }
  if (e.hit > 0) { c.globalAlpha = Math.min(1, e.hit / 0.12) * 0.75; ell(c, 1, -16, 12, 17, '#fff'); c.globalAlpha = 1; }
  c.restore();

  if (e.hp < e.maxHp || e.boss) {
    const w = Math.max(26, e.r * 2 + 8), bx = e.x - w / 2, by = e.y - e.r * 2.75 - 10, f = Math.max(0, e.hp / e.maxHp);
    c.fillStyle = 'rgba(15,10,8,0.8)'; c.beginPath(); c.roundRect(bx - 1.5, by - 1.5, w + 3, e.boss ? 9 : 7, 3); c.fill();
    c.fillStyle = f > 0.55 ? '#6fd45a' : f > 0.25 ? '#f1c232' : '#e0452f';
    c.beginPath(); c.roundRect(bx, by, w * f, e.boss ? 6 : 4, 2); c.fill();
  }
}


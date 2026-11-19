import { drawText } from './text.js';
// Effetti leggeri disegnati in 2D sopra il mondo 3D: anelli a terra, scintille, numeri che salgono.
// P = proiezione: pt(x,y,h) -> schermo, sc(x,y) -> pixel per unità, circle(x,y,r,n) -> punti a terra.
export function stepFx(list, dt) {
  for (const f of list) {
    f.t += dt;
    if (f.k === 'part' || f.k === 'chip') { f.x += f.vx * dt; f.y += f.vy * dt; f.h = Math.max(0, f.h + f.vh * dt); f.vh -= (f.g || 0) * dt; if (f.k === 'chip' && f.h <= 0) { f.vx *= 0.8; f.vy *= 0.8; } }
    else if (f.k === 'smoke') { f.x += f.vx * dt; f.h += f.vh * dt; }
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].T) list.splice(i, 1);
}

export function tracePoly(c, pts) {
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.closePath();
}

export function drawFx(c, list, P) {
  for (const f of list) {
    const u = f.t / f.T;
    if (f.k === 'ring') {
      c.globalAlpha = (1 - u) * (f.a || 0.9);
      c.strokeStyle = f.color; c.lineWidth = (f.lw || 3) * P.sc(f.x, f.y);
      tracePoly(c, P.circle(f.x, f.y, f.r0 + (f.r1 - f.r0) * u, 26)); c.stroke();
    } else if (f.k === 'part') {
      const p = P.pt(f.x, f.y, f.h);
      c.globalAlpha = 1 - u; c.fillStyle = f.color;
      c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, f.size * (1 - u * 0.5) * P.sc(f.x, f.y)), 0, 6.283); c.fill();
    } else if (f.k === 'smoke') {         // una nuvoletta che sale, si allarga e svanisce
      const p = P.pt(f.x, f.y, f.h);
      c.globalAlpha = (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8) * (f.a || 0.5); c.fillStyle = f.color;
      c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, f.size * (0.6 + u * 1.3) * P.sc(f.x, f.y)), 0, 6.283); c.fill();
    } else if (f.k === 'chip') {          // un pezzo di maceria: un quadratino che vola, cade e resta un attimo a terra
      const p = P.pt(f.x, f.y, f.h), z = Math.max(1, f.size * P.sc(f.x, f.y));
      c.globalAlpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25; c.fillStyle = f.color;
      c.save(); c.translate(p.x, p.y); c.rotate(f.rot + (f.h > 0 ? f.t * f.spin : 0)); c.fillRect(-z, -z * 0.7, z * 2, z * 1.4); c.restore();
    } else if (f.k === 'arc') {           // il fendente di una lama: un arco chiaro che si apre e sparisce
      const p = P.pt(f.x, f.y, f.h || 18), r = (f.r || 16) * P.sc(f.x, f.y) * (0.7 + u * 0.6);
      c.globalAlpha = 1 - u; c.strokeStyle = f.color; c.lineWidth = Math.max(1.5, 4 * P.sc(f.x, f.y) * (1 - u)); c.lineCap = 'round';
      c.beginPath(); c.arc(p.x, p.y, r, f.ang - 1.1 + u * 0.5, f.ang + 1.1 + u * 0.5); c.stroke();
    } else if (f.k === 'bolt') {
      const a = P.pt(f.x, f.y, 0), b = P.pt(f.x, f.y, 520);
      c.globalAlpha = 1 - u; c.strokeStyle = '#fff6c9'; c.lineWidth = 5; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(b.x, b.y);
      for (let i = 1; i < 7; i++) c.lineTo(b.x + (a.x - b.x) * i / 7 + ((i * 37 + f.seed) % 23 - 11) * 2.2, b.y + (a.y - b.y) * i / 7);
      c.lineTo(a.x, a.y); c.stroke();
      c.strokeStyle = '#ffd24a'; c.lineWidth = 2; c.stroke();
    } else if (f.k === 'text') {
      const p = P.pt(f.x, f.y, (f.h || 30) + u * 46);
      c.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      c.font = `800 ${f.size || 18}px "Trebuchet MS","Segoe UI",Roboto,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = f.color; drawText(c, f.str, p.x, p.y, { stroke: 'rgba(20,14,8,0.85)', lw: 4 });
    }
    c.globalAlpha = 1;
  }
}

const rnd = Math.random;
export function parts(list, x, y, h, n, color, speed, T, size, g = 0) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, v = speed * (0.4 + rnd() * 0.6);
    list.push({ k: 'part', x, y, h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vh: speed * (0.3 + rnd() * 0.9), g, t: 0, T: T * (0.7 + rnd() * 0.5), color, size: size * (0.7 + rnd() * 0.6) });
  }
}
export function smoke(list, x, y, h, color = '#55504c', size = 9, T = 1.6, a = 0.5) { list.push({ k: 'smoke', x: x + (rnd() - 0.5) * 16, y: y + (rnd() - 0.5) * 8, h, vx: 6 + rnd() * 10, vh: 26 + rnd() * 18, t: 0, T: T * (0.8 + rnd() * 0.4), color, size: size * (0.7 + rnd() * 0.6), a }); }
export function chips(list, x, y, h, n, colors, speed = 130, T = 1.5) { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = speed * (0.3 + rnd() * 0.7); list.push({ k: 'chip', x, y, h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vh: speed * (0.6 + rnd()), g: 420, t: 0, T: T * (0.7 + rnd() * 0.6), color: colors[i % colors.length], size: 2.4 + rnd() * 3, rot: rnd() * 3, spin: 6 + rnd() * 8 }); } }
export const arc = (list, x, y, ang, color = '#ffffff', r = 16, T = 0.2) => list.push({ k: 'arc', x, y, ang, color, r, t: 0, T });
export const ring = (list, x, y, r0, r1, T, color, lw) => list.push({ k: 'ring', x, y, r0, r1, t: 0, T, color, lw });
export const text = (list, x, y, h, str, color, size, T = 0.9) => list.push({ k: 'text', x, y, h, str, color, size, t: 0, T });

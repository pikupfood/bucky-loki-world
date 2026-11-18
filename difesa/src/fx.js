// Effetti leggeri disegnati in 2D sopra il mondo 3D: anelli a terra, scintille, numeri che salgono.
// P = proiezione: pt(x,y,h) -> schermo, sc(x,y) -> pixel per unità, circle(x,y,r,n) -> punti a terra.
export function stepFx(list, dt) {
  for (const f of list) {
    f.t += dt;
    if (f.k === 'part') { f.x += f.vx * dt; f.y += f.vy * dt; f.h = Math.max(0, f.h + f.vh * dt); f.vh -= (f.g || 0) * dt; }
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
      c.lineWidth = 4; c.strokeStyle = 'rgba(20,14,8,0.85)'; c.lineJoin = 'round'; c.strokeText(f.str, p.x, p.y);
      c.fillStyle = f.color; c.fillText(f.str, p.x, p.y);
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
export const ring = (list, x, y, r0, r1, T, color, lw) => list.push({ k: 'ring', x, y, r0, r1, t: 0, T, color, lw });
export const text = (list, x, y, h, str, color, size, T = 0.9) => list.push({ k: 'text', x, y, h, str, color, size, t: 0, T });

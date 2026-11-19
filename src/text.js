// Le scritte del gioco passano tutte da qui.
//
// Perché: sul telefono del titolare (Samsung pieghevole, 19/11/2026) dopo qualche minuto di gioco le scritte sparivano. Restavano solo
// quelle fatte di caratteri già disegnati prima («×1» sì, «×13» no; i numeri delle risorse sì, «Costruisci» no): è la scheda grafica del
// telefono che non riesce più ad aggiungere caratteri nuovi alla sua tavola dei caratteri. La tela dell'interfaccia è disegnata dalla
// scheda grafica, quindi ogni `fillText` passava da lì.
//
// Come: ogni scritta si disegna UNA volta su una tela piccola fatta dal processore (`willReadFrequently`: niente scheda grafica), e sulla
// tela vera si incolla come immagine. Le tele si tengono da parte (chiave: carattere, colore, scala, testo) e le meno usate si buttano.
// Regola: nel gioco NON si chiama mai `fillText` / `strokeText` direttamente; si passa da `drawText`.

const cache = new Map();
let pixels = 0, mctx = null;
// Quante tele tenere da parte: abbastanza per tutte le scritte di uno schermo pieno più i numeri che cambiano, non di più.
// Cresce con la scala dello schermo (su un telefono le scritte sono piccole: ~23 MB; su uno schermo grande fino a 56 MB) e mai più di 1500 scritte.
const budget = (sc) => Math.min(14e6, 2e6 + 3e6 * Math.max(1, sc * sc)), MAX_N = 1500;

function soft(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
const ctxOf = (cv) => cv.getContext('2d', { willReadFrequently: true });

function make(font, fill, s, sc, o) {
  if (!mctx) mctx = ctxOf(soft(4, 4));
  mctx.font = font;
  const tw = mctx.measureText(s).width, px = parseFloat((font.match(/(\d+(?:\.\d+)?)px/) || [0, 16])[1]) || 16;
  const lw = o && o.stroke ? (o.lw || 4) : 0, pad = Math.ceil(px * 0.3 + lw), h = Math.ceil(px * 1.7 + lw * 2);
  const W = Math.max(1, Math.ceil((tw + pad * 2) * sc)), H = Math.max(1, Math.ceil(h * sc));
  const cv = soft(W, H), g = ctxOf(cv);
  g.setTransform(sc, 0, 0, sc, 0, 0); g.font = font; g.textAlign = 'left'; g.textBaseline = 'middle';
  if (lw) { g.lineWidth = lw; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, pad, h / 2); }
  if (o && o.grad) { const gr = g.createLinearGradient(0, h / 2 - px * 0.5, 0, h / 2 + px * 0.5); gr.addColorStop(0, o.grad[0]); gr.addColorStop(0.55, o.grad[1]); gr.addColorStop(1, o.grad[2]); g.fillStyle = gr; } else g.fillStyle = fill;
  g.fillText(s, pad, h / 2);
  return { cv, tw, pad, h, px: W * H };
}

/** Come prima: direttamente sulla tela. Solo dove la tela è ruotata o storta (non capita nell'interfaccia). */
function direct(c, s, x, y, o) {
  if (o && o.stroke) { c.lineWidth = o.lw || 4; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillText(s, x, y);
}

/**
 * Disegna la scritta `s` in (x, y) col carattere, il colore e l'allineamento già messi sulla tela `c` (linea di base: a metà altezza).
 * `o.stroke` + `o.lw`: un contorno sotto la scritta. `o.grad`: tre colori dall'alto in basso invece del colore pieno.
 */
export function drawText(c, s, x, y, o) {
  s = String(s == null ? '' : s); if (!s) return;
  const m = c.getTransform(), fill = o && o.grad ? 'g:' + o.grad.join(',') : c.fillStyle;
  if (m.b || m.c || Math.abs(m.a - m.d) > 1e-6 || !(m.a > 0) || typeof fill !== 'string' || c.textBaseline !== 'middle') { direct(c, s, x, y, o); return; }
  const sc = Math.round(m.a * 1000) / 1000, font = c.font, key = font + '|' + fill + '|' + (o && o.stroke ? o.stroke + (o.lw || 4) : '') + '|' + sc + '|' + s;
  let e = cache.get(key);
  if (e) { cache.delete(key); cache.set(key, e); }      // usata adesso: in fondo alla fila, l'ultima a essere buttata
  else {
    e = make(font, fill, s, sc, o); cache.set(key, e); pixels += e.px;
    while ((pixels > budget(sc) || cache.size > MAX_N) && cache.size > 80) { const k0 = cache.keys().next().value, e0 = cache.get(k0); cache.delete(k0); pixels -= e0.px; e0.cv.width = 0; }
  }
  const al = c.textAlign, ox = al === 'center' ? e.tw / 2 : al === 'right' || al === 'end' ? e.tw : 0;
  const dx = Math.round((x - ox - e.pad) * m.a + m.e), dy = Math.round((y - e.h / 2) * m.d + m.f);      // sui punti veri dello schermo: la scritta resta nitida
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(e.cv, dx, dy); c.setTransform(m);
}

/** Per le prove: quante scritte sono tenute da parte e quanti punti occupano. */
export function textStats() { return { n: cache.size, pixels }; }

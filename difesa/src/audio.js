// Suoni generati da codice (nessun file audio). Si sbloccano al primo tocco.
let ac = null, master = null, enabled = true;
const last = {};

export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.5 : 0; }

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ac.destination);
  } catch (e) { ac = null; }
}

function tone(type, f0, f1, dur, vol, delay = 0) {
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur, vol, freq, delay = 0) {
  const t0 = ac.currentTime + delay;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

const SOUNDS = {
  arcieri: () => { noise(0.07, 0.25, 3200); tone('triangle', 900, 500, 0.06, 0.06); },
  mago: () => tone('sine', 520, 980, 0.16, 0.12),
  catapulta: () => { noise(0.12, 0.3, 700); tone('square', 140, 70, 0.12, 0.08); },
  pulse: () => tone('sine', 220, 150, 0.3, 0.1),
  impact: () => { noise(0.25, 0.6, 500); tone('sine', 90, 40, 0.25, 0.3); },
  burst: () => { noise(0.12, 0.2, 2400); tone('sine', 700, 300, 0.14, 0.08); },
  burn: () => noise(0.22, 0.12, 1600),
  kill: () => tone('triangle', 420, 180, 0.09, 0.08),
  coin: () => { tone('square', 990, 990, 0.05, 0.06); tone('square', 1320, 1320, 0.09, 0.06, 0.05); },
  build: () => { noise(0.1, 0.4, 900); tone('sine', 180, 120, 0.12, 0.2); },
  up: () => { tone('triangle', 520, 520, 0.08, 0.12); tone('triangle', 660, 660, 0.08, 0.12, 0.08); tone('triangle', 880, 880, 0.14, 0.12, 0.16); },
  no: () => tone('square', 160, 120, 0.12, 0.08),
  tap: () => tone('sine', 600, 500, 0.04, 0.06),
  leak: () => { tone('sawtooth', 180, 70, 0.35, 0.22); noise(0.2, 0.3, 400); },
  horn: () => { tone('sawtooth', 147, 147, 0.5, 0.14); tone('sawtooth', 196, 196, 0.7, 0.14, 0.45); },
  cleared: () => { tone('triangle', 523, 523, 0.12, 0.14); tone('triangle', 659, 659, 0.12, 0.14, 0.12); tone('triangle', 784, 784, 0.25, 0.14, 0.24); },
  won: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.3, 0.16, i * 0.15)),
  lost: () => [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.4, 0.12, i * 0.28)),
};

export function play(name, minGap = 0.06) {
  if (!ac || !enabled || !SOUNDS[name]) return;
  const now = ac.currentTime;
  if (last[name] != null && now - last[name] < minGap) return;
  last[name] = now;
  try { SOUNDS[name](); } catch (e) { /* ignora */ }
}

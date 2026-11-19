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

// Il rumore dell'acqua: un fruscio continuo che va e viene come le onde. Il volume segue quanto la camera è vicina all'acqua; ogni tanto un gabbiano.
let wave = null, waveG = null, gullT = 6;
export function water(level, dt) {
  if (!ac) return;
  try {
    if (!wave) {
      const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < n; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = b * 7; }      // rumore «marrone»: più morbido di quello bianco
      wave = ac.createBufferSource(); wave.buffer = buf; wave.loop = true;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650;
      waveG = ac.createGain(); waveG.gain.value = 0; wave.connect(f); f.connect(waveG); waveG.connect(master); wave.start();
    }
    const now = ac.currentTime, swell = 0.6 + 0.4 * Math.sin(now * 0.9) * Math.sin(now * 0.37 + 1), lv = Math.max(0, Math.min(1, level));
    waveG.gain.setTargetAtTime(lv * 0.45 * swell, now, 0.25);
    if (enabled && lv > 0.35) { gullT -= dt; if (gullT <= 0) { gullT = 9 + Math.random() * 14; const v = 0.03 * lv; tone('sine', 1500, 1050, 0.16, v); tone('sine', 1650, 1100, 0.2, v, 0.2); tone('sine', 1600, 1000, 0.28, v, 0.46); } }
  } catch (e) { /* senza audio si gioca lo stesso */ }
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
  chop: () => { noise(0.06, 0.3, 1800); tone('triangle', 300, 160, 0.07, 0.1); },
  slash: () => noise(0.05, 0.18, 4200),
  wall: () => { noise(0.07, 0.22, 600); tone('sine', 110, 70, 0.08, 0.1); },
  tap: () => tone('sine', 600, 500, 0.04, 0.06),
  leak: () => { tone('sawtooth', 180, 70, 0.35, 0.22); noise(0.2, 0.3, 400); },
  horn: () => { tone('sawtooth', 147, 147, 0.5, 0.14); tone('sawtooth', 196, 196, 0.7, 0.14, 0.45); },
  cleared: () => { tone('triangle', 523, 523, 0.12, 0.14); tone('triangle', 659, 659, 0.12, 0.14, 0.12); tone('triangle', 784, 784, 0.25, 0.14, 0.24); },
  won: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.3, 0.16, i * 0.15)),
  lost: () => [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.4, 0.12, i * 0.28)),
};

Object.assign(SOUNDS, {
  hey: () => { tone('sine', 620, 1040, 0.09, 0.09); tone('sine', 880, 1240, 0.08, 0.07, 0.1); },                 // la vocina di un Tuzu
  sad: () => { tone('sine', 520, 330, 0.22, 0.09); },
  ally: () => [392, 523, 659].forEach((f, i) => tone('sine', f, f, 0.22, 0.12, i * 0.11)),
  event: () => { tone('sine', 880, 880, 0.5, 0.1); tone('sine', 1320, 1320, 0.7, 0.07, 0.12); },                 // una campanella
  heroUp: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.16, 0.07, i * 0.09)),
  shout: () => { tone('sawtooth', 220, 440, 0.4, 0.12); tone('sawtooth', 330, 660, 0.4, 0.08, 0.05); },
  page: () => noise(0.12, 0.12, 3000),
  splash: () => noise(0.3, 0.1, 1400),
});

// ---------- musica: generata nota per nota, una di giorno, una di notte, una per l'assalto ----------
let music = true, mGain = null, mNext = 0, mStep = 0, mMode = 'day', mRnd = 12345, mIdx = 2;
const SCALE = { day: [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3], night: [220, 261.6, 293.7, 329.6, 392, 440], raid: [220, 261.6, 293.7, 329.6, 392, 440] };
const ROOTS = { day: [130.8, 110, 87.3, 98], night: [110, 87.3, 98, 82.4], raid: [110, 110, 87.3, 98] };
export function setMusic(on) { music = on; if (mGain) mGain.gain.value = on ? 1 : 0; }
function rnd() { mRnd = (mRnd * 1103515245 + 12345) & 0x7fffffff; return mRnd / 0x7fffffff; }
function note(type, f, dur, vol, t0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(mGain); o.start(t0); o.stop(t0 + dur + 0.03);
}
/** Da chiamare a ogni fotogramma: mette in coda le prossime note. mode: 'day' | 'night' | 'raid'. */
export function musicTick(mode) {
  if (!ac || !enabled || !music || ac.state !== 'running') return;
  if (!mGain) { mGain = ac.createGain(); mGain.gain.value = 1; mGain.connect(master); }
  mMode = SCALE[mode] ? mode : 'day';
  const step = mMode === 'night' ? 0.44 : mMode === 'raid' ? 0.25 : 0.32;
  if (mNext < ac.currentTime) mNext = ac.currentTime + 0.06;
  while (mNext < ac.currentTime + 0.35) {
    const k = mStep++, sc = SCALE[mMode], root = ROOTS[mMode][Math.floor(k / 8) % 4];
    if (k % 8 === 0) { note('sine', root, step * 7.4, 0.085, mNext); note('triangle', root * 2, step * 7, 0.022, mNext); note('triangle', root * 3, step * 7, 0.016, mNext); }
    if (mMode === 'raid' && k % 2 === 0) { note('square', root * (k % 8 === 4 ? 1.5 : 1), 0.09, 0.04, mNext); }
    if (rnd() < (mMode === 'night' ? 0.34 : 0.6)) {
      mIdx = Math.max(0, Math.min(sc.length - 1, mIdx + Math.round(rnd() * 4 - 2)));
      note(mMode === 'night' ? 'sine' : 'triangle', sc[mIdx], step * (mMode === 'night' ? 2.6 : 1.5), mMode === 'night' ? 0.05 : 0.06, mNext);
    }
    mNext += step;
  }
}

export function play(name, minGap = 0.06) {
  if (!ac || !enabled || !SOUNDS[name]) return;
  const now = ac.currentTime;
  if (last[name] != null && now - last[name] < minGap) return;
  last[name] = now;
  try { SOUNDS[name](); } catch (e) { /* ignora */ }
}

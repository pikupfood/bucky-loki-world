// Logica pura della battaglia (nessun disegno, nessun DOM): si può simulare anche fuori dal browser.
import { TOWERS, ENEMIES, BASE_GOLD, BASE_LIVES, HP_GROWTH, SELL_REFUND, LEVELS, mulberry32 } from './data.js';

const MULT = { physical: (e) => 1 - e.armor, magic: (e) => 1 - e.mres, fire: (e) => 1 - e.mres * 0.5 };   // il fuoco ignora l'armatura

const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Game {
  /**
   * @param level uno dei LEVELS
   * @param mods  modificatori dal villaggio: { phys, magic, range, lives, gold, towers:[tipi sbloccati], spell:{dmg,radius,cd}|null }
   */
  constructor(level = LEVELS[0], mods = {}, seed = 12345) {
    this.level = level;
    this.mods = Object.assign({ phys: 1, magic: 1, range: 1, lives: 0, gold: 0, towers: null, spell: null }, mods);
    this.seed = seed;
    this.reset();
  }

  reset() {
    this.rng = mulberry32(this.seed);
    this.status = 'build';          // build | wave | won | lost
    this.wave = 0;                  // notti già superate (= indice della prossima)
    this.gold = BASE_GOLD + this.mods.gold;
    this.lives = BASE_LIVES + this.mods.lives;
    this.maxLives = this.lives;
    this.towers = [];
    this.enemies = [];
    this.projs = [];
    this.events = [];               // letti dal disegno/audio a ogni frame
    this.queue = [];
    this.waveT = 0;
    this.time = 0;
    this.kills = 0;
    this.spellCd = 0;
    this.uid = 1;
    this.spotTower = new Array(this.level.spots.length).fill(null);
  }

  get totalWaves() { return this.level.endless ? Infinity : this.level.waves.length; }
  get over() { return this.status === 'won' || this.status === 'lost'; }
  get remaining() { return this.queue.length + this.enemies.length; }
  stats(t) { return TOWERS[t.type].levels[t.level]; }
  range(t) { return this.stats(t).range * this.mods.range; }
  dmg(t) { return this.stats(t).dmg * (TOWERS[t.type].kind === 'magic' ? this.mods.magic : this.mods.phys); }
  unlocked(type) { return !this.mods.towers || this.mods.towers.includes(type); }
  costOf(type) { return TOWERS[type].levels[0].cost; }

  build(spot, type) {
    if (this.over || this.spotTower[spot] || !TOWERS[type] || !this.unlocked(type)) return false;
    const c = this.costOf(type);
    if (this.gold < c) return false;
    this.gold -= c;
    const s = this.level.spots[spot];
    const t = { id: this.uid++, type, level: 0, x: s.x, y: s.y, spot, cd: 0.25, angle: -Math.PI / 2, spent: c, fireAnim: 0 };
    this.towers.push(t);
    this.spotTower[spot] = t;
    this.events.push({ k: 'build', x: t.x, y: t.y });
    return true;
  }

  upgradeCost(t) {
    const L = TOWERS[t.type].levels;
    return t.level < L.length - 1 ? L[t.level + 1].cost : null;
  }

  upgrade(t) {
    const c = this.upgradeCost(t);
    if (this.over || c == null || this.gold < c) return false;
    this.gold -= c; t.level++; t.spent += c;
    this.events.push({ k: 'upgrade', x: t.x, y: t.y });
    return true;
  }

  sellValue(t) { return Math.round(t.spent * SELL_REFUND); }

  sell(t) {
    if (this.over) return false;
    const i = this.towers.indexOf(t);
    if (i < 0) return false;
    this.gold += this.sellValue(t);
    this.towers.splice(i, 1);
    this.spotTower[t.spot] = null;
    this.events.push({ k: 'sell', x: t.x, y: t.y });
    return true;
  }

  startWave() {
    if (this.status !== 'build' || this.wave >= this.totalWaves) return false;
    const q = [];
    for (const g of this.level.waveAt(this.wave)) for (let i = 0; i < g.n; i++) q.push({ t: (g.at || 0) + i * g.gap, type: g.t });
    q.sort((a, b) => a.t - b.t);
    this.queue = q;
    this.waveT = 0;
    this.status = 'wave';
    this.events.push({ k: 'wave' });
    return true;
  }

  /** Incantesimo Fulmine: danno magico ad area dove tocchi. */
  castSpell(x, y) {
    const sp = this.mods.spell;
    if (!sp || this.over || this.spellCd > 0 || this.status !== 'wave') return false;
    this.spellCd = sp.cd;
    this.splash(x, y, sp.radius, sp.dmg, 'magic');
    this.events.push({ k: 'spell', x, y, r: sp.radius });
    return true;
  }

  spawn(type) {
    const def = ENEMIES[type];
    const mul = (def.boss ? 1 + HP_GROWTH * this.wave * 0.4 : 1 + HP_GROWTH * this.wave) * this.level.hpMul;
    // nell'assedio senza fine la vita sale sempre più in fretta: prima o poi si cade
    const siege = this.level.endless ? 1 + this.wave * this.wave * 0.008 : 1;
    const hp = Math.round(def.hp * mul * siege);
    const e = {
      id: this.uid++, type, hp, maxHp: hp,
      speed: def.speed * (0.94 + this.rng() * 0.12),
      reward: def.reward, lives: def.lives, armor: def.armor, mres: def.mres, slowRes: def.slowRes, r: def.r,
      boss: !!def.boss, dist: 0, off: (this.rng() - 0.5) * 16,
      slowT: 0, slowF: 1, burnT: 0, burnDps: 0, hit: 0, anim: this.rng() * 10, dead: false, x: 0, y: 0, ang: 0,
    };
    this.place(e);
    this.enemies.push(e);
    this.events.push({ k: 'spawn', x: e.x, y: e.y, boss: e.boss });
  }

  place(e) {
    const p = this.level.pos(e.dist);
    e.x = p.x - Math.sin(p.ang) * e.off;
    e.y = p.y + Math.cos(p.ang) * e.off;
    e.ang = p.ang;
  }

  damage(e, amount, kind, silent) {
    if (e.dead) return;
    e.hp -= amount * MULT[kind](e);
    if (!silent) e.hit = 0.12;
    if (e.hp <= 0) {
      e.dead = true;
      this.gold += e.reward;
      this.kills++;
      this.events.push({ k: 'kill', x: e.x, y: e.y, reward: e.reward, type: e.type, boss: e.boss });
    }
  }

  splash(x, y, r, dmg, kind) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const rr = r + e.r;
      if ((e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) <= rr * rr) this.damage(e, dmg, kind);
    }
  }

  applySlow(e, f, T) {
    const nf = 1 - f * (1 - e.slowRes);
    if (nf < e.slowF || e.slowT <= 0) e.slowF = nf;
    e.slowT = Math.max(e.slowT, T);
  }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    if (this.spellCd > 0) this.spellCd = Math.max(0, this.spellCd - dt);

    if (this.status === 'wave') {
      this.waveT += dt;
      while (this.queue.length && this.queue[0].t <= this.waveT) this.spawn(this.queue.shift().type);
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
      if (e.hit > 0) e.hit -= dt;
      if (e.burnT > 0) { e.burnT -= dt; this.damage(e, e.burnDps * dt, 'fire', true); if (e.dead) continue; }
      const v = e.speed * e.slowF;
      e.dist += v * dt;
      e.anim += dt * v * 0.085;
      this.place(e);
      if (e.dist >= this.level.len) {
        e.dead = true;
        this.lives = Math.max(0, this.lives - e.lives);
        this.events.push({ k: 'leak', x: e.x, y: e.y, lives: e.lives });
      }
    }

    for (const t of this.towers) this.updateTower(t, dt);
    for (const p of this.projs) this.updateProj(p, dt);

    this.enemies = this.enemies.filter(e => !e.dead);
    this.projs = this.projs.filter(p => !p.dead);

    if (this.lives <= 0) {
      this.status = 'lost';
      this.events.push({ k: 'lost' });
    } else if (this.status === 'wave' && !this.queue.length && !this.enemies.length) {
      this.wave++;
      const bonus = 25 + 6 * this.wave;
      this.gold += bonus;
      this.projs.length = 0;
      if (this.wave >= this.totalWaves) { this.status = 'won'; this.events.push({ k: 'won' }); }
      else { this.status = 'build'; this.events.push({ k: 'waveEnd', bonus }); }
    }
  }

  updateTower(t, dt) {
    const s = this.stats(t), def = TOWERS[t.type], range = this.range(t), dmg = this.dmg(t);
    t.cd -= dt;
    if (t.fireAnim > 0) t.fireAnim -= dt;

    if (def.proj === 'burn') {
      if (t.cd > 0) return;
      let any = false;
      for (const e of this.enemies) {
        if (e.dead || d2(e, t) > range * range) continue;
        any = true;
        if (e.burnT <= 0 || dmg >= e.burnDps) e.burnDps = dmg;
        e.burnT = s.burnT;
      }
      t.cd = any ? s.rate : 0.15;
      t.burning = any;
      if (any) this.events.push({ k: 'burn', x: t.x, y: t.y });
      return;
    }

    if (def.proj === 'pulse') {
      if (t.cd > 0) return;
      let any = false;
      for (const e of this.enemies) {
        if (e.dead || d2(e, t) > range * range) continue;
        any = true;
        this.applySlow(e, s.slow, s.slowT);
        if (dmg) this.damage(e, dmg, 'magic');
      }
      if (any) { t.cd = s.rate; t.fireAnim = 0.5; this.events.push({ k: 'pulse', x: t.x, y: t.y, r: range }); }
      else t.cd = 0.15;
      return;
    }

    let best = null;
    const R2 = range * range, m2 = def.minRange ? def.minRange * def.minRange : 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dd = d2(e, t);
      if (dd > R2 || dd < m2) continue;
      if (!best || e.dist > best.dist) best = e;
    }
    if (!best) return;
    t.angle = lerpAngle(t.angle, Math.atan2(best.y - t.y, best.x - t.x), Math.min(1, dt * 14));
    if (t.cd > 0) return;
    t.cd = s.rate;
    t.fireAnim = def.proj === 'boulder' ? 0.45 : 0.18;
    const dist = Math.sqrt(d2(best, t));
    if (def.proj === 'arrow' || def.proj === 'orb') {
      // posizioni a terra (x,y) + altezza h separata: vale sia per il disegno 2D sia per il 3D
      this.projs.push({
        k: def.proj, x: t.x, y: t.y, h: 60, d0: Math.max(1, dist), tx: best.x, ty: best.y, target: best,
        speed: def.proj === 'arrow' ? 560 : 330, dmg, kind: def.kind, splash: s.splash, ang: t.angle,
      });
    } else {
      const T = Math.max(0.55, Math.min(1.15, dist / 260));
      const lead = this.level.pos(Math.min(this.level.len, best.dist + best.speed * best.slowF * T));
      this.projs.push({ k: 'boulder', x: t.x, y: t.y, h: 40, x0: t.x, y0: t.y, x1: lead.x, y1: lead.y, t: 0, T, dmg, kind: def.kind, splash: s.splash });
    }
    this.events.push({ k: 'shot', type: t.type, x: t.x, y: t.y });
  }

  updateProj(p, dt) {
    if (p.k === 'boulder') {
      p.t += dt;
      const u = Math.min(1, p.t / p.T);
      p.x = p.x0 + (p.x1 - p.x0) * u;
      p.y = p.y0 + (p.y1 - p.y0) * u;
      p.h = 40 * (1 - u) + Math.sin(u * Math.PI) * 90;
      if (u >= 1) {
        p.dead = true;
        this.splash(p.x1, p.y1, p.splash, p.dmg, p.kind);
        this.events.push({ k: 'impact', x: p.x1, y: p.y1, r: p.splash });
      }
      return;
    }
    if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy), step = p.speed * dt;
    p.ang = Math.atan2(dy, dx);
    p.h = 18 + 42 * Math.min(1, dist / p.d0);
    if (dist <= step + 4) {
      p.dead = true;
      if (p.k === 'orb') {
        this.splash(p.tx, p.ty, p.splash, p.dmg, p.kind);
        this.events.push({ k: 'burst', x: p.tx, y: p.ty, r: p.splash });
      } else if (p.target && !p.target.dead) {
        this.damage(p.target, p.dmg, p.kind);
        this.events.push({ k: 'hit', x: p.tx, y: p.ty });
      }
      return;
    }
    p.x += dx / dist * step;
    p.y += dy / dist * step;
  }
}

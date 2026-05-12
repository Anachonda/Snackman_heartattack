// Sound engine — WAV files take priority; synthesizer is the fallback.

// ── WAV loader ────────────────────────────────────────────────────────────────

type SfxName =
  | 'eat-good' | 'eat-bad'
  | 'ghost-hit' | 'email-hit' | 'blob-hit'
  | 'footstep' | 'footstep-boost'
  | 'stress-warning' | 'tired-puff'
  | 'level-complete' | 'heart-attack' | 'burnout' | 'relax';

const _sfx: Partial<Record<SfxName, HTMLAudioElement | null>> = {};

const SFX_URL_OVERRIDES: Partial<Record<SfxName, string>> = {
  'heart-attack': '/audio/sfx/Death.wav',
  'burnout':      '/audio/sfx/Death.wav',
  'level-complete': '/audio/sfx/Level-complete.wav',
};

// Returns the preloaded audio element if the WAV file exists, otherwise null.
function sfx(name: SfxName): HTMLAudioElement | null {
  if (name in _sfx) return _sfx[name] ?? null;
  // Mark as attempted so we don't keep retrying
  _sfx[name] = null;
  const url = SFX_URL_OVERRIDES[name] ?? `/audio/sfx/${name}.wav`;
  const el = new Audio(url);
  el.preload = 'auto';
  el.addEventListener('canplaythrough', () => { _sfx[name] = el; }, { once: true });
  el.addEventListener('error', () => { _sfx[name] = null; }, { once: true });
  el.load();
  return null;
}

// Plays a WAV sound effect if loaded, returns true. Otherwise returns false (use synth).
function playSfx(name: SfxName, volume = 1): boolean {
  const el = sfx(name);
  if (!el) return false;
  const clone = el.cloneNode() as HTMLAudioElement;
  clone.volume = Math.min(1, Math.max(0, volume));
  clone.play().catch(() => {/* autoplay blocked */});
  return true;
}

// Preload all WAV files at startup so they're ready instantly
export function preloadSfx() {
  const names: SfxName[] = [
    'eat-good', 'eat-bad', 'ghost-hit', 'email-hit', 'blob-hit',
    'footstep', 'footstep-boost', 'stress-warning', 'tired-puff',
    'level-complete', 'heart-attack', 'burnout', 'relax',
  ];
  names.forEach(sfx);
}

let _ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function gain(ctx: AudioContext, value: number, dest?: AudioNode) {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(dest ?? ctx.destination);
  return g;
}

function osc(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  dest: AudioNode,
  startOffset = 0,
  dur = 0.15
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  const t = ctx.currentTime + startOffset;
  o.start(t);
  o.stop(t + dur);
  return o;
}

function env(
  ctx: AudioContext,
  g: GainNode,
  attack: number,
  decay: number,
  peak: number,
  startOffset = 0
) {
  const t = ctx.currentTime + startOffset;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// ── Eating sounds ──────────────────────────────────────────────────────────────

export function playGoodEat() {
  if (playSfx('eat-good', 0.7)) return;
  const ctx = ac();
  const g = gain(ctx, 0.28);
  env(ctx, g, 0.008, 0.12, 1);
  osc(ctx, 'sine', 660, g, 0, 0.13);
  osc(ctx, 'sine', 880, g, 0.06, 0.13);
  const g2 = gain(ctx, 0.14);
  env(ctx, g2, 0.005, 0.08, 1, 0.1);
  osc(ctx, 'triangle', 1320, g2, 0.1, 0.1);
}

export function playBadEat() {
  if (playSfx('eat-bad', 0.7)) return;
  const ctx = ac();
  const g = gain(ctx, 0.35);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(280, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25);
  o.connect(g);
  g.gain.setValueAtTime(0.35, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.3);

  // Wet "glurp" noise layer
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const ng = gain(ctx, 0.18);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  src.connect(lp);
  lp.connect(ng);
  src.start(ctx.currentTime + 0.05);
}

// ── Enemy sounds ──────────────────────────────────────────────────────────────

export function playGhostHit() {
  if (playSfx('ghost-hit', 0.7)) return;
  const ctx = ac();
  const g = gain(ctx, 0.22);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(800, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.35);
  o.connect(g);
  g.gain.setValueAtTime(0.22, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.4);

  // Tremolo wobble
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 18;
  lfoG.gain.value = 80;
  lfo.connect(lfoG);
  lfoG.connect(o.frequency);
  lfo.start(ctx.currentTime);
  lfo.stop(ctx.currentTime + 0.4);
}

export function playEmailHit() {
  if (playSfx('email-hit', 0.7)) return;
  const ctx = ac();
  for (let i = 0; i < 3; i++) {
    const g = gain(ctx, 0.18);
    env(ctx, g, 0.003, 0.1, 1, i * 0.07);
    osc(ctx, 'sine', 1200 - i * 120, g, i * 0.07, 0.1);
  }
}

export function playBlobHit() {
  if (playSfx('blob-hit', 0.7)) return;
  const ctx = ac();
  const g = gain(ctx, 0.3);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(180, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.3);
  o.connect(g);
  g.gain.setValueAtTime(0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.35);

  // Second bloop overtone
  const g2 = gain(ctx, 0.1);
  osc(ctx, 'sine', 110, g2, 0.05, 0.2);
}

// ── Movement sounds ───────────────────────────────────────────────────────────

// Throttle so footsteps don't fire every frame
let _lastFootstep = 0;

export function playFootstep(boosted: boolean) {
  const now = Date.now();
  const interval = boosted ? 95 : 160;
  if (now - _lastFootstep < interval) return;
  _lastFootstep = now;

  const ctx = ac();
  if (boosted) {
    if (playSfx('footstep-boost', 0.4)) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    src.connect(hp);
    hp.connect(ctx.destination);
    src.start();
  } else {
    if (playSfx('footstep', 0.3)) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    src.connect(lp);
    const g = gain(ctx, 0.12);
    lp.connect(g);
    src.start();
  }
}

// ── Stress-man sounds ─────────────────────────────────────────────────────────

let _lastStressManWarn = 0;

export function playStressManWarning(stress: number) {
  const now = Date.now();
  if (now - _lastStressManWarn < 1400) return;
  _lastStressManWarn = now;

  if (playSfx('stress-warning', 0.5)) return;
  const ctx = ac();
  const intensity = Math.max(0, (stress - 70) / 30);
  const freq = 200 + intensity * 300;

  const g = gain(ctx, 0.15 + intensity * 0.1);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  o.frequency.linearRampToValueAtTime(freq * 1.4, ctx.currentTime + 0.12);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.35);
  o.connect(g);
  g.gain.setValueAtTime(0.15 + intensity * 0.1, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.4);
}

// ── Health / stress state sounds ──────────────────────────────────────────────

let _lastPuff = 0;

export function playTiredPuff(health: number) {
  // Wheezy exhale when health is low
  const now = Date.now();
  const interval = 300 + health * 8; // puff faster when more tired
  if (now - _lastPuff < interval) return;
  _lastPuff = now;

  if (playSfx('tired-puff', 0.4)) return;
  const ctx = ac();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600 - health * 2;
  bp.Q.value = 1.5;
  src.connect(bp);
  const g = gain(ctx, 0.14 + (1 - health / 100) * 0.18);
  bp.connect(g);
  src.start();
}

// ── Game events ───────────────────────────────────────────────────────────────

export function playLevelComplete() {
  if (playSfx('level-complete', 0.8)) return;
  const ctx = ac();
  const now = ctx.currentTime;
  // Simple pling: sine wave, instant attack, long natural decay
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  g.connect(ctx.destination);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = 1047; // C6 — bright but not harsh
  o.connect(g);
  o.start(now);
  o.stop(now + 1.2);
}

export function playHeartAttack() {
  if (playSfx('heart-attack', 0.8)) return;
  const ctx = ac();
  const g = gain(ctx, 0.4);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(80, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.25);
  o.connect(g);
  g.gain.setValueAtTime(0.4, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.3);

  // Quick flatline sting — short, not looping
  const g2 = gain(ctx, 0.12);
  env(ctx, g2, 0.01, 0.25, 1, 0.2);
  osc(ctx, 'sine', 440, g2, 0.2, 0.28);
}

export function playBurnout() {
  if (playSfx('burnout', 0.7)) return;
  const ctx = ac();
  const g = gain(ctx, 0.28);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(500, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
  o.connect(g);
  g.gain.setValueAtTime(0.28, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.35);
}

export function playRelax() {
  if (playSfx('relax', 0.6)) return;
  const ctx = ac();
  const g = gain(ctx, 0.12);
  env(ctx, g, 0.05, 0.5, 1);
  osc(ctx, 'sine', 330, g, 0, 0.6);
  osc(ctx, 'sine', 415, gain(ctx, 0.08), 0, 0.6);
  osc(ctx, 'sine', 494, gain(ctx, 0.06), 0.1, 0.5);
}

// ── Music Manager ─────────────────────────────────────────────────────────────
// Single track (Snackman). Playback rate scales with stress:
//   stress 0   → rate 0.80  (20% slower than original)
//   stress 100 → rate 1.50  (50% faster than original)
// Rate changes are smoothed each frame to avoid jarring jumps.

const SNACKMAN_URL = 'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Snackman.mp3';

const MUSIC_VOL   = 0.55;
const FADE_STEP   = 0.016;
const RATE_MIN    = 0.90;
const RATE_MAX    = 1.50;
const RATE_SMOOTH = 0.015; // max rate change per frame (~16ms)

let _musicEnabled = true;
let _musicEl: HTMLAudioElement | null = null;
let _targetRate = RATE_MIN;
let _playing = false;

export function getMusicEnabled(): boolean { return _musicEnabled; }

export function setMusicEnabled(on: boolean): void {
  _musicEnabled = on;
  if (!on) stopMusic();
}

function _getMusic(): HTMLAudioElement {
  if (!_musicEl) {
    _musicEl = new Audio(SNACKMAN_URL);
    _musicEl.loop = true;
    _musicEl.volume = 0;
    _musicEl.playbackRate = RATE_MIN;
    _musicEl.preload = 'auto';
  }
  return _musicEl;
}

// Call once per frame. stress is 0–100.
export function updateMusic(phase: string, _health: number, stress: number) {
  if (!_musicEnabled) return;

  const el = _getMusic();
  const active = phase === 'playing' || phase === 'paused';

  if (active && !_playing) {
    if (el.paused) {
      el.volume = 0;
      el.play().catch(() => {/* autoplay blocked */});
    }
    _playing = true;
  } else if (!active && _playing) {
    // Fade out then pause handled below
  }

  // Volume
  if (!active) {
    el.volume = Math.max(0, el.volume - FADE_STEP * 1.5);
    if (el.volume <= 0 && !el.paused) {
      el.pause();
      _playing = false;
    }
  } else if (phase === 'paused') {
    el.volume = Math.max(0.12, el.volume - FADE_STEP * 0.5);
  } else {
    el.volume = Math.min(MUSIC_VOL, el.volume + FADE_STEP);
  }

  // Target playback rate: linearly mapped from stress 0→100 to RATE_MIN→RATE_MAX
  _targetRate = RATE_MIN + (stress / 100) * (RATE_MAX - RATE_MIN);

  // Smooth the rate change so it doesn't snap
  const diff = _targetRate - el.playbackRate;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), RATE_SMOOTH);
  el.playbackRate = el.playbackRate + step;
}

export function stopMusic() {
  if (_musicEl) {
    _musicEl.pause();
    _musicEl.volume = 0;
    _musicEl.playbackRate = RATE_MIN;
  }
  _playing = false;
}

export function unlockAudio() {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
}

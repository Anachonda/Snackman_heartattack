// Audio module: background music + minimal SFX via Web Audio API.
// All audio must be initialized inside a user gesture (initMusic).

// ── Music ─────────────────────────────────────────────────────────────────────

// Local path first (served from /public/audio/), remote as fallback
const MUSIC_URL_LOCAL  = '/audio/Snackman.mp3';
const MUSIC_URL_REMOTE = 'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Snackman.mp3';
const MUSIC_VOL   = 0.35;
const RATE_MIN    = 0.90;
const RATE_MAX    = 1.50;
const RATE_SMOOTH = 0.015;
const FADE_STEP   = 0.016;

let _el: HTMLAudioElement | null = null;
let _musicEnabled = true;
let _targetRate = RATE_MIN;

export function getMusicEnabled(): boolean { return _musicEnabled; }

export function setMusicEnabled(on: boolean): void {
  _musicEnabled = on;
  if (!_el) return;
  if (!on) _el.pause();
  else if (_el.paused) _playMusic();
}

function _playMusic(): void {
  if (!_el || !_musicEnabled) return;
  const p = _el.play();
  if (p) {
    p.catch(() => {
      // Autoplay blocked — will retry on next updateMusic tick
    });
  }
}

export function initMusic(): void {
  if (_el) {
    if (_musicEnabled && _el.paused) _playMusic();
    return;
  }
  _el = new Audio();
  _el.loop = true;
  _el.volume = 0;
  _el.playbackRate = RATE_MIN;
  _el.preload = 'auto';

  // On mobile, loop attribute can silently fail for buffered remote audio.
  // ended-event is a reliable fallback.
  _el.addEventListener('ended', () => {
    if (!_el || !_musicEnabled) return;
    _el.currentTime = 0;
    _playMusic();
  });

  // Try local first; if it 404s, switch to remote
  _el.src = MUSIC_URL_LOCAL;
  _el.addEventListener('error', () => {
    if (!_el) return;
    // Only switch to remote if we were still trying local
    if (_el.src.includes(MUSIC_URL_LOCAL.replace(/^\//, ''))) {
      _el.src = MUSIC_URL_REMOTE;
      _el.load();
      if (_musicEnabled) _playMusic();
    }
  }, { once: true });

  _el.load();
  if (_musicEnabled) _playMusic();
}

export function updateMusic(phase: string, stress: number): void {
  if (!_el || !_musicEnabled) return;
  const active = phase === 'playing' || phase === 'paused';
  if (!active) {
    _el.volume = Math.max(0, _el.volume - FADE_STEP * 1.5);
    if (_el.volume <= 0 && !_el.paused) _el.pause();
  } else if (phase === 'paused') {
    _el.volume = Math.max(0.12, _el.volume - FADE_STEP * 0.5);
  } else {
    // Re-trigger play if browser paused us (e.g. screen lock / tab switch)
    if (_el.paused) _playMusic();
    _el.volume = Math.min(MUSIC_VOL, _el.volume + FADE_STEP);
  }
  _targetRate = RATE_MIN + (stress / 100) * (RATE_MAX - RATE_MIN);
  const diff = _targetRate - _el.playbackRate;
  _el.playbackRate += Math.sign(diff) * Math.min(Math.abs(diff), RATE_SMOOTH);
}

export function stopMusic(): void {
  if (_el) { _el.pause(); _el.volume = 0; _el.playbackRate = RATE_MIN; }
}

// ── SFX via Web Audio ─────────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

// Called alongside initMusic() so the AudioContext is created in the same gesture.
export function initSfx(): void {
  if (_ctx) return;
  _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
}

function master(gain: number): GainNode {
  const g = ctx()!.createGain();
  g.gain.value = gain;
  g.connect(ctx()!.destination);
  return g;
}

// Healthy food eaten — bright ascending chime
export function playSfxGoodEat(): void {
  const c = ctx(); if (!c) return;
  const freqs = [523, 659, 784, 1047]; // C5 E5 G5 C6
  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = c.currentTime + i * 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.25);
  });
}

// Unhealthy food eaten — low dissonant buzz
export function playSfxBadEat(): void {
  const c = ctx(); if (!c) return;
  [180, 270].forEach((freq, i) => {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const t = c.currentTime + i * 0.04;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.20);
  });
}

// Enemy hit — sharp thud
export function playSfxEnemyHit(): void {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const g   = master(0.22);
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.12);
  g.gain.setValueAtTime(0.22, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.connect(g);
  osc.start(); osc.stop(c.currentTime + 0.18);
}

// Level complete — rising fanfare
export function playSfxLevelComplete(): void {
  const c = ctx(); if (!c) return;
  const notes = [392, 523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = c.currentTime + i * 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.20, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g); g.connect(c.destination);
    osc.start(t); osc.stop(t + 0.38);
  });
}

// Death — descending impact
export function playSfxDead(): void {
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const g   = master(0.28);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.55);
  g.gain.setValueAtTime(0.28, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.60);
  osc.connect(g);
  osc.start(); osc.stop(c.currentTime + 0.65);
}

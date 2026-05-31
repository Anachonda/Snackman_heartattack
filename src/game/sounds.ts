// Audio module: background music + minimal SFX via Web Audio API.
// All audio must be initialized inside a user gesture (initMusic/initSfx).

// ── Shared AudioContext ───────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function initSfx(): void {
  if (_ctx) return;
  _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
}

// ── Music ─────────────────────────────────────────────────────────────────────

const MUSIC_URL_LOCAL  = '/audio/Snackman.mp3';
const MUSIC_URL_REMOTE = 'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Snackman.mp3';
const MUSIC_VOL   = 0.35;
const RATE_MIN    = 0.90;
const RATE_MAX    = 1.50;
const RATE_SMOOTH = 0.015;
const FADE_STEP   = 0.016;

let _musicEnabled = true;
let _buffer: AudioBuffer | null = null;
let _source: AudioBufferSourceNode | null = null;
let _gainNode: GainNode | null = null;
let _currentVolume = 0;
let _currentRate = RATE_MIN;
let _targetRate = RATE_MIN;
let _musicPlaying = false;

export function getMusicEnabled(): boolean { return _musicEnabled; }

export function setMusicEnabled(on: boolean): void {
  _musicEnabled = on;
  if (!on) {
    _stopSource();
    _musicPlaying = false;
  } else if (_buffer && !_musicPlaying) {
    _startSource();
  }
}

function _startSource(): void {
  if (!_ctx || !_buffer || !_gainNode || !_musicEnabled) return;
  _stopSource();
  _source = _ctx.createBufferSource();
  _source.buffer = _buffer;
  _source.loop = true;
  _source.playbackRate.value = _currentRate;
  _source.connect(_gainNode);
  _source.start();
  _musicPlaying = true;
}

function _stopSource(): void {
  if (_source) {
    try { _source.stop(); } catch (_) { /* already stopped */ }
    _source.disconnect();
    _source = null;
  }
  _musicPlaying = false;
}

async function _loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (!_ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const raw = await res.arrayBuffer();
    return await _ctx.decodeAudioData(raw);
  } catch (_) {
    return null;
  }
}

export function initMusic(): void {
  if (!_ctx) return;

  // Resume context synchronously inside user gesture so iOS unlocks audio.
  _ctx.resume().catch(() => {});

  if (_buffer) {
    if (_musicEnabled && !_musicPlaying) _startSource();
    return;
  }

  // Set up gain node once
  if (!_gainNode) {
    _gainNode = _ctx.createGain();
    _gainNode.gain.value = 0;
    _gainNode.connect(_ctx.destination);
  }

  // Load buffer async — local first, remote fallback
  (async () => {
    let buf = await _loadBuffer(MUSIC_URL_LOCAL);
    if (!buf) buf = await _loadBuffer(MUSIC_URL_REMOTE);
    if (!buf) return;
    _buffer = buf;
    if (_musicEnabled) _startSource();
  })();
}

export function updateMusic(phase: string, stress: number): void {
  if (!_gainNode || !_musicEnabled) return;

  const active = phase === 'playing' || phase === 'paused';

  if (!active) {
    _currentVolume = Math.max(0, _currentVolume - FADE_STEP * 1.5);
    _gainNode.gain.value = _currentVolume;
    if (_currentVolume <= 0 && _musicPlaying) _stopSource();
  } else if (phase === 'paused') {
    _currentVolume = Math.max(0.12, _currentVolume - FADE_STEP * 0.5);
    _gainNode.gain.value = _currentVolume;
  } else {
    if (!_musicPlaying && _buffer) _startSource();
    _currentVolume = Math.min(MUSIC_VOL, _currentVolume + FADE_STEP);
    _gainNode.gain.value = _currentVolume;
  }

  _targetRate = RATE_MIN + (stress / 100) * (RATE_MAX - RATE_MIN);
  const diff = _targetRate - _currentRate;
  _currentRate += Math.sign(diff) * Math.min(Math.abs(diff), RATE_SMOOTH);
  if (_source) _source.playbackRate.value = _currentRate;
}

export function stopMusic(): void {
  _stopSource();
  _currentVolume = 0;
  _currentRate = RATE_MIN;
  if (_gainNode) _gainNode.gain.value = 0;
}

// ── SFX ───────────────────────────────────────────────────────────────────────

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

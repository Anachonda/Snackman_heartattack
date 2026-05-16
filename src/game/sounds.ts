// Music manager — background track only, no SFX.
// Audio must be initialized via initMusic() inside a user gesture (tap/click).

const MUSIC_URL = 'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Snackman.mp3';
const MUSIC_VOL = 0.35;
const RATE_MIN  = 0.90;
const RATE_MAX  = 1.50;
const RATE_SMOOTH = 0.015;
const FADE_STEP   = 0.016;

let _el: HTMLAudioElement | null = null;
let _musicEnabled = true;
let _targetRate = RATE_MIN;

export function getMusicEnabled(): boolean { return _musicEnabled; }

export function setMusicEnabled(on: boolean): void {
  _musicEnabled = on;
  if (!_el) return;
  if (!on) {
    _el.pause();
  } else if (!_el.paused) {
    // already playing
  } else {
    _el.play().catch(() => {/* blocked */});
  }
}

// Call once inside a user gesture to create and start the audio element.
// Safe to call multiple times — only acts on the first call.
export function initMusic(): void {
  if (_el) {
    if (_musicEnabled && _el.paused) {
      _el.play().catch(() => {/* blocked */});
    }
    return;
  }
  _el = new Audio(MUSIC_URL);
  _el.loop = true;
  _el.volume = 0;
  _el.playbackRate = RATE_MIN;
  _el.preload = 'auto';
  if (_musicEnabled) {
    _el.play().catch(() => {/* blocked */});
  }
}

// Call once per animation frame. phase is the current GamePhase string.
export function updateMusic(phase: string, stress: number): void {
  if (!_el || !_musicEnabled) return;

  const active = phase === 'playing' || phase === 'paused';

  if (!active) {
    _el.volume = Math.max(0, _el.volume - FADE_STEP * 1.5);
    if (_el.volume <= 0 && !_el.paused) _el.pause();
  } else if (phase === 'paused') {
    _el.volume = Math.max(0.12, _el.volume - FADE_STEP * 0.5);
  } else {
    if (_el.paused) _el.play().catch(() => {/* blocked */});
    _el.volume = Math.min(MUSIC_VOL, _el.volume + FADE_STEP);
  }

  _targetRate = RATE_MIN + (stress / 100) * (RATE_MAX - RATE_MIN);
  const diff = _targetRate - _el.playbackRate;
  _el.playbackRate += Math.sign(diff) * Math.min(Math.abs(diff), RATE_SMOOTH);
}

export function stopMusic(): void {
  if (_el) {
    _el.pause();
    _el.volume = 0;
    _el.playbackRate = RATE_MIN;
  }
}

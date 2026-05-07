// Procedural sound engine — all sounds synthesized via Web Audio API, no files needed.

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
  const ctx = ac();
  // Happy two-tone "nom nom" — rising sparkle
  const g = gain(ctx, 0.28);
  env(ctx, g, 0.008, 0.12, 1);
  osc(ctx, 'sine', 660, g, 0, 0.13);
  osc(ctx, 'sine', 880, g, 0.06, 0.13);

  // Small high sparkle
  const g2 = gain(ctx, 0.14);
  env(ctx, g2, 0.005, 0.08, 1, 0.1);
  osc(ctx, 'triangle', 1320, g2, 0.1, 0.1);
}

export function playBadEat() {
  const ctx = ac();
  // Descending gross splat — low "bllurgh"
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
  const ctx = ac();
  // Eerie descending screech
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
  const ctx = ac();
  // Rapid notification-like "ding ding ding"
  for (let i = 0; i < 3; i++) {
    const g = gain(ctx, 0.18);
    env(ctx, g, 0.003, 0.1, 1, i * 0.07);
    osc(ctx, 'sine', 1200 - i * 120, g, i * 0.07, 0.1);
  }
}

export function playBlobHit() {
  const ctx = ac();
  // Sloppy low "blorp"
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
    // Fast whoosh tick
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
    // Soft footstep thud
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
  bp.frequency.value = 600 - health * 2; // lower pitch = more tired
  bp.Q.value = 1.5;
  src.connect(bp);
  const g = gain(ctx, 0.14 + (1 - health / 100) * 0.18);
  bp.connect(g);
  src.start();
}

// ── Game events ───────────────────────────────────────────────────────────────

export function playLevelComplete() {
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
  const ctx = ac();
  // Short impact thud
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
  const ctx = ac();
  // Short descending zap
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
  const ctx = ac();
  // Gentle wind-down chord
  const g = gain(ctx, 0.12);
  env(ctx, g, 0.05, 0.5, 1);
  osc(ctx, 'sine', 330, g, 0, 0.6);
  osc(ctx, 'sine', 415, gain(ctx, 0.08), 0, 0.6);
  osc(ctx, 'sine', 494, gain(ctx, 0.06), 0.1, 0.5);
}

// ── Music Manager (Web Audio API — works on mobile) ───────────────────────────
//
// HTMLAudioElement.play() called from requestAnimationFrame is always blocked
// by mobile browsers. Web Audio API BufferSourceNodes can be started freely
// once the AudioContext has been created inside a user-gesture handler.

type MusicTrack = 'snackman' | 'stressman' | 'fatman' | 'none';

const MUSIC_URLS: Record<Exclude<MusicTrack, 'none'>, string> = {
  snackman:  'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Snackman.mp3',
  stressman: 'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Stressman.mp3',
  fatman:    'https://raw.githubusercontent.com/Anachonda/Snackman-game/main/public/audio/Fatman.mp3',
};

const MUSIC_VOL = 0.55;
const FADE_STEP = 0.016;  // gain change per ~16ms frame

// Decoded audio buffers — populated by unlockAudio()
const _buffers: Partial<Record<Exclude<MusicTrack, 'none'>, AudioBuffer>> = {};

// Per-track gain nodes (created once the AudioContext exists)
const _gainNodes: Partial<Record<Exclude<MusicTrack, 'none'>, GainNode>> = {};

// Currently playing source nodes
const _sources: Partial<Record<Exclude<MusicTrack, 'none'>, AudioBufferSourceNode>> = {};

// Tracks whose gain nodes are fading out (already stopped as a "current" track)
const _fadingOut: Array<{ gain: GainNode; vol: number }> = [];

let _currentTrack: MusicTrack = 'none';

function _musicAc(): AudioContext | null {
  // Reuse the shared AudioContext if it exists, but never create one here —
  // that must happen inside a user gesture (unlockAudio).
  return _ctx;
}

function _getGain(track: Exclude<MusicTrack, 'none'>): GainNode | null {
  const ctx = _musicAc();
  if (!ctx) return null;
  if (!_gainNodes[track]) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);
    _gainNodes[track] = g;
  }
  return _gainNodes[track]!;
}

function _startSource(track: Exclude<MusicTrack, 'none'>): void {
  const ctx = _musicAc();
  const buf = _buffers[track];
  const gainNode = _getGain(track);
  if (!ctx || !buf || !gainNode) return;

  // Stop any existing source for this track
  const existing = _sources[track];
  if (existing) {
    try { existing.stop(); } catch { /* already stopped */ }
    existing.disconnect();
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gainNode);
  src.start();
  _sources[track] = src;
}

function _stopSource(track: Exclude<MusicTrack, 'none'>): void {
  const src = _sources[track];
  if (src) {
    try { src.stop(); } catch { /* already stopped */ }
    src.disconnect();
    delete _sources[track];
  }
}

// Call once per frame from the game loop.
export function updateMusic(phase: string, health: number, stress: number) {
  let desired: MusicTrack = 'none';
  if (phase === 'playing' || phase === 'paused') {
    if (health < 50)      desired = 'fatman';
    else if (stress >= 50) desired = 'stressman';
    else                   desired = 'snackman';
  }

  if (desired !== _currentTrack) {
    // Move current track to fade-out list
    if (_currentTrack !== 'none') {
      const g = _gainNodes[_currentTrack];
      if (g) {
        _fadingOut.push({ gain: g, vol: g.gain.value });
        // Detach from the gain map so a fresh one is made if this track resumes
        delete _gainNodes[_currentTrack];
      }
      _stopSource(_currentTrack);
    }
    _currentTrack = desired;
    if (desired !== 'none') {
      _startSource(desired);
    }
  }

  // Fade in current track
  if (_currentTrack !== 'none') {
    const g = _getGain(_currentTrack);
    if (g) {
      const target = phase === 'paused' ? 0.12 : MUSIC_VOL;
      const step   = phase === 'paused' ? FADE_STEP * 0.5 : FADE_STEP;
      const cur    = g.gain.value;
      g.gain.value = cur < target
        ? Math.min(target, cur + step)
        : Math.max(target, cur - step);
    }
  }

  // Fade out old tracks and stop them when silent
  for (let i = _fadingOut.length - 1; i >= 0; i--) {
    const item = _fadingOut[i];
    item.vol = Math.max(0, item.vol - FADE_STEP * 1.5);
    item.gain.gain.value = item.vol;
    if (item.vol <= 0) {
      _fadingOut.splice(i, 1);
    }
  }
}

export function stopMusic() {
  for (const track of Object.keys(MUSIC_URLS) as Exclude<MusicTrack, 'none'>[]) {
    _stopSource(track);
    const g = _gainNodes[track];
    if (g) { g.gain.value = 0; delete _gainNodes[track]; }
  }
  _fadingOut.length = 0;
  _currentTrack = 'none';
}

// Call once on first user touch. Creates/resumes the AudioContext and fetches +
// decodes all music tracks so they are ready to play immediately from the game
// loop without any further user-gesture requirement.
export function unlockAudio() {
  // Ensure AudioContext exists and is running
  const ctx = ac();  // creates _ctx if needed, resumes if suspended

  // Fetch and decode each track in parallel
  for (const key of Object.keys(MUSIC_URLS) as Exclude<MusicTrack, 'none'>[]) {
    if (_buffers[key]) continue; // already loaded
    fetch(MUSIC_URLS[key])
      .then(r => r.arrayBuffer())
      .then(ab => ctx.decodeAudioData(ab))
      .then(buf => { _buffers[key] = buf; })
      .catch(() => {/* network error — music stays silent */});
  }
}

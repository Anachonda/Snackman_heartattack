import { useEffect, useRef, useCallback, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { CANVAS_W, CANVAS_H, ENEMIES } from './game/constants';
import { createInitialState, tickEngine, advanceLevel, EngineState } from './game/engine';
import {
  playGoodEat, playBadEat,
  playGhostHit, playEmailHit, playBlobHit,
  playLevelComplete, playHeartAttack, playBurnout,
  playRelax, playTiredPuff, playFootstep, playStressManWarning,
  updateMusic, stopMusic, unlockAudio,
  getMusicEnabled, setMusicEnabled,
} from './game/sounds';
import {
  drawMaze,
  drawEntity,
  drawEnemy,
  drawPlayer,
  drawParticles,
  drawHUD,
  drawTitleScreen,
  drawGameOver,
  drawLevelComplete,
  drawStressMan,
  drawPauseScreen,
  drawPauseButton,
} from './game/renderer';

// Pause overlay button regions (in canvas coords)
const PAUSE_BTN  = { x: CANVAS_W - 48, y: 8, w: 38, h: 26 };
const RESUME_BTN = { x: (CANVAS_W - 280) / 2, y: (CANVAS_H - 240) / 2 + 110, w: 280, h: 48 };
const MENU_BTN   = { x: (CANVAS_W - 280) / 2, y: (CANVAS_H - 240) / 2 + 170, w: 280, h: 48 };

// Game-over screen button regions
const _GO_BW = 220, _GO_BH = 46, _GO_GAP = 20;
const _GO_TOTAL_W = _GO_BW * 2 + _GO_GAP;
const GO_RETRY_BTN = { x: (CANVAS_W - _GO_TOTAL_W) / 2,                    y: 455, w: _GO_BW, h: _GO_BH };
const GO_MENU_BTN  = { x: (CANVAS_W - _GO_TOTAL_W) / 2 + _GO_BW + _GO_GAP, y: 455, w: _GO_BW, h: _GO_BH };

function hitTest(x: number, y: number, r: typeof PAUSE_BTN) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// ── Mobile detection ──────────────────────────────────────────────────────────

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
}

// ── D-pad component ───────────────────────────────────────────────────────────

type DDir = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

interface DPadProps {
  onPress: (dir: DDir) => void;
  onRelease: (dir: DDir) => void;
}

function DPad({ onPress, onRelease }: DPadProps) {
  const activeRef = useRef<Set<DDir>>(new Set());

  function handleTouch(e: React.TouchEvent, dir: DDir, isStart: boolean) {
    e.preventDefault();
    e.stopPropagation();
    if (isStart) {
      if (!activeRef.current.has(dir)) {
        activeRef.current.add(dir);
        onPress(dir);
      }
    } else {
      if (activeRef.current.has(dir)) {
        activeRef.current.delete(dir);
        onRelease(dir);
      }
    }
  }

  function btn(dir: DDir, label: string, style: React.CSSProperties) {
    return (
      <div
        key={dir}
        onTouchStart={e => handleTouch(e, dir, true)}
        onTouchEnd={e => handleTouch(e, dir, false)}
        onTouchCancel={e => handleTouch(e, dir, false)}
        style={{
          position: 'absolute',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(30, 80, 180, 0.45)',
          border: '2px solid rgba(96, 165, 250, 0.7)',
          borderRadius: 8,
          color: 'rgba(186, 220, 255, 0.92)',
          fontSize: 17,
          fontFamily: 'monospace',
          fontWeight: 'bold',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
          cursor: 'pointer',
          ...style,
        }}
      >
        {label}
      </div>
    );
  }

  const S = 40;  // button size
  const G = 5;   // gap
  const pad = S + G;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        left: 'max(12px, env(safe-area-inset-left, 12px))',
        width: pad * 3 - G,
        height: pad * 3 - G,
        pointerEvents: 'auto',
        touchAction: 'none',
        zIndex: 100,
      }}
    >
      {btn('ArrowUp',    '▲', { left: pad,     top: 0 })}
      {btn('ArrowLeft',  '◀', { left: 0,       top: pad })}
      {btn('ArrowDown',  '▼', { left: pad,     top: pad * 2 })}
      {btn('ArrowRight', '▶', { left: pad * 2, top: pad })}
      {/* centre dead-zone */}
      <div style={{
        position: 'absolute', left: pad, top: pad, width: S, height: S,
        background: 'rgba(15, 30, 70, 0.55)',
        border: '2px solid rgba(96,165,250,0.3)',
        borderRadius: 8,
      }} />
    </div>
  );
}

export default function App() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const stateRef    = useRef<EngineState>(createInitialState());
  const rafRef      = useRef<number>(0);
  const frameRef     = useRef(0);
  const mouseRef     = useRef<{ x: number; y: number }>({ x: -1, y: -1 });
  const lastPhaseRef = useRef<string>('title');
  const [isMobile]   = useState(() => isMobileDevice());
  const [musicOn, setMusicOn] = useState(true);
  const [phase, setPhase] = useState<string>('title');

  const toggleMusic = useCallback(() => {
    const next = !getMusicEnabled();
    setMusicEnabled(next);
    setMusicOn(next);
    // On mobile this call happens inside a click handler — that's the user
    // gesture that unlocks HTMLAudioElement autoplay for the session.
    if (next) unlockAudio();
  }, []);

  const startGame = useCallback(() => {
    stateRef.current = createInitialState();
    stateRef.current.gs.phase = 'playing';
  }, []);

  const goToTitle = useCallback(() => {
    stopMusic();
    stateRef.current = createInitialState();
    // phase stays 'title'
  }, []);

  const togglePause = useCallback(() => {
    const gs = stateRef.current.gs;
    if (gs.phase === 'playing') gs.phase = 'paused';
    else if (gs.phase === 'paused') gs.phase = 'playing';
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function loop() {
      const state = stateRef.current;
      const { gs } = state;
      frameRef.current++;

      // Auto-advance after level complete freeze
      if (gs.phase === 'level_complete' && gs.levelCompleteTimer <= 0) {
        stateRef.current = advanceLevel(state);
        stateRef.current.keys = state.keys;
      }

      // Don't tick engine while paused
      if (gs.phase !== 'paused') {
        tickEngine(stateRef.current);
      }
      const s = stateRef.current;

      // ── Sound dispatch ──────────────────────────────────────────────────────
      for (const ev of s.soundEvents) {
        if (ev === 'eat_good')            playGoodEat();
        else if (ev === 'eat_bad')        playBadEat();
        else if (ev === 'hit_ghost')      playGhostHit();
        else if (ev === 'hit_email')      playEmailHit();
        else if (ev === 'hit_blob')       playBlobHit();
        else if (ev === 'level_complete') playLevelComplete();
        else if (ev === 'dead_health')    playHeartAttack();
        else if (ev === 'dead_stress')    playBurnout();
        else if (ev === 'relax')          playRelax();
        else if (ev === 'stressman_hit')  playGhostHit();
      }

      // Music
      updateMusic(s.gs.phase, s.gs.health, s.gs.stress);

      // Continuous / ambient sounds
      const moving = Math.abs(s.playerVel.x) > 0.2 || Math.abs(s.playerVel.y) > 0.2;
      if (s.gs.phase === 'playing' && moving) {
        playFootstep(s.gs.speedBoostTimer > 0);
      }
      if (s.gs.phase === 'playing' && s.gs.health < 35 && moving) {
        playTiredPuff(s.gs.health);
      }
      if (s.gs.phase === 'playing' && s.stressMan) {
        playStressManWarning(s.gs.stress);
      }

      // ── Render ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Sync phase to React state for overlay UI (throttled via ref)
      if (s.gs.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = s.gs.phase;
        setPhase(s.gs.phase);
      }

      const { x: mx, y: my } = mouseRef.current;

      if (s.gs.phase === 'title') {
        drawTitleScreen(ctx, frameRef.current);
      } else {
        drawMaze(ctx);

        const chairs  = s.entities.filter(e => e.kind === 'lazy_chair');
        const foods   = s.entities.filter(e => e.active && e.kind !== 'lazy_chair' && !ENEMIES.includes(e.kind as any));
        const enemies = s.entities.filter(e => e.active && ENEMIES.includes(e.kind as any));

        for (const e of chairs)  drawEntity(ctx, e, frameRef.current);
        for (const e of foods)   drawEntity(ctx, e, frameRef.current);
        for (const e of enemies) drawEnemy(ctx, e, frameRef.current);

        drawParticles(ctx, s.particles);
        drawPlayer(ctx, s.player, s.playerVel, s.gs.speedBoostTimer > 0, s.relaxingChairId !== null, frameRef.current);
        if (s.stressMan) drawStressMan(ctx, s.stressMan.pos, s.gs.stress, frameRef.current);
        drawHUD(ctx, s.gs, frameRef.current);

        // Pause button (shown during play and pause)
        if (s.gs.phase === 'playing' || s.gs.phase === 'paused') {
          drawPauseButton(ctx, hitTest(mx, my, PAUSE_BTN));
        }

        if (s.gs.phase === 'level_complete') {
          drawLevelComplete(ctx, s.gs.level, s.gs.score, frameRef.current);
        } else if (s.gs.phase === 'dead_health' || s.gs.phase === 'dead_stress') {
          drawGameOver(ctx, s.gs.phase, s.gs.score, frameRef.current);
        } else if (s.gs.phase === 'paused') {
          const hovered = hitTest(mx, my, RESUME_BTN) ? 'resume'
                        : hitTest(mx, my, MENU_BTN)   ? 'menu'
                        : null;
          drawPauseScreen(ctx, hovered);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (e.type === 'keydown') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          const p = state.gs.phase;
          if (p === 'playing' || p === 'paused') togglePause();
          return;
        }
        if (e.key === 'Enter') {
          const p = state.gs.phase;
          if (p === 'title' || p === 'dead_health' || p === 'dead_stress') startGame();
          else if (p === 'paused') togglePause();
          return;
        }
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
          e.preventDefault();
        }
        state.keys.add(e.key);
      } else {
        state.keys.delete(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [startGame, togglePause]);

  // Unlock audio on first touch (mobile autoplay policy)
  useEffect(() => {
    if (!isMobile) return;
    const handler = () => {
      unlockAudio();
      document.removeEventListener('touchstart', handler);
    };
    document.addEventListener('touchstart', handler, { once: true });
    return () => document.removeEventListener('touchstart', handler);
  }, [isMobile]);

  // Track mouse position in canvas coords for hover effects
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    mouseRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1, y: -1 };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;

    const p = stateRef.current.gs.phase;

    if (p === 'title') {
      startGame();
      return;
    }
    if (p === 'dead_health' || p === 'dead_stress') {
      if (hitTest(cx, cy, GO_MENU_BTN)) {
        goToTitle();
      } else {
        startGame();
      }
      return;
    }
    if (p === 'playing' && hitTest(cx, cy, PAUSE_BTN)) {
      togglePause();
      return;
    }
    if (p === 'paused') {
      if (hitTest(cx, cy, PAUSE_BTN) || hitTest(cx, cy, RESUME_BTN)) {
        togglePause();
      } else if (hitTest(cx, cy, MENU_BTN)) {
        goToTitle();
      }
    }
  }, [startGame, togglePause, goToTitle]);

  // Handle touch taps on the canvas — translates to canvas coords and fires the
  // same hit-test logic as handleClick so the pause button works on mobile.
  const handleCanvasTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (touch.clientX - rect.left) * scaleX;
    const cy = (touch.clientY - rect.top)  * scaleY;

    const p = stateRef.current.gs.phase;

    if (p === 'title') {
      startGame();
      return;
    }
    if (p === 'dead_health' || p === 'dead_stress') {
      if (hitTest(cx, cy, GO_MENU_BTN)) goToTitle();
      else startGame();
      return;
    }
    if (p === 'playing' && hitTest(cx, cy, PAUSE_BTN)) {
      togglePause();
      return;
    }
    if (p === 'paused') {
      if (hitTest(cx, cy, PAUSE_BTN) || hitTest(cx, cy, RESUME_BTN)) {
        togglePause();
      } else if (hitTest(cx, cy, MENU_BTN)) {
        goToTitle();
      }
    }
  }, [startGame, togglePause, goToTitle]);

  const handleDPadPress = useCallback((dir: DDir) => {
    stateRef.current.keys.add(dir);
    const p = stateRef.current.gs.phase;
    if (p === 'title' || p === 'dead_health' || p === 'dead_stress') startGame();
  }, [startGame]);

  const handleDPadRelease = useCallback((dir: DDir) => {
    stateRef.current.keys.delete(dir);
  }, []);

  const aspectRatio = CANVAS_W / CANVAS_H;

  // Prevent page scroll when touching the canvas on mobile
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !isMobile) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove',  prevent, { passive: false });
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove',  prevent);
    };
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center select-none p-2">
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleClick}
          onTouchEnd={isMobile ? handleCanvasTouch : undefined}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="block rounded-xl shadow-2xl cursor-pointer border border-blue-900"
          style={{
            width: `min(95vw, calc(95vh * ${aspectRatio}))`,
            height: `min(95vh, calc(95vw / ${aspectRatio}))`,
            touchAction: 'none',
          }}
        />
        {phase === 'title' && (
          <button
            onClick={e => { e.stopPropagation(); toggleMusic(); }}
            onTouchEnd={e => { e.stopPropagation(); toggleMusic(); }}
            style={{ position: 'absolute', bottom: '4%', right: '3%' }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
              transition-all duration-150 select-none
              ${musicOn
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
          >
            {musicOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {musicOn ? 'Music ON' : 'Music OFF'}
          </button>
        )}
      </div>
      {!isMobile && (
        <p className="mt-2 text-gray-600 text-xs font-mono text-center">
          WASD / ARROW KEYS to move &nbsp;·&nbsp; Stand still near a couch to chill &nbsp;·&nbsp; ESC to pause
        </p>
      )}
      {isMobile && <DPad onPress={handleDPadPress} onRelease={handleDPadRelease} />}
    </div>
  );
}

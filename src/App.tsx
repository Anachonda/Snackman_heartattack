import { useEffect, useRef, useCallback, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import GameOverOverlay from './GameOverOverlay';
import { CANVAS_W, CANVAS_H, ENEMIES } from './game/constants';
import { createInitialState, tickEngine, advanceLevel, EngineState } from './game/engine';
import {
  initMusic, initSfx, updateMusic, stopMusic,
  getMusicEnabled, setMusicEnabled,
  playSfxGoodEat, playSfxBadEat, playSfxEnemyHit,
  playSfxLevelComplete, playSfxDead,
} from './game/sounds';
import {
  drawMaze,
  drawEntity,
  drawEnemy,
  drawPlayer,
  drawParticles,
  drawHUD,
  drawTitleScreen,
  drawLevelComplete,
  drawStressMan,
  drawPauseScreen,
  drawPauseButton,
} from './game/renderer';

// Pause overlay button regions (in canvas coords)
const PAUSE_BTN  = { x: CANVAS_W - 48, y: 8, w: 38, h: 26 };
const RESUME_BTN = { x: (CANVAS_W - 280) / 2, y: (CANVAS_H - 240) / 2 + 110, w: 280, h: 48 };
const MENU_BTN   = { x: (CANVAS_W - 280) / 2, y: (CANVAS_H - 240) / 2 + 170, w: 280, h: 48 };

function hitTest(x: number, y: number, r: typeof PAUSE_BTN) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// ── Mobile detection ──────────────────────────────────────────────────────────

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) ||
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
}

// ── Joystick D-pad component ──────────────────────────────────────────────────

type DDir = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

interface DPadProps {
  onPress: (dir: DDir) => void;
  onRelease: (dir: DDir) => void;
}

const JOYSTICK_R = 72;
const DEAD_ZONE  = 0.28;

function dirFromAngle(dx: number, dy: number): DDir | null {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < JOYSTICK_R * DEAD_ZONE) return null;
  const angle = Math.atan2(dy, dx);
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45)  return 'ArrowRight';
  if (deg >= 45  && deg < 135) return 'ArrowDown';
  if (deg >= 135 && deg < 225) return 'ArrowLeft';
  return 'ArrowUp';
}

function DPad({ onPress, onRelease }: DPadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDir    = useRef<DDir | null>(null);

  function updateDir(touch: React.Touch | Touch) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dir  = dirFromAngle(touch.clientX - cx, touch.clientY - cy);

    if (dir !== activeDir.current) {
      if (activeDir.current) onRelease(activeDir.current);
      activeDir.current = dir;
      if (dir) onPress(dir);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    updateDir(e.changedTouches[0]);
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    updateDir(e.changedTouches[0]);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (activeDir.current) {
      onRelease(activeDir.current);
      activeDir.current = null;
    }
  }

  const D = JOYSTICK_R * 2;
  const arrowInset = 14;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        position: 'fixed',
        bottom: `max(18px, env(safe-area-inset-bottom, 18px))`,
        left: `max(18px, env(safe-area-inset-left, 18px))`,
        width: D,
        height: D,
        borderRadius: '50%',
        background: 'rgba(20, 30, 60, 0.55)',
        border: '2px solid rgba(140, 170, 255, 0.35)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        pointerEvents: 'auto',
        touchAction: 'none',
        zIndex: 100,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <svg style={{ position: 'absolute', top: arrowInset, left: '50%', transform: 'translateX(-50%)' }}
        width={22} height={18} viewBox="0 0 22 18">
        <polygon points="11,0 22,18 0,18" fill="rgba(180,210,255,0.65)" />
      </svg>
      <svg style={{ position: 'absolute', bottom: arrowInset, left: '50%', transform: 'translateX(-50%)' }}
        width={22} height={18} viewBox="0 0 22 18">
        <polygon points="11,18 22,0 0,0" fill="rgba(180,210,255,0.65)" />
      </svg>
      <svg style={{ position: 'absolute', left: arrowInset, top: '50%', transform: 'translateY(-50%)' }}
        width={18} height={22} viewBox="0 0 18 22">
        <polygon points="0,11 18,0 18,22" fill="rgba(180,210,255,0.65)" />
      </svg>
      <svg style={{ position: 'absolute', right: arrowInset, top: '50%', transform: 'translateY(-50%)' }}
        width={18} height={22} viewBox="0 0 18 22">
        <polygon points="18,11 0,0 0,22" fill="rgba(180,210,255,0.65)" />
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 18, height: 18,
        borderRadius: '50%',
        background: 'rgba(140,170,255,0.25)',
        border: '1.5px solid rgba(140,170,255,0.4)',
      }} />
    </div>
  );
}

// ── Tap to Start overlay ──────────────────────────────────────────────────────

interface TapToStartProps {
  onStart: () => void;
}

function TapToStart({ onStart }: TapToStartProps) {
  return (
    <div
      onClick={onStart}
      onTouchEnd={e => { e.preventDefault(); onStart(); }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 8, 20, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div style={{
        textAlign: 'center',
        padding: '2.5rem 3rem',
        borderRadius: '1.25rem',
        border: '1px solid rgba(100,140,255,0.25)',
        background: 'rgba(10,18,45,0.7)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
        maxWidth: 340,
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '0.5rem',
          lineHeight: 1,
          filter: 'drop-shadow(0 0 18px rgba(100,160,255,0.5))',
        }}>
          🎮
        </div>
        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#e2eaff',
          margin: '0 0 0.4rem',
          letterSpacing: '0.02em',
        }}>
          Snackman
        </h1>
        <p style={{
          fontSize: '0.85rem',
          color: '#7090c0',
          margin: '0 0 2rem',
          lineHeight: 1.5,
        }}>
          Eat healthy, dodge stress, survive.
        </p>
        <div style={{
          display: 'inline-block',
          padding: '0.75rem 2.2rem',
          borderRadius: '0.65rem',
          background: 'rgba(50,100,220,0.85)',
          color: '#e8f0ff',
          fontSize: '1.05rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          boxShadow: '0 2px 18px rgba(50,100,220,0.45)',
          animation: 'tapPulse 1.8s ease-in-out infinite',
        }}>
          TAP TO START
        </div>
      </div>
      <style>{`
        @keyframes tapPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.97); }
        }
      `}</style>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const stateRef     = useRef<EngineState>(createInitialState());
  const rafRef       = useRef<number>(0);
  const frameRef     = useRef(0);
  const mouseRef     = useRef<{ x: number; y: number }>({ x: -1, y: -1 });
  const lastPhaseRef = useRef<string>('title');
  const [isMobile]   = useState(() => isMobileDevice());
  const [musicOn, setMusicOn] = useState(true);
  const [phase, setPhase] = useState<string>('title');
  const [gameOverGs, setGameOverGs] = useState<import('./game/types').GameState | null>(null);
  // showTap stays true until the first real user interaction
  const [showTap, setShowTap] = useState(true);
  const audioUnlockedRef = useRef(false);

  const handleTapToStart = useCallback(() => {
    initSfx();
    initMusic();
    audioUnlockedRef.current = true;
    setShowTap(false);
    stateRef.current.gs.phase = 'playing';
    setGameOverGs(null);
    setPhase('playing');
    lastPhaseRef.current = 'playing';
  }, []);

  const toggleMusic = useCallback(() => {
    const next = !getMusicEnabled();
    setMusicEnabled(next);
    setMusicOn(next);
  }, []);

  const startGame = useCallback(() => {
    stateRef.current = createInitialState();
    stateRef.current.gs.phase = 'playing';
    setGameOverGs(null);
  }, []);

  const goToTitle = useCallback(() => {
    stopMusic();
    stateRef.current = createInitialState();
    setGameOverGs(null);
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

      if (gs.phase === 'level_complete' && gs.levelCompleteTimer <= 0) {
        stateRef.current = advanceLevel(state);
        stateRef.current.keys = state.keys;
      }

      if (gs.phase !== 'paused') {
        tickEngine(stateRef.current);
      }
      const s = stateRef.current;

      // Audio (only after user has unlocked audio via tap)
      if (audioUnlockedRef.current) {
        updateMusic(s.gs.phase, s.gs.stress);
        for (const ev of s.sfxQueue) {
          if (ev === 'eat_good')      playSfxGoodEat();
          else if (ev === 'eat_bad')  playSfxBadEat();
          else if (ev === 'enemy_hit') playSfxEnemyHit();
          else if (ev === 'level_complete') playSfxLevelComplete();
          else if (ev === 'dead')     playSfxDead();
        }
      }

      // Sync phase to React state
      if (s.gs.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = s.gs.phase;
        setPhase(s.gs.phase);
        if (s.gs.phase === 'dead_health' || s.gs.phase === 'dead_stress') {
          setGameOverGs({ ...s.gs });
        }
      }

      // ── Render ──────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

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

        if (s.gs.phase === 'playing' || s.gs.phase === 'paused') {
          drawPauseButton(ctx, hitTest(mx, my, PAUSE_BTN));
        }

        if (s.gs.phase === 'level_complete') {
          drawLevelComplete(ctx, s.gs.level, s.gs.score, frameRef.current);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (e.type === 'keydown') {
        // First key interaction also counts as the tap-to-start gesture
        if (showTap) {
          initSfx();
          initMusic();
          audioUnlockedRef.current = true;
          setShowTap(false);
          state.gs.phase = 'playing';
          setPhase('playing');
          lastPhaseRef.current = 'playing';
          return;
        }
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          const p = state.gs.phase;
          if (p === 'playing' || p === 'paused') togglePause();
          return;
        }
        if (e.key === 'Enter') {
          const p = state.gs.phase;
          if (p === 'title') startGame();
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
  }, [showTap, startGame, togglePause]);

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
    if (showTap) return; // handled by TapToStart overlay
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;

    const p = stateRef.current.gs.phase;

    if (p === 'title') { startGame(); return; }
    if (p === 'dead_health' || p === 'dead_stress') return;
    if (p === 'playing' && hitTest(cx, cy, PAUSE_BTN)) { togglePause(); return; }
    if (p === 'paused') {
      if (hitTest(cx, cy, PAUSE_BTN) || hitTest(cx, cy, RESUME_BTN)) togglePause();
      else if (hitTest(cx, cy, MENU_BTN)) goToTitle();
    }
  }, [showTap, startGame, togglePause, goToTitle]);

  const handleCanvasTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (showTap) return;
    const canvas = canvasRef.current;
    if (!canvas || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (touch.clientX - rect.left) * scaleX;
    const cy = (touch.clientY - rect.top)  * scaleY;

    const p = stateRef.current.gs.phase;

    if (p === 'title') { startGame(); return; }
    if (p === 'dead_health' || p === 'dead_stress') return;
    if (p === 'playing' && hitTest(cx, cy, PAUSE_BTN)) { togglePause(); return; }
    if (p === 'paused') {
      if (hitTest(cx, cy, PAUSE_BTN) || hitTest(cx, cy, RESUME_BTN)) togglePause();
      else if (hitTest(cx, cy, MENU_BTN)) goToTitle();
    }
  }, [showTap, startGame, togglePause, goToTitle]);

  const handleDPadPress = useCallback((dir: DDir) => {
    stateRef.current.keys.add(dir);
    const p = stateRef.current.gs.phase;
    if (p === 'title') startGame();
  }, [startGame]);

  const handleDPadRelease = useCallback((dir: DDir) => {
    stateRef.current.keys.delete(dir);
  }, []);

  const aspectRatio = CANVAS_W / CANVAS_H;

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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center select-none p-2" style={{ touchAction: 'manipulation' }}>
      {showTap && <TapToStart onStart={handleTapToStart} />}
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
        {gameOverGs && (
          <GameOverOverlay
            gs={gameOverGs}
            onRetry={startGame}
            onMenu={goToTitle}
          />
        )}
        {!showTap && phase === 'title' && (
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
      {isMobile && !showTap && <DPad onPress={handleDPadPress} onRelease={handleDPadRelease} />}
    </div>
  );
}

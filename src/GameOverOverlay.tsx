import { useEffect, useState } from 'react';
import { Trophy, Heart, Zap, Clock, Leaf, RotateCcw, Home } from 'lucide-react';
import { GameState } from './game/types';

interface Props {
  gs: GameState;
  onRetry: () => void;
  onMenu: () => void;
}

interface StatRow {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

function formatTime(frames: number): string {
  const totalSec = Math.floor(frames / 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const QUOTES_HEALTH = [
  '"Have you considered a salad?" — Your Doctor',
  '"The only cardio you did was running from ghosts." — Your Trainer',
  '"Your heart had enough." — Cardiologist',
];
const QUOTES_STRESS = [
  '"Burnout: achieved." — LinkedIn',
  '"Even your cortisol filed for sick leave." — HR',
  '"You need a vacation. Or twelve." — Your Therapist',
];

export default function GameOverOverlay({ gs, onRetry, onMenu }: Props) {
  const [visible, setVisible] = useState(false);
  const isDead = gs.phase === 'dead_health' || gs.phase === 'dead_stress';
  const isHealth = gs.phase === 'dead_health';

  useEffect(() => {
    if (isDead) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isDead]);

  if (!isDead || !visible) return null;

  const quote = isHealth
    ? QUOTES_HEALTH[gs.score % QUOTES_HEALTH.length]
    : QUOTES_STRESS[gs.score % QUOTES_STRESS.length];

  const stats: StatRow[] = [
    {
      icon: <Trophy size={18} />,
      label: 'Final Score',
      value: gs.score.toLocaleString(),
      color: '#facc15',
    },
    {
      icon: <Leaf size={18} />,
      label: 'Level Reached',
      value: `Level ${gs.level}`,
      color: '#4ade80',
    },
    {
      icon: <Clock size={18} />,
      label: 'Time Survived',
      value: formatTime(gs.time),
      color: '#60a5fa',
    },
    {
      icon: <Heart size={18} />,
      label: 'Health at End',
      value: `${Math.round(gs.health)}%`,
      color: gs.health < 30 ? '#f87171' : '#fb923c',
    },
    {
      icon: <Zap size={18} />,
      label: 'Stress at End',
      value: `${Math.round(gs.stress)}%`,
      color: gs.stress > 70 ? '#f87171' : '#fb923c',
    },
    {
      icon: <Leaf size={18} />,
      label: 'Healthy Picks (last level)',
      value: `${gs.healthyCollected} / ${gs.healthyGoal}`,
      color: '#34d399',
    },
  ];

  const accentColor = isHealth ? '#ef4444' : '#f97316';
  const bgGradient  = isHealth
    ? 'linear-gradient(160deg, #1a0000 0%, #2d0808 60%, #1a0a00 100%)'
    : 'linear-gradient(160deg, #0f0800 0%, #2d1a00 60%, #1a1000 100%)';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        animation: 'goFadeIn 0.25s ease-out both',
        zIndex: 20,
        borderRadius: 'inherit',
      }}
    >
      <style>{`
        @keyframes goFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes goSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .go-stat-row {
          animation: goSlideUp 0.3s ease-out both;
        }
      `}</style>

      <div
        style={{
          background: bgGradient,
          border: `1.5px solid ${accentColor}55`,
          borderRadius: 18,
          padding: '28px 32px 24px',
          width: 'min(480px, 90vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: `0 0 60px ${accentColor}33, 0 8px 40px rgba(0,0,0,0.7)`,
          fontFamily: 'monospace',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 13,
            letterSpacing: '0.2em',
            color: accentColor,
            marginBottom: 4,
            textTransform: 'uppercase',
          }}>
            {isHealth ? 'Heart Attack' : 'Burnout'}
          </div>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            color: '#fef2f2',
            textShadow: `0 0 24px ${accentColor}`,
            lineHeight: 1.1,
          }}>
            GAME OVER
          </div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 12,
          padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="go-stat-row"
              style={{
                animationDelay: `${0.05 + i * 0.06}s`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingBottom: i < stats.length - 1 ? 10 : 0,
                borderBottom: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                {s.label}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: s.color, whiteSpace: 'nowrap' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#475569',
          fontStyle: 'italic',
          lineHeight: 1.5,
          padding: '0 4px',
        }}>
          {quote}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '13px 0',
              borderRadius: 10,
              background: '#14532d',
              border: '1.5px solid #16a34a',
              color: '#4ade80',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: '0 0 12px #16a34a44',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#166534')}
            onMouseLeave={e => (e.currentTarget.style.background = '#14532d')}
          >
            <RotateCcw size={16} /> Retry
          </button>
          <button
            onClick={onMenu}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '13px 0',
              borderRadius: 10,
              background: '#1e3a5f',
              border: '1.5px solid #2563eb',
              color: '#93c5fd',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'background 0.15s, box-shadow 0.15s',
              boxShadow: '0 0 12px #2563eb44',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e40af')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e3a5f')}
          >
            <Home size={16} /> Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

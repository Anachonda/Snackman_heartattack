export type EntityKind =
  | 'player'
  | 'salmon' | 'broccoli' | 'nuts'
  | 'donut' | 'fries' | 'cigarette'
  | 'deadline_ghost' | 'email_monster' | 'cholesterol_blob'
  | 'lazy_chair';

export interface Vec2 { x: number; y: number; }

export interface Entity {
  id: number;
  kind: EntityKind;
  pos: Vec2;        // tile-center world coords
  vel: Vec2;
  radius: number;
  active: boolean;
}

export interface Particle {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  text?: string;
  size: number;
}

export type GamePhase = 'title' | 'playing' | 'paused' | 'level_complete' | 'dead_health' | 'dead_stress';

export type SoundEvent =
  | 'eat_good'
  | 'eat_bad'
  | 'hit_ghost'
  | 'hit_email'
  | 'hit_blob'
  | 'level_complete'
  | 'dead_health'
  | 'dead_stress'
  | 'relax'
  | 'stressman_hit';

export interface StressMan {
  pos: Vec2;
  vel: Vec2;
}

export interface GameState {
  phase: GamePhase;
  health: number;
  stress: number;
  score: number;
  level: number;
  healthyCollected: number;    // this level
  healthyGoal: number;         // goal this level (always 10)
  speedBoostTimer: number;
  slowTimer: number;           // frames of post-sugar slowdown
  relaxTimer: number;
  time: number;
  levelCompleteTimer: number;  // freeze frames after level complete
  permSpeedBonus: number;      // permanent speed bonus from healthy foods (0..1)
  cigaretteStressTimer: number; // delayed stress ticks remaining after smoking
  _sugarCrashPending: boolean; // true when current boost will end in a sugar crash
}

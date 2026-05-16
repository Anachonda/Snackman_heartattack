// Canvas & tile dimensions
export const CANVAS_W = 800;
export const CANVAS_H = 680;
export const TILE = 40;         // tile size in pixels
export const HUD_H = 72;        // pixels reserved at top for HUD

// Maze dimensions in tiles
export const MAZE_COLS = 20;
export const MAZE_ROWS = 15;    // rows below HUD

// Pixel origin of maze
export const MAZE_X = 0;
export const MAZE_Y = HUD_H;

// Player
export const PLAYER_SPEED = 2.8;
export const PLAYER_RADIUS = 14;
export const SPEED_BOOST_MULT = 1.85;
export const SPEED_BOOST_DURATION = 300;

// Enemies
export const GHOST_SPEED = 1.55;   // faster, more aggressive
export const EMAIL_SPEED = 1.25;
export const BLOB_SPEED = 0.85;

// Stress-man (shadow self)
export const STRESS_MAN_THRESHOLD = 70;  // stress % at which stress-man spawns
export const STRESS_MAN_SPEED     = 1.9; // slightly faster than player walk

// Health / stress
export const HEALTH_DRAIN_RATE   = 0.010;
export const STRESS_CREEP        = 0.018;  // passive build-up even without bad habits
export const STRESS_GAIN_GHOST   = 28;     // doubled — ghosts are devastating
export const STRESS_GAIN_EMAIL   = 20;
export const STRESS_GAIN_BLOB    = 16;
export const STRESS_GAIN_UNHEALTHY = 12;  // bigger penalty
export const HEALTH_GAIN_HEALTHY = 14;
export const HEALTH_LOSS_UNHEALTHY = 14;  // bigger penalty
export const STRESS_REDUCE_CHAIR = 0.40;
export const RELAX_DURATION      = 180;

// Spawning
export const SPAWN_INTERVAL_FOOD  = 160;
export const SPAWN_INTERVAL_ENEMY = 400;
export const MAX_FOODS   = 12;
export const MAX_ENEMIES = 3;  // level 1 baseline; capped at 5 via maxEnemiesForLevel

export const HEALTHY_FOODS   = ['salmon', 'broccoli', 'nuts'] as const;
export const UNHEALTHY_FOODS = ['donut', 'fries', 'cigarette'] as const;
export const SUGARY_FOODS    = ['donut', 'fries'] as const;  // get boost + slowdown
export const ENEMIES         = ['deadline_ghost', 'email_monster', 'cholesterol_blob'] as const;

export const SCORE_HEALTHY   = 50;
export const SCORE_UNHEALTHY = 10;

// Food spawning rules
export const MIN_HEALTHY_ON_SCREEN = 3;    // always keep at least this many healthy foods visible
export const FOOD_MIN_SEPARATION   = 44;   // min px between any two food items (prevents overlap)
export const FOOD_CHAIR_CLEARANCE  = 36;   // unhealthy food must be at least this far from a chair center

// Spawn pool weights (higher = more frequent)
export const WEIGHT_SALMON    = 4;
export const WEIGHT_BROCCOLI  = 4;
export const WEIGHT_NUTS      = 4;
export const WEIGHT_DONUT     = 3;
export const WEIGHT_FRIES     = 3;
export const WEIGHT_CIGARETTE = 1;  // rare

// Permanent speed bonus per healthy food eaten (additive, capped)
export const PERM_SPEED_PER_HEALTHY = 0.04;
export const PERM_SPEED_MAX         = 0.6;  // cap at +60% of base speed

// Sugar rush: boost then slowdown
export const SUGAR_SLOW_MULT     = 0.45;  // speed multiplier during slowdown
export const SUGAR_SLOW_DURATION = 200;   // frames of slowdown after boost ends

// Cigarette: health loss + delayed stress
export const CIGARETTE_HEALTH_LOSS   = 20;
export const CIGARETTE_STRESS_DELAY  = 300; // frames before delayed stress kicks in
export const CIGARETTE_STRESS_AMOUNT = 20;

// Progression
export const HEALTHY_GOAL        = 10;   // healthy foods needed per level
export const LEVEL_COMPLETE_FREEZE = 150; // frames to freeze on level complete

// Per-level scaling (applied each new level)
export const LEVEL_ENEMY_SPEED_BONUS  = 0.18;  // added to base enemy speed per level
export const LEVEL_STRESS_GAIN_BONUS  = 2;     // added to all stress-hit values per level
export const LEVEL_MAX_ENEMIES_BONUS  = 1;     // one extra max enemy per level: L1=3, L2=4, L3=5…
// AI aggression per level: trackWeight and noise factors are adjusted in engine
export const LEVEL_TRACK_WEIGHT_BASE  = 0.10;  // level 1 player-tracking blend weight
export const LEVEL_TRACK_WEIGHT_BONUS = 0.08;  // added per level — enemies get smarter faster now that count is capped
export const LEVEL_NOISE_BASE         = 0.30;  // level 1 random wander noise
export const LEVEL_NOISE_BONUS        = 0.10;  // subtracted per level (less random = smarter)

// Maze grid: 1 = wall, 0 = path
// 20 cols × 15 rows
export const MAZE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,1,1,0,1,1,1,0,0,0,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1],
  [0,1,1,1,0,1,1,1,0,0,0,0,1,1,1,0,1,1,1,0],  // tunnel row: open left & right edges
  [1,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,0,0,0,1,1,1,0,1,1,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

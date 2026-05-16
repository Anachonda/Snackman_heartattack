import { Entity, EntityKind, GameState, GamePhase, Particle, StressMan, Vec2 } from './types';
import {
  TILE, MAZE_X, MAZE_Y, MAZE_COLS, MAZE_ROWS,
  PLAYER_SPEED, PLAYER_RADIUS, SPEED_BOOST_MULT, SPEED_BOOST_DURATION,
  GHOST_SPEED, EMAIL_SPEED, BLOB_SPEED,
  HEALTH_DRAIN_RATE, STRESS_CREEP,
  STRESS_GAIN_GHOST, STRESS_GAIN_EMAIL, STRESS_GAIN_BLOB, STRESS_GAIN_UNHEALTHY,
  HEALTH_GAIN_HEALTHY, HEALTH_LOSS_UNHEALTHY,
  STRESS_REDUCE_CHAIR, RELAX_DURATION,
  SPAWN_INTERVAL_FOOD, SPAWN_INTERVAL_ENEMY,
  MAX_ENEMIES,
  HEALTHY_FOODS, UNHEALTHY_FOODS, SUGARY_FOODS, ENEMIES,
  SCORE_HEALTHY, SCORE_UNHEALTHY,
  HEALTHY_GOAL, LEVEL_COMPLETE_FREEZE,
  LEVEL_ENEMY_SPEED_BONUS, LEVEL_STRESS_GAIN_BONUS, LEVEL_MAX_ENEMIES_BONUS,
  STRESS_MAN_THRESHOLD, STRESS_MAN_SPEED,
  MIN_HEALTHY_ON_SCREEN, FOOD_MIN_SEPARATION, FOOD_CHAIR_CLEARANCE,
  WEIGHT_SALMON, WEIGHT_BROCCOLI, WEIGHT_NUTS, WEIGHT_DONUT, WEIGHT_FRIES, WEIGHT_CIGARETTE,
  PERM_SPEED_PER_HEALTHY, PERM_SPEED_MAX,
  SUGAR_SLOW_MULT, SUGAR_SLOW_DURATION,
  CIGARETTE_HEALTH_LOSS, CIGARETTE_STRESS_DELAY, CIGARETTE_STRESS_AMOUNT,
  LEVEL_TRACK_WEIGHT_BASE, LEVEL_TRACK_WEIGHT_BONUS,
  LEVEL_NOISE_BASE, LEVEL_NOISE_BONUS,
} from './constants';
import { spawnParticle, tileCenter, isWall, uid } from './renderer';

// ── Utilities ─────────────────────────────────────────────────────────────────

function dist(a: Vec2, b: Vec2) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function randPath(): Vec2 {
  let tries = 0;
  while (tries < 200) {
    const col = Math.floor(Math.random() * MAZE_COLS);
    const row = Math.floor(1 + Math.random() * (MAZE_ROWS - 2));
    if (!isWall(col, row)) return tileCenter(col, row);
    tries++;
  }
  return tileCenter(1, 1);
}

function randEdgePath(): Vec2 {
  const candidates: Vec2[] = [];
  for (let col = 0; col < MAZE_COLS; col++) {
    if (!isWall(col, 1)) candidates.push(tileCenter(col, 1));
    if (!isWall(col, MAZE_ROWS - 2)) candidates.push(tileCenter(col, MAZE_ROWS - 2));
  }
  for (let row = 1; row < MAZE_ROWS - 1; row++) {
    if (!isWall(1, row)) candidates.push(tileCenter(1, row));
    if (!isWall(MAZE_COLS - 2, row)) candidates.push(tileCenter(MAZE_COLS - 2, row));
  }
  if (candidates.length === 0) return randPath();
  return { ...candidates[Math.floor(Math.random() * candidates.length)] };
}

// ── Level scaling helpers ─────────────────────────────────────────────────────

function enemySpeed(baseSpeed: number, level: number): number {
  return baseSpeed + (level - 1) * LEVEL_ENEMY_SPEED_BONUS;
}

function stressGain(base: number, level: number): number {
  return base + (level - 1) * LEVEL_STRESS_GAIN_BONUS;
}

function maxEnemiesForLevel(level: number): number {
  return Math.min(10, MAX_ENEMIES + (level - 1) * LEVEL_MAX_ENEMIES_BONUS);
}

// ── Fixed chair positions ─────────────────────────────────────────────────────

const CHAIR_TILES: [number, number][] = [
  [1, 1], [18, 1], [1, 13], [18, 13], [9, 7],
];

// ── Wall collision ────────────────────────────────────────────────────────────

function resolveWallCollision(pos: Vec2, vel: Vec2, radius: number): { pos: Vec2; vel: Vec2 } {
  let { x, y } = pos;
  let { x: vx, y: vy } = vel;

  const probes = [
    { dx:  radius, dy: 0 },
    { dx: -radius, dy: 0 },
    { dx: 0, dy:  radius },
    { dx: 0, dy: -radius },
  ];

  for (const { dx, dy } of probes) {
    const px = x + dx;
    const py = y + dy;
    const col = Math.floor((px - MAZE_X) / TILE);
    const row = Math.floor((py - MAZE_Y) / TILE);
    if (isWall(col, row)) {
      const wallLeft   = MAZE_X + col * TILE;
      const wallRight  = wallLeft + TILE;
      const wallTop    = MAZE_Y + row * TILE;
      const wallBottom = wallTop + TILE;

      if (dx > 0) { x = wallLeft - radius - 0.5;   vx = Math.min(vx, 0); }
      if (dx < 0) { x = wallRight + radius + 0.5;  vx = Math.max(vx, 0); }
      if (dy > 0) { y = wallTop - radius - 0.5;    vy = Math.min(vy, 0); }
      if (dy < 0) { y = wallBottom + radius + 0.5; vy = Math.max(vy, 0); }
    }
  }

  return { pos: { x, y }, vel: { x: vx, y: vy } };
}

// ── State factory ─────────────────────────────────────────────────────────────

export type EngineState = ReturnType<typeof createInitialState>;

export function createInitialState() {
  return _buildState(1, 0, 100, 0);
}

function _buildState(
  level: number,
  carryScore: number,
  carryHealth: number,
  carryStress: number
): EngineState {
  const entities: Entity[] = [];

  // Chairs
  for (const [col, row] of CHAIR_TILES) {
    entities.push({
      id: uid(), kind: 'lazy_chair',
      pos: tileCenter(col, row), vel: { x: 0, y: 0 },
      radius: 24, active: true,
    });
  }

  // Seed food — ensure at least MIN_HEALTHY_ON_SCREEN healthy items from the start
  for (let i = 0; i < MIN_HEALTHY_ON_SCREEN; i++) _spawnFood(entities, true);
  for (let i = 0; i < 3; i++) _spawnFood(entities);

  // Spawn exactly the level's max enemy count, one of each type then cycle
  const startingEnemyCount = maxEnemiesForLevel(level);
  for (let i = 0; i < startingEnemyCount; i++) {
    const kind = ENEMIES[i % ENEMIES.length] as EntityKind;
    _spawnEnemy(entities, kind, level);
  }

  return {
    gs: {
      phase: 'title' as GamePhase,
      health: carryHealth,
      stress: carryStress,
      score: carryScore,
      level,
      healthyCollected: 0,
      healthyGoal: HEALTHY_GOAL,
      speedBoostTimer: 0,
      slowTimer: 0,
      relaxTimer: 0,
      time: 0,
      levelCompleteTimer: 0,
      permSpeedBonus: 0,
      cigaretteStressTimer: 0,
      _sugarCrashPending: false,
    } as GameState,
    player: tileCenter(10, 7),
    playerVel: { x: 0, y: 0 } as Vec2,
    entities,
    particles: [] as Particle[],
    spawnFoodTimer: 0,
    spawnEnemyTimer: 0,
    keys: new Set<string>(),
    relaxingChairId: null as number | null,
    _respawnQ: [] as { kind: EntityKind; delay: number }[],
    stressMan: null as StressMan | null,
    sfxQueue: [] as string[],
    level,
  };
}

// Weighted pool: [kind, weight]
const FOOD_POOL: [EntityKind, number][] = [
  ['salmon',    WEIGHT_SALMON],
  ['broccoli',  WEIGHT_BROCCOLI],
  ['nuts',      WEIGHT_NUTS],
  ['donut',     WEIGHT_DONUT],
  ['fries',     WEIGHT_FRIES],
  ['cigarette', WEIGHT_CIGARETTE],
];

const UNHEALTHY_FOOD_SET = new Set<string>(UNHEALTHY_FOODS);
const HEALTHY_FOOD_SET   = new Set<string>(HEALTHY_FOODS);

const CHAIR_POSITIONS: Vec2[] = CHAIR_TILES.map(([col, row]) => tileCenter(col, row));

// Minimum distance an unhealthy item must keep from any healthy item
const UNHEALTHY_HEALTHY_CLEARANCE = 80;

function _isClearForFood(pos: Vec2, kind: EntityKind, existing: Entity[]): boolean {
  for (const e of existing) {
    if (!e.active) continue;
    if (HEALTHY_FOOD_SET.has(e.kind) || UNHEALTHY_FOOD_SET.has(e.kind)) {
      if (dist(pos, e.pos) < FOOD_MIN_SEPARATION) return false;
    }
  }
  // Unhealthy food must not spawn near chairs
  if (UNHEALTHY_FOOD_SET.has(kind) || kind === 'cigarette') {
    for (const cp of CHAIR_POSITIONS) {
      if (dist(pos, cp) < FOOD_CHAIR_CLEARANCE) return false;
    }
    // Unhealthy food must not cluster around healthy food (keeps a safe corridor to healthy items)
    for (const e of existing) {
      if (!e.active) continue;
      if (HEALTHY_FOOD_SET.has(e.kind) && dist(pos, e.pos) < UNHEALTHY_HEALTHY_CLEARANCE) return false;
    }
  }
  // Healthy food must not spawn next to unhealthy food (so healthy is always accessible without touching bad items)
  if (HEALTHY_FOOD_SET.has(kind)) {
    for (const e of existing) {
      if (!e.active) continue;
      if ((UNHEALTHY_FOOD_SET.has(e.kind) || e.kind === 'cigarette') && dist(pos, e.pos) < UNHEALTHY_HEALTHY_CLEARANCE) return false;
    }
  }
  return true;
}

function _pickWeightedFood(healthyOnly: boolean): EntityKind {
  const pool = healthyOnly
    ? FOOD_POOL.filter(([k]) => HEALTHY_FOOD_SET.has(k))
    : FOOD_POOL;
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of pool) {
    r -= w;
    if (r <= 0) return k;
  }
  return pool[0][0];
}

function _spawnFood(entities: Entity[], forceHealthy = false) {
  const kind = _pickWeightedFood(forceHealthy);
  let pos = randPath();
  // Try up to 30 positions to satisfy placement rules
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = randPath();
    if (_isClearForFood(candidate, kind, entities)) { pos = candidate; break; }
  }
  entities.push({
    id: uid(), kind, pos,
    vel: { x: 0, y: 0 }, radius: 16, active: true,
  });
}

function _spawnEnemy(entities: Entity[], kind: EntityKind, level: number) {
  const base = kind === 'deadline_ghost' ? GHOST_SPEED
             : kind === 'email_monster'  ? EMAIL_SPEED
             : BLOB_SPEED;
  const speed = enemySpeed(base, level);
  const angle = Math.random() * Math.PI * 2;
  entities.push({
    id: uid(), kind, pos: randEdgePath(),
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius: 18, active: true,
  });
}

// ── Advance to next level ─────────────────────────────────────────────────────

export function advanceLevel(state: EngineState): EngineState {
  const next = _buildState(
    state.level + 1,
    state.gs.score,
    100,
    0,
  );
  next.gs.phase = 'playing';
  next.gs.permSpeedBonus = state.gs.permSpeedBonus; // carry over permanent speed gains
  return next;
}

// ── Tick ──────────────────────────────────────────────────────────────────────

export function tickEngine(state: EngineState): void {
  const { gs } = state;

  // During level complete freeze, just tick the timer
  if (gs.phase === 'level_complete') {
    gs.levelCompleteTimer--;
    gs.time++;
    return;
  }

  state.sfxQueue = [];

  if (gs.phase !== 'playing') return;
  gs.time++;
  state.spawnFoodTimer++;
  state.spawnEnemyTimer++;

  // Process respawn queue
  state._respawnQ = state._respawnQ.filter(item => {
    item.delay--;
    if (item.delay <= 0) {
      _spawnEnemy(state.entities, item.kind, state.level);
      return false;
    }
    return true;
  });

  // Input
  const { keys } = state;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft')  || keys.has('a') || keys.has('A')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) dx += 1;
  if (keys.has('ArrowUp')    || keys.has('w') || keys.has('W')) dy -= 1;
  if (keys.has('ArrowDown')  || keys.has('s') || keys.has('S')) dy += 1;

  if ((dx !== 0 || dy !== 0) && state.relaxingChairId !== null) {
    state.relaxingChairId = null;
    gs.relaxTimer = 0;
  }

  // Base speed: permanent bonus from healthy eating, boosted by sugar, slowed after sugar crash
  const baseSpeed = PLAYER_SPEED * (1 + gs.permSpeedBonus);
  const speed = gs.speedBoostTimer > 0
    ? baseSpeed * SPEED_BOOST_MULT
    : gs.slowTimer > 0
      ? baseSpeed * SUGAR_SLOW_MULT
      : baseSpeed;

  if (dx !== 0 || dy !== 0) {
    const norm = normalize({ x: dx, y: dy });
    state.playerVel.x = norm.x * speed;
    state.playerVel.y = norm.y * speed;
  } else {
    state.playerVel.x *= 0.75;
    state.playerVel.y *= 0.75;
  }

  const newPos = {
    x: state.player.x + state.playerVel.x,
    y: state.player.y + state.playerVel.y,
  };
  const resolved = resolveWallCollision(newPos, state.playerVel, PLAYER_RADIUS);
  state.player = resolved.pos;
  state.playerVel = resolved.vel;

  // Clamp
  state.player.x = Math.max(MAZE_X + PLAYER_RADIUS, Math.min(MAZE_X + MAZE_COLS * TILE - PLAYER_RADIUS, state.player.x));
  state.player.y = Math.max(MAZE_Y + PLAYER_RADIUS, Math.min(MAZE_Y + MAZE_ROWS * TILE - PLAYER_RADIUS, state.player.y));

  if (gs.speedBoostTimer > 0) {
    gs.speedBoostTimer--;
    // Sugar crash: when boost expires on a sugary food, start the slowdown
    if (gs.speedBoostTimer === 0 && gs.slowTimer === 0 && gs._sugarCrashPending) {
      gs.slowTimer = SUGAR_SLOW_DURATION;
      gs._sugarCrashPending = false;
      spawnParticle(state.particles, { ...state.player }, 'CRASH...', '#94a3b8');
    }
  }
  if (gs.slowTimer > 0) gs.slowTimer--;

  // Cigarette delayed stress
  if (gs.cigaretteStressTimer > 0) {
    gs.cigaretteStressTimer--;
    if (gs.cigaretteStressTimer === 0) {
      gs.stress = Math.min(100, gs.stress + CIGARETTE_STRESS_AMOUNT);
      spawnParticle(state.particles, { ...state.player }, '+STRESS (smoke)', '#64748b');
    }
  }

  gs.health = Math.max(0, gs.health - HEALTH_DRAIN_RATE);

  if (state.relaxingChairId !== null) {
    gs.relaxTimer--;
    gs.stress = Math.max(0, gs.stress - STRESS_REDUCE_CHAIR);
    if (gs.relaxTimer <= 0) { state.relaxingChairId = null; gs.relaxTimer = 0; }
  } else {
    gs.stress = Math.min(100, gs.stress + STRESS_CREEP);
  }

  // Enemy movement
  for (const e of state.entities) {
    if (!e.active || !ENEMIES.includes(e.kind as any)) continue;

    const base = e.kind === 'deadline_ghost' ? GHOST_SPEED
               : e.kind === 'email_monster'  ? EMAIL_SPEED
               : BLOB_SPEED;
    const eSpeed = enemySpeed(base, state.level);

    const toPlayer = normalize({
      x: state.player.x - e.pos.x,
      y: state.player.y - e.pos.y,
    });

    // Aggression scales with level: higher trackWeight = smarter, lower noise = less random
    const lvl = state.level - 1; // 0-indexed offset
    const baseTrack = LEVEL_TRACK_WEIGHT_BASE + lvl * LEVEL_TRACK_WEIGHT_BONUS;
    const baseNoise = Math.max(0.04, LEVEL_NOISE_BASE - lvl * LEVEL_NOISE_BONUS);
    // Ghost is always more aggressive than other enemies
    const trackWeight = e.kind === 'deadline_ghost' ? baseTrack * 1.6 : baseTrack;
    const noise       = e.kind === 'deadline_ghost' ? baseNoise * 0.5 : baseNoise;
    e.vel.x = e.vel.x * (1 - trackWeight) + toPlayer.x * eSpeed * trackWeight + (Math.random() - 0.5) * noise;
    e.vel.y = e.vel.y * (1 - trackWeight) + toPlayer.y * eSpeed * trackWeight + (Math.random() - 0.5) * noise;

    const vlen = Math.sqrt(e.vel.x ** 2 + e.vel.y ** 2);
    if (vlen > eSpeed * 1.15) {
      e.vel.x = (e.vel.x / vlen) * eSpeed;
      e.vel.y = (e.vel.y / vlen) * eSpeed;
    }

    const newE = { x: e.pos.x + e.vel.x, y: e.pos.y + e.vel.y };
    const er = resolveWallCollision(newE, e.vel, 14);
    e.pos = er.pos;
    e.vel = er.vel;

    if (Math.abs(e.vel.x) < 0.1 && Math.abs(e.vel.y) < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      e.vel.x = Math.cos(angle) * eSpeed;
      e.vel.y = Math.sin(angle) * eSpeed;
    }
  }

  // Spawn food
  const foodKinds = [...HEALTHY_FOODS, ...UNHEALTHY_FOODS] as string[];
  const foodCount   = state.entities.filter(e => e.active && foodKinds.includes(e.kind)).length;
  const healthyCount = state.entities.filter(e => e.active && HEALTHY_FOOD_SET.has(e.kind)).length;

  // Always top up healthy foods to the minimum immediately (no timer gating)
  if (healthyCount < MIN_HEALTHY_ON_SCREEN) {
    _spawnFood(state.entities, true);
  }

  if (state.spawnFoodTimer >= SPAWN_INTERVAL_FOOD && foodCount < 12) {
    _spawnFood(state.entities);
    state.spawnFoodTimer = 0;
  }

  // Spawn enemies
  const maxEnemy = maxEnemiesForLevel(state.level);
  const enemyCount = state.entities.filter(e => e.active && ENEMIES.includes(e.kind as any)).length;
  if (state.spawnEnemyTimer >= SPAWN_INTERVAL_ENEMY && enemyCount < maxEnemy) {
    const kind = ENEMIES[Math.floor(Math.random() * ENEMIES.length)] as EntityKind;
    _spawnEnemy(state.entities, kind, state.level);
    state.spawnEnemyTimer = 0;
  }

  // Collisions
  for (const e of state.entities) {
    if (!e.active && e.kind !== 'lazy_chair') continue;
    const d = dist(state.player, e.pos);

    if (e.kind === 'lazy_chair') {
      if (d < PLAYER_RADIUS + e.radius - 6 && state.relaxingChairId === null && dx === 0 && dy === 0) {
        state.relaxingChairId = e.id;
        gs.relaxTimer = RELAX_DURATION;
        spawnParticle(state.particles, { ...state.player }, 'CHILLING!', '#4ade80');
      }
      continue;
    }

    if (d < PLAYER_RADIUS + e.radius - 8) {
      e.active = false;

      if (HEALTHY_FOODS.includes(e.kind as any)) {
        gs.health = Math.min(100, gs.health + HEALTH_GAIN_HEALTHY);
        gs.score += SCORE_HEALTHY;
        gs.healthyCollected++;
        // Permanent speed bonus from eating healthy
        gs.permSpeedBonus = Math.min(PERM_SPEED_MAX, gs.permSpeedBonus + PERM_SPEED_PER_HEALTHY);
        spawnParticle(state.particles, e.pos, '+HEALTH +SPEED', '#22c55e');
        state.sfxQueue.push('eat_good');

        // Check level complete
        if (gs.healthyCollected >= gs.healthyGoal) {
          gs.phase = 'level_complete';
          gs.levelCompleteTimer = LEVEL_COMPLETE_FREEZE;
          spawnParticle(state.particles, state.player, 'LEVEL COMPLETE!', '#facc15');
          state.sfxQueue.push('level_complete');
        }
      } else if (e.kind === 'cigarette') {
        // Cigarette: heavy health loss now + delayed stress spike later
        gs.health = Math.max(0, gs.health - CIGARETTE_HEALTH_LOSS);
        gs.cigaretteStressTimer = CIGARETTE_STRESS_DELAY;
        gs.score += SCORE_UNHEALTHY;
        if (gs.healthyCollected > 0) {
          gs.healthyCollected--;
          spawnParticle(state.particles, { x: e.pos.x, y: e.pos.y - 20 }, '-1 FOOD!', '#ef4444');
        }
        spawnParticle(state.particles, e.pos, 'BAD IDEA...', '#64748b');
        spawnParticle(state.particles, { x: e.pos.x, y: e.pos.y - 18 }, 'STRESS COMING', '#94a3b8');
        state.sfxQueue.push('eat_bad');
      } else if (SUGARY_FOODS.includes(e.kind as any)) {
        // Sugary: health loss + stress + sugar rush boost + crash after
        gs.health = Math.max(0, gs.health - HEALTH_LOSS_UNHEALTHY);
        gs.stress = Math.min(100, gs.stress + stressGain(STRESS_GAIN_UNHEALTHY, state.level));
        gs.speedBoostTimer = SPEED_BOOST_DURATION;
        gs._sugarCrashPending = true;
        gs.slowTimer = 0; // reset any existing slow
        gs.score += SCORE_UNHEALTHY;
        if (gs.healthyCollected > 0) {
          gs.healthyCollected--;
          spawnParticle(state.particles, { x: e.pos.x, y: e.pos.y - 20 }, '-1 FOOD!', '#ef4444');
        }
        const msgs: Record<string, string> = { donut: 'SUGAR RUSH!!', fries: 'GREASY SPEED!' };
        spawnParticle(state.particles, e.pos, msgs[e.kind] ?? 'SPEED!', '#f59e0b');
        state.sfxQueue.push('eat_bad');
      } else if (e.kind === 'deadline_ghost') {
        gs.stress = Math.min(100, gs.stress + stressGain(STRESS_GAIN_GHOST, state.level));
        spawnParticle(state.particles, e.pos, '+STRESS!', '#a78bfa');
        state._respawnQ.push({ kind: 'deadline_ghost', delay: 240 });
        state.sfxQueue.push('enemy_hit');
      } else if (e.kind === 'email_monster') {
        gs.stress = Math.min(100, gs.stress + stressGain(STRESS_GAIN_EMAIL, state.level));
        spawnParticle(state.particles, e.pos, '99 EMAILS!', '#60a5fa');
        state._respawnQ.push({ kind: 'email_monster', delay: 240 });
        state.sfxQueue.push('enemy_hit');
      } else if (e.kind === 'cholesterol_blob') {
        gs.stress = Math.min(100, gs.stress + stressGain(STRESS_GAIN_BLOB, state.level));
        gs.health = Math.max(0, gs.health - 14);
        spawnParticle(state.particles, e.pos, 'CLOGGED!', '#f87171');
        state._respawnQ.push({ kind: 'cholesterol_blob', delay: 240 });
        state.sfxQueue.push('enemy_hit');
      }
    }
  }

  // ── Stress-man ────────────────────────────────────────────────────────────────
  if (gs.stress >= STRESS_MAN_THRESHOLD) {
    if (!state.stressMan) {
      // Spawn behind the player relative to movement direction
      const offsetDir = normalize({
        x: -(state.playerVel.x || 1),
        y: -(state.playerVel.y || 0),
      });
      state.stressMan = {
        pos: {
          x: state.player.x + offsetDir.x * 80,
          y: state.player.y + offsetDir.y * 80,
        },
        vel: { x: 0, y: 0 },
      };
      spawnParticle(state.particles, { ...state.player }, 'STRESS-MAN!', '#ef4444');
    }

    const sm = state.stressMan;
    const toP = normalize({ x: state.player.x - sm.pos.x, y: state.player.y - sm.pos.y });
    // Scales with stress level — more stress = faster
    const smSpeed = STRESS_MAN_SPEED * (0.8 + (gs.stress - STRESS_MAN_THRESHOLD) / (100 - STRESS_MAN_THRESHOLD) * 0.7);
    sm.vel.x = sm.vel.x * 0.82 + toP.x * smSpeed * 0.18;
    sm.vel.y = sm.vel.y * 0.82 + toP.y * smSpeed * 0.18;
    const smlen = Math.sqrt(sm.vel.x ** 2 + sm.vel.y ** 2);
    if (smlen > smSpeed) { sm.vel.x = (sm.vel.x / smlen) * smSpeed; sm.vel.y = (sm.vel.y / smlen) * smSpeed; }
    const newSm = { x: sm.pos.x + sm.vel.x, y: sm.pos.y + sm.vel.y };
    const smr = resolveWallCollision(newSm, sm.vel, 14);
    sm.pos = smr.pos;
    sm.vel = smr.vel;

    // Collision with player
    if (dist(state.player, sm.pos) < PLAYER_RADIUS + 14) {
      gs.stress = Math.min(100, gs.stress + stressGain(8, state.level));
      gs.health = Math.max(0, gs.health - 4);
      spawnParticle(state.particles, { ...state.player }, 'ANXIETY!', '#ef4444');
      // Teleport stress-man away to give brief respite
      state.stressMan = null;
    }
  } else {
    state.stressMan = null;
  }

  // Cull inactive non-chairs
  state.entities = state.entities.filter(e => e.active || e.kind === 'lazy_chair');

  // Tick particles
  for (const p of state.particles) {
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.vel.y -= 0.05;
    p.life--;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  // Lose conditions (only check when playing, not level_complete)
  if (gs.phase === 'playing') {
    if (gs.health <= 0)   { gs.phase = 'dead_health'; state.sfxQueue.push('dead'); }
    if (gs.stress >= 100) { gs.phase = 'dead_stress'; state.sfxQueue.push('dead'); }
  }
}

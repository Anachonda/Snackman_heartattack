import { Entity, GameState, Particle, Vec2 } from './types';
import {
  CANVAS_W, CANVAS_H, TILE, HUD_H,
  MAZE, MAZE_COLS, MAZE_ROWS, MAZE_X, MAZE_Y,
} from './constants';

// ── Low-level helpers ─────────────────────────────────────────────────────────

let _uid = 0;
export function uid() { return ++_uid; }

export function tileCenter(col: number, row: number): Vec2 {
  return {
    x: MAZE_X + col * TILE + TILE / 2,
    y: MAZE_Y + row * TILE + TILE / 2,
  };
}

export function isWall(col: number, row: number): boolean {
  if (row < 0 || row >= MAZE_ROWS || col < 0 || col >= MAZE_COLS) return true;
  return MAZE[row][col] === 1;
}

function c(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

// ── Maze ──────────────────────────────────────────────────────────────────────

export function drawMaze(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#07070f';
  ctx.fillRect(MAZE_X, MAZE_Y, MAZE_COLS * TILE, MAZE_ROWS * TILE);

  for (let row = 0; row < MAZE_ROWS; row++) {
    for (let col = 0; col < MAZE_COLS; col++) {
      if (MAZE[row][col] === 1) {
        const x = MAZE_X + col * TILE;
        const y = MAZE_Y + row * TILE;
        ctx.fillStyle = '#091540';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
        ctx.strokeStyle = 'rgba(96,165,250,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
      }
    }
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────

export function drawHUD(ctx: CanvasRenderingContext2D, gs: GameState, time: number) {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H - 1); ctx.lineTo(CANVAS_W, HUD_H - 1);
  ctx.stroke();

  // Left column: title + score + level
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SNACKMAN', 12, 20);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('SCORE: ' + gs.score, 12, 40);

  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('LEVEL: ' + gs.level, 12, 58);

  // Health bar
  _bar(ctx, 175, 8, 160, 18, gs.health / 100, '#16a34a', 'HEALTH', time, false);
  // Stress bar
  _bar(ctx, 175, 32, 160, 18, gs.stress / 100, '#ef4444', 'STRESS', time, gs.stress > 65);

  // Food counter — prominent centre-right
  const fc = gs.healthyCollected;
  const fg = gs.healthyGoal;

  // Progress bar background
  const fpx = 350, fpy = 8, fpw = 180, fph = 52;
  const fphy = fpy + fph - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  _rr(ctx, fpx, fpy, fpw, fph, 7); ctx.fill();
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEALTHY FOODS', fpx + fpw / 2, fpy + 14);

  // Fraction
  glow(ctx, '#4ade80', 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fc + ' / ' + fg, fpx + fpw / 2, fpy + 36);
  noGlow(ctx);

  // Mini progress pip row
  const pipW = 12, pipH = 5, pipGap = 3;
  const totalPipW = fg * (pipW + pipGap) - pipGap;
  const pipStartX = fpx + (fpw - totalPipW) / 2;
  for (let i = 0; i < fg; i++) {
    ctx.fillStyle = i < fc ? '#22c55e' : '#1e3a2a';
    ctx.beginPath();
    _rr(ctx, pipStartX + i * (pipW + pipGap), fphy - 2, pipW, pipH, 2);
    ctx.fill();
  }

  // Status messages
  const statusX = 545;
  if (gs.speedBoostTimer > 0) {
    const pct = Math.ceil((gs.speedBoostTimer / 300) * 100);
    glow(ctx, '#f97316', 10);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUGAR RUSH ' + pct + '%', statusX, 25);
    noGlow(ctx);
  }
  if (gs.relaxTimer > 0) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHILLING...', statusX, 46);
  }

  // Enemy legend (far right)
  _enemyLegend(ctx, CANVAS_W - 175, 8, 'GHOST',  '#a78bfa');
  _enemyLegend(ctx, CANVAS_W - 115, 8, 'INBOX',  '#60a5fa');
  _enemyLegend(ctx, CANVAS_W - 55,  8, 'FAT',    '#f87171');
}

function _bar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  pct: number,
  fillColor: string,
  label: string,
  time: number,
  pulse: boolean
) {
  const alpha = pulse ? 0.7 + 0.3 * Math.sin(time * 0.2) : 1;
  ctx.globalAlpha = alpha;
  // Background
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  _rr(ctx, x, y, w, h, 5); ctx.fill();
  // Fill
  const fw = Math.max(0, w * Math.min(pct, 1));
  if (fw > 4) {
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    _rr(ctx, x, y, fw, h, 5); ctx.fill();
  }
  // Label
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 5, y + h / 2);
  ctx.globalAlpha = 1;
}

function _rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _enemyLegend(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, col: string) {
  ctx.fillStyle = col;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 20, y + 40);
}

// ── Food items (pure canvas) ──────────────────────────────────────────────────

export function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, time: number) {
  const { pos, kind } = e;
  const bob = Math.sin(time * 0.07 + e.id * 1.3) * 3;
  const py = pos.y + bob;

  ctx.save();
  ctx.translate(pos.x, py);

  switch (kind) {
    case 'salmon':       _drawSalmon(ctx, time);     break;
    case 'broccoli':     _drawBroccoli(ctx, time);   break;
    case 'nuts':         _drawNuts(ctx, time);        break;
    case 'donut':        _drawDonut(ctx, time);       break;
    case 'fries':        _drawFries(ctx, time);       break;
    case 'cigarette':    _drawCigarette(ctx, time);   break;
    case 'lazy_chair':   _drawChair(ctx, time);       break;
    default: break;
  }

  noGlow(ctx);
  ctx.restore();
}

function _drawSalmon(ctx: CanvasRenderingContext2D, time: number) {
  glow(ctx, '#4ade80', 14);
  // Body
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Tail
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(-14, 0); ctx.lineTo(-20, -7); ctx.lineTo(-20, 7); ctx.closePath();
  ctx.fill();
  // Eye
  c(ctx, 9, -2, 2.5, '#fff');
  c(ctx, 9.5, -2, 1.2, '#000');
  // Fin
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.moveTo(-2, -8); ctx.lineTo(6, -14); ctx.lineTo(8, -7); ctx.closePath();
  ctx.fill();
  noGlow(ctx);
}

function _drawBroccoli(ctx: CanvasRenderingContext2D, time: number) {
  glow(ctx, '#4ade80', 14);
  // Stalk
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(-4, 2, 8, 12);
  // Floret clusters
  const spots = [[-1,-8],[5,-5],[-5,-6],[0,-12],[6,-9],[-7,-10]];
  for (const [sx, sy] of spots) {
    c(ctx, sx, sy, 6, '#16a34a');
  }
  for (const [sx, sy] of spots) {
    c(ctx, sx - 1, sy - 1, 4, '#22c55e');
  }
  noGlow(ctx);
}

function _drawNuts(ctx: CanvasRenderingContext2D, time: number) {
  glow(ctx, '#4ade80', 14);
  // Walnut shape - two lobes
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.ellipse(-5, 0, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, 0, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Groove
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(0, 9);
  ctx.stroke();
  // Highlight
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.ellipse(-5, -2, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, -2, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
}

function _drawDonut(ctx: CanvasRenderingContext2D, _time: number) {
  glow(ctx, '#ef4444', 14);
  // Donut body
  ctx.fillStyle = '#d97706';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  // Hole
  ctx.fillStyle = '#07070f';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pink icing
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(0, 0, 13, -0.5, Math.PI + 0.5);
  ctx.arc(0, 0, 5, Math.PI + 0.5, -0.5, true);
  ctx.closePath();
  ctx.fill();
  // Sprinkles
  const sprinkles = [[-6,-7,'#22d3ee'],[-1,-11,'#a78bfa'],[6,-7,'#fbbf24'],[9,-2,'#f87171'],[-9,0,'#4ade80']];
  for (const [sx, sy, sc] of sprinkles) {
    ctx.fillStyle = sc as string;
    ctx.fillRect(sx as number - 1, sy as number - 2, 2, 4);
  }
  noGlow(ctx);
}

function _drawFries(ctx: CanvasRenderingContext2D, _time: number) {
  glow(ctx, '#ef4444', 14);
  // Container
  pill(ctx, -10, 2, 20, 12, 3, '#dc2626');
  // Fry sticks
  const positions = [-7, -3, 1, 5];
  for (let i = 0; i < positions.length; i++) {
    const h = i % 2 === 0 ? 18 : 14;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(positions[i], 2 - h, 3, h);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(positions[i] + 1, 2 - h, 1, h);
  }
  noGlow(ctx);
}

function _drawCigarette(ctx: CanvasRenderingContext2D, time: number) {
  glow(ctx, '#ef4444', 12);
  ctx.save();
  ctx.rotate(0.5);
  // Body
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(-14, -4, 22, 8);
  // Filter
  ctx.fillStyle = '#f97316';
  ctx.fillRect(8, -4, 6, 8);
  // Lit end glow
  glow(ctx, '#ff4500', 10);
  c(ctx, -14, 0, 5, '#ff6b35');
  c(ctx, -14, 0, 3, '#ffcc00');
  noGlow(ctx);
  // Smoke wisps
  const s = time * 0.08;
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-14, -5 - i * 4);
    ctx.quadraticCurveTo(-18 + Math.sin(s + i) * 4, -12 - i * 4, -16 + Math.sin(s + i + 1) * 4, -20 - i * 4);
    ctx.stroke();
  }
  ctx.restore();
  noGlow(ctx);
}

function _drawChair(ctx: CanvasRenderingContext2D, _time: number) {
  glow(ctx, '#fbbf24', 10);
  // Seat
  pill(ctx, -16, -4, 32, 10, 5, '#d97706');
  pill(ctx, -14, -2, 28, 6, 4, '#fbbf24');
  // Back rest
  pill(ctx, -14, -18, 28, 16, 5, '#d97706');
  pill(ctx, -12, -16, 24, 12, 4, '#fbbf24');
  // Legs
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-14, 6, 4, 8);
  ctx.fillRect(10, 6, 4, 8);
  // Cushion sheen
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, -14, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
}

// ── Enemies ───────────────────────────────────────────────────────────────────

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Entity, time: number) {
  if (!e.active) return;
  const bob = Math.sin(time * 0.09 + e.id * 2.1) * 4;
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y + bob);

  if (e.kind === 'deadline_ghost')   _drawGhost(ctx, time + e.id * 10);
  else if (e.kind === 'email_monster') _drawEmail(ctx, time + e.id * 7);
  else if (e.kind === 'cholesterol_blob') _drawBlob(ctx, time + e.id * 5);

  noGlow(ctx);
  ctx.restore();
}

function _drawGhost(ctx: CanvasRenderingContext2D, time: number) {
  glow(ctx, '#a78bfa', 18);
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.arc(0, -4, 16, Math.PI, 0);
  ctx.lineTo(16, 14);
  for (let i = 0; i < 4; i++) {
    const x1 = 16 - i * 8;
    const xm = x1 - 4;
    const ym = i % 2 === 0 ? 20 : 10;
    ctx.quadraticCurveTo(xm, ym, x1 - 8, 14);
  }
  ctx.closePath();
  ctx.fill();
  // Lighter sheen
  ctx.fillStyle = '#8b5cf6';
  ctx.beginPath();
  ctx.arc(-4, -8, 9, Math.PI + 0.3, Math.PI * 1.8);
  ctx.fill();
  noGlow(ctx);
  // Eyes
  c(ctx, -6, -5, 5, '#fff');
  c(ctx, 6, -5, 5, '#fff');
  c(ctx, -5, -4, 2.8, '#ef4444');
  c(ctx, 7, -4, 2.8, '#ef4444');
  // Angry brows
  ctx.strokeStyle = '#581c87';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -12); ctx.lineTo(-2, -9);
  ctx.moveTo(2, -9); ctx.lineTo(11, -12);
  ctx.stroke();
  // Label
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DEADLINE', 0, 6);
}

function _drawEmail(ctx: CanvasRenderingContext2D, _time: number) {
  glow(ctx, '#60a5fa', 16);
  // Box body
  pill(ctx, -16, -14, 32, 28, 5, '#1d4ed8');
  // Envelope flap (dark triangle)
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.moveTo(-16, -14); ctx.lineTo(0, 4); ctx.lineTo(16, -14);
  ctx.closePath();
  ctx.fill();
  // Flap highlight
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-16, -14); ctx.lineTo(0, 4); ctx.lineTo(16, -14);
  ctx.stroke();
  noGlow(ctx);
  // Eyes
  c(ctx, -6, 5, 4.5, '#fff');
  c(ctx, 6, 5, 4.5, '#fff');
  c(ctx, -5, 6, 2.5, '#1e1b4b');
  c(ctx, 7, 6, 2.5, '#1e1b4b');
  // Angry brows
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, 0); ctx.lineTo(-2, 3);
  ctx.moveTo(2, 3); ctx.lineTo(11, 0);
  ctx.stroke();
  // @ badge
  ctx.fillStyle = '#bfdbfe';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('@', 0, -6);
}

function _drawBlob(ctx: CanvasRenderingContext2D, time: number) {
  glow(ctx, '#f87171', 18);
  const w = 3 * Math.sin(time * 0.12);
  // Main blob
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17 + w, 14 - w * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.ellipse(-4, -4, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Drips
  for (let i = -1; i <= 1; i++) {
    const drip = Math.abs(Math.sin(time * 0.1 + i * 1.5)) * 5;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.ellipse(i * 7, 14 + drip, 4, 5 + drip * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  noGlow(ctx);
  // X eyes
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 2;
  for (const ex of [-6, 6]) {
    ctx.beginPath();
    ctx.moveTo(ex - 3, -4); ctx.lineTo(ex + 3, 2);
    ctx.moveTo(ex + 3, -4); ctx.lineTo(ex - 3, 2);
    ctx.stroke();
  }
  // Greasy smile
  ctx.beginPath();
  ctx.arc(0, 4, 7, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // Label
  ctx.fillStyle = '#fff7ed';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FAT', 0, -1);
}

// ── Player ────────────────────────────────────────────────────────────────────

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  vel: Vec2,
  boosted: boolean,
  relaxing: boolean,
  time: number
) {
  const r = 17;
  const moving = Math.abs(vel.x) > 0.2 || Math.abs(vel.y) > 0.2;
  const bob = moving ? Math.sin(time * 0.28) * 3 : 0;
  const squash = moving ? 1 + Math.sin(time * 0.56) * 0.07 : 1;

  // Floor shadow
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + r * 0.85, r * 0.65, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  ctx.save();
  ctx.translate(pos.x, pos.y + bob);

  // Boost trail (orange arcs behind player)
  if (boosted) {
    for (let i = 1; i <= 4; i++) {
      ctx.globalAlpha = 0.5 - i * 0.1;
      glow(ctx, '#f97316', 10);
      c(ctx, -vel.x * i * 5, -vel.y * i * 5, r * (1 - i * 0.12), '#f97316');
      noGlow(ctx);
    }
    ctx.globalAlpha = 1;
  }

  // Relax "ZZZ"
  if (relaxing) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 0.12);
    ctx.fillText('ZZZ', 0, -r * 2.2);
    ctx.globalAlpha = 1;
  }

  ctx.scale(1 / squash, squash);

  // Body glow
  glow(ctx, boosted ? '#f97316' : '#4ade80', 16);
  c(ctx, 0, 0, r, '#facc15');
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  noGlow(ctx);

  // Face direction offset
  const fx = vel.x !== 0 ? Math.sign(vel.x) * 3 : 0;
  const fy = vel.y !== 0 ? Math.sign(vel.y) * 2 : 0;
  const pdx = Math.sign(vel.x) * 1.2;
  const pdy = Math.sign(vel.y) * 1.2;

  // Eyes
  c(ctx, fx - 6, -5 + fy, 4.5, '#fff');
  c(ctx, fx + 6, -5 + fy, 4.5, '#fff');
  c(ctx, fx - 6 + pdx, -5 + fy + pdy, 2.5, '#1e1b4b');
  c(ctx, fx + 6 + pdx, -5 + fy + pdy, 2.5, '#1e1b4b');

  // Mouth
  ctx.beginPath();
  if (relaxing) {
    ctx.arc(fx, 4, 8, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2.5; ctx.stroke();
  } else if (boosted) {
    ctx.beginPath();
    ctx.ellipse(fx, 6, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7c2d12'; ctx.fill();
  } else {
    ctx.arc(fx, 3 + fy, 7, 0.25, Math.PI - 0.25);
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2.5; ctx.stroke();
  }

  // Blush
  ctx.globalAlpha = 0.38;
  c(ctx, -r * 0.56, 3, 5, '#f87171');
  c(ctx,  r * 0.56, 3, 5, '#f87171');
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ── Particles ─────────────────────────────────────────────────────────────────

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    if (p.text) {
      glow(ctx, p.color, 8);
      ctx.fillStyle = p.color;
      ctx.font = 'bold ' + p.size + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.pos.x, p.pos.y);
      noGlow(ctx);
    } else {
      c(ctx, p.pos.x, p.pos.y, p.size * alpha, p.color);
    }
  }
  ctx.globalAlpha = 1;
}

// ── Title Screen ──────────────────────────────────────────────────────────────

export function drawTitleScreen(ctx: CanvasRenderingContext2D, time: number) {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Dimmed maze background
  ctx.globalAlpha = 0.15;
  drawMaze(ctx);
  ctx.globalAlpha = 1;

  // Decorative mini-entities in background corners
  ctx.globalAlpha = 0.28;
  ctx.save(); ctx.translate(80, 200); ctx.scale(1.5, 1.5); _drawSalmon(ctx, time); ctx.restore();
  ctx.save(); ctx.translate(720, 200); ctx.scale(1.5, 1.5); _drawBroccoli(ctx, time); ctx.restore();
  ctx.save(); ctx.translate(80, 480); ctx.scale(1.5, 1.5); _drawDonut(ctx, time); ctx.restore();
  ctx.save(); ctx.translate(720, 480); ctx.scale(1.5, 1.5); _drawFries(ctx, time); ctx.restore();
  ctx.globalAlpha = 1;

  // Title glow
  const pulse = 0.6 + 0.4 * Math.sin(time * 0.05);
  glow(ctx, `rgba(250,204,21,${pulse * 0.7})`, 40);
  const tscale = 1 + 0.025 * Math.sin(time * 0.06);
  ctx.save();
  ctx.translate(CANVAS_W / 2, 130);
  ctx.scale(tscale, tscale);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 6;
  ctx.font = 'bold 60px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('SNACKMAN', 0, 0);
  ctx.fillStyle = '#facc15';
  ctx.fillText('SNACKMAN', 0, 0);
  ctx.restore();
  noGlow(ctx);

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PREVENT A HEART ATTACK', CANVAS_W / 2, 188);

  // ── OBJECTIVE box ──
  ctx.fillStyle = 'rgba(0,40,0,0.85)';
  ctx.beginPath();
  _rrPath(ctx, CANVAS_W / 2 - 280, 208, 560, 72, 10);
  ctx.fill();
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 2;
  ctx.stroke();

  glow(ctx, '#4ade80', 8);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OBJECTIVE', CANVAS_W / 2, 226);
  noGlow(ctx);

  ctx.fillStyle = '#dcfce7';
  ctx.font = '13px monospace';
  ctx.fillText('Collect healthy food, avoid stress, survive.', CANVAS_W / 2, 248);
  ctx.fillStyle = '#86efac';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('Collect 10 healthy foods to complete each level!', CANVAS_W / 2, 268);

  // ── HOW TO PLAY box ──
  ctx.fillStyle = 'rgba(9,21,64,0.85)';
  ctx.beginPath();
  _rrPath(ctx, CANVAS_W / 2 - 300, 292, 600, 220, 10);
  ctx.fill();
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOW TO PLAY', CANVAS_W / 2, 313);

  const rows: [string, string, string][] = [
    ['GREEN GLOW food', '+health  +progress  +score', '#4ade80'],
    ['RED GLOW food',   'speed boost  BUT  -health', '#f87171'],
    ['GHOST / INBOX',   'touch = big stress spike', '#a78bfa'],
    ['FAT BLOB',        'touch = stress + health drain', '#f87171'],
    ['COUCH',           'stand still near it to chill', '#fbbf24'],
    ['STRESS = 100',    'BURNOUT! Game over.', '#f87171'],
    ['HEALTH = 0',      'HEART ATTACK! Game over.', '#ef4444'],
  ];

  rows.forEach(([left, right, col], i) => {
    const ly = 337 + i * 25;
    ctx.fillStyle = col;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(left, CANVAS_W / 2 - 8, ly);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('  ' + right, CANVAS_W / 2, ly);
  });

  // Controls line
  ctx.fillStyle = '#475569';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MOVE: WASD or ARROW KEYS', CANVAS_W / 2, 522);

  // Blink start prompt
  const blink = 0.5 + 0.5 * Math.sin(time * 0.1);
  ctx.globalAlpha = blink;
  glow(ctx, '#4ade80', 10);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRESS ENTER OR CLICK TO START', CANVAS_W / 2, 556);
  noGlow(ctx);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#334155';
  ctx.font = 'italic 12px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('"Your cardiologist will be pleased."', CANVAS_W / 2, 596);
}

// ── Level Complete overlay ────────────────────────────────────────────────────

export function drawLevelComplete(ctx: CanvasRenderingContext2D, level: number, score: number, time: number) {
  ctx.fillStyle = 'rgba(0,20,0,0.75)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Big animated banner
  const pulse = 1 + 0.06 * Math.sin(time * 0.18);
  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 60);
  ctx.scale(pulse, pulse);

  glow(ctx, '#facc15', 35);
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 6;
  ctx.font = 'bold 58px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('LEVEL COMPLETE!', 0, 0);
  ctx.fillStyle = '#facc15';
  ctx.fillText('LEVEL COMPLETE!', 0, 0);
  noGlow(ctx);
  ctx.restore();

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Level ' + level + ' cleared!', CANVAS_W / 2, CANVAS_H / 2 + 20);

  ctx.fillStyle = '#86efac';
  ctx.font = '16px monospace';
  ctx.fillText('+20 health bonus!  Stress reduced!', CANVAS_W / 2, CANVAS_H / 2 + 52);

  ctx.fillStyle = '#fef9c3';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('Score: ' + score, CANVAS_W / 2, CANVAS_H / 2 + 90);

  ctx.fillStyle = '#93c5fd';
  ctx.font = '14px monospace';
  ctx.fillText('Get ready for Level ' + (level + 1) + '!', CANVAS_W / 2, CANVAS_H / 2 + 120);

  ctx.fillStyle = '#475569';
  ctx.font = 'italic 12px serif';
  ctx.fillText('"More enemies! More stress! More donuts!"', CANVAS_W / 2, CANVAS_H / 2 + 155);
}

// ── Pause Screen ──────────────────────────────────────────────────────────────

export function drawPauseScreen(
  ctx: CanvasRenderingContext2D,
  hoveredButton: 'resume' | 'menu' | null
) {
  // Dim overlay
  ctx.fillStyle = 'rgba(5,5,16,0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Panel
  const pw = 340, ph = 240;
  const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;
  ctx.fillStyle = '#0d1b3e';
  ctx.beginPath();
  _rrPath(ctx, px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  _rrPath(ctx, px, py, pw, ph, 16);
  ctx.stroke();

  // Title
  glow(ctx, '#60a5fa', 14);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', CANVAS_W / 2, py + 54);
  noGlow(ctx);

  // Pause icon (two bars)
  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(CANVAS_W / 2 - 22, py + 14, 10, 28);
  ctx.fillRect(CANVAS_W / 2 + 12, py + 14, 10, 28);

  // Resume button
  const resumeHov = hoveredButton === 'resume';
  ctx.fillStyle = resumeHov ? '#22c55e' : '#166534';
  ctx.beginPath();
  _rrPath(ctx, px + 30, py + 110, pw - 60, 48, 10);
  ctx.fill();
  if (resumeHov) { glow(ctx, '#22c55e', 12); }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CONTINUE', CANVAS_W / 2, py + 134);
  noGlow(ctx);

  // Main menu button
  const menuHov = hoveredButton === 'menu';
  ctx.fillStyle = menuHov ? '#3b82f6' : '#1e3a5f';
  ctx.beginPath();
  _rrPath(ctx, px + 30, py + 170, pw - 60, 48, 10);
  ctx.fill();
  if (menuHov) { glow(ctx, '#3b82f6', 12); }
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAIN MENU', CANVAS_W / 2, py + 194);
  noGlow(ctx);

  // ESC hint
  ctx.fillStyle = '#475569';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ESC or P to resume', CANVAS_W / 2, py + ph + 18);
}

// ── Pause button (always-on-screen) ───────────────────────────────────────────

export function drawPauseButton(ctx: CanvasRenderingContext2D, hovered: boolean) {
  const x = CANVAS_W - 48, y = 8, w = 38, h = 26;
  ctx.fillStyle = hovered ? '#1e3a8a' : 'rgba(9,21,64,0.7)';
  ctx.beginPath();
  _rrPath(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = hovered ? '#93c5fd' : '#60a5fa';
  ctx.fillRect(x + 8, y + 6, 7, 14);
  ctx.fillRect(x + 22, y + 6, 7, 14);
}

// ── Game Over ─────────────────────────────────────────────────────────────────

export function drawGameOver(ctx: CanvasRenderingContext2D, phase: string, score: number, time: number) {
  ctx.fillStyle = phase === 'dead_health' ? 'rgba(40,0,0,0.88)' : 'rgba(20,10,0,0.88)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (phase === 'dead_health') {
    _drawHeartAttack(ctx, time);
  } else {
    _drawBurnout(ctx, time);
  }

  ctx.fillStyle = '#fef9c3';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FINAL SCORE: ' + score, CANVAS_W / 2, 420);

  const blink = 0.5 + 0.5 * Math.sin(time * 0.1);
  ctx.globalAlpha = blink;
  glow(ctx, '#4ade80', 8);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PRESS ENTER OR CLICK TO RETRY', CANVAS_W / 2, 480);
  noGlow(ctx);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#475569';
  ctx.font = 'italic 13px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('"Have you considered a salad?" — Your Doctor', CANVAS_W / 2, 530);
}

function _drawHeartAttack(ctx: CanvasRenderingContext2D, time: number) {
  // Pulsing broken heart
  const heartBeat = Math.abs(Math.sin(time * 0.18)) * 0.3;
  const scale = 1.15 + heartBeat;
  ctx.save();
  ctx.translate(CANVAS_W / 2, 190);
  ctx.scale(scale, scale);

  // Outer glow
  glow(ctx, '#ef4444', 40 + heartBeat * 30);

  // Left half of heart
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(0, 55);
  ctx.bezierCurveTo(-55, 20, -65, -30, -30, -40);
  ctx.bezierCurveTo(-10, -48, 0, -25, 0, -10);
  ctx.closePath();
  ctx.fill();

  // Right half of heart (slightly offset for "broken" look)
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(4, 55);
  ctx.bezierCurveTo(59, 20, 69, -30, 34, -40);
  ctx.bezierCurveTo(14, -48, 4, -25, 4, -10);
  ctx.closePath();
  ctx.fill();

  // Crack down the middle
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.lineTo(-5, -10);
  ctx.lineTo(6, 10);
  ctx.lineTo(-3, 30);
  ctx.lineTo(2, 55);
  ctx.stroke();

  noGlow(ctx);

  // EKG flatline
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(time * 0.05));
  ctx.beginPath();
  ctx.moveTo(-90, 85);
  ctx.lineTo(-40, 85);
  ctx.lineTo(-25, 55);
  ctx.lineTo(-10, 115);
  ctx.lineTo(5, 45);
  ctx.lineTo(20, 85);
  ctx.lineTo(90, 85);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Text
  const pulse = 1 + 0.04 * Math.sin(time * 0.12);
  ctx.save();
  ctx.translate(CANVAS_W / 2, 330);
  ctx.scale(pulse, pulse);
  glow(ctx, '#ef4444', 25);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HEART ATTACK!', 0, 0);
  noGlow(ctx);
  ctx.restore();
  ctx.fillStyle = '#fca5a5';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('The donuts won. Classic.', CANVAS_W / 2, 378);
}

function _drawBurnout(ctx: CanvasRenderingContext2D, time: number) {
  // Flickering flame silhouette behind text
  for (let i = 0; i < 5; i++) {
    const flicker = Math.sin(time * 0.13 + i * 1.3) * 18;
    ctx.globalAlpha = 0.18;
    glow(ctx, '#f97316', 30);
    c(ctx, CANVAS_W / 2 + (i - 2) * 40, 200 + flicker, 30, '#f97316');
    noGlow(ctx);
  }
  ctx.globalAlpha = 1;

  const pulse = 1 + 0.04 * Math.sin(time * 0.12);
  ctx.save();
  ctx.translate(CANVAS_W / 2, 240);
  ctx.scale(pulse, pulse);
  glow(ctx, '#f97316', 30);
  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BURNOUT!', 0, 0);
  noGlow(ctx);
  ctx.restore();
  ctx.fillStyle = '#fdba74';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Deadline ghosts claimed your soul.', CANVAS_W / 2, 290);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px monospace';
  ctx.fillText('(You were your own worst enemy.)', CANVAS_W / 2, 315);
}

// ── Stress-man ────────────────────────────────────────────────────────────────

export function drawStressMan(ctx: CanvasRenderingContext2D, pos: Vec2, stress: number, time: number) {
  const intensity = Math.max(0, (stress - 70) / 30); // 0..1
  const flicker = 0.65 + 0.35 * Math.abs(Math.sin(time * 0.25));

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.globalAlpha = 0.55 + intensity * 0.3;

  // Shadow trail
  glow(ctx, `rgba(239,68,68,${intensity * 0.9})`, 20 + intensity * 20);

  // Body — same shape as player but red/dark
  ctx.scale(1, 1 + 0.05 * Math.sin(time * 0.3));
  c(ctx, 0, 0, 17, `hsl(0, 80%, ${20 + intensity * 20}%)`);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();
  noGlow(ctx);

  // Angry eyes
  c(ctx, -6, -5, 4, '#fee2e2');
  c(ctx, 6, -5, 4, '#fee2e2');
  c(ctx, -6, -5, 2.5, '#dc2626');
  c(ctx, 6, -5, 2.5, '#dc2626');
  // Angry brows
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -11); ctx.lineTo(-2, -8);
  ctx.moveTo(2, -8);    ctx.lineTo(11, -11);
  ctx.stroke();
  // Grimace
  ctx.beginPath();
  ctx.moveTo(-7, 5); ctx.lineTo(7, 5);
  ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 2; ctx.stroke();

  // "STRESS-MAN" label that flickers
  ctx.globalAlpha = flicker;
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STRESS-MAN', 0, -28);

  ctx.restore();
}

// ── Particle factory ──────────────────────────────────────────────────────────

export function spawnParticle(particles: Particle[], pos: Vec2, text: string, color: string) {
  particles.push({
    id: uid(),
    pos: { x: pos.x, y: pos.y - 12 },
    vel: { x: (Math.random() - 0.5) * 1.8, y: -2.2 - Math.random() * 1.5 },
    life: 75,
    maxLife: 75,
    color,
    text,
    size: 14,
  });
}

// ── Internal utils ────────────────────────────────────────────────────────────

function _rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

import { CORE_MAX_HP, GRID_SIZE, MAX_UNIT_LEVEL, TOTAL_WAVES } from "./constants";
import { cellXY } from "./pathing";
import type { Game } from "./game";

const COLORS = {
  background: "#eef1f4",
  gridLine: "#d7dce1",
  entrance: "#f3a5a5",
  core: "#ad1457",
  scar: "#5a5a5a",
  unit: ["#66bb6a", "#2e7d32", "#1b5e20"],
  unitPip: "#f1f8e9",
  enemy: "#7b1fa2",
  enemyHpBack: "#e1bee7",
  enemyHpFill: "#4a148c",
  orb: "#fbc02d",
  flash: "#fff176",
  hpBarBack: "#37474f",
  hpBarFill: "#e53935",
  resourceBarBack: "#37474f",
  resourceBarFill: "#fdd835",
  wavePipEmpty: "#cfd8dc",
  wavePipFull: "#546e7a",
  winOverlay: "rgba(67, 160, 71, 0.35)",
  loseOverlay: "rgba(198, 40, 40, 0.35)",
} as const;

export interface Layout {
  cellSize: number;
  offsetX: number;
  offsetY: number;
  hudTop: number;
  hudBottom: number;
}

export function computeLayout(width: number, height: number): Layout {
  const hudTop = Math.max(12, height * 0.02);
  const hudBottom = Math.max(10, height * 0.015);
  const usableHeight = Math.max(1, height - hudTop - hudBottom);
  const cellSize = Math.min(width / GRID_SIZE, usableHeight / GRID_SIZE);
  const offsetX = (width - cellSize * GRID_SIZE) / 2;
  const offsetY = hudTop + (usableHeight - cellSize * GRID_SIZE) / 2;
  return { cellSize, offsetX, offsetY, hudTop, hudBottom };
}

function cellTopLeft(layout: Layout, x: number, y: number): [number, number] {
  return [layout.offsetX + x * layout.cellSize, layout.offsetY + y * layout.cellSize];
}

function cellCenter(layout: Layout, x: number, y: number): [number, number] {
  return [
    layout.offsetX + (x + 0.5) * layout.cellSize,
    layout.offsetY + (y + 0.5) * layout.cellSize,
  ];
}

export function draw(
  ctx: CanvasRenderingContext2D,
  game: Game,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  const layout = computeLayout(width, height);

  drawGrid(ctx, game, layout);
  drawOrbs(ctx, game, layout);
  drawEnemies(ctx, game, layout);
  drawFlashes(ctx, game, layout);
  drawHud(ctx, game, width, layout);
  drawEndOverlay(ctx, game, width, height);
}

function drawGrid(ctx: CanvasRenderingContext2D, game: Game, layout: Layout): void {
  const { cellSize } = layout;
  for (let i = 0; i < game.grid.cells.length; i++) {
    const [x, y] = cellXY(game.grid, i);
    const [px, py] = cellTopLeft(layout, x, y);
    const kind = game.grid.cells[i];
    const unit = game.units.get(i);

    if (unit) {
      drawUnit(ctx, layout, x, y, unit.level);
    } else {
      ctx.fillStyle =
        kind === "entrance"
          ? COLORS.entrance
          : kind === "core"
            ? COLORS.core
            : kind === "blocked"
              ? COLORS.scar
              : COLORS.background;
      ctx.fillRect(px, py, cellSize, cellSize);
    }

    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = Math.max(1, cellSize * 0.03);
    ctx.strokeRect(px, py, cellSize, cellSize);
  }
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  x: number,
  y: number,
  level: number,
): void {
  const { cellSize } = layout;
  const [px, py] = cellTopLeft(layout, x, y);
  ctx.fillStyle = COLORS.unit[Math.min(level, MAX_UNIT_LEVEL) - 1];
  ctx.fillRect(px, py, cellSize, cellSize);

  const [cx, cy] = cellCenter(layout, x, y);
  const pipRadius = cellSize * 0.07;
  const spacing = cellSize * 0.22;
  const offsets: ReadonlyArray<readonly [number, number]> =
    level === 1
      ? [[0, 0]]
      : level === 2
        ? [
            [-spacing / 2, 0],
            [spacing / 2, 0],
          ]
        : [
            [0, -spacing / 2],
            [-spacing / 2, spacing / 3],
            [spacing / 2, spacing / 3],
          ];

  ctx.fillStyle = COLORS.unitPip;
  for (const [dx, dy] of offsets) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, pipRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOrbs(ctx: CanvasRenderingContext2D, game: Game, layout: Layout): void {
  ctx.fillStyle = COLORS.orb;
  for (const orb of game.orbs) {
    const [cx, cy] = cellCenter(layout, orb.x, orb.y);
    ctx.beginPath();
    ctx.arc(cx, cy, layout.cellSize * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, game: Game, layout: Layout): void {
  for (const enemy of game.enemies) {
    const [cx, cy] = cellCenter(layout, enemy.x, enemy.y);
    const radius = layout.cellSize * 0.28;

    ctx.fillStyle = COLORS.enemy;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const barWidth = layout.cellSize * 0.7;
    const barHeight = Math.max(2, layout.cellSize * 0.08);
    const barX = cx - barWidth / 2;
    const barY = cy - radius - barHeight - 2;
    ctx.fillStyle = COLORS.enemyHpBack;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = COLORS.enemyHpFill;
    ctx.fillRect(barX, barY, barWidth * Math.max(0, enemy.hp / enemy.maxHp), barHeight);
  }
}

function drawFlashes(ctx: CanvasRenderingContext2D, game: Game, layout: Layout): void {
  ctx.strokeStyle = COLORS.flash;
  ctx.lineWidth = Math.max(1, layout.cellSize * 0.05);
  for (const flash of game.flashes) {
    const [fx, fy] = cellCenter(layout, flash.fromX, flash.fromY);
    const [tx, ty] = cellCenter(layout, flash.toX, flash.toY);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game, width: number, layout: Layout): void {
  const barHeight = layout.hudTop * 0.6;
  const barY = layout.hudTop * 0.2;
  const barWidth = width * 0.4;
  const gap = width * 0.04;

  // Core health, left.
  ctx.fillStyle = COLORS.hpBarBack;
  ctx.fillRect(gap, barY, barWidth, barHeight);
  ctx.fillStyle = COLORS.hpBarFill;
  ctx.fillRect(gap, barY, barWidth * Math.max(0, game.coreHp / CORE_MAX_HP), barHeight);

  // Resource, right.
  const resourceX = width - gap - barWidth;
  const resourceFraction = Math.min(1, game.resource / 60);
  ctx.fillStyle = COLORS.resourceBarBack;
  ctx.fillRect(resourceX, barY, barWidth, barHeight);
  ctx.fillStyle = COLORS.resourceBarFill;
  ctx.fillRect(resourceX, barY, barWidth * resourceFraction, barHeight);

  // Wave progress pips, bottom edge.
  const pipGap = width * 0.02;
  const pipSize = (width - pipGap * (TOTAL_WAVES + 1)) / TOTAL_WAVES;
  const pipY = layout.offsetY + layout.cellSize * GRID_SIZE + (layout.hudBottom - pipSize) / 2;
  for (let i = 0; i < TOTAL_WAVES; i++) {
    const completed = game.status === "won" || game.waveNumber > i + 1;
    ctx.fillStyle = completed ? COLORS.wavePipFull : COLORS.wavePipEmpty;
    ctx.fillRect(pipGap + i * (pipSize + pipGap), pipY, pipSize, pipSize);
  }
}

function drawEndOverlay(
  ctx: CanvasRenderingContext2D,
  game: Game,
  width: number,
  height: number,
): void {
  if (game.status === "won") {
    ctx.fillStyle = COLORS.winOverlay;
    ctx.fillRect(0, 0, width, height);
  } else if (game.status === "lost") {
    ctx.fillStyle = COLORS.loseOverlay;
    ctx.fillRect(0, 0, width, height);
  }
}

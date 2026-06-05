import { CONFIG } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const { width, height } = { width: CONFIG.COLS * CONFIG.TILE_SIZE, height: CONFIG.ROWS * CONFIG.TILE_SIZE };
    canvas.width = width;
    canvas.height = height;
  }

  clear() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#3d6b4f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawGrid();
    this.drawWalls();
  }

  drawGrid() {
    const { ctx, canvas } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CONFIG.COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CONFIG.TILE_SIZE, 0);
      ctx.lineTo(x * CONFIG.TILE_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= CONFIG.ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CONFIG.TILE_SIZE);
      ctx.lineTo(canvas.width, y * CONFIG.TILE_SIZE);
      ctx.stroke();
    }
  }

  drawWalls() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#1a2a22';
    const t = CONFIG.TILE_SIZE;
    ctx.fillRect(0, 0, canvas.width, t);
    ctx.fillRect(0, canvas.height - t, canvas.width, t);
    ctx.fillRect(0, 0, t, canvas.height);
    ctx.fillRect(canvas.width - t, 0, t, canvas.height);
  }

  drawBomb(bomb) {
    const { ctx } = this;
    const cx = bomb.gridX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const cy = bomb.gridY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const pulse = 1 + Math.sin(bomb.timer * 8) * 0.08;
    const radius = (CONFIG.TILE_SIZE / 2 - 6) * pulse;

    ctx.save();
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#2c2c2c';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const fuseRatio = 1 - bomb.timer / CONFIG.BOMB_FUSE;
    ctx.strokeStyle = fuseRatio > 0.7 ? '#ff4757' : '#feca57';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fuseRatio);
    ctx.stroke();

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(cx, cy - radius - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawExplosion(explosion) {
    const { ctx } = this;
    const alpha = Math.min(1, explosion.timer / CONFIG.EXPLOSION_DURATION);
    const t = CONFIG.TILE_SIZE;

    ctx.save();
    for (const cell of explosion.cells) {
      const x = cell.x * t;
      const y = cell.y * t;

      const gradient = ctx.createRadialGradient(
        x + t / 2, y + t / 2, 0,
        x + t / 2, y + t / 2, t * 0.7
      );
      gradient.addColorStop(0, `rgba(255, 230, 100, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(255, 120, 50, ${alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(255, 50, 30, ${alpha * 0.3})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
    }
    ctx.restore();
  }

  drawPlayer(player) {
    const { ctx } = this;
    const { x, y, color, stunTimer, id, alive, deathEffectTimer } = player;

    const showDeathEffect = !alive && deathEffectTimer > 0;
    if (!alive && !showDeathEffect) return;

    ctx.save();

    if (stunTimer > 0) {
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 80) * 0.2;
    }

    if (showDeathEffect) {
      const t = Math.max(0, Math.min(1, deathEffectTimer / CONFIG.DEATH_EFFECT_DURATION));
      ctx.globalAlpha = 0.8;
      this.drawFlameHitEffect(x, y, CONFIG.PLAYER_RADIUS + 10, 1 - t);
      ctx.globalAlpha = 0.45;
    }

    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(id + 1), x, y);

    ctx.restore();
  }

  drawFlameHitEffect(x, y, radius, phase) {
    const { ctx } = this;
    const time = Date.now() / 1000;
    const wobble = Math.sin((time + phase) * 10) * 0.25;

    const inner = ctx.createRadialGradient(x, y, 0, x, y, radius);
    inner.addColorStop(0, 'rgba(255, 255, 200, 0.95)');
    inner.addColorStop(0.45, 'rgba(255, 170, 60, 0.8)');
    inner.addColorStop(1, 'rgba(255, 60, 20, 0.0)');

    ctx.save();
    ctx.shadowColor = 'rgba(255, 120, 40, 0.8)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(x, y, radius * (0.85 + wobble * 0.12), 0, Math.PI * 2);
    ctx.fill();

    // 炎の舌っぽい三角形を周囲に散らす
    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const a = (Math.PI * 2 * i) / spikes + wobble;
      const r1 = radius * 0.55;
      const r2 = radius * (0.95 + Math.sin(time * 8 + i) * 0.08);

      const x1 = x + Math.cos(a) * r1;
      const y1 = y + Math.sin(a) * r1;
      const x2 = x + Math.cos(a + 0.22) * r2;
      const y2 = y + Math.sin(a + 0.22) * r2;
      const x3 = x + Math.cos(a - 0.22) * r2;
      const y3 = y + Math.sin(a - 0.22) * r2;

      ctx.fillStyle = `rgba(255, ${Math.floor(140 + 60 * Math.sin(time * 6 + i))}, 40, 0.55)`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  drawAll(bombs, explosions, players) {
    this.clear();
    for (const exp of explosions) this.drawExplosion(exp);
    for (const bomb of bombs) this.drawBomb(bomb);
    for (const player of players) this.drawPlayer(player);
  }
}

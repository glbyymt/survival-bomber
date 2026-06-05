import { CONFIG } from './config.js';
import { getPlayerInput } from './input.js';
import { playExplosionSound } from './audio.js';

const T = CONFIG.TILE_SIZE;
const FIELD_W = CONFIG.COLS * T;
const FIELD_H = CONFIG.ROWS * T;
const WALL_INSET = T;

export class Game {
  constructor(playerCount) {
    this.playerCount = playerCount;
    this.isSinglePlayer = playerCount === 1;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.maxBombs = CONFIG.MAX_BOMBS_START;
    this.bombs = [];
    this.explosions = [];
    this.players = [];
    this.finished = false;
    this.result = null;
    this.pendingResult = null;
    this.resultDelayTimer = 0;
    this.spawnInterval = CONFIG.INITIAL_SPAWN_INTERVAL;

    this.initPlayers();
  }

  initPlayers() {
    const spawnPoints = this.getSpawnPoints();
    for (let i = 0; i < this.playerCount; i++) {
      const sp = spawnPoints[i];
      this.players.push({
        id: i,
        x: sp.x,
        y: sp.y,
        color: CONFIG.PLAYER_COLORS[i],
        name: CONFIG.PLAYER_NAMES[i],
        alive: true,
        stunTimer: 0,
        knockbackDirX: 0,
        knockbackDirY: 0,
        knockbackRemaining: 0,
        deathTime: null,
        deathEffectTimer: 0,
      });
    }
  }

  getSpawnPoints() {
    const margin = WALL_INSET + T;
    const cx = FIELD_W / 2;
    const cy = FIELD_H / 2;
    const offset = T * 2.5;

    return [
      { x: cx - offset, y: cy - offset },
      { x: cx + offset, y: cy - offset },
      { x: cx - offset, y: cy + offset },
      { x: cx + offset, y: cy + offset },
    ].map((p) => ({
      x: Math.max(margin, Math.min(FIELD_W - margin, p.x)),
      y: Math.max(margin, Math.min(FIELD_H - margin, p.y)),
    }));
  }

  update(dt) {
    if (this.finished) return;

    this.elapsed += dt;
    this.updateDifficulty();
    this.updatePlayers(dt);
    this.updateBombs(dt);
    this.updateExplosions(dt);
    this.updateSpawning(dt);
    this.checkExplosionHits();
    this.updateDeathEffects(dt);
    this.checkGameEnd();
    this.updateFinishCountdown(dt);
  }

  updateDeathEffects(dt) {
    for (const p of this.players) {
      if (p.deathEffectTimer > 0) {
        p.deathEffectTimer -= dt;
        if (p.deathEffectTimer < 0) p.deathEffectTimer = 0;
      }
    }
  }

  updateFinishCountdown(dt) {
    if (!this.pendingResult) return;
    this.resultDelayTimer -= dt;
    if (this.resultDelayTimer <= 0) {
      this.result = this.pendingResult;
      this.pendingResult = null;
      this.finished = true;
    }
  }

  updateDifficulty() {
    const bombTier = Math.floor(this.elapsed / CONFIG.BOMB_INCREASE_INTERVAL);
    this.maxBombs = Math.min(CONFIG.MAX_BOMBS_CAP, CONFIG.MAX_BOMBS_START + bombTier);
    this.spawnInterval = Math.max(
      CONFIG.MIN_SPAWN_INTERVAL,
      CONFIG.INITIAL_SPAWN_INTERVAL - this.elapsed * CONFIG.SPAWN_INTERVAL_DECAY
    );
  }

  updatePlayers(dt) {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.alive) continue;

      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        this.applyKnockback(p, dt);
        this.clampToField(p);
        continue;
      }

      const input = getPlayerInput(i, this.playerCount);
      if (input.x !== 0 || input.y !== 0) {
        p.x += input.x * CONFIG.PLAYER_SPEED * dt;
        p.y += input.y * CONFIG.PLAYER_SPEED * dt;
      }
      this.clampToField(p);
    }

    this.resolvePlayerCollisions();
  }

  applyKnockback(p, dt) {
    if (p.knockbackRemaining <= 0) return;

    const step = Math.min(p.knockbackRemaining, CONFIG.KNOCKBACK_SPEED * dt);
    const prevX = p.x;
    const prevY = p.y;

    p.x += p.knockbackDirX * step;
    p.y += p.knockbackDirY * step;

    this.clampToField(p);

    // 壁に当たって実移動が潰れたら、そこでノックバック終了
    const moved = Math.hypot(p.x - prevX, p.y - prevY);
    p.knockbackRemaining -= moved;
    if (moved < step * 0.5) {
      p.knockbackRemaining = 0;
    }
  }

  clampToField(p) {
    const minX = WALL_INSET + CONFIG.PLAYER_RADIUS;
    const maxX = FIELD_W - WALL_INSET - CONFIG.PLAYER_RADIUS;
    const minY = WALL_INSET + CONFIG.PLAYER_RADIUS;
    const maxY = FIELD_H - WALL_INSET - CONFIG.PLAYER_RADIUS;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    p.y = Math.max(minY, Math.min(maxY, p.y));
  }

  resolvePlayerCollisions() {
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i];
        const b = this.players[j];
        if (!a.alive || !b.alive) continue;
        if (a.stunTimer > 0 && b.stunTimer > 0) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = CONFIG.PLAYER_RADIUS * 2;

        if (dist >= minDist || dist < 0.001) continue;
        if (a.stunTimer > 0 || b.stunTimer > 0) continue;

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const halfOverlap = overlap / 2;

        a.x -= nx * halfOverlap;
        a.y -= ny * halfOverlap;
        b.x += nx * halfOverlap;
        b.y += ny * halfOverlap;

        this.clampToField(a);
        this.clampToField(b);

        this.applyKnockbackToPlayer(a, -nx, -ny);
        this.applyKnockbackToPlayer(b, nx, ny);
      }
    }
  }

  applyKnockbackToPlayer(p, dirX, dirY) {
    p.stunTimer = CONFIG.STUN_DURATION;
    p.knockbackDirX = dirX;
    p.knockbackDirY = dirY;
    p.knockbackRemaining = CONFIG.KNOCKBACK_DISTANCE;

    const targetX = p.x + dirX * CONFIG.KNOCKBACK_DISTANCE;
    const targetY = p.y + dirY * CONFIG.KNOCKBACK_DISTANCE;

    const minX = WALL_INSET + CONFIG.PLAYER_RADIUS;
    const maxX = FIELD_W - WALL_INSET - CONFIG.PLAYER_RADIUS;
    const minY = WALL_INSET + CONFIG.PLAYER_RADIUS;
    const maxY = FIELD_H - WALL_INSET - CONFIG.PLAYER_RADIUS;

    if (targetX < minX || targetX > maxX || targetY < minY || targetY > maxY) {
      // 壁方向なら「めり込み防止」で実移動が潰れるので、残距離を少し短くする
      p.knockbackRemaining *= 0.5;
    }
  }

  updateBombs(dt) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.timer += dt;
      if (bomb.timer >= CONFIG.BOMB_FUSE) {
        this.explodeBomb(bomb);
        this.bombs.splice(i, 1);
      }
    }
  }

  explodeBomb(bomb) {
    playExplosionSound();

    const cells = [{ x: bomb.gridX, y: bomb.gridY }];

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    for (const { dx, dy } of directions) {
      let x = bomb.gridX + dx;
      let y = bomb.gridY + dy;
      while (x >= 1 && x < CONFIG.COLS - 1 && y >= 1 && y < CONFIG.ROWS - 1) {
        cells.push({ x, y });
        x += dx;
        y += dy;
      }
    }

    this.explosions.push({
      cells,
      timer: CONFIG.EXPLOSION_DURATION,
    });
  }

  updateExplosions(dt) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].timer -= dt;
      if (this.explosions[i].timer <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  updateSpawning(dt) {
    this.spawnTimer += dt;
    if (this.spawnTimer < this.spawnInterval) return;
    this.spawnTimer = 0;

    if (this.bombs.length >= this.maxBombs) return;

    const cell = this.findEmptyBombCell();
    if (!cell) return;

    this.bombs.push({
      gridX: cell.x,
      gridY: cell.y,
      timer: 0,
    });
  }

  findEmptyBombCell() {
    const occupied = new Set();
    for (const bomb of this.bombs) {
      occupied.add(`${bomb.gridX},${bomb.gridY}`);
    }
    for (const exp of this.explosions) {
      for (const cell of exp.cells) {
        occupied.add(`${cell.x},${cell.y}`);
      }
    }

    const candidates = [];
    for (let y = 1; y < CONFIG.ROWS - 1; y++) {
      for (let x = 1; x < CONFIG.COLS - 1; x++) {
        if (!occupied.has(`${x},${y}`)) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  checkExplosionHits() {
    for (const exp of this.explosions) {
      for (const player of this.players) {
        if (!player.alive) continue;
        if (this.isPlayerInExplosion(player, exp)) {
          player.alive = false;
          player.deathTime = this.elapsed;
          player.deathEffectTimer = CONFIG.DEATH_EFFECT_DURATION;
        }
      }
    }
  }

  isPlayerInExplosion(player, explosion) {
    const gx = Math.floor(player.x / T);
    const gy = Math.floor(player.y / T);

    for (const cell of explosion.cells) {
      if (cell.x === gx && cell.y === gy) return true;
    }

    const r = CONFIG.PLAYER_RADIUS;
    for (const cell of explosion.cells) {
      const closestX = Math.max(cell.x * T, Math.min(player.x, (cell.x + 1) * T));
      const closestY = Math.max(cell.y * T, Math.min(player.y, (cell.y + 1) * T));
      const dx = player.x - closestX;
      const dy = player.y - closestY;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  checkGameEnd() {
    if (this.pendingResult) return;

    if (this.isSinglePlayer) {
      const player = this.players[0];
      if (!player.alive) {
        this.pendingResult = {
          type: 'timeAttack',
          time: player.deathTime ?? this.elapsed,
        };
        this.resultDelayTimer = CONFIG.RESULT_TRANSITION_DELAY;
      }
      return;
    }

    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1 && this.players.some((p) => !p.alive)) {
      if (alive.length === 1) {
        this.pendingResult = {
          type: 'winner',
          winner: alive[0],
        };
      } else {
        this.pendingResult = {
          type: 'draw',
        };
      }
      this.resultDelayTimer = CONFIG.RESULT_TRANSITION_DELAY;
    }
  }

  getAliveCount() {
    return this.players.filter((p) => p.alive).length;
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    if (m > 0) {
      return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }
    return `${s}.${String(ms).padStart(2, '0')}秒`;
  }
}

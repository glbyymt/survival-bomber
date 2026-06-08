import { initInput, updateGamepadStatus } from './input.js';
import { unlockAudio } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';
import {
  isMobile,
  applyMobileLayout,
  initVirtualJoystick,
  setJoystickVisible,
  bindTap,
} from './mobile.js';

const screens = {
  title: document.getElementById('title-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen'),
};

const canvas = document.getElementById('game-canvas');
const hud = document.getElementById('hud');
const resultMessage = document.getElementById('result-message');
const gamepadStatus = document.getElementById('gamepad-status');

let renderer = null;
let game = null;
let playerCount = 1;
let animFrameId = null;
let lastTime = 0;

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');

  if (isMobile()) {
    setJoystickVisible(name === 'game');
  }
}

function startGame(count) {
  unlockAudio();
  playerCount = count;
  if (animFrameId) cancelAnimationFrame(animFrameId);

  renderer = new Renderer(canvas);
  game = new Game(playerCount);
  lastTime = performance.now();

  showScreen('game');
  updateHud();
  animFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (!game || game.finished) {
    if (game?.finished) {
      showResult();
      return;
    }
  }

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  game.update(dt);
  renderer.drawAll(game.bombs, game.explosions, game.players);
  updateHud();

  if (!game.finished) {
    animFrameId = requestAnimationFrame(gameLoop);
  } else {
    showResult();
  }
}

function updateHud() {
  if (!game) return;

  if (game.isSinglePlayer) {
    const p = game.players[0];
    hud.innerHTML = `
      <div class="hud-timer">${game.formatTime(game.elapsed)}</div>
      <div>${p.alive ? '生存中' : 'GAME OVER'}</div>
    `;
    return;
  }

  const playerHtml = game.players
    .map((p) => {
      const status = p.alive ? 'ALIVE' : 'OUT';
      const cls = p.alive ? '' : 'dead';
      return `
        <div class="hud-player ${cls}">
          <span class="hud-player-dot" style="background:${p.color}"></span>
          P${p.id + 1}: ${status}
        </div>
      `;
    })
    .join('');

  hud.innerHTML = `
    <div class="hud-timer">${game.formatTime(game.elapsed)}</div>
    <div class="hud-players">${playerHtml}</div>
  `;
}

function showResult() {
  if (!game?.result) return;

  const { result } = game;
  let message = '';

  if (result.type === 'timeAttack') {
    message = `生存時間<br><strong style="font-size:2rem;color:#48dbfb">${game.formatTime(result.time)}</strong>`;
  } else if (result.type === 'winner') {
    message = `<span style="color:${result.winner.color};font-size:2rem;font-weight:800">${result.winner.name} WIN!</span>`;
  } else if (result.type === 'draw') {
    message = '<span style="font-size:2rem;font-weight:800">Draw</span><br>引き分け';
  }

  resultMessage.innerHTML = message;
  showScreen('result');
}

function goToTitle() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  game = null;
  showScreen('title');
}

function init() {
  initInput();

  const mobile = isMobile();
  if (mobile) {
    applyMobileLayout();
    initVirtualJoystick();
    bindTap(screens.title, () => startGame(1));
    bindTap(screens.result, (e) => {
      if (e.target.closest('#btn-title-mobile')) return;
      startGame(1);
    });

    const btnTitleMobile = document.getElementById('btn-title-mobile');
    if (btnTitleMobile) {
      btnTitleMobile.addEventListener('click', goToTitle);
    }
  }

  document.querySelectorAll('[data-players]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const count = parseInt(btn.dataset.players, 10);
      if (mobile && count !== 1) return;
      startGame(count);
    });
  });

  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', () => startGame(playerCount));
  }

  const btnTitle = document.getElementById('btn-title');
  if (btnTitle) {
    btnTitle.addEventListener('click', goToTitle);
  }

  if (!mobile) {
    window.addEventListener('gamepadconnected', () => updateGamepadStatus(gamepadStatus));
    window.addEventListener('gamepaddisconnected', () => updateGamepadStatus(gamepadStatus));
    updateGamepadStatus(gamepadStatus);
    setInterval(() => updateGamepadStatus(gamepadStatus), 1000);
  }

  showScreen('title');
}

init();

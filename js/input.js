import { CONFIG } from './config.js';

const KEY_BINDINGS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];

const keysDown = new Set();

export function initInput() {
  window.addEventListener('keydown', (e) => {
    keysDown.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
  });

  window.addEventListener('blur', () => keysDown.clear());
}

function readKeyboard(bindings) {
  let x = 0;
  let y = 0;
  if (keysDown.has(bindings.left)) x -= 1;
  if (keysDown.has(bindings.right)) x += 1;
  if (keysDown.has(bindings.up)) y -= 1;
  if (keysDown.has(bindings.down)) y += 1;
  return normalizeInput(x, y);
}

function readGamepad(index) {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = pads[index];
  if (!pad) return { x: 0, y: 0 };

  let x = pad.axes[0] ?? 0;
  let y = pad.axes[1] ?? 0;

  if (Math.abs(x) < CONFIG.DEADZONE) x = 0;
  if (Math.abs(y) < CONFIG.DEADZONE) y = 0;

  if (x === 0 && y === 0) {
    const buttons = pad.buttons;
    if (buttons[14]?.pressed || buttons[4]?.pressed) x -= 1;
    if (buttons[15]?.pressed || buttons[5]?.pressed) x += 1;
    if (buttons[12]?.pressed || buttons[6]?.pressed) y -= 1;
    if (buttons[13]?.pressed || buttons[7]?.pressed) y += 1;
  }

  return normalizeInput(x, y);
}

function normalizeInput(x, y) {
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

export function getPlayerInput(playerIndex, playerCount) {
  if (playerIndex === 0) {
    const kb = readKeyboard(KEY_BINDINGS[0]);
    if (kb.x !== 0 || kb.y !== 0) return kb;
    return readGamepad(0);
  }
  if (playerIndex === 1 && playerCount >= 2) {
    const kb = readKeyboard(KEY_BINDINGS[1]);
    if (kb.x !== 0 || kb.y !== 0) return kb;
    return readGamepad(1);
  }
  return readGamepad(playerIndex);
}

export function getConnectedGamepadCount() {
  const pads = navigator.getGamepads?.() ?? [];
  return pads.filter((p) => p?.connected).length;
}

export function updateGamepadStatus(element) {
  if (!element) return;
  const count = getConnectedGamepadCount();
  if (count === 0) {
    element.textContent = 'ゲームパッド: 未接続（キーボードでプレイ可能）';
  } else {
    element.textContent = `ゲームパッド: ${count}台接続中`;
  }
}

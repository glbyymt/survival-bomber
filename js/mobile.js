const TAP_THRESHOLD = 12;
const TAP_MAX_DURATION = 400;
const JOYSTICK_DEADZONE = 0.15;

let touchInput = { x: 0, y: 0 };
let joystickMaxRadius = 36;
let activePointerId = null;

export function isMobile() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 768px)').matches
  ) && 'ontouchstart' in window;
}

export function getTouchInput() {
  return touchInput;
}

export function setJoystickVisible(visible) {
  const joy = document.getElementById('mobile-joystick');
  if (joy) joy.classList.toggle('hidden', !visible);
  if (!visible) resetJoystick();
}

export function initVirtualJoystick() {
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  if (!base || !knob) return;

  const updateMaxRadius = () => {
    const baseRect = base.getBoundingClientRect();
    const knobRect = knob.getBoundingClientRect();
    joystickMaxRadius = Math.max(20, (baseRect.width - knobRect.width) / 2);
  };

  updateMaxRadius();
  window.addEventListener('resize', updateMaxRadius);

  const updateFromPointer = (clientX, clientY) => {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > joystickMaxRadius) {
      dx = (dx / dist) * joystickMaxRadius;
      dy = (dy / dist) * joystickMaxRadius;
    }

    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const nx = dx / joystickMaxRadius;
    const ny = dy / joystickMaxRadius;
    const magnitude = Math.hypot(nx, ny);

    if (magnitude < JOYSTICK_DEADZONE) {
      touchInput = { x: 0, y: 0 };
      return;
    }

    touchInput = { x: nx, y: ny };
  };

  const onPointerDown = (e) => {
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    base.classList.add('active');
    updateFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (e.pointerId !== activePointerId) return;
    updateFromPointer(e.clientX, e.clientY);
    e.preventDefault();
  };

  const onPointerEnd = (e) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    base.classList.remove('active');
    resetJoystick();
  };

  base.addEventListener('pointerdown', onPointerDown);
  base.addEventListener('pointermove', onPointerMove);
  base.addEventListener('pointerup', onPointerEnd);
  base.addEventListener('pointercancel', onPointerEnd);
}

function resetJoystick() {
  const knob = document.getElementById('joystick-knob');
  if (knob) knob.style.transform = 'translate(-50%, -50%)';
  touchInput = { x: 0, y: 0 };
  activePointerId = null;

  const base = document.getElementById('joystick-base');
  if (base) base.classList.remove('active');
}

export function bindTap(element, callback) {
  if (!element) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let moved = false;

  element.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    moved = false;
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
      moved = true;
    }
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    if (moved) return;

    const dt = Date.now() - startTime;
    if (dt <= TAP_MAX_DURATION) {
      callback(e);
    }
  }, { passive: true });
}

export function applyMobileLayout() {
  document.body.classList.add('is-mobile');

  const desktopOnly = document.querySelectorAll('.desktop-only');
  desktopOnly.forEach((el) => el.classList.add('hidden'));

  const mobileOnly = document.querySelectorAll('.mobile-only');
  mobileOnly.forEach((el) => el.classList.remove('hidden'));

  setJoystickVisible(false);
}

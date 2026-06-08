const SWIPE_THRESHOLD = 24;
const TAP_THRESHOLD = 12;
const TAP_MAX_DURATION = 400;

let touchInput = { x: 0, y: 0 };
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let swipeDetected = false;

export function isMobile() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 768px)').matches
  ) && 'ontouchstart' in window;
}

export function getTouchInput() {
  return touchInput;
}

export function initTouchMovement(element) {
  if (!element) return;

  const onStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
    swipeDetected = false;
    touchInput = { x: 0, y: 0 };
  };

  const onMove = (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();

    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

    swipeDetected = true;
    if (Math.abs(dx) >= Math.abs(dy)) {
      touchInput = { x: dx > 0 ? 1 : -1, y: 0 };
    } else {
      touchInput = { x: 0, y: dy > 0 ? 1 : -1 };
    }
  };

  const onEnd = () => {
    touchInput = { x: 0, y: 0 };
    swipeDetected = false;
  };

  element.addEventListener('touchstart', onStart, { passive: true });
  element.addEventListener('touchmove', onMove, { passive: false });
  element.addEventListener('touchend', onEnd, { passive: true });
  element.addEventListener('touchcancel', onEnd, { passive: true });
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
}

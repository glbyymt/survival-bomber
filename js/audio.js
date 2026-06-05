const EXPLOSION_SRC = new URL('../effect-sound/bomber.mp3', import.meta.url).href;
const POOL_SIZE = 6;

let unlocked = false;
const pool = [];

function createAudio() {
  const audio = new Audio(EXPLOSION_SRC);
  audio.preload = 'auto';
  return audio;
}

function initPool() {
  if (pool.length > 0) return;
  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push(createAudio());
  }
}

export function unlockAudio() {
  if (unlocked) return;
  initPool();
  unlocked = true;
  const audio = pool[0];
  audio.volume = 0;
  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    })
    .catch(() => {});
}

export function playExplosionSound() {
  if (!unlocked) return;

  const audio = pool.find((a) => a.paused || a.ended) ?? pool[0];
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// Singleton audio service — plain JS, no React dependencies
// Place CC0 MP3 files in public/audio/

const MUTE_KEY = 'myBookLab_musicMuted'
const TARGET_VOLUME = 0.25
const FADE_MS = 800

export const TRACKS = {
  home:      '/audio/home.mp3',
  wizard:    '/audio/wizard.mp3',
  editor:    '/audio/editor.mp3',
  bookshelf: '/audio/bookshelf.mp3',
  gallery:   '/audio/gallery.mp3',
}

let current = null       // { audio, key, fadeTimer }
let gestureUnlocked = false

function getMuted() {
  try { return localStorage.getItem(MUTE_KEY) === 'true' } catch { return false }
}

function clearTimer(obj) {
  if (obj?.fadeTimer) { clearInterval(obj.fadeTimer); obj.fadeTimer = null }
}

function fadeIn(audio) {
  audio.volume = 0
  audio.play().catch(() => {})
  const step = TARGET_VOLUME / (FADE_MS / 50)
  const timer = setInterval(() => {
    if (audio.volume + step < TARGET_VOLUME) {
      audio.volume = Math.min(TARGET_VOLUME, audio.volume + step)
    } else {
      audio.volume = TARGET_VOLUME
      clearInterval(timer)
      if (current) current.fadeTimer = null
    }
  }, 50)
  return timer
}

export function playTrack(trackKey) {
  if (!TRACKS[trackKey]) return
  // Already playing this track — do nothing
  if (current?.key === trackKey && !current.audio.paused) return

  // Stop old track immediately
  if (current) {
    clearTimer(current)
    current.audio.pause()
    current.audio.src = ''
    current = null
  }

  const audio = new Audio(TRACKS[trackKey])
  audio.loop = true
  audio.preload = 'auto'
  current = { audio, key: trackKey, fadeTimer: null }

  if (getMuted()) return
  current.fadeTimer = fadeIn(audio)
}

export function stopMusic() {
  if (current) {
    clearTimer(current)
    current.audio.pause()
    current.audio.src = ''
    current = null
  }
}

export function toggleMute() {
  const nowMuted = !getMuted()
  try { localStorage.setItem(MUTE_KEY, String(nowMuted)) } catch {}
  if (!current) return nowMuted
  if (nowMuted) {
    clearTimer(current)
    current.audio.pause()
  } else {
    current.fadeTimer = fadeIn(current.audio)
  }
  return nowMuted
}

export function isMuted() {
  return getMuted()
}

// Call once on first user gesture to unlock iOS autoplay
export function resumeOnGesture() {
  if (gestureUnlocked || !current || getMuted()) return
  if (current.audio.paused) {
    current.fadeTimer = fadeIn(current.audio)
    gestureUnlocked = true
  }
}

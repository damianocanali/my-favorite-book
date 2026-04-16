// Singleton audio service
// On iOS native: delegates to NativeMusicPlugin (AVAudioPlayer — no gesture needed)
// On web/Android: uses HTMLAudioElement (requires user gesture)

import { Capacitor } from '@capacitor/core'

const MUTE_KEY = 'myBookLab_musicMuted'
const TARGET_VOLUME = 0.25
const FADE_MS = 800
const IS_NATIVE = Capacitor.isNativePlatform()

export const TRACKS = {
  home:      '/audio/home.mp3',
  wizard:    '/audio/wizard.mp3',
  editor:    '/audio/editor.mp3',
  bookshelf: '/audio/bookshelf.mp3',
  gallery:   '/audio/gallery.mp3',
}

// ─── Native path (iOS) ────────────────────────────────────────────────────────

async function nativePlayTrack(trackKey) {
  if (!TRACKS[trackKey]) return
  try {
    const { NativeMusic } = Capacitor.Plugins
    if (!NativeMusic) {
      console.warn('[Audio] NativeMusic plugin not found')
      return
    }
    const muted = getMuted()
    console.log('[Audio] nativePlayTrack', trackKey, 'muted:', muted)
    await NativeMusic.playTrack({ track: trackKey, muted })
  } catch (e) {
    console.error('[Audio] nativePlayTrack error', e)
  }
}

async function nativeSetMuted(muted) {
  try {
    const { NativeMusic } = Capacitor.Plugins
    if (!NativeMusic) return
    await NativeMusic.setMuted({ muted })
  } catch {}
}

// ─── Web path (HTMLAudioElement) ──────────────────────────────────────────────

let current = null   // { audio, key, fadeTimer }

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

function webPlayTrack(trackKey) {
  if (!TRACKS[trackKey]) return
  if (current?.key === trackKey && !current.audio.paused) return

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

// ─── Public API ───────────────────────────────────────────────────────────────

export function playTrack(trackKey) {
  if (IS_NATIVE) {
    nativePlayTrack(trackKey)
  } else {
    webPlayTrack(trackKey)
  }
}

export function toggleMute() {
  const nowMuted = !getMuted()
  try { localStorage.setItem(MUTE_KEY, String(nowMuted)) } catch {}

  if (IS_NATIVE) {
    // Persist to UserDefaults via key so AppDelegate reads it on next launch
    try { window.localStorage.setItem(MUTE_KEY, String(nowMuted)) } catch {}
    nativeSetMuted(nowMuted)
    return nowMuted
  }

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

// Web only — called on user gestures to unlock autoplay
export function resumeOnGesture() {
  if (IS_NATIVE || !current || getMuted()) return
  if (current.audio.paused) {
    clearTimer(current)
    current.audio.volume = TARGET_VOLUME
    current.audio.play().catch(() => {})
  }
}

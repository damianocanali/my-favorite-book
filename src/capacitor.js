import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Keyboard } from '@capacitor/keyboard'
import { App } from '@capacitor/app'
import { initNotifications } from './services/notifications'
import { supabase } from './lib/supabase'
import { initRevenueCat } from './services/purchaseService'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'

export async function initCapacitor(navigateFn) {
  if (!isNative) return

  // Dark status bar to match Galaxy Wonder theme
  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0F172A' })
  } catch {}

  // Hide splash screen once app is ready
  try {
    await SplashScreen.hide()
  } catch {}

  // Handle keyboard on iOS (push content up)
  if (platform === 'ios') {
    try {
      Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('keyboard-open')
      })
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open')
      })
    } catch {}
  }

  // Schedule daily writing reminders
  initNotifications()

  // Initialize RevenueCat IAP — user ID set after auth
  supabase.auth.getSession().then(({ data }) => {
    initRevenueCat(data?.session?.user?.id)
  })

  // Handle Android back button
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && navigateFn) {
      navigateFn(-1)
    } else {
      App.exitApp()
    }
  })

  // Handle deep links / app URL open
  App.addListener('appUrlOpen', async ({ url }) => {
    try {
      const parsed = new URL(url)

      // Supabase auth callback — exchange code for session
      const code = parsed.searchParams.get('code')
      const accessToken = parsed.searchParams.get('access_token') ||
        new URLSearchParams(parsed.hash.slice(1)).get('access_token')
      const refreshToken = parsed.searchParams.get('refresh_token') ||
        new URLSearchParams(parsed.hash.slice(1)).get('refresh_token')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        if (navigateFn) navigateFn('/login')
        return
      }

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        if (navigateFn) navigateFn('/login')
        return
      }

      // Regular deep link
      const path = parsed.pathname
      if (navigateFn && path) navigateFn(path)
    } catch {
      // Silent fail — invalid URL
    }
  })
}

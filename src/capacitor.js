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

  // Handle keyboard on iOS — pad the page by the actual keyboard height and
  // scroll the focused input into view so writing isn't hidden underneath.
  if (platform === 'ios') {
    try {
      Keyboard.addListener('keyboardWillShow', (info) => {
        const h = info?.keyboardHeight ?? 300
        document.documentElement.style.setProperty('--kb-height', `${h}px`)
        document.body.classList.add('keyboard-open')
        const el = document.activeElement
        if (el && typeof el.scrollIntoView === 'function') {
          requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
        }
      })
      Keyboard.addListener('keyboardWillHide', () => {
        document.documentElement.style.setProperty('--kb-height', '0px')
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

  // Native Stripe Payment Sheet for print orders. Dynamic import so the
  // module is only evaluated on iOS — keeps the web bundle clean.
  if (platform === 'ios') {
    try {
      const { Stripe } = await import('@capacitor-community/stripe')
      const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (key) {
        await Stripe.initialize({ publishableKey: key })
      } else {
        console.warn('[stripe-ios] VITE_STRIPE_PUBLISHABLE_KEY not set')
      }
    } catch (e) {
      console.warn('[stripe-ios] init failed', e?.message ?? e)
    }
  }

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

      // Helper: dismiss the @capacitor/browser if it was opened for
      // OAuth. Import lazily so non-OAuth deep links don't pay the cost.
      const closeOAuthBrowser = async () => {
        try {
          const { Browser } = await import('@capacitor/browser')
          await Browser.close()
        } catch {}
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        await closeOAuthBrowser()
        // After exchanging a magic-link / email-confirm code the user is
        // signed in — send them home, not to /login.
        if (navigateFn) navigateFn('/')
        return
      }

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        await closeOAuthBrowser()
        if (navigateFn) navigateFn('/')
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

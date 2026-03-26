import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Keyboard } from '@capacitor/keyboard'
import { App } from '@capacitor/app'

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

  // Handle Android back button
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && navigateFn) {
      navigateFn(-1)
    } else {
      App.exitApp()
    }
  })

  // Handle deep links / app URL open
  App.addListener('appUrlOpen', ({ url }) => {
    const path = new URL(url).pathname
    if (navigateFn && path) {
      navigateFn(path)
    }
  })
}

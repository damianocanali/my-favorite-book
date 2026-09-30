import { Component } from 'react'

// DELIBERATELY NOT ROUTED THROUGH i18n — the one screen in the app that keeps
// its copy as literals.
//
// This is the last-resort UI: it renders only once the React tree below it has
// already thrown. i18n is part of that tree's dependencies — a failed
// catalogue chunk load, a broken init, or a bad interpolation is exactly the
// kind of fault that lands here. If this boundary called t(), that same
// failure would throw a second time while rendering the fallback, React would
// unmount the whole tree, and the user would get a blank white page instead of
// an error screen with a Refresh button.
//
// A recovery screen must have no dependencies that can fail. So the strings
// below stay hardcoded on purpose. If you translate them, you trade a working
// error screen in English for a blank page in every language. Do not "fix"
// this.
// Italian is still literal text here, not t(): the copy is picked by the
// <html lang> the i18n layer last set (falling back to the browser), read
// inside a try so even that can't throw. An Italian child no longer gets
// the one English screen in the app.
const COPY = {
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred. Your books are safe — try refreshing the page.',
    refresh: 'Refresh Page',
  },
  it: {
    title: 'Qualcosa è andato storto',
    body: 'Si è verificato un errore imprevisto. I tuoi libri sono al sicuro: prova a ricaricare la pagina.',
    refresh: 'Ricarica la pagina',
  },
}

function fallbackCopy() {
  try {
    const lang = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase()
    return COPY[lang] ?? COPY.en
  } catch {
    return COPY.en
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const copy = fallbackCopy()
      return (
        <div className="min-h-screen bg-galaxy-bg flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-6xl mb-4">📚</div>
            <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
              {copy.title}
            </h1>
            <p className="font-body text-galaxy-text-muted mb-6">
              {copy.body}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 btn-fill-primary rounded-xl font-body font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {copy.refresh}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

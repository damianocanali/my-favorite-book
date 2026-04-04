import { Component } from 'react'

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
      return (
        <div className="min-h-screen bg-galaxy-bg flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-6xl mb-4">📚</div>
            <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
              Something went wrong
            </h1>
            <p className="font-body text-galaxy-text-muted mb-6">
              An unexpected error occurred. Your books are safe — try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-galaxy-primary rounded-xl font-body font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

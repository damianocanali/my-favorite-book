import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// reducedMotion="user" makes every motion component in the app honour the
// OS setting: transform and layout animations are dropped, opacity ones
// still play. That matters here more than in most apps — there are 16
// `repeat: Infinity` animations across the landing page, gallery, editor
// and welcome moment, and none of them were covered. The CSS
// prefers-reduced-motion block in index.css only ever hid .cosmic-sparkle,
// and a CSS media query cannot reach JS-driven motion values.
//
// One switch at the root rather than 16 call-site edits, so nothing can
// drift back out of compliance when someone adds the 17th animation.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>
)

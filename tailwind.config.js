/** @type {import('tailwindcss').Config} */

// Design tokens mirror the native iOS app (ios-native/MyBookLab/Views).
// The iOS app is dark-only and forces `.preferredColorScheme(.dark)`, so
// every SwiftUI semantic color is pinned here to its DARK-mode hex —
// Tailwind's stock purple-500 (#A855F7) reads noticeably duller than
// iOS's .purple (#BF5AF2).
//
// Note on surfaces: iOS cards are `.white.opacity(0.08)` over the cosmic
// gradient. `galaxy.bg-light` is the pre-blended OPAQUE equivalent so the
// ~72 existing `bg-galaxy-bg-light` callsites (and their /50 /60 opacity
// modifiers, which don't work on rgba values) keep rendering correctly.
// Use the `.glass*` utilities in index.css for true translucency.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        galaxy: {
          primary: '#BF5AF2',      // iOS .purple — primary accent
          secondary: '#64D2FF',    // iOS .cyan
          accent: '#FF375F',       // iOS .pink
          bg: '#0D0A29',           // cosmic gradient stop 1
          'bg-light': '#2C204C',   // ≈ white/8% blended over the gradient
          text: '#FFFFFF',         // iOS uses pure white for body text
          'text-muted': '#C4BBD6', // ≈ white/70% blended over the gradient
        },
        // Cosmic backdrop gradient stops (CosmicBackground.swift)
        cosmic: {
          900: '#0D0A29',
          700: '#1A0D3D',
          600: '#2E1252',
          800: '#1C0A2E',
        },
        // SparkleButton gradients (SparkleButton.swift)
        btn: {
          'primary-from': '#A657F2',
          'primary-to': '#7833D4',
          'accent-from': '#FF9E5C',
          'accent-to': '#F5668C',
        },
        // "My Book Lab" wordmark gradient (HeroLanding.swift)
        word: {
          from: '#66D9FF',
          via: '#A68CFF',
          to: '#D9A6F2',
        },
        // Remaining iOS semantic colors (dark variants)
        ios: {
          yellow: '#FFD60A',
          green: '#30D158',
          orange: '#FF9F0A',
          red: '#FF453A',
          blue: '#0A84FF',
          gray: '#8E8E93',
        },
        paper: '#FAF7ED', // book-reader page (BookDetailView)
      },
      fontFamily: {
        heading: ['"Fredoka"', 'ui-rounded', 'system-ui', 'sans-serif'],
        body: ['"Nunito"', '-apple-system', 'system-ui', 'sans-serif'],
        dyslexic: ['"OpenDyslexic"', 'sans-serif'],
      },
      borderRadius: {
        card: '18px', // the canonical iOS card
        'card-sm': '14px',
        'card-xs': '12px',
        modal: '24px',
        logo: '32px',
      },
      boxShadow: {
        // iOS .shadow(radius: r) ≈ CSS blur 2r
        'glow-purple': '0 6px 28px rgba(191, 90, 242, 0.55)',
        'glow-pink': '0 6px 28px rgba(255, 55, 95, 0.55)',
        'glow-cyan': '0 6px 28px rgba(100, 210, 255, 0.45)',
        'glow-modal': '0 10px 48px rgba(191, 90, 242, 0.60)',
        'glow-avatar': '0 6px 32px rgba(191, 90, 242, 0.50)',
        'glow-logo': '0 8px 56px rgba(191, 90, 242, 0.70)',
        // `shadow-glow` was used in 3 places but never defined — alias it
        // so those callsites finally render a shadow.
        glow: '0 6px 28px rgba(191, 90, 242, 0.55)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        sparkle: 'sparkle 1.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        // iOS parity
        'nebula-drift': 'nebulaDrift 12s ease-in-out infinite alternate',
        'logo-pulse': 'logoPulse 3s ease-in-out infinite alternate',
        'halo-pulse': 'haloPulse 3s ease-in-out infinite alternate',
        'cta-wiggle': 'ctaWiggle 3.75s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        sparkle: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.5, transform: 'scale(0.8)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(191, 90, 242, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(191, 90, 242, 0.6)' },
        },
        twinkle: {
          '0%, 100%': { opacity: 0.25 },
          '50%': { opacity: 0.95 },
        },
        // Nebula blobs drift +40x / -30y (NebulaBlob in CosmicBackground)
        nebulaDrift: {
          from: { transform: 'translate(0px, 0px)' },
          to: { transform: 'translate(40px, -30px)' },
        },
        // Hero logo breathes 1.0 ↔ 1.02, its halo 0.95 ↔ 1.05 over 3s
        logoPulse: {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.02)' },
        },
        haloPulse: {
          from: { transform: 'scale(0.95)' },
          to: { transform: 'scale(1.05)' },
        },
        // 📖 springs to +18° every 3.5s, settles back after ~250ms
        ctaWiggle: {
          '0%, 93.3%, 100%': { transform: 'rotate(0deg)' },
          '95%': { transform: 'rotate(18deg)' },
          '96.6%': { transform: 'rotate(-6deg)' },
          '98%': { transform: 'rotate(4deg)' },
        },
      },
    },
  },
  plugins: [],
}

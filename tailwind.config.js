/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        galaxy: {
          primary: '#8B5CF6',
          secondary: '#06B6D4',
          accent: '#F472B6',
          bg: '#0F172A',
          'bg-light': '#1E293B',
          text: '#F1F5F9',
          'text-muted': '#94A3B8',
        },
      },
      fontFamily: {
        heading: ['"Fredoka"', 'sans-serif'],
        body: ['"Nunito"', 'sans-serif'],
        dyslexic: ['"OpenDyslexic"', 'sans-serif'],
      },
      boxShadow: {
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.2)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.2)',
        'glow-pink': '0 0 20px rgba(244, 114, 182, 0.5), 0 0 40px rgba(244, 114, 182, 0.2)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        sparkle: 'sparkle 1.5s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.6)' },
        },
        twinkle: {
          '0%, 100%': { opacity: 0.3 },
          '50%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}

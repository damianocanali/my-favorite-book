import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The address a teacher who lost their 2-step phone writes to
// (src/lib/mfa.js supportEmail). Read at build time from the server env.
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.PRINT_OPS_EMAIL || 'support@mybooklab.app'

export default defineConfig({
  plugins: [react()],
  define: { __SUPPORT_EMAIL__: JSON.stringify(SUPPORT_EMAIL) },
  server: {
    port: 3000,
    open: true,
  },
})

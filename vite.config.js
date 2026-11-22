import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages set VITE_BASE=/<repo-name>/ (e.g. /daily-delivery-manager/)
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})

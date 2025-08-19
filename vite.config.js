import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages base path for repo: galvinradleyngo/dart
export default defineConfig({
  plugins: [react()],
  base: '/dart/',
})

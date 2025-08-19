import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: base must match your repo name
export default defineConfig({
  plugins: [react()],
  base: '/dart/',
})

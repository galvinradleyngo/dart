import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: change REPO-NAME to your repository name
export default defineConfig({
  plugins: [react()],
  base: '/dart/',
})

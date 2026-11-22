import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative Pfade, damit der Build auch aus einem Unterordner oder statisch gehostet läuft.
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true },
})

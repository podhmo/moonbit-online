import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig(({ command, mode }) => ({
  base: command === 'build' || mode === 'production' ? '/moonbit-online/' : '/',
  plugins: [preact()],
  worker: {
    format: 'es'
  },
  build: {
    minify: false
  },
  optimizeDeps: {
    exclude: ['@moonbit/moonc-worker']
  }
}))

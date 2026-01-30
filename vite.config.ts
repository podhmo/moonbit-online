import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: '/moonbit-online/',
  plugins: [preact()],
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@moonbit/moonc-worker']
  }
})

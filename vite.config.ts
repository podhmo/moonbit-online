import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const moonpadPkgPath = join(__dirname, 'node_modules/@moonbit/moonpad-monaco/package.json')
const moonpadVersion: string = JSON.parse(readFileSync(moonpadPkgPath, 'utf-8')).version

export default defineConfig(({ command, mode }) => ({
  base: command === 'build' || mode === 'production' ? '/moonbit-online/' : '/',
  plugins: [preact()],
  define: {
    __MOONPAD_VERSION__: JSON.stringify(moonpadVersion),
  },
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

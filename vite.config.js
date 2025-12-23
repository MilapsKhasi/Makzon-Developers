import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const _dirname = path.dirname(__filename)
const _filename = fileURLToPath(import.meta.url)

export default defineConfig({
plugins: [react()],
resolve: {
  alias: {
      '@': path.resolve(__dirname, '/src'),
    },
  },
}) 

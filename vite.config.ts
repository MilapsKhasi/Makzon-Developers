import { defineConfig } from 'Vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const _filename = fileURLToPath(import.meta.url)
const _dirname = path.dirname(__filename)

export default defineConfig({
plugins: [react()],
resolve: {
  alias: {
      '@': path.resolve(__dirname, '/src'),
    },
  },
}) 

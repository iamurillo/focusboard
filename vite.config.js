import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'FocusBoard',
        short_name: 'FocusBoard',
        description: 'Gestor de tareas inteligente tipo Kanban',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})

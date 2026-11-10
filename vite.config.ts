/**
 * Modul: Vite Build- & Entwicklungs-Konfiguration
 * Zweck: Konfiguriert React, Tailwind v4 und den relativen Base-Pfad für GitHub Pages
 * Sicherheitsrelevanz: Erzeugt rein statische, isolierte Bundle-Artefakte
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 3000,
    host: true,
  },
});

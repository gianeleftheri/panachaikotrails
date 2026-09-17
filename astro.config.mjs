import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://panachaikotrails.gr',
  vite: {
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    ssr: {
      noExternal: ['maplibre-gl'],
    },
  },
});

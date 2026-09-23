import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://panachaikotrails.gr',
  output: 'server',
  adapter: vercel(),
  trailingSlash: 'never',
  build: {
    inlineStylesheets: 'always',
  },
  vite: {
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
    ssr: {
      noExternal: ['maplibre-gl'],
    },
  },
});

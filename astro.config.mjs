import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://panachaikotrails.gr',
  vite: {
    optimizeDeps: {
      // MapLibre GL v6 uses an ESM worker that can be broken by Vite dependency
      // pre-bundling. When that happens the raster/terrain canvas still renders,
      // but GeoJSON-backed layers (trail/navigation lines) can silently disappear.
      exclude: ['maplibre-gl'],
    },
  },
});

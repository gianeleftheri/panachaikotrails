import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre GL JS v6 needs an explicit worker URL when bundled with Vite.
// Raster and DEM tiles can still render when the worker is broken, while
// GeoJSON/vector sources stay unloaded. Bundle a self-contained worker and
// register it once before any 3D map instance is created.
setWorkerUrl(workerUrl);

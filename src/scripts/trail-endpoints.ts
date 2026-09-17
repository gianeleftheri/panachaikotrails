import L from 'leaflet';
import { getTrailNavigationConfig } from '../data/trail-navigation';

const runtime = window as typeof window & {
  __panachaikoMap?: L.Map;
};

const trailList = document.getElementById('trail-list');
let endpointLayer: L.LayerGroup | null = null;
let lastCode = '';

const waypointIcon = (label: 'Α' | 'Τ', start: boolean) => L.divIcon({
  className: '',
  html: `<div class="nav-route-waypoint ${start ? 'nav-route-start' : 'nav-route-end'}">${label}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const ensureLayer = () => {
  const map = runtime.__panachaikoMap;
  if (!map) return null;
  if (!endpointLayer) endpointLayer = L.layerGroup().addTo(map);
  else if (!map.hasLayer(endpointLayer) && !document.body.classList.contains('navigation-active')) endpointLayer.addTo(map);
  return endpointLayer;
};

const selectedCode = () => document
  .querySelector<HTMLElement>('.trail-row.active .trail-row-code')
  ?.textContent
  ?.trim() ?? '';

const renderSelectedEndpoints = () => {
  const code = selectedCode();
  const layer = ensureLayer();
  if (!layer) return;
  if (code === lastCode && layer.getLayers().length === 2) return;

  lastCode = code;
  layer.clearLayers();
  if (!code) return;

  const config = getTrailNavigationConfig(code);
  if (!config) return;

  const startTooltip = config.startLabel
    ? `Αφετηρία Α · ${config.startLabel}`
    : `Αφετηρία Α · ${code}`;
  const endTooltip = config.endLabel
    ? `Τέλος Τ · ${config.endLabel}`
    : `Τέλος Τ · ${code}`;

  L.marker(config.start, { icon: waypointIcon('Α', true), interactive: true, zIndexOffset: 900 })
    .bindTooltip(startTooltip, { direction: 'top', offset: [0, -12] })
    .addTo(layer);

  L.marker(config.end, { icon: waypointIcon('Τ', false), interactive: true, zIndexOffset: 900 })
    .bindTooltip(endTooltip, { direction: 'top', offset: [0, -12] })
    .addTo(layer);
};

if (trailList) {
  const observer = new MutationObserver(() => window.requestAnimationFrame(renderSelectedEndpoints));
  observer.observe(trailList, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.requestAnimationFrame(renderSelectedEndpoints);
}

document.addEventListener('panachaiko:navigation-exit', () => {
  lastCode = '';
  window.requestAnimationFrame(renderSelectedEndpoints);
});

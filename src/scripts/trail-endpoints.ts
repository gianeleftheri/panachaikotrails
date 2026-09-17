import L from 'leaflet';
import { getTrailNavigationConfig } from '../data/trail-navigation';

type RoutePoint = [number, number];
type NavigationPlan = {
  code: string;
  points: RoutePoint[];
  approachPointCount?: number;
};

const runtime = window as typeof window & {
  __panachaikoMap?: L.Map;
};

let endpointLayer: L.LayerGroup | null = null;
let renderKey = '';

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

const clearEndpoints = () => {
  renderKey = '';
  endpointLayer?.clearLayers();
};

const renderPair = (
  start: RoutePoint,
  end: RoutePoint,
  startTooltip: string,
  endTooltip: string,
  key: string
) => {
  if (document.body.classList.contains('navigation-active')) return;
  const layer = ensureLayer();
  if (!layer) return;
  if (renderKey === key && layer.getLayers().length === 2) return;

  renderKey = key;
  layer.clearLayers();

  L.marker(start, { icon: waypointIcon('Α', true), interactive: true, zIndexOffset: 900 })
    .bindTooltip(startTooltip, { direction: 'top', offset: [0, -12] })
    .addTo(layer);

  L.marker(end, { icon: waypointIcon('Τ', false), interactive: true, zIndexOffset: 900 })
    .bindTooltip(endTooltip, { direction: 'top', offset: [0, -12] })
    .addTo(layer);
};

const renderTrailEndpoints = (code: string) => {
  const config = getTrailNavigationConfig(code);
  if (!config) {
    clearEndpoints();
    return;
  }

  renderPair(
    config.start,
    config.end,
    config.startLabel ? `Αφετηρία Α · ${config.startLabel}` : `Αφετηρία Α · ${code}`,
    config.endLabel ? `Τέλος Τ · ${config.endLabel}` : `Τέλος Τ · ${code}`,
    `trail|${code}|${config.start.join(',')}|${config.end.join(',')}`
  );
};

const renderRouteEndpoints = (plan: NavigationPlan) => {
  if (!plan?.points?.length) {
    clearEndpoints();
    return;
  }

  const splitIndex = Math.max(
    0,
    Math.min(plan.points.length - 1, Math.max(1, plan.approachPointCount ?? 1) - 1)
  );
  const start = plan.points[splitIndex];
  const end = plan.points.at(-1);
  if (!start || !end) {
    clearEndpoints();
    return;
  }

  const config = getTrailNavigationConfig(plan.code);
  renderPair(
    start,
    end,
    config?.startLabel ? `Αφετηρία Α · ${config.startLabel}` : `Αφετηρία Α · ${plan.code}`,
    config?.endLabel ? `Τέλος Τ · ${config.endLabel}` : `Τέλος Τ · ${plan.code}`,
    `route|${plan.code}|${start.join(',')}|${end.join(',')}`
  );
};

// Trail selection (from list, map line, POI, etc.) shows the selected trail A/T.
document.addEventListener('panachaiko:trail-selected', event => {
  const code = (event as CustomEvent<{ code?: string }>).detail?.code?.trim() ?? '';
  if (code) renderTrailEndpoints(code);
  else clearEndpoints();
});

// A completed route calculation replaces any old markers with the calculated route A/T.
document.addEventListener('panachaiko:route-preview', event => {
  renderRouteEndpoints((event as CustomEvent<NavigationPlan>).detail);
});

document.addEventListener('panachaiko:endpoints-clear', clearEndpoints);

// Live navigation owns its own A/T markers, so preview markers must disappear.
document.addEventListener('panachaiko:navigation-start', clearEndpoints);
document.addEventListener('panachaiko:navigation-exit', clearEndpoints);

// Switching context or using an unrelated control clears stale A/T immediately.
[
  'trailMenuToggle',
  'routeBuilderToggle',
  'locateBtn',
  'recenterBtn',
  'rbGpsBtn',
  'shelterBtn',
  'view3dBtn',
  'tdClose'
].forEach(id => {
  document.getElementById(id)?.addEventListener('click', clearEndpoints, { capture: true });
});

// Choosing a trail inside the route-builder is a relevant selection, so show that trail's A/T.
// A later successful calculation will replace these with the exact computed route endpoints.
document.getElementById('rbTrailSelect')?.addEventListener('change', event => {
  const code = (event.currentTarget as HTMLSelectElement).value.trim();
  if (code) renderTrailEndpoints(code);
  else clearEndpoints();
});

// Defensive fallback for list clicks in case a selection event is delayed by another UI handler.
document.getElementById('trail-list')?.addEventListener('click', event => {
  const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('.trail-row');
  const code = row?.querySelector<HTMLElement>('.trail-row-code')?.textContent?.trim() ?? '';
  if (code) window.requestAnimationFrame(() => renderTrailEndpoints(code));
});

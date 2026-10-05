import { trailIcon } from '../lib/trail-icons';
import L from 'leaflet';

import { API_URL, fallbackSpots, type RecreationSpot } from '../data/recreation-spots';

const runtime = window as typeof window & { __panachaikoMap?: L.Map };

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const normalize = (raw: unknown): RecreationSpot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const elevation = item.elevation_m === null || item.elevation_m === undefined || item.elevation_m === '' ? null : Number(item.elevation_m);
  return {
    id: typeof item.id === 'number' || typeof item.id === 'string' ? item.id : Math.random().toString(36).slice(2),
    title: typeof item.title === 'string' ? item.title : 'Σημείο αναψυχής',
    description: typeof item.description === 'string' ? item.description : '',
    type: typeof item.type === 'string' ? item.type : 'recreation_viewpoint',
    settlement: typeof item.settlement === 'string' ? item.settlement : '',
    lat,
    lng,
    elevation_m: Number.isFinite(elevation) ? elevation : null,
    featured_image_url: typeof item.featured_image_url === 'string' && item.featured_image_url ? item.featured_image_url : null,
    fallback_image_url: typeof item.fallback_image_url === 'string' && item.fallback_image_url ? item.fallback_image_url : null,
    source_url: typeof item.source_url === 'string' ? item.source_url : ''
  };
};

const loadSpots = async (): Promise<RecreationSpot[]> => {
  try {
    const response = await fetch(API_URL, { headers:{Accept:'application/json'}, cache:'no-store', credentials:'omit' });
    if (!response.ok) return fallbackSpots;
    const payload = await response.json();
    if (!Array.isArray(payload)) return fallbackSpots;
    const normalized = payload.map(normalize).filter((spot): spot is RecreationSpot => Boolean(spot));
    return normalized.length ? normalized : fallbackSpots;
  } catch {
    return fallbackSpots;
  }
};

const spotTypeLabel = (spot: RecreationSpot) =>
  spot.type === 'watchtower_site' ? 'Θέση πυροφυλακίου / θέας' :
  spot.type === 'other' ? 'Σημείο ενδιαφέροντος' : 'Χώρος αναψυχής / θέας';

const popupHtml = (spot: RecreationSpot) => {
  const imageUrl = spot.featured_image_url || spot.fallback_image_url;
  const image = imageUrl
    ? '<img class="recreation-popup-image" src="' + escapeHtml(imageUrl) + '" alt="" />'
    : '';
  const elevation = spot.elevation_m !== null ? ' · ' + Math.round(spot.elevation_m) + ' μ.' : '';
  const source = spot.source_url
    ? '<a class="recreation-popup-source" href="' + escapeHtml(spot.source_url) + '" target="_blank" rel="noopener">Πηγή πληροφοριών</a>'
    : '';
  return '<div class="recreation-popup">' +
    image +
    '<div class="recreation-popup-type">' + escapeHtml(spotTypeLabel(spot)) + '</div>' +
    '<strong>' + escapeHtml(spot.title) + '</strong>' +
    '<div class="recreation-popup-meta">' + escapeHtml(spot.settlement) + elevation + '</div>' +
    (spot.description ? '<p>' + escapeHtml(spot.description) + '</p>' : '') +
    '<div class="recreation-popup-coords">' + spot.lat.toFixed(6) + ', ' + spot.lng.toFixed(6) + '</div>' +
    source +
    '</div>';
};

const start = async () => {
  const map = runtime.__panachaikoMap;
  if (!map) {
    window.setTimeout(() => void start(), 60);
    return;
  }

  const panel = document.getElementById('recreationPanel');
  const list = document.getElementById('recreation-list');
  const count = document.getElementById('recreation-count');
  const toggle = document.getElementById('recreationMenuToggle') as HTMLButtonElement | null;
  const pin = document.getElementById('recreationPanelPin') as HTMLButtonElement | null;
  const close = document.getElementById('recreationPanelClose') as HTMLButtonElement | null;
  if (!panel || !list || !toggle) return;

  const spots = await loadSpots();
  if (count) count.textContent = String(spots.length);

  const layer = L.layerGroup();
  const markerById = new Map<string, L.Marker>();
  const rowById = new Map<string, HTMLButtonElement>();

  const iconFor = () => L.divIcon({
    className: 'recreation-marker-wrap',
    html: '<span class="recreation-map-pin"><span>' + trailIcon('rest') + '</span></span>',
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36]
  });

  spots.forEach(spot => {
    const id = String(spot.id);
    const marker = L.marker([spot.lat, spot.lng], { icon: iconFor(), keyboard:true })
      .bindPopup(popupHtml(spot), { maxWidth:320, className:'recreation-leaflet-popup' })
      .on('click', () => {
        rowById.forEach(row => row.classList.remove('active'));
        rowById.get(id)?.classList.add('active');
      });
    marker.addTo(layer);
    markerById.set(id, marker);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'recreation-row';
    row.innerHTML =
      '<span class="recreation-row-pin">' + trailIcon('rest') + '</span>' +
      '<span class="recreation-row-copy">' +
        '<span class="recreation-row-name">' + escapeHtml(spot.title) + '</span>' +
        '<span class="recreation-row-meta">' + escapeHtml(spot.settlement) + (spot.elevation_m !== null ? ' · ' + Math.round(spot.elevation_m) + ' μ.' : '') + '</span>' +
      '</span>';
    row.addEventListener('click', () => {
      rowById.forEach(item => item.classList.remove('active'));
      row.classList.add('active');
      map.flyTo([spot.lat, spot.lng], 15, { animate:true, duration:.7 });
      marker.openPopup();
      closeRecreationPanelAfterSelection();
    });
    list.appendChild(row);
    rowById.set(id, row);
  });

  const setOpen = (open: boolean, keepLayer = false) => {
    panel.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));

    if (open) {
      if (!desktopPanelQuery.matches) {
        document.getElementById('trailPanel')?.classList.remove('open');
        document.getElementById('trailMenuToggle')?.classList.remove('open');
        document.getElementById('trailMenuToggle')?.setAttribute('aria-expanded', 'false');
      }
      document.getElementById('routeBuilderPanel')?.classList.remove('open');
      document.getElementById('routeBuilderToggle')?.classList.remove('open');
      document.getElementById('shelterPanel')?.classList.remove('show');
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else if (!keepLayer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  };

  const desktopPanelQuery = window.matchMedia('(min-width: 761px)');
  const panelPinStorageKey = 'panachaiko-recreation-panel-pinned';
  let recreationPanelPinned = false;

  const syncRecreationPanelPin = (openWhenPinned = false) => {
    const storedPinned = window.localStorage.getItem(panelPinStorageKey) === '1';
    recreationPanelPinned = desktopPanelQuery.matches && storedPinned;
    panel.classList.toggle('pinned', recreationPanelPinned);
    pin?.classList.toggle('active', recreationPanelPinned);
    pin?.setAttribute('aria-pressed', String(recreationPanelPinned));
    pin?.setAttribute('title', recreationPanelPinned ? 'Το παράθυρο μένει ανοιχτό' : 'Κράτησε το παράθυρο ανοιχτό');
    if (openWhenPinned && recreationPanelPinned) setOpen(true);
  };

  const closeRecreationPanelAfterSelection = () => {
    if (!recreationPanelPinned || !desktopPanelQuery.matches) setOpen(false, true);
  };

  syncRecreationPanelPin(true);
  desktopPanelQuery.addEventListener('change', () => syncRecreationPanelPin(false));

  pin?.addEventListener('click', event => {
    event.stopPropagation();
    const nextPinned = !(desktopPanelQuery.matches && window.localStorage.getItem(panelPinStorageKey) === '1');
    window.localStorage.setItem(panelPinStorageKey, nextPinned ? '1' : '0');
    syncRecreationPanelPin(true);
  });

  toggle.addEventListener('click', event => {
    event.preventDefault();
    setOpen(!panel.classList.contains('open'));
  });
  close?.addEventListener('click', () => setOpen(false));

  document.getElementById('trailMenuToggle')?.addEventListener('click', () => {
    if (!desktopPanelQuery.matches && panel.classList.contains('open')) setOpen(false);
  });
  document.getElementById('routeBuilderToggle')?.addEventListener('click', () => {
    if (panel.classList.contains('open')) setOpen(false);
  });
};

void start();

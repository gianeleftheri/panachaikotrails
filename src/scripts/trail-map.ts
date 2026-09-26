import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Trail, TrailCollection, TrailPoi, TrailPoint } from '../types/trail';
import { loadInitialTrails, refreshTrailsFromCms, P14_REFERENCE } from './trail-data';
import { createTrailContentController } from './trail-content';

type UserPosition = { lat: number; lng: number; accuracy: number };

let trails: TrailCollection = loadInitialTrails();
const app = document.querySelector<HTMLElement>('[data-trail-app]');
const runtime = window as typeof window & { __panachaikoTrails?: TrailCollection };

if (app) {
  const mapElement = document.getElementById('map');
  const trailList = document.getElementById('trail-list');
  const trailPanel = document.getElementById('trailPanel');
  const trailPanelPin = document.getElementById('trailPanelPin') as HTMLButtonElement | null;
  const trailPanelClose = document.getElementById('trailPanelClose') as HTMLButtonElement | null;
  const trailMenuToggle = document.getElementById('trailMenuToggle') as HTMLButtonElement | null;
  const routeBuilderToggle = document.getElementById('routeBuilderToggle') as HTMLButtonElement | null;
  const routeBuilderPanel = document.getElementById('routeBuilderPanel');
  const trailDrawer = document.getElementById('trailDrawer');
  const trailDrawerHandle = document.getElementById('trailDrawerHandle');
  const tdClose = document.getElementById('tdClose');
  const tdTabs = document.getElementById('tdTabs');
  const tdTitleBlock = document.getElementById('tdTitleBlock');
  const tdCardBar = document.getElementById('tdCardBar');
  const locateBtn = document.getElementById('locateBtn') as HTMLButtonElement | null;
  const recenterBtn = document.getElementById('recenterBtn') as HTMLButtonElement | null;
  const rbGpsBtn = document.getElementById('rbGpsBtn') as HTMLButtonElement | null;
  const rbGpsStatus = document.getElementById('rbGpsStatus');
  const rbTrailSelect = document.getElementById('rbTrailSelect') as HTMLSelectElement | null;
  const rbCalcBtn = document.getElementById('rbCalcBtn') as HTMLButtonElement | null;
  const rbResultStatus = document.getElementById('rbResultStatus');
  const distanceBadge = document.getElementById('distanceBadge');
  const shelterBtn = document.getElementById('shelterBtn');
  const shelterPanel = document.getElementById('shelterPanel');
  const view3dBtn = document.getElementById('view3dBtn');
  const view3dOverlay = document.getElementById('view3dOverlay');
  const view3dClose = document.getElementById('view3dClose');
  const view3dTitle = document.getElementById('view3dTitle');

  if (!mapElement || !trailList || !trailPanel || !trailDrawer || !tdTabs || !tdTitleBlock || !tdCardBar) throw new Error('Missing trail explorer elements.');

  const map = L.map(mapElement, { zoomControl: false }).setView([38.2, 21.835], 12);
  map.createPane('trafficPane');
  const trafficPane = map.getPane('trafficPane');
  if (trafficPane) {
    trafficPane.style.zIndex = '350';
    trafficPane.style.pointerEvents = 'none';
  }
  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors | Μονοπάτια: ΟΦΥΠΕΚΑ'
  });
  const imageryLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Tiles © Esri, Maxar, Earthstar Geographics | Μονοπάτια: ΟΦΥΠΕΚΑ'
  });
  const imageryLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    opacity: .85,
    pane: 'overlayPane',
    attribution: 'Labels © Esri'
  });
  const terrainLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Topographic map © Esri | Μονοπάτια: ΟΦΥΠΕΚΑ'
  });
  const tomtomTrafficKey = import.meta.env.PUBLIC_TOMTOM_API_KEY?.trim() ?? '';
  const trafficLayer = tomtomTrafficKey
    ? L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${encodeURIComponent(tomtomTrafficKey)}`, {
        maxZoom: 22,
        opacity: .82,
        pane: 'trafficPane',
        attribution: 'Κυκλοφορία © TomTom'
      })
    : null;

  type BasemapKind = 'street' | 'satellite' | 'terrain';
  const basemaps: Record<BasemapKind, L.TileLayer[]> = {
    street: [streetLayer],
    satellite: [imageryLayer, imageryLabels],
    terrain: [terrainLayer]
  };
  let activeBasemap: BasemapKind = 'satellite';
  let trafficEnabled = false;

  const setBasemap = (kind: BasemapKind) => {
    (Object.keys(basemaps) as BasemapKind[]).forEach(key => {
      basemaps[key].forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    });
    basemaps[kind].forEach(layer => layer.addTo(map));
    activeBasemap = kind;
    window.localStorage.setItem('panachaiko-basemap', kind);
    mapElement.dataset.basemap = kind;
    document.querySelectorAll<HTMLButtonElement>('[data-basemap]').forEach(button => {
      const selected = button.dataset.basemap === kind;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  const setTrafficEnabled = (enabled: boolean) => {
    trafficEnabled = Boolean(enabled && trafficLayer);
    if (trafficLayer) {
      if (trafficEnabled && !map.hasLayer(trafficLayer)) trafficLayer.addTo(map);
      if (!trafficEnabled && map.hasLayer(trafficLayer)) map.removeLayer(trafficLayer);
    }
    window.localStorage.setItem('panachaiko-traffic', trafficEnabled ? '1' : '0');
    document.querySelectorAll<HTMLButtonElement>('[data-traffic-toggle]').forEach(button => {
      button.classList.toggle('active', trafficEnabled);
      button.setAttribute('aria-pressed', String(trafficEnabled));
    });
  };

  const savedBasemap = window.localStorage.getItem('panachaiko-basemap');
  const initialBasemap: BasemapKind = savedBasemap === 'street' || savedBasemap === 'terrain' ? savedBasemap : 'satellite';
  setBasemap(initialBasemap);
  setTrafficEnabled(window.localStorage.getItem('panachaiko-traffic') === '1');

  const createBasemapControl = () => {
      const control = L.DomUtil.create('div', 'basemap-control');
      control.innerHTML = `
        <button class="basemap-toggle" type="button" aria-label="Χάρτες" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></svg>
          <span>Χάρτες</span>
        </button>
        <div class="basemap-menu" role="group" aria-label="Επιλογή τύπου χάρτη">
          <div class="basemap-menu-title">Τύπος χάρτη</div>
          <div class="basemap-options">
            <button type="button" data-basemap="street" aria-pressed="false"><span class="basemap-preview preview-street"><i></i></span><strong>Προεπιλεγμένο</strong></button>
            <button type="button" data-basemap="satellite" aria-pressed="false"><span class="basemap-preview preview-satellite"><i></i></span><strong>Δορυφόρος</strong></button>
            <button type="button" data-basemap="terrain" aria-pressed="false"><span class="basemap-preview preview-terrain"><i></i></span><strong>Έδαφος</strong></button>
          </div>
          <div class="basemap-divider"></div>
          <button class="traffic-option" type="button" data-traffic-toggle aria-pressed="false" ${trafficLayer ? '' : 'disabled'}>
            <span class="traffic-copy"><strong>Κυκλοφορία</strong><small>${trafficLayer ? 'Ζωντανή ροή στους δρόμους' : 'Απαιτείται TomTom API key'}</small></span>
            <span class="traffic-scale" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span class="traffic-switch" aria-hidden="true"><i></i></span>
          </button>
        </div>`;

      L.DomEvent.disableClickPropagation(control);
      L.DomEvent.disableScrollPropagation(control);
      const toggle = control.querySelector<HTMLButtonElement>('.basemap-toggle');
      const menu = control.querySelector<HTMLElement>('.basemap-menu');
      toggle?.addEventListener('click', () => {
        const open = !control.classList.contains('open');
        control.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
      });
      control.querySelectorAll<HTMLButtonElement>('[data-basemap]').forEach(button => {
        button.addEventListener('click', () => {
          const kind = button.dataset.basemap as BasemapKind;
          setBasemap(kind);
          control.classList.remove('open');
          toggle?.setAttribute('aria-expanded', 'false');
        });
      });
      control.querySelector<HTMLButtonElement>('[data-traffic-toggle]')?.addEventListener('click', () => {
        setTrafficEnabled(!trafficEnabled);
      });
      document.addEventListener('click', event => {
        if (!control.contains(event.target as Node)) {
          control.classList.remove('open');
          toggle?.setAttribute('aria-expanded', 'false');
        }
      });
      window.setTimeout(() => {
        setBasemap(activeBasemap);
        setTrafficEnabled(trafficEnabled);
      }, 0);
      return control;
  };
  document.querySelector('.topbar-actions')?.appendChild(createBasemapControl());
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

  const layers = new Map<string, L.FeatureGroup>();
  const visibleLines = new Map<string, L.Polyline[]>();
  const poiLayer = L.layerGroup().addTo(map);
  const poiRegistry = new Map<string, { code: string; poi: TrailPoi }>();
  const activePoiMarkers = new Map<string, L.Marker>();
  const allBounds: L.LatLngExpression[] = [];
  let codes: string[] = [];
  let selectedCode: string | null = null;
  // Διατηρεί την τελευταία ρητή επιλογή του χρήστη ακόμη κι όταν τα δεδομένα
  // ανανεώνονται από το WordPress και η λίστα/τα layers ξαναχτίζονται.
  let requestedCode: string | null = null;
  let userPosition: UserPosition | null = null;
  let watchId: number | null = null;
  let userMarker: L.Marker | null = null;
  let routeLine: L.Polyline | null = null;
  let shelterLine: L.Polyline | null = null;
  let selectionPulseTimers: number[] = [];
  let autoCalculateAfterGps = false;

  const contentController = createTrailContentController(map, code => trails[code]);

  const desktopPanelQuery = window.matchMedia('(min-width: 761px)');
  const panelPinStorageKey = 'panachaiko-trail-panel-pinned';
  let trailPanelPinned = false;

  const setTrailPanelOpen = (open: boolean) => {
    trailPanel.classList.toggle('open', open);
    trailMenuToggle?.classList.toggle('open', open);
    trailMenuToggle?.setAttribute('aria-expanded', String(open));
  };

  const syncTrailPanelPin = (openWhenPinned = false) => {
    const storedPinned = window.localStorage.getItem(panelPinStorageKey) === '1';
    trailPanelPinned = desktopPanelQuery.matches && storedPinned;
    trailPanel.classList.toggle('pinned', trailPanelPinned);
    trailPanelPin?.classList.toggle('active', trailPanelPinned);
    trailPanelPin?.setAttribute('aria-pressed', String(trailPanelPinned));
    trailPanelPin?.setAttribute('title', trailPanelPinned ? 'Το παράθυρο μένει ανοιχτό' : 'Κράτησε το παράθυρο ανοιχτό');
    if (openWhenPinned && trailPanelPinned) setTrailPanelOpen(true);
  };

  const closeTrailPanelAfterSelection = () => {
    if (!trailPanelPinned || !desktopPanelQuery.matches) setTrailPanelOpen(false);
  };

  syncTrailPanelPin(true);
  desktopPanelQuery.addEventListener('change', () => syncTrailPanelPin(false));

  trailPanelPin?.addEventListener('click', event => {
    event.stopPropagation();
    const nextPinned = !(desktopPanelQuery.matches && window.localStorage.getItem(panelPinStorageKey) === '1');
    window.localStorage.setItem(panelPinStorageKey, nextPinned ? '1' : '0');
    syncTrailPanelPin(true);
  });

  trailPanelClose?.addEventListener('click', event => {
    event.stopPropagation();
    setTrailPanelOpen(false);
  });

  const escapeHtml = (value: unknown) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const routeIcon = '<svg viewBox="0 0 20 30" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 26c4-2 6-4 5-7s4-4 5-7c1-2-2-3 2-8" /></svg>';
  const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}ω ${String(minutes % 60).padStart(2, '0')}′`;

  const styleFor = (trail: Trail, active = false): L.PathOptions => ({
    color: trail.color || '#84a06e',
    weight: active ? 6 : 3.5,
    opacity: active ? .98 : .82,
    lineCap: 'round',
    lineJoin: 'round'
  });

  const setTrailStyle = (code: string, active = false, hover = false) => {
    const trail = trails[code];
    if (!trail) return;
    const style = styleFor(trail, active);
    if (hover && !active) {
      style.weight = 5.5;
      style.opacity = .98;
    }
    visibleLines.get(code)?.forEach(line => {
      line.setStyle(style);
      if (active) line.bringToFront();
    });
  };

  const pulseTrailSelection = (code: string) => {
    selectionPulseTimers.forEach(timer => window.clearTimeout(timer));
    selectionPulseTimers = [];

    // Έντεκα βήματα ανά 150 ms: τελική σταθεροποίηση στο 1,5 δευτερόλεπτο.
    for (let step = 0; step < 11; step += 1) {
      const timer = window.setTimeout(() => {
        if (selectedCode !== code) return;
        const dimmed = step % 2 === 0;
        visibleLines.get(code)?.forEach(line => line.setStyle({
          opacity: dimmed ? .22 : 1,
          weight: dimmed ? 4 : 8
        }));
        if (step === 10) setTrailStyle(code, true);
      }, step * 150);
      selectionPulseTimers.push(timer);
    }
  };

  const poiEmoji = (category?: string) => ({
    forest: '🌲', viewpoint: '👁️', rest: '🪑', danger: '⚠️', hazard: '⚠️', water: '💧', flag: '🚩', shelter: '⛺', archaeological: '🏛️', photo: '📷', video: '🎬', note: '📍', general: '📍'
  }[category ?? 'general'] ?? '📍');

  const poiLabel = (category?: string) => ({
    forest: 'Δάσος', viewpoint: 'Θέα', rest: 'Ξεκούραση', danger: 'Προσοχή', hazard: 'Κίνδυνος', water: 'Νερό', flag: 'Αφετηρία/Τέλος', shelter: 'Καταφύγιο', archaeological: 'Αρχαιολογικός χώρος', photo: 'Φωτογραφία', video: 'Βίντεο', note: 'Ένδειξη', general: 'Σημείο'
  }[category ?? 'general'] ?? 'Σημείο');

  const poiKey = (code: string, kind: string, index: number, poi: TrailPoi) =>
    `${code}:${kind}:${encodeURIComponent(String(poi.id ?? index))}`;

  const setPoiButtonActive = (key: string, active: boolean) => {
    trailDrawer.querySelectorAll<HTMLButtonElement>('.poi-map-btn').forEach(button => {
      if (button.dataset.poiKey !== key) return;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? '✓ Στον χάρτη' : '📍 Εμφάνιση στον χάρτη';
    });
  };

  const clearSelectedPoiMarkers = () => {
    poiLayer.clearLayers();
    activePoiMarkers.clear();
    trailDrawer.querySelectorAll<HTMLButtonElement>('.poi-map-btn').forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
      button.textContent = '📍 Εμφάνιση στον χάρτη';
    });
  };

  const showPoiOnMap = (key: string) => {
    const item = poiRegistry.get(key);
    if (!item || typeof item.poi.lat !== 'number' || typeof item.poi.lng !== 'number') return;

    let marker = activePoiMarkers.get(key);
    if (!marker) {
      const { code, poi } = item;
      const icon = L.divIcon({
        className: 'trail-poi-marker-wrap',
        html: `<div class="trail-poi-marker" title="${escapeHtml(poiLabel(poi.category))}">${poiEmoji(poi.category)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      marker = L.marker([poi.lat, poi.lng], { icon }).addTo(poiLayer);
      marker.bindPopup(`<div class="poi-popup"><strong>${escapeHtml(poi.title ?? poiLabel(poi.category))}</strong><div>${escapeHtml(poiLabel(poi.category))} · ${escapeHtml(code)}</div>${poi.text ? `<p>${escapeHtml(poi.text)}</p>` : ''}</div>`);
      activePoiMarkers.set(key, marker);
      setPoiButtonActive(key, true);
    }

    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: .7 });
    marker.openPopup();
  };

  const mapButton = (poi: TrailPoi, key: string) =>
    typeof poi.lat === 'number' && typeof poi.lng === 'number'
      ? `<button type="button" class="poi-map-btn${activePoiMarkers.has(key) ? ' active' : ''}" data-poi-key="${escapeHtml(key)}" aria-pressed="${activePoiMarkers.has(key)}">${activePoiMarkers.has(key) ? '✓ Στον χάρτη' : '📍 Εμφάνιση στον χάρτη'}</button>`
      : '';

  const haversine = (lon1: number, lat1: number, lon2: number, lat2: number) => {
    const R = 6371000, rad = (v: number) => v * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const nearestPoint = (trail: Trail, pos: UserPosition) => {
    let best: { point: TrailPoint; distance: number } | null = null;
    trail.segments.forEach(segment => segment.forEach(point => {
      const distance = haversine(pos.lng, pos.lat, point[0], point[1]);
      if (!best || distance < best.distance) best = { point, distance };
    }));
    return best;
  };

  const elevationProfile = (trail: Trail) => {
    let distance = 0;
    const pts: Array<{ d: number; e: number }> = [];
    // CMS segments may arrive out of order. Follow their connected endpoints
    // from the official start, without changing the segments drawn on the map.
    const remaining = trail.segments.filter(segment => segment.length >= 2).slice();
    const start = trail.navigation?.start;
    let endpoint: TrailPoint | null = start ? [start[1], start[0]] : (remaining[0]?.[0] ?? null);
    const ordered: TrailPoint[][] = [];
    while (remaining.length && endpoint) {
      let nearestIndex = 0;
      let reverse = false;
      let nearestDistance = Infinity;
      remaining.forEach((segment, index) => {
        const first = haversine(endpoint![0], endpoint![1], segment[0][0], segment[0][1]);
        const last = haversine(endpoint![0], endpoint![1], segment[segment.length - 1][0], segment[segment.length - 1][1]);
        if (first < nearestDistance) { nearestDistance = first; nearestIndex = index; reverse = false; }
        if (last < nearestDistance) { nearestDistance = last; nearestIndex = index; reverse = true; }
      });
      const segment = remaining.splice(nearestIndex, 1)[0];
      if (reverse) segment.reverse();
      ordered.push(segment);
      endpoint = segment[segment.length - 1];
    }
    let previous: TrailPoint | null = null;
    ordered.forEach(segment => {
      segment.forEach(point => {
        if (previous) distance += haversine(previous[0], previous[1], point[0], point[1]);
        if (typeof point[2] === 'number') pts.push({ d: distance, e: point[2] });
        previous = point;
      });
    });
    return pts;
  };

  const elevationSvg = (trail: Trail) => {
    const pts = elevationProfile(trail);
    if (!pts.length) return trail.elev_min !== null && trail.elev_max !== null
      ? '<div class="empty-note">Υπάρχει δημοσιευμένο υψομετρικό εύρος, αλλά λείπουν μετρήσεις ανά σημείο για αξιόπιστο γράφημα.</div>'
      : '<div class="empty-note">Δεν υπάρχουν δεδομένα υψομέτρου.</div>';
    const W = 600, H = 110, top = 9, bottom = 100;
    const minE = Math.min(...pts.map(x => x.e)), maxE = Math.max(...pts.map(x => x.e)), maxD = pts.at(-1)?.d || 1;
    const sx = (d: number) => d / maxD * W;
    const sy = (e: number) => bottom - (e - minE) / Math.max(1, maxE - minE) * (bottom - top);
    const line = pts.map(point => `${sx(point.d).toFixed(1)},${sy(point.e).toFixed(1)}`).join(' ');
    const horizontal = [top, (top + bottom) / 2, bottom].map(y => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" />`).join('');
    const vertical = [0, .25, .5, .75, 1].map(part => `<line x1="${W * part}" y1="${top}" x2="${W * part}" y2="${bottom}" />`).join('');
    const altitude = (value: number) => `${Math.round(value).toLocaleString('el-GR')} μ`;
    const startY = sy(pts[0].e) / H * 100, endY = sy(pts[pts.length - 1].e) / H * 100;
    return `<div class="elevation-chart" role="img" aria-label="Υψομετρικό προφίλ από ${altitude(pts[0].e)} έως ${altitude(pts[pts.length - 1].e)}"><div class="elevation-y-axis"><span>${altitude(maxE)}</span><span>${altitude((minE + maxE) / 2)}</span><span>${altitude(minE)}</span></div><div class="elevation-plot"><div class="elevation-chart-visual"><svg class="elevation-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="trail-elevation-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f79445" stop-opacity=".33"/><stop offset="1" stop-color="#f79445" stop-opacity=".03"/></linearGradient></defs><g class="elevation-grid">${horizontal}${vertical}</g><polygon points="0,${bottom} ${line} ${W},${bottom}" fill="url(#trail-elevation-fill)"/><polyline points="${line}" fill="none" stroke="#f17c34" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg><span class="elevation-endpoint start" style="top:${startY.toFixed(1)}%">Α</span><span class="elevation-endpoint finish" style="top:${endY.toFixed(1)}%">Τ</span></div><div class="elevation-x-axis"><span>0 χλμ</span><span>${(trail.length_km * .25).toFixed(1)}</span><span>${(trail.length_km * .5).toFixed(1)}</span><span>${(trail.length_km * .75).toFixed(1)}</span><span>${trail.length_km.toFixed(1)} χλμ</span></div></div></div>`;
  };

  const openDrawer = () => { trailDrawer.classList.add('open'); trailDrawerHandle?.classList.add('open'); };
  const closeDrawer = () => { trailDrawer.classList.remove('open'); trailDrawerHandle?.classList.remove('open'); };
  trailDrawerHandle?.addEventListener('click', () => trailDrawer.classList.contains('open') ? closeDrawer() : openDrawer());
  tdClose?.addEventListener('click', closeDrawer);

  tdTabs.addEventListener('click', e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.td-tab');
    if (!button) return;
    document.querySelectorAll('.td-tab').forEach(el => el.classList.toggle('active', el === button));
    document.querySelectorAll<HTMLElement>('.td-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== button.dataset.tab; });
  });

  trailDrawer.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.poi-map-btn');
    if (!button?.dataset.poiKey) return;
    event.preventDefault();
    showPoiOnMap(button.dataset.poiKey);
  });

  const renderNote = (poi: TrailPoi, key: string) => `<div class="note-item"><div class="note-item-head"><span class="poi-kind">${poiEmoji(poi.category)} ${escapeHtml(poiLabel(poi.category))}</span>${poi.verified_at ? `<span class="poi-verified">✓ ${escapeHtml(poi.verified_at)}</span>` : ''}</div><div class="note-item-title">${escapeHtml(poi.title ?? 'Σημείο διαδρομής')}</div>${poi.text ? `<div>${escapeHtml(poi.text)}</div>` : ''}${mapButton(poi, key)}</div>`;

  const renderPhoto = (poi: TrailPoi, key: string) => {
    const mediaUrls = (poi.media_urls ?? [])
      .filter((url): url is string => Boolean(url))
      .map(url => url.trim())
      .filter(Boolean);
    const urls = mediaUrls.length
      ? Array.from(new Set(mediaUrls))
      : (poi.featured_image_url ? [poi.featured_image_url.trim()] : []).filter(Boolean);
    const cards = urls.length
      ? urls.map(url => `<a class="media-card media-photo" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="${escapeHtml(poi.title ?? 'Φωτογραφία διαδρομής')}" loading="lazy"/><div class="media-card-title">${escapeHtml(poi.title ?? 'Φωτογραφία')}</div></a>`).join('')
      : `<div class="media-card"><div class="media-card-title">📷 ${escapeHtml(poi.title ?? 'Φωτογραφία')}</div><div class="empty-note">Δεν έχει συνδεθεί ακόμη αρχείο εικόνας.</div></div>`;
    return `<div class="media-entry">${cards}${mapButton(poi, key)}</div>`;
  };

  const renderVideo = (poi: TrailPoi, key: string) => {
    const uploaded = (poi.media_urls ?? [])[0];
    let card: string;
    if (uploaded) card = `<div class="media-card"><video controls preload="metadata" style="width:100%;max-height:260px" src="${escapeHtml(uploaded)}"></video><div class="media-card-title" style="margin-top:8px">🎬 ${escapeHtml(poi.title ?? 'Βίντεο')}</div>${poi.text ? `<div class="media-card-text">${escapeHtml(poi.text)}</div>` : ''}</div>`;
    else if (poi.video_url) card = `<a class="media-card media-video" href="${escapeHtml(poi.video_url)}" target="_blank" rel="noopener"><div class="media-video-icon">▶</div><div><div class="media-card-title">${escapeHtml(poi.title ?? 'Βίντεο')}</div>${poi.text ? `<div class="media-card-text">${escapeHtml(poi.text)}</div>` : ''}</div></a>`;
    else card = `<div class="media-card"><div class="media-card-title">🎬 ${escapeHtml(poi.title ?? 'Βίντεο')}</div><div class="empty-note">Δεν έχει συνδεθεί ακόμη αρχείο ή URL βίντεο.</div></div>`;
    return `<div class="media-entry">${card}${mapButton(poi, key)}</div>`;
  };

  const fillDrawer = (code: string, trail: Trail) => {
    const statusLabel = trail.status === 'investigation' ? 'υπό διερεύνηση' : trail.existing ? 'υπάρχει' : 'σχεδιάζεται';
    const elevationRange = trail.elev_min === null || trail.elev_max === null ? '—' : `${trail.elev_min}–${trail.elev_max} μ`;
    const hasElevationSamples = trail.segments.some(segment => segment.some(point => typeof point[2] === 'number'));
    trailDrawer.classList.toggle('no-elevation', !hasElevationSamples);
    tdCardBar.style.background = trail.color;
    tdTitleBlock.classList.add('selected');
    tdTitleBlock.style.setProperty('--trail-color', trail.color);
    tdTitleBlock.innerHTML = `<span class="trail-card-route-icon" aria-hidden="true">${routeIcon}</span><div class="trail-card-heading"><div class="trail-card-title">${escapeHtml(code)} — ${escapeHtml(trail.name)}</div><div class="trail-card-subtitle"><span class="status-pill ${trail.existing ? 'status-existing' : 'status-planned'}">${escapeHtml(statusLabel)}</span>${trail.source ? `<span>Πηγή: ${escapeHtml(trail.source)}</span>` : ''}</div></div>`;
    tdTabs.hidden = false;
    const count = (id: string, value: number) => { const el = document.getElementById(id); if (el) el.textContent = value ? ` (${value})` : ''; };
    count('tdCountNotes', trail.notes.length); count('tdCountPhotos', trail.photos.length); count('tdCountVideos', trail.videos.length);
    const info = document.querySelector<HTMLElement>('.td-panel[data-panel="info"]');
    const notes = document.querySelector<HTMLElement>('.td-panel[data-panel="notes"]');
    const photos = document.querySelector<HTMLElement>('.td-panel[data-panel="photos"]');
    const videos = document.querySelector<HTMLElement>('.td-panel[data-panel="videos"]');
    const meta = [trail.source ? `Πηγή: ${escapeHtml(trail.source)}` : '', trail.verified_at ? `Επαλήθευση: ${escapeHtml(trail.verified_at)}` : ''].filter(Boolean).join(' · ');
    const metrics = [
      { label: 'Συνολική απόσταση', value: `${trail.length_km.toFixed(2)} χλμ` },
      trail.gain_m > 0 || hasElevationSamples ? { label: 'Ανάβαση', value: `+${trail.gain_m} μ` } : { label: 'Υψόμετρο', value: elevationRange },
      trail.duration_minutes ? { label: 'Χρόνος πορείας', value: formatDuration(trail.duration_minutes) } : { label: 'Υψόμετρο', value: elevationRange },
      trail.difficulty ? { label: 'Βαθμός δυσκολίας', value: trail.difficulty } : { label: 'Κατάβαση', value: `−${trail.loss_m} μ` }
    ];
    const publishedReferences = code === 'Π-14'
      ? `<div class="trail-reference-line">Στοιχεία μελέτης: <a href="${P14_REFERENCE.municipality}" target="_blank" rel="noopener noreferrer">Δήμος Πατρέων</a> (υψόμετρο, διάρκεια) · <a href="${P14_REFERENCE.study}" target="_blank" rel="noopener noreferrer">ΑΧΑΪΑ Α.Ε., 2024</a> (δυσκολία). Η διάρκεια είναι χωρίς στάσεις.</div>`
      : '';
    if (info) info.innerHTML = `<div class="stat-grid">${metrics.map(metric => `<div class="stat-box"><span class="value">${escapeHtml(metric.value)}</span><span class="label">${escapeHtml(metric.label)}</span></div>`).join('')}</div>${trail.description ? `<div class="trail-description">${trail.description}</div>` : ''}<div class="section-label">Υψομετρικό προφίλ</div><div class="elevation-wrap">${elevationSvg(trail)}</div>${publishedReferences}${meta ? `<div class="trail-meta-line">${meta}</div>` : ''}`;
    if (notes) notes.innerHTML = trail.notes.length ? `<div class="notes-list">${trail.notes.map((poi, index) => renderNote(poi, poiKey(code, 'note', index, poi))).join('')}</div>` : '<div class="empty-note">Δεν έχουν προστεθεί ενδείξεις ακόμα — κάνε κλικ πάνω στη γραμμή του μονοπατιού για να προσθέσεις.</div>';
    if (photos) photos.innerHTML = trail.photos.length ? `<div class="media-grid">${trail.photos.map((poi, index) => renderPhoto(poi, poiKey(code, 'photo', index, poi))).join('')}</div>` : '<div class="empty-note">Δεν έχουν προστεθεί φωτογραφίες ακόμα — κάνε κλικ πάνω στη γραμμή για προσθήκη.</div>';
    if (videos) videos.innerHTML = trail.videos.length ? `<div class="media-list">${trail.videos.map((poi, index) => renderVideo(poi, poiKey(code, 'video', index, poi))).join('')}</div>` : '<div class="empty-note">Δεν έχουν προστεθεί βίντεο ακόμα — κάνε κλικ πάνω στη γραμμή για προσθήκη.</div>';
    document.querySelectorAll('.td-tab').forEach(el => el.classList.toggle('active', (el as HTMLElement).dataset.tab === 'info'));
    document.querySelectorAll<HTMLElement>('.td-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== 'info'; });
  };

  const updateDistanceBadge = () => {
    if (!distanceBadge || !selectedCode || !userPosition) { distanceBadge?.classList.remove('show'); return; }
    const nearest = nearestPoint(trails[selectedCode], userPosition);
    if (!nearest) return;
    const text = nearest.distance < 1000 ? `${Math.round(nearest.distance)} μ` : `${(nearest.distance / 1000).toFixed(2)} χλμ`;
    distanceBadge.textContent = `Απόσταση από ${selectedCode}: ${text}`;
    distanceBadge.classList.add('show');
  };

  const syncRouteCalculationState = () => {
    if (rbCalcBtn) rbCalcBtn.disabled = !(userPosition && rbTrailSelect?.value);
  };

  const maybeCalculateAfterGps = () => {
    syncRouteCalculationState();
    if (!autoCalculateAfterGps || !userPosition || !rbTrailSelect?.value || rbCalcBtn?.disabled) return;
    autoCalculateAfterGps = false;
    window.setTimeout(() => rbCalcBtn?.click(), 0);
  };

  const selectTrail = (code: string, fly = true, pulse = true) => {
    const trail = trails[code]; if (!trail) return;
    requestedCode = code;
    if (selectedCode && selectedCode !== code) clearSelectedPoiMarkers();
    if (selectedCode) {
      setTrailStyle(selectedCode, false);
      const previousRow = document.getElementById(`row-${selectedCode}`);
      previousRow?.classList.remove('active');
      if (previousRow) previousRow.style.borderLeftColor = 'transparent';
    }
    selectedCode = code;
    if (rbTrailSelect) rbTrailSelect.value = code;
    syncRouteCalculationState();
    maybeCalculateAfterGps();
    const group = layers.get(code);
    setTrailStyle(code, true);
    if (pulse) pulseTrailSelection(code);
    const row = document.getElementById(`row-${code}`);
    row?.classList.add('active');
    if (row) row.style.borderLeftColor = trail.color;
    if (fly && group?.getBounds().isValid()) map.flyToBounds(group.getBounds(), { padding: [80, 80], duration: .9, maxZoom: 15 });
    fillDrawer(code, trail); openDrawer(); updateDistanceBadge();
    document.dispatchEvent(new CustomEvent('panachaiko:trail-selected', { detail: { code } }));
    if (view3dTitle) view3dTitle.textContent = `3D · ${code} — ${trail.name}`;
  };

  const renderPoiMarkers = () => {
    clearSelectedPoiMarkers();
    poiRegistry.clear();
    codes.forEach(code => {
      const trail = trails[code];
      trail.notes.forEach((poi, index) => poiRegistry.set(poiKey(code, 'note', index, poi), { code, poi }));
      trail.photos.forEach((poi, index) => poiRegistry.set(poiKey(code, 'photo', index, poi), { code, poi }));
      trail.videos.forEach((poi, index) => poiRegistry.set(poiKey(code, 'video', index, poi), { code, poi }));
    });
  };

  const renderTrails = (nextTrails: TrailCollection, fitMap: boolean) => {
    // Η ανανέωση CMS μπορεί να φτάσει ακριβώς τη στιγμή του πρώτου click.
    // Προτιμάμε την τελευταία επιλογή που ζήτησε ο χρήστης, ώστε το drawer,
    // η ενεργή γραμμή και το 3D να παραμένουν συγχρονισμένα.
    const previousSelection = requestedCode ?? selectedCode;
    selectedCode = null;
    trails = nextTrails;
    runtime.__panachaikoTrails = trails;
    document.dispatchEvent(new CustomEvent('panachaiko:trails-updated'));
    codes = Object.keys(trails).sort((a, b) => trails[b].length_km - trails[a].length_km);

    layers.forEach(group => map.removeLayer(group));
    layers.clear(); visibleLines.clear(); allBounds.length = 0; trailList.replaceChildren();

    if (rbTrailSelect) {
      const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '— Διάλεξε μονοπάτι —'; rbTrailSelect.replaceChildren(placeholder);
    }

    let totalLength = 0;
    codes.forEach(code => {
      const trail = trails[code]; totalLength += trail.length_km;
      const group = L.featureGroup().addTo(map); layers.set(code, group);
      const codeLines: L.Polyline[] = [];

      trail.segments.forEach(segment => {
        const points: L.LatLngExpression[] = segment.map(([lng, lat]) => [lat, lng]);
        points.forEach(p => allBounds.push(p));
        const visibleLine = L.polyline(points, { ...styleFor(trail), interactive: false }).addTo(group); codeLines.push(visibleLine);
        const hitLine = L.polyline(points, { color: '#000000', weight: 22, opacity: 0.001, lineCap: 'round', lineJoin: 'round', interactive: true, bubblingMouseEvents: false }).addTo(group);
        hitLine.on('mouseover', () => { if (selectedCode !== code) setTrailStyle(code, false, true); });
        hitLine.on('mouseout', () => { if (selectedCode !== code) setTrailStyle(code, false); });
        hitLine.on('click', e => {
          L.DomEvent.stopPropagation(e);
          selectTrail(code, false);
          closeTrailPanelAfterSelection();
          contentController.showChoice(e.latlng, code);
        });
      });
      visibleLines.set(code, codeLines);

      const row = document.createElement('button'); row.type = 'button'; row.className = 'trail-row'; row.id = `row-${code}`; row.style.borderLeftColor = 'transparent';
      row.style.setProperty('--trail-color', trail.color);
      const rowMeta = [trail.difficulty, trail.duration_minutes ? formatDuration(trail.duration_minutes) : '', trail.gain_m > 0 ? `↑ ${trail.gain_m} μ` : '', trail.elev_min !== null && trail.elev_max !== null ? `${trail.elev_min}–${trail.elev_max} μ` : ''].filter(Boolean).join(' · ') || (trail.existing ? 'Υπάρχον μονοπάτι' : 'Σχεδιαζόμενη διαδρομή');
      row.innerHTML = `<span class="trail-row-icon" aria-hidden="true">${routeIcon}</span><span class="trail-row-text"><span class="trail-row-code">${escapeHtml(code)}</span><span class="trail-row-name">${escapeHtml(trail.name)}</span><span class="trail-row-meta">${escapeHtml(rowMeta)}</span></span><span class="trail-row-dist">${trail.length_km.toFixed(1)} χλμ</span>`;
      row.addEventListener('click', () => { selectTrail(code); closeTrailPanelAfterSelection(); }); trailList.append(row);
      if (rbTrailSelect) { const option = document.createElement('option'); option.value = code; option.textContent = `${code} — ${trail.name}`; rbTrailSelect.append(option); }
    });

    renderPoiMarkers();
    const countElement = document.getElementById('trail-count'); const lengthElement = document.getElementById('total-length');
    if (countElement) countElement.textContent = String(codes.length); if (lengthElement) lengthElement.textContent = totalLength.toFixed(1);
    app.dataset.trailCount = String(codes.length);
    if (fitMap && allBounds.length) map.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40] });
    if (previousSelection && trails[previousSelection]) selectTrail(previousSelection, false, false);
  };

  renderTrails(trails, true);
  void refreshTrailsFromCms().then(cmsTrails => {
    if (!cmsTrails) { app.dataset.trailSource = 'fallback'; return; }
    renderTrails(cmsTrails, false); app.dataset.trailSource = 'cms';
  });

  trailMenuToggle?.addEventListener('click', () => {
    const open = !trailPanel.classList.contains('open');
    setTrailPanelOpen(open);
    routeBuilderPanel?.classList.remove('open');
    routeBuilderToggle?.classList.remove('open');
    closeDrawer();
  });

  routeBuilderToggle?.addEventListener('click', () => {
    const open = routeBuilderPanel?.classList.toggle('open') ?? false;
    routeBuilderToggle.classList.toggle('open', open);
    routeBuilderToggle.setAttribute('aria-expanded', String(open));
    if (open && selectedCode && rbTrailSelect) rbTrailSelect.value = selectedCode;
    syncRouteCalculationState();
    setTrailPanelOpen(false);
    closeDrawer();
  });

  const applyPosition = (pos: GeolocationPosition) => {
    userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    const icon = L.divIcon({ className: '', html: '<div class="you-are-here"><span class="ring"></span><span class="dot"></span></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    if (!userMarker) userMarker = L.marker([userPosition.lat, userPosition.lng], { icon }).addTo(map); else userMarker.setLatLng([userPosition.lat, userPosition.lng]);
    locateBtn?.classList.add('active'); recenterBtn?.classList.add('show');
    if (rbGpsBtn) { rbGpsBtn.classList.add('active'); rbGpsBtn.textContent = '✅ Η θέση σου βρέθηκε'; }
    if (rbGpsStatus) { rbGpsStatus.textContent = `Ακρίβεια περίπου ${Math.round(userPosition.accuracy)} μ`; rbGpsStatus.className = 'rb-status ok'; }
    syncRouteCalculationState();
    updateDistanceBadge();
    maybeCalculateAfterGps();
  };

  const startGps = () => {
    if (!navigator.geolocation) { if (rbGpsStatus) rbGpsStatus.textContent = 'Το GPS δεν είναι διαθέσιμο.'; return; }
    autoCalculateAfterGps = true;
    if (rbCalcBtn) rbCalcBtn.disabled = true;
    if (rbGpsStatus) { rbGpsStatus.textContent = 'Αναζήτηση θέσης…'; rbGpsStatus.className = 'rb-status warn'; }
    if (watchId === null) watchId = navigator.geolocation.watchPosition(applyPosition, () => {
      autoCalculateAfterGps = false;
      syncRouteCalculationState();
      if (rbGpsStatus) rbGpsStatus.textContent = 'Δεν δόθηκε πρόσβαση στη θέση.';
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
    else if (userPosition) maybeCalculateAfterGps();
  };
  if (locateBtn) locateBtn.disabled = !('geolocation' in navigator);
  locateBtn?.addEventListener('click', startGps); rbGpsBtn?.addEventListener('click', startGps);
  recenterBtn?.addEventListener('click', () => { if (userPosition) { map.flyTo([userPosition.lat, userPosition.lng], 16); recenterBtn.classList.add('following'); } });
  map.on('dragstart', () => recenterBtn?.classList.remove('following'));

  rbTrailSelect?.addEventListener('change', () => {
    syncRouteCalculationState();
    maybeCalculateAfterGps();
  });
  rbCalcBtn?.addEventListener('click', () => {
    if (!userPosition || !rbTrailSelect?.value) return;
    const code = rbTrailSelect.value; selectTrail(code);
    const nearest = nearestPoint(trails[code], userPosition); if (!nearest) return;
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([[userPosition.lat, userPosition.lng], [nearest.point[1], nearest.point[0]]], { color: '#cf5a34', weight: 4, dashArray: '7 7' }).addTo(map);
    const mode = (document.querySelector<HTMLInputElement>('input[name="rbMode"]:checked')?.value ?? 'straight');
    if (rbResultStatus) { rbResultStatus.textContent = mode === 'straight' ? 'Έτοιμο — εμφανίζεται η ευθεία προσέγγιση προς το μονοπάτι.' : 'Το interface είναι έτοιμο· η εξωτερική μηχανή routing θα συνδεθεί στην επόμενη φάση.'; rbResultStatus.className = 'rb-status ok'; }
    routeBuilderPanel?.classList.remove('open'); routeBuilderToggle?.classList.remove('open');
  });

  shelterBtn?.addEventListener('click', () => {
    if (!shelterPanel) return;
    shelterPanel.classList.add('show');
    closeDrawer();
    routeBuilderPanel?.classList.remove('open');
    routeBuilderToggle?.classList.remove('open');
    setTrailPanelOpen(false);

    const closeShelterPanel = () => shelterPanel.classList.remove('show');
    if (!userPosition) {
      shelterPanel.innerHTML = '<div class="sh-title">🆘 Χρειάζεται GPS</div><div class="sh-sub">Ενεργοποίησε πρώτα τη θέση σου και ξαναπάτησε το SOS.</div><button class="sh-close" type="button">Κλείσιμο</button>';
      shelterPanel.querySelector('.sh-close')?.addEventListener('click', closeShelterPanel);
      return;
    }

    const shelters = codes.flatMap(code => trails[code].notes
      .filter(note => note.category === 'shelter' && typeof note.lat === 'number' && typeof note.lng === 'number')
      .map(note => ({ code, title: note.title ?? 'Καταφύγιο', lat: note.lat!, lng: note.lng! })));

    if (!shelters.length) {
      shelterPanel.innerHTML = '<div class="sh-title">🆘 Δεν υπάρχουν καταχωρημένα καταφύγια</div><div class="sh-sub">Πρόσθεσε καταφύγιο από το WordPress → Σημεία διαδρομών.</div><button class="sh-close" type="button">Κλείσιμο</button>';
      shelterPanel.querySelector('.sh-close')?.addEventListener('click', closeShelterPanel);
      return;
    }

    if (shelterLine) { map.removeLayer(shelterLine); shelterLine = null; }
    shelterPanel.innerHTML = '<div class="sh-title">🆘 Αναζήτηση κοντινότερου καταφυγίου</div><div class="sh-sub">Υπολογίζω πραγματικές πεζοπορικές διαδρομές από τη θέση GPS…</div><button class="sh-close" type="button">Ακύρωση</button>';
    shelterPanel.querySelector('.sh-close')?.addEventListener('click', closeShelterPanel);
    document.dispatchEvent(new CustomEvent('panachaiko:shelter-route-request', {
      detail: {
        start: [userPosition.lat, userPosition.lng],
        shelters
      }
    }));
  });

  view3dBtn?.addEventListener('click', () => {
    closeDrawer();
    routeBuilderPanel?.classList.remove('open');
    routeBuilderToggle?.classList.remove('open');
    setTrailPanelOpen(false);
    if (!selectedCode && codes.length) selectTrail(codes[0]);
    view3dOverlay?.classList.add('open');
  });
  view3dClose?.addEventListener('click', () => view3dOverlay?.classList.remove('open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { view3dOverlay?.classList.remove('open'); routeBuilderPanel?.classList.remove('open'); shelterPanel?.classList.remove('show'); } });
}

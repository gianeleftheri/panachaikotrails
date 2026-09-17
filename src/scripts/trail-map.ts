import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Trail, TrailCollection, TrailPoi, TrailPoint } from '../types/trail';
import { loadInitialTrails, refreshTrailsFromCms } from './trail-data';
import { createTrailContentController } from './trail-content';

type UserPosition = { lat: number; lng: number; accuracy: number };

let trails: TrailCollection = loadInitialTrails();
const app = document.querySelector<HTMLElement>('[data-trail-app]');

if (app) {
  const mapElement = document.getElementById('map');
  const trailList = document.getElementById('trail-list');
  const trailPanel = document.getElementById('trailPanel');
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
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles © Esri, Maxar, Earthstar Geographics | Μονοπάτια: ΟΦΥΠΕΚΑ' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: .85 }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

  const layers = new Map<string, L.FeatureGroup>();
  const visibleLines = new Map<string, L.Polyline[]>();
  const poiLayer = L.layerGroup().addTo(map);
  const allBounds: L.LatLngExpression[] = [];
  let codes: string[] = [];
  let selectedCode: string | null = null;
  let userPosition: UserPosition | null = null;
  let watchId: number | null = null;
  let userMarker: L.Marker | null = null;
  let routeLine: L.Polyline | null = null;
  let shelterLine: L.Polyline | null = null;

  const contentController = createTrailContentController(map, code => trails[code]);

  const escapeHtml = (value: unknown) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const styleFor = (trail: Trail, active = false): L.PathOptions => ({
    color: trail.color || (trail.existing ? '#84a06e' : '#9c917c'),
    weight: active ? 6 : 3.5,
    opacity: active ? .98 : trail.existing ? .82 : .62,
    dashArray: trail.existing ? undefined : '2 8',
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

  const poiEmoji = (category?: string) => ({
    forest: '🌲', viewpoint: '👁️', rest: '🪑', danger: '⚠️', hazard: '⚠️', water: '💧', flag: '🚩', shelter: '⛺', archaeological: '🏛️', photo: '📷', video: '🎬', note: '📍', general: '📍'
  }[category ?? 'general'] ?? '📍');

  const poiLabel = (category?: string) => ({
    forest: 'Δάσος', viewpoint: 'Θέα', rest: 'Ξεκούραση', danger: 'Προσοχή', hazard: 'Κίνδυνος', water: 'Νερό', flag: 'Αφετηρία/Τέλος', shelter: 'Καταφύγιο', archaeological: 'Αρχαιολογικός χώρος', photo: 'Φωτογραφία', video: 'Βίντεο', note: 'Ένδειξη', general: 'Σημείο'
  }[category ?? 'general'] ?? 'Σημείο');

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
    trail.segments.forEach(segment => {
      let previous: TrailPoint | null = null;
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
    if (!pts.length) return '<div class="empty-note">Δεν υπάρχουν δεδομένα υψομέτρου.</div>';
    const W = 300, H = 95, p = 5, minE = Math.min(...pts.map(x => x.e)), maxE = Math.max(...pts.map(x => x.e)), maxD = pts.at(-1)?.d || 1;
    const sx = (d: number) => p + d / maxD * (W - p * 2), sy = (e: number) => H - p - (e - minE) / Math.max(1, maxE - minE) * (H - p * 2);
    const line = pts.map(x => `${sx(x.d).toFixed(1)},${sy(x.e).toFixed(1)}`).join(' ');
    return `<svg class="elevation-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polygon points="${p},${H} ${line} ${W-p},${H}" fill="rgba(207,90,52,.2)"/><polyline points="${line}" fill="none" stroke="#cf5a34" stroke-width="2"/></svg><div class="chart-labels"><span>${minE} μ</span><span>${maxE} μ</span></div>`;
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

  const renderNote = (poi: TrailPoi) => `<div class="note-item"><div class="note-item-head"><span class="poi-kind">${poiEmoji(poi.category)} ${escapeHtml(poiLabel(poi.category))}</span>${poi.verified_at ? `<span class="poi-verified">✓ ${escapeHtml(poi.verified_at)}</span>` : ''}</div><div class="note-item-title">${escapeHtml(poi.title ?? 'Σημείο διαδρομής')}</div>${poi.text ? `<div>${escapeHtml(poi.text)}</div>` : ''}</div>`;

  const renderPhoto = (poi: TrailPoi) => {
    const urls = [poi.featured_image_url, ...(poi.media_urls ?? [])].filter((url): url is string => Boolean(url));
    if (!urls.length) return `<div class="media-card"><div class="media-card-title">📷 ${escapeHtml(poi.title ?? 'Φωτογραφία')}</div><div class="empty-note">Δεν έχει συνδεθεί ακόμη αρχείο εικόνας.</div></div>`;
    return urls.map(url => `<a class="media-card media-photo" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="${escapeHtml(poi.title ?? 'Φωτογραφία διαδρομής')}" loading="lazy"/><div class="media-card-title">${escapeHtml(poi.title ?? 'Φωτογραφία')}</div></a>`).join('');
  };

  const renderVideo = (poi: TrailPoi) => poi.video_url
    ? `<a class="media-card media-video" href="${escapeHtml(poi.video_url)}" target="_blank" rel="noopener"><div class="media-video-icon">▶</div><div><div class="media-card-title">${escapeHtml(poi.title ?? 'Βίντεο')}</div>${poi.text ? `<div class="media-card-text">${escapeHtml(poi.text)}</div>` : ''}</div></a>`
    : `<div class="media-card"><div class="media-card-title">🎬 ${escapeHtml(poi.title ?? 'Βίντεο')}</div><div class="empty-note">Δεν έχει συνδεθεί ακόμη URL βίντεο.</div></div>`;

  const fillDrawer = (code: string, trail: Trail) => {
    const statusLabel = trail.status === 'investigation' ? 'υπό διερεύνηση' : trail.existing ? 'υπάρχει' : 'σχεδιάζεται';
    const elevationRange = trail.elev_min === null || trail.elev_max === null ? '—' : `${trail.elev_min}–${trail.elev_max} μ`;
    tdCardBar.style.background = trail.color;
    tdTitleBlock.innerHTML = `<div class="trail-card-code">${escapeHtml(code)}<span class="status-pill ${trail.existing ? 'status-existing' : 'status-planned'}">${escapeHtml(statusLabel)}</span></div><div class="trail-card-title">${escapeHtml(trail.name)}</div>`;
    tdTabs.hidden = false;
    const count = (id: string, value: number) => { const el = document.getElementById(id); if (el) el.textContent = value ? ` (${value})` : ''; };
    count('tdCountNotes', trail.notes.length); count('tdCountPhotos', trail.photos.length); count('tdCountVideos', trail.videos.length);
    const info = document.querySelector<HTMLElement>('.td-panel[data-panel="info"]');
    const notes = document.querySelector<HTMLElement>('.td-panel[data-panel="notes"]');
    const photos = document.querySelector<HTMLElement>('.td-panel[data-panel="photos"]');
    const videos = document.querySelector<HTMLElement>('.td-panel[data-panel="videos"]');
    const meta = [trail.source ? `Πηγή: ${escapeHtml(trail.source)}` : '', trail.verified_at ? `Επαλήθευση: ${escapeHtml(trail.verified_at)}` : ''].filter(Boolean).join(' · ');
    if (info) info.innerHTML = `<div class="stat-grid"><div class="stat-box"><span class="label">Απόσταση</span><span class="value">${trail.length_km.toFixed(2)} χλμ</span></div><div class="stat-box"><span class="label">Υψόμετρο</span><span class="value">${elevationRange}</span></div><div class="stat-box"><span class="label">Ανάβαση</span><span class="value moss">+${trail.gain_m} μ</span></div><div class="stat-box"><span class="label">Κατάβαση</span><span class="value">−${trail.loss_m} μ</span></div></div>${trail.description ? `<div class="trail-description">${trail.description}</div>` : ''}${meta ? `<div class="trail-meta-line">${meta}</div>` : ''}<div class="section-label">Υψομετρικό προφίλ</div><div class="elevation-wrap">${elevationSvg(trail)}</div>`;
    if (notes) notes.innerHTML = trail.notes.length ? `<div class="notes-list">${trail.notes.map(renderNote).join('')}</div>` : '<div class="empty-note">Δεν έχουν προστεθεί ενδείξεις ακόμα — κάνε κλικ πάνω στη γραμμή του μονοπατιού για να προσθέσεις.</div>';
    if (photos) photos.innerHTML = trail.photos.length ? `<div class="media-grid">${trail.photos.map(renderPhoto).join('')}</div>` : '<div class="empty-note">Δεν έχουν προστεθεί φωτογραφίες ακόμα — κάνε κλικ πάνω στη γραμμή για προσθήκη.</div>';
    if (videos) videos.innerHTML = trail.videos.length ? `<div class="media-list">${trail.videos.map(renderVideo).join('')}</div>` : '<div class="empty-note">Δεν έχουν προστεθεί βίντεο ακόμα — κάνε κλικ πάνω στη γραμμή για προσθήκη.</div>';
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

  const selectTrail = (code: string, fly = true) => {
    const trail = trails[code]; if (!trail) return;
    if (selectedCode) {
      setTrailStyle(selectedCode, false);
      const previousRow = document.getElementById(`row-${selectedCode}`);
      previousRow?.classList.remove('active');
      if (previousRow) previousRow.style.borderLeftColor = 'transparent';
    }
    selectedCode = code;
    const group = layers.get(code);
    setTrailStyle(code, true);
    const row = document.getElementById(`row-${code}`);
    row?.classList.add('active');
    if (row) row.style.borderLeftColor = trail.color;
    if (fly && group?.getBounds().isValid()) map.flyToBounds(group.getBounds(), { padding: [80, 80], duration: .9, maxZoom: 15 });
    fillDrawer(code, trail); openDrawer(); updateDistanceBadge();
    document.dispatchEvent(new CustomEvent('panachaiko:trail-selected', { detail: { code } }));
    if (view3dTitle) view3dTitle.textContent = `3D · ${code} — ${trail.name}`;
  };

  const renderPoiMarkers = () => {
    poiLayer.clearLayers();
    codes.forEach(code => {
      const trail = trails[code];
      const pois = [...trail.notes, ...trail.photos, ...trail.videos];
      pois.forEach(poi => {
        if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number') return;
        const icon = L.divIcon({ className: 'trail-poi-marker-wrap', html: `<div class="trail-poi-marker" title="${escapeHtml(poiLabel(poi.category))}">${poiEmoji(poi.category)}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
        const marker = L.marker([poi.lat, poi.lng], { icon }).addTo(poiLayer);
        marker.bindPopup(`<div class="poi-popup"><strong>${escapeHtml(poi.title ?? poiLabel(poi.category))}</strong><div>${escapeHtml(poiLabel(poi.category))} · ${escapeHtml(code)}</div>${poi.text ? `<p>${escapeHtml(poi.text)}</p>` : ''}</div>`);
        marker.on('click', () => selectTrail(code, false));
      });
    });
  };

  const renderTrails = (nextTrails: TrailCollection, fitMap: boolean) => {
    const previousSelection = selectedCode;
    selectedCode = null;
    trails = nextTrails;
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
          trailPanel.classList.remove('open');
          trailMenuToggle?.classList.remove('open');
          contentController.showChoice(e.latlng, code);
        });
      });
      visibleLines.set(code, codeLines);

      const row = document.createElement('button'); row.type = 'button'; row.className = 'trail-row'; row.id = `row-${code}`; row.style.borderLeftColor = 'transparent';
      row.innerHTML = `<span class="trail-row-text"><span class="trail-row-code">${escapeHtml(code)}</span><span class="trail-row-name">${escapeHtml(trail.name)}</span></span><span class="trail-row-dist">${trail.length_km.toFixed(1)}χλμ</span>`;
      row.addEventListener('click', () => { selectTrail(code); trailPanel.classList.remove('open'); trailMenuToggle?.classList.remove('open'); }); trailList.append(row);
      if (rbTrailSelect) { const option = document.createElement('option'); option.value = code; option.textContent = `${code} — ${trail.name}`; rbTrailSelect.append(option); }
    });

    renderPoiMarkers();
    const countElement = document.getElementById('trail-count'); const lengthElement = document.getElementById('total-length');
    if (countElement) countElement.textContent = String(codes.length); if (lengthElement) lengthElement.textContent = totalLength.toFixed(1);
    app.dataset.trailCount = String(codes.length);
    if (fitMap && allBounds.length) map.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40] });
    if (previousSelection && trails[previousSelection]) selectTrail(previousSelection, false);
  };

  renderTrails(trails, true);
  void refreshTrailsFromCms().then(cmsTrails => {
    if (!cmsTrails) { app.dataset.trailSource = 'fallback'; return; }
    renderTrails(cmsTrails, false); app.dataset.trailSource = 'cms';
  });

  trailMenuToggle?.addEventListener('click', () => {
    const open = trailPanel.classList.toggle('open');
    trailMenuToggle.classList.toggle('open', open);
    trailMenuToggle.setAttribute('aria-expanded', String(open));
    routeBuilderPanel?.classList.remove('open');
    routeBuilderToggle?.classList.remove('open');
    closeDrawer();
  });

  routeBuilderToggle?.addEventListener('click', () => {
    const open = routeBuilderPanel?.classList.toggle('open') ?? false;
    routeBuilderToggle.classList.toggle('open', open);
    routeBuilderToggle.setAttribute('aria-expanded', String(open));
    trailPanel.classList.remove('open');
    trailMenuToggle?.classList.remove('open');
    closeDrawer();
  });

  const applyPosition = (pos: GeolocationPosition) => {
    userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    const icon = L.divIcon({ className: '', html: '<div class="you-are-here"><span class="ring"></span><span class="dot"></span></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    if (!userMarker) userMarker = L.marker([userPosition.lat, userPosition.lng], { icon }).addTo(map); else userMarker.setLatLng([userPosition.lat, userPosition.lng]);
    locateBtn?.classList.add('active'); recenterBtn?.classList.add('show');
    if (rbGpsBtn) { rbGpsBtn.classList.add('active'); rbGpsBtn.textContent = '✅ Η θέση σου βρέθηκε'; }
    if (rbGpsStatus) { rbGpsStatus.textContent = `Ακρίβεια περίπου ${Math.round(userPosition.accuracy)} μ`; rbGpsStatus.className = 'rb-status ok'; }
    if (rbCalcBtn) rbCalcBtn.disabled = !rbTrailSelect?.value;
    updateDistanceBadge();
  };

  const startGps = () => {
    if (!navigator.geolocation) { if (rbGpsStatus) rbGpsStatus.textContent = 'Το GPS δεν είναι διαθέσιμο.'; return; }
    if (rbGpsStatus) { rbGpsStatus.textContent = 'Αναζήτηση θέσης…'; rbGpsStatus.className = 'rb-status warn'; }
    if (watchId === null) watchId = navigator.geolocation.watchPosition(applyPosition, () => { if (rbGpsStatus) rbGpsStatus.textContent = 'Δεν δόθηκε πρόσβαση στη θέση.'; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
  };
  if (locateBtn) locateBtn.disabled = !('geolocation' in navigator);
  locateBtn?.addEventListener('click', startGps); rbGpsBtn?.addEventListener('click', startGps);
  recenterBtn?.addEventListener('click', () => { if (userPosition) { map.flyTo([userPosition.lat, userPosition.lng], 16); recenterBtn.classList.add('following'); } });
  map.on('dragstart', () => recenterBtn?.classList.remove('following'));

  rbTrailSelect?.addEventListener('change', () => { if (rbCalcBtn) rbCalcBtn.disabled = !(userPosition && rbTrailSelect.value); });
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
    trailPanel.classList.remove('open');
    trailMenuToggle?.classList.remove('open');
    if (!userPosition) { shelterPanel.innerHTML = '<div class="sh-title">🆘 Χρειάζεται GPS</div><div class="sh-sub">Ενεργοποίησε πρώτα τη θέση σου.</div><button class="sh-close" type="button">Κλείσιμο</button>'; shelterPanel.querySelector('button')?.addEventListener('click', () => shelterPanel.classList.remove('show')); return; }
    const shelters = codes.flatMap(code => trails[code].notes.filter(n => n.category === 'shelter' && typeof n.lat === 'number' && typeof n.lng === 'number').map(n => ({ ...n, code })));
    if (!shelters.length) { shelterPanel.innerHTML = '<div class="sh-title">🆘 Δεν υπάρχουν καταχωρημένα καταφύγια</div><div class="sh-sub">Πρόσθεσε καταφύγιο από το WordPress → Σημεία διαδρομών.</div><button class="sh-close" type="button">Κλείσιμο</button>'; shelterPanel.querySelector('button')?.addEventListener('click', () => shelterPanel.classList.remove('show')); return; }
    const nearest = shelters.map(s => ({ ...s, distance: haversine(userPosition!.lng, userPosition!.lat, s.lng!, s.lat!) })).sort((a, b) => a.distance - b.distance)[0];
    if (shelterLine) map.removeLayer(shelterLine); shelterLine = L.polyline([[userPosition.lat, userPosition.lng], [nearest.lat!, nearest.lng!]], { color: '#dc2626', weight: 5 }).addTo(map);
    shelterPanel.innerHTML = `<div class="sh-title">🆘 ${escapeHtml(nearest.title ?? 'Κοντινότερο καταφύγιο')}</div><div class="sh-sub">${escapeHtml(nearest.code)} · ${(nearest.distance / 1000).toFixed(2)} χλμ σε ευθεία</div><button class="sh-close" type="button">Κλείσιμο</button>`;
    shelterPanel.querySelector('button')?.addEventListener('click', () => { shelterPanel.classList.remove('show'); if (shelterLine) { map.removeLayer(shelterLine); shelterLine = null; } });
  });

  view3dBtn?.addEventListener('click', () => {
    closeDrawer();
    routeBuilderPanel?.classList.remove('open');
    routeBuilderToggle?.classList.remove('open');
    trailPanel.classList.remove('open');
    trailMenuToggle?.classList.remove('open');
    if (!selectedCode && codes.length) selectTrail(codes[0]);
    view3dOverlay?.classList.add('open');
  });
  view3dClose?.addEventListener('click', () => view3dOverlay?.classList.remove('open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { view3dOverlay?.classList.remove('open'); routeBuilderPanel?.classList.remove('open'); shelterPanel?.classList.remove('show'); } });
}

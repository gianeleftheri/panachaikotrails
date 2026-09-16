import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Trail, TrailCollection } from '../types/trail';

type TrailDataModule = { key: string; trail: Trail };
const trailModules = import.meta.glob<TrailDataModule>('../data/trails/*.json', {
  eager: true,
  import: 'default'
});
const trails: TrailCollection = Object.values(trailModules).reduce<TrailCollection>(
  (collection, item) => ({ ...collection, [item.key]: item.trail }),
  {}
);
const app = document.querySelector<HTMLElement>('[data-trail-app]');

if (app) {
  const mapElement = app.querySelector<HTMLElement>('#map');
  const listElement = app.querySelector<HTMLElement>('[data-trail-list]');
  const panel = app.querySelector<HTMLElement>('[data-trail-panel]');
  const menuButton = app.querySelector<HTMLButtonElement>('[data-menu-button]');
  const details = app.querySelector<HTMLElement>('[data-details]');
  const detailsContent = app.querySelector<HTMLElement>('[data-details-content]');
  const detailsClose = app.querySelector<HTMLButtonElement>('[data-details-close]');
  const countElement = app.querySelector<HTMLElement>('[data-trail-count]');
  const lengthElement = app.querySelector<HTMLElement>('[data-total-length]');
  if (!mapElement || !listElement || !panel || !menuButton || !details || !detailsContent) throw new Error('Missing trail explorer elements.');

  const map = L.map(mapElement, { zoomControl: false }).setView([38.2, 21.835], 12);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles © Esri, Maxar, Earthstar Geographics | Μονοπάτια: ΟΦΥΠΕΚΑ' }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, opacity: 0.85 }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

  const layers = new Map<string, L.FeatureGroup>();
  const bounds: L.LatLngExpression[] = [];
  let selectedCode: string | null = null;
  const styleFor = (trail: Trail, active = false): L.PathOptions => ({ color: active ? '#f3ede0' : trail.existing ? '#84a06e' : '#9c917c', weight: active ? 6 : 3, opacity: active ? 1 : .9, dashArray: trail.existing ? undefined : '3 7', lineCap: 'round' });

  const renderDetails = (code: string, trail: Trail) => {
    detailsContent.innerHTML = `<div class="details-bar" style="--trail-color:${trail.color}"></div><p class="details-code">${code} · ${trail.existing ? 'ΥΠΑΡΧΟΝ ΜΟΝΟΠΑΤΙ' : 'ΣΧΕΔΙΑΖΟΜΕΝΗ ΔΙΑΔΡΟΜΗ'}</p><h2>${trail.name}</h2><div class="metrics"><div><strong>${trail.length_km.toFixed(2)}</strong><span>χλμ μήκος</span></div><div><strong>${trail.elev_min}–${trail.elev_max}</strong><span>μ υψόμετρο</span></div><div><strong>+${trail.gain_m}</strong><span>μ ανάβαση</span></div><div><strong>−${trail.loss_m}</strong><span>μ κατάβαση</span></div></div>${trail.notes.length ? `<div class="notes"><h3>Σημεία ενδιαφέροντος</h3>${trail.notes.map(note => `<article><strong>${note.title ?? 'Σημείο διαδρομής'}</strong><p>${note.text}</p></article>`).join('')}</div>` : ''}`;
    details.classList.add('open');
  };

  const selectTrail = (code: string) => {
    if (selectedCode) {
      const previous = trails[selectedCode];
      layers.get(selectedCode)?.eachLayer(layer => { if (layer instanceof L.Polyline) layer.setStyle(styleFor(previous)); });
      document.querySelector(`[data-trail-code="${CSS.escape(selectedCode)}"]`)?.classList.remove('active');
    }
    selectedCode = code;
    const trail = trails[code];
    const group = layers.get(code);
    group?.eachLayer(layer => { if (layer instanceof L.Polyline) layer.setStyle(styleFor(trail, true)); });
    if (group?.getBounds().isValid()) map.fitBounds(group.getBounds(), { padding: [70, 70], maxZoom: 15 });
    document.querySelector(`[data-trail-code="${CSS.escape(code)}"]`)?.classList.add('active');
    renderDetails(code, trail);
    panel.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  const codes = Object.keys(trails).sort((a, b) => trails[b].length_km - trails[a].length_km);
  let totalLength = 0;
  for (const code of codes) {
    const trail = trails[code];
    totalLength += trail.length_km;
    const group = L.featureGroup().addTo(map);
    layers.set(code, group);
    for (const segment of trail.segments) {
      const points: L.LatLngExpression[] = segment.map(([lng, lat]) => [lat, lng]);
      points.forEach(point => bounds.push(point));
      L.polyline(points, styleFor(trail)).addTo(group).on('click', () => selectTrail(code));
    }
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'trail-row'; button.dataset.trailCode = code;
    button.innerHTML = `<span class="trail-swatch ${trail.existing ? '' : 'planned'}"></span><span class="trail-name"><b>${code}</b>${trail.name}</span><span class="trail-distance">${trail.length_km.toFixed(1)} χλμ</span>`;
    button.addEventListener('click', () => selectTrail(code)); listElement.append(button);
  }
  if (countElement) countElement.textContent = String(codes.length);
  if (lengthElement) lengthElement.textContent = totalLength.toFixed(1);
  if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
  menuButton.addEventListener('click', () => { const open = panel.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
  detailsClose?.addEventListener('click', () => details.classList.remove('open'));
}

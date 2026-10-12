import L from 'leaflet';
import type { TrailCollection } from '../types/trail';
import { API_URL, fallbackSpots, type RecreationSpot } from '../data/recreation-spots';
import { REVIEW_CENTER, REVIEW_RADII_KM, REVIEW_LANDMARKS, distanceKm, networkEnvelope, insideEnvelope, validPoint, type GeoPoint } from '../lib/destination-area-review';

const runtime = window as typeof window & { __panachaikoMap?: L.Map; __panachaikoTrails?: TrailCollection };
const review = document.getElementById('destinationAreaReview');
const details = document.getElementById('areaReviewDetails') as HTMLDetailsElement | null;
const coverage = document.getElementById('areaReviewCoverage');
const status = document.getElementById('areaReviewPoint');
const source = document.getElementById('areaReviewSource');
const pick = document.getElementById('areaReviewPick') as HTMLButtonElement | null;
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const start = async () => {
  if (!review || !coverage || !status || !source || !pick) return;
  const map = runtime.__panachaikoMap;
  if (!map) { window.setTimeout(() => void start(), 60); return; }
  if (window.matchMedia('(max-width:760px)').matches && details) details.open = false;
  L.DomEvent.disableClickPropagation(review);
  L.DomEvent.disableScrollPropagation(review);
  let spots: RecreationSpot[] = fallbackSpots;
  let spotSource = 'αποθηκευμένα σημεία αναψυχής';
  try {
    const response = await fetch(API_URL, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload)) {
        const valid = payload.filter(item => item && item.lat !== null && item.lng !== null && item.lat !== '' && item.lng !== '' && validPoint([Number(item.lat), Number(item.lng)]));
        if (valid.length) {
          spots = valid.map(item => ({ ...item, lat: Number(item.lat), lng: Number(item.lng) }));
          spotSource = 'σημεία αναψυχής από CMS';
        }
      }
    }
  } catch { /* Retain the application's published fallback locations. */ }

  const colors: Record<string, string> = { '12': '#59636b', '15': '#b7430e', '18': '#658d8b', network: '#346341' };
  const layers = new Map<string, L.Path>();
  const group = L.featureGroup().addTo(map);
  REVIEW_RADII_KM.forEach(radius => layers.set(String(radius), L.circle(REVIEW_CENTER, {
    radius: radius * 1000, color: colors[String(radius)], weight: 2, fillOpacity: .015,
    dashArray: radius === 15 ? undefined : '7 6', interactive: false
  })));
  let polygon: GeoPoint[] = [];
  let trailPoints: Array<{ code: string; points: GeoPoint[] }> = [];
  let testing = false;
  let testMarker: L.CircleMarker | null = null;
  let testPoint: GeoPoint | null = null;

  const descriptionFor = (point: GeoPoint) => {
    const distance = distanceKm(REVIEW_CENTER, point);
    return `${distance.toFixed(2)} χλμ. από την κορυφή · ` + REVIEW_RADII_KM.map(radius => `${radius} χλμ.: ${distance <= radius ? 'εντός' : 'εκτός'}`).join(' · ') +
      ` · Περίγραμμα δικτύου: ${insideEnvelope(point, polygon) ? 'εντός' : 'εκτός'}`;
  };
  const showTestPoint = (point: GeoPoint) => {
    testPoint = point;
    status.textContent = `${point[0].toFixed(6)}, ${point[1].toFixed(6)} — ${descriptionFor(point)}. Δεν εφαρμόζεται περιορισμός.`;
    if (testMarker) map.removeLayer(testMarker);
    testMarker = L.circleMarker(point, { radius: 7, color: '#20221d', fillColor: '#ead694', fillOpacity: 1, weight: 2 }).addTo(map);
  };
  const syncLayers = () => {
    review.querySelectorAll<HTMLInputElement>('[data-review-layer]').forEach(input => {
      const layer = layers.get(input.dataset.reviewLayer ?? '');
      if (!layer) return;
      if (input.checked && !group.hasLayer(layer)) group.addLayer(layer);
      if (!input.checked && group.hasLayer(layer)) group.removeLayer(layer);
    });
  };
  const drawCoverage = () => {
    const rows = REVIEW_RADII_KM.map(radius => {
      const trailsInside = trailPoints.filter(trail => trail.points.every(point => distanceKm(REVIEW_CENTER, point) <= radius)).length;
      const spotsInside = spots.filter(spot => distanceKm(REVIEW_CENTER, [spot.lat, spot.lng]) <= radius).length;
      return `<tr><td>${radius} χλμ.</td><td>${trailsInside}/${trailPoints.length}</td><td>${spotsInside}/${spots.length}</td></tr>`;
    });
    const trailsInside = trailPoints.filter(trail => trail.points.every(point => insideEnvelope(point, polygon))).length;
    const spotsInside = spots.filter(spot => insideEnvelope([spot.lat, spot.lng], polygon)).length;
    rows.push(`<tr><td>Περίγραμμα +1 χλμ.</td><td>${trailsInside}/${trailPoints.length}</td><td>${spotsInside}/${spots.length}</td></tr>`);
    coverage.innerHTML = rows.join('');
    const landmarkList = document.getElementById('areaReviewLandmarks');
    if (landmarkList) landmarkList.innerHTML = REVIEW_LANDMARKS.map(item => `<p><b>${escape(item.name)}</b><br>${escape(descriptionFor(item.point))}</p>`).join('');
    const app = document.querySelector<HTMLElement>('[data-trail-app]');
    source.textContent = `Κέντρο: καταχωρημένη κορυφή Π-9 / Π-12 (${REVIEW_CENTER.join(', ')}). ${app?.dataset.trailSource === 'cms' ? 'Μονοπάτια από CMS' : 'Αποθηκευμένα δεδομένα μονοπατιών'} · ${spotSource}.`;
  };
  const rebuild = () => {
    trailPoints = Object.entries(runtime.__panachaikoTrails ?? {}).map(([code, trail]) => ({
      code, points: trail.segments.flatMap(segment => segment.map(([lng, lat]) => [lat, lng] as GeoPoint)).filter(validPoint)
    })).filter(trail => trail.points.length >= 2);
    polygon = networkEnvelope([...trailPoints.flatMap(trail => trail.points), ...spots.map(spot => [spot.lat, spot.lng] as GeoPoint)]);
    const old = layers.get('network');
    if (old) group.removeLayer(old);
    if (polygon.length) layers.set('network', L.polygon(polygon, { color: colors.network, weight: 3, fillOpacity: .07, interactive: false }));
    else layers.delete('network');
    syncLayers(); drawCoverage();
    if (testPoint) showTestPoint(testPoint);
  };
  const addReference = (point: GeoPoint, name: string, summit = false, label = 'Δ') => {
    L.marker(point, {
      title: name, icon: L.divIcon({ className: '', html: `<span class="area-review-marker${summit ? ' summit' : ''}">${summit ? '▲' : label}</span>`, iconSize: [20, 20], iconAnchor: [10, 10] })
    }).bindTooltip(escape(name), { direction: 'top' }).on('click', () => {
      if (details) details.open = true;
      showTestPoint(point);
    }).addTo(group);
  };
  addReference(REVIEW_CENTER, 'Κορυφή — σημείο αναφοράς Π-9 / Π-12', true);
  REVIEW_LANDMARKS.forEach(item => addReference(item.point, item.name));
  spots.forEach(spot => addReference([spot.lat, spot.lng], spot.title, false, '●'));
  const fit = () => {
    const paddingLeft = window.innerWidth > 760 && details?.open ? 365 : 24;
    const paddingTop = window.innerWidth <= 760 && details?.open ? Math.min(window.innerHeight * .48, 380) : 90;
    const bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { paddingTopLeft: L.point(paddingLeft, paddingTop), paddingBottomRight: L.point(24, 100), animate: false });
  };
  review.querySelectorAll<HTMLInputElement>('[data-review-layer]').forEach(input => input.addEventListener('change', syncLayers));
  document.getElementById('areaReviewFit')?.addEventListener('click', fit);
  pick.addEventListener('click', () => {
    testing = !testing; pick.setAttribute('aria-pressed', String(testing));
    map.getContainer().style.cursor = testing ? 'crosshair' : '';
    status.textContent = testing ? 'Πατήστε στο σημείο του χάρτη που θέλετε να ελέγξετε. Escape για ακύρωση.' : 'Ο έλεγχος σημείου ακυρώθηκε.';
    if (testing && window.innerWidth <= 760 && details) details.open = false;
  });
  map.on('click', (event: L.LeafletMouseEvent) => {
    if (!testing) return;
    testing = false; pick.setAttribute('aria-pressed', 'false'); map.getContainer().style.cursor = '';
    if (details) details.open = true;
    showTestPoint([event.latlng.lat, event.latlng.lng]);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && testing) { testing = false; pick.setAttribute('aria-pressed', 'false'); map.getContainer().style.cursor = ''; status.textContent = 'Ο έλεγχος σημείου ακυρώθηκε.'; }
  });
  document.addEventListener('panachaiko:trails-updated', () => window.requestAnimationFrame(rebuild));
  rebuild(); fit();
};

if (review) void start();

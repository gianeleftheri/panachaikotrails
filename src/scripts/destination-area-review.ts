import L from 'leaflet';
import { REVIEW_CENTER, distanceKm, type GeoPoint } from '../lib/destination-area-review';
const runtime = window as typeof window & { __panachaikoMap?: L.Map };
const start = () => {
  const map = runtime.__panachaikoMap;
  if (!map) { window.setTimeout(start, 60); return; }
  const panel = document.getElementById('destinationAreaReview')!;
  const routePanel = document.getElementById('routeBuilderPanel')!;
  const trailSelect = document.getElementById('rbTrailSelect') as HTMLSelectElement;
  const pick = document.getElementById('areaReviewPick') as HTMLButtonElement;
  const notice = document.getElementById('destinationBoundaryNotice')!;
  const status = document.getElementById('rbResultStatus')!;
  const lat = document.getElementById('destinationLat') as HTMLInputElement;
  const lng = document.getElementById('destinationLng') as HTMLInputElement;
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  L.DomEvent.disableClickPropagation(notice);
  const circle = L.circle(REVIEW_CENTER, { radius:12000, color:'#b7430e', weight:2, fillOpacity:.035, interactive:false }).addTo(map);
  let selecting = false;
  let marker: L.Marker | null = null;
  const stop = () => { selecting = false; pick.setAttribute('aria-pressed','false'); map.getContainer().style.cursor = ''; };
  notice.querySelector('button')!.addEventListener('click', () => { notice.hidden = true; });
  document.getElementById('areaReviewFit')!.addEventListener('click', () => map.fitBounds(circle.getBounds(), {padding:[40,80]}));
  pick.addEventListener('click', () => {
    selecting = !selecting;
    pick.setAttribute('aria-pressed',String(selecting));
    map.getContainer().style.cursor = selecting ? 'crosshair' : '';
    if (selecting && window.innerWidth <= 760) routePanel.classList.remove('open');
  });
  map.on('click', (event: L.LeafletMouseEvent) => {
    notice.hidden = true;
    if (!selecting) return;
    const point: GeoPoint = [event.latlng.lat,event.latlng.lng];
    const outside = distanceKm(REVIEW_CENTER,point) - 12;
    if (outside > 0) {
      notice.querySelector('span')!.textContent = `Το σημείο βρίσκεται εκτός ορίων κατά ${outside.toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2})} χλμ. Επιλέξτε σημείο μέσα στον κύκλο των 12 χλμ.`;
      notice.hidden = false;
      return;
    }
    stop();
    trailSelect.value = '';
    routePanel.classList.add('open');
    lat.value = point[0].toFixed(6); lng.value = point[1].toFixed(6);
    if (marker) marker.remove();
    marker = L.marker(point).addTo(map);
    status.hidden = true; status.textContent = '';
    document.dispatchEvent(new CustomEvent('panachaiko:destination-route-request',{detail:{point}}));
  });
  trailSelect.addEventListener('change', () => {
    stop(); lat.value = ''; lng.value = '';
    if (marker) { marker.remove(); marker = null; }
    document.dispatchEvent(new CustomEvent('panachaiko:destination-clear'));
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { stop(); notice.hidden = true; } });
};
if (document.getElementById('destinationAreaReview')) start();

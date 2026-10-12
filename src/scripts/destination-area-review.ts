import L from 'leaflet';
import { API_URL, fallbackSpots, type RecreationSpot } from '../data/recreation-spots';
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
  const recreationSelect = document.getElementById('rbRecreationSelect') as HTMLSelectElement;
  const calc = document.getElementById('rbCalcBtn') as HTMLButtonElement;
  const kindInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="rbDestinationKind"]')];
  let kind = 'trail';
  let spots: RecreationSpot[] = fallbackSpots;
  const renderSpots = () => {
    const previous = recreationSelect.value;
    recreationSelect.replaceChildren(new Option('— Διάλεξε σημείο αναψυχής —', ''));
    spots.forEach((spot,index) => recreationSelect.add(new Option(spot.title, String(index))));
    recreationSelect.value = previous;
  };
  renderSpots();
  void fetch(API_URL, {credentials:'omit',signal:AbortSignal.timeout(5000)}).then(r => r.ok ? r.json() : null).then(data => {
    if (Array.isArray(data)) {
      const valid = data.filter(p => p && p.lat != null && p.lng != null && p.lat !== '' && p.lng !== '' && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)));
      if (valid.length) { spots = valid.map(p => ({...p,lat:Number(p.lat),lng:Number(p.lng)})); renderSpots(); }
    }
  }).catch(() => {});
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
    clearPlan();
    selecting = !selecting;
    pick.setAttribute('aria-pressed',String(selecting));
    map.getContainer().style.cursor = selecting ? 'crosshair' : '';
    if (selecting && window.innerWidth <= 760) routePanel.classList.remove('open');
  });
  map.on('click', (event: L.LeafletMouseEvent) => {
    notice.hidden = true;
    if (!selecting || kind !== 'custom') return;
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
    clearPlan(); calc.disabled = false;
  });
  const clearPlan = () => document.dispatchEvent(new CustomEvent('panachaiko:destination-clear'));
  const setKind = (next: string) => {
    kind = next; panel.dataset.kind = kind;
    kindInputs.forEach(input => { input.checked = input.value === kind; });
    stop(); notice.hidden = true; lat.value = ''; lng.value = '';
    if (marker) { marker.remove(); marker = null; }
    trailSelect.disabled = kind !== 'trail';
    recreationSelect.disabled = kind !== 'recreation';
    pick.disabled = kind !== 'custom';
    (document.getElementById('areaReviewFit') as HTMLButtonElement).disabled = kind !== 'custom';
    lat.disabled = lng.disabled = kind === 'trail';
    document.getElementById('rbTrailHelp')!.hidden = kind !== 'trail';
    clearPlan();
    calc.disabled = kind === 'trail' ? !trailSelect.value : true;
  };
  const chooseRecreation = () => {
    clearPlan(); stop();
    const spot = recreationSelect.value === '' ? null : spots[Number(recreationSelect.value)];
    lat.value = spot ? spot.lat.toFixed(6) : ''; lng.value = spot ? spot.lng.toFixed(6) : '';
    const outside = spot ? distanceKm(REVIEW_CENTER, [spot.lat, spot.lng]) - 12 : 0;
    calc.disabled = !spot || outside > 0;
    notice.hidden = outside <= 0;
    if (outside > 0) notice.querySelector('span')!.textContent = `Το σημείο βρίσκεται εκτός ορίων κατά ${outside.toFixed(2)} χλμ.`;
  };
  kindInputs.forEach(input => input.addEventListener('change', () => {
    setKind(input.value);
    if (kind === 'recreation') chooseRecreation();
  }));
  recreationSelect.addEventListener('change', chooseRecreation);
  trailSelect.addEventListener('change', () => { setKind('trail'); });
  document.addEventListener('panachaiko:trail-selected', () => { if (kind !== 'trail') setKind('trail'); });
  document.addEventListener('panachaiko:recreation-selected', event => {
    const spot = (event as CustomEvent<{spot:RecreationSpot}>).detail?.spot;
    if (!spot) return;
    let index = spots.findIndex(item => Number(item.lat) === Number(spot.lat) && Number(item.lng) === Number(spot.lng));
    if (index < 0) { spots.push(spot); renderSpots(); index = spots.length - 1; }
    setKind('recreation'); recreationSelect.value = String(index); chooseRecreation();
  });
  document.addEventListener('panachaiko:navigation-start', () => {
    stop(); notice.hidden = true;
    panel.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,button,select').forEach(input => { input.disabled = true; });
  });
  document.addEventListener('panachaiko:navigation-exit', () => {
    kindInputs.forEach(input => { input.disabled = false; });
    const previousLat = lat.value, previousLng = lng.value;
    setKind(kind);
    if (kind === 'recreation') chooseRecreation();
    else if (kind === 'custom') { lat.value = previousLat; lng.value = previousLng; calc.disabled = !lat.value; }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { stop(); notice.hidden = true; } });
};
if (document.getElementById('destinationAreaReview')) start();

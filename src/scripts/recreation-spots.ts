import { trailIcon } from '../lib/trail-icons';
import L from 'leaflet';

type RecreationSpot = {
  id: number | string;
  title: string;
  description: string;
  type: 'recreation_viewpoint' | 'watchtower_site' | 'other' | string;
  settlement: string;
  lat: number;
  lng: number;
  elevation_m: number | null;
  featured_image_url: string | null;
  fallback_image_url: string | null;
  source_url: string;
};

const API_URL = import.meta.env.PUBLIC_RECREATION_API_URL || 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/recreation-spots';
const SOURCE_URL = 'https://e-patras.gr/el/qrcode-panahaiko';

const fallbackSpots: RecreationSpot[] = [
  { id:'tranos-vrachos', title:'Τρανός Βράχος', type:'recreation_viewpoint', settlement:'Σούλι / Ελικίστρα', lat:38.201704, lng:21.799969, elevation_m:740, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1UxkSHJ-zKIVf1U2MQFGmG3yHV74nhXTJ&sz=w1200', source_url:SOURCE_URL, description:'Θέση νοτιοδυτικά του Πουρναρόκαστρου, προς την κατεύθυνση του Chalet, με πρόσβαση από βατό χωματόδρομο. Προσφέρει πανοραμική θέα προς τον Πατραϊκό κόλπο, το Μεσολόγγι και τη Γέφυρα Ρίου–Αντιρρίου.' },
  { id:'agios-ioannis-kokkinovrysi', title:'Άγιος Ιωάννης – Κοκκινόβρυση', type:'recreation_viewpoint', settlement:'Ελικίστρα / Βούντενη', lat:38.230763, lng:21.831333, elevation_m:1094, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=15vr7K0z4NMGrPDehQKMXXAPtAtVcX7bT&sz=w1200', source_url:SOURCE_URL, description:'Χώρος στον προαύλιο χώρο του ξωκλησιού του Αγίου Ιωάννη, περίπου 500 μέτρα μετά τον ασφαλτοστρωμένο δρόμο Ελικίστρα – Ζάστοβα – Κοκκινόβρυση. Η προσέγγιση περνά μέσα από δάσος κεφαλληνιακής ελάτης.' },
  { id:'lakka-sorous', title:'Λάκκα Σορούς', type:'recreation_viewpoint', settlement:'Μοίρα', lat:38.167958, lng:21.829067, elevation_m:695, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1y8KSrj4zlHSGbYRMXEfqh9rNfFzAJxjQ&sz=w1200', source_url:SOURCE_URL, description:'Βρίσκεται στον ασφαλτοστρωμένο δρόμο Αγίου Ιωάννη Σουλίου – Μοίρας, περίπου δύο χιλιόμετρα πριν από τη Μοίρα. Η θέση προσφέρει θέα προς την κοιλάδα του Γλαύκου και τον Πατραϊκό κόλπο.' },
  { id:'mintzaika', title:'Μιντζαίικα', type:'recreation_viewpoint', settlement:'Σούλι', lat:38.182962, lng:21.820551, elevation_m:645, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1uV86yvvhWXoHi1kCTe_LPvOXKjFRgQn6&sz=w1200', source_url:SOURCE_URL, description:'Μικρό πλάτωμα στον ασφαλτοστρωμένο δρόμο προς τον Άγιο Ιωάννη Σουλίου, πριν από τα Μιντζαίικα. Προσφέρει θέα προς την κοιλάδα του Γλαύκου, τον Πατραϊκό κόλπο και τις γύρω ορεινές πλαγιές.' },
  { id:'skala-vountenis', title:'Σκάλα Βούντενης', type:'watchtower_site', settlement:'Βούντενη', lat:38.254820, lng:21.818761, elevation_m:620, featured_image_url:null, fallback_image_url:null, source_url:SOURCE_URL, description:'Θέση στον δρόμο Βούντενη – Δραγώλενα – Κοκκινόβρυση, περίπου δύο χιλιόμετρα από τη Βούντενη. Προσφέρει θέα προς τον Χάραδρο και προς τις περιοχές του Ρίου και του Άνω Καστριτσίου.' },
  { id:'profitis-ilias-pournarokastro', title:'Προφήτης Ηλίας Πουρναρόκαστρο', type:'watchtower_site', settlement:'Ελικίστρα', lat:38.211121, lng:21.810584, elevation_m:694, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1y9kKnsdjqKF5yAFd2AbMp4Vx7B21k_ZP&sz=w1200', source_url:SOURCE_URL, description:'Σημείο στο Πουρναρόκαστρο, στον λόφο του Προφήτη Ηλία με το ομώνυμο εκκλησάκι. Η θέση προσφέρει πανοραμική θέα 360° στην ευρύτερη περιοχή.' }
];

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
    });
    list.appendChild(row);
    rowById.set(id, row);
  });

  const setOpen = (open: boolean) => {
    panel.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));

    if (open) {
      document.getElementById('trailPanel')?.classList.remove('open');
      document.getElementById('trailMenuToggle')?.classList.remove('open');
      document.getElementById('trailMenuToggle')?.setAttribute('aria-expanded', 'false');
      document.getElementById('routeBuilderPanel')?.classList.remove('open');
      document.getElementById('routeBuilderToggle')?.classList.remove('open');
      document.getElementById('shelterPanel')?.classList.remove('show');
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  };

  toggle.addEventListener('click', event => {
    event.preventDefault();
    setOpen(!panel.classList.contains('open'));
  });
  close?.addEventListener('click', () => setOpen(false));

  document.getElementById('trailMenuToggle')?.addEventListener('click', () => {
    if (panel.classList.contains('open')) setOpen(false);
  });
  document.getElementById('routeBuilderToggle')?.addEventListener('click', () => {
    if (panel.classList.contains('open')) setOpen(false);
  });
};

void start();

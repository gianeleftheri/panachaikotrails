export type RecreationSpot = {
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

export const API_URL = import.meta.env.PUBLIC_RECREATION_API_URL || 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/recreation-spots';
const SOURCE_URL = 'https://e-patras.gr/el/qrcode-panahaiko';

export const fallbackSpots: RecreationSpot[] = [
  { id:'tranos-vrachos', title:'Τρανός Βράχος', type:'recreation_viewpoint', settlement:'Σούλι / Ελικίστρα', lat:38.201704, lng:21.799969, elevation_m:740, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1UxkSHJ-zKIVf1U2MQFGmG3yHV74nhXTJ&sz=w1200', source_url:SOURCE_URL, description:'Θέση νοτιοδυτικά του Πουρναρόκαστρου, προς την κατεύθυνση του Chalet, με πρόσβαση από βατό χωματόδρομο. Προσφέρει πανοραμική θέα προς τον Πατραϊκό κόλπο, το Μεσολόγγι και τη Γέφυρα Ρίου–Αντιρρίου.' },
  { id:'agios-ioannis-kokkinovrysi', title:'Άγιος Ιωάννης – Κοκκινόβρυση', type:'recreation_viewpoint', settlement:'Ελικίστρα / Βούντενη', lat:38.230763, lng:21.831333, elevation_m:1094, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=15vr7K0z4NMGrPDehQKMXXAPtAtVcX7bT&sz=w1200', source_url:SOURCE_URL, description:'Χώρος στον προαύλιο χώρο του ξωκλησιού του Αγίου Ιωάννη, περίπου 500 μέτρα μετά τον ασφαλτοστρωμένο δρόμο Ελικίστρα – Ζάστοβα – Κοκκινόβρυση. Η προσέγγιση περνά μέσα από δάσος κεφαλληνιακής ελάτης.' },
  { id:'lakka-sorous', title:'Λάκκα Σορούς', type:'recreation_viewpoint', settlement:'Μοίρα', lat:38.167958, lng:21.829067, elevation_m:695, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1y8KSrj4zlHSGbYRMXEfqh9rNfFzAJxjQ&sz=w1200', source_url:SOURCE_URL, description:'Βρίσκεται στον ασφαλτοστρωμένο δρόμο Αγίου Ιωάννη Σουλίου – Μοίρας, περίπου δύο χιλιόμετρα πριν από τη Μοίρα. Η θέση προσφέρει θέα προς την κοιλάδα του Γλαύκου και τον Πατραϊκό κόλπο.' },
  { id:'mintzaika', title:'Μιντζαίικα', type:'recreation_viewpoint', settlement:'Σούλι', lat:38.182962, lng:21.820551, elevation_m:645, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1uV86yvvhWXoHi1kCTe_LPvOXKjFRgQn6&sz=w1200', source_url:SOURCE_URL, description:'Μικρό πλάτωμα στον ασφαλτοστρωμένο δρόμο προς τον Άγιο Ιωάννη Σουλίου, πριν από τα Μιντζαίικα. Προσφέρει θέα προς την κοιλάδα του Γλαύκου, τον Πατραϊκό κόλπο και τις γύρω ορεινές πλαγιές.' },
  { id:'skala-vountenis', title:'Σκάλα Βούντενης', type:'watchtower_site', settlement:'Βούντενη', lat:38.254820, lng:21.818761, elevation_m:620, featured_image_url:null, fallback_image_url:null, source_url:SOURCE_URL, description:'Θέση στον δρόμο Βούντενη – Δραγώλενα – Κοκκινόβρυση, περίπου δύο χιλιόμετρα από τη Βούντενη. Προσφέρει θέα προς τον Χάραδρο και προς τις περιοχές του Ρίου και του Άνω Καστριτσίου.' },
  { id:'profitis-ilias-pournarokastro', title:'Προφήτης Ηλίας Πουρναρόκαστρο', type:'watchtower_site', settlement:'Ελικίστρα', lat:38.211121, lng:21.810584, elevation_m:694, featured_image_url:null, fallback_image_url:'https://drive.google.com/thumbnail?id=1y9kKnsdjqKF5yAFd2AbMp4Vx7B21k_ZP&sz=w1200', source_url:SOURCE_URL, description:'Σημείο στο Πουρναρόκαστρο, στον λόφο του Προφήτη Ηλία με το ομώνυμο εκκλησάκι. Η θέση προσφέρει πανοραμική θέα 360° στην ευρύτερη περιοχή.' }
];


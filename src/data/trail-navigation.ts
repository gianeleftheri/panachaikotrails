export type TrailNavigationAnchor = [number, number]; // [lat, lng]

export type TrailNavigationConfig = {
  start: TrailNavigationAnchor;
  end: TrailNavigationAnchor;
  startLabel?: string;
  endLabel?: string;
  verified?: boolean;
};

// Official A -> T navigation anchors. These are intentionally independent from
// segment storage order: several imported MultiLineStrings are stored backwards
// or with their first segment in the middle of the route.
export const TRAIL_NAVIGATION_CONFIG: Record<string, TrailNavigationConfig> = {
  'Π-1': {
    start: [38.21010, 21.81254],
    end: [38.21293, 21.84344],
    startLabel: 'ΠΟΥΡΝΑΡΟΚΑΣΤΡΟ',
    endLabel: 'ΚΑΤΑΦΥΓΙΟ',
    verified: true
  },
  'Π-12': {
    start: [38.15207, 21.85482],
    end: [38.19612, 21.87071],
    startLabel: 'ΜΟΙΡΑ',
    endLabel: 'ΚΟΡΥΦΗ',
    verified: true
  },
  'Π-12Α': {
    // Connector inside Π-12. Orient it in the same Moira -> summit progression.
    start: [38.15168, 21.87742],
    end: [38.15819, 21.88413],
    startLabel: 'Π-12Α · Αφετηρία',
    endLabel: 'Π-12Α · Τέλος',
    verified: false
  },
  'Π-14': {
    start: [38.15207, 21.85482],
    end: [38.13935, 21.90186],
    startLabel: 'ΜΟΙΡΑ',
    endLabel: 'ΒΕΤΑΙΪΚΑ',
    verified: true
  },
  'Π-3': {
    start: [38.22888, 21.79129],
    end: [38.23064, 21.83127],
    startLabel: 'ΡΩΜΑΝΟΣ',
    endLabel: 'ΚΟΚΚΙΝΟΒΡΥΣΗ',
    verified: true
  },
  'Π-4': {
    start: [38.25456, 21.79886],
    end: [38.23114, 21.83039],
    startLabel: 'ΜΠΑΛΑ',
    endLabel: 'ΚΟΚΚΙΝΟΒΡΥΣΗ',
    verified: true
  },
  'Π-5': {
    start: [38.23064, 21.83127],
    end: [38.21411, 21.84418],
    startLabel: 'ΚΟΚΚΙΝΟΒΡΥΣΗ',
    endLabel: 'ΚΑΤΑΦΥΓΙΟ ΨΑΡΘΙ',
    verified: true
  },
  'Π-6': {
    start: [38.21293, 21.84344],
    end: [38.20300, 21.86443],
    startLabel: 'ΚΑΤΑΦΥΓΙΟ',
    endLabel: 'ΠΡΑΣΟΥΔΙ',
    verified: true
  },
  'Π-8': {
    start: [38.27153, 21.83519],
    end: [38.20300, 21.86443],
    startLabel: 'ΑΝΩ ΚΑΣΤΡΙΤΣΙ',
    endLabel: 'ΠΡΑΣΟΥΔΙ',
    verified: true
  },
  'Π-9': {
    start: [38.20300, 21.86443],
    end: [38.19612, 21.87071],
    startLabel: 'ΠΡΑΣΟΥΔΙ',
    endLabel: 'ΚΟΡΥΦΗ',
    verified: true
  },
  'Ε31': {
    start: [38.19391, 21.77157],
    end: [38.15943, 21.81247],
    startLabel: 'ACHAIA CLAUS',
    endLabel: 'ΠΕΤΡΩΤΟ',
    verified: true
  },
  'Π-13': {
    start: [38.15943, 21.81247],
    end: [38.15207, 21.85482],
    startLabel: 'ΠΕΤΡΩΤΟ (διασταύρωση)',
    endLabel: 'ΜΟΙΡΑ',
    verified: true
  },
  'Π-1Α': {
    // Source note says this begins next to Π-1 and ends on Π-3; still under investigation.
    start: [38.21634, 21.81876],
    end: [38.22227, 21.81982],
    startLabel: 'ΣΥΝΔΕΣΗ ΑΠΟ Π-1',
    endLabel: 'ΣΥΝΔΕΣΗ ΠΡΟΣ Π-3',
    verified: false
  }
};

export const getTrailNavigationConfig = (code: string): TrailNavigationConfig | undefined =>
  TRAIL_NAVIGATION_CONFIG[code];

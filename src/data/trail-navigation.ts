export type TrailNavigationDirection = 'stored' | 'reverse';

export type TrailNavigationConfig = {
  direction: TrailNavigationDirection;
  startLabel?: string;
  endLabel?: string;
};

// Navigation direction must describe the official A -> T hiking direction,
// independently from the order in which geometry happens to be stored/imported.
// Add a code here whenever the source geometry is stored in the opposite direction.
export const TRAIL_NAVIGATION_CONFIG: Record<string, TrailNavigationConfig> = {
  'Π-3': {
    direction: 'reverse',
    startLabel: 'ΡΩΜΑΝΟΣ',
    endLabel: 'ΚΟΚΚΙΝΟΒΡΥΣΗ'
  }
};

export const getTrailNavigationConfig = (code: string): TrailNavigationConfig =>
  TRAIL_NAVIGATION_CONFIG[code] ?? { direction: 'stored' };

export type TrailPoint = [longitude: number, latitude: number, elevation?: number | null];
export type TrailNote = { title?: string; text: string; category?: string; lat?: number; lng?: number };
export type TrailStatus = 'existing' | 'planned' | 'investigation';
export type Trail = {
  name: string;
  existing: boolean;
  status?: TrailStatus;
  color: string;
  length_km: number;
  elev_min: number | null;
  elev_max: number | null;
  gain_m: number;
  loss_m: number;
  segments: TrailPoint[][];
  photos: unknown[];
  videos: unknown[];
  notes: TrailNote[];
};
export type TrailCollection = Record<string, Trail>;

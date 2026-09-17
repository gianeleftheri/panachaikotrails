export type TrailPoint = [longitude: number, latitude: number, elevation?: number];
export type TrailNote = { title?: string; text: string; category?: string; lat?: number; lng?: number };
export type Trail = {
  name: string; existing: boolean; color: string; length_km: number;
  elev_min: number; elev_max: number; gain_m: number; loss_m: number;
  segments: TrailPoint[][]; photos: unknown[]; videos: unknown[]; notes: TrailNote[];
};
export type TrailCollection = Record<string, Trail>;

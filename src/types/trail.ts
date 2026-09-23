export type TrailPoint = [longitude: number, latitude: number, elevation?: number | null];
export type TrailStatus = 'existing' | 'planned' | 'investigation';
export type TrailPoiCategory = 'note' | 'shelter' | 'hazard' | 'water' | 'viewpoint' | 'photo' | 'video' | 'general' | string;

export type TrailNavigation = {
  start: [latitude: number, longitude: number];
  end: [latitude: number, longitude: number];
  start_label?: string;
  end_label?: string;
  direction_verified?: boolean;
};

export type TrailPoi = {
  id?: number;
  title?: string;
  text: string;
  category?: TrailPoiCategory;
  lat?: number | null;
  lng?: number | null;
  media_ids?: number[];
  media_urls?: string[];
  featured_image_url?: string | null;
  video_url?: string;
  verified_at?: string;
  created_at?: string;
};

export type Trail = {
  name: string;
  description?: string;
  existing: boolean;
  status?: TrailStatus;
  color: string;
  length_km: number;
  elev_min: number | null;
  elev_max: number | null;
  gain_m: number;
  loss_m: number;
  duration_minutes?: number;
  difficulty?: string;
  segments: TrailPoint[][];
  photos: TrailPoi[];
  videos: TrailPoi[];
  notes: TrailPoi[];
  source?: string;
  verified_at?: string;
  navigation?: TrailNavigation;
};

export type TrailCollection = Record<string, Trail>;

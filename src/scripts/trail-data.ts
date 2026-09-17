import type { Trail, TrailCollection, TrailPoi, TrailPoint, TrailStatus } from '../types/trail';
import { decodeHtmlEntities } from './text-normalize';

type TrailDataModule = { key: string; trail: unknown };
type ApiTrailItem = { key?: unknown; trail?: unknown };
type TrailCache = { savedAt: number; trails: TrailCollection };

const CACHE_KEY = 'panachaiko-trails-cache-v5';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CMS_TRAILS_URL = import.meta.env.PUBLIC_TRAILS_API_URL || 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/trails';

const trailModules = import.meta.glob<TrailDataModule>('../data/trails/*.json', { eager: true, import: 'default' });
const rawBundledTrails = Object.values(trailModules).reduce<Record<string, unknown>>(
  (all, item) => ({ ...all, [item.key]: item.trail }),
  {}
);

const asNumber = (value: unknown, fallback = 0): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const asStatus = (value: unknown, existing: boolean): TrailStatus => {
  if (value === 'existing' || value === 'planned' || value === 'investigation') return value;
  return existing ? 'existing' : 'planned';
};

const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const asNumberArray = (value: unknown): number[] => Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];

const normalizePoi = (value: unknown): TrailPoi | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  return {
    id: Number.isFinite(Number(raw.id)) ? Number(raw.id) : undefined,
    title: typeof raw.title === 'string' ? decodeHtmlEntities(raw.title) : undefined,
    text: typeof raw.text === 'string' ? decodeHtmlEntities(raw.text) : '',
    category: typeof raw.category === 'string' ? raw.category : 'general',
    lat: asNullableNumber(raw.lat),
    lng: asNullableNumber(raw.lng),
    media_ids: asNumberArray(raw.media_ids),
    media_urls: asStringArray(raw.media_urls),
    featured_image_url: typeof raw.featured_image_url === 'string' && raw.featured_image_url ? raw.featured_image_url : null,
    video_url: typeof raw.video_url === 'string' ? raw.video_url : '',
    verified_at: typeof raw.verified_at === 'string' ? raw.verified_at : ''
  };
};

const normalizePoiArray = (value: unknown): TrailPoi[] => Array.isArray(value)
  ? value.map(normalizePoi).filter((poi): poi is TrailPoi => Boolean(poi))
  : [];

const normalizeSegments = (value: unknown): TrailPoint[][] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(Array.isArray)
    .map(segment => (segment as unknown[])
      .filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map(point => {
        const raw = point as unknown[];
        const elevation = raw.length > 2 && raw[2] !== null && Number.isFinite(Number(raw[2])) ? Number(raw[2]) : null;
        return [Number(raw[0]), Number(raw[1]), elevation] as TrailPoint;
      }))
    .filter(segment => segment.length >= 2);
};

const normalizeTrail = (value: unknown, fallback?: Trail): Trail | null => {
  if (!value || typeof value !== 'object') return fallback ?? null;
  const raw = value as Record<string, unknown>;
  const existing = raw.existing === undefined ? Boolean(fallback?.existing) : Boolean(raw.existing);
  const apiSegments = normalizeSegments(raw.segments);
  const segments = apiSegments.length ? apiSegments : (fallback?.segments ?? []);

  return {
    name: decodeHtmlEntities(typeof raw.name === 'string' && raw.name.trim() ? raw.name : (fallback?.name ?? '')),
    description: decodeHtmlEntities(typeof raw.description === 'string' ? raw.description : (fallback?.description ?? '')),
    existing,
    status: asStatus(raw.status, existing),
    color: typeof raw.color === 'string' && raw.color ? raw.color : (fallback?.color ?? '#84a06e'),
    length_km: raw.length_km === undefined ? (fallback?.length_km ?? 0) : asNumber(raw.length_km, fallback?.length_km ?? 0),
    elev_min: raw.elev_min === undefined ? (fallback?.elev_min ?? null) : asNullableNumber(raw.elev_min),
    elev_max: raw.elev_max === undefined ? (fallback?.elev_max ?? null) : asNullableNumber(raw.elev_max),
    gain_m: raw.gain_m === undefined ? (fallback?.gain_m ?? 0) : asNumber(raw.gain_m, fallback?.gain_m ?? 0),
    loss_m: raw.loss_m === undefined ? (fallback?.loss_m ?? 0) : asNumber(raw.loss_m, fallback?.loss_m ?? 0),
    segments,
    photos: raw.photos === undefined ? (fallback?.photos ?? []) : normalizePoiArray(raw.photos),
    videos: raw.videos === undefined ? (fallback?.videos ?? []) : normalizePoiArray(raw.videos),
    notes: raw.notes === undefined ? (fallback?.notes ?? []) : normalizePoiArray(raw.notes),
    source: decodeHtmlEntities(typeof raw.source === 'string' ? raw.source : (fallback?.source ?? '')),
    verified_at: typeof raw.verified_at === 'string' ? raw.verified_at : (fallback?.verified_at ?? '')
  };
};

const normalizeCollection = (collection: Record<string, unknown>): TrailCollection => Object.entries(collection).reduce<TrailCollection>((all, [key, value]) => {
  const trail = normalizeTrail(value);
  if (trail) all[key] = trail;
  return all;
}, {});

const bundledTrails: TrailCollection = normalizeCollection(rawBundledTrails);

const normalizeApiResponse = (payload: unknown): TrailCollection | null => {
  if (!Array.isArray(payload) || !payload.length) return null;

  // CMS fields override the bundled source, but the original 13 trails remain
  // the geometry safety net. A partial/broken CMS response must never make a
  // trail disappear from the public map.
  const collection: TrailCollection = { ...bundledTrails };
  let validCmsItems = 0;

  payload.forEach((item: ApiTrailItem) => {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string' || !item.key.trim()) return;
    const fallback = bundledTrails[item.key];
    const trail = normalizeTrail(item.trail, fallback);
    if (!trail) return;
    collection[item.key] = trail;
    validCmsItems += 1;
  });

  return validCmsItems ? collection : null;
};

const readCache = (): TrailCollection | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as TrailCache;
    if (!cache || typeof cache.savedAt !== 'number' || !cache.trails || typeof cache.trails !== 'object') return null;
    if (Date.now() - cache.savedAt > CACHE_MAX_AGE_MS) return null;
    return normalizeCollection(cache.trails as unknown as Record<string, unknown>);
  } catch {
    return null;
  }
};

const writeCache = (trails: TrailCollection): void => {
  try {
    const cache: TrailCache = { savedAt: Date.now(), trails };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage can be disabled or full; the app still works with CMS/bundled data.
  }
};

export const loadInitialTrails = (): TrailCollection => readCache() ?? bundledTrails;

export const refreshTrailsFromCms = async (): Promise<TrailCollection | null> => {
  try {
    const response = await fetch(CMS_TRAILS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit'
    });
    if (!response.ok) return null;

    const trails = normalizeApiResponse(await response.json());
    if (!trails) return null;

    writeCache(trails);
    return trails;
  } catch {
    return null;
  }
};

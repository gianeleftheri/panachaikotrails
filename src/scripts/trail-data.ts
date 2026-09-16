import type { Trail, TrailCollection, TrailStatus } from '../types/trail';

type TrailDataModule = { key: string; trail: Trail };
type ApiTrailItem = { key?: unknown; trail?: unknown };
type TrailCache = { savedAt: number; trails: TrailCollection };

const CACHE_KEY = 'panachaiko-trails-cache-v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CMS_TRAILS_URL = import.meta.env.PUBLIC_TRAILS_API_URL || 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/trails';

const trailModules = import.meta.glob<TrailDataModule>('../data/trails/*.json', { eager: true, import: 'default' });
const bundledTrails: TrailCollection = Object.values(trailModules).reduce<TrailCollection>(
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

const normalizeTrail = (value: unknown): Trail | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const existing = Boolean(raw.existing);
  const segments = Array.isArray(raw.segments) ? raw.segments : [];

  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    existing,
    status: asStatus(raw.status, existing),
    color: typeof raw.color === 'string' ? raw.color : '#84a06e',
    length_km: asNumber(raw.length_km),
    elev_min: asNullableNumber(raw.elev_min),
    elev_max: asNullableNumber(raw.elev_max),
    gain_m: asNumber(raw.gain_m),
    loss_m: asNumber(raw.loss_m),
    segments: segments as Trail['segments'],
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    videos: Array.isArray(raw.videos) ? raw.videos : [],
    notes: Array.isArray(raw.notes) ? raw.notes as Trail['notes'] : []
  };
};

const normalizeApiResponse = (payload: unknown): TrailCollection | null => {
  if (!Array.isArray(payload)) return null;
  const collection: TrailCollection = {};

  payload.forEach((item: ApiTrailItem) => {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string') return;
    const trail = normalizeTrail(item.trail);
    if (trail) collection[item.key] = trail;
  });

  return Object.keys(collection).length ? collection : null;
};

const readCache = (): TrailCollection | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as TrailCache;
    if (!cache || typeof cache.savedAt !== 'number' || !cache.trails || typeof cache.trails !== 'object') return null;
    if (Date.now() - cache.savedAt > CACHE_MAX_AGE_MS) return null;
    return cache.trails;
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

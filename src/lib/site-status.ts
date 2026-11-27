export type PanachaikoSiteStatus = {
  under_construction: boolean;
  public_trail_submissions: boolean;
};

const SITE_STATUS_URL =
  import.meta.env.PUBLIC_SITE_STATUS_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/site-status';

const STATUS_CACHE_MS = 5_000;
const MAX_STALE_MS = 30_000;
let cachedStatus: PanachaikoSiteStatus | null = null;
let cachedAt = 0;
let refreshPromise: Promise<PanachaikoSiteStatus> | null = null;

const isTrue = (value: unknown) =>
  value === true || value === 1 || value === '1' || value === 'true';

async function fetchPanachaikoSiteStatus(): Promise<PanachaikoSiteStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const url = new URL(SITE_STATUS_URL);
    url.searchParams.set('_status_ts', String(Date.now()));
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Site status HTTP ${response.status}`);
    const payload = await response.json();
    if (typeof payload?.under_construction !== 'boolean' && ![0, 1, '0', '1', 'true', 'false'].includes(payload?.under_construction)) {
      throw new Error('Invalid CMS site status response');
    }

    return {
      // Maintenance is enabled only when the CMS explicitly says true.
      under_construction: isTrue(payload?.under_construction),
      public_trail_submissions: isTrue(payload?.public_trail_submissions),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function refreshStatus(): Promise<PanachaikoSiteStatus> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetchPanachaikoSiteStatus()
    .then((status) => {
      cachedStatus = status;
      cachedAt = Date.now();
      return status;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function getPanachaikoSiteStatus(): Promise<PanachaikoSiteStatus> {
  const age = Date.now() - cachedAt;

  if (cachedStatus && age < STATUS_CACHE_MS) return cachedStatus;

  try {
    return await refreshStatus();
  } catch (error) {
    console.warn('[site-status] CMS status refresh failed', error);
    if (cachedStatus && age < MAX_STALE_MS) return cachedStatus;
    // Do not show the maintenance page because of a temporary CMS/network timeout.
    // The maintenance page is shown only when the CMS explicitly returns under_construction=true.
    return { under_construction: false, public_trail_submissions: false };
  }
}

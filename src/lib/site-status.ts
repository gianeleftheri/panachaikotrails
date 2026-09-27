export type PanachaikoSiteStatus = {
  under_construction: boolean;
  public_trail_submissions: boolean;
};

const SITE_STATUS_URL =
  import.meta.env.PUBLIC_SITE_STATUS_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/site-status';

const STATUS_CACHE_MS = 15_000;
let cachedStatus: PanachaikoSiteStatus | null = null;
let cachedAt = 0;
let refreshPromise: Promise<PanachaikoSiteStatus> | null = null;

async function fetchPanachaikoSiteStatus(): Promise<PanachaikoSiteStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    const response = await fetch(SITE_STATUS_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Site status HTTP ${response.status}`);
    const payload = await response.json();
    return {
      under_construction: payload?.under_construction !== false,
      public_trail_submissions: payload?.public_trail_submissions === true,
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

  if (cachedStatus) {
    void refreshStatus().catch(() => {});
    return cachedStatus;
  }

  try {
    return await refreshStatus();
  } catch {
    // Fail closed: if the CMS cannot be reached on a cold request, keep the public site protected.
    return { under_construction: true, public_trail_submissions: false };
  }
}

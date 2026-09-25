export type PanachaikoSiteStatus = {
  under_construction: boolean;
};

const SITE_STATUS_URL =
  import.meta.env.PUBLIC_SITE_STATUS_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/site-status';

export async function getPanachaikoSiteStatus(): Promise<PanachaikoSiteStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(SITE_STATUS_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Site status HTTP ${response.status}`);
    const payload = await response.json();
    return { under_construction: payload?.under_construction !== false };
  } catch {
    // Fail closed: if the CMS cannot be reached, keep the public site protected.
    return { under_construction: true };
  } finally {
    clearTimeout(timeout);
  }
}

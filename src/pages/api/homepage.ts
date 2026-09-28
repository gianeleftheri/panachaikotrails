import type { APIRoute } from 'astro';

export const prerender = false;

const HOMEPAGE_ENDPOINT =
  import.meta.env.PANACHAIKO_HOMEPAGE_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/homepage';

const TRAILS_ENDPOINT = 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/trails';
const RECREATION_ENDPOINT = 'https://cms.panachaikotrails.gr/wp-json/wp/v2/recreation_spot?per_page=1&_fields=id';

const request = async (url: string, timeoutMs = 3500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PanachaikoTrails-Homepage/1.1',
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

export const GET: APIRoute = async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
  };

  try {
    const [homeResult, trailsResult, recreationResult] = await Promise.allSettled([
      request(HOMEPAGE_ENDPOINT),
      request(TRAILS_ENDPOINT),
      request(RECREATION_ENDPOINT),
    ]);

    let payload: any = { panels: {} };
    if (homeResult.status === 'fulfilled' && homeResult.value.ok) {
      payload = await homeResult.value.json();
      if (!payload || typeof payload !== 'object') payload = { panels: {} };
    }

    let trailsTotal = 13;
    let shelterTotal = 2;
    if (trailsResult.status === 'fulfilled' && trailsResult.value.ok) {
      const trails = await trailsResult.value.json();
      if (Array.isArray(trails)) {
        trailsTotal = trails.length;
        const shelterIds = new Set<number>();
        trails.forEach((entry: any) => {
          const notes = Array.isArray(entry?.trail?.notes) ? entry.trail.notes : [];
          notes.forEach((poi: any) => {
            if (poi?.category === 'shelter' && Number.isFinite(Number(poi?.id))) {
              shelterIds.add(Number(poi.id));
            }
          });
        });
        if (shelterIds.size) shelterTotal = shelterIds.size;
      }
    }

    let recreationTotal = 6;
    if (recreationResult.status === 'fulfilled' && recreationResult.value.ok) {
      recreationTotal = Number(recreationResult.value.headers.get('x-wp-total') || recreationTotal);
    }

    payload.totals = {
      trails: trailsTotal,
      poi: recreationTotal,
      shelter: shelterTotal,
    };

    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({
      panels: {},
      totals: { trails: 13, poi: 6, shelter: 2 },
    }), { status: 200, headers });
  }
};

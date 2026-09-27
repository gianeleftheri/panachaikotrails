import type { APIRoute } from 'astro';

export const prerender = false;

const ENDPOINT =
  import.meta.env.PANACHAIKO_HOMEPAGE_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/homepage';

export const GET: APIRoute = async () => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
  };

  try {
    const response = await fetch(ENDPOINT, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PanachaikoTrails-Homepage/1.0',
      },
    });
    if (!response.ok) return new Response(JSON.stringify({ panels: {} }), { status: 200, headers });
    return new Response(await response.text(), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ panels: {} }), { status: 200, headers });
  }
};

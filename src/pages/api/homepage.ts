import type { APIRoute } from 'astro';

export const prerender = false;

const ENDPOINT =
  import.meta.env.PANACHAIKO_HOMEPAGE_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/homepage';

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(ENDPOINT, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PanachaikoTrails-Homepage/1.0',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ panels: {} }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120',
        },
      });
    }

    const body = await response.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return new Response(JSON.stringify({ panels: {} }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=60',
      },
    });
  }
};

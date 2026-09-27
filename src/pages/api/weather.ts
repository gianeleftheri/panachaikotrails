import type { APIRoute } from 'astro';

export const prerender = false;

const LAT = '38.228';
const LON = '21.788';
const MET_URL =
  `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(MET_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PanachaikoTrails/1.0 https://panachaikotrails.gr',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'weather_unavailable' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
      });
    }

    const body = await response.text();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=1800',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'weather_unavailable' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  }
};

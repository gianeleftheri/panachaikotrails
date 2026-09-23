import type { APIRoute } from 'astro';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export const GET: APIRoute = async () => {
  const endpoint =
    import.meta.env.CONTACT_WORDPRESS_CONFIG_ENDPOINT ||
    'https://cms.panachaikotrails.gr/wp-json/panachaiko/v1/contact-config/';

  const fetchConfig = async (target: string) => {
    let response = await fetch(target, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PanachaikoTrails-Contact/1.0',
      },
      cache: 'no-store',
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        const redirected = new URL(location, target).toString();
        response = await fetch(redirected, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PanachaikoTrails-Contact/1.0',
          },
          cache: 'no-store',
          redirect: 'manual',
        });
      }
    }

    return response;
  };

  try {
    let response = await fetchConfig(endpoint);
    let result = await response.json().catch(() => ({}));

    if (!response.ok && result?.code === 'rest_no_route') {
      const alternate = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint + '/';
      response = await fetchConfig(alternate);
      result = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      return json({ configured: false, siteKey: '' }, 200);
    }

    return json({
      configured: Boolean(result?.configured && result?.siteKey),
      siteKey: typeof result?.siteKey === 'string' ? result.siteKey : '',
    });
  } catch {
    return json({ configured: false, siteKey: '' }, 200);
  }
};

import type { APIRoute } from 'astro';

export const prerender = false;

const HOMEPAGE_ENDPOINT =
  import.meta.env.PANACHAIKO_HOMEPAGE_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/homepage';

const TRAILS_ENDPOINT = 'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/trails';
const RECREATION_ENDPOINT = 'https://cms.panachaikotrails.gr/wp-json/wp/v2/recreation_spot?per_page=1&_fields=id';
const BLOG_ENDPOINT = 'https://cms.panachaikotrails.gr/wp-json/wp/v2/posts?per_page=5&status=publish&_embed=1&orderby=date&order=desc';

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
    const [homeResult, trailsResult, recreationResult, blogResult] = await Promise.allSettled([
      request(HOMEPAGE_ENDPOINT),
      request(TRAILS_ENDPOINT),
      request(RECREATION_ENDPOINT),
      request(BLOG_ENDPOINT),
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

    const decode = (value: string) => value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#039;|&#39;/gi, "'")
      .replace(/&ndash;|&#8211;/gi, '–')
      .replace(/&mdash;|&#8212;/gi, '—')
      .replace(/\s+/g, ' ')
      .trim();

    let blogItems: any[] = [];
    if (blogResult.status === 'fulfilled' && blogResult.value.ok) {
      const posts = await blogResult.value.json();
      if (Array.isArray(posts)) {
        blogItems = posts.map((post: any) => {
          const media = post?._embedded?.['wp:featuredmedia']?.[0];
          const image =
            media?.media_details?.sizes?.medium_large?.source_url ||
            media?.media_details?.sizes?.medium?.source_url ||
            media?.source_url ||
            null;
          const title = decode(String(post?.title?.rendered || ''));
          const excerptText = decode(String(post?.excerpt?.rendered || post?.content?.rendered || ''));
          const excerpt = excerptText.length > 190 ? excerptText.slice(0, 187).trimEnd() + '…' : excerptText;
          return {
            id: Number(post?.id) || null,
            slug: String(post?.slug || ''),
            title,
            excerpt,
            image,
            date: String(post?.date || ''),
            url: post?.slug ? '/blog/' + encodeURIComponent(String(post.slug)) : null,
          };
        }).filter((item: any) => item.title);
      }
    }

    payload.totals = {
      trails: trailsTotal,
      poi: recreationTotal,
      shelter: shelterTotal,
    };
    payload.blog = { items: blogItems };

    return new Response(JSON.stringify(payload), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({
      panels: {},
      totals: { trails: 13, poi: 6, shelter: 2 },
      blog: { items: [] },
    }), { status: 200, headers });
  }
};

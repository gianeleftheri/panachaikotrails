import type { APIRoute } from 'astro';

export const prerender = false;

const TRAILS_ENDPOINT =
  import.meta.env.PUBLIC_TRAILS_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/trails';
const RECREATION_ENDPOINT =
  import.meta.env.PUBLIC_RECREATION_API_URL ||
  'https://cms.panachaikotrails.gr/?rest_route=/panachaiko/v1/recreation-spots';
const BLOG_ENDPOINT =
  'https://cms.panachaikotrails.gr/wp-json/wp/v2/posts?per_page=50&status=publish&_fields=id,slug,link,title,excerpt,date';

type SearchResult = {
  id: string;
  type: 'trail' | 'poi' | 'shelter' | 'news';
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

const requestJson = async (url: string, timeoutMs = 4000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PanachaikoTrails-Search/1.0',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const decode = (value: unknown) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&#39;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '–')
  .replace(/&mdash;|&#8212;/gi, '—')
  .replace(/\s+/g, ' ')
  .trim();

const normalize = (value: unknown) => decode(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('el-GR');

const scoreMatch = (query: string, title: string, body = '') => {
  const t = normalize(title);
  const b = normalize(body);
  if (t === query) return 120;
  if (t.startsWith(query)) return 100;
  if (t.includes(query)) return 85;
  if (b.includes(query)) return 55;
  return 0;
};

const compact = (value: unknown, max = 120) => {
  const text = decode(value);
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const rawQuery = (url.searchParams.get('q') || '').trim();
  const query = normalize(rawQuery);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120',
  };

  if (query.length < 2) {
    return new Response(JSON.stringify({ query: rawQuery, results: [] }), { status: 200, headers });
  }

  const [trailsResult, recreationResult, blogResult] = await Promise.allSettled([
    requestJson(TRAILS_ENDPOINT),
    requestJson(RECREATION_ENDPOINT),
    requestJson(BLOG_ENDPOINT),
  ]);

  const results: SearchResult[] = [];

  if (trailsResult.status === 'fulfilled' && Array.isArray(trailsResult.value)) {
    for (const entry of trailsResult.value) {
      const code = decode(entry?.key);
      const trail = entry?.trail ?? {};
      const name = decode(trail?.name);
      const description = decode(trail?.description);
      const trailScore = scoreMatch(query, `${code} ${name}`, `${description} ${trail?.difficulty ?? ''}`);
      if (trailScore) {
        const meta = [
          trail?.length_km ? `${Number(trail.length_km).toFixed(1)} χλμ` : '',
          decode(trail?.difficulty),
        ].filter(Boolean).join(' · ');
        results.push({
          id: `trail:${code}`,
          type: 'trail',
          title: code ? `${code} — ${name}` : name,
          subtitle: meta || compact(description) || 'Μονοπάτι',
          href: `/map?trail=${encodeURIComponent(code)}`,
          score: trailScore + 10,
        });
      }

      const poiGroups = [
        ...(Array.isArray(trail?.notes) ? trail.notes : []),
        ...(Array.isArray(trail?.photos) ? trail.photos : []),
        ...(Array.isArray(trail?.videos) ? trail.videos : []),
      ];
      for (const poi of poiGroups) {
        const title = decode(poi?.title) || 'Σημείο ενδιαφέροντος';
        const text = decode(poi?.text);
        const category = decode(poi?.category);
        const poiScore = scoreMatch(query, title, `${text} ${category} ${code} ${name}`);
        if (!poiScore) continue;
        const shelter = category === 'shelter';
        const hasCoords = Number.isFinite(Number(poi?.lat)) && Number.isFinite(Number(poi?.lng));
        const href = hasCoords
          ? `/map?trail=${encodeURIComponent(code)}&lat=${encodeURIComponent(String(poi.lat))}&lng=${encodeURIComponent(String(poi.lng))}&label=${encodeURIComponent(title)}`
          : `/map?trail=${encodeURIComponent(code)}`;
        results.push({
          id: `${shelter ? 'shelter' : 'poi'}:${code}:${poi?.id ?? title}`,
          type: shelter ? 'shelter' : 'poi',
          title,
          subtitle: `${shelter ? 'Καταφύγιο' : 'Σημείο ενδιαφέροντος'} · ${code}${text ? ' · ' + compact(text, 90) : ''}`,
          href,
          score: poiScore + (shelter ? 8 : 0),
        });
      }
    }
  }

  if (recreationResult.status === 'fulfilled' && Array.isArray(recreationResult.value)) {
    for (const spot of recreationResult.value) {
      const title = decode(spot?.title);
      const description = decode(spot?.description);
      const settlement = decode(spot?.settlement);
      const spotScore = scoreMatch(query, title, `${description} ${settlement} ${spot?.type ?? ''}`);
      if (!spotScore) continue;
      const lat = Number(spot?.lat);
      const lng = Number(spot?.lng);
      const href = Number.isFinite(lat) && Number.isFinite(lng)
        ? `/map?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&label=${encodeURIComponent(title)}`
        : '/map';
      results.push({
        id: `recreation:${spot?.id ?? title}`,
        type: 'poi',
        title,
        subtitle: ['Σημείο ενδιαφέροντος', settlement, spot?.elevation_m ? `${spot.elevation_m} μ.` : ''].filter(Boolean).join(' · '),
        href,
        score: spotScore,
      });
    }
  }

  if (blogResult.status === 'fulfilled' && Array.isArray(blogResult.value)) {
    for (const post of blogResult.value) {
      const title = decode(post?.title?.rendered);
      const excerpt = decode(post?.excerpt?.rendered);
      const postScore = scoreMatch(query, title, excerpt);
      if (!postScore) continue;
      results.push({
        id: `news:${post?.id ?? post?.slug ?? title}`,
        type: 'news',
        title,
        subtitle: compact(excerpt) || 'Νέα από το Panachaiko Trails',
        href: typeof post?.link === 'string' && post.link ? post.link : '/',
        score: postScore,
      });
    }
  }

  const unique = new Map<string, SearchResult>();
  for (const item of results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'el'))) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }

  return new Response(JSON.stringify({
    query: rawQuery,
    results: Array.from(unique.values()).slice(0, 30).map(({ score, ...item }) => item),
  }), { status: 200, headers });
};

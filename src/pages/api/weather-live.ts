import type { APIRoute } from 'astro';

export const prerender = false;

type Station = {
  id: 'patra' | 'panachaiko';
  name: string;
  elevation: number;
  temp: number | null;
  feels: number | null;
  humidity: number | null;
  wind: number | null;
  windDir: string | null;
  pressure: number | null;
  rainToday: number | null;
  rainRate: number | null;
  dewPoint: number | null;
  observed: string | null;
  source: string;
  sourceUrl: string;
  status: 'live' | 'stale' | 'unavailable';
};

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=60, s-maxage=180, stale-while-revalidate=1800',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (text: string, pattern: RegExp): number | null => {
  const match = text.match(pattern);
  return match ? num(match[1]) : null;
};

const textFromHtml = (html: string) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&deg;|&#176;/gi, '°')
  .replace(/&ndash;|&#8211;/gi, '–')
  .replace(/&mdash;|&#8212;/gi, '—')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&#39;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();

const fetchText = async (url: string, accept = 'text/html,application/xhtml+xml') => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: accept, 'User-Agent': UA, 'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const empty = (
  id: Station['id'],
  name: string,
  elevation: number,
  source: string,
  sourceUrl: string
): Station => ({
  id, name, elevation,
  temp: null, feels: null, humidity: null, wind: null, windDir: null,
  pressure: null, rainToday: null, rainRate: null, dewPoint: null,
  observed: null, source, sourceUrl, status: 'unavailable',
});

const patraFromJson = async (): Promise<Station | null> => {
  const url = 'https://meteopatras.eu/pwsWD/jsondata/wlcom.json';
  try {
    const raw = await fetchText(url, 'application/json,text/plain,*/*');
    const json = JSON.parse(raw);
    const candidates: Record<string, unknown>[] = [];
    if (json && typeof json === 'object') candidates.push(json as Record<string, unknown>);
    if (Array.isArray(json?.observations)) candidates.push(...json.observations.filter((v: unknown) => v && typeof v === 'object'));
    if (Array.isArray(json?.current_observation)) candidates.push(...json.current_observation.filter((v: unknown) => v && typeof v === 'object'));
    const data = Object.assign({}, ...candidates);

    const temp = num(data.temp_c ?? data.temp_out_c ?? data.temperature_c ?? data.temp);
    const humidity = num(data.relative_humidity ?? data.humidity ?? data.hum_out);
    const pressure = num(data.pressure_mb ?? data.barometer_hpa ?? data.pressure_hpa ?? data.bar_m);
    const davis = data.davis_current_observation && typeof data.davis_current_observation === 'object'
      ? data.davis_current_observation as Record<string, unknown>
      : {};
    const directWind = num(data.wind_kph ?? data.wind_speed_kmh ?? data.wind_speed_kph ?? data.wind_speed);
    const mphWind = num(data.wind_mph);
    const wind = directWind ?? (mphWind == null ? null : mphWind * 1.609344);
    const windDirRaw = data.wind_dir ?? data.wind_cardinal ?? data.wind_direction;
    const directRainToday = num(data.precip_today_metric ?? data.rain_day_mm ?? data.rain_today);
    const rainDayIn = num(davis.rain_day_in);
    const rainToday = directRainToday ?? (rainDayIn == null ? null : rainDayIn * 25.4);
    const directRainRate = num(data.precip_rate_metric ?? data.rain_rate_mm ?? data.rain_rate);
    const rainRateIn = num(davis.rain_rate_in_per_hr);
    const rainRate = directRainRate ?? (rainRateIn == null ? null : rainRateIn * 25.4);
    const feels = num(data.feelslike_c ?? data.heat_index_c ?? data.windchill_c ?? data.feels_like);
    const dewPoint = num(data.dewpoint_c ?? data.dew_point_c ?? data.dewpoint);
    const observedRaw = data.observation_time_rfc822 ?? data.observation_time ?? data.datetime ?? data.generated_at;

    if (temp === null || humidity === null) return null;

    return {
      id: 'patra', name: 'Πάτρα', elevation: 60,
      temp, feels, humidity, wind, windDir: windDirRaw ? String(windDirRaw) : null,
      pressure, rainToday, rainRate, dewPoint,
      observed: observedRaw ? String(observedRaw) : null,
      source: 'MeteoPatras · Davis Vantage Pro 2',
      sourceUrl: 'https://meteopatras.eu/pwsWD/',
      status: 'live',
    };
  } catch {
    return null;
  }
};

const patraFromHtml = async (): Promise<Station> => {
  const sourceUrl = 'https://meteopatras.eu/pwsWD/';
  const base = empty('patra', 'Πάτρα', 60, 'MeteoPatras · Davis Vantage Pro 2', sourceUrl);
  try {
    const html = await fetchText(sourceUrl);
    const text = textFromHtml(html);

    const humidityMatch = text.match(/Σχετ\.?\s*υγρασία\s*([0-9.,]+)\s*%\s*([+-]?[0-9.,]+)\s*°/i);
    const temp = humidityMatch ? num(humidityMatch[2]) : firstNumber(text, /Θερμοκρασία\s*°C[\s\S]{0,180}?([+-]?[0-9.,]+)\s*°/i);
    const humidity = humidityMatch ? num(humidityMatch[1]) : firstNumber(text, /Σχετ\.?\s*υγρασία\s*([0-9.,]+)\s*%/i);
    const feels = firstNumber(text, /(?:Αίσθηση\s*σαν|Δείκτης\s*θερμότητας)\s*([+-]?[0-9.,]+)\s*°/i);
    const dewPoint = firstNumber(text, /Σημείο\s*δρόσου\s*([+-]?[0-9.,]+)\s*°/i);
    const pressure = firstNumber(text, /Τρέχουσα\s*[0-9.,]+\s*inHg\s*([0-9.,]+)(?=\s|Μέγιστη)/i);

    const windMatches = [...text.matchAll(/Άνεμος\s+([0-9.,]+)\s*km\/h/gi)];
    const wind = windMatches.length ? num(windMatches[windMatches.length - 1][1]) : firstNumber(text, /Άνεμος\s*\(Μ\.\)\s*([0-9.,]+)\s*χλμ\/ω/i);
    const windDirMatch = text.match(/Άνεμος\s*\|\s*Ριπή[\s\S]{0,420}?([0-9]{1,3})\s*°\s*([A-ZΑ-ΩΆΈΉΊΌΎΏΪΫ]+)(?=\s)/i);
    const windDir = windDirMatch ? windDirMatch[2] : null;

    const rainBlock = text.match(/Σημερινή\s*βροχόπτωση[\s\S]{0,260}?Εχθές\s*[0-9.,]+\s*([0-9.,]+)\s*Τιμή\/ω\s*([0-9.,]+)/i);
    const rainToday = rainBlock ? num(rainBlock[1]) : null;
    const rainRate = rainBlock ? num(rainBlock[2]) : null;
    const observedMatch = text.match(/Θερμοκρασία\s*°C\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/i);

    if (temp === null || humidity === null) return base;
    return {
      ...base, temp, feels, humidity, wind, windDir, pressure, rainToday, rainRate, dewPoint,
      observed: observedMatch?.[1] ?? null,
      status: 'live',
    };
  } catch {
    return base;
  }
};

const panachaikoFromHtml = async (): Promise<Station> => {
  const sourceUrl = 'https://penteli.meteo.gr/stations/panachaiko/';
  const base = empty('panachaiko', 'Παναχαϊκό', 1588, 'Εθνικό Αστεροσκοπείο Αθηνών', sourceUrl);
  try {
    let html = '';
    let lastError: unknown = null;
    for (const candidate of [
      sourceUrl + '?v=' + Math.floor(Date.now() / 180000),
      'http://penteli.meteo.gr/stations/panachaiko/?v=' + Math.floor(Date.now() / 180000),
    ]) {
      try {
        html = await fetchText(candidate);
        if (html) break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!html) throw lastError ?? new Error('Panachaiko station unavailable');
    const text = textFromHtml(html);

    const observedMatch = text.match(/Latest\s*Values\s*\/\s*Τελευταίες\s*Τιμές\s*([0-9]{1,2}\/\d{1,2}\/\d{4})\s*([0-9]{1,2}:[0-9]{2})/i);
    const windMatch = text.match(/Wind\s*Άνεμος\s*([0-9.,]+)\s*Km\/h\s*at\s*([A-Z-]+)/i);

    const temp = firstNumber(text, /Temperature\s*Θερμοκρασία\s*([+-]?[0-9.,]+)\s*°C/i);
    const humidity = firstNumber(text, /Humidity\s*Υγρασία\s*([0-9.,]+)\s*%/i);
    const dewPoint = firstNumber(text, /Dew\s*Point\s*Σημείο\s*Δρόσου\s*([+-]?[0-9.,]+)\s*°C/i);
    const pressure = firstNumber(text, /Barometer\s*Βαρόμετρο\s*([0-9.,]+)\s*hPa/i);
    const rainToday = firstNumber(text, /Today's\s*Rain\s*Σημερινός\s*Υετός\s*([0-9.,]+)\s*mm/i);
    const rainRate = firstNumber(text, /Rain\s*Rate\s*Ραγδαιότητα\s*([0-9.,]+)\s*mm\/h/i);
    const windChill = firstNumber(text, /Wind\s*Chill\s*Αίσθηση\s*ψύχους\s*([+-]?[0-9.,]+)\s*°C/i);
    const heatIndex = firstNumber(text, /Heat\s*Index\s*Δείκτης\s*δυσφορίας\s*([+-]?[0-9.,]+)\s*°C/i);
    const feels = windChill ?? heatIndex ?? temp;

    if (temp === null || humidity === null) return base;

    let status: Station['status'] = 'live';
    let observed: string | null = null;
    if (observedMatch) {
      observed = `${observedMatch[1]} ${observedMatch[2]}`;
      const [d,m,y] = observedMatch[1].split('/').map(Number);
      const [hh,mm] = observedMatch[2].split(':').map(Number);
      const at = new Date(y, m - 1, d, hh, mm).getTime();
      if (Number.isFinite(at) && Date.now() - at > 90 * 60 * 1000) status = 'stale';
    }

    return {
      ...base, temp, feels, humidity,
      wind: windMatch ? num(windMatch[1]) : null,
      windDir: windMatch?.[2] ?? null,
      pressure, rainToday, rainRate, dewPoint, observed, status,
    };
  } catch {
    return base;
  }
};

export const GET: APIRoute = async () => {
  try {
    const [patraJson, panachaiko] = await Promise.all([
      patraFromJson(),
      panachaikoFromHtml(),
    ]);
    const patra = patraJson ?? await patraFromHtml();

    return new Response(JSON.stringify({
      updated_at: new Date().toISOString(),
      stations: { patra, panachaiko },
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({
      updated_at: new Date().toISOString(),
      stations: {
        patra: empty('patra', 'Πάτρα', 60, 'MeteoPatras · Davis Vantage Pro 2', 'https://meteopatras.eu/pwsWD/'),
        panachaiko: empty('panachaiko', 'Παναχαϊκό', 1588, 'Εθνικό Αστεροσκοπείο Αθηνών', 'https://penteli.meteo.gr/stations/panachaiko/'),
      },
    }), { status: 200, headers });
  }
};

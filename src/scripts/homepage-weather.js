/* =====================================================================
   Ζωντανός καιρός Παναχαϊκού
   1η πηγή : MET Norway (τα δεδομένα του yr.no) — api.met.no
   2η πηγή : Open-Meteo (ίδια μοντέλα με Ventusky: ICON / GFS / ECMWF)
   Ανανέωση: κάθε 10' + όταν ξαναγυρίζεις στην καρτέλα.
   Για την παραγωγή (WordPress): βάλε το metProxy να δείχνει σε δικό σου
   endpoint που κάνει cache και στέλνει User-Agent (όροι χρήσης MET).
   ===================================================================== */
(() => {
  'use strict';

  const CFG = {
    lat: 38.228, lon: 21.788,           // ίδιο σημείο με το link του Ventusky
    placeName: 'Παναχαϊκό',
    refreshMs: 10 * 60 * 1000,
    retryMs: 60 * 1000,
    staleAfterMs: 30 * 60 * 1000,
    timeoutMs: 8000,
    metProxy: '',                       // π.χ. '/wp-json/panachaiko/v1/weather'
    tz: 'Europe/Athens',
  };

  const $ = id => document.getElementById(id);
  const root = $('wx');
  if (!root) return;

  const fmtHour = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CFG.tz });
  const num = (v, d = 0) => (v == null || Number.isNaN(v)) ? '–' : Number(v).toLocaleString('el-GR', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------------- Μετάφραση / κατηγορίες ---------------- */
  // Εσωτερική κατηγορία → { icon, el }
  // MET (yr.no) symbol_code, π.χ. "lightrainshowersandthunder_day"
  function fromMetSymbol(code = '') {
    const isDay = !/_night/.test(code);
    const c = code.replace(/_(day|night|polartwilight)$/, '');
    const map = {
      clearsky: ['clear', 'Αίθριος'], fair: ['fair', 'Κυρίως αίθριος'],
      partlycloudy: ['partly', 'Αραιή συννεφιά'], cloudy: ['cloudy', 'Συννεφιά'], fog: ['fog', 'Ομίχλη'],
    };
    if (map[c]) return { icon: map[c][0], el: map[c][1], isDay };
    const thunder = c.includes('thunder');
    const showers = c.includes('showers');
    const base = c.includes('snow') ? 'snow' : c.includes('sleet') ? 'sleet' : 'rain';
    const lvl = c.startsWith('light') ? 'light' : c.startsWith('heavy') ? 'heavy' : '';
    const words = {
      rain:  { '': showers ? 'Μπόρες' : 'Βροχή', light: showers ? 'Ασθενείς μπόρες' : 'Ασθενής βροχή', heavy: showers ? 'Ισχυρές μπόρες' : 'Ισχυρή βροχή' },
      sleet: { '': 'Χιονόνερο', light: 'Ασθενές χιονόνερο', heavy: 'Έντονο χιονόνερο' },
      snow:  { '': showers ? 'Χιονοπτώσεις κατά διαστήματα' : 'Χιονόπτωση', light: 'Ασθενής χιονόπτωση', heavy: 'Πυκνή χιονόπτωση' },
    };
    let el = words[base][lvl];
    if (thunder) el += ' με καταιγίδα';
    return { icon: thunder ? 'thunder' : base, el, isDay };
  }

  // Open-Meteo: κωδικοί WMO
  function fromWmo(code, isDay = true) {
    const t = {
      0: ['clear', 'Αίθριος'], 1: ['fair', 'Κυρίως αίθριος'], 2: ['partly', 'Αραιή συννεφιά'], 3: ['cloudy', 'Συννεφιά'],
      45: ['fog', 'Ομίχλη'], 48: ['fog', 'Ομίχλη με πάχνη'],
      51: ['rain', 'Ασθενής ψιχάλα'], 53: ['rain', 'Ψιχάλα'], 55: ['rain', 'Πυκνή ψιχάλα'],
      56: ['sleet', 'Παγωμένη ψιχάλα'], 57: ['sleet', 'Πυκνή παγωμένη ψιχάλα'],
      61: ['rain', 'Ασθενής βροχή'], 63: ['rain', 'Βροχή'], 65: ['rain', 'Ισχυρή βροχή'],
      66: ['sleet', 'Παγωμένη βροχή'], 67: ['sleet', 'Ισχυρή παγωμένη βροχή'],
      71: ['snow', 'Ασθενής χιονόπτωση'], 73: ['snow', 'Χιονόπτωση'], 75: ['snow', 'Πυκνή χιονόπτωση'], 77: ['snow', 'Χιονόκοκκοι'],
      80: ['rain', 'Ασθενείς μπόρες'], 81: ['rain', 'Μπόρες'], 82: ['rain', 'Ισχυρές μπόρες'],
      85: ['snow', 'Χιονοπτώσεις κατά διαστήματα'], 86: ['snow', 'Ισχυρές χιονοπτώσεις'],
      95: ['thunder', 'Καταιγίδα'], 96: ['thunder', 'Καταιγίδα με χαλάζι'], 99: ['thunder', 'Ισχυρή καταιγίδα με χαλάζι'],
    }[code] || ['cloudy', 'Συννεφιά'];
    return { icon: t[0], el: t[1], isDay: !!isDay };
  }

  const DIRS = ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'];
  const DIR_NAMES = { 'Β': 'Βοριάς', 'ΒΑ': 'Γρέγος', 'Α': 'Λεβάντες', 'ΝΑ': 'Σιρόκος', 'Ν': 'Όστρια', 'ΝΔ': 'Γαρμπής', 'Δ': 'Πουνέντες', 'ΒΔ': 'Μαΐστρος' };
  const dirOf = deg => deg == null ? '' : DIRS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  const BF = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const beaufort = kmh => { const i = BF.findIndex(x => kmh < x); return i === -1 ? 12 : i; };
  const windChill = (t, kmh) => (t <= 10 && kmh > 4.8) ? 13.12 + 0.6215 * t - 11.37 * kmh ** 0.16 + 0.3965 * t * kmh ** 0.16 : t;

  /* ---------------- Εικονίδια (inline SVG) ---------------- */
  const SUN = '<circle cx="24" cy="24" r="9" fill="#ffc94a"/><g stroke="#ffc94a" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5"/></g>';
  const MOON = '<path d="M30 8a15 15 0 1 0 12 22A12 12 0 0 1 30 8Z" fill="#e8eefc"/>';
  const cloud = (fill = '#e4eef4', y = 0) => `<path transform="translate(0 ${y})" d="M15 40h22a9 9 0 0 0 1-17.9A12 12 0 0 0 15.4 21 9.5 9.5 0 0 0 15 40Z" fill="${fill}"/>`;
  const drops = n => [...Array(n)].map((_, i) => `<path d="M${16 + i * 8} 43l-2 5" stroke="#5fc8ff" stroke-width="2.6" stroke-linecap="round"/>`).join('');
  const flakes = n => [...Array(n)].map((_, i) => `<circle cx="${16 + i * 8}" cy="${45 + (i % 2) * 2}" r="2.1" fill="#fff"/>`).join('');
  function icon(cat, isDay = true) {
    const orb = isDay ? SUN : MOON;
    const small = s => `<g transform="translate(14 -2) scale(.62)">${s}</g>`;
    const body = {
      clear: orb,
      fair: `<g transform="translate(10 -4) scale(.75)">${orb}</g>${cloud('#e4eef4', 6)}`,
      partly: `${small(orb)}${cloud()}`,
      cloudy: `<g transform="translate(6 -6) scale(.8)">${cloud('#9fb4c2')}</g>${cloud()}`,
      fog: `${cloud('#b9c9d3', -6)}<g stroke="#cfdbe3" stroke-width="3" stroke-linecap="round"><path d="M10 40h28M14 46h22"/></g>`,
      rain: `${cloud('#c9d7e0', -4)}${drops(3)}`,
      sleet: `${cloud('#c9d7e0', -4)}<path d="M16 43l-2 5M32 43l-2 5" stroke="#5fc8ff" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="46" r="2.1" fill="#fff"/>`,
      snow: `${cloud('#dbe6ec', -4)}${flakes(3)}`,
      thunder: `${cloud('#8fa3b1', -4)}<path d="M25 34l-6 9h5l-3 7 9-11h-5l3-5Z" fill="#ffd23f"/>`,
    }[cat] || cloud();
    return `<svg viewBox="0 0 48 52" role="img" aria-hidden="true">${body}</svg>`;
  }

  /* ---------------- Λήψη δεδομένων ---------------- */
  async function getJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function fromMet() {
    const url = CFG.metProxy || `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${CFG.lat}&lon=${CFG.lon}`;
    const j = await getJSON(url);
    const ts = j.properties.timeseries;
    const now = Date.now();
    // πρώτη εγγραφή που δεν έχει περάσει πάνω από 1 ώρα
    const start = Math.max(0, ts.findIndex(e => Date.parse(e.time) > now - 3600e3));
    const cur = ts[start];
    const d = cur.data.instant.details;
    const n1 = cur.data.next_1_hours || cur.data.next_6_hours || {};
    const cond = fromMetSymbol(n1.summary?.symbol_code);
    const wind = d.wind_speed * 3.6;
    const precip = n1.details?.precipitation_amount ?? 0;
    const next24 = ts.slice(start, start + 24).map(e => e.data.instant.details.air_temperature);
    const isSnow = cond.icon === 'snow' || cond.icon === 'sleet';
    return {
      source: 'MET Norway / yr.no', sourceUrl: 'https://www.yr.no/el',
      elevation: j.geometry?.coordinates?.[2],
      temp: d.air_temperature, feels: windChill(d.air_temperature, wind),
      humidity: d.relative_humidity, cloud: d.cloud_area_fraction, pressure: d.air_pressure_at_sea_level,
      wind, gust: d.wind_speed_of_gust != null ? d.wind_speed_of_gust * 3.6 : null, windDir: d.wind_from_direction,
      rain: isSnow ? 0 : precip, snow: isSnow ? precip : 0, snowUnit: 'mm', precipProb: null,
      cond, min: Math.min(...next24), max: Math.max(...next24),
      hours: ts.slice(start + 1, start + 7).map(e => {
        const s = e.data.next_1_hours || e.data.next_6_hours || {};
        return { time: fmtHour.format(new Date(e.time)), temp: e.data.instant.details.air_temperature,
                 cond: fromMetSymbol(s.summary?.symbol_code), precip: s.details?.precipitation_amount ?? 0, prob: null };
      }),
      observed: Date.parse(cur.time),
    };
  }

  async function fromOpenMeteo() {
    const p = new URLSearchParams({
      latitude: CFG.lat, longitude: CFG.lon, timezone: CFG.tz, wind_speed_unit: 'kmh', forecast_hours: 25,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      hourly: 'temperature_2m,weather_code,precipitation,precipitation_probability,is_day',
    });
    const j = await getJSON('https://api.open-meteo.com/v1/forecast?' + p);
    const c = j.current, h = j.hourly;
    const temps = h.temperature_2m.slice(0, 24);
    return {
      source: 'Open-Meteo', sourceUrl: 'https://open-meteo.com/',
      elevation: j.elevation,
      temp: c.temperature_2m, feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m, cloud: c.cloud_cover, pressure: c.pressure_msl,
      wind: c.wind_speed_10m, gust: c.wind_gusts_10m, windDir: c.wind_direction_10m,
      rain: (c.rain || 0) + (c.showers || 0), snow: c.snowfall || 0, snowUnit: 'cm',
      precipProb: h.precipitation_probability?.[0] ?? null,
      cond: fromWmo(c.weather_code, c.is_day),
      min: Math.min(...temps), max: Math.max(...temps),
      hours: h.time.slice(1, 7).map((t, i) => ({
        time: t.slice(11, 16), temp: h.temperature_2m[i + 1],
        cond: fromWmo(h.weather_code[i + 1], h.is_day[i + 1]),
        precip: h.precipitation[i + 1], prob: h.precipitation_probability?.[i + 1],
      })),
      observed: Date.now(),
    };
  }

  /* ---------------- Απόδοση ---------------- */
  let data = null, fetchedAt = 0, timer = null, busy = false, failures = 0;

  function render(w) {
    const dir = dirOf(w.windDir), bf = beaufort(w.wind);
    $('wx-elev').textContent = w.elevation ? `· ${num(w.elevation)} μ` : '';
    $('wx-icon').innerHTML = icon(w.cond.icon, w.cond.isDay);
    $('wx-temp').innerHTML = `${num(w.temp)}<sup>°C</sup>`;
    $('wx-cond').textContent = w.cond.el;
    $('wx-sub').innerHTML = `Αισθητή <b>${num(w.feels)}°</b> · Επόμενο 24ωρο <b>↑${num(w.max)}°</b> <b>↓${num(w.min)}°</b>`;

    $('wx-hum').innerHTML = `${num(w.humidity)}<small>%</small>`;
    $('wx-cloud').textContent = w.cloud != null ? `Νέφωση ${num(w.cloud)}%` : '';

    $('wx-wind').innerHTML = `${num(w.wind)}<small>km/h</small>`;
    $('wx-wind-note').textContent = [dir && `${dir} · ${bf} Μπ`, w.gust != null && `ριπές ${num(w.gust)}`].filter(Boolean).join(' · ');
    $('wx-wind-note').title = dir ? `${DIR_NAMES[dir]}, ${bf} Μποφόρ` : '';
    $('wx-wind-box').classList.toggle('is-alert', bf >= 6 || (w.gust ?? 0) >= 60);

    const snowing = w.snow > 0 || ['snow', 'sleet'].includes(w.cond.icon);
    $('wx-prec-label').textContent = snowing ? 'Χιόνι' : 'Βροχή';
    $('wx-prec').innerHTML = snowing ? `${num(w.snow, 1)}<small>${w.snowUnit}</small>` : `${num(w.rain, 1)}<small>mm</small>`;
    $('wx-prec-note').textContent = w.precipProb != null ? `Πιθανότητα ${num(w.precipProb)}%` : 'επόμενη ώρα';
    $('wx-prec-box').classList.toggle('is-alert', snowing || w.rain >= 2);

    $('wx-pres').innerHTML = `${num(w.pressure)}`;

    $('wx-hours').innerHTML = w.hours.map(h => `
      <div class="wx-hour"><time>${h.time}</time>${icon(h.cond.icon, h.cond.isDay)}<b>${num(h.temp)}°</b>
      <span class="wx-p">${h.prob != null && h.prob >= 10 ? h.prob + '%' : h.precip > 0 ? num(h.precip, 1) + ' mm' : ''}</span></div>`).join('');

    // Προειδοποιήσεις για πεζοπόρους
    const warn = [];
    if (w.cond.icon === 'thunder' || w.hours.some(h => h.cond.icon === 'thunder')) warn.push('⚡ Πιθανή καταιγίδα — αποφύγετε τις κορυφογραμμές.');
    if ((w.gust ?? w.wind) >= 60) warn.push('💨 Ισχυροί άνεμοι στα ψηλά.');
    if (w.feels <= 0) warn.push('❄️ Θερμοκρασία κάτω από 0° — πιθανός πάγος στα μονοπάτια.');
    if (snowing) warn.push('🌨️ Χιονόπτωση — απαιτείται χειμερινός εξοπλισμός.');
    $('wx-alert').hidden = !warn.length;
    $('wx-alert').textContent = warn[0] || '';
    $('wx-alert').title = warn.join('\n');

    $('wx-source').innerHTML = `Πηγή: <a href="${w.sourceUrl}" target="_blank" rel="noopener">${w.source}</a> · CC BY 4.0`;
    $('wx-sr').textContent = `Καιρός Παναχαϊκό: ${w.cond.el}, ${num(w.temp)} βαθμοί, υγρασία ${num(w.humidity)}%, άνεμος ${num(w.wind)} χιλιόμετρα ανά ώρα.`;
  }

  function tick() {
    if (!fetchedAt) return;
    const mins = Math.floor((Date.now() - fetchedAt) / 60000);
    $('wx-updated').textContent = mins < 1 ? 'Ζωντανά · μόλις τώρα' : `Ζωντανά · πριν ${mins}′`;
    root.classList.toggle('is-stale', Date.now() - fetchedAt > CFG.staleAfterMs);
  }

  async function load() {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    try {
      let w;
      try { w = await fromMet(); }
      catch (e) { console.info('[wx] MET μη διαθέσιμο, χρήση Open-Meteo:', e.message); w = await fromOpenMeteo(); }
      data = w; fetchedAt = Date.now(); failures = 0;
      render(w);
      root.classList.remove('is-loading', 'is-error');
      root.removeAttribute('aria-busy');
      tick();
      timer = setTimeout(load, CFG.refreshMs);
    } catch (e) {
      failures++;
      console.warn('[wx] αποτυχία λήψης:', e);
      root.classList.add('is-error');
      if (!data) { root.classList.remove('is-loading'); $('wx-cond').textContent = 'Μη διαθέσιμος καιρός'; }
      $('wx-updated').innerHTML = `${data ? 'Παλιά δεδομένα · ' : ''}<button class="wx-retry" type="button">Δοκίμασε ξανά</button>`;
      timer = setTimeout(load, Math.min(CFG.retryMs * failures, CFG.refreshMs));
    } finally { busy = false; }
  }

  root.addEventListener('click', e => { if (e.target.closest('.wx-retry')) load(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - fetchedAt > CFG.refreshMs) load();
  });
  window.addEventListener('online', load);
  setInterval(() => { if (document.visibilityState === 'visible') tick(); }, 30000);
  const startWeather = () => load();
  const scheduleWeather = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(startWeather, { timeout: 2600 });
    } else {
      setTimeout(startWeather, 1500);
    }
  };
  if (document.readyState === 'complete') {
    scheduleWeather();
  } else {
    window.addEventListener('load', scheduleWeather, { once: true });
  }
})();

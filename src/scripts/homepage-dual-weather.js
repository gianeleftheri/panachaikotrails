(() => {
  'use strict';

  const roots = [...document.querySelectorAll('[data-live-station]')];
  if (!roots.length) return;

  const endpoint = '/api/weather-live';
  const refreshMs = 3 * 60 * 1000;
  let timer = 0;

  const n = (value, digits = 0) => value == null || !Number.isFinite(Number(value))
    ? '–'
    : Number(value).toLocaleString('el-GR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const windName = value => {
    if (!value) return '';
    const map = {
      N:'Β', NNE:'ΒΒΑ', NE:'ΒΑ', ENE:'ΑΒΑ', E:'Α', ESE:'ΑΝΑ', SE:'ΝΑ', SSE:'ΝΝΑ',
      S:'Ν', SSW:'ΝΝΔ', SW:'ΝΔ', WSW:'ΔΝΔ', W:'Δ', WNW:'ΔΒΔ', NW:'ΒΔ', NNW:'ΒΒΔ'
    };
    return map[value] || value;
  };

  const icon = station => {
    const rain = Number(station.rainRate || 0);
    const wind = Number(station.wind || 0);
    if (rain > 0) return '<svg viewBox="0 0 48 52" aria-hidden="true"><path d="M15 36h22a9 9 0 0 0 1-17.9A12 12 0 0 0 15.4 17 9.5 9.5 0 0 0 15 36Z" fill="#d7e8ef"/><path d="M16 42l-2 5M24 42l-2 5M32 42l-2 5" stroke="#65d3ff" stroke-width="2.6" stroke-linecap="round"/></svg>';
    if (wind >= 45) return '<svg viewBox="0 0 48 52" aria-hidden="true"><g fill="none" stroke="#e9f8fa" stroke-width="3" stroke-linecap="round"><path d="M7 18h22c9 0 10-11 2-11-4 0-6 3-6 6"/><path d="M8 27h30c8 0 8 10 1 10-4 0-5-3-5-5"/><path d="M8 36h17"/></g></svg>';
    return '<svg viewBox="0 0 48 52" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="#ffd25a"/><g stroke="#ffd25a" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5"/></g></svg>';
  };

  const render = (root, station) => {
    if (!station) return;
    const q = sel => root.querySelector(sel);
    const available = station.status !== 'unavailable' && station.temp != null;

    root.classList.toggle('is-unavailable', !available);
    root.classList.toggle('is-stale', station.status === 'stale');
    q('[data-station-name]').textContent = station.name;
    q('[data-station-elev]').textContent = '· ' + n(station.elevation) + ' μ.';
    q('[data-station-icon]').innerHTML = icon(station);
    q('[data-station-temp]').innerHTML = available ? n(station.temp, 1) + '<sup>°C</sup>' : '–<sup>°C</sup>';
    q('[data-station-feels]').textContent = station.feels != null ? 'Αίσθηση ' + n(station.feels, 1) + '°' : 'Live μέτρηση';
    q('[data-station-hum]').innerHTML = station.humidity != null ? n(station.humidity) + '<small>%</small>' : '–';
    q('[data-station-wind]').innerHTML = station.wind != null ? n(station.wind, 1) + '<small>km/h</small>' : '–';
    q('[data-station-wind-dir]').textContent = windName(station.windDir);
    q('[data-station-rain]').innerHTML = station.rainToday != null ? n(station.rainToday, 1) + '<small>mm</small>' : '–';
    q('[data-station-pressure]').innerHTML = station.pressure != null ? n(station.pressure, 1) + '<small>hPa</small>' : '–';

    const status = q('[data-station-status]');
    status.textContent = !available
      ? 'Μη διαθέσιμο'
      : station.status === 'stale'
        ? 'Παλαιότερη μέτρηση'
        : 'Ζωντανά';
    status.dataset.state = station.status;

    const observed = q('[data-station-observed]');
    observed.textContent = station.observed ? 'Ενημέρωση: ' + station.observed : '';

    const source = q('[data-station-source]');
    source.href = station.sourceUrl;
    source.textContent = station.source;
  };

  async function load() {
    clearTimeout(timer);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      roots.forEach(root => {
        const id = root.dataset.liveStation;
        render(root, payload?.stations?.[id]);
      });
    } catch (error) {
      console.warn('[dual-weather] weather stations unavailable', error);
      roots.forEach(root => {
        const status = root.querySelector('[data-station-status]');
        if (status) status.textContent = 'Προσωρινά μη διαθέσιμο';
        root.classList.add('is-unavailable');
      });
    } finally {
      timer = window.setTimeout(load, refreshMs);
    }
  }

  const start = () => load();
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load();
  });
})();

(() => {
  'use strict';
  const endpoint = '/api/homepage';
  const ids = ['home','trails','poi','shelter','photos','video'];
  let cachedPanels = {};

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate = value => {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Intl.DateTimeFormat('el-GR', { day:'2-digit', month:'short', year:'numeric' }).format(date);
  };

  const renderHomeNews = blog => {
    const host = document.getElementById('homeNewsBody');
    if (!host) return;
    const item = Array.isArray(blog?.items) ? blog.items[0] : null;
    if (!item) return;

    const image = item.image
      ? '<img class="home-news-image" src="' + esc(item.image) + '" alt="" loading="lazy" decoding="async">'
      : '<span class="home-news-image" aria-hidden="true"></span>';
    const date = item.date ? '<span class="home-news-date">' + esc(formatDate(item.date)) + '</span>' : '';
    const excerpt = item.excerpt ? '<p class="home-news-excerpt">' + esc(item.excerpt) + '</p>' : '';
    const body = image +
      '<div class="home-news-copy">' +
        date +
        '<h4 class="home-news-title">' + esc(item.title) + '</h4>' +
        excerpt +
        '<span class="home-news-read">Διαβάστε το άρθρο <b aria-hidden="true">→</b></span>' +
      '</div>';

    host.innerHTML = item.url
      ? '<a class="home-news-card" href="' + esc(item.url) + '">' + body + '</a>'
      : '<div class="home-news-card">' + body + '</div>';
  };


  const renderFeed = (id, panel) => {
    const host = document.getElementById('feed-' + id);
    if (!host || !panel || !Array.isArray(panel.items)) return;
    host.innerHTML = panel.items.map(item => {
      const imageUrl = item.image ? String(item.image) : '';
      const isYoutubeThumb = /(^|\.)i\.ytimg\.com$/i.test((() => {
        try { return new URL(imageUrl).hostname; } catch { return ''; }
      })());
      const media = isYoutubeThumb
        ? '<span class="panel-feed-thumb panel-feed-video-thumb" aria-hidden="true">▶</span>'
        : imageUrl
          ? '<img class="panel-feed-thumb" src="' + esc(imageUrl) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
          : '';
      const cls = media ? 'panel-feed-item' : 'panel-feed-item no-thumb';
      const meta = item.meta ? '<span class="panel-feed-meta">' + esc(item.meta) + '</span>' : '';
      return '<div class="' + cls + '">' + media + '<div><div class="panel-feed-title">' + esc(item.title) + '</div>' + meta + '</div></div>';
    }).join('');
  };

  const loadHomepageData = () => fetch(endpoint, { headers:{Accept:'application/json'}, cache:'default' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => {
      const panels = data && data.panels ? data.panels : {};
      cachedPanels = panels;
      renderHomeNews(data && data.blog ? data.blog : { items: [] });
      const totals = data && data.totals ? data.totals : {};
      ['trails','poi','shelter'].forEach(id => {
        const count = totals?.[id];
        if (Number.isFinite(Number(count))) {
          document.querySelectorAll('[data-panel-count="' + id + '"]').forEach(node => {
            node.textContent = String(Number(count));
          });
        }
      });
      ids.forEach(id => {
        const panel = panels[id];
        const el = document.querySelector('.acc-panel[data-panel="' + id + '"]');
        if (el && panel && panel.background_image) {
          let bg = String(panel.background_image);
          if (bg.includes('images.unsplash.com/')) {
            bg = bg.replace(/([?&])w=(?:1800|1440)(?=&|$)/, '$1w=1024').replace(/([?&])q=(?:90|78)(?=&|$)/, '$1q=72');
          }
          el.dataset.bg = bg;
          if (id !== 'home') {
            const preview = bg.includes('images.unsplash.com/')
              ? bg.replace(/([?&])w=(?:1800|1440|1024)(?=&|$)/, '$1w=360').replace(/([?&])q=(?:90|78|72)(?=&|$)/, '$1q=48')
              : bg;
            el.dataset.bgPreview = preview;
            if (!el.classList.contains('is-active') && el.dataset.bgLoaded !== preview) {
              el.style.setProperty('--panel-bg', 'url("' + preview.replace(/"/g, '%22') + '")');
              el.dataset.bgLoaded = preview;
            }
          }

          const isLegacyHomeDefault = id === 'home' && bg.includes('photo-1551632811-561732d1e306');
          const isDefaultHome = id === 'home' && (el.dataset.defaultBg === bg || isLegacyHomeDefault);
          if (id === 'home') el.classList.toggle('has-cms-bg', !isDefaultHome);

          if (isDefaultHome) {
            el.style.removeProperty('--panel-bg');
            el.dataset.bgLoaded = bg;
          } else if (el.classList.contains('is-active') && el.dataset.bgLoaded !== bg) {
            el.style.setProperty('--panel-bg', 'url("' + bg.replace(/"/g, '%22') + '")');
            el.dataset.bgLoaded = bg;
          }
        }
        if (el && el.classList.contains('is-active')) renderFeed(id, panel);
      });
    })
    .catch(() => {
      // Keep the static fallback photos/text if the CMS endpoint is unavailable.
    });

  window.addEventListener('panachaiko:panel', event => {
    const id = event?.detail?.id;
    if (id && cachedPanels[id]) renderFeed(id, cachedPanels[id]);
  });

  const scheduleHomepageData = () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadHomepageData, { timeout: 2200 });
    } else {
      setTimeout(loadHomepageData, 1200);
    }
  };
  if (document.readyState === 'complete') {
    scheduleHomepageData();
  } else {
    window.addEventListener('load', scheduleHomepageData, { once: true });
  }
})();

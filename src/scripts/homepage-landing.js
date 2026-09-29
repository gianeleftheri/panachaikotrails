(() => {
  'use strict';

  const endpoint = '/api/homepage';
  const panelIds = ['trails','poi','shelter','photos','video'];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const formatDate = value => {
    if (!value) return '';
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('el-GR', { day:'2-digit', month:'short', year:'numeric' }).format(d);
  };

  const renderNews = blog => {
    const host = document.getElementById('newsPanelBody');
    if (!host) return;
    const items = Array.isArray(blog?.items) ? blog.items.slice(0, 6) : [];
    if (!items.length) {
      host.innerHTML = '<div class="empty-card">Δεν υπάρχουν διαθέσιμα νέα αυτή τη στιγμή.</div>';
      return;
    }

    host.innerHTML = items.map(item => {
      const image = item.image
        ? '<img class="home-news-image" src="' + esc(item.image) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="home-news-image" aria-hidden="true"></span>';
      const date = item.date ? '<span class="home-news-date">' + esc(formatDate(item.date)) + '</span>' : '';
      const excerpt = item.excerpt ? '<p class="home-news-excerpt">' + esc(item.excerpt) + '</p>' : '';
      const body = image + '<div class="home-news-copy">' + date +
        '<h3 class="home-news-title">' + esc(item.title) + '</h3>' +
        excerpt + '<span class="home-news-read">Διαβάστε →</span></div>';
      return item.url
        ? '<a class="home-news-card" href="' + esc(item.url) + '">' + body + '</a>'
        : '<div class="home-news-card">' + body + '</div>';
    }).join('');
  };

  const renderFeed = (id, panel) => {
    const host = document.getElementById('feed-' + id);
    if (!host) return;
    const items = Array.isArray(panel?.items) ? panel.items.slice(0, 9) : [];
    if (!items.length) {
      host.innerHTML = '<div class="empty-card">Δεν υπάρχει διαθέσιμο περιεχόμενο αυτή τη στιγμή.</div>';
      return;
    }

    host.innerHTML = items.map(item => {
      const imageUrl = item.image ? String(item.image) : '';
      const media = imageUrl
        ? '<img class="landing-feed-thumb" src="' + esc(imageUrl) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
        : (id === 'video' ? '<span class="landing-feed-thumb landing-feed-video-thumb" aria-hidden="true">▶</span>' : '');
      const cls = media ? 'landing-feed-item' : 'landing-feed-item no-thumb';
      const meta = item.meta ? '<span class="landing-feed-meta">' + esc(item.meta) + '</span>' : '';
      const copy = '<div><h3 class="landing-feed-title">' + esc(item.title) + '</h3>' + meta + '</div>';
      return '<div class="' + cls + '">' + media + copy + '</div>';
    }).join('');
  };

  const load = async () => {
    try {
      const response = await fetch(endpoint, { headers:{Accept:'application/json'}, cache:'default' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const panels = data?.panels || {};
      renderNews(data?.blog || {items:[]});
      panelIds.forEach(id => renderFeed(id, panels[id]));
    } catch (error) {
      console.warn('[landing-homepage] homepage data unavailable', error);
    }
  };

  const navLinks = [...document.querySelectorAll('[data-nav]')];
  const sections = [...document.querySelectorAll('[data-section]')];
  if ('IntersectionObserver' in window && navLinks.length && sections.length) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      navLinks.forEach(link => link.classList.toggle('is-active', link.dataset.nav === id));
    }, { rootMargin:'-22% 0px -58% 0px', threshold:[0,.15,.35,.55] });
    sections.forEach(section => observer.observe(section));
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout:1800 });
  } else {
    setTimeout(load, 700);
  }
})();
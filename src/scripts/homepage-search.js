(() => {
  'use strict';

  const button = document.getElementById('siteSearchButton');
  const overlay = document.getElementById('siteSearchOverlay');
  const dialog = document.getElementById('siteSearchDialog');
  const input = document.getElementById('siteSearchInput');
  const closeButton = document.getElementById('siteSearchClose');
  const status = document.getElementById('siteSearchStatus');
  const results = document.getElementById('siteSearchResults');

  if (!button || !overlay || !dialog || !input || !closeButton || !status || !results) return;

  let timer = 0;
  let controller = null;
  let lastFocused = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const labels = {
    trail: 'Μονοπάτι',
    poi: 'Σημείο',
    shelter: 'Καταφύγιο',
    news: 'Νέα'
  };

  const icons = {
    trail: '↗',
    poi: '●',
    shelter: '⌂',
    news: 'N'
  };

  const open = () => {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('search-open');
    button.setAttribute('aria-expanded', 'true');
    window.requestAnimationFrame(() => input.focus());
  };

  const close = () => {
    controller?.abort();
    controller = null;
    window.clearTimeout(timer);
    overlay.hidden = true;
    document.body.classList.remove('search-open');
    button.setAttribute('aria-expanded', 'false');
    if (lastFocused instanceof HTMLElement) lastFocused.focus({ preventScroll: true });
  };

  const renderResults = items => {
    if (!items.length) {
      results.innerHTML = '<div class="site-search-empty">Δεν βρέθηκαν αποτελέσματα.</div>';
      return;
    }

    results.innerHTML = items.map(item => {
      const type = ['trail','poi','shelter','news'].includes(item.type) ? item.type : 'poi';
      const external = /^https?:\/\//i.test(item.href || '');
      return '<a class="site-search-result" href="' + esc(item.href || '#') + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' +
        '<span class="site-search-result-icon type-' + type + '" aria-hidden="true">' + esc(icons[type]) + '</span>' +
        '<span class="site-search-result-copy">' +
          '<span class="site-search-result-type">' + esc(labels[type]) + '</span>' +
          '<strong>' + esc(item.title) + '</strong>' +
          '<small>' + esc(item.subtitle || '') + '</small>' +
        '</span>' +
        '<span class="site-search-result-arrow" aria-hidden="true">→</span>' +
      '</a>';
    }).join('');
  };

  const run = async query => {
    const q = query.trim();
    if (q.length < 2) {
      status.textContent = 'Γράψε τουλάχιστον 2 χαρακτήρες.';
      results.innerHTML = '';
      return;
    }

    controller?.abort();
    controller = new AbortController();
    status.textContent = 'Αναζήτηση…';
    results.innerHTML = '<div class="site-search-loading">Ψάχνω σε μονοπάτια, σημεία, καταφύγια και νέα…</div>';

    try {
      const response = await fetch('/api/search?q=' + encodeURIComponent(q), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const payload = await response.json();
      const items = Array.isArray(payload?.results) ? payload.results : [];
      status.textContent = items.length
        ? items.length + (items.length === 1 ? ' αποτέλεσμα' : ' αποτελέσματα')
        : 'Δεν βρέθηκαν αποτελέσματα.';
      renderResults(items);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      status.textContent = 'Η αναζήτηση δεν είναι διαθέσιμη αυτή τη στιγμή.';
      results.innerHTML = '<div class="site-search-empty">Δοκίμασε ξανά σε λίγο.</div>';
    }
  };

  button.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run(input.value), 220);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      window.clearTimeout(timer);
      run(input.value);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === '/' && overlay.hidden && !event.altKey && !event.ctrlKey && !event.metaKey && !event.target.closest('input,textarea,select,[contenteditable]')) {
      event.preventDefault();
      open();
    }
  });
})();

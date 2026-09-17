const body = document.body;
const hud = document.getElementById('navigationHud');
const overlay = document.getElementById('view3dOverlay');
const navBack = document.getElementById('navBackBtn') as HTMLButtonElement | null;
const nav2d = document.getElementById('nav2dBtn');
const nav3d = document.getElementById('nav3dBtn');
const overlayClose = document.getElementById('view3dClose') as HTMLButtonElement | null;

const style = document.createElement('style');
style.textContent = `
  body.navigation-active #navigationHud{z-index:4300!important;display:block!important}
  body.navigation-active #navBackBtn{width:auto!important;min-width:94px!important;padding:0 12px!important;border-radius:18px!important;font-size:11px!important;white-space:nowrap}
  body.navigation-active #view3dClose{display:none!important}
  body.navigation-active #view3dOverlay.open .view3d-topbar{pointer-events:none}
  body.navigation-active #view3dOverlay.open .view3d-title{opacity:.72}
`;
document.head.append(style);

const setModeButtons = (mode: '2d' | '3d') => {
  nav2d?.classList.toggle('active', mode === '2d');
  nav3d?.classList.toggle('active', mode === '3d');
};

const syncShell = () => {
  const active = body.classList.contains('navigation-active');
  if (navBack) {
    navBack.textContent = active ? '✕ Κλείσιμο' : '←';
    navBack.setAttribute('aria-label', active ? 'Κλείσιμο πλοήγησης και επιστροφή στην επιλογή διαδρομής' : 'Επιστροφή στην επιλογή διαδρομής');
    navBack.title = active ? 'Κλείσιμο πλοήγησης' : 'Επιστροφή';
  }
  if (active) {
    hud?.classList.add('open');
    setModeButtons(overlay?.classList.contains('open') ? '3d' : '2d');
  }
};

nav2d?.addEventListener('click', () => setModeButtons('2d'));
nav3d?.addEventListener('click', () => setModeButtons('3d'));
overlayClose?.addEventListener('click', () => setModeButtons('2d'));

document.addEventListener('panachaiko:navigation-start', () => window.setTimeout(syncShell, 0));
document.addEventListener('panachaiko:navigation-exit', () => window.setTimeout(syncShell, 0));

new MutationObserver(syncShell).observe(body, { attributes: true, attributeFilter: ['class'] });
if (overlay) new MutationObserver(syncShell).observe(overlay, { attributes: true, attributeFilter: ['class'] });

syncShell();

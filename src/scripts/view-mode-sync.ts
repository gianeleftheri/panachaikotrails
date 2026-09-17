const overlay = document.getElementById('view3dOverlay');
const btn2d = document.getElementById('nav2dBtn');
const btn3d = document.getElementById('nav3dBtn');

const setMode = (mode: '2d' | '3d') => {
  btn2d?.classList.toggle('active', mode === '2d');
  btn3d?.classList.toggle('active', mode === '3d');
};

btn2d?.addEventListener('click', () => setMode('2d'));
btn3d?.addEventListener('click', () => setMode('3d'));
document.getElementById('view3dBtn')?.addEventListener('click', () => setMode('3d'));
document.getElementById('view3dClose')?.addEventListener('click', () => setMode('2d'));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && overlay?.classList.contains('open')) setMode('2d');
});

if (overlay) {
  new MutationObserver(() => {
    setMode(overlay.classList.contains('open') ? '3d' : '2d');
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
}

setMode(overlay?.classList.contains('open') ? '3d' : '2d');

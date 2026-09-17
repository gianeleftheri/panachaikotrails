import L from 'leaflet';

const runtime = window as typeof window & {
  __panachaikoMap?: L.Map;
  __panachaikoMapCaptureInstalled?: boolean;
};

if (!runtime.__panachaikoMapCaptureInstalled) {
  runtime.__panachaikoMapCaptureInstalled = true;
  const originalMap = L.map.bind(L);

  L.map = ((...args: Parameters<typeof L.map>) => {
    const instance = originalMap(...args);
    runtime.__panachaikoMap = instance;
    return instance;
  }) as typeof L.map;
}

export type GeoPoint = [lat: number, lng: number];
export const REVIEW_CENTER: GeoPoint = [38.19612, 21.87071];
export const REVIEW_RADII_KM = [12, 15, 18] as const;
export const REVIEW_BUFFER_M = 1000;
// Existing verified summit endpoint of Π-9 / Π-12 in trail-navigation.ts.
// This is an application reference point, not a surveyed administrative boundary.
export const REVIEW_LANDMARKS = [
  { name: 'Δρέπανο (οικισμός)', point: [38.32143, 21.85251] as GeoPoint },
  { name: 'Ακρωτήρι Δρεπάνου', point: [38.33920, 21.84933] as GeoPoint }
];

export const validPoint = (point: GeoPoint) => Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;
export const distanceKm = (a: GeoPoint, b: GeoPoint) => {
  const rad = Math.PI / 180;
  const lat = (b[0] - a[0]) * rad, lng = (b[1] - a[1]) * rad;
  const value = Math.sin(lat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
};

type XY = [number, number];
const metersPerDegree = 6371000 * Math.PI / 180;
const xScale = metersPerDegree * Math.cos(REVIEW_CENTER[0] * Math.PI / 180);
const project = (point: GeoPoint): XY => [(point[1] - REVIEW_CENTER[1]) * xScale, (point[0] - REVIEW_CENTER[0]) * metersPerDegree];
const unproject = (point: XY): GeoPoint => [REVIEW_CENTER[0] + point[1] / metersPerDegree, REVIEW_CENTER[1] + point[0] / xScale];
const cross = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// Preliminary outer envelope around the loaded network, expanded by 1 km.
// It includes spaces between trails; it must not be labelled as the mountain/Natura boundary.
export const networkEnvelope = (points: GeoPoint[], bufferM = REVIEW_BUFFER_M): GeoPoint[] => {
  if (!Number.isFinite(bufferM) || bufferM < 0) throw new Error('Invalid boundary buffer.');
  const unique = new Map<string, XY>();
  points.filter(validPoint).forEach(point => unique.set(point.join(','), project(point)));
  const sorted = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return [];
  const chain = (items: XY[]) => {
    const result: XY[] = [];
    items.forEach(point => {
      while (result.length >= 2 && cross(result[result.length - 2], result.at(-1)!, point) <= 0) result.pop();
      result.push(point);
    });
    return result;
  };
  const hull = [...chain(sorted).slice(0, -1), ...chain([...sorted].reverse()).slice(0, -1)];
  if (hull.length < 3) return [];
  if (bufferM === 0) return hull.map(unproject);
  const edges = hull.map((a, index) => {
    const b = hull[(index + 1) % hull.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    const nx = dy / length, ny = -dx / length;
    return { a: [a[0] + nx * bufferM, a[1] + ny * bufferM] as XY, direction: [dx, dy] as XY };
  });
  return edges.map((current, index) => {
    const previous = edges[(index + edges.length - 1) % edges.length];
    const p = previous.a, r = previous.direction, q = current.a, s = current.direction;
    const denominator = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(denominator) < 1e-8) return unproject(q);
    const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / denominator;
    return unproject([p[0] + t * r[0], p[1] + t * r[1]]);
  });
};

export const insideEnvelope = (point: GeoPoint, polygon: GeoPoint[]) => {
  if (!validPoint(point) || polygon.length < 3) return false;
  const p = project(point);
  const ring = polygon.map(project);
  return ring.every((a, index) => cross(a, ring[(index + 1) % ring.length], p) >= -0.01);
};

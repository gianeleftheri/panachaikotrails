export type RoutePoint = [number, number];
export const OFF_ROUTE_ALERT_INTERVAL_MS = 60_000;
export const MAX_NAVIGATION_ACCURACY_M = 50;

/** Distance to the route line, rather than its sampled vertices. Local metre projection. */
export function routeLineDistance(points: RoutePoint[], current: RoutePoint): number {
  if (!points.length) return Infinity;
  const scale = Math.PI / 180 * 6371000;
  const longitudeScale = scale * Math.cos(current[0] * Math.PI / 180);
  const project = (point: RoutePoint) => [(point[1] - current[1]) * longitudeScale, (point[0] - current[0]) * scale];
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = project(points[i]);
    const b = project(points[Math.min(i + 1, points.length - 1)]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / lengthSquared)) : 0;
    best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return best;
}

export function assessRoutePosition(distance: number, accuracy: number, previousStreak: number, arrived: boolean) {
  const reliable = Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MAX_NAVIGATION_ACCURACY_M;
  const threshold = reliable ? Math.max(20, accuracy * 1.5) : Infinity;
  const streak = reliable && Number.isFinite(distance) && !arrived && distance > threshold ? previousStreak + 1 : 0;
  return { reliable, threshold, streak, offRoute: streak >= 3 };
}

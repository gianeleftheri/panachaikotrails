const shapes = {
  "hike": "<circle cx=\"5\" cy=\"5\" r=\"2\"/><circle cx=\"19\" cy=\"19\" r=\"2\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8\"/>",
  "mountain": "<path d=\"m2 20 8-15 8 15H2Zm12-8 3-5 5 13h-4\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"m7 11 3 2 3-2\"/>",
  "rest": "<path d=\"m3 9 9-6 9 6H3Zm3 0v12m12-12v12\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"M8 15h8m-6 0-2 6m6-6 2 6M8 18h8\"/>",
  "view": "<circle cx=\"6\" cy=\"16\" r=\"4\"/><circle cx=\"18\" cy=\"16\" r=\"4\"/><path d=\"m2.2 14.8 2-9.8h4l1.6 9.8m4.4 0L15.8 5h4l2 9.8\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"M10 13h4m-4 3h4\"/>",
  "shelter": "<path d=\"m2 11 10-8 10 8M5 9v12h14V9\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"M10 21v-7h4v7\"/>",
  "watch": "<path d=\"m5 7 7-4 7 4H5Zm2 0v5h10V7M5 12h14M9 12 6 21m9-9 3 9\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"M8 17h8M12 8v4\"/>",
  "pin": "<path d=\"M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z\"/><circle stroke=\"var(--pt-icon-accent, #007f99)\" cx=\"12\" cy=\"10\" r=\"2.5\"/>",
  "compass": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path stroke=\"var(--pt-icon-accent, #007f99)\" d=\"m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z\"/>"
} as const;

export type TrailIconName = keyof typeof shapes;
export function trailIcon(name: TrailIconName): string {
  return `<svg class="pt-minimal-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]}</svg>`;
}

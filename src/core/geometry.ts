export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** MediaPipe Pose landmark indices (subset). */
export const LM = {
  NOSE: 0,
  MOUTH_L: 9,
  MOUTH_R: 10,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
} as const;

export const vis = (p?: Landmark): number => p?.visibility ?? 0;

/** Angle at point b (degrees, 0..180) formed by a-b-c. */
export function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n < 1e-9) return 180;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n));
  return (Math.acos(cos) * 180) / Math.PI;
}

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Landmarks are normalised to the video frame (x in 0..1 of width, y in 0..1 of height).
 * Angles are only meaningful if both axes use the same scale, so x is multiplied by aspect = w/h.
 */
export function toIsotropic(lm: Landmark[], aspect: number): Landmark[] {
  return lm.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z, visibility: p.visibility }));
}

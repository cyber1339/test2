// Synthetic pose generators for unit tests (no camera needed).
import type { Landmark } from './geometry.ts';
import { LM } from './geometry.ts';

const blank = (): Landmark[] => Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
const set = (lm: Landmark[], i: number, x: number, y: number, v = 0.95) => { lm[i] = { x, y, visibility: v }; };

/** Side view of a pushup. `elbow` = elbow angle; `hipDrop` > 0 sags the hips (body angle < 180). */
export function pushupPose(elbow: number, hipDrop = 0): Landmark[] {
  const lm = blank();
  const S = { x: 0.3, y: 0.5 };
  const E = { x: 0.3, y: 0.6 }; // elbow directly below the shoulder, angle measured at E
  const r = (elbow * Math.PI) / 180;
  set(lm, LM.R_SHOULDER, S.x, S.y);
  set(lm, LM.R_ELBOW, E.x, E.y);
  set(lm, LM.R_WRIST, E.x + 0.1 * Math.sin(r), E.y - 0.1 * Math.cos(r));
  set(lm, LM.R_HIP, 0.5, 0.5 + hipDrop);
  set(lm, LM.R_ANKLE, 0.7, 0.5);
  return lm;
}

/** Front view of a pullup. `chinAbove` puts the mouth above the wrists. */
export function pullupPose(elbow: number, chinAbove: boolean, hipX = 0.5): Landmark[] {
  const lm = blank();
  const r = (elbow * Math.PI) / 180;
  for (const [sh, el, wr, hip, cx] of [
    [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST, LM.L_HIP, 0.4],
    [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST, LM.R_HIP, 0.6],
  ] as const) {
    const E = { x: cx, y: 0.5 };
    set(lm, wr, E.x, E.y - 0.1);
    set(lm, el, E.x, E.y);
    set(lm, sh, E.x + 0.1 * Math.sin(r) * (cx < 0.5 ? -1 : 1), E.y - 0.1 * Math.cos(r));
    set(lm, hip, hipX + (cx < 0.5 ? -0.05 : 0.05), 0.8);
  }
  const wristY = 0.4;
  const mouthY = chinAbove ? wristY - 0.03 : wristY + 0.12;
  set(lm, LM.MOUTH_L, 0.48, mouthY);
  set(lm, LM.MOUTH_R, 0.52, mouthY);
  return lm;
}

/** Elbow-angle profile of one rep sampled at `fps`: top -> bottom (ms) -> hold -> top. */
export function repProfile(opts: { top?: number; bottom: number; downMs?: number; holdMs?: number; upMs?: number; fps?: number }): number[] {
  const { top = 170, bottom, downMs = 800, holdMs = 200, upMs = 800, fps = 30 } = opts;
  const n = (ms: number) => Math.max(1, Math.round((ms / 1000) * fps));
  const out: number[] = [];
  for (let i = 0; i < 10; i++) out.push(top); // settle at the top
  for (let i = 1; i <= n(downMs); i++) out.push(top + ((bottom - top) * i) / n(downMs));
  for (let i = 0; i < n(holdMs); i++) out.push(bottom);
  for (let i = 1; i <= n(upMs); i++) out.push(bottom + ((top - bottom) * i) / n(upMs));
  for (let i = 0; i < 10; i++) out.push(top);
  return out;
}

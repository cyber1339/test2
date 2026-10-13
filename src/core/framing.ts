import type { Exercise } from './types.ts';
import { LM, mean, toIsotropic, vis } from './geometry.ts';
import type { Landmark } from './geometry.ts';

export interface FramingResult {
  ok: boolean;
  confidence: number;
  /** i18n key of the most important instruction. */
  message: string;
}

const REQUIRED: Record<Exercise, number[]> = {
  pushup: [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST, LM.L_HIP, LM.L_ANKLE, LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST, LM.R_HIP, LM.R_ANKLE],
  pullup: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST, LM.L_HIP, LM.R_HIP, LM.NOSE],
};

const inFrame = (p: Landmark) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99;

/** Pre-training check: is the person visible enough and in a plausible start posture? */
export function checkFraming(lm: Landmark[] | null, exercise: Exercise, aspect: number): FramingResult {
  if (!lm || lm.length < 29) return { ok: false, confidence: 0, message: 'cal.noBody' };
  const p = toIsotropic(lm, aspect);
  const ids = REQUIRED[exercise];

  if (exercise === 'pushup') {
    // Side view: one whole side (shoulder..ankle) is enough.
    const sideScore = (side: number[]) => mean(side.map((i) => vis(p[i])));
    const left = [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST, LM.L_HIP, LM.L_ANKLE];
    const right = [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST, LM.R_HIP, LM.R_ANKLE];
    const best = sideScore(left) >= sideScore(right) ? left : right;
    const conf = sideScore(best);
    if (conf < 0.5) {
      const wrist = vis(p[best[2]]) < 0.5;
      const ankle = vis(p[best[4]]) < 0.5;
      return { ok: false, confidence: conf, message: wrist ? 'cal.noWrists' : ankle ? 'cal.moveBack' : 'cal.noBody' };
    }
    if (!best.every((i) => inFrame(lm[i]))) return { ok: false, confidence: conf, message: 'cal.moveBack' };
    const [s, , , , a] = best.map((i) => p[i]);
    const horizontal = Math.abs(s.x - a.x) > Math.abs(s.y - a.y) * 1.2;
    if (!horizontal) return { ok: false, confidence: conf, message: 'cal.getDown' };
    return { ok: true, confidence: conf, message: 'cal.ready' };
  }

  const conf = mean(ids.map((i) => vis(p[i])));
  if (conf < 0.5) return { ok: false, confidence: conf, message: 'cal.noWrists' };
  if (!ids.every((i) => inFrame(lm[i]))) return { ok: false, confidence: conf, message: 'cal.moveBack' };
  const wristY = mean([p[LM.L_WRIST].y, p[LM.R_WRIST].y]);
  const shoulderY = mean([p[LM.L_SHOULDER].y, p[LM.R_SHOULDER].y]);
  if (wristY > shoulderY) return { ok: false, confidence: conf, message: 'cal.grabBar' };
  return { ok: true, confidence: conf, message: 'cal.ready' };
}

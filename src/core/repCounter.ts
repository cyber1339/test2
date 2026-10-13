import type { Exercise } from './types.ts';
import { LM, angle, mean, median, toIsotropic, vis } from './geometry.ts';
import type { Landmark } from './geometry.ts';

/**
 * Rep counting state machine. Pure logic: no DOM, no camera, no React.
 * Time is injected (ms) so everything is deterministic and unit-testable.
 *
 * Pushup:  READY -> DESCENDING -> BOTTOM -> ASCENDING -> COMPLETED
 * Pullup:  READY -> ASCENDING  -> TOP    -> DESCENDING -> COMPLETED
 * LOST means "not tracking": no/low-confidence detection, or not re-armed yet.
 */
export type Phase = 'LOST' | 'READY' | 'DESCENDING' | 'BOTTOM' | 'ASCENDING' | 'TOP' | 'COMPLETED';

export type RejectReason = 'DEPTH' | 'BODY' | 'FAST' | 'CHIN' | 'LOST';
export type Warning = 'BODY' | 'SWING';

export type RepEvent =
  | { type: 'valid'; warnings: Warning[] }
  | { type: 'rejected'; reason: RejectReason };

export interface FrameResult {
  phase: Phase;
  /** 0..1 mean landmark visibility of the landmarks needed by this exercise. */
  confidence: number;
  /** Smoothed elbow angle in degrees, or null if not measurable. */
  elbowAngle: number | null;
  /** i18n key of short feedback, or null. */
  feedback: string | null;
  event?: RepEvent;
}

export interface Tuning {
  /** Elbow angle considered "arms extended". */
  extended: number;
  /** Leaving the extended zone below this angle starts a rep. */
  leave: number;
  /** Elbow angle that must be reached (<=) for the peak of the movement. */
  peak: number;
  /** Peak is released (return phase starts) above this angle. */
  release: number;
  minRepMs: number;
  maxRepMs: number;
  minConfidence: number;
  /** Detection must be missing this long before tracking is declared lost. */
  lostMs: number;
  armFrames: number;
  smoothing: number;
  bodyRejectDeg: number;
  bodyWarnDeg: number;
}

export const DEFAULT_TUNING: Record<Exercise, Tuning> = {
  pushup: {
    extended: 150, leave: 135, peak: 100, release: 115,
    minRepMs: 900, maxRepMs: 30000, minConfidence: 0.5, lostMs: 600,
    armFrames: 5, smoothing: 0.5, bodyRejectDeg: 145, bodyWarnDeg: 160,
  },
  pullup: {
    extended: 150, leave: 135, peak: 90, release: 110,
    minRepMs: 1200, maxRepMs: 30000, minConfidence: 0.5, lostMs: 600,
    armFrames: 5, smoothing: 0.5, bodyRejectDeg: 0, bodyWarnDeg: 0,
  },
};

const PHASES: Record<Exercise, { down: Phase; peak: Phase; up: Phase }> = {
  pushup: { down: 'DESCENDING', peak: 'BOTTOM', up: 'ASCENDING' },
  pullup: { down: 'ASCENDING', peak: 'TOP', up: 'DESCENDING' },
};

interface Measure {
  elbow: number;
  confidence: number;
  body?: number; // shoulder-hip-ankle angle, ~180 = straight
  chinAbove?: boolean; // pullup: chin (mouth) above the wrists
  chinUnknown?: boolean;
  hipX?: number;
  shoulderWidth?: number;
}

const pick = (lm: Landmark[], i: number) => lm[i];

/** Pushup is measured from the side: use the arm/side that is best visible. */
type Measured = { m: Measure | null; confidence: number };

function measurePushup(lm: Landmark[]): Measured {
  const sides = [
    [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST, LM.L_HIP, LM.L_KNEE, LM.L_ANKLE],
    [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST, LM.R_HIP, LM.R_KNEE, LM.R_ANKLE],
  ].map((ids) => ({ ids, conf: mean(ids.slice(0, 4).map((i) => vis(pick(lm, i)))) }));
  const best = sides[0].conf >= sides[1].conf ? sides[0] : sides[1];
  if (best.conf < DEFAULT_TUNING.pushup.minConfidence) return { m: null, confidence: best.conf };
  const [s, e, w, h, k, a] = best.ids.map((i) => pick(lm, i));
  const m: Measure = { elbow: angle(s, e, w), confidence: best.conf };
  if (vis(a) >= 0.4) m.body = angle(s, h, a);
  else if (vis(k) >= 0.4) m.body = angle(s, h, k);
  return { m, confidence: m.confidence };
}

/** Pullup: average both arms when visible. Chin position is approximated by mouth vs. wrists (bar is held at wrist height). */
function measurePullup(lm: Landmark[]): Measured {
  const arms = [
    [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST],
    [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST],
  ]
    .map((ids) => ({ ids, conf: mean(ids.map((i) => vis(pick(lm, i)))) }))
    .filter((a) => a.conf >= DEFAULT_TUNING.pullup.minConfidence);
  if (!arms.length) {
    const c = Math.max(
      mean([LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST].map((i) => vis(pick(lm, i)))),
      mean([LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST].map((i) => vis(pick(lm, i))))
    );
    return { m: null, confidence: c };
  }
  const elbow = mean(arms.map((a) => angle(pick(lm, a.ids[0]), pick(lm, a.ids[1]), pick(lm, a.ids[2]))));
  const wrists = arms.map((a) => pick(lm, a.ids[2]));
  const mouths = [pick(lm, LM.MOUTH_L), pick(lm, LM.MOUTH_R)].filter((p) => vis(p) >= 0.4);
  const m: Measure = { elbow, confidence: mean(arms.map((a) => a.conf)) };
  if (mouths.length) m.chinAbove = mean(mouths.map((p) => p.y)) < mean(wrists.map((p) => p.y));
  else m.chinUnknown = true;
  const hips = [pick(lm, LM.L_HIP), pick(lm, LM.R_HIP)].filter((p) => vis(p) >= 0.4);
  const sh = [pick(lm, LM.L_SHOULDER), pick(lm, LM.R_SHOULDER)];
  if (hips.length && vis(sh[0]) >= 0.4 && vis(sh[1]) >= 0.4) {
    m.hipX = mean(hips.map((p) => p.x));
    m.shoulderWidth = Math.abs(sh[0].x - sh[1].x);
  }
  return { m, confidence: m.confidence };
}

export class RepCounter {
  readonly exercise: Exercise;
  private cfg: Tuning;
  private ph = PHASES.pushup;

  phase: Phase = 'LOST';
  valid = 0;
  rejected = 0;
  paused = false;

  private smooth: number | null = null;
  private armed = 0;
  private lowSince: number | null = null;
  private inRep = false;
  private startT = 0;
  private minAngle = 180;
  private body: number[] = [];
  private hipXs: number[] = [];
  private shoulderW: number[] = [];
  private chinWarned = false;

  constructor(exercise: Exercise, tuning: Partial<Tuning> = {}) {
    this.exercise = exercise;
    this.cfg = { ...DEFAULT_TUNING[exercise], ...tuning };
    this.ph = PHASES[exercise];
  }

  reset(): void {
    this.phase = 'LOST';
    this.valid = 0;
    this.rejected = 0;
    this.softReset();
  }

  private softReset(): void {
    this.smooth = null;
    this.armed = 0;
    this.lowSince = null;
    this.inRep = false;
    this.phase = 'LOST';
  }

  pause(): void {
    this.paused = true;
    this.softReset(); // a half-finished rep never survives a pause
  }

  resume(): void {
    this.paused = false;
    this.softReset(); // user must be seen in the start position again
  }

  private startRep(t: number, s: number): void {
    this.inRep = true;
    this.startT = t;
    this.minAngle = s;
    this.body = [];
    this.hipXs = [];
    this.shoulderW = [];
    this.chinWarned = false;
  }

  private sample(m: Measure): void {
    if (m.body !== undefined) this.body.push(m.body);
    if (m.hipX !== undefined && m.shoulderWidth !== undefined) {
      this.hipXs.push(m.hipX);
      this.shoulderW.push(m.shoulderWidth);
    }
  }

  private abort(): void {
    this.inRep = false;
    this.phase = 'LOST';
    this.armed = 0;
    this.smooth = null;
  }

  /** Feed one video frame. `lm` = 33 pose landmarks or null if no person was detected. */
  update(lm: Landmark[] | null, t: number, aspect = 1): FrameResult {
    if (this.paused) return this.out(0, null, null);

    const raw = lm && lm.length >= 29 ? toIsotropic(lm, aspect) : null;
    const meas = raw ? (this.exercise === 'pushup' ? measurePushup(raw) : measurePullup(raw)) : null;
    const m = meas ? meas.m : null;
    const conf = meas ? meas.confidence : 0;

    // ---- Low confidence: never invent reps
    if (!m) {
      if (this.lowSince === null) this.lowSince = t;
      if (t - this.lowSince > this.cfg.lostMs) {
        const wasInRep = this.inRep;
        if (this.phase !== 'LOST') {
          this.abort();
          if (wasInRep) return this.reject('LOST', conf);
        }
      }
      return this.out(conf, this.smooth, this.phase === 'LOST' ? 'fb.lost' : null);
    }
    this.lowSince = null;

    const a = this.cfg.smoothing;
    const s = this.smooth === null ? m.elbow : a * m.elbow + (1 - a) * this.smooth;
    this.smooth = s;
    const c = this.cfg;

    switch (this.phase) {
      case 'LOST': {
        this.armed = s >= c.extended ? this.armed + 1 : 0;
        if (this.armed >= c.armFrames) this.phase = 'READY';
        return this.out(conf, s, this.phase === 'READY' ? 'fb.ready' : 'fb.getInPosition');
      }
      case 'READY': {
        if (s < c.leave) {
          this.startRep(t, s);
          this.phase = this.ph.down;
          this.sample(m);
        }
        return this.out(conf, s, null);
      }
    }

    // ---- A rep is in progress
    this.sample(m);
    this.minAngle = Math.min(this.minAngle, s);
    if (t - this.startT > c.maxRepMs) {
      this.abort();
      return this.out(conf, s, null);
    }

    if (this.phase === this.ph.down) {
      const chinOk = this.exercise === 'pushup' || m.chinAbove === true;
      if (s <= c.peak && chinOk) {
        this.phase = this.ph.peak;
      } else if (s <= c.peak && m.chinUnknown && !this.chinWarned) {
        this.chinWarned = true;
        return this.out(conf, s, 'fb.chinUnknown');
      } else if (s >= c.extended) {
        // Back at the top without reaching the peak.
        this.inRep = false;
        this.phase = 'READY';
        if (this.minAngle < c.extended - 30) return this.reject('DEPTH', conf);
      }
    } else if (this.phase === this.ph.peak) {
      if (s >= c.release) this.phase = this.ph.up;
    } else if (this.phase === this.ph.up) {
      if (s <= c.peak) this.phase = this.ph.peak; // bounce: still the same rep
      else if (s >= c.extended) return this.complete(t, conf, s);
    }
    return this.out(conf, s, null);
  }

  private complete(t: number, conf: number, s: number): FrameResult {
    const c = this.cfg;
    this.inRep = false;
    this.phase = 'READY';
    const dur = t - this.startT;
    if (dur < c.minRepMs) return this.reject('FAST', conf);

    const warnings: Warning[] = [];
    if (this.exercise === 'pushup' && this.body.length >= 3) {
      const b = median(this.body);
      if (b < c.bodyRejectDeg) return this.reject('BODY', conf);
      if (b < c.bodyWarnDeg) warnings.push('BODY');
    }
    if (this.exercise === 'pullup' && this.hipXs.length >= 3) {
      const w = median(this.shoulderW);
      const range = Math.max(...this.hipXs) - Math.min(...this.hipXs);
      if (w > 0.05 && range / w > 1.2) warnings.push('SWING');
    }
    this.valid += 1;
    return {
      phase: 'COMPLETED',
      confidence: conf,
      elbowAngle: s,
      feedback: warnings.includes('BODY') ? 'fb.validBody' : warnings.includes('SWING') ? 'fb.validSwing' : 'fb.valid',
      event: { type: 'valid', warnings },
    };
  }

  private reject(reason: RejectReason, conf: number): FrameResult {
    this.rejected += 1;
    const key: Record<RejectReason, string> = {
      DEPTH: this.exercise === 'pushup' ? 'fb.deeper' : 'fb.higher',
      BODY: 'fb.straight',
      FAST: 'fb.control',
      CHIN: 'fb.higher',
      LOST: 'fb.abortedLost',
    };
    return { phase: this.phase, confidence: conf, elbowAngle: this.smooth, feedback: key[reason], event: { type: 'rejected', reason } };
  }

  private out(conf: number, s: number | null, fb: string | null): FrameResult {
    return { phase: this.phase, confidence: conf, elbowAngle: s, feedback: fb };
  }
}

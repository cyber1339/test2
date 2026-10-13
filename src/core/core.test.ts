import { describe, expect, it } from 'vitest';
import { RepCounter } from './repCounter.ts';
import type { Landmark } from './geometry.ts';
import { pullupPose, pushupPose, repProfile } from './testPoses.ts';
import { applyRejectedRep, applyValidRep, battleDone, battleHp, newBattle } from './campaign.ts';
import { applySession, levelFromXp, repXp, streak, DAILY_REP_XP_CAP } from './progression.ts';
import { loadState, newState, saveState, STORAGE_KEY } from './storage.ts';
import type { KeyValueStore } from './storage.ts';
import { checkFraming } from './framing.ts';

const FPS = 30;
const dt = 1000 / FPS;

type Gen = (angle: number) => Landmark[] | null;
const push: Gen = (a) => pushupPose(a);
const pull: Gen = (a) => pullupPose(a, a <= 90);

/** Feeds a list of angles; returns reps counted. `t` carries across calls. */
function feed(c: RepCounter, angles: number[], gen: Gen, clock = { t: 0 }) {
  for (const a of angles) {
    c.update(gen(a), clock.t);
    clock.t += dt;
  }
  return clock;
}
const none = (n: number): (number | null)[] => Array(n).fill(null);

describe('pushup counting', () => {
  it('counts one complete pushup exactly once', () => {
    const c = new RepCounter('pushup');
    feed(c, repProfile({ bottom: 70 }), push);
    expect(c.valid).toBe(1);
    expect(c.rejected).toBe(0);
  });

  it('counts N consecutive pushups', () => {
    const c = new RepCounter('pushup');
    const clock = { t: 0 };
    for (let i = 0; i < 5; i++) feed(c, repProfile({ bottom: 75 }), push, clock);
    expect(c.valid).toBe(5);
  });

  it('does not count an incomplete pushup', () => {
    const c = new RepCounter('pushup');
    feed(c, repProfile({ bottom: 120 }), push);
    expect(c.valid).toBe(0);
  });

  it('holding the bottom position does not add reps', () => {
    const c = new RepCounter('pushup');
    feed(c, repProfile({ bottom: 70, holdMs: 6000 }), push);
    expect(c.valid).toBe(1);
  });

  it('rejects a rep that is too fast', () => {
    const c = new RepCounter('pushup');
    feed(c, repProfile({ bottom: 70, downMs: 150, holdMs: 0, upMs: 150 }), push);
    expect(c.valid).toBe(0);
    expect(c.rejected).toBe(1);
  });

  it('rejects a rep with a badly sagging body, tolerates a slight one', () => {
    const bad = new RepCounter('pushup');
    feed(bad, repProfile({ bottom: 70 }), (a) => pushupPose(a, 0.12));
    expect(bad.valid).toBe(0);
    expect(bad.rejected).toBe(1);
    const ok = new RepCounter('pushup');
    feed(ok, repProfile({ bottom: 70 }), (a) => pushupPose(a, 0.015));
    expect(ok.valid).toBe(1);
  });

  it('losing detection mid-rep never creates a rep', () => {
    const c = new RepCounter('pushup');
    const clock = { t: 0 };
    const p = repProfile({ bottom: 70 });
    feed(c, p.slice(0, 25), push, clock); // mid descent
    for (let i = 0; i < 60; i++) { c.update(null, clock.t); clock.t += dt; } // 2 s without a body
    feed(c, p.slice(25), push, clock); // user comes back and rises
    expect(c.valid).toBe(0);
  });

  it('a short detection glitch does not break a good rep', () => {
    const c = new RepCounter('pushup');
    const clock = { t: 0 };
    const p = repProfile({ bottom: 70 });
    feed(c, p.slice(0, 25), push, clock);
    for (let i = 0; i < 5; i++) { c.update(null, clock.t); clock.t += dt; } // ~170 ms
    feed(c, p.slice(25), push, clock);
    expect(c.valid).toBe(1);
  });

  it('reappearing already at the bottom does not count (must re-arm at the top)', () => {
    const c = new RepCounter('pushup');
    const clock = { t: 0 };
    feed(c, [70, 70, 70, 70, 70, 70, 100, 130, 160, 170, 170], push, clock);
    expect(c.valid).toBe(0);
  });

  it('pause generates no reps and requires re-arming', () => {
    const c = new RepCounter('pushup');
    const clock = { t: 0 };
    feed(c, repProfile({ bottom: 70 }).slice(0, 30), push, clock);
    c.pause();
    feed(c, repProfile({ bottom: 70 }), push, clock);
    expect(c.valid).toBe(0);
    c.resume();
    feed(c, repProfile({ bottom: 70 }), push, clock);
    expect(c.valid).toBe(1);
  });

  it('low-visibility landmarks are never counted', () => {
    const c = new RepCounter('pushup');
    const faint: Gen = (a) => pushupPose(a).map((p) => ({ ...p, visibility: 0.2 }));
    feed(c, repProfile({ bottom: 70 }), faint);
    expect(c.valid).toBe(0);
  });
});

describe('pullup counting', () => {
  it('counts one complete pullup exactly once', () => {
    const c = new RepCounter('pullup');
    feed(c, repProfile({ bottom: 60, downMs: 1000, upMs: 1000, holdMs: 300 }), pull);
    expect(c.valid).toBe(1);
  });

  it('does not count a half pullup (elbows bent but chin below the hands)', () => {
    const c = new RepCounter('pullup');
    feed(c, repProfile({ bottom: 60, downMs: 1000, upMs: 1000 }), (a) => pullupPose(a, false));
    expect(c.valid).toBe(0);
  });

  it('does not count a short movement', () => {
    const c = new RepCounter('pullup');
    feed(c, repProfile({ bottom: 125, downMs: 1000, upMs: 1000 }), pull);
    expect(c.valid).toBe(0);
  });
});

describe('framing', () => {
  it('asks to reposition when nobody is visible', () => {
    expect(checkFraming(null, 'pushup', 1).ok).toBe(false);
  });
  it('accepts a visible side-view pushup start position', () => {
    expect(checkFraming(pushupPose(170), 'pushup', 1).ok).toBe(true);
  });
  it('rejects low confidence', () => {
    const faint = pushupPose(170).map((p) => ({ ...p, visibility: 0.2 }));
    expect(checkFraming(faint, 'pushup', 1).ok).toBe(false);
  });
});

describe('battle', () => {
  it('ends exactly when HP reaches zero, with no overkill', () => {
    let b = newBattle([{ exercise: 'pushup', reps: 3 }]);
    b = applyValidRep(b);
    b = applyValidRep(b);
    expect(battleDone(b)).toBe(false);
    b = applyValidRep(b);
    expect(battleHp(b)).toBe(0);
    expect(battleDone(b)).toBe(true);
    b = applyValidRep(b);
    expect(b.steps[0].done).toBe(3);
  });
  it('rejected reps never deal damage', () => {
    let b = newBattle([{ exercise: 'pushup', reps: 2 }]);
    b = applyRejectedRep(b);
    expect(battleHp(b)).toBe(2);
    expect(b.rejected).toBe(1);
  });
  it('boss fights chain phases', () => {
    let b = newBattle([{ exercise: 'pushup', reps: 1 }, { exercise: 'pullup', reps: 1 }]);
    b = applyValidRep(b);
    expect(b.current).toBe(1);
    b = applyValidRep(b);
    expect(battleDone(b)).toBe(true);
  });
});

describe('progression and saving', () => {
  const now = new Date(2026, 9, 13, 18, 0);

  it('abandoning a mission pays only for real reps and does not complete it', () => {
    const s = newState();
    const r = applySession(s, { missionId: 'f1', completed: false, reps: { pushup: 4, pullup: 0 }, rejected: 1, durationSec: 60, notes: [] }, now);
    expect(r.summary.missionXp).toBe(0);
    expect(r.summary.xp).toBe(8);
    expect(r.state.completedMissions['f1']).toBeUndefined();
    expect(r.state.history).toHaveLength(1);
  });

  it('completing a mission grants mission XP and records it', () => {
    const r = applySession(newState(), { missionId: 'f1', completed: true, reps: { pushup: 3, pullup: 0 }, rejected: 0, durationSec: 60, notes: [] }, now);
    expect(r.state.completedMissions['f1']).toBe(1);
    expect(r.summary.missionXp).toBe(40);
    expect(r.state.xp).toBeGreaterThanOrEqual(46);
    expect(r.summary.newAchievements).toContain('first-win');
  });

  it('no XP for invalid reps (rejected reps are not part of reps)', () => {
    const r = applySession(newState(), { missionId: 'f1', completed: false, reps: { pushup: 0, pullup: 0 }, rejected: 9, durationSec: 30, notes: [] }, now);
    expect(r.summary.xp).toBe(0);
  });

  it('daily XP from reps is capped', () => {
    expect(repXp(50, DAILY_REP_XP_CAP - 10)).toBe(20);
    expect(repXp(50, DAILY_REP_XP_CAP)).toBe(0);
  });

  it('levels rise with XP', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(240)).toBe(3);
  });

  it('streak survives a single rest day but breaks after two', () => {
    const s = newState();
    const mk = (day: string) => ({ id: day, day, at: day, missionId: null, completed: false, reps: { pushup: 5, pullup: 0 }, rejected: 0, xp: 0, coins: 0, durationSec: 1, notes: [] });
    const h = [mk('2026-10-09'), mk('2026-10-11'), mk('2026-10-13')];
    expect(streak(h, '2026-10-13')).toBe(3);
    expect(streak([mk('2026-10-09'), mk('2026-10-13')], '2026-10-13')).toBe(1);
    expect(s.history).toHaveLength(0);
  });

  it('progress survives a reload (save then load)', () => {
    const mem = new Map<string, string>();
    const store: KeyValueStore = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
    const r = applySession(newState(), { missionId: 'f1', completed: true, reps: { pushup: 5, pullup: 0 }, rejected: 0, durationSec: 60, notes: [] }, now);
    saveState(store, r.state);
    expect(mem.has(STORAGE_KEY)).toBe(true);
    expect(loadState(store)).toEqual(r.state);
  });

  it('corrupt saves fall back to a fresh state instead of crashing', () => {
    const store: KeyValueStore = { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} };
    expect(loadState(store).xp).toBe(0);
  });
});

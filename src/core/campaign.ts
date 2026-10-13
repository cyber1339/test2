import type { Exercise, Profile } from './types.ts';

export type MonsterId = 'slime' | 'goblin' | 'orc' | 'shade' | 'dragon';

export interface Monster {
  id: MonsterId;
  nameKey: string;
  descKey: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export const MONSTERS: Record<MonsterId, Monster> = {
  slime: { id: 'slime', nameKey: 'monster.slime', descKey: 'monster.slime.d', difficulty: 1 },
  goblin: { id: 'goblin', nameKey: 'monster.goblin', descKey: 'monster.goblin.d', difficulty: 2 },
  orc: { id: 'orc', nameKey: 'monster.orc', descKey: 'monster.orc.d', difficulty: 3 },
  shade: { id: 'shade', nameKey: 'monster.shade', descKey: 'monster.shade.d', difficulty: 4 },
  dragon: { id: 'dragon', nameKey: 'monster.dragon', descKey: 'monster.dragon.d', difficulty: 5 },
};

/** One phase of a fight. reps = round(capacity * frac * dayMultiplier), at least `min`. */
export interface Step {
  exercise: Exercise;
  frac: number;
  min: number;
}

export interface Mission {
  id: string;
  zoneId: string;
  nameKey: string;
  monster: MonsterId;
  kind: 'normal' | 'special' | 'boss';
  difficulty: 1 | 2 | 3 | 4 | 5;
  steps: Step[];
  xp: number;
  /** Title unlocked on first completion. */
  title?: string;
}

export interface Zone {
  id: string;
  nameKey: string;
  minLevel: number;
  rewardKey: string;
}

export const ZONES: Zone[] = [
  { id: 'forest', nameKey: 'zone.forest', minLevel: 1, rewardKey: 'zone.forest.r' },
  { id: 'cave', nameKey: 'zone.cave', minLevel: 3, rewardKey: 'zone.cave.r' },
  { id: 'fortress', nameKey: 'zone.fortress', minLevel: 6, rewardKey: 'zone.fortress.r' },
  { id: 'shadows', nameKey: 'zone.shadows', minLevel: 10, rewardKey: 'zone.shadows.r' },
  { id: 'tower', nameKey: 'zone.tower', minLevel: 15, rewardKey: 'zone.tower.r' },
];

const P = (frac: number, min: number): Step => ({ exercise: 'pushup', frac, min });
const U = (frac: number, min: number): Step => ({ exercise: 'pullup', frac, min });

export const MISSIONS: Mission[] = [
  { id: 'f1', zoneId: 'forest', nameKey: 'm.f1', monster: 'slime', kind: 'normal', difficulty: 1, steps: [P(0.6, 3)], xp: 40 },
  { id: 'f2', zoneId: 'forest', nameKey: 'm.f2', monster: 'goblin', kind: 'special', difficulty: 2, steps: [U(0.5, 1)], xp: 60 },
  { id: 'f3', zoneId: 'forest', nameKey: 'm.f3', monster: 'slime', kind: 'boss', difficulty: 2, steps: [P(0.8, 5)], xp: 100, title: 'title.slimeBane' },
  { id: 'c1', zoneId: 'cave', nameKey: 'm.c1', monster: 'goblin', kind: 'normal', difficulty: 2, steps: [P(0.7, 5)], xp: 70 },
  { id: 'c2', zoneId: 'cave', nameKey: 'm.c2', monster: 'goblin', kind: 'special', difficulty: 3, steps: [U(0.6, 2)], xp: 90 },
  { id: 'c3', zoneId: 'cave', nameKey: 'm.c3', monster: 'goblin', kind: 'boss', difficulty: 3, steps: [P(0.7, 6), U(0.5, 1)], xp: 160, title: 'title.goblinKing' },
  { id: 'r1', zoneId: 'fortress', nameKey: 'm.r1', monster: 'orc', kind: 'normal', difficulty: 3, steps: [P(0.8, 8)], xp: 110 },
  { id: 'r2', zoneId: 'fortress', nameKey: 'm.r2', monster: 'orc', kind: 'special', difficulty: 4, steps: [U(0.7, 2)], xp: 130 },
  { id: 'r3', zoneId: 'fortress', nameKey: 'm.r3', monster: 'orc', kind: 'boss', difficulty: 4, steps: [P(0.8, 10), U(0.6, 2)], xp: 220, title: 'title.orcBreaker' },
  { id: 's1', zoneId: 'shadows', nameKey: 'm.s1', monster: 'shade', kind: 'normal', difficulty: 4, steps: [P(0.85, 10)], xp: 150 },
  { id: 's2', zoneId: 'shadows', nameKey: 'm.s2', monster: 'shade', kind: 'boss', difficulty: 4, steps: [P(0.8, 10), U(0.7, 2)], xp: 260, title: 'title.shadowWalker' },
  { id: 't1', zoneId: 'tower', nameKey: 'm.t1', monster: 'dragon', kind: 'boss', difficulty: 5, steps: [P(0.7, 12), U(0.6, 2), P(0.6, 10)], xp: 400, title: 'title.dragonSlayer' },
];

export const getMission = (id: string) => MISSIONS.find((m) => m.id === id);
export const getZone = (id: string) => ZONES.find((z) => z.id === id)!;

export const MAX_REPS_PER_STEP = 60;

/** Reps for one step, adapted to the user's real capacity. 0 = not available for this user. */
export function stepReps(step: Step, profile: Profile, multiplier = 1): number {
  const cap = profile.capacity[step.exercise];
  if (cap <= 0) return 0;
  const n = Math.round(cap * step.frac * multiplier);
  return Math.min(MAX_REPS_PER_STEP, Math.max(step.min, n));
}

export function missionTargets(m: Mission, profile: Profile, multiplier = 1) {
  return m.steps.map((s) => ({ exercise: s.exercise, reps: stepReps(s, profile, multiplier) }));
}

export const missionHp = (m: Mission, profile: Profile, mult = 1) =>
  missionTargets(m, profile, mult).reduce((a, s) => a + s.reps, 0);

export const isZoneUnlocked = (zoneId: string, level: number) => level >= getZone(zoneId).minLevel;

/** null = available; otherwise the reason key. */
export function missionLock(m: Mission, profile: Profile, level: number): 'locked.level' | 'locked.pullup' | null {
  if (!isZoneUnlocked(m.zoneId, level)) return 'locked.level';
  if (missionTargets(m, profile).some((s) => s.reps === 0)) return 'locked.pullup';
  return null;
}

/** Pure battle model: each validated rep = 1 damage. Ends exactly at HP 0. */
export interface Battle {
  steps: { exercise: Exercise; reps: number; done: number }[];
  current: number;
  rejected: number;
}

export const newBattle = (targets: { exercise: Exercise; reps: number }[]): Battle => ({
  steps: targets.map((t) => ({ ...t, done: 0 })),
  current: 0,
  rejected: 0,
});

export const battleMaxHp = (b: Battle) => b.steps.reduce((a, s) => a + s.reps, 0);
export const battleHp = (b: Battle) => b.steps.reduce((a, s) => a + (s.reps - s.done), 0);
export const battleDone = (b: Battle) => battleHp(b) === 0;

export function applyValidRep(b: Battle): Battle {
  if (battleDone(b)) return b; // no overkill, no extra damage
  const steps = b.steps.map((s, i) => (i === b.current ? { ...s, done: s.done + 1 } : s));
  let current = b.current;
  if (steps[current].done >= steps[current].reps && current < steps.length - 1) current += 1;
  return { ...b, steps, current };
}

export const applyRejectedRep = (b: Battle): Battle => ({ ...b, rejected: b.rejected + 1 });

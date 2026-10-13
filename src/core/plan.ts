import type { GameState } from './types.ts';
import { MISSIONS, missionLock } from './campaign.ts';
import type { Mission } from './campaign.ts';
import { addDays, dayKey, daysBetween } from './dates.ts';
import { levelFromXp, repsOnDay, DAILY_REP_XP_CAP } from './progression.ts';

export type PlanKind = 'rest' | 'light' | 'normal' | 'comeback';
export interface DayPlan {
  kind: PlanKind;
  multiplier: number;
  /** i18n keys */
  reasonKey: string;
  tipKeys: string[];
  mission: Mission | null;
}

export const volumeLastDays = (s: GameState, today: string, n: number): { day: string; reps: number }[] =>
  Array.from({ length: n }, (_, i) => {
    const day = addDays(today, -(n - 1 - i));
    return { day, reps: repsOnDay(s.history, day) };
  });

/** "Today's workout": conservative, never doubles missed days, never pushes through pain. */
export function recommendToday(s: GameState, now: Date): DayPlan {
  const today = dayKey(now);
  const level = levelFromXp(s.xp);
  const feeling = s.feeling && s.feeling.day === today ? s.feeling.value : 'ok';
  const trainedDays = [...new Set(s.history.filter((h) => h.reps.pushup + h.reps.pullup > 0).map((h) => h.day))].sort();
  const last = trainedDays[trainedDays.length - 1];
  const gap = last ? daysBetween(last, today) : 99;
  const vol = volumeLastDays(s, today, 7);
  const yesterday = vol[5].reps;
  const avg = vol.slice(0, 6).reduce((a, b) => a + b.reps, 0) / 6;
  const todayReps = vol[6].reps;

  let kind: PlanKind = 'normal';
  let multiplier = 1;
  let reasonKey = 'plan.normal';
  let maxDiff = 5;
  const tips: string[] = [];

  if (feeling === 'pain') {
    return { kind: 'rest', multiplier: 0, reasonKey: 'plan.pain', tipKeys: ['tip.pain', 'tip.rest'], mission: null };
  }
  if (todayReps >= DAILY_REP_XP_CAP) {
    return { kind: 'rest', multiplier: 0, reasonKey: 'plan.enoughToday', tipKeys: ['tip.rest', 'tip.sleep'], mission: null };
  }
  if (feeling === 'tired' || feeling === 'sore') {
    kind = 'light'; multiplier = 0.7; maxDiff = 2; reasonKey = 'plan.tired';
    tips.push('tip.mobility', 'tip.sleep');
  } else if (gap >= 3 && gap < 99) {
    kind = 'comeback'; multiplier = 0.6; maxDiff = 2; reasonKey = 'plan.comeback';
    tips.push('tip.easyBack');
  } else if (yesterday > 0 && yesterday > avg * 1.3 && yesterday > 20) {
    kind = 'light'; multiplier = 0.7; maxDiff = 3; reasonKey = 'plan.afterHeavy';
    tips.push('tip.mobility');
  } else if (todayReps > 0) {
    kind = 'light'; multiplier = 0.8; maxDiff = 3; reasonKey = 'plan.second';
  } else {
    tips.push('tip.warmup');
  }

  const candidates = MISSIONS.filter(
    (m) => !missionLock(m, s.profile, level) && m.difficulty <= maxDiff && (kind === 'normal' || m.kind !== 'boss')
  );
  // Prefer content the user has not cleared yet, then the least repeated one.
  const sorted = [...candidates].sort(
    (a, b) => (s.completedMissions[a.id] ?? 0) - (s.completedMissions[b.id] ?? 0) || a.difficulty - b.difficulty
  );
  return { kind, multiplier, reasonKey, tipKeys: tips, mission: sorted[0] ?? null };
}

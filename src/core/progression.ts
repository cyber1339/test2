import type { Exercise, GameState, SessionRecord } from './types.ts';
import { getMission } from './campaign.ts';
import { addDays, dayKey, daysBetween, weekStart } from './dates.ts';

export const XP_PER_REP = 2;
/** Valid reps beyond this per day earn no XP, so the game never rewards overtraining. */
export const DAILY_REP_XP_CAP = 120;

export const xpToReach = (level: number): number => {
  let t = 0;
  for (let l = 1; l < level; l++) t += 100 + 40 * (l - 1);
  return t;
};
export const levelFromXp = (xp: number): number => {
  let l = 1;
  while (xp >= xpToReach(l + 1)) l++;
  return l;
};
export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const a = xpToReach(level);
  const b = xpToReach(level + 1);
  return { level, current: xp - a, needed: b - a, pct: (xp - a) / (b - a) };
}
export const repXp = (validReps: number, repsAlreadyToday: number): number =>
  Math.min(validReps, Math.max(0, DAILY_REP_XP_CAP - repsAlreadyToday)) * XP_PER_REP;

export const totalReps = (history: SessionRecord[], ex?: Exercise): number =>
  history.reduce((a, s) => a + (ex ? s.reps[ex] : s.reps.pushup + s.reps.pullup), 0);
export const repsOnDay = (history: SessionRecord[], day: string): number =>
  totalReps(history.filter((s) => s.day === day));
export const completedCount = (s: GameState): number => Object.values(s.completedMissions).reduce((a, b) => a + b, 0);

/**
 * Active-day streak that tolerates rest days: it only breaks after two consecutive
 * days without training (so a recovery day never costs you the streak).
 */
export function streak(history: SessionRecord[], today: string): number {
  const days = [...new Set(history.filter((s) => s.reps.pushup + s.reps.pullup > 0).map((s) => s.day))].sort().reverse();
  if (!days.length || daysBetween(days[0], today) > 2) return 0;
  let n = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i], days[i - 1]) <= 2) n++;
    else break;
  }
  return n;
}

export function sessionsThisWeek(history: SessionRecord[], today: string): number {
  const w = weekStart(today);
  return history.filter((s) => s.day >= w && s.reps.pushup + s.reps.pullup > 0).length;
}

// ---------- Achievements
export interface Achievement {
  id: string;
  nameKey: string;
  descKey: string;
  xp: number;
  coins: number;
  check: (s: GameState, today: string) => boolean;
}
const bossDone = (s: GameState) => Object.keys(s.completedMissions).some((id) => getMission(id)?.kind === 'boss');
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', nameKey: 'ach.first', descKey: 'ach.first.d', xp: 30, coins: 10, check: (s) => completedCount(s) >= 1 },
  { id: 'goblin-hunter', nameKey: 'ach.hunter', descKey: 'ach.hunter.d', xp: 120, coins: 40, check: (s) => completedCount(s) >= 10 },
  { id: 'iron-arms', nameKey: 'ach.arms', descKey: 'ach.arms.d', xp: 80, coins: 30, check: (s) => totalReps(s.history, 'pushup') >= 100 },
  { id: 'pull-path', nameKey: 'ach.pull', descKey: 'ach.pull.d', xp: 60, coins: 20, check: (s) => totalReps(s.history, 'pullup') >= 1 },
  { id: 'consistency', nameKey: 'ach.cons', descKey: 'ach.cons.d', xp: 80, coins: 30, check: (s, d) => sessionsThisWeek(s.history, d) >= 3 },
  { id: 'boss-slayer', nameKey: 'ach.boss', descKey: 'ach.boss.d', xp: 100, coins: 50, check: bossDone },
];

// ---------- Quests (progress is derived from history, so it cannot be faked by opening the app)
export interface Quest {
  key: string; // unique per period, used for claiming
  id: string;
  period: 'daily' | 'weekly';
  nameKey: string;
  progress: number;
  target: number;
  xp: number;
  coins: number;
  claimed: boolean;
}
export function questsFor(s: GameState, today: string): Quest[] {
  const w = weekStart(today);
  const todays = s.history.filter((h) => h.day === today);
  const week = s.history.filter((h) => h.day >= w);
  const mk = (id: string, period: 'daily' | 'weekly', nameKey: string, progress: number, target: number, xp: number, coins: number): Quest => {
    const key = `${period === 'daily' ? today : w}:${id}`;
    return { key, id, period, nameKey, progress: Math.min(progress, target), target, xp, coins, claimed: s.claimedQuests.includes(key) };
  };
  const q: Quest[] = [
    mk('d-mission', 'daily', 'q.dMission', todays.filter((h) => h.completed && h.missionId).length, 1, 20, 5),
    mk('w-sessions', 'weekly', 'q.wSessions', week.filter((h) => h.reps.pushup + h.reps.pullup > 0).length, 3, 60, 20),
    mk('w-pushups', 'weekly', 'q.wPushups', totalReps(week, 'pushup'), Math.max(20, s.profile.capacity.pushup * 4), 60, 20),
  ];
  if (s.profile.capacity.pullup > 0) q.push(mk('w-pullups', 'weekly', 'q.wPullups', totalReps(week, 'pullup'), Math.max(5, s.profile.capacity.pullup * 3), 60, 20));
  return q;
}
export function claimQuest(s: GameState, key: string, today: string): GameState {
  const q = questsFor(s, today).find((x) => x.key === key);
  if (!q || q.claimed || q.progress < q.target) return s;
  return { ...s, xp: s.xp + q.xp, coins: s.coins + q.coins, claimedQuests: [...s.claimedQuests, key] };
}

// ---------- Applying a finished (or abandoned) session
export interface SessionInput {
  missionId: string | null;
  completed: boolean;
  reps: Record<Exercise, number>;
  rejected: number;
  durationSec: number;
  notes: string[];
  comeback?: boolean;
}
export interface SessionSummary {
  xp: number;
  coins: number;
  repXp: number;
  missionXp: number;
  bonusXp: number;
  levelBefore: number;
  levelAfter: number;
  newAchievements: string[];
  firstClear: boolean;
}

export function applySession(state: GameState, input: SessionInput, now: Date): { state: GameState; summary: SessionSummary } {
  const today = dayKey(now);
  const mission = input.missionId ? getMission(input.missionId) : undefined;
  const valid = input.reps.pushup + input.reps.pullup;
  const rXp = repXp(valid, repsOnDay(state.history, today));
  // An abandoned mission gives XP only for real reps: no mission reward.
  const mXp = input.completed && mission ? mission.xp : 0;
  const bonus = input.comeback && valid > 0 ? 25 : 0;
  let xp = rXp + mXp + bonus;
  let coins = Math.floor(xp / 5) + (input.completed && mission?.kind === 'boss' ? 20 : 0);

  const record: SessionRecord = {
    id: `${now.getTime()}`,
    day: today,
    at: now.toISOString(),
    missionId: input.missionId,
    completed: input.completed,
    reps: input.reps,
    rejected: input.rejected,
    xp,
    coins,
    durationSec: input.durationSec,
    notes: input.notes,
  };

  const firstClear = !!(input.completed && mission && !state.completedMissions[mission.id]);
  let next: GameState = {
    ...state,
    xp: state.xp + xp,
    coins: state.coins + coins,
    history: [...state.history, record],
    completedMissions:
      input.completed && mission
        ? { ...state.completedMissions, [mission.id]: (state.completedMissions[mission.id] ?? 0) + 1 }
        : state.completedMissions,
    titles: firstClear && mission?.title && !state.titles.includes(mission.title) ? [...state.titles, mission.title] : state.titles,
  };

  // Capacity grows slowly, only after a clean, completed mission that was near the user's limit.
  if (input.completed && mission && input.rejected <= Math.ceil(valid * 0.25)) {
    const cap = { ...next.profile.capacity };
    for (const st of mission.steps) {
      const done = input.reps[st.exercise];
      if (cap[st.exercise] > 0 && st.frac >= 0.7 && done >= Math.round(cap[st.exercise] * 0.7)) {
        cap[st.exercise] = cap[st.exercise] + 1;
      }
    }
    next = { ...next, profile: { ...next.profile, capacity: cap } };
  }

  const newAch = ACHIEVEMENTS.filter((a) => !next.achievements.includes(a.id) && a.check(next, today));
  for (const a of newAch) {
    next = { ...next, xp: next.xp + a.xp, coins: next.coins + a.coins, achievements: [...next.achievements, a.id] };
    xp += a.xp;
    coins += a.coins;
  }

  return {
    state: next,
    summary: {
      xp, coins, repXp: rXp, missionXp: mXp, bonusXp: bonus,
      levelBefore: levelFromXp(state.xp), levelAfter: levelFromXp(next.xp),
      newAchievements: newAch.map((a) => a.id), firstClear,
    },
  };
}

export { addDays };

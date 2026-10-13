export type Exercise = 'pushup' | 'pullup';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Goal = 'strength' | 'consistency' | 'reps' | 'fitness';
export type Feeling = 'ok' | 'tired' | 'sore' | 'pain';
export type CameraFacing = 'user' | 'environment';

export interface Profile {
  name: string;
  level: Level;
  goal: Goal;
  canPushup: boolean;
  canPullup: boolean;
  /** Comfortable (submaximal) single-set capacity, in validated reps. 0 = cannot do it yet. */
  capacity: Record<Exercise, number>;
  onboarded: boolean;
  lang: 'ro' | 'en';
  camera: CameraFacing;
}

export interface SessionRecord {
  id: string;
  day: string; // local YYYY-MM-DD
  at: string; // ISO timestamp
  missionId: string | null; // null = calibration test
  completed: boolean;
  reps: Record<Exercise, number>; // validated reps only
  rejected: number;
  xp: number;
  coins: number;
  durationSec: number;
  notes: string[]; // technique feedback keys
}

export interface GameState {
  v: 1;
  profile: Profile;
  xp: number;
  coins: number;
  completedMissions: Record<string, number>;
  history: SessionRecord[];
  achievements: string[];
  claimedQuests: string[];
  titles: string[];
  owned: string[];
  equipped: { title?: string; aura?: string };
  feeling: { day: string; value: Feeling } | null;
}

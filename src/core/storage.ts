import type { GameState, Profile } from './types.ts';

export const STORAGE_KEY = 'repquest.save';

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const defaultProfile = (): Profile => ({
  name: '',
  level: 'beginner',
  goal: 'consistency',
  canPushup: true,
  canPullup: false,
  capacity: { pushup: 5, pullup: 0 },
  onboarded: false,
  lang: 'ro',
  camera: 'user',
});

export const newState = (): GameState => ({
  v: 1,
  profile: defaultProfile(),
  xp: 0,
  coins: 0,
  completedMissions: {},
  history: [],
  achievements: [],
  claimedQuests: [],
  titles: [],
  owned: [],
  equipped: {},
  feeling: null,
});

/** Future: replace/extend with a cloud adapter (auth + sync) without touching game logic. */
export function loadState(store: KeyValueStore): GameState {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return newState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return newState(); // add migrations here when v bumps
    const base = newState();
    return { ...base, ...parsed, profile: { ...base.profile, ...parsed.profile } };
  } catch {
    return newState();
  }
}

export function saveState(store: KeyValueStore, state: GameState): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode: the game keeps running in memory */
  }
}

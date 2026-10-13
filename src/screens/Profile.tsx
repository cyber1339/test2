import type { GameState } from '../core/types.ts';
import { ACHIEVEMENTS, levelProgress, sessionsThisWeek, streak, totalReps } from '../core/progression.ts';
import { addDays, dayKey } from '../core/dates.ts';
import { Avatar, Bar, Button, Card, Chip } from '../components/ui.tsx';
import { t } from '../i18n/index.ts';

interface Props { state: GameState; onState: (fn: (s: GameState) => GameState) => void }

const SHOP = [
  { id: 'aura-violet', cost: 50, kind: 'aura' },
  { id: 'aura-cyan', cost: 50, kind: 'aura' },
  { id: 'aura-gold', cost: 120, kind: 'aura' },
  { id: 'armor-iron', cost: 150, kind: 'armor' },
] as const;

export function Profile({ state, onState }: Props) {
  const today = dayKey(new Date());
  const lp = levelProgress(state.xp);
  const h = state.history;
  const bestSession = h.reduce((a, s) => Math.max(a, s.reps.pushup + s.reps.pullup), 0);
  const bestPush = h.reduce((a, s) => Math.max(a, s.reps.pushup), 0);
  const bestPull = h.reduce((a, s) => Math.max(a, s.reps.pullup), 0);
  const trained = new Set(h.filter((s) => s.reps.pushup + s.reps.pullup > 0).map((s) => s.day));
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, -27 + i));
  const adherence = Math.min(100, Math.round((sessionsThisWeek(h, today) / 3) * 100));
  const titles = ['title.novice', ...state.titles];
  const noteCounts: Record<string, number> = {};
  h.slice(-10).forEach((s) => s.notes.forEach((n) => { noteCounts[n] = (noteCounts[n] ?? 0) + 1; }));

  const buy = (id: string, cost: number) => onState((s) => (s.coins >= cost && !s.owned.includes(id) ? { ...s, coins: s.coins - cost, owned: [...s.owned, id] } : s));
  const equipAura = (id?: string) => onState((s) => ({ ...s, equipped: { ...s.equipped, aura: id } }));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 safe-top">
      <header className="flex items-center gap-4">
        <Avatar size={80} aura={state.equipped.aura} armor={state.owned.includes('armor-iron')} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl font-extrabold">{state.profile.name || t('home.hero')}</div>
          <div className="text-sm text-gold">{t(state.equipped.title ?? 'title.novice')}</div>
          <div className="mt-1"><Bar pct={lp.pct} color="bg-gold" height="h-2" /></div>
          <div className="text-xs text-mute">{t('lvl', { n: lp.level })} · {lp.current}/{lp.needed} XP</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {[
          [t('stat.totalPush'), totalReps(h, 'pushup')],
          [t('stat.totalPull'), totalReps(h, 'pullup')],
          [t('stat.record'), `${bestSession} (${bestPush}/${bestPull})`],
          [t('stat.streak'), streak(h, today)],
          [t('stat.adherence'), `${adherence}%`],
          [t('stat.sessions'), h.length],
        ].map(([k, v]) => (
          <Card key={String(k)} className="!p-3"><div className="text-xs text-mute">{k}</div><div className="font-display text-xl font-extrabold">{v}</div></Card>
        ))}
      </div>

      <Card>
        <div className="mb-2 font-bold">{t('profile.calendar')}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <div key={d} className={`flex aspect-square items-center justify-center rounded-lg text-[10px] ${trained.has(d) ? 'bg-arcane text-white' : 'bg-raised text-mute'} ${d === today ? 'ring-2 ring-gold' : ''}`}>{d.slice(8)}</div>
          ))}
        </div>
      </Card>

      {Object.keys(noteCounts).length > 0 && (
        <Card>
          <div className="mb-2 font-bold">{t('profile.technique')}</div>
          <ul className="space-y-1 text-sm text-mute">
            {Object.entries(noteCounts).map(([k, n]) => <li key={k}>• {t(k)} ({n}×)</li>)}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-2 font-bold">{t('profile.achievements')}</div>
        <div className="flex flex-col gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = state.achievements.includes(a.id);
            return (
              <div key={a.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${got ? 'border-gold/50' : 'border-edge opacity-60'}`}>
                <span className="text-xl">{got ? '🏅' : '🔒'}</span>
                <div className="min-w-0 flex-1"><div className="font-bold">{t(a.nameKey)}</div><div className="text-xs text-mute">{t(a.descKey)}</div></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">{t('profile.titles')}</div>
        <div className="flex flex-wrap gap-2">
          {titles.map((ti) => (
            <button key={ti} onClick={() => onState((s) => ({ ...s, equipped: { ...s.equipped, title: ti } }))} aria-pressed={(state.equipped.title ?? 'title.novice') === ti}>
              <Chip tone={(state.equipped.title ?? 'title.novice') === ti ? 'gold' : 'mute'}>{t(ti)}</Chip>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-1 font-bold">{t('profile.shop')}</div>
        <p className="mb-3 text-xs text-mute">{t('profile.shopNote')}</p>
        <div className="flex flex-col gap-2">
          {SHOP.map((it) => {
            const owned = state.owned.includes(it.id);
            const on = state.equipped.aura === it.id;
            return (
              <div key={it.id} className="flex items-center gap-3">
                <span className="flex-1">{t(`shop.${it.id}`)}</span>
                {owned ? (
                  it.kind === 'aura' ? <Button variant={on ? 'gold' : 'ghost'} className="!min-h-[40px] !px-3 text-sm" onClick={() => equipAura(on ? undefined : it.id)}>{on ? t('shop.equipped') : t('shop.equip')}</Button> : <Chip tone="gold">✓</Chip>
                ) : (
                  <Button variant="ghost" disabled={state.coins < it.cost} className="!min-h-[40px] !px-3 text-sm" onClick={() => buy(it.id, it.cost)}>{it.cost} ◈</Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">{t('profile.history')}</div>
        {h.length === 0 && <p className="text-sm text-mute">{t('profile.noHistory')}</p>}
        <div className="flex flex-col gap-2">
          {[...h].reverse().slice(0, 15).map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span>{s.day.slice(5)} · {s.missionId ? (s.completed ? '✓' : '✕') : t('profile.test')}</span>
              <span className="text-mute">{s.reps.pushup} {t('ex.pushup')} · {s.reps.pullup} {t('ex.pullup')} · +{s.xp} XP</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">{t('profile.settings')}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => onState((s) => ({ ...s, profile: { ...s.profile, lang: s.profile.lang === 'ro' ? 'en' : 'ro' } }))}>{state.profile.lang === 'ro' ? 'English' : 'Română'}</Button>
          <Button variant="ghost" onClick={() => onState((s) => ({ ...s, profile: { ...s.profile, camera: s.profile.camera === 'user' ? 'environment' : 'user' } }))}>
            {state.profile.camera === 'user' ? t('cam.front') : t('cam.back')}
          </Button>
        </div>
        <Button variant="danger" className="mt-3 w-full" onClick={() => { if (window.confirm(t('profile.resetConfirm'))) { window.localStorage.clear(); window.location.reload(); } }}>{t('profile.reset')}</Button>
      </Card>
    </div>
  );
}

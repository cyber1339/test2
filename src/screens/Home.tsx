import type { GameState } from '../core/types.ts';
import { MONSTERS, missionHp, missionTargets } from '../core/campaign.ts';
import { levelProgress, questsFor, claimQuest, sessionsThisWeek, streak } from '../core/progression.ts';
import { recommendToday, volumeLastDays } from '../core/plan.ts';
import { dayKey } from '../core/dates.ts';
import { Avatar, Bar, Button, Card, Chip } from '../components/ui.tsx';
import { Monster } from '../components/Monster.tsx';
import { t } from '../i18n/index.ts';

interface Props { state: GameState; onStart: (missionId: string, multiplier: number, comeback: boolean) => void; onMap: () => void; onState: (fn: (s: GameState) => GameState) => void }

export function Home({ state, onStart, onMap, onState }: Props) {
  const now = new Date();
  const today = dayKey(now);
  const lp = levelProgress(state.xp);
  const plan = recommendToday(state, now);
  const m = plan.mission;
  const mon = m ? MONSTERS[m.monster] : null;
  const week = sessionsThisWeek(state.history, today);
  const vol = volumeLastDays(state, today, 7);
  const maxV = Math.max(10, ...vol.map((v) => v.reps));
  const quests = questsFor(state, today);
  const title = state.equipped.title ?? 'title.novice';

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 safe-top">
      <header className="flex items-center gap-3">
        <Avatar aura={state.equipped.aura} armor={state.owned.includes('armor-iron')} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-extrabold">{state.profile.name || t('home.hero')}</div>
          <div className="text-xs text-gold">{t(title)}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-bold">{t('lvl', { n: lp.level })}</span>
            <Bar pct={lp.pct} color="bg-gold" height="h-2" />
            <span className="whitespace-nowrap text-xs text-mute">{lp.current}/{lp.needed}</span>
          </div>
        </div>
        <Chip tone="gold">{state.coins} ◈</Chip>
      </header>

      <Card className="relative overflow-hidden bg-gradient-to-b from-[#1b1432] to-panel">
        <div className="mb-1 flex items-center justify-between">
          <Chip tone={plan.kind === 'rest' ? 'blood' : plan.kind === 'normal' ? 'arcane' : 'frost'}>{t(`planKind.${plan.kind}`)}</Chip>
          {m && <Chip tone="gold">+{m.xp} XP</Chip>}
        </div>
        {m && mon ? (
          <>
            <Monster id={mon.id} className="mx-auto h-44 w-44" />
            <h2 className="text-center font-display text-xl font-extrabold">{t(m.nameKey)}</h2>
            <p className="text-center text-sm text-mute">{t(mon.descKey)}</p>
            <div className="my-3 flex flex-wrap justify-center gap-2">
              {missionTargets(m, state.profile, plan.multiplier).map((s, i) => (
                <Chip key={i} tone="frost">{s.reps} × {t(`ex.${s.exercise}`)}</Chip>
              ))}
              <Chip tone="blood">HP {missionHp(m, state.profile, plan.multiplier)}</Chip>
            </div>
            <p className="mb-3 text-center text-sm text-mute">{t(plan.reasonKey)}</p>
            <Button className="w-full" onClick={() => onStart(m.id, plan.multiplier, plan.kind === 'comeback')}>{t('home.start')}</Button>
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="font-display text-lg font-extrabold">{t(plan.reasonKey)}</p>
            <p className="mt-2 text-sm text-mute">{plan.tipKeys.map((k) => t(k)).join(' ')}</p>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold">{t('home.week')}</span>
          <span className="text-sm text-mute">{t('home.weekSessions', { n: week })} · {t('home.streak', { n: streak(state.history, today) })}</span>
        </div>
        <div className="flex h-20 items-end gap-2" role="img" aria-label={t('home.week')}>
          {vol.map((v) => (
            <div key={v.day} className="flex flex-1 flex-col items-center gap-1">
              <div className={`w-full rounded-t-md ${v.day === today ? 'bg-gold' : 'bg-arcane'}`} style={{ height: `${Math.max(3, (v.reps / maxV) * 64)}px`, opacity: v.reps ? 1 : 0.25 }} />
              <span className="text-[10px] text-mute">{v.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 font-bold">{t('home.quests')}</div>
        <div className="flex flex-col gap-3">
          {quests.map((q) => (
            <div key={q.key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm">{t(q.nameKey)} <span className="text-mute">({q.progress}/{q.target})</span></div>
                <Bar pct={q.progress / q.target} color="bg-frost" height="h-2" />
              </div>
              <button
                disabled={q.claimed || q.progress < q.target}
                onClick={() => onState((s) => claimQuest(s, q.key, today))}
                className="min-h-[40px] rounded-xl bg-gold px-3 text-sm font-extrabold text-black disabled:bg-raised disabled:text-mute"
              >
                {q.claimed ? '✓' : `+${q.xp}`}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Button variant="ghost" onClick={onMap}>{t('home.openMap')}</Button>
    </div>
  );
}

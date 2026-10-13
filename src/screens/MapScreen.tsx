import type { GameState } from '../core/types.ts';
import { MISSIONS, MONSTERS, ZONES, isZoneUnlocked, missionLock, missionTargets } from '../core/campaign.ts';
import { levelFromXp } from '../core/progression.ts';
import { Button, Card, Chip } from '../components/ui.tsx';
import { Monster } from '../components/Monster.tsx';
import { t } from '../i18n/index.ts';

export function MapScreen({ state, onStart }: { state: GameState; onStart: (missionId: string) => void }) {
  const level = levelFromXp(state.xp);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-28 safe-top">
      <h1 className="font-display text-2xl font-extrabold">{t('map.title')}</h1>
      {ZONES.map((z) => {
        const open = isZoneUnlocked(z.id, level);
        const ms = MISSIONS.filter((m) => m.zoneId === z.id);
        const cleared = ms.filter((m) => state.completedMissions[m.id]).length;
        return (
          <section key={z.id} className={open ? '' : 'opacity-60'}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">{t(z.nameKey)}</h2>
              {open ? <Chip tone="frost">{cleared}/{ms.length}</Chip> : <Chip tone="blood">🔒 {t('locked.level', { n: z.minLevel })}</Chip>}
            </div>
            <p className="mb-2 text-xs text-mute">{t('map.reward')}: {t(z.rewardKey)}</p>
            <div className="flex flex-col gap-2 border-l-2 border-edge pl-3">
              {ms.map((m) => {
                const lock = open ? missionLock(m, state.profile, level) : 'locked.level';
                const done = state.completedMissions[m.id] ?? 0;
                return (
                  <Card key={m.id} className="flex items-center gap-3 !p-3">
                    <Monster id={m.monster} className="h-14 w-14 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold">{t(m.nameKey)}</span>
                        {m.kind === 'boss' && <Chip tone="gold">Boss</Chip>}
                        {m.kind === 'special' && <Chip tone="arcane">{t('map.special')}</Chip>}
                      </div>
                      <div className="text-xs text-mute">
                        {t(MONSTERS[m.monster].nameKey)} · {missionTargets(m, state.profile).map((s) => `${s.reps || '–'} ${t(`ex.${s.exercise}`)}`).join(' + ')}
                      </div>
                      <div className="text-xs text-gold">+{m.xp} XP{done > 0 ? ` · ✓ ×${done}` : ''}</div>
                    </div>
                    {lock === 'locked.pullup' ? (
                      <span className="max-w-[88px] text-right text-xs text-mute">{t('locked.pullup')}</span>
                    ) : lock ? (
                      <span>🔒</span>
                    ) : (
                      <Button className="!min-h-[44px] !px-4" onClick={() => onStart(m.id)}>{t('btn.fight')}</Button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

import type { Feeling, GameState } from '../core/types.ts';
import { recommendToday, volumeLastDays } from '../core/plan.ts';
import { dayKey } from '../core/dates.ts';
import { Button, Card, Chip } from '../components/ui.tsx';
import { t } from '../i18n/index.ts';

interface Props { state: GameState; onState: (fn: (s: GameState) => GameState) => void }

export function Plan({ state, onState }: Props) {
  const now = new Date();
  const today = dayKey(now);
  const plan = recommendToday(state, now);
  const feeling: Feeling = state.feeling?.day === today ? state.feeling.value : 'ok';
  const vol = volumeLastDays(state, today, 14);
  const maxV = Math.max(10, ...vol.map((v) => v.reps));
  const cap = state.profile.capacity;

  const setFeeling = (value: Feeling) => onState((s) => ({ ...s, feeling: { day: today, value } }));
  const adjust = (delta: number) =>
    onState((s) => ({
      ...s,
      profile: {
        ...s.profile,
        capacity: {
          pushup: Math.max(1, s.profile.capacity.pushup + delta),
          pullup: s.profile.capacity.pullup > 0 ? Math.max(1, s.profile.capacity.pullup + delta) : 0,
        },
      },
    }));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 safe-top">
      <h1 className="font-display text-2xl font-extrabold">{t('plan.title')}</h1>

      <Card>
        <div className="mb-2 font-bold">{t('plan.how')}</div>
        <div className="grid grid-cols-2 gap-2">
          {(['ok', 'tired', 'sore', 'pain'] as Feeling[]).map((f) => (
            <button key={f} onClick={() => setFeeling(f)} aria-pressed={feeling === f}
              className={`min-h-[48px] rounded-2xl border px-3 font-semibold ${feeling === f ? (f === 'pain' ? 'border-blood bg-blood/15' : 'border-arcane bg-arcane/15') : 'border-edge bg-raised text-mute'}`}>
              {t(`feel.${f}`)}
            </button>
          ))}
        </div>
        {feeling === 'pain' && <p className="mt-3 rounded-2xl border border-blood/40 bg-blood/10 p-3 text-sm text-blood">{t('tip.pain')}</p>}
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <span className="font-bold">{t('plan.today')}</span>
          <Chip tone={plan.kind === 'rest' ? 'blood' : 'arcane'}>{t(`planKind.${plan.kind}`)}</Chip>
        </div>
        <p className="text-sm text-mute">{t(plan.reasonKey)}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {plan.tipKeys.map((k) => <li key={k}>{t(k)}</li>)}
          <li>{t('tip.general')}</li>
        </ul>
      </Card>

      <Card>
        <div className="mb-2 font-bold">{t('plan.volume')}</div>
        <div className="flex h-24 items-end gap-1.5" role="img" aria-label={t('plan.volume')}>
          {vol.map((v) => (
            <div key={v.day} className="flex flex-1 flex-col items-center gap-1">
              <div className={`w-full rounded-t ${v.day === today ? 'bg-gold' : 'bg-arcane'}`} style={{ height: `${Math.max(3, (v.reps / maxV) * 80)}px`, opacity: v.reps ? 1 : 0.25 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-mute"><span>{vol[0].day.slice(5)}</span><span>{today.slice(5)}</span></div>
      </Card>

      <Card>
        <div className="mb-1 font-bold">{t('plan.difficulty')}</div>
        <p className="mb-3 text-sm text-mute">{t('plan.difficultyBody', { p: cap.pushup, u: cap.pullup })}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => adjust(-1)}>{t('plan.easier')}</Button>
          <Button variant="ghost" onClick={() => adjust(1)}>{t('plan.harder')}</Button>
        </div>
      </Card>
    </div>
  );
}

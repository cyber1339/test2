import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Exercise, Goal, Level, Profile } from '../core/types.ts';
import { Button, Card } from '../components/ui.tsx';
import { Monster } from '../components/Monster.tsx';
import { Training } from './Training.tsx';
import type { TrainingResult } from './Training.tsx';
import { t } from '../i18n/index.ts';

const DEFAULT_CAP: Record<Level, Record<Exercise, number>> = {
  beginner: { pushup: 5, pullup: 0 },
  intermediate: { pushup: 12, pullup: 3 },
  advanced: { pushup: 25, pullup: 8 },
};

const Choice = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} aria-pressed={on} className={`min-h-[52px] rounded-2xl border px-4 text-left font-semibold ${on ? 'border-arcane bg-arcane/15 text-white' : 'border-edge bg-raised text-mute'}`}>
    {children}
  </button>
);

export function Onboarding({ initial, onFinish }: { initial: Profile; onFinish: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(initial);
  const [testing, setTesting] = useState<Exercise | null>(null);
  const [measured, setMeasured] = useState<Partial<Record<Exercise, number>>>({});

  const finalize = (m: Partial<Record<Exercise, number>>) => {
    const base = DEFAULT_CAP[p.level];
    const capacity = {
      // A user who cannot do a full pushup yet starts from a small, safe number (incline pushups are a good start).
      pushup: p.canPushup ? Math.max(1, m.pushup ?? base.pushup) : 3,
      pullup: p.canPullup ? Math.max(1, m.pullup ?? base.pullup) : 0,
    };
    onFinish({ ...p, capacity, onboarded: true });
  };

  const afterTest = (ex: Exercise, r: TrainingResult) => {
    const m = { ...measured, [ex]: r.reps[ex] > 0 ? r.reps[ex] : undefined };
    setMeasured(m);
    if (r.pain) return finalize(m); // pain: stop testing, use safe defaults
    if (ex === 'pushup' && p.canPullup) setTesting('pullup');
    else { setTesting(null); finalize(m); }
  };

  if (testing) {
    return (
      <Training
        mode="test"
        title={t(testing === 'pushup' ? 'test.pushup' : 'test.pullup')}
        targets={[{ exercise: testing, reps: 0 }]}
        testExercise={testing}
        camera={p.camera}
        onDone={(r) => afterTest(testing, r)}
        onExit={() => { setTesting(null); }}
      />
    );
  }

  const startTest = () => setTesting(p.canPushup ? 'pushup' : 'pullup');

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 px-5 py-8 safe-top">
      {step === 0 && (
        <>
          <Monster id="dragon" className="mx-auto h-56 w-56" />
          <h1 className="text-center font-display text-4xl font-extrabold tracking-wide">REPQUEST</h1>
          <p className="text-center text-gold">{t('app.tagline')}</p>
          <p className="text-center text-mute">{t('onb.intro')}</p>
          <Button onClick={() => setStep(1)}>{t('btn.next')}</Button>
        </>
      )}
      {step === 1 && (
        <>
          <h2 className="font-display text-2xl font-extrabold">{t('onb.profile')}</h2>
          <label className="flex flex-col gap-2 text-sm text-mute">
            {t('onb.name')}
            <input value={p.name} maxLength={20} onChange={(e) => setP({ ...p, name: e.target.value })} className="min-h-[52px] rounded-2xl border border-edge bg-raised px-4 text-base text-white" />
          </label>
          <div className="text-sm text-mute">{t('onb.level')}</div>
          {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => (
            <Choice key={l} on={p.level === l} onClick={() => setP({ ...p, level: l })}>{t(`level.${l}`)}</Choice>
          ))}
          <div className="text-sm text-mute">{t('onb.goal')}</div>
          <div className="grid grid-cols-2 gap-2">
            {(['strength', 'consistency', 'reps', 'fitness'] as Goal[]).map((g) => (
              <Choice key={g} on={p.goal === g} onClick={() => setP({ ...p, goal: g })}>{t(`goal.${g}`)}</Choice>
            ))}
          </div>
          <Button onClick={() => setStep(2)}>{t('btn.next')}</Button>
        </>
      )}
      {step === 2 && (
        <>
          <h2 className="font-display text-2xl font-extrabold">{t('onb.abilities')}</h2>
          <Card>
            <div className="mb-2 font-bold">{t('ex.pushup')}</div>
            <div className="grid grid-cols-2 gap-2">
              <Choice on={p.canPushup} onClick={() => setP({ ...p, canPushup: true })}>{t('onb.can')}</Choice>
              <Choice on={!p.canPushup} onClick={() => setP({ ...p, canPushup: false })}>{t('onb.cannot')}</Choice>
            </div>
          </Card>
          <Card>
            <div className="mb-2 font-bold">{t('ex.pullup')}</div>
            <div className="grid grid-cols-2 gap-2">
              <Choice on={p.canPullup} onClick={() => setP({ ...p, canPullup: true })}>{t('onb.can')}</Choice>
              <Choice on={!p.canPullup} onClick={() => setP({ ...p, canPullup: false })}>{t('onb.cannot')}</Choice>
            </div>
          </Card>
          <p className="text-sm text-mute">{t('onb.safety')}</p>
          <Button onClick={() => setStep(3)}>{t('btn.next')}</Button>
        </>
      )}
      {step === 3 && (
        <>
          <h2 className="font-display text-2xl font-extrabold">{t('onb.testTitle')}</h2>
          <p className="text-mute">{t('onb.testBody')}</p>
          <Card className="text-sm text-mute">{t('onb.testRule')}</Card>
          <Button onClick={startTest} disabled={!p.canPushup && !p.canPullup}>{t('onb.testStart')}</Button>
          <Button variant="ghost" onClick={() => finalize({})}>{t('onb.testSkip')}</Button>
        </>
      )}
    </div>
  );
}

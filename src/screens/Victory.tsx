import { useEffect, useState } from 'react';
import type { Mission } from '../core/campaign.ts';
import { MONSTERS } from '../core/campaign.ts';
import type { SessionSummary } from '../core/progression.ts';
import { ACHIEVEMENTS, levelProgress } from '../core/progression.ts';
import type { TrainingResult } from './Training.tsx';
import { Bar, Button, Card } from '../components/ui.tsx';
import { Monster } from '../components/Monster.tsx';
import { t } from '../i18n/index.ts';

interface Props { mission: Mission; result: TrainingResult; summary: SessionSummary; xpAfter: number; onHome: () => void }

export function Victory({ mission, result, summary, xpAfter, onHome }: Props) {
  const won = result.completed;
  const before = xpAfter - summary.xp;
  const [xp, setXp] = useState(before);
  useEffect(() => { const id = setTimeout(() => setXp(xpAfter), 400); return () => clearTimeout(id); }, [xpAfter]);
  const lp = levelProgress(xp);
  const total = result.reps.pushup + result.reps.pullup;
  const attempts = total + result.rejected;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-8 safe-top">
      <Monster id={mission.monster} defeated={won} className="mx-auto h-48 w-48" />
      <h1 className="text-center font-display text-3xl font-extrabold text-gold">{won ? t('victory.title') : t('victory.partial')}</h1>
      <p className="text-center text-mute">{won ? t('victory.body', { name: t(MONSTERS[mission.monster].nameKey) }) : t('victory.partialBody')}</p>

      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="font-display text-2xl font-extrabold">{total}</div><div className="text-xs text-mute">{t('victory.reps')}</div></div>
          <div><div className="font-display text-2xl font-extrabold text-gold">+{summary.xp}</div><div className="text-xs text-mute">XP</div></div>
          <div><div className="font-display text-2xl font-extrabold text-gold">+{summary.coins}</div><div className="text-xs text-mute">◈</div></div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-mute"><span>{t('lvl', { n: lp.level })}</span><span>{lp.current}/{lp.needed}</span></div>
          <Bar pct={lp.pct} color="bg-gold" height="h-3" />
          {summary.levelAfter > summary.levelBefore && <p className="mt-2 text-center font-bold text-frost">{t('victory.levelUp', { n: summary.levelAfter })}</p>}
        </div>
      </Card>

      <Card>
        <div className="mb-1 font-bold">{t('victory.technique')}</div>
        {attempts > 0 && <p className="text-sm text-mute">{t('victory.quality', { ok: total, all: attempts })}</p>}
        {result.notes.length === 0 ? <p className="text-sm text-mute">{t('victory.noNotes')}</p> : (
          <ul className="mt-1 space-y-1 text-sm">{result.notes.map((n) => <li key={n}>• {t(n)}</li>)}</ul>
        )}
      </Card>

      {summary.newAchievements.length > 0 && (
        <Card>
          <div className="mb-1 font-bold">{t('victory.achievements')}</div>
          {summary.newAchievements.map((id) => { const a = ACHIEVEMENTS.find((x) => x.id === id)!; return <div key={id}>🏅 {t(a.nameKey)} <span className="text-gold">+{a.xp} XP</span></div>; })}
        </Card>
      )}

      {result.pain && <Card className="border-blood/50 text-sm text-blood">{t('tip.pain')}</Card>}
      <Button onClick={onHome} className="mt-auto">{t('btn.home')}</Button>
    </div>
  );
}

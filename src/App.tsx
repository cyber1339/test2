import { useState } from 'react';
import { useGame } from './store.tsx';
import { getMission, missionTargets } from './core/campaign.ts';
import { applySession } from './core/progression.ts';
import type { SessionSummary } from './core/progression.ts';
import { dayKey } from './core/dates.ts';
import { TabBar } from './components/ui.tsx';
import type { Tab } from './components/ui.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Home } from './screens/Home.tsx';
import { MapScreen } from './screens/MapScreen.tsx';
import { Plan } from './screens/Plan.tsx';
import { Profile } from './screens/Profile.tsx';
import { Training } from './screens/Training.tsx';
import type { TrainingResult } from './screens/Training.tsx';
import { Victory } from './screens/Victory.tsx';
import { t } from './i18n/index.ts';

type Route =
  | { name: 'tabs' }
  | { name: 'training'; missionId: string; multiplier: number; comeback: boolean }
  | { name: 'victory'; missionId: string; result: TrainingResult; summary: SessionSummary; xpAfter: number };

export function App() {
  const { state, update } = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [route, setRoute] = useState<Route>({ name: 'tabs' });
  const [notice, setNotice] = useState<string | null>(null);

  if (!state.profile.onboarded) {
    return <Onboarding initial={state.profile} onFinish={(profile) => update((s) => ({ ...s, profile }))} />;
  }

  const today = dayKey(new Date());
  const hasPain = state.feeling?.day === today && state.feeling.value === 'pain';

  const startMission = (missionId: string, multiplier = 1, comeback = false) => {
    if (hasPain) { setNotice(t('tip.pain')); setTab('plan'); return; }
    setNotice(null);
    setRoute({ name: 'training', missionId, multiplier, comeback });
  };

  if (route.name === 'training') {
    const mission = getMission(route.missionId)!;
    const targets = missionTargets(mission, state.profile, route.multiplier);
    const done = (result: TrainingResult) => {
      const { state: next, summary } = applySession(
        state,
        { missionId: mission.id, completed: result.completed, reps: result.reps, rejected: result.rejected, durationSec: result.durationSec, notes: result.notes, comeback: route.comeback },
        new Date()
      );
      update(() => (result.pain ? { ...next, feeling: { day: today, value: 'pain' } } : next));
      setRoute({ name: 'victory', missionId: mission.id, result, summary, xpAfter: next.xp });
    };
    return (
      <Training
        mode="mission"
        title={t(mission.nameKey)}
        monster={mission.monster}
        targets={targets}
        camera={state.profile.camera}
        onDone={done}
        onExit={() => setRoute({ name: 'tabs' })}
      />
    );
  }

  if (route.name === 'victory') {
    return (
      <Victory
        mission={getMission(route.missionId)!}
        result={route.result}
        summary={route.summary}
        xpAfter={route.xpAfter}
        onHome={() => { setTab('home'); setRoute({ name: 'tabs' }); }}
      />
    );
  }

  return (
    <>
      {notice && <div className="mx-auto mt-3 max-w-md rounded-2xl border border-blood/40 bg-blood/10 p-3 text-sm text-blood safe-top">{notice}</div>}
      {tab === 'home' && <Home state={state} onStart={startMission} onMap={() => setTab('map')} onState={update} />}
      {tab === 'map' && <MapScreen state={state} onStart={(id) => startMission(id)} />}
      {tab === 'plan' && <Plan state={state} onState={update} />}
      {tab === 'profile' && <Profile state={state} onState={update} />}
      <TabBar tab={tab} onTab={(x) => { setNotice(null); setTab(x); }} />
    </>
  );
}

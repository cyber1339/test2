import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CameraFacing, Exercise } from '../core/types.ts';
import type { MonsterId } from '../core/campaign.ts';
import { MONSTERS, applyRejectedRep, applyValidRep, battleDone, battleHp, battleMaxHp, newBattle } from '../core/campaign.ts';
import type { Battle } from '../core/campaign.ts';
import { RepCounter } from '../core/repCounter.ts';
import type { Phase } from '../core/repCounter.ts';
import { checkFraming } from '../core/framing.ts';
import { loadPose } from '../ai/pose.ts';
import type { PoseLandmarker } from '../ai/pose.ts';
import { CameraFailure, startCamera, stopCamera } from '../ai/camera.ts';
import { drawPose } from '../ai/draw.ts';
import { Monster } from '../components/Monster.tsx';
import { Bar, Button, Chip } from '../components/ui.tsx';
import { t } from '../i18n/index.ts';

export interface TrainingResult {
  completed: boolean;
  reps: Record<Exercise, number>;
  rejected: number;
  durationSec: number;
  notes: string[];
  pain: boolean;
}

interface Props {
  mode: 'mission' | 'test';
  title: string;
  monster?: MonsterId;
  targets: { exercise: Exercise; reps: number }[];
  testExercise?: Exercise;
  camera: CameraFacing;
  onDone: (r: TrainingResult) => void;
  onExit: () => void;
}

type Stage = 'intro' | 'loading' | 'calibrating' | 'active' | 'paused' | 'error';
interface Ui { phase: Phase; conf: number; fb: string | null; ok: boolean }

const CALIBRATION_MS = 1500;
const MIN_CONF_OK = 0.5;

export function Training(props: Props) {
  const { mode, targets, testExercise } = props;
  const test = mode === 'test';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lmkRef = useRef<PoseLandmarker | null>(null);
  const counterRef = useRef<RepCounter | null>(null);
  const rafRef = useRef(0);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const stageRef = useRef<Stage>('intro');
  const battleRef = useRef<Battle>(newBattle(targets));
  const repsRef = useRef<Record<Exercise, number>>({ pushup: 0, pullup: 0 });
  const rejectedRef = useRef(0);
  const notesRef = useRef<Set<string>>(new Set());
  const startedAt = useRef(0);
  const lastVideoTime = useRef(-1);
  const lastDetect = useRef(0);
  const calibMs = useRef(0);
  const lastCalibT = useRef<number | null>(null);
  const fbRef = useRef<{ key: string; until: number } | null>(null);
  const uiKey = useRef('');
  const doneRef = useRef(false);

  const [stage, setStageState] = useState<Stage>('intro');
  const [err, setErr] = useState<string | null>(null);
  const [battle, setBattle] = useState<Battle>(battleRef.current);
  const [hurt, setHurt] = useState(0);
  const [testReps, setTestReps] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [calib, setCalib] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ui, setUi] = useState<Ui>({ phase: 'LOST', conf: 0, fb: null, ok: false });

  const setStage = (s: Stage) => { stageRef.current = s; setStageState(s); };
  const currentExercise = (): Exercise => (test ? (testExercise as Exercise) : battleRef.current.steps[battleRef.current.current].exercise);
  const exercise = test ? (testExercise as Exercise) : battle.steps[battle.current].exercise;

  const shutdown = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);

  const finish = useCallback((completed: boolean, pain = false) => {
    if (doneRef.current) return;
    doneRef.current = true;
    shutdown();
    propsRef.current.onDone({
      completed,
      reps: { ...repsRef.current },
      rejected: rejectedRef.current,
      durationSec: startedAt.current ? Math.round((performance.now() - startedAt.current) / 1000) : 0,
      notes: [...notesRef.current],
      pain,
    });
  }, [shutdown]);

  useEffect(() => () => { shutdown(); }, [shutdown]);

  const beginCalibration = () => {
    counterRef.current = new RepCounter(currentExercise());
    calibMs.current = 0;
    lastCalibT.current = null;
    setCalib(0);
    setUi({ phase: 'LOST', conf: 0, fb: 'cal.noBody', ok: false });
    setStage('calibrating');
  };

  const pushUi = (next: Ui, now: number) => {
    const fb = next.fb ?? (fbRef.current && now < fbRef.current.until ? fbRef.current.key : null);
    const key = `${next.phase}|${fb}|${Math.round(next.conf * 20)}|${next.ok}`;
    if (key === uiKey.current) return;
    uiKey.current = key;
    setUi({ ...next, fb });
  };

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const v = videoRef.current;
    const lmk = lmkRef.current;
    const canvas = canvasRef.current;
    const stg = stageRef.current;
    if (!v || !lmk || !canvas || v.readyState < 2 || (stg !== 'calibrating' && stg !== 'active')) return;
    if (v.currentTime === lastVideoTime.current) return;
    const now = performance.now();
    if (now - lastDetect.current < 33) return; // ~30 detections/s at most: keeps phones cool
    lastVideoTime.current = v.currentTime;
    lastDetect.current = now;

    if (canvas.width !== v.videoWidth) { canvas.width = v.videoWidth; canvas.height = v.videoHeight; }
    const res = lmk.detectForVideo(v, now);
    const lm = res.landmarks[0] ?? null;
    const aspect = v.videoWidth / v.videoHeight;
    const ex = currentExercise();

    if (stg === 'calibrating') {
      const f = checkFraming(lm, ex, aspect);
      const ctx = canvas.getContext('2d');
      if (ctx) drawPose(ctx, lm, canvas.width, canvas.height, f.ok);
      const dtMs = lastCalibT.current === null ? 0 : now - lastCalibT.current;
      lastCalibT.current = now;
      calibMs.current = f.ok ? calibMs.current + dtMs : 0;
      setCalib(Math.min(1, calibMs.current / CALIBRATION_MS));
      pushUi({ phase: 'LOST', conf: f.confidence, fb: f.message, ok: f.ok }, now);
      if (calibMs.current >= CALIBRATION_MS) {
        counterRef.current = new RepCounter(ex);
        if (!startedAt.current) startedAt.current = now;
        setStage('active');
        uiKey.current = '';
      }
      return;
    }

    // ---- active
    const counter = counterRef.current;
    if (!counter) return;
    const r = counter.update(lm, now, aspect);
    const ctx = canvas.getContext('2d');
    if (ctx) drawPose(ctx, lm, canvas.width, canvas.height, r.confidence >= MIN_CONF_OK);

    if (r.event?.type === 'valid') {
      repsRef.current[ex] += 1;
      for (const w of r.event.warnings) notesRef.current.add(w === 'BODY' ? 'fb.straight' : 'fb.swing');
      fbRef.current = { key: r.feedback ?? 'fb.valid', until: now + 1600 };
      navigator.vibrate?.(25);
      if (test) {
        setTestReps(repsRef.current[ex]);
      } else {
        const before = battleRef.current;
        const after = applyValidRep(before);
        battleRef.current = after;
        setBattle(after);
        setHurt((h) => h + 1);
        if (battleDone(after)) { finish(true); return; }
        if (after.current !== before.current) { beginCalibration(); return; }
      }
    } else if (r.event?.type === 'rejected') {
      rejectedRef.current += 1;
      setRejected(rejectedRef.current);
      if (r.feedback) { notesRef.current.add(r.feedback); fbRef.current = { key: r.feedback, until: now + 1800 }; }
      if (!test) { battleRef.current = applyRejectedRep(battleRef.current); }
    }
    pushUi({ phase: r.phase, conf: r.confidence, fb: r.event ? r.feedback : r.feedback, ok: r.confidence >= MIN_CONF_OK }, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  const start = async () => {
    setErr(null);
    setStage('loading');
    try {
      const v = videoRef.current;
      if (!v) throw new Error('no video');
      streamRef.current = await startCamera(v, props.camera);
      lmkRef.current = await loadPose();
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        wakeRef.current = (await wl?.request('screen')) ?? null;
      } catch { /* optional */ }
      beginCalibration();
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      shutdown();
      setErr(e instanceof CameraFailure ? `err.${e.kind}` : 'err.model');
      setStage('error');
    }
  };

  const pause = () => { counterRef.current?.pause(); setStage('paused'); };
  const resume = () => { counterRef.current?.resume(); uiKey.current = ''; setStage('active'); };

  const mirror = props.camera === 'user' ? '-scale-x-100' : '';
  const hp = battleHp(battle);
  const maxHp = battleMaxHp(battle);
  const monster = props.monster ? MONSTERS[props.monster] : null;
  const validNow = test ? testReps : battle.steps.reduce((a, s) => a + s.done, 0);

  return (
    <div className="fixed inset-0 z-30 bg-black text-white">
      <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-contain ${mirror}`} />
      <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full object-contain ${mirror}`} />

      {(stage === 'calibrating' || stage === 'active' || stage === 'paused') && (
        <div className="absolute inset-x-0 top-0 safe-top bg-gradient-to-b from-black/85 to-transparent px-3 pb-6">
          {test ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-lg font-extrabold">{props.title}</div>
                <div className="text-xs text-mute">{t('test.hint')}</div>
              </div>
              <div className="text-5xl font-display font-extrabold text-gold">{testReps}</div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0">
                {monster && <Monster id={monster.id} hurtKey={hurt} className="h-16 w-16" />}
                {hurt > 0 && <span key={hurt} className="anim-dmg absolute -top-1 right-0 font-display text-xl font-extrabold text-blood">-1</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-sm font-extrabold">{monster ? t(monster.nameKey) : ''}</span>
                  <span className="text-xs font-bold text-blood">{t('hud.hp', { hp, max: maxHp })}</span>
                </div>
                <Bar pct={hp / maxHp} color="bg-blood" ghost height="h-4" />
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {battle.steps.map((s, i) => (
                    <Chip key={i} tone={i === battle.current ? 'frost' : 'mute'}>{t(`ex.${s.exercise}`)} {s.done}/{s.reps}</Chip>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(stage === 'calibrating' || stage === 'active') && (
        <div className="absolute inset-x-0 bottom-0 safe-bottom bg-gradient-to-t from-black/90 to-transparent px-3 pt-10">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className={ui.ok ? 'text-frost' : 'text-gold'}>{t('hud.confidence', { n: Math.round(ui.conf * 100) })}</span>
            <span className="text-mute">{stage === 'active' ? t(`phase.${ui.phase}`) : t('hud.calibrating')}</span>
            <span className="text-mute">{t('hud.valid', { n: validNow })} · {t('hud.rejected', { n: rejected })}</span>
          </div>
          <div className={`mb-3 rounded-2xl px-4 py-3 text-center text-lg font-extrabold ${ui.fb === 'fb.valid' ? 'bg-frost/20 text-frost' : 'bg-black/60'}`} aria-live="polite">
            {ui.fb ? t(ui.fb) : stage === 'active' ? t(`cue.${exercise}`) : ''}
          </div>
          {stage === 'calibrating' && <div className="mb-3"><Bar pct={calib} color="bg-frost" /></div>}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Button variant="ghost" onClick={pause} disabled={stage !== 'active'}>{t('btn.pause')}</Button>
            <Button variant={test ? 'gold' : 'ghost'} onClick={() => (test ? finish(true) : setConfirmEnd(true))}>{test ? t('btn.endTest') : t('btn.end')}</Button>
            <Button variant="danger" onClick={() => finish(false, true)}>{t('btn.pain')}</Button>
          </div>
        </div>
      )}

      {stage === 'paused' && (
        <Overlay>
          <h2 className="font-display text-2xl font-extrabold">{t('paused.title')}</h2>
          <p className="text-mute">{t('paused.body')}</p>
          <Button onClick={resume}>{t('btn.resume')}</Button>
        </Overlay>
      )}

      {stage === 'intro' && (
        <Overlay solid>
          <h2 className="font-display text-2xl font-extrabold">{props.title}</h2>
          <p className="font-bold text-gold">{t(`guide.${exercise}.title`)}</p>
          <p className="text-mute">{t(`guide.${exercise}`)}</p>
          <p className="rounded-2xl border border-edge bg-panel p-3 text-sm text-mute">{t('guide.privacy')}</p>
          <Button onClick={start}>{t('btn.startCamera')}</Button>
          <Button variant="ghost" onClick={props.onExit}>{t('btn.back')}</Button>
        </Overlay>
      )}

      {stage === 'loading' && (
        <Overlay solid>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-edge border-t-arcane" />
          <p className="text-mute">{t('loading.model')}</p>
        </Overlay>
      )}

      {stage === 'error' && (
        <Overlay solid>
          <h2 className="font-display text-xl font-extrabold text-blood">{t('err.title')}</h2>
          <p className="text-mute">{t(err ?? 'err.model')}</p>
          <Button onClick={start}>{t('btn.retry')}</Button>
          <Button variant="ghost" onClick={props.onExit}>{t('btn.back')}</Button>
        </Overlay>
      )}

      {confirmEnd && (
        <Overlay>
          <h2 className="font-display text-xl font-extrabold">{t('end.title')}</h2>
          <p className="text-mute">{t('end.body')}</p>
          <Button variant="danger" onClick={() => finish(false)}>{t('end.confirm')}</Button>
          <Button variant="ghost" onClick={() => setConfirmEnd(false)}>{t('end.continue')}</Button>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <div className={`absolute inset-0 z-10 flex items-center justify-center p-6 ${solid ? 'bg-void' : 'bg-black/80 backdrop-blur-sm'}`}>
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">{children}</div>
    </div>
  );
}

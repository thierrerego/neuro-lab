import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Flame,
  HelpCircle,
  RotateCcw,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  AgeBracket,
  ComputedSessionResult,
  DomainKey,
  GameSlug,
  RawGamePerformance,
  SessionMode,
  ThemeMode,
  WaveState,
} from '../types/cognitive';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getStageShortBadge } from '../engine/stageEngine';
import {
  advanceWaveHit,
  createWaveState,
  getWaveBarPct,
  getWaveEffectiveConfig,
} from '../engine/waveEngine';
import { evaluateSession, getAgeBracketMeta } from '../engine/psychometricEngine';
import {
  DIFFICULTY_LABELS,
  evaluateCalibrationAlerts,
  updateLatestCalibrationFeedback,
  type SandboxFeedback,
} from '../lib/calibrationLog';
import type { PreviousExerciseReference, WeeklyDayItem } from '../engine/cognitiveProfiler';
import { GAME_COMPONENTS } from '../games';
import type { LiveMetrics } from '../games/GameProps';
import { sound } from '../lib/audio';
import {
  formatTuningShort,
  isLabTuningModified,
  type LabLevelTuning,
  type PlateauAttempt,
} from '../lib/labTuning';
import { GameTutorial } from './GameTutorial';
import { LabTuningPanel } from './LabTuningPanel';

export interface CalibrationBannerInfo {
  currentIndex: number; // 1..total
  total: number;
  domainName: string;
}

export interface DailyWorkoutProgressInfo {
  completedAfter: number;
  total: number;
  isLastOfWorkout: boolean;
  streakDays: number;
  weekDays: WeeklyDayItem[];
}

interface GameShellProps {
  slug: GameSlug;
  stage: number; // nível base permanente (piso 0)
  easeBoost?: boolean;
  mode: SessionMode;
  theme: ThemeMode;
  ageBracket?: AgeBracket;
  isAdminSession?: boolean;
  sandboxMode?: boolean;
  weakestTwo: DomainKey[];
  previousRef?: PreviousExerciseReference;
  calibrationInfo?: CalibrationBannerInfo;
  workoutProgress?: DailyWorkoutProgressInfo;
  nextChallengeLabel?: string;
  onNextChallenge?: () => void;
  onTestMaxLevel?: () => void;
  sandboxJumpLabel?: string;
  labTuning?: LabLevelTuning;
  onLabTuningChange?: (next: LabLevelTuning) => void;
  onLabTuningReset?: () => void;
  plateauAttempts?: PlateauAttempt[];
  onResetPlateauAttempts?: () => void;
  onComplete: (result: ComputedSessionResult) => Promise<void>;
  onPlayNext: (nextStage: number, easeBoost: boolean) => void;
  onExit: () => void;
}

export function GameShell({
  slug,
  stage,
  easeBoost = false,
  mode,
  ageBracket = '25-34',
  isAdminSession = false,
  sandboxMode = false,
  weakestTwo,
  previousRef,
  calibrationInfo,
  workoutProgress,
  nextChallengeLabel,
  onNextChallenge,
  onTestMaxLevel,
  sandboxJumpLabel = 'Platô (Nv. 13)',
  labTuning,
  onLabTuningChange,
  onLabTuningReset,
  plateauAttempts,
  onResetPlateauAttempts,
  onComplete,
  onPlayNext,
  onExit,
}: GameShellProps) {
  const game = GAME_MAP[slug];
  const domainMeta = DOMAIN_MAP[game.domain];
  const GameComponent = GAME_COMPONENTS[slug];
  const ageLabel = getAgeBracketMeta(ageBracket).label;

  const labTuningRef = useRef<LabLevelTuning | undefined>(labTuning);
  labTuningRef.current = labTuning;
  const [appliedTuning, setAppliedTuning] = useState<LabLevelTuning | undefined>(labTuning);

  const [wave, setWave] = useState<WaveState>(() => createWaveState(stage, slug, labTuning));
  const waveRef = useRef<WaveState>(wave);
  waveRef.current = wave;

  const effectiveConfig = useMemo(
    () => getWaveEffectiveConfig(slug, wave, easeBoost, appliedTuning),
    [slug, wave, easeBoost, appliedTuning]
  );

  const hasPendingTuningChange = Boolean(
    sandboxMode &&
      labTuning &&
      appliedTuning &&
      (Math.abs(labTuning.effectiveLevel - appliedTuning.effectiveLevel) > 0.001 ||
        Math.abs(labTuning.speedScale - appliedTuning.speedScale) > 0.001 ||
        labTuning.targetHits !== appliedTuning.targetHits)
  );

  const totalDurationSec = effectiveConfig.durationSec;
  const totalDurationMs = totalDurationSec * 1000;

  const [timeLeft, setTimeLeft] = useState(totalDurationSec);
  const [finishRequested, setFinishRequested] = useState(false);
  const [live, setLive] = useState<LiveMetrics>({ score: 0, accuracyPct: 100, combo: 0 });
  const [result, setResult] = useState<ComputedSessionResult | null>(null);
  const [showWorkoutComplete, setShowWorkoutComplete] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sandboxFb, setSandboxFb] = useState<SandboxFeedback>({
    note: '',
  });
  const [sandboxFbSaved, setSandboxFbSaved] = useState(false);

  // Fluxo: tutorial -> contagem única no início (3 -> 2 -> 1 -> Vai!) -> exercício contínuo
  const [tutorialSlug, setTutorialSlug] = useState<GameSlug | null>(slug);
  const [prevSlug, setPrevSlug] = useState<GameSlug>(slug);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playRun, setPlayRun] = useState(0);

  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setTutorialSlug(slug);
    setCountdown(null);
    setShowWorkoutComplete(false);
    setHelpOpen(false);
  }
  const showTutorial = tutorialSlug === slug;
  const isCountingDown = !showTutorial && countdown !== null;
  const isPaused = showTutorial || isCountingDown || helpOpen || confirmExitOpen || Boolean(result);

  const matchStartMsRef = useRef<number>(performance.now());
  const pausedAccumMsRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const nextTuning = labTuningRef.current;
    setAppliedTuning(nextTuning);
    const freshWave = createWaveState(stage, slug, nextTuning);
    waveRef.current = freshWave;
    setWave(freshWave);
    const dur = getWaveEffectiveConfig(slug, freshWave, easeBoost, nextTuning).durationSec;
    setTimeLeft(dur);
    setFinishRequested(false);
    setResult(null);
    setShowWorkoutComplete(false);
    setConfirmExitOpen(false);
    setHelpOpen(false);
    setSandboxFb({ note: '' });
    setSandboxFbSaved(false);
    setLive({ score: 0, accuracyPct: 100, combo: 0 });
    matchStartMsRef.current = performance.now();
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    finishedRef.current = false;
  }, [slug, stage, easeBoost, playRun]);

  // Única pausa da sessão: contagem inicial 3 -> 2 -> 1 -> Vai!
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      sound.tap();
      const id = window.setTimeout(() => {
        setCountdown(countdown - 1);
      }, 650);
      return () => window.clearTimeout(id);
    }
    sound.hit(4);
    const id = window.setTimeout(() => {
      matchStartMsRef.current = performance.now();
      pausedAccumMsRef.current = 0;
      pauseStartedAtRef.current = null;
      setCountdown(null);
    }, 420);
    return () => window.clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (confirmExitOpen || helpOpen) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      pausedAccumMsRef.current += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [confirmExitOpen, helpOpen]);

  useEffect(() => {
    if (isPaused || finishRequested) return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setFinishRequested(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused, finishRequested]);

  const handleDismissTutorial = () => {
    sound.tap();
    setTutorialSlug(null);
    setCountdown(3);
  };

  const handleWaveHit = useCallback((): boolean => {
    if (finishedRef.current) return true;
    const { next, matchCleared } = advanceWaveHit(waveRef.current);
    waveRef.current = next;
    setWave(next);
    return matchCleared;
  }, []);

  const handleWaveError = useCallback(() => {
    // Fluxo contínuo: sem pausa e sem retrocesso
  }, []);

  const handleFinish = useCallback(
    (perf: RawGamePerformance) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const curWave = waveRef.current;
      const activeElapsedMs = Math.max(
        0,
        performance.now() - matchStartMsRef.current - pausedAccumMsRef.current
      );
      const remainingMs = curWave.isCleared
        ? Math.max(0, Math.round(totalDurationMs - activeElapsedMs))
        : 0;

      const evaluated = evaluateSession({
        domain: game.domain,
        gameSlug: slug,
        mode,
        baseStage: stage,
        config: effectiveConfig,
        wave: curWave,
        timeRemainingMs: remainingMs,
        totalDurationMs,
        perf,
        weakestTwoDomains: weakestTwo,
        ageBracket,
      });

      setResult(evaluated);
      if (evaluated.completedEarly || evaluated.stageCleared) sound.stageClear();
      else sound.stageFail();
      void onComplete(evaluated);
    },
    [game.domain, slug, mode, stage, effectiveConfig, totalDurationMs, weakestTwo, ageBracket, onComplete]
  );

  const handleBackClick = () => {
    if (mode === 'calibration' && !result && !showTutorial) {
      setConfirmExitOpen(true);
      return;
    }
    onExit();
  };

  const handleSandboxFeedback = (patch: Partial<SandboxFeedback>) => {
    const next: SandboxFeedback = { ...sandboxFb, ...patch };
    setSandboxFb(next);
    if (result) {
      updateLatestCalibrationFeedback(slug, result.stagePlayed, next);
      setSandboxFbSaved(true);
    }
  };

  const handleReplay = () => {
    if (!result) return;
    setTutorialSlug(null);
    setShowWorkoutComplete(false);
    setCountdown(3);
    setPlayRun((r) => r + 1);
    if (sandboxMode) {
      onPlayNext(stage, false);
    } else {
      onPlayNext(result.nextStage, result.adaptiveStatus === 'ease_mode');
    }
  };

  const timePct = Math.max(0, (timeLeft / totalDurationSec) * 100);
  const progressPct = getWaveBarPct(wave);
  const savedSecondsStr = result ? (result.timeRemainingMs / 1000).toFixed(1) : '0.0';

  // Comparativos estilo Impulse (vs. tentativa anterior e evolução do domínio)
  const deltaVsPrevPct =
    result && previousRef?.previousIndexPct !== null && previousRef?.previousIndexPct !== undefined
      ? result.performanceIndex - previousRef.previousIndexPct
      : null;

  const rtDeltaVsPrevMs =
    result &&
    result.rtMeanMs > 0 &&
    previousRef?.previousRtMs !== null &&
    previousRef?.previousRtMs !== undefined &&
    previousRef.previousRtMs > 0
      ? result.rtMeanMs - previousRef.previousRtMs
      : null;

  const isNewRecord = Boolean(
    result &&
      previousRef &&
      previousRef.totalPlaysBefore > 0 &&
      result.performanceIndex > previousRef.bestIndexPct
  );

  const domainBeforePct = previousRef?.domainScoreBeforePct ?? 0;
  const isFirstDomainMeasurement = domainBeforePct === 0;
  const domainDeltaPct = result
    ? isFirstDomainMeasurement
      ? result.performanceIndex
      : Number((result.domainDelta / 10).toFixed(1))
    : 0;
  const domainAfterPct = result
    ? isFirstDomainMeasurement
      ? result.performanceIndex
      : Math.max(8, Math.min(100, Math.round(domainBeforePct + domainDeltaPct)))
    : domainBeforePct;

  const resultHeadline = !result
    ? ''
    : isNewRecord
      ? 'Novo recorde pessoal'
      : result.performanceIndex >= 80
        ? 'Excelente desempenho'
        : deltaVsPrevPct !== null && deltaVsPrevPct > 0
          ? 'Evolução confirmada'
          : 'Exercício concluído';

  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[480px] min-h-screen flex flex-col relative sm:border-x sm:shadow-xl"
        style={{
          background: 'var(--bg-elev)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Faixa superior da Área de Testes (Sandbox ADM) */}
        {sandboxMode && (
          <div
            className="px-5 py-2 flex items-center justify-between gap-2 text-xs font-bold"
            style={{
              background: 'rgba(139, 92, 246, 0.12)',
              borderBottom: '1px solid rgba(139, 92, 246, 0.25)',
              color: '#7C3AED',
            }}
          >
            <span className="truncate">Sandbox · Nível {stage}</span>
            <span className="font-semibold opacity-90 truncate">
              {appliedTuning && isLabTuningModified(slug, stage, appliedTuning)
                ? formatTuningShort(appliedTuning)
                : 'Padrão · Só grava no Log'}
            </span>
          </div>
        )}

        {/* Faixa superior da Avaliação Inicial */}
        {calibrationInfo && (
          <div
            className="px-5 py-2.5 flex items-center justify-between text-xs font-semibold"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--accent)' }}>
              Avaliação {calibrationInfo.currentIndex}/{calibrationInfo.total} · {calibrationInfo.domainName}
            </span>
            <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(calibrationInfo.currentIndex / calibrationInfo.total) * 100}%`,
                  background: 'var(--accent-grad)',
                }}
              />
            </div>
          </div>
        )}

        {/* Barra regressiva do cronômetro */}
        <div className="h-1.5 w-full" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full transition-all duration-1000 linear"
            style={{
              width: `${timePct}%`,
              background: timeLeft <= 7 ? 'var(--err)' : 'var(--accent-grad)',
            }}
          />
        </div>

        {/* HUD Superior confortável */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}
        >
          <button
            type="button"
            onClick={handleBackClick}
            className="w-10 h-10 rounded-2xl flex items-center justify-center btn-soft cursor-pointer shrink-0"
            title="Sair"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center min-w-0 px-2">
            <div className="text-[16px] font-bold leading-tight truncate">{game.name}</div>
            <div className="text-xs font-medium truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Nível {stage} · {getStageShortBadge(slug, effectiveConfig)}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!showTutorial && !result && (
              <button
                type="button"
                onClick={() => {
                  sound.tap();
                  setHelpOpen(true);
                }}
                className="w-10 h-10 rounded-2xl flex items-center justify-center btn-soft cursor-pointer"
                style={{ color: 'var(--accent)' }}
                title="Ajuda · Como fazer este exercício"
                aria-label="Ajuda"
              >
                <HelpCircle size={20} />
              </button>
            )}

            <div
              className="min-w-[58px] text-center px-3 py-2 rounded-2xl font-extrabold text-[15px] tabular"
              style={{
                background: timeLeft <= 7 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-subtle)',
                color: timeLeft <= 7 ? 'var(--err)' : 'var(--text)',
              }}
            >
              {timeLeft}s
            </div>
          </div>
        </div>

        {/* HUD Contínuo (barra única 0 -> 16) */}
        {!result && !showTutorial && (
          <div className="px-5 pt-3.5 pb-1 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold tabular">
              <span style={{ color: 'var(--text-muted)' }}>
                Progresso{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {wave.totalHits}/{wave.totalTargetHits}
                </strong>
              </span>

              <span style={{ color: live.accuracyPct >= 80 ? 'var(--ok)' : 'var(--warn)' }}>
                Precisão {live.accuracyPct}%
              </span>
            </div>

            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${progressPct}%`,
                  background: wave.isCleared ? 'var(--ok)' : 'var(--accent-grad)',
                }}
              />
            </div>
          </div>
        )}

        {/* Tutorial, Contagem Inicial (3, 2, 1, Vai!), Exercício Contínuo ou Pós-Exercício Impulse */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-5 relative">
          {showTutorial ? (
            <GameTutorial
              key={`tut-${slug}-${stage}`}
              slug={slug}
              config={effectiveConfig}
              onConfirm={handleDismissTutorial}
            />
          ) : isCountingDown ? (
            <div className="flex flex-col items-center justify-center gap-4 animate-pop">
              <div
                key={countdown}
                className="w-32 h-32 rounded-[28px] flex items-center justify-center font-extrabold animate-pop tabular"
                style={{
                  background: countdown === 0 ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-card)',
                  border: countdown === 0 ? '2px solid var(--ok)' : '1.5px solid var(--border-strong)',
                  color: countdown === 0 ? 'var(--ok)' : 'var(--accent)',
                  boxShadow: 'var(--card-shadow)',
                  fontSize: countdown === 0 ? '2.25rem' : '3.5rem',
                }}
              >
                {countdown === 0 ? 'Vai!' : countdown}
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                {countdown === 0 ? 'Fluxo contínuo' : 'Prepare-se'}
              </div>
            </div>
          ) : !result ? (
            <GameComponent
              key={`${slug}-${stage}-${easeBoost ? 'easy' : 'std'}-${playRun}`}
              config={effectiveConfig}
              wave={wave}
              finishRequested={finishRequested}
              paused={confirmExitOpen || helpOpen}
              onWaveHit={handleWaveHit}
              onWaveError={handleWaveError}
              onLiveUpdate={setLive}
              onFinish={handleFinish}
            />
          ) : showWorkoutComplete && workoutProgress ? (
            /* =================================================================
               RESUMO DE CONCLUSÃO DO TREINO DIÁRIO (CELEBRATIVO E SERENO)
               ================================================================= */
            <div className="w-full max-w-[420px] surface-card p-6 flex flex-col items-center text-center gap-5 animate-pop">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(16, 185, 129, 0.14)', color: 'var(--ok)' }}
              >
                <CheckCircle2 size={34} />
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ok)' }}>
                  Treino Diário Concluído
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight mt-1">
                  {workoutProgress.completedAfter}/{workoutProgress.total} exercícios finalizados
                </h2>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Consistência registrada. Seu Dossiê e sua evolução semanal foram atualizados.
                </p>
              </div>

              {/* Faixa semanal de consistência */}
              <div
                className="w-full rounded-2xl p-4 flex flex-col gap-3.5"
                style={{ background: 'var(--bg-subtle)' }}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Flame size={16} style={{ color: 'var(--warn)' }} />
                    <span>
                      {workoutProgress.streakDays}{' '}
                      {workoutProgress.streakDays === 1 ? 'dia consecutivo' : 'dias consecutivos'}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-soft)' }}>Esta semana</span>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {workoutProgress.weekDays.map((d) => {
                    const active = d.trained || d.isToday;
                    return (
                      <div key={d.dateIso} className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                          {d.shortLabel}
                        </span>
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: active ? 'var(--ok)' : 'var(--bg-card)',
                            color: active ? '#FFFFFF' : 'var(--text-soft)',
                            border: d.isToday ? '2px solid var(--ok)' : '1px solid transparent',
                            boxShadow: active ? '0 3px 10px rgba(16, 185, 129, 0.28)' : 'none',
                          }}
                        >
                          {active ? <Check size={16} strokeWidth={3} /> : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={onExit}
                className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer"
              >
                Concluir
              </button>
            </div>
          ) : (
            /* =================================================================
               TELA PÓS-EXERCÍCIO ESTILO IMPULSE (REFINADA E LEGÍVEL)
               ================================================================= */
            <div className="w-full max-w-[420px] surface-card p-6 flex flex-col gap-5 animate-pop">
              {/* Reforço objetivo + selo de recorde ou status */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: isNewRecord
                      ? 'rgba(245, 158, 11, 0.16)'
                      : result.completedEarly
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'var(--bg-subtle)',
                    color: isNewRecord
                      ? 'var(--warn)'
                      : result.completedEarly
                        ? 'var(--ok)'
                        : 'var(--text-muted)',
                  }}
                >
                  {isNewRecord ? (
                    <Award size={14} />
                  ) : result.completedEarly ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Timer size={14} />
                  )}
                  <span>{resultHeadline}</span>
                </span>

                <span className="text-xs font-semibold tabular" style={{ color: 'var(--text-soft)' }}>
                  {wave.totalHits}/{wave.totalTargetHits} acertos
                </span>
              </div>

              {/* Índice principal + comparação direta vs. última tentativa */}
              <div className="text-center py-1">
                <div className="text-xs font-bold tracking-wide" style={{ color: domainMeta.color }}>
                  {game.name} · {domainMeta.name}
                </div>

                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="text-5xl font-extrabold tabular tracking-tight leading-none">
                    {result.performanceIndex}%
                  </span>

                  {deltaVsPrevPct !== null && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tabular"
                      style={{
                        background:
                          deltaVsPrevPct >= 0
                            ? 'rgba(16, 185, 129, 0.14)'
                            : 'rgba(239, 68, 68, 0.12)',
                        color: deltaVsPrevPct >= 0 ? 'var(--ok)' : 'var(--err)',
                      }}
                    >
                      {deltaVsPrevPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      <span>
                        {deltaVsPrevPct >= 0 ? `+${deltaVsPrevPct}%` : `${deltaVsPrevPct}%`}
                      </span>
                    </span>
                  )}
                </div>

                <div className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  {deltaVsPrevPct !== null ? (
                    <>
                      Você vs. última vez ({previousRef?.previousIndexPct}%) · Recorde{' '}
                      <strong style={{ color: 'var(--text)' }}>
                        {Math.max(previousRef?.bestIndexPct ?? 0, result.performanceIndex)}%
                      </strong>
                    </>
                  ) : (
                    <span>Linha de base pessoal registrada neste exercício</span>
                  )}
                </div>

                <div className="text-xs mt-1.5" style={{ color: 'var(--text-soft)' }}>
                  No <strong style={{ color: 'var(--text-muted)' }}>Nível {result.stagePlayed}</strong> deste exercício: superou{' '}
                  <strong style={{ color: 'var(--text)' }}>{result.percentile}%</strong> ({ageLabel})
                </div>
              </div>

              {/* Alerta automático no Log de Calibração (visível para o ADM de referência) */}
              {isAdminSession && (() => {
                const calAlerts = evaluateCalibrationAlerts(result);
                if (calAlerts.length === 0) return null;
                return (
                  <div
                    className="rounded-2xl px-3.5 py-3 flex items-start gap-2.5 text-left"
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.34)',
                    }}
                  >
                    <AlertTriangle size={16} style={{ color: 'var(--warn)' }} className="shrink-0 mt-0.5" />
                    <div className="min-w-0 text-xs leading-relaxed">
                      <div className="font-bold" style={{ color: 'var(--warn)' }}>
                        Alerta salvo no Log de Calibração (ADM)
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {calAlerts.map((a) => a.label).join(' · ')}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Barra de evolução do Domínio (normal) OU Telemetria + Feedback Rápido (Sandbox ADM) */}
              {sandboxMode ? (
                <div className="flex flex-col gap-3">
                  <div
                    className="rounded-2xl p-4 flex flex-col gap-2 text-xs"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span style={{ color: '#7C3AED' }}>Telemetria · Nível {result.stagePlayed}</span>
                      <span className="tabular" style={{ color: 'var(--text-muted)' }}>
                        Bruto {result.rawLevelScore ?? result.score}/1000
                      </span>
                    </div>
                    <div className="flex items-center justify-between tabular" style={{ color: 'var(--text-muted)' }}>
                      <span>RT-alvo: <strong style={{ color: 'var(--text)' }}>{result.targetRtMs ?? '—'} ms</strong></span>
                      <span>Sobra: <strong style={{ color: 'var(--ok)' }}>{savedSecondsStr}s</strong></span>
                    </div>
                  </div>

                  {/* 3 barras reais de calibração (Dificuldade, Velocidade e Meta) */}
                  {labTuning && onLabTuningChange && onLabTuningReset && (
                    <LabTuningPanel
                      slug={slug}
                      stage={stage}
                      tuning={labTuning}
                      onChange={onLabTuningChange}
                      onReset={onLabTuningReset}
                      plateauAttempts={plateauAttempts}
                      onResetPlateauAttempts={onResetPlateauAttempts}
                      compact
                    />
                  )}

                  {/* Barrinha opcional (só mexe se achar que o nível não está certo) + Observação */}
                  <div
                    className="rounded-2xl p-4 flex flex-col gap-3 text-left"
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-strong)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold" style={{ color: 'var(--accent)' }}>
                        Ajuste de Nível (opcional · Nv.{result.stagePlayed})
                      </span>
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: sandboxFbSaved ? 'var(--ok)' : 'var(--text-soft)' }}
                      >
                        {sandboxFbSaved ? '✓ Salvo' : 'Opcional'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                          Se não estiver no nível certo:
                        </span>
                        <strong className="text-right" style={{ color: 'var(--text)' }}>
                          {sandboxFb.difficulty
                            ? `${DIFFICULTY_LABELS[sandboxFb.difficulty]} (${sandboxFb.difficulty}/5)`
                            : 'Não marcado'}
                        </strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={sandboxFb.difficulty ?? 3}
                        onChange={(e) => {
                          sound.tap();
                          handleSandboxFeedback({
                            difficulty: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                          });
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                        className="w-full cursor-pointer"
                      />
                      <div className="grid grid-cols-5 gap-1">
                        {([1, 2, 3, 4, 5] as const).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => {
                              sound.tap();
                              handleSandboxFeedback({ difficulty: lvl });
                            }}
                            className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                              sandboxFb.difficulty === lvl ? 'btn-accent' : 'btn-soft'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-soft)' }}>
                        <span>1 · Muito fácil</span>
                        <span>3 · Ideal</span>
                        <span>5 · Pesado demais</span>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Observação opcional sobre este nível..."
                      value={sandboxFb.note ?? ''}
                      onChange={(e) => handleSandboxFeedback({ note: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-2xl p-4 flex flex-col gap-2.5"
                  style={{ background: 'var(--bg-subtle)' }}
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: domainMeta.color }} />
                      <span>{domainMeta.name}</span>
                    </span>
                    <span className="tabular flex items-center gap-1.5">
                      <span style={{ color: 'var(--text-soft)' }}>{domainBeforePct}% →</span>
                      <strong style={{ color: 'var(--text)' }}>{domainAfterPct}%</strong>
                      <span
                        className="text-xs font-bold"
                        style={{ color: domainDeltaPct >= 0 ? 'var(--ok)' : 'var(--err)' }}
                      >
                        {isFirstDomainMeasurement
                          ? '1ª medição'
                          : domainDeltaPct >= 0
                            ? `+${domainDeltaPct}%`
                            : `${domainDeltaPct}%`}
                      </span>
                    </span>
                  </div>

                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${domainAfterPct}%`, background: domainMeta.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>
                      {result.stageCleared
                        ? `Nível ${result.nextStage} pronto na próxima sessão`
                        : result.adaptiveStatus === 'step_down'
                          ? `Calibrado para Nível ${result.nextStage}`
                          : `Nível atual: ${result.nextStage}`}
                    </span>
                    <span className="tabular font-semibold" style={{ color: 'var(--text-soft)' }}>
                      Nv.{result.stagePlayed} · Top {Math.max(1, Math.round(100 - result.percentile))}%
                    </span>
                  </div>
                </div>
              )}

              {/* Precisão e Velocidade lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                    Precisão
                  </div>
                  <div className="text-2xl font-extrabold tabular mt-1" style={{ color: 'var(--ok)' }}>
                    {result.accuracyPct}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {result.completedEarly && result.timeRemainingMs > 0
                      ? `${savedSecondsStr}s de margem`
                      : 'Meta: ≥80%'}
                  </div>
                </div>

                <div className="rounded-2xl p-4" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="text-xs font-semibold" style={{ color: 'var(--text-soft)' }}>
                    Reação média
                  </div>
                  <div className="text-2xl font-extrabold tabular mt-1">
                    {result.rtMeanMs > 0 ? `${result.rtMeanMs} ms` : '—'}
                  </div>
                  <div
                    className="text-xs font-semibold tabular mt-1"
                    style={{
                      color:
                        rtDeltaVsPrevMs === null
                          ? 'var(--text-muted)'
                          : rtDeltaVsPrevMs <= 0
                            ? 'var(--ok)'
                            : 'var(--warn)',
                    }}
                  >
                    {rtDeltaVsPrevMs === null
                      ? 'Média da sessão'
                      : rtDeltaVsPrevMs <= 0
                        ? `${rtDeltaVsPrevMs} ms mais rápido`
                        : `+${rtDeltaVsPrevMs} ms vs. ant.`}
                  </div>
                </div>
              </div>

              {/* Botões generosos no padrão Impulse (ou atalhos de calibração no Sandbox) */}
              <div className="flex flex-col gap-2.5 pt-1">
                {sandboxMode && onTestMaxLevel ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={onTestMaxLevel}
                      className="min-h-[52px] py-3.5 px-3 rounded-2xl font-bold text-sm btn-accent flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{sandboxJumpLabel}</span>
                      <ArrowRight size={16} />
                    </button>
                    {onNextChallenge && nextChallengeLabel ? (
                      <button
                        type="button"
                        onClick={onNextChallenge}
                        className="min-h-[52px] py-3.5 px-3 rounded-2xl font-bold text-sm btn-soft flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Nível {stage + 1}</span>
                        <ArrowRight size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : workoutProgress?.isLastOfWorkout ? (
                  <button
                    type="button"
                    onClick={() => setShowWorkoutComplete(true)}
                    className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Ver Resumo do Dia</span>
                    <ArrowRight size={18} />
                  </button>
                ) : onNextChallenge && nextChallengeLabel ? (
                  <button
                    type="button"
                    onClick={onNextChallenge}
                    className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{nextChallengeLabel}</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onExit}
                    className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continuar</span>
                    <ArrowRight size={18} />
                  </button>
                )}

                {mode !== 'calibration' && (
                  <button
                    type="button"
                    onClick={handleReplay}
                    className={`w-full min-h-[48px] py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer ${
                      hasPendingTuningChange ? 'font-bold btn-accent' : 'font-semibold btn-soft'
                    }`}
                  >
                    <RotateCcw size={16} />
                    <span>
                      {sandboxMode
                        ? hasPendingTuningChange
                          ? `Testar Nível ${stage} com novo ajuste`
                          : `Repetir Nível ${stage}`
                        : result.stageCleared
                          ? `Jogar novamente (Nível ${result.nextStage})`
                          : `Tentar novamente (Nível ${result.nextStage})`}
                    </span>
                  </button>
                )}

                {(onNextChallenge || workoutProgress?.isLastOfWorkout) && mode !== 'calibration' && (
                  <button
                    type="button"
                    onClick={onExit}
                    className="mx-auto py-2 px-4 text-xs font-semibold cursor-pointer"
                    style={{ color: 'var(--text-soft)' }}
                  >
                    {sandboxMode ? 'Voltar à Área de Testes' : 'Voltar ao início'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Ajuda (?): pausa o exercício e mostra a instrução animada */}
        {helpOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-5 backdrop-blur-sm"
            style={{ background: 'var(--overlay)' }}
            onClick={() => setHelpOpen(false)}
          >
            <div className="w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
              <GameTutorial
                slug={slug}
                config={effectiveConfig}
                confirmLabel="Voltar ao exercício"
                onConfirm={() => {
                  sound.tap();
                  setHelpOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Modal de confirmação de saída durante a Avaliação Inicial */}
        {confirmExitOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-5 backdrop-blur-sm"
            style={{ background: 'var(--overlay)' }}
          >
            <div className="w-full max-w-[360px] surface-card p-6 flex flex-col gap-4 animate-pop text-center">
              <div className="text-lg font-extrabold">Interromper avaliação inicial?</div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Se sair agora, o progresso desta etapa não será registrado.
              </p>
              <button
                type="button"
                onClick={() => setConfirmExitOpen(false)}
                className="w-full min-h-[50px] py-3.5 rounded-2xl font-bold text-sm btn-accent cursor-pointer"
              >
                Continuar avaliação
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmExitOpen(false);
                  onExit();
                }}
                className="w-full min-h-[48px] py-3 rounded-2xl font-semibold text-sm btn-soft cursor-pointer"
              >
                Sair agora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

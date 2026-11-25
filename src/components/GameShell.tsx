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
  MessageSquarePlus,
  RotateCcw,
  Send,
  Timer,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AgeBracket,
  CognitiveSessionRecord,
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
import { getIntensityLabel, getStageReachPercent } from '../engine/adaptiveEngine';
import {
  advanceWaveHit,
  createWaveState,
  getWaveBarPct,
  getWaveEffectiveConfig,
  regressWaveError,
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
import { SessionEvolutionChart } from './StatsCharts';
import { addFeedbackNote } from '../lib/feedbackNotes';
import { recordInteractionTelemetry } from '../lib/telemetryService';
import { generateAdaptiveCoachInsight, type AdaptiveCoachInsight } from '../lib/aiCoachService';

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
  userId?: string;
  sendRemoteTelemetry?: boolean;
  isAdminSession?: boolean;
  sandboxMode?: boolean;
  weakestTwo: DomainKey[];
  previousRef?: PreviousExerciseReference;
  gameSessions?: CognitiveSessionRecord[];
  /** Falso enquanto o ranking da idade ainda está "calibrando" */
  rankingReady?: boolean;
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
  theme,
  ageBracket = '25-34',
  userId = 'local-anon',
  sendRemoteTelemetry = false,
  isAdminSession = false,
  sandboxMode = false,
  weakestTwo,
  previousRef,
  gameSessions = [],
  rankingReady = true,
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

  const [wave, setWave] = useState<WaveState>(() =>
    createWaveState(stage, slug, labTuning, { calibration: mode === 'calibration' })
  );
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
  const [coachInsight, setCoachInsight] = useState<AdaptiveCoachInsight | null>(null);
  const [endFreeze, setEndFreeze] = useState<'time_up' | 'cleared' | null>(null);
  const [showWorkoutComplete, setShowWorkoutComplete] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sandboxFb, setSandboxFb] = useState<SandboxFeedback>({
    note: '',
  });
  const [sandboxFbSaved, setSandboxFbSaved] = useState(false);
  const [resultChartTab, setResultChartTab] = useState<'ranking' | 'evolution'>(() => {
    try {
      const saved = window.localStorage.getItem('neurolab_result_chart_tab_v1');
      return saved === 'evolution' ? 'evolution' : 'ranking';
    } catch {
      return 'ranking';
    }
  });
  const [muted, setMuted] = useState<boolean>(() => sound.isMuted());
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSavedToast, setNoteSavedToast] = useState(false);

  const handleSelectResultChartTab = (tab: 'ranking' | 'evolution') => {
    sound.tap();
    setResultChartTab(tab);
    try {
      window.localStorage.setItem('neurolab_result_chart_tab_v1', tab);
    } catch {
      // ignore storage errors
    }
  };

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
  const helpOpensRef = useRef<number>(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const nextTuning = labTuningRef.current;
    setAppliedTuning(nextTuning);
    const freshWave = createWaveState(stage, slug, nextTuning, { calibration: mode === 'calibration' });
    waveRef.current = freshWave;
    setWave(freshWave);
    const dur = getWaveEffectiveConfig(slug, freshWave, easeBoost, nextTuning).durationSec;
    setTimeLeft(dur);
    setFinishRequested(false);
    setResult(null);
    setCoachInsight(null);
    setEndFreeze(null);
    setShowWorkoutComplete(false);
    setConfirmExitOpen(false);
    setHelpOpen(false);
    setSandboxFb({ note: '' });
    setSandboxFbSaved(false);
    setNoteOpen(false);
    setNoteDraft('');
    setNoteSavedToast(false);
    setLive({ score: 0, accuracyPct: 100, combo: 0 });
    matchStartMsRef.current = performance.now();
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    helpOpensRef.current = 0;
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
    // Teste inicial é sem relógio: termina quando a dificuldade estabiliza
    if (isPaused || finishRequested || mode === 'calibration') return;
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
  }, [isPaused, finishRequested, mode]);

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
    if (finishedRef.current) return;
    const { next } = regressWaveError(waveRef.current);
    waveRef.current = next;
    setWave(next);
    // Teste inicial: se o nível estabilizou num erro, encerra o jogo
    if (next.calibrationRun && next.isCleared) setFinishRequested(true);
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
        // Última partida deste jogo na MESMA fase (para a regra "2 partidas ruins seguidas = desce")
        previousSameStageAccuracyPct:
          gameSessions[0] && gameSessions[0].stage_played === stage
            ? Number(gameSessions[0].accuracy_pct)
            : null,
      });

      setResult(evaluated);
      setEndFreeze(evaluated.completedEarly ? 'cleared' : 'time_up');
      if (evaluated.completedEarly || evaluated.stageCleared) sound.stageClear();
      else sound.stageFail();

      if (!sandboxMode) {
        void generateAdaptiveCoachInsight(evaluated, ageBracket).then((insight) => {
          setCoachInsight(insight);
        });
      }

      if (!sandboxMode) {
        recordInteractionTelemetry(
          {
            userId,
            ageBracket,
            domain: game.domain,
            gameSlug: slug,
            mode,
            difficultyStart: stage,
            difficultyEnd: curWave.effectiveDifficulty,
            outcome: evaluated.completedEarly ? 'completed' : 'time_up',
            hits: evaluated.hits ?? curWave.totalHits,
            targetHits: evaluated.targetHits ?? curWave.totalTargetHits,
            commissionErrors: evaluated.commissionErrors,
            omissionErrors: evaluated.omissionErrors,
            accuracyPct: evaluated.accuracyPct,
            rtMeanMs: evaluated.rtMeanMs,
            elapsedMs: Math.round(activeElapsedMs),
            timeRemainingMs: remainingMs,
            helpOpens: helpOpensRef.current,
          },
          sendRemoteTelemetry
        );
      }

      void onComplete(evaluated);
      window.setTimeout(() => {
        setEndFreeze(null);
      }, 1250);
    },
    [game.domain, slug, mode, stage, effectiveConfig, totalDurationMs, weakestTwo, ageBracket, onComplete, sandboxMode, userId, sendRemoteTelemetry]
  );

  const recordAbandonIfNeeded = useCallback(() => {
    if (sandboxMode || finishedRef.current || result) return;
    finishedRef.current = true;
    const curWave = waveRef.current;
    const activeElapsedMs = showTutorial
      ? 0
      : Math.max(0, performance.now() - matchStartMsRef.current - pausedAccumMsRef.current);
    recordInteractionTelemetry(
      {
        userId,
        ageBracket,
        domain: game.domain,
        gameSlug: slug,
        mode,
        difficultyStart: stage,
        difficultyEnd: curWave.effectiveDifficulty,
        outcome: showTutorial ? 'abandoned_tutorial' : 'abandoned',
        hits: curWave.totalHits,
        targetHits: curWave.totalTargetHits,
        commissionErrors: 0,
        omissionErrors: 0,
        accuracyPct: live.accuracyPct,
        rtMeanMs: 0,
        elapsedMs: Math.round(activeElapsedMs),
        timeRemainingMs: Math.max(0, timeLeft * 1000),
        helpOpens: helpOpensRef.current,
      },
      sendRemoteTelemetry
    );
  }, [sandboxMode, result, showTutorial, userId, ageBracket, game.domain, slug, mode, stage, live.accuracyPct, timeLeft, sendRemoteTelemetry]);

  const handleBackClick = () => {
    if (mode === 'calibration' && !result && !showTutorial) {
      setConfirmExitOpen(true);
      return;
    }
    recordAbandonIfNeeded();
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

  const handleReplaySameStage = () => {
    if (!result) return;
    setTutorialSlug(null);
    setShowWorkoutComplete(false);
    setEndFreeze(null);
    setCountdown(3);
    setPlayRun((r) => r + 1);
    onPlayNext(stage, false);
  };

  const handlePlayNextStage = () => {
    if (!result) return;
    setTutorialSlug(null);
    setShowWorkoutComplete(false);
    setEndFreeze(null);
    setCountdown(3);
    setPlayRun((r) => r + 1);
    onPlayNext(result.nextStage, result.adaptiveStatus === 'ease_mode');
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
              width: mode === 'calibration' ? '100%' : `${timePct}%`,
              background: mode !== 'calibration' && timeLeft <= 7 ? 'var(--err)' : 'var(--accent-grad)',
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
            <div className="text-xs font-medium truncate mt-0.5 tabular" style={{ color: 'var(--text-muted)' }}>
              {sandboxMode
                ? `Nível ${stage} · ${getStageShortBadge(slug, effectiveConfig)}`
                : `${domainMeta.shortName} · ${getIntensityLabel(wave.effectiveDifficulty)}`}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setMuted(sound.toggleMute())}
              className="w-9 h-9 rounded-2xl flex items-center justify-center btn-soft cursor-pointer"
              style={{ color: muted ? 'var(--text-soft)' : 'var(--text-muted)' }}
              title={muted ? 'Ativar som' : 'Silenciar som'}
              aria-label={muted ? 'Ativar som' : 'Silenciar som'}
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>

            {!showTutorial && !result && (
              <button
                type="button"
                onClick={() => {
                  sound.tap();
                  helpOpensRef.current += 1;
                  setHelpOpen(true);
                }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center btn-soft cursor-pointer"
                style={{ color: 'var(--accent)' }}
                title="Ajuda · Como fazer este exercício"
                aria-label="Ajuda"
              >
                <HelpCircle size={19} />
              </button>
            )}

            <div
              className="min-w-[58px] text-center px-3 py-2 rounded-2xl font-extrabold text-[15px] tabular"
              style={{
                background: mode !== 'calibration' && timeLeft <= 7 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-subtle)',
                color: mode !== 'calibration' && timeLeft <= 7 ? 'var(--err)' : 'var(--text)',
              }}
              title={mode === 'calibration' ? 'Teste inicial: sem tempo' : undefined}
            >
              {mode === 'calibration' ? 'Livre' : `${timeLeft}s`}
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
        <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-5 py-3.5 relative">
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
          ) : endFreeze ? (
            /* =================================================================
               TRAVA ANTI-CLIQUE ACIDENTAL (1,25s COM RELÓGIO ANTES DO RESULTADO)
               ================================================================= */
            <div className="w-full max-w-[360px] surface-card p-8 flex flex-col items-center text-center gap-4 animate-pop">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{
                  background:
                    endFreeze === 'cleared'
                      ? 'rgba(16, 185, 129, 0.16)'
                      : 'rgba(245, 158, 11, 0.16)',
                  color: endFreeze === 'cleared' ? 'var(--ok)' : 'var(--warn)',
                }}
              >
                {endFreeze === 'cleared' ? <CheckCircle2 size={40} /> : <Timer size={40} />}
              </div>
              <div className="text-2xl font-extrabold tracking-tight">
                {endFreeze === 'cleared' ? 'Fase concluída!' : 'Tempo esgotado!'}
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                Calculando sua posição no ranking...
              </p>
            </div>
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
               NOVA TELA DE CONCLUSÃO — OPÇÃO 1: CURVA DE SUPERAÇÃO
               ================================================================= */
            (() => {
              const beatsPct = Math.max(1, Math.min(99, Math.round(result.percentile)));
              const topPct = Math.max(1, 100 - beatsPct);
              // Durante o teste inicial o ranking da idade fica "calibrando" (só aparece no Dossiê ao final)
              const showRanking = mode !== 'calibration' && rankingReady;
              const effectiveChartTab = showRanking ? resultChartTab : 'evolution';
              const passedStage = result.stageCleared;
              const nextStageUnlocked = passedStage && result.nextStage > result.stagePlayed;
              const curveX = 14 + (beatsPct / 100) * 272;
              const z = (beatsPct - 50) / 22;
              const curveY = 98 - Math.exp(-0.5 * z * z) * 82;
              const clampedTagX = Math.max(40, Math.min(260, curveX));

              return (
                <div className="w-full max-w-[420px] surface-card p-6 flex flex-col gap-5 animate-pop">
                  {/* Banner claro de APROVADO / PASSOU DE FASE ou NÃO PASSOU */}
                  <div
                    className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                    style={{
                      background: passedStage
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'rgba(239, 68, 68, 0.12)',
                      border: passedStage
                        ? '1.5px solid rgba(16, 185, 129, 0.35)'
                        : '1.5px solid rgba(239, 68, 68, 0.30)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm"
                        style={{
                          background: passedStage ? 'var(--ok)' : 'var(--err)',
                          color: '#FFFFFF',
                        }}
                      >
                        {passedStage ? <Check size={17} strokeWidth={3} /> : '✕'}
                      </span>
                      <div className="min-w-0">
                        <div
                          className="text-sm font-extrabold leading-tight truncate"
                          style={{ color: passedStage ? 'var(--ok)' : 'var(--accent)' }}
                        >
                          {sandboxMode
                            ? nextStageUnlocked
                              ? `Passou! Nível ${result.nextStage} liberado`
                              : passedStage
                                ? 'Fase aprovada!'
                                : 'Não passou desta vez'
                            : resultHeadline}
                        </div>
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                          {sandboxMode
                            ? `${game.name} · Nível ${result.stagePlayed}`
                            : `${game.name} · ${getIntensityLabel(result.equilibriumIndex ?? result.stagePlayed)}`}
                        </div>
                      </div>
                    </div>

                    {isNewRecord && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0"
                        style={{ background: 'rgba(245, 158, 11, 0.18)', color: 'var(--warn)' }}
                      >
                        <Award size={12} />
                        Recorde
                      </span>
                    )}
                  </div>

                  {/* Quantas pessoas da idade chegam a esta fase (estimativa normativa) */}
                  {!sandboxMode && (() => {
                    const shownStage = nextStageUnlocked ? result.nextStage : result.stagePlayed;
                    const reachPct = getStageReachPercent(shownStage, ageBracket, game.domain);
                    // Só mostra quando a fase está entre as 20% melhores da idade
                    if (reachPct > 20) return null;
                    return (
                      <div
                        className="rounded-2xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2"
                        style={{
                          background: nextStageUnlocked ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-subtle)',
                          color: nextStageUnlocked ? 'var(--ok)' : 'var(--text-muted)',
                        }}
                      >
                        <Award size={14} className="shrink-0" />
                        <span>
                          {nextStageUnlocked
                            ? `Fase ${shownStage} liberada! Apenas ${reachPct}% das pessoas de ${ageLabel} chegam até ela.`
                            : `Fase ${shownStage}: apenas ${reachPct}% das pessoas de ${ageLabel} chegam até aqui.`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Hero principal: Foco total na superação dos indivíduos */}
                  <div className="text-center py-1">
                    <div
                      className="text-xs font-extrabold uppercase tracking-widest"
                      style={{ color: 'var(--text-soft)' }}
                    >
                      {showRanking ? 'Você superou' : mode === 'calibration' ? 'Teste inicial' : 'Ranking da idade'}
                    </div>

                    <div
                      className={`${showRanking ? 'text-6xl' : 'text-4xl'} font-extrabold tabular tracking-tight leading-none mt-2`}
                      style={{
                        background: 'var(--accent-grad)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {showRanking ? `${beatsPct}%` : 'Calibrando…'}
                    </div>

                    <div className="text-[15px] font-bold mt-2" style={{ color: 'var(--text)' }}>
                      {showRanking
                        ? `das pessoas da sua faixa etária (${ageLabel})`
                        : `Sua posição na faixa ${ageLabel} aparece ao terminar o teste inicial (ou após 2 partidas de cada habilidade)`}
                    </div>

                    {!sandboxMode && coachInsight && (
                      <div
                        className="mt-3 rounded-2xl p-3.5 text-left flex flex-col gap-2"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                          <span style={{ color: 'var(--accent)' }}>
                            {coachInsight.source === 'gemini' ? 'Análise IA' : 'Resumo do desempenho'}
                          </span>
                          <span className="tabular" style={{ color: 'var(--text-soft)' }}>
                            Precisão {result.accuracyPct}%
                            {result.rtMeanMs > 0
                              ? ` · ${
                                  result.rtMeanMs >= 1000
                                    ? `${(result.rtMeanMs / 1000).toFixed(1)}s`
                                    : `${Math.round(result.rtMeanMs)}ms`
                                }`
                              : ''}
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                            style={{
                              background:
                                coachInsight.nextTrend === 'harder'
                                  ? 'rgba(16, 185, 129, 0.14)'
                                  : coachInsight.nextTrend === 'easier'
                                    ? 'rgba(245, 158, 11, 0.16)'
                                    : 'var(--bg-card)',
                              color:
                                coachInsight.nextTrend === 'harder'
                                  ? 'var(--ok)'
                                  : coachInsight.nextTrend === 'easier'
                                    ? 'var(--warn)'
                                    : 'var(--text-muted)',
                            }}
                          >
                            {coachInsight.nextTrend === 'harder' ? (
                              <TrendingUp size={12} />
                            ) : coachInsight.nextTrend === 'easier' ? (
                              <TrendingDown size={12} />
                            ) : (
                              <ArrowRight size={12} />
                            )}
                            <span>{coachInsight.nextTrendLabel}</span>
                          </span>
                        </div>

                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          {coachInsight.text}
                        </p>
                      </div>
                    )}

                    <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-soft)' }}>
                      {!showRanking
                        ? `Precisão ${result.accuracyPct}% registrada nesta habilidade`
                        : beatsPct >= 50
                          ? `Entre os Top ${topPct}% da faixa ${ageLabel}`
                          : `Continue treinando para subir no ranking (${ageLabel})`}
                    </div>

                    {deltaVsPrevPct !== null && deltaVsPrevPct !== 0 && (
                      <div className="mt-2.5 flex justify-center">
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold tabular"
                          style={{
                            background:
                              deltaVsPrevPct > 0
                                ? 'rgba(16, 185, 129, 0.14)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color: deltaVsPrevPct > 0 ? 'var(--ok)' : 'var(--err)',
                          }}
                        >
                          {deltaVsPrevPct > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          <span>
                            {deltaVsPrevPct > 0
                              ? `+${deltaVsPrevPct}% melhor que sua última vez`
                              : `${deltaVsPrevPct}% vs. sua última vez`}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Abas do gráfico: Ranking da idade | Minha evolução neste jogo */}
                  <div className="flex flex-col gap-2">
                    <div
                      className="grid grid-cols-2 gap-1 p-1 rounded-xl"
                      style={{ background: 'var(--bg-subtle)', display: showRanking ? undefined : 'none' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectResultChartTab('ranking')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          resultChartTab === 'ranking' ? 'btn-accent' : ''
                        }`}
                        style={
                          resultChartTab === 'ranking' ? undefined : { color: 'var(--text-muted)' }
                        }
                      >
                        Ranking da idade
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectResultChartTab('evolution')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          resultChartTab === 'evolution' ? 'btn-accent' : ''
                        }`}
                        style={
                          resultChartTab === 'evolution' ? undefined : { color: 'var(--text-muted)' }
                        }
                      >
                        Minha evolução
                      </button>
                    </div>

                    {effectiveChartTab === 'ranking' ? (
                      <div className="rounded-2xl px-3.5 pt-3.5 pb-2.5" style={{ background: 'var(--bg-subtle)' }}>
                        <svg viewBox="0 0 300 112" className="w-full h-[108px] block overflow-visible">
                          <defs>
                            <linearGradient id="neuroCurveGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#4F6EF7" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="#4F6EF7" stopOpacity="0.72" />
                            </linearGradient>
                            <clipPath id="neuroCurveClip">
                              <rect x="0" y="0" width={curveX} height="112" />
                            </clipPath>
                          </defs>
                          <path
                            d="M 8 98 C 45 97, 72 86, 102 52 C 122 28, 136 16, 150 16 C 164 16, 178 28, 198 52 C 228 86, 255 97, 292 98 L 292 102 L 8 102 Z"
                            fill="var(--border)"
                            opacity="0.7"
                          />
                          <path
                            d="M 8 98 C 45 97, 72 86, 102 52 C 122 28, 136 16, 150 16 C 164 16, 178 28, 198 52 C 228 86, 255 97, 292 98 L 292 102 L 8 102 Z"
                            fill="url(#neuroCurveGrad)"
                            clipPath="url(#neuroCurveClip)"
                          />
                          <path
                            d="M 8 98 C 45 97, 72 86, 102 52 C 122 28, 136 16, 150 16 C 164 16, 178 28, 198 52 C 228 86, 255 97, 292 98"
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <line
                            x1={curveX}
                            y1="22"
                            x2={curveX}
                            y2="100"
                            stroke="var(--ok)"
                            strokeWidth="2"
                            strokeDasharray="3 3"
                          />
                          <circle cx={curveX} cy={curveY} r="6" fill="var(--ok)" stroke="#FFFFFF" strokeWidth="2.5" />
                          <g transform={`translate(${clampedTagX}, 14)`}>
                            <rect x="-30" y="-11" width="60" height="20" rx="10" fill="var(--ok)" />
                            <text
                              x="0"
                              y="2.5"
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize="10"
                              fontWeight="800"
                            >
                              VOCÊ
                            </text>
                          </g>
                        </svg>
                        <div
                          className="flex items-center justify-between text-[11px] font-bold mt-1 px-0.5"
                          style={{ color: 'var(--text-soft)' }}
                        >
                          <span>Início</span>
                          <span>Média (50%)</span>
                          <span>Topo (99%)</span>
                        </div>
                      </div>
                    ) : (
                      <SessionEvolutionChart
                        sessions={gameSessions}
                        color={domainMeta.color}
                        title={`Evolução · ${game.name}`}
                        theme={theme}
                        height={122}
                        emptyText="Sua evolução neste jogo começa a aparecer aqui."
                      />
                    )}
                  </div>

                  {/* Alerta automático no Log de Calibração (apenas ADM) */}
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

                  {/* Evolução do Domínio (normal) OU Telemetria (Sandbox ADM) */}
                  {sandboxMode ? (
                    <div className="flex flex-col gap-3">
                      <div
                        className="rounded-2xl p-4 flex flex-col gap-2 text-xs"
                        style={{ background: 'var(--bg-subtle)' }}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span style={{ color: '#7C3AED' }}>Telemetria · Nível {result.stagePlayed}</span>
                          <span className="tabular" style={{ color: 'var(--text-muted)' }}>
                            Precisão {result.accuracyPct}% · RT {result.rtMeanMs}ms
                          </span>
                        </div>
                        <div className="flex items-center justify-between tabular" style={{ color: 'var(--text-muted)' }}>
                          <span>RT-alvo: <strong style={{ color: 'var(--text)' }}>{result.targetRtMs ?? '—'} ms</strong></span>
                          <span>Sobra: <strong style={{ color: 'var(--ok)' }}>{savedSecondsStr}s</strong></span>
                        </div>
                      </div>

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
                      className="rounded-2xl p-3.5 flex flex-col gap-2"
                      style={{ background: 'var(--bg-subtle)' }}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: domainMeta.color }} />
                          <span>{domainMeta.name}</span>
                        </span>
                        <span className="tabular flex items-center gap-1.5">
                          <span style={{ color: 'var(--text-soft)' }}>{domainBeforePct}% →</span>
                          <strong style={{ color: 'var(--text)' }}>{domainAfterPct}%</strong>
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${domainAfterPct}%`, background: domainMeta.color }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Botão discreto para anotar feedback / melhoria sobre este exercício */}
                  {!sandboxMode && (
                    <div className="flex flex-col gap-2">
                      {!noteOpen ? (
                        <button
                          type="button"
                          onClick={() => {
                            sound.tap();
                            setNoteOpen(true);
                            setNoteSavedToast(false);
                          }}
                          className="w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          style={{
                            background: 'var(--bg-subtle)',
                            color: noteSavedToast ? 'var(--ok)' : 'var(--text-muted)',
                            border: '1px dashed var(--border-strong)',
                          }}
                        >
                          <MessageSquarePlus size={14} />
                          <span>
                            {noteSavedToast
                              ? '✓ Anotação salva! Tocar para adicionar outra'
                              : 'Anotar melhoria ou feedback sobre este exercício'}
                          </span>
                        </button>
                      ) : (
                        <div
                          className="rounded-2xl p-3 flex flex-col gap-2 animate-pop"
                          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)' }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span style={{ color: 'var(--accent)' }}>Anotação · {game.name}</span>
                            <button
                              type="button"
                              onClick={() => setNoteOpen(false)}
                              className="text-[11px] font-semibold cursor-pointer"
                              style={{ color: 'var(--text-soft)' }}
                            >
                              Fechar
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Escreva uma ideia, bug ou ajuste pra depois..."
                            className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                            }}
                          />
                          <button
                            type="button"
                            disabled={!noteDraft.trim()}
                            onClick={() => {
                              const saved = addFeedbackNote({
                                text: noteDraft,
                                gameSlug: slug,
                                gameName: game.name,
                                intensityLabel: getIntensityLabel(
                                  result.equilibriumIndex ?? result.stagePlayed
                                ),
                                accuracyPct: result.accuracyPct,
                                rtMeanMs: result.rtMeanMs,
                                percentile: result.percentile,
                              });
                              if (saved) {
                                sound.tap();
                                setNoteDraft('');
                                setNoteOpen(false);
                                setNoteSavedToast(true);
                              }
                            }}
                            className="w-full py-2.5 px-3 rounded-xl font-bold text-xs btn-accent flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                          >
                            <Send size={13} />
                            <span>Salvar anotação</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botões claros: Próxima fase (quando liberou), Jogar novamente e Continuar */}
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
                    ) : (
                      <>
                        {mode === 'calibration' ? (
                          <button
                            type="button"
                            onClick={
                              onNextChallenge && nextChallengeLabel ? onNextChallenge : onExit
                            }
                            className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>
                              {onNextChallenge && nextChallengeLabel
                                ? nextChallengeLabel
                                : 'Voltar ao início'}
                            </span>
                            <ArrowRight size={18} />
                          </button>
                        ) : workoutProgress?.isLastOfWorkout || (onNextChallenge && nextChallengeLabel) ? (
                          <>
                            {/* Botão principal (azul): Próximo exercício ou Resumo do Dia */}
                            <button
                              type="button"
                              onClick={
                                workoutProgress?.isLastOfWorkout
                                  ? () => setShowWorkoutComplete(true)
                                  : onNextChallenge
                              }
                              className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span>
                                {workoutProgress?.isLastOfWorkout
                                  ? 'Ver resumo do dia'
                                  : nextChallengeLabel}
                              </span>
                              <ArrowRight size={18} />
                            </button>

                            {/* Botão secundário: Repetir exercício (ajusta dificuldade por baixo dos panos) */}
                            <button
                              type="button"
                              onClick={handlePlayNextStage}
                              className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl font-bold text-[15px] btn-soft flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <RotateCcw size={16} />
                              <span>Repetir exercício</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Sem próximo na fila: Repetir em destaque e Voltar ao início */}
                            <button
                              type="button"
                              onClick={handlePlayNextStage}
                              className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <RotateCcw size={17} />
                              <span>Repetir exercício</span>
                            </button>

                            <button
                              type="button"
                              onClick={onExit}
                              className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl font-bold text-[15px] btn-soft flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <span>Voltar ao início</span>
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {sandboxMode && (
                      <button
                        type="button"
                        onClick={handleReplaySameStage}
                        className={`w-full min-h-[48px] py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer ${
                          hasPendingTuningChange ? 'font-bold btn-accent' : 'font-semibold btn-soft'
                        }`}
                      >
                        <RotateCcw size={16} />
                        <span>
                          {hasPendingTuningChange
                            ? `Testar Nível ${stage} com novo ajuste`
                            : `Repetir Nível ${stage}`}
                        </span>
                      </button>
                    )}

                    {(onNextChallenge || workoutProgress?.isLastOfWorkout) && mode !== 'calibration' && (
                      <button
                        type="button"
                        onClick={onExit}
                        className="mx-auto py-1.5 px-4 text-xs font-semibold cursor-pointer"
                        style={{ color: 'var(--text-soft)' }}
                      >
                        {sandboxMode ? 'Voltar à Área de Testes' : 'Voltar ao início'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
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
                  recordAbandonIfNeeded();
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

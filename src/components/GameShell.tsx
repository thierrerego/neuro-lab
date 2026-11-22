import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Timer,
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
  regressWaveError,
  TOTAL_WAVES,
} from '../engine/waveEngine';
import { evaluateSession, getAgeBracketMeta } from '../engine/psychometricEngine';
import { GAME_COMPONENTS } from '../games';
import type { LiveMetrics } from '../games/GameProps';
import { sound } from '../lib/audio';
import { GameTutorial } from './GameTutorial';

export interface CalibrationBannerInfo {
  currentIndex: number; // 1..total
  total: number;
  domainName: string;
}

interface WaveTransitionBanner {
  kind: 'up' | 'down';
  title: string;
  subtitle: string;
}

interface GameShellProps {
  slug: GameSlug;
  stage: number; // nível base permanente (piso 0)
  easeBoost?: boolean;
  mode: SessionMode;
  theme: ThemeMode;
  ageBracket?: AgeBracket;
  weakestTwo: DomainKey[];
  calibrationInfo?: CalibrationBannerInfo;
  nextChallengeLabel?: string;
  onNextChallenge?: () => void;
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
  weakestTwo,
  calibrationInfo,
  nextChallengeLabel,
  onNextChallenge,
  onComplete,
  onPlayNext,
  onExit,
}: GameShellProps) {
  const game = GAME_MAP[slug];
  const domainMeta = DOMAIN_MAP[game.domain];
  const GameComponent = GAME_COMPONENTS[slug];
  const ageLabel = getAgeBracketMeta(ageBracket).label;

  const [wave, setWave] = useState<WaveState>(() => createWaveState(stage));
  const waveRef = useRef<WaveState>(wave);
  waveRef.current = wave;

  const effectiveConfig = useMemo(
    () => getWaveEffectiveConfig(slug, wave, easeBoost),
    [slug, wave, easeBoost]
  );

  const totalDurationSec = effectiveConfig.durationSec;
  const totalDurationMs = totalDurationSec * 1000;

  const [timeLeft, setTimeLeft] = useState(totalDurationSec);
  const [finishRequested, setFinishRequested] = useState(false);
  const [live, setLive] = useState<LiveMetrics>({ score: 0, accuracyPct: 100, combo: 0 });
  const [result, setResult] = useState<ComputedSessionResult | null>(null);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  // Fase: tutorial -> countdown (3, 2, 1) -> playing
  const [tutorialSlug, setTutorialSlug] = useState<GameSlug | null>(slug);
  const [prevSlug, setPrevSlug] = useState<GameSlug>(slug);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [waveTransition, setWaveTransition] = useState<WaveTransitionBanner | null>(null);
  const [playRun, setPlayRun] = useState(0);

  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setTutorialSlug(slug);
    setCountdown(null);
    setWaveTransition(null);
  }
  const showTutorial = tutorialSlug === slug;
  const isCountingDown = !showTutorial && countdown !== null && countdown > 0;
  const isPaused = showTutorial || isCountingDown || Boolean(waveTransition) || confirmExitOpen || Boolean(result);

  const matchStartMsRef = useRef<number>(performance.now());
  const pausedAccumMsRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearTransitionTimer();
    const freshWave = createWaveState(stage);
    waveRef.current = freshWave;
    setWave(freshWave);
    const dur = getWaveEffectiveConfig(slug, freshWave, easeBoost).durationSec;
    setTimeLeft(dur);
    setFinishRequested(false);
    setResult(null);
    setConfirmExitOpen(false);
    setWaveTransition(null);
    setLive({ score: 0, accuracyPct: 100, combo: 0 });
    matchStartMsRef.current = performance.now();
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    finishedRef.current = false;
  }, [slug, stage, easeBoost, playRun]);

  useEffect(() => () => clearTransitionTimer(), []);

  // Contagem regressiva central: 3... 2... 1...
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    sound.tap();
    const id = window.setTimeout(() => {
      if (countdown <= 1) {
        sound.hit(3);
        matchStartMsRef.current = performance.now();
        pausedAccumMsRef.current = 0;
        pauseStartedAtRef.current = null;
        setCountdown(null);
      } else {
        setCountdown(countdown - 1);
      }
    }, 700);
    return () => window.clearTimeout(id);
  }, [countdown]);

  // Acumula tempo pausado durante micro-respiro de 1.2s entre ondas
  useEffect(() => {
    if (waveTransition || confirmExitOpen) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
    } else if (pauseStartedAtRef.current !== null) {
      pausedAccumMsRef.current += performance.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [waveTransition, confirmExitOpen]);

  // Cronômetro regressivo
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

  const triggerWaveBreath = useCallback((banner: WaveTransitionBanner) => {
    clearTransitionTimer();
    setWaveTransition(banner);
    transitionTimerRef.current = window.setTimeout(() => {
      setWaveTransition(null);
      transitionTimerRef.current = null;
    }, 1200);
  }, []);

  const handleWaveHit = useCallback((): boolean => {
    if (finishedRef.current) return true;
    const { next, waveJustCleared, matchCleared, clearedWaveNum } = advanceWaveHit(waveRef.current);
    waveRef.current = next;
    setWave(next);
    if (waveJustCleared && !matchCleared) {
      sound.hit(6);
      triggerWaveBreath({
        kind: 'up',
        title: `Bloco ${clearedWaveNum} concluído`,
        subtitle: `Iniciando bloco ${next.currentWave}/${TOTAL_WAVES}...`,
      });
    }
    return matchCleared;
  }, [triggerWaveBreath]);

  const handleWaveError = useCallback(() => {
    if (finishedRef.current) return;
    const prev = waveRef.current;
    const { next, regressed, toWave } = regressWaveError(prev);
    waveRef.current = next;
    setWave(next);

    if (regressed) {
      triggerWaveBreath({
        kind: 'down',
        title: 'Recalibração de bloco',
        subtitle: `Retornando ao bloco ${toWave}...`,
      });
    } else if (prev.waveHits > 0) {
      triggerWaveBreath({
        kind: 'down',
        title: 'Reinício do bloco 1',
        subtitle: 'Recentrando atenção...',
      });
    }
  }, [triggerWaveBreath]);

  const handleFinish = useCallback(
    (perf: RawGamePerformance) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTransitionTimer();
      setWaveTransition(null);

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

  const timePct = Math.max(0, (timeLeft / totalDurationSec) * 100);
  const waveBarPct = getWaveBarPct(wave);
  const savedSecondsStr = result ? (result.timeRemainingMs / 1000).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[460px] min-h-screen flex flex-col relative"
        style={{
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Faixa superior do Teste de Rastreio */}
        {calibrationInfo && (
          <div
            className="px-4 py-2 flex items-center justify-between text-[11px] font-semibold"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--accent)' }}>
              Avaliação {calibrationInfo.currentIndex}/{calibrationInfo.total} · {calibrationInfo.domainName}
            </span>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(calibrationInfo.currentIndex / calibrationInfo.total) * 100}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
          </div>
        )}

        {/* Barra regressiva do cronômetro */}
        <div className="h-1 w-full" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full transition-all duration-1000 linear"
            style={{
              width: `${timePct}%`,
              background: timeLeft <= 7 ? 'var(--err)' : 'var(--accent)',
            }}
          />
        </div>

        {/* HUD Superior */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={handleBackClick}
            className="w-9 h-9 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
            title="Sair"
          >
            <ArrowLeft size={17} />
          </button>

          <div className="text-center min-w-0 px-2">
            <div className="text-sm font-bold leading-tight truncate">{game.name}</div>
            <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>
              Nível {stage} · {getStageShortBadge(slug, effectiveConfig)}
            </div>
          </div>

          <div
            className="px-3 py-1.5 rounded-xl font-bold text-sm tabular"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: timeLeft <= 7 ? 'var(--err)' : 'var(--text)',
            }}
          >
            {timeLeft}s
          </div>
        </div>

        {/* HUD de Progressão (5 blocos) */}
        {!result && !showTutorial && (
          <div className="px-4 pt-2.5 pb-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold tabular">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--accent)' }}
                >
                  Bloco {wave.currentWave}/{TOTAL_WAVES}
                </span>
                <span style={{ color: 'var(--text-soft)' }}>
                  {wave.waveHits}/{wave.waveQuota}
                </span>
              </div>

              <span style={{ color: live.accuracyPct >= 80 ? 'var(--ok)' : 'var(--warn)' }}>
                Precisão {live.accuracyPct}%
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((wNum) => {
                const filled =
                  wNum < wave.currentWave || wave.isCleared
                    ? 100
                    : wNum === wave.currentWave
                      ? waveBarPct
                      : 0;
                return (
                  <div
                    key={wNum}
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${filled}%`,
                        background: wNum < wave.currentWave || wave.isCleared ? 'var(--ok)' : 'var(--accent)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tutorial, Contagem 3-2-1, Exercício ou Relatório da Sessão */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 relative">
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
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl font-black animate-pop tabular"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--accent)',
                }}
              >
                {countdown}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                Concentre-se
              </div>
            </div>
          ) : !result ? (
            <>
              <GameComponent
                key={`${slug}-${stage}-${easeBoost ? 'easy' : 'std'}-${playRun}`}
                config={effectiveConfig}
                wave={wave}
                finishRequested={finishRequested}
                paused={Boolean(waveTransition) || confirmExitOpen}
                onWaveHit={handleWaveHit}
                onWaveError={handleWaveError}
                onLiveUpdate={setLive}
                onFinish={handleFinish}
              />

              {waveTransition && (
                <div
                  className="absolute inset-0 z-30 flex items-center justify-center px-6 backdrop-blur-sm animate-pop"
                  style={{ background: 'color-mix(in srgb, var(--bg-elev) 85%, transparent)' }}
                >
                  <div
                    className="w-full max-w-[300px] surface-card p-5 text-center flex flex-col items-center gap-2"
                    style={{
                      borderColor: waveTransition.kind === 'up' ? 'var(--ok)' : 'var(--err)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background:
                          waveTransition.kind === 'up'
                            ? 'rgba(16, 185, 129, 0.14)'
                            : 'rgba(244, 63, 94, 0.14)',
                        color: waveTransition.kind === 'up' ? 'var(--ok)' : 'var(--err)',
                      }}
                    >
                      {waveTransition.kind === 'up' ? (
                        <CheckCircle2 size={22} />
                      ) : (
                        <AlertTriangle size={22} />
                      )}
                    </div>
                    <div className="text-sm font-bold">{waveTransition.title}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {waveTransition.subtitle}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full max-w-[390px] surface-card p-5 flex flex-col gap-4 animate-pop">
              {/* Status e domínio */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: result.completedEarly ? 'rgba(16,185,129,0.14)' : 'var(--bg-subtle)',
                    color: result.completedEarly ? 'var(--ok)' : 'var(--text-muted)',
                  }}
                >
                  {result.completedEarly ? <CheckCircle2 size={13} /> : <Timer size={13} />}
                  {result.completedEarly ? 'Sessão concluída' : 'Tempo encerrado'}
                </span>

                <span className="text-xs font-semibold tabular" style={{ color: 'var(--text-soft)' }}>
                  Blocos {result.wavesCompleted === 5 ? '5/5' : `${result.waveReached}/5`}
                </span>
              </div>

              {/* Resultado psicométrico principal */}
              <div className="text-center py-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: domainMeta.color }}>
                  {domainMeta.name}
                </div>
                <div className="text-4xl font-black tabular tracking-tight mt-1">
                  {result.performanceIndex}%
                </div>
                <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                  {result.earnedTitle} · Superou <strong style={{ color: 'var(--text)' }}>{result.percentile}%</strong> (faixa {ageLabel})
                </div>

                {result.completedEarly && result.timeRemainingMs > 0 && result.speedPoints > 0 && (
                  <div
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tabular"
                    style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--ok)' }}
                  >
                    Concluído com {savedSecondsStr}s de margem
                  </div>
                )}
              </div>

              {/* Evolução de nível e impacto no domínio */}
              <div
                className="rounded-xl p-3 flex items-center justify-between gap-2"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                    Progressão adaptativa
                  </div>
                  <div
                    className="text-xs font-bold mt-0.5"
                    style={{
                      color:
                        result.adaptiveStatus === 'fast_track'
                          ? 'var(--accent)'
                          : result.stageCleared
                            ? 'var(--ok)'
                            : 'var(--text)',
                    }}
                  >
                    {result.adaptiveStatus === 'fast_track'
                      ? `Avanço acelerado → Nível ${result.nextStage}`
                      : result.adaptiveStatus === 'level_up'
                        ? `Nível ${result.nextStage} desbloqueado`
                        : result.adaptiveStatus === 'step_down'
                          ? `Ajustado para Nível ${result.nextStage}`
                          : result.adaptiveStatus === 'ease_mode'
                            ? 'Mantém Nível 0 (cadência leve)'
                            : `Mantém Nível ${result.nextStage}`}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className="text-xs font-bold tabular inline-flex items-center gap-1"
                    style={{ color: result.domainDelta >= 0 ? 'var(--ok)' : 'var(--err)' }}
                  >
                    <Activity size={12} />
                    <span>
                      {result.domainDelta >= 0 ? `+${(result.domainDelta / 10).toFixed(1)}%` : `${(result.domainDelta / 10).toFixed(1)}%`}
                    </span>
                  </div>
                  {result.isPriorityDomain && (
                    <div className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
                      Área prioritária
                    </div>
                  )}
                </div>
              </div>

              {/* Decomposição 60% Precisão / 40% Velocidade */}
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>Precisão (peso 60%)</span>
                    <span className="tabular font-bold" style={{ color: 'var(--ok)' }}>
                      {result.accuracyPct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((result.accuracyPoints / 600) * 100))}%`,
                        background: 'var(--ok)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Velocidade (peso 40%){result.accuracyPct < 50 ? ' · bloqueada (<50%)' : ''}
                    </span>
                    <span className="tabular font-bold" style={{ color: 'var(--accent)' }}>
                      {result.rtMeanMs > 0 ? `${result.rtMeanMs} ms` : `${result.speedScore}%`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((result.speedPoints / 400) * 100))}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2 pt-1">
                {onNextChallenge && nextChallengeLabel ? (
                  <button
                    type="button"
                    onClick={onNextChallenge}
                    className="w-full py-3.5 rounded-xl font-bold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{nextChallengeLabel}</span>
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialSlug(null);
                      setCountdown(3);
                      setPlayRun((r) => r + 1);
                      onPlayNext(result.nextStage, result.adaptiveStatus === 'ease_mode');
                    }}
                    className="w-full py-3.5 rounded-xl font-bold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {result.stageCleared ? (
                      <>
                        <span>Avançar para Nível {result.nextStage}</span>
                        <ArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        <RotateCcw size={15} />
                        <span>Repetir Nível {result.nextStage}</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onExit}
                  className="w-full py-3 rounded-xl font-semibold text-sm btn-soft cursor-pointer"
                >
                  Voltar ao protocolo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal de confirmação de saída durante o Teste de Rastreio */}
        {confirmExitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.72)' }}>
            <div className="w-full max-w-[330px] surface-card p-5 flex flex-col gap-3 animate-pop text-center">
              <div className="text-base font-bold">Interromper avaliação inicial?</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Se sair agora, o progresso desta etapa não será registrado.
              </p>
              <button
                type="button"
                onClick={() => setConfirmExitOpen(false)}
                className="w-full py-3 rounded-xl font-bold text-sm btn-accent cursor-pointer"
              >
                Continuar avaliação
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmExitOpen(false);
                  onExit();
                }}
                className="w-full py-2.5 rounded-xl font-semibold text-xs btn-soft cursor-pointer"
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

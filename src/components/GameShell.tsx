import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Flame, RotateCcw, Timer, Zap } from 'lucide-react';
import type {
  ComputedSessionResult,
  DomainKey,
  GameSlug,
  RawGamePerformance,
  SessionMode,
  ThemeMode,
  WaveState,
} from '../types/cognitive';
import { GAME_MAP } from '../engine/gameRegistry';
import { getStageShortBadge } from '../engine/stageEngine';
import {
  advanceWaveHit,
  createWaveState,
  getWaveBarPct,
  getWaveEffectiveConfig,
  TOTAL_WAVES,
} from '../engine/waveEngine';
import { evaluateSession } from '../engine/psychometricEngine';
import { GAME_COMPONENTS } from '../games';
import type { LiveMetrics } from '../games/GameProps';
import { sound } from '../lib/audio';

export interface CalibrationBannerInfo {
  currentIndex: number; // 1..total
  total: number;
  domainName: string;
}

interface GameShellProps {
  slug: GameSlug;
  stage: number; // baseStage permanente do jogo
  easeBoost?: boolean;
  mode: SessionMode;
  theme: ThemeMode;
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
  theme,
  weakestTwo,
  calibrationInfo,
  nextChallengeLabel,
  onNextChallenge,
  onComplete,
  onPlayNext,
  onExit,
}: GameShellProps) {
  const game = GAME_MAP[slug];
  const GameComponent = GAME_COMPONENTS[slug];

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

  const matchStartMsRef = useRef<number>(performance.now());
  const finishedRef = useRef(false);

  // Reinicia partida quando troca jogo ou estágio
  useEffect(() => {
    const freshWave = createWaveState(stage);
    waveRef.current = freshWave;
    setWave(freshWave);
    const dur = getWaveEffectiveConfig(slug, freshWave, easeBoost).durationSec;
    setTimeLeft(dur);
    setFinishRequested(false);
    setResult(null);
    setConfirmExitOpen(false);
    setLive({ score: 0, accuracyPct: 100, combo: 0 });
    matchStartMsRef.current = performance.now();
    finishedRef.current = false;
  }, [slug, stage, easeBoost]);

  // Cronômetro regressivo real
  useEffect(() => {
    if (result || finishRequested || confirmExitOpen) return;
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
  }, [result, finishRequested, confirmExitOpen]);

  // Chamado pelo minigame a cada acerto -> avança ondas 1..5 e dispara conclusão antecipada na Onda 5!
  const handleWaveHit = useCallback((): boolean => {
    if (finishedRef.current) return true;
    const { next, waveJustCleared, matchCleared } = advanceWaveHit(waveRef.current);
    waveRef.current = next;
    setWave(next);
    if (waveJustCleared && !matchCleared) {
      sound.hit(8);
    }
    return matchCleared;
  }, []);

  const handleFinish = useCallback(
    (perf: RawGamePerformance) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      const curWave = waveRef.current;
      const elapsedMs = performance.now() - matchStartMsRef.current;
      const remainingMs = curWave.isCleared
        ? Math.max(0, Math.round(totalDurationMs - elapsedMs))
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
      });

      setResult(evaluated);
      if (evaluated.completedEarly || evaluated.stageCleared) sound.stageClear();
      else sound.stageFail();
      void onComplete(evaluated);
    },
    [game.domain, slug, mode, stage, effectiveConfig, totalDurationMs, weakestTwo, onComplete]
  );

  const handleBackClick = () => {
    if (mode === 'calibration' && !result) {
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
        {/* Faixa superior do Teste de Rastreio (Calibração) */}
        {calibrationInfo && (
          <div
            className="px-4 py-2 flex items-center justify-between text-[11px] font-extrabold"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--accent)' }}>
              Teste {calibrationInfo.currentIndex} de {calibrationInfo.total} — {calibrationInfo.domainName}
            </span>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
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

        {/* HUD Superior: Voltar | Nome + Estágio | Cronômetro */}
        <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={handleBackClick}
            className="w-9 h-9 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
            title="Sair"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="text-center">
            <div className="text-sm font-extrabold leading-tight">{game.name}</div>
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Estágio {stage} · {getStageShortBadge(slug, effectiveConfig)}
            </div>
          </div>

          <div
            className="px-3 py-1.5 rounded-xl font-black text-sm tabular"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: timeLeft <= 7 ? 'var(--err)' : 'var(--text)',
            }}
          >
            {timeLeft}s
          </div>
        </div>

        {/* HUD de Micro-Níveis (Onda X/5 + Barra da Onda Atual) */}
        {!result && (
          <div className="px-4 pt-2.5 pb-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-extrabold tabular">
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px]"
                  style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--border-strong)' }}
                >
                  Onda {wave.currentWave}/{TOTAL_WAVES}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {wave.waveHits}/{wave.waveQuota}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {theme === 'gamified' && live.combo >= 2 && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black text-white animate-combo"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)' }}
                  >
                    <Flame size={11} /> ×{live.combo}
                  </span>
                )}
                <span style={{ color: live.accuracyPct >= 80 ? 'var(--ok)' : 'var(--warn)' }}>
                  {live.accuracyPct}%
                </span>
              </div>
            </div>

            {/* 5 segmentos visuais das ondas + preenchimento da onda atual */}
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((wNum) => {
                const filled =
                  wNum <= wave.wavesCompleted
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
                        background: wNum <= wave.wavesCompleted ? 'var(--ok)' : 'var(--accent-grad)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Arena ou Tela de Resultado Pós-Partida */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
          {!result ? (
            <GameComponent
              key={`${slug}-${stage}-${easeBoost ? 'easy' : 'std'}`}
              config={effectiveConfig}
              wave={wave}
              finishRequested={finishRequested}
              onWaveHit={handleWaveHit}
              onLiveUpdate={setLive}
              onFinish={handleFinish}
            />
          ) : (
            <div className="w-full max-w-[385px] surface-card p-5 flex flex-col gap-4 animate-pop">
              {/* Banner de Conclusão Antecipada ou Tempo Esgotado */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                  style={{
                    background: result.completedEarly ? 'rgba(52,211,153,0.18)' : 'var(--bg-subtle)',
                    color: result.completedEarly ? 'var(--ok)' : 'var(--text-muted)',
                  }}
                >
                  {result.completedEarly ? <CheckCircle2 size={13} /> : <Timer size={13} />}
                  {result.completedEarly ? 'Desafio Concluído!' : 'Tempo esgotado'}
                </span>

                <span className="text-xs font-extrabold tabular" style={{ color: 'var(--accent)' }}>
                  Onda {result.wavesCompleted === 5 ? '5/5' : `${result.waveReached}/5`}
                </span>
              </div>

              {/* Alcunha + Percentil */}
              <div className="text-center">
                <div
                  className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-2"
                  style={{
                    background: theme === 'gamified' ? `${result.tierAccent}24` : 'var(--bg-subtle)',
                    border: `1.5px solid ${result.tierAccent}`,
                    color: result.tierAccent,
                    boxShadow: theme === 'gamified' ? `0 0 24px ${result.tierAccent}44` : 'none',
                  }}
                >
                  <Award size={28} />
                </div>

                <h3
                  className="text-2xl font-black tracking-tight"
                  style={{ color: theme === 'gamified' ? result.tierAccent : 'var(--text)' }}
                >
                  {result.earnedTitle}
                </h3>
                <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {result.earnedSubtitle}
                </p>

                <div
                  className="inline-flex items-center gap-1.5 mt-2.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold tabular"
                  style={{
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text)',
                  }}
                >
                  <Zap size={13} style={{ color: 'var(--warn)' }} />
                  <span>Você superou {result.percentile}% dos jogadores</span>
                </div>

                {result.completedEarly && result.timeRemainingMs > 0 && (
                  <div
                    className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold tabular"
                    style={{ background: 'rgba(52,211,153,0.16)', color: 'var(--ok)' }}
                  >
                    Concluído com {savedSecondsStr}s de sobra! (+{result.earlyBonusPoints} pts)
                  </div>
                )}
              </div>

              {/* Score Final + Evolução de Estágio */}
              <div
                className="rounded-2xl p-3.5 flex items-center justify-between"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                    Score · Micro-nível {result.wavesCompleted === 5 ? 5 : result.waveReached}/5
                  </div>
                  <div className="text-3xl font-black tabular leading-none mt-1">
                    {result.score}
                    <span className="text-xs font-bold ml-1" style={{ color: 'var(--text-soft)' }}>/ 1000</span>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                    style={{
                      background:
                        result.adaptiveStatus === 'fast_track'
                          ? 'var(--accent-glow)'
                          : result.stageCleared
                            ? 'rgba(52,211,153,0.18)'
                            : 'rgba(251,191,36,0.15)',
                      color:
                        result.adaptiveStatus === 'fast_track'
                          ? 'var(--accent)'
                          : result.stageCleared
                            ? 'var(--ok)'
                            : 'var(--warn)',
                    }}
                  >
                    {result.adaptiveStatus === 'fast_track'
                      ? `⚡ +${result.adaptiveDelta} → Estágio ${result.nextStage}`
                      : result.adaptiveStatus === 'level_up'
                        ? `Estágio ${result.nextStage} liberado!`
                        : result.adaptiveStatus === 'step_down'
                          ? `Ajustado → Estágio ${result.nextStage}`
                          : result.adaptiveStatus === 'ease_mode'
                            ? 'Próxima mais leve'
                            : `Mantém Estágio ${result.nextStage}`}
                  </div>
                  <div className="text-[11px] font-bold mt-1 tabular" style={{ color: 'var(--warn)' }}>
                    +{result.xpEarned} XP {result.bonusXp ? '(+20%)' : ''}
                  </div>
                </div>
              </div>

              {/* Breakdown 60% Assertividade / 40% Tempo + Bônus */}
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Assertividade (60%) · <strong style={{ color: 'var(--text)' }}>{result.accuracyPct}%</strong>
                    </span>
                    <span className="tabular font-extrabold" style={{ color: 'var(--ok)' }}>
                      +{result.accuracyPoints} pts
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
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
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Tempo & Teto (40%) ·{' '}
                      <strong className="tabular" style={{ color: 'var(--text)' }}>
                        {result.rtMeanMs ? `${result.rtMeanMs} ms` : '—'}
                      </strong>
                    </span>
                    <span className="tabular font-extrabold" style={{ color: 'var(--accent)' }}>
                      +{result.speedPoints} pts
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.round((result.speedPoints / 400) * 100))}%`,
                        background: 'var(--accent-grad)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2 pt-1">
                {onNextChallenge && nextChallengeLabel ? (
                  <button
                    onClick={onNextChallenge}
                    className="w-full py-3.5 rounded-2xl font-extrabold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{nextChallengeLabel}</span>
                    <ArrowRight size={17} />
                  </button>
                ) : (
                  <button
                    onClick={() => onPlayNext(result.nextStage, result.adaptiveStatus === 'ease_mode')}
                    className="w-full py-3.5 rounded-2xl font-extrabold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {result.stageCleared ? (
                      <>
                        <span>Avançar para Estágio {result.nextStage}</span>
                        <ArrowRight size={17} />
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} />
                        <span>Jogar Estágio {result.nextStage}</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={onExit}
                  className="w-full py-3 rounded-2xl font-bold text-sm btn-soft cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal de confirmação de saída durante o Teste de Rastreio */}
        {confirmExitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.72)' }}>
            <div className="w-full max-w-[330px] surface-card p-5 flex flex-col gap-3 animate-pop text-center">
              <div className="text-base font-black">Pausar teste de rastreio?</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Se sair agora, o progresso desta rodada não será salvo.
              </p>
              <button
                onClick={() => setConfirmExitOpen(false)}
                className="w-full py-3 rounded-xl font-extrabold text-sm btn-accent cursor-pointer"
              >
                Continuar teste
              </button>
              <button
                onClick={() => {
                  setConfirmExitOpen(false);
                  onExit();
                }}
                className="w-full py-2.5 rounded-xl font-bold text-xs btn-soft cursor-pointer"
              >
                Sair do teste
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

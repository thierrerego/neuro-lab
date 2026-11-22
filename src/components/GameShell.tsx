import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Award, Flame, RotateCcw, Zap } from 'lucide-react';
import type {
  ComputedSessionResult,
  DomainKey,
  GameSlug,
  RawGamePerformance,
  SessionMode,
  ThemeMode,
} from '../types/cognitive';
import { GAME_MAP } from '../engine/gameRegistry';
import { getStageConfig, getStageShortBadge } from '../engine/stageEngine';
import { evaluateSession } from '../engine/psychometricEngine';
import { GAME_COMPONENTS } from '../games';
import type { LiveMetrics } from '../games/GameProps';
import { sound } from '../lib/audio';

interface GameShellProps {
  slug: GameSlug;
  stage: number;
  easeBoost?: boolean;
  mode: SessionMode;
  theme: ThemeMode;
  weakestTwo: DomainKey[];
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
  nextChallengeLabel,
  onNextChallenge,
  onComplete,
  onPlayNext,
  onExit,
}: GameShellProps) {
  const game = GAME_MAP[slug];
  const config = useMemo(() => getStageConfig(slug, stage, easeBoost), [slug, stage, easeBoost]);
  const GameComponent = GAME_COMPONENTS[slug];

  const [timeLeft, setTimeLeft] = useState(config.durationSec);
  const [finishRequested, setFinishRequested] = useState(false);
  const [live, setLive] = useState<LiveMetrics>({ score: 0, accuracyPct: 100, combo: 0 });
  const [result, setResult] = useState<ComputedSessionResult | null>(null);

  useEffect(() => {
    setTimeLeft(config.durationSec);
    setFinishRequested(false);
    setResult(null);
    setLive({ score: 0, accuracyPct: 100, combo: 0 });
  }, [slug, stage, easeBoost, config.durationSec]);

  useEffect(() => {
    if (result || finishRequested) return;
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
  }, [result, finishRequested]);

  const handleFinish = useCallback(
    (perf: RawGamePerformance) => {
      if (result) return;
      const evaluated = evaluateSession({
        domain: game.domain,
        gameSlug: slug,
        mode,
        config,
        perf,
        weakestTwoDomains: weakestTwo,
      });
      setResult(evaluated);
      if (evaluated.stageCleared) sound.stageClear();
      else sound.stageFail();
      void onComplete(evaluated);
    },
    [result, game.domain, slug, mode, config, weakestTwo, onComplete]
  );

  const timePct = Math.max(0, (timeLeft / config.durationSec) * 100);

  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[460px] min-h-screen flex flex-col"
        style={{
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Barra de tempo fininha */}
        <div className="h-1.5 w-full" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full transition-all duration-1000 linear"
            style={{
              width: `${timePct}%`,
              background: timeLeft <= 7 ? 'var(--err)' : 'var(--accent-grad)',
            }}
          />
        </div>

        {/* HUD enxuto */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={onExit}
            className="w-9 h-9 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
            title="Sair"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="text-center">
            <div className="text-sm font-extrabold leading-tight">{game.name}</div>
            <div className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              F{config.stage} · {getStageShortBadge(slug, config)}
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

        {/* Métricas ao vivo durante a partida */}
        {!result && (
          <div className="flex items-center justify-between px-5 py-2.5 text-xs font-bold tabular">
            <span style={{ color: 'var(--text-muted)' }}>
              {live.statusTag ?? `${live.score.toLocaleString('pt-BR')} pts`}
            </span>
            <div className="flex items-center gap-2">
              {theme === 'gamified' && live.combo >= 2 && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black text-white animate-combo"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ec4899)' }}
                >
                  <Flame size={12} /> ×{live.combo}
                </span>
              )}
              <span style={{ color: live.accuracyPct >= 80 ? 'var(--ok)' : 'var(--warn)' }}>
                {live.accuracyPct}%
              </span>
            </div>
          </div>
        )}

        {/* Arena ou Tela de Resultado Pós-Minigame */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-5">
          {!result ? (
            <GameComponent
              key={`${slug}-${stage}-${easeBoost ? 'easy' : 'std'}`}
              config={config}
              finishRequested={finishRequested}
              onLiveUpdate={setLive}
              onFinish={handleFinish}
            />
          ) : (
            <div className="w-full max-w-[385px] surface-card p-5 flex flex-col gap-4 animate-pop">
              {/* Destaque Principal: Alcunha + Percentil */}
              <div className="text-center">
                <div
                  className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-2.5"
                  style={{
                    background:
                      theme === 'gamified' ? `${result.tierAccent}24` : 'var(--bg-subtle)',
                    border: `1.5px solid ${result.tierAccent}`,
                    color: result.tierAccent,
                    boxShadow:
                      theme === 'gamified' ? `0 0 24px ${result.tierAccent}44` : 'none',
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

                {/* Selo de Percentil */}
                <div
                  className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1.5 rounded-full text-xs font-extrabold tabular"
                  style={{
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text)',
                  }}
                >
                  <Zap size={13} style={{ color: 'var(--warn)' }} />
                  <span>Você superou {result.percentile}% dos jogadores</span>
                </div>
              </div>

              {/* Pontuação Final (0 a 1000) + Status de Fase */}
              <div
                className="rounded-2xl p-3.5 flex items-center justify-between"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                    Score Final
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
                      ? `⚡ +${result.adaptiveDelta} → Fase ${result.nextStage}`
                      : result.adaptiveStatus === 'level_up'
                        ? `Fase ${result.nextStage} desbloqueada!`
                        : result.adaptiveStatus === 'step_down'
                          ? `Ajustado → Fase ${result.nextStage}`
                          : result.adaptiveStatus === 'ease_mode'
                            ? 'Próxima mais leve'
                            : `Mantém Fase ${result.nextStage}`}
                  </div>
                  <div className="text-[11px] font-bold mt-1 tabular" style={{ color: 'var(--warn)' }}>
                    +{result.xpEarned} XP {result.bonusXp ? '(+20%)' : ''}
                  </div>
                </div>
              </div>

              {/* Breakdown 60% Assertividade / 40% Velocidade */}
              <div className="flex flex-col gap-3">
                {/* Assertividade (60% = máx 600 pts) */}
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

                {/* Velocidade (40% = máx 400 pts) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>
                      Velocidade (40%) ·{' '}
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
                        <span>Avançar para Fase {result.nextStage}</span>
                        <ArrowRight size={17} />
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} />
                        <span>Jogar Fase {result.nextStage}</span>
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
      </div>
    </div>
  );
}

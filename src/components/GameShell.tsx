import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Flame, RotateCcw, Trophy } from 'lucide-react';
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

  // Reinicia cronômetro se mudar fase ou jogo
  useEffect(() => {
    setTimeLeft(config.durationSec);
    setFinishRequested(false);
    setResult(null);
    setLive({ score: 0, accuracyPct: 100, combo: 0 });
  }, [slug, stage, config.durationSec]);

  // Cronômetro real da partida
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
        style={{ background: 'var(--bg-elev)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
      >
        {/* Barra de tempo fininha no topo */}
        <div className="h-1.5 w-full" style={{ background: 'var(--bg-subtle)' }}>
          <div
            className="h-full transition-all duration-1000 linear"
            style={{
              width: `${timePct}%`,
              background: timeLeft <= 7 ? 'var(--err)' : 'var(--accent-grad)',
            }}
          />
        </div>

        {/* HUD minimalista */}
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

        {/* Métricas enxutas ao vivo */}
        <div className="flex items-center justify-between px-5 py-2.5 text-xs font-bold tabular">
          <span style={{ color: 'var(--text-muted)' }}>
            {live.score.toLocaleString('pt-BR')} pts
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

        {/* Arena do minigame ou Resultado */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          {!result ? (
            <GameComponent
              key={`${slug}-${stage}-${easeBoost ? 'easy' : 'std'}`}
              config={config}
              finishRequested={finishRequested}
              onLiveUpdate={setLive}
              onFinish={handleFinish}
            />
          ) : (
            <div className="w-full max-w-[360px] surface-card p-6 text-center animate-pop">
              <div
                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3"
                style={{
                  background: result.stageCleared ? 'rgba(52, 211, 153, 0.16)' : 'rgba(251, 191, 36, 0.16)',
                  color: result.stageCleared ? 'var(--ok)' : 'var(--warn)',
                }}
              >
                <Trophy size={32} />
              </div>

              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2"
                style={{
                  background:
                    result.adaptiveStatus === 'fast_track'
                      ? 'var(--accent-glow)'
                      : result.stageCleared
                        ? 'rgba(52, 211, 153, 0.18)'
                        : 'rgba(251, 191, 36, 0.16)',
                  color:
                    result.adaptiveStatus === 'fast_track'
                      ? 'var(--accent)'
                      : result.stageCleared
                        ? 'var(--ok)'
                        : 'var(--warn)',
                }}
              >
                {result.adaptiveStatus === 'fast_track'
                  ? `⚡ +${result.adaptiveDelta} fases → Fase ${result.nextStage}`
                  : result.adaptiveStatus === 'level_up'
                    ? `Fase ${result.nextStage} desbloqueada`
                    : result.adaptiveStatus === 'step_down'
                      ? `Ajustado → Fase ${result.nextStage}`
                      : result.adaptiveStatus === 'ease_mode'
                        ? 'Próxima mais leve'
                        : `Mantém Fase ${result.nextStage}`}
              </div>

              <div className="text-3xl font-black tabular mt-1">
                {result.score.toLocaleString('pt-BR')} <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>pts</span>
              </div>

              <div className="grid grid-cols-3 gap-2 my-5">
                <div className="rounded-xl py-2.5 px-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="text-base font-black tabular" style={{ color: result.accuracyPct >= 80 ? 'var(--ok)' : 'var(--warn)' }}>
                    {result.accuracyPct}%
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>Precisão</div>
                </div>
                <div className="rounded-xl py-2.5 px-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="text-base font-black tabular">{result.rtMeanMs ? `${result.rtMeanMs}ms` : '—'}</div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>Reação</div>
                </div>
                <div className="rounded-xl py-2.5 px-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="text-base font-black tabular" style={{ color: 'var(--warn)' }}>
                    +{result.xpEarned}
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--text-soft)' }}>
                    {result.bonusXp ? 'XP (+20%)' : 'XP'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => onPlayNext(result.nextStage, result.adaptiveStatus === 'ease_mode')}
                  className="w-full py-3.5 rounded-2xl font-extrabold text-sm btn-accent flex items-center justify-center gap-2 cursor-pointer"
                >
                  {result.stageCleared ? (
                    <>
                      <span>Jogar Fase {result.nextStage}</span>
                      <ArrowRight size={17} />
                    </>
                  ) : (
                    <>
                      <RotateCcw size={16} />
                      <span>Jogar Fase {result.nextStage}</span>
                    </>
                  )}
                </button>
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

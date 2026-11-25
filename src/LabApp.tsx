import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  FlaskConical,
  Moon,
  Play,
  Sun,
  Trash2,
} from 'lucide-react';
import type { AgeBracket, ComputedSessionResult, DomainKey, GameSlug, ThemeMode } from './types/cognitive';
import { DOMAIN_LIST, DOMAIN_MAP, GAME_MAP, GAME_REGISTRY, GAMES_BY_DOMAIN } from './engine/gameRegistry';
import { AGE_BRACKET_OPTIONS } from './engine/psychometricEngine';
import {
  appendCalibrationLog,
  clearCalibrationLogs,
  DIFFICULTY_LABELS,
  formatCalibrationLogForChat,
  getCalibrationLogs,
  type CalibrationLogEntry,
} from './lib/calibrationLog';

const LAST_SENT_AT_KEY = 'neurolab_lab_last_sent_at';

function readLastSentAt(): string | null {
  try {
    return localStorage.getItem(LAST_SENT_AT_KEY);
  } catch {
    return null;
  }
}
import { sound } from './lib/audio';
import {
  formatTuningShort,
  getAllLabTunings,
  getAllPlateauAttempts,
  getEffectiveLabTuning,
  getLabTuningKey,
  isLabTuningModified,
  recordPlateauAttempt,
  resetLabTuning,
  resetPlateauAttempts,
  saveLabTuning,
  type LabLevelTuning,
  type PlateauAttempt,
} from './lib/labTuning';
import { GameIcon } from './components/DomainIcon';
import { GameShell } from './components/GameShell';
import { LabTuningPanel } from './components/LabTuningPanel';

function getLevelBandLabel(lvl: number): string {
  if (lvl <= 4) return 'Básico · foco em velocidade';
  if (lvl <= 10) return 'Intermediário · progressão gradual';
  if (lvl <= 15) return 'Difícil · alta demanda';
  return 'Extremo · limite humano';
}

export default function LabApp() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [ageBracket, setAgeBracket] = useState<AgeBracket>('25-34');
  const [domainFilter, setDomainFilter] = useState<'all' | DomainKey>('all');
  const [selectedSlug, setSelectedSlug] = useState<GameSlug>('visual-search');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [activeTest, setActiveTest] = useState<{ slug: GameSlug; stage: number } | null>(null);

  const [logs, setLogs] = useState<CalibrationLogEntry[]>(() => getCalibrationLogs());
  const [tunings, setTunings] = useState<Record<string, LabLevelTuning>>(() => getAllLabTunings());
  const [plateauMap, setPlateauMap] = useState<Record<string, PlateauAttempt[]>>(() =>
    getAllPlateauAttempts()
  );
  const [copied, setCopied] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(() => readLastSentAt());

  // Mapa de níveis já testados + alertas de distorção (baseado no último teste de cada nível)
  const testedLevelsByGame = useMemo(() => {
    const map = new Map<
      GameSlug,
      { levels: Set<number>; sentLevels: Set<number>; alertLevels: Set<number> }
    >();
    const seenLatest = new Set<string>();
    for (const entry of logs) {
      let item = map.get(entry.gameSlug);
      if (!item) {
        item = {
          levels: new Set<number>(),
          sentLevels: new Set<number>(),
          alertLevels: new Set<number>(),
        };
        map.set(entry.gameSlug, item);
      }
      item.levels.add(entry.stagePlayed);
      if (lastSentAt && entry.timestamp <= lastSentAt) {
        item.sentLevels.add(entry.stagePlayed);
      }
      const key = `${entry.gameSlug}:${entry.stagePlayed}`;
      if (!seenLatest.has(key)) {
        seenLatest.add(key);
        if (entry.alerts.length > 0) {
          item.alertLevels.add(entry.stagePlayed);
        }
      }
    }
    return map;
  }, [logs, lastSentAt]);

  const selectedTestedInfo = testedLevelsByGame.get(selectedSlug);
  const selectedTestedSorted = useMemo(
    () => Array.from(selectedTestedInfo?.levels ?? []).sort((a, b) => a - b),
    [selectedTestedInfo]
  );
  const selectedAlertsSorted = useMemo(
    () => Array.from(selectedTestedInfo?.alertLevels ?? []).sort((a, b) => a - b),
    [selectedTestedInfo]
  );
  const allSelectedSent =
    selectedTestedSorted.length > 0 &&
    selectedTestedSorted.every((lvl) => selectedTestedInfo?.sentLevels.has(lvl));

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0D121E' : '#F3F6FA');
    }
    sound.setTheme(theme);
  }, [theme]);

  const visibleGames = useMemo(
    () => (domainFilter === 'all' ? GAME_REGISTRY : GAMES_BY_DOMAIN[domainFilter]),
    [domainFilter]
  );

  const selectedGame = GAME_MAP[selectedSlug] ?? GAME_REGISTRY[0];
  const selectedDomain = DOMAIN_MAP[selectedGame.domain];
  const alertsCount = useMemo(() => logs.filter((l) => l.alerts.length > 0).length, [logs]);
  const tunedCount = useMemo(() => Object.keys(tunings).length, [tunings]);

  const currentTuning = useMemo(() => {
    const slug = activeTest?.slug ?? selectedSlug;
    const stage = activeTest?.stage ?? selectedLevel;
    return tunings[getLabTuningKey(slug, stage)] ?? getEffectiveLabTuning(slug, stage);
  }, [activeTest, selectedSlug, selectedLevel, tunings]);

  const handleTuningChange = (slug: GameSlug, stage: number, next: LabLevelTuning) => {
    saveLabTuning(slug, stage, next);
    setTunings(getAllLabTunings());
  };

  const handleTuningReset = (slug: GameSlug, stage: number) => {
    resetLabTuning(slug, stage);
    setTunings(getAllLabTunings());
  };

  const handleResetPlateauAttempts = (slug: GameSlug) => {
    resetPlateauAttempts(slug);
    setPlateauMap(getAllPlateauAttempts());
    setTunings(getAllLabTunings());
  };

  const startTest = (slug: GameSlug, stage: number) => {
    const safeStage = Math.max(1, Math.min(30, Math.floor(stage)));
    setSelectedSlug(slug);
    setSelectedLevel(safeStage);
    setActiveTest({ slug, stage: safeStage });
  };

  const handleTestComplete = async (result: ComputedSessionResult) => {
    const effectiveUsed = getEffectiveLabTuning(result.gameSlug, result.stagePlayed);
    const customTuning = isLabTuningModified(result.gameSlug, result.stagePlayed, effectiveUsed)
      ? effectiveUsed
      : undefined;
    appendCalibrationLog({
      userId: 'lab-adm',
      userName: 'Referência ADM',
      isAdmin: true,
      isSandbox: true,
      ageBracket,
      result,
      tuning: customTuning,
    });
    setLogs(getCalibrationLogs());

    // No Platô (Nv. 13), guarda até 3 tentativas e recalcula as barras automaticamente pela média
    if (result.stagePlayed === 13) {
      recordPlateauAttempt({
        slug: result.gameSlug,
        hits: result.hits ?? 0,
        targetHits: result.targetHits ?? effectiveUsed.targetHits,
        accuracyPct: result.accuracyPct,
        timeRemainingMs: result.timeRemainingMs,
        completedEarly: result.completedEarly,
        tuningUsed: effectiveUsed,
      });
      setPlateauMap(getAllPlateauAttempts());
      setTunings(getAllLabTunings());
    }
  };

  const handleCopyLog = async () => {
    if (logs.length === 0 && tunedCount === 0) return;
    const text = formatCalibrationLogForChat(logs);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(LAST_SENT_AT_KEY, nowIso);
    } catch {
      // ignora
    }
    setLastSentAt(nowIso);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const handleClearLog = () => {
    clearCalibrationLogs();
    try {
      localStorage.removeItem(LAST_SENT_AT_KEY);
    } catch {
      // ignora
    }
    setLastSentAt(null);
    setLogs([]);
  };

  if (activeTest) {
    return (
      <GameShell
        slug={activeTest.slug}
        stage={activeTest.stage}
        easeBoost={false}
        mode="free"
        theme={theme}
        ageBracket={ageBracket}
        isAdminSession={true}
        sandboxMode={true}
        weakestTwo={[]}
        nextChallengeLabel={activeTest.stage < 20 ? `Testar Nível ${activeTest.stage + 1}` : undefined}
        onNextChallenge={
          activeTest.stage < 20
            ? () => startTest(activeTest.slug, activeTest.stage + 1)
            : undefined
        }
        onTestMaxLevel={
          activeTest.stage !== 13
            ? () => startTest(activeTest.slug, 13)
            : () => startTest(activeTest.slug, 30)
        }
        sandboxJumpLabel={activeTest.stage !== 13 ? 'Platô (Nv. 13)' : 'Último (Nv. 20)'}
        labTuning={currentTuning}
        onLabTuningChange={(next) => handleTuningChange(activeTest.slug, activeTest.stage, next)}
        onLabTuningReset={() => handleTuningReset(activeTest.slug, activeTest.stage)}
        plateauAttempts={activeTest.stage === 13 ? plateauMap[activeTest.slug] ?? [] : undefined}
        onResetPlateauAttempts={
          activeTest.stage === 13 ? () => handleResetPlateauAttempts(activeTest.slug) : undefined
        }
        onComplete={handleTestComplete}
        onPlayNext={(nextStage) => startTest(activeTest.slug, nextStage)}
        onExit={() => {
          setLogs(getCalibrationLogs());
          setActiveTest(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex justify-center">
      <div
        className="w-full max-w-[480px] min-h-screen flex flex-col sm:border-x sm:shadow-xl"
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
      >
        {/* Cabeçalho do Laboratório */}
        <header
          className="sticky top-0 z-20 px-5 py-3.5 flex items-center justify-between gap-2 backdrop-blur-md"
          style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(139, 92, 246, 0.14)', color: '#7C3AED' }}
            >
              <FlaskConical size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-extrabold leading-tight truncate">
                NeuroLab · Laboratório
              </h1>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                Balanceio dos 30 exercícios (1 a 20)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="w-10 h-10 rounded-2xl flex items-center justify-center btn-soft cursor-pointer shrink-0"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className="flex-1 px-5 py-5 flex flex-col gap-5">
          {/* Seletor de Exercício + Nível (1..20) */}
          <section className="surface-card p-5 flex flex-col gap-4">
            {/* Faixa etária de referência */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                Faixa etária
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {AGE_BRACKET_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAgeBracket(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      ageBracket === opt.id ? 'btn-accent' : 'btn-soft'
                    }`}
                  >
                    {opt.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro por domínio */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setDomainFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  domainFilter === 'all' ? 'btn-accent' : 'btn-soft'
                }`}
              >
                Todos (30)
              </button>
              {DOMAIN_LIST.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => {
                    setDomainFilter(d.key);
                    const first = GAMES_BY_DOMAIN[d.key]?.[0];
                    if (first) setSelectedSlug(first.slug);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    domainFilter === d.key ? 'btn-accent' : 'btn-soft'
                  }`}
                >
                  {d.shortName}
                </button>
              ))}
            </div>

            {/* Grade de exercícios com contador de níveis testados e alertas */}
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-0.5">
              {visibleGames.map((g) => {
                const dom = DOMAIN_MAP[g.domain];
                const active = selectedSlug === g.slug;
                const info = testedLevelsByGame.get(g.slug);
                const testedCount = info?.levels.size ?? 0;
                const gameAlertsCount = info?.alertLevels.size ?? 0;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => setSelectedSlug(g.slug)}
                    className="rounded-2xl p-3 flex items-center gap-2.5 text-left cursor-pointer transition-all"
                    style={{
                      background: active ? 'var(--accent-glow)' : 'var(--bg-subtle)',
                      border: active
                        ? '1.5px solid var(--accent)'
                        : gameAlertsCount > 0
                          ? '1px solid rgba(245, 158, 11, 0.38)'
                          : '1px solid transparent',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${dom.color}18`, color: dom.color }}
                    >
                      <GameIcon slug={g.slug} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-tight truncate">{g.name}</div>
                      <div className="text-[11px] truncate mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-soft)' }}>
                        <span>{dom.shortName}</span>
                        {gameAlertsCount > 0 ? (
                          <span className="font-bold" style={{ color: 'var(--warn)' }}>
                            · ⚠️{gameAlertsCount}
                          </span>
                        ) : testedCount > 0 ? (
                          <span className="font-bold" style={{ color: 'var(--ok)' }}>
                            · ✓{testedCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Resumo dos níveis já testados e eventuais distorções neste exercício */}
            {selectedTestedSorted.length > 0 && (
              <div
                className="rounded-xl px-3.5 py-2.5 text-xs flex flex-col gap-1"
                style={{
                  background:
                    selectedAlertsSorted.length > 0
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(16, 185, 129, 0.10)',
                  border:
                    selectedAlertsSorted.length > 0
                      ? '1px solid rgba(245, 158, 11, 0.34)'
                      : '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold" style={{ color: 'var(--ok)' }}>
                    ✓ Feitos: {selectedTestedSorted.map((n) => `Nv.${n}`).join(', ')}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {allSelectedSent ? 'Log já copiado' : 'Pendente copiar log'}
                  </span>
                </div>
                {selectedAlertsSorted.length > 0 && (
                  <div className="font-bold" style={{ color: 'var(--warn)' }}>
                    ⚠️ Distorção detectada: {selectedAlertsSorted.map((n) => `Nv.${n}`).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Grade de níveis 1..20 com ✓ verde (OK), ⚠️ amarelo (distorção) ou ponto roxo (calibrado) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                <span className="font-bold">Nível: {selectedLevel}/30</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedLevel(1)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      selectedLevel === 1 ? 'btn-accent' : 'btn-soft'
                    }`}
                  >
                    Nv. 1 · Piso
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLevel(13)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      selectedLevel === 13 ? 'btn-accent' : 'btn-soft'
                    }`}
                  >
                    Nv. 13 · Platô
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 20 }, (_, i) => i + 1).map((lvl) => {
                  const isDone = selectedTestedInfo?.levels.has(lvl) ?? false;
                  const hasAlert = selectedTestedInfo?.alertLevels.has(lvl) ?? false;
                  const isTuned = Boolean(tunings[getLabTuningKey(selectedSlug, lvl)]);
                  const isSelected = selectedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedLevel(lvl)}
                      className={`h-10 rounded-xl text-xs font-extrabold tabular cursor-pointer transition-all relative flex items-center justify-center gap-0.5 ${
                        isSelected ? 'btn-accent' : 'btn-soft'
                      }`}
                      style={
                        !isSelected && hasAlert
                          ? {
                              background: 'rgba(245, 158, 11, 0.16)',
                              color: 'var(--warn)',
                              border: '1px solid rgba(245, 158, 11, 0.42)',
                            }
                          : !isSelected && isDone
                            ? {
                                background: 'rgba(16, 185, 129, 0.14)',
                                color: 'var(--ok)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                              }
                            : undefined
                      }
                    >
                      <span>{lvl}</span>
                      {hasAlert ? (
                        <AlertTriangle size={11} strokeWidth={2.6} />
                      ) : isDone ? (
                        <Check size={11} strokeWidth={3} />
                      ) : null}
                      {isTuned && (
                        <span
                          className="w-2 h-2 rounded-full absolute top-1 right-1"
                          style={{ background: isSelected ? '#FFFFFF' : '#7C3AED' }}
                          title="Nível com ajuste real salvo"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 barras reais de ajuste (Dificuldade, Velocidade e Meta) */}
            <LabTuningPanel
              slug={selectedGame.slug}
              stage={selectedLevel}
              tuning={currentTuning}
              onChange={(next) => handleTuningChange(selectedGame.slug, selectedLevel, next)}
              onReset={() => handleTuningReset(selectedGame.slug, selectedLevel)}
              plateauAttempts={selectedLevel === 13 ? plateauMap[selectedGame.slug] ?? [] : undefined}
              onResetPlateauAttempts={
                selectedLevel === 13
                  ? () => handleResetPlateauAttempts(selectedGame.slug)
                  : undefined
              }
            />

            {/* Ação principal */}
            <button
              type="button"
              onClick={() => startTest(selectedGame.slug, selectedLevel)}
              className="w-full min-h-[54px] py-4 px-5 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={17} fill="currentColor" />
              <span className="truncate">
                Testar {selectedGame.name} · Nível {selectedLevel}
              </span>
            </button>

            <div className="text-xs text-center" style={{ color: 'var(--text-soft)' }}>
              {selectedDomain.name} · {selectedGame.shortTip} · 30s
            </div>
          </section>

          {/* Log Simples de Balanceio */}
          <section className="surface-card p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold inline-flex items-center gap-1.5">
                <FileText size={15} style={{ color: 'var(--accent)' }} />
                <span>Log de Balanceio ({logs.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {tunedCount > 0 && (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold tabular"
                    style={{ background: 'rgba(139, 92, 246, 0.14)', color: '#7C3AED' }}
                  >
                    {tunedCount} {tunedCount === 1 ? 'ajuste' : 'ajustes'}
                  </span>
                )}
                {alertsCount > 0 && (
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold tabular inline-flex items-center gap-1"
                    style={{ background: 'rgba(245, 158, 11, 0.16)', color: 'var(--warn)' }}
                  >
                    <AlertTriangle size={12} />
                    <span>{alertsCount}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={logs.length === 0 && tunedCount === 0}
                onClick={() => void handleCopyLog()}
                className="min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-bold btn-accent cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? 'Copiado!' : 'Copiar Log'}</span>
              </button>

              <button
                type="button"
                disabled={logs.length === 0}
                onClick={handleClearLog}
                className="min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold btn-soft cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={15} />
                <span>Limpar</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs text-center py-2" style={{ color: 'var(--text-soft)' }}>
                Faça um teste acima para começar o relato.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-0.5">
                {logs.slice(0, 25).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl p-3 text-xs flex flex-col gap-1"
                    style={{
                      background: entry.alerts.length > 0 ? 'rgba(245, 158, 11, 0.10)' : 'var(--bg-subtle)',
                      border:
                        entry.alerts.length > 0
                          ? '1px solid rgba(245, 158, 11, 0.28)'
                          : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span className="truncate">
                        {entry.gameName} · Nv.{entry.stagePlayed}
                      </span>
                      <span className="tabular shrink-0" style={{ color: 'var(--accent)' }}>
                        Sup. {entry.levelPercentile}%
                      </span>
                    </div>
                    <div className="tabular" style={{ color: 'var(--text-muted)' }}>
                      {entry.hits}/{entry.targetHits} · {entry.accuracyPct}% · {entry.rtMeanMs}ms · sobra{' '}
                      {(entry.timeRemainingMs / 1000).toFixed(1)}s
                    </div>
                    {entry.tuning && (
                      <div className="text-[11px] font-bold tabular" style={{ color: '#7C3AED' }}>
                        Ajuste: {formatTuningShort(entry.tuning)}
                      </div>
                    )}
                    {(entry.feedback?.difficulty || entry.feedback?.note) && (
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>
                        {entry.feedback.difficulty
                          ? `Nota ${entry.feedback.difficulty}/5 (${DIFFICULTY_LABELS[entry.feedback.difficulty]})`
                          : ''}
                        {entry.feedback.difficulty && entry.feedback.note ? ' · ' : ''}
                        {entry.feedback.note ? `"${entry.feedback.note}"` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

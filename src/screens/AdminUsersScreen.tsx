import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Database,
  Flame,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import type { AgeBracket } from '../types/cognitive';
import { DOMAIN_LIST } from '../engine/gameRegistry';
import { AGE_BRACKET_OPTIONS, getAgeBracketMeta } from '../engine/psychometricEngine';
import type { LocalUserSummary } from '../lib/localUserDb';
import {
  clearLocalTelemetryEvents,
  fetchTelemetrySummary,
  formatTelemetryReportForChat,
  type GameBalanceStatus,
  type TelemetrySummary,
} from '../lib/telemetryService';

interface AdminUsersScreenProps {
  users: LocalUserSummary[];
  activeUserId: string;
  backendOnline?: boolean;
  onSelectUser: (userId: string) => void;
  onCreateUser: (name: string, ageBracket: AgeBracket) => void;
  onResetDb: () => void;
  onClose: () => void;
}

type SortMode = 'index' | 'sessions' | 'streak';
type AdminTab = 'users' | 'telemetry';

const STATUS_META: Record<GameBalanceStatus, { label: string; bg: string; color: string }> = {
  too_easy: { label: 'Muito fácil', bg: 'rgba(14, 165, 233, 0.16)', color: '#0284C7' },
  too_hard: { label: 'Muito difícil', bg: 'rgba(239, 68, 68, 0.16)', color: 'var(--err)' },
  high_abandon: { label: 'Alto abandono', bg: 'rgba(245, 158, 11, 0.18)', color: 'var(--warn)' },
  balanced: { label: 'Equilibrado', bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--ok)' },
};

export function AdminUsersScreen({
  users,
  activeUserId,
  backendOnline = false,
  onSelectUser,
  onCreateUser,
  onResetDb,
  onClose,
}: AdminUsersScreenProps) {
  const [adminTab, setAdminTab] = useState<AdminTab>('users');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('index');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState<AgeBracket>('25-34');
  const [confirmReset, setConfirmReset] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetrySummary | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const loadTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const summary = await fetchTelemetrySummary(backendOnline);
      setTelemetry(summary);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'telemetry') {
      void loadTelemetry();
    }
  }, [adminTab, backendOnline]);

  const handleCopyReport = async () => {
    if (!telemetry) return;
    const text = formatTelemetryReportForChat(telemetry);
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
    setCopiedReport(true);
    window.setTimeout(() => setCopiedReport(false), 2000);
  };

  const totalSessions = useMemo(
    () => users.reduce((acc, u) => acc + u.totalSessions, 0),
    [users]
  );

  const avgGlobalPct = useMemo(() => {
    const measured = users.filter((u) => u.globalPct > 0);
    if (measured.length === 0) return 0;
    return Math.round(measured.reduce((acc, u) => acc + u.globalPct, 0) / measured.length);
  }, [users]);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.archetypeTitle.toLowerCase().includes(q) ||
            u.ageBracket.includes(q)
        )
      : users;

    return [...filtered].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      if (sortBy === 'sessions') return b.totalSessions - a.totalSessions;
      if (sortBy === 'streak') return b.streak - a.streak;
      return b.globalPct - a.globalPct;
    });
  }, [users, query, sortBy]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateUser(newName.trim(), newAge);
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div className="flex flex-col gap-5 animate-pop">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl flex items-center justify-center btn-soft cursor-pointer shrink-0"
            title="Voltar"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-tight inline-flex items-center gap-1.5">
              <Shield size={17} style={{ color: 'var(--accent)' }} />
              <span className="truncate">Painel ADM · Usuários</span>
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Toque em qualquer conta para testar como ela
            </p>
          </div>
        </div>

        {adminTab === 'users' && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="h-10 px-3.5 rounded-2xl text-xs font-bold btn-accent cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={15} />
            <span>Novo</span>
          </button>
        )}
      </div>

      {/* Seletor de abas: Perfis locais vs Telemetria */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`h-11 rounded-2xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 ${
            adminTab === 'users' ? 'btn-accent' : 'btn-soft'
          }`}
        >
          <Users size={15} />
          <span>Perfis ({users.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('telemetry')}
          className={`h-11 rounded-2xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 ${
            adminTab === 'telemetry' ? 'btn-accent' : 'btn-soft'
          }`}
        >
          <Activity size={15} />
          <span>Telemetria</span>
        </button>
      </div>

      {adminTab === 'telemetry' ? (
        <div className="flex flex-col gap-4 animate-pop">
          <div className="surface-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold"
                style={{ color: telemetry?.source === 'supabase' ? 'var(--ok)' : 'var(--accent)' }}
              >
                <Database size={14} />
                <span>
                  {telemetry?.source === 'supabase'
                    ? 'Supabase · Usuários reais (30 dias)'
                    : 'Base Local · Interações deste navegador'}
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void loadTelemetry()}
                  className="h-8 px-2.5 rounded-xl text-xs font-semibold btn-soft cursor-pointer inline-flex items-center gap-1"
                  title="Atualizar"
                >
                  <RefreshCw size={13} className={loadingTelemetry ? 'animate-spin' : ''} />
                  <span>Atualizar</span>
                </button>
                <button
                  type="button"
                  disabled={!telemetry || telemetry.totalInteractions === 0}
                  onClick={() => void handleCopyReport()}
                  className="h-8 px-2.5 rounded-xl text-xs font-bold btn-accent cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
                >
                  {copiedReport ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedReport ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-center">
              <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xl font-extrabold tabular">{telemetry?.totalInteractions ?? 0}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>
                  Interações ({telemetry?.distinctUsers ?? 0} usr)
                </div>
              </div>
              <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xl font-extrabold tabular" style={{ color: 'var(--ok)' }}>
                  {telemetry?.completionRatePct ?? 0}%
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Conclusão</div>
              </div>
              <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xl font-extrabold tabular" style={{ color: 'var(--warn)' }}>
                  {telemetry?.abandonRatePct ?? 0}%
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Abandono</div>
              </div>
              <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
                <div className="text-xl font-extrabold tabular" style={{ color: 'var(--accent)' }}>
                  {telemetry?.avgAccuracyPct ?? 0}%
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Precisão média</div>
              </div>
            </div>
          </div>

          {telemetry && telemetry.byAgeBracket.length > 0 && (
            <div className="surface-card p-5 flex flex-col gap-3">
              <div className="text-sm font-bold">Comportamento por Faixa Etária</div>
              <div className="flex flex-col gap-2">
                {telemetry.byAgeBracket.map((a) => (
                  <div
                    key={a.ageBracket}
                    className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs tabular"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <span className="font-bold">{a.ageBracket} anos</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {a.total}x · Concl {a.completionRatePct}% · Prec {a.avgAccuracyPct}% · {a.avgRtMs}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="surface-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-bold inline-flex items-center gap-1.5">
                <AlertTriangle size={15} style={{ color: 'var(--warn)' }} />
                <span>Balanceamento por Exercício</span>
              </div>
              <button
                type="button"
                onClick={() => setOnlyAlerts((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  onlyAlerts ? 'btn-accent' : 'btn-soft'
                }`}
              >
                {onlyAlerts ? 'Só alertas' : 'Todos'}
              </button>
            </div>

            {!telemetry || telemetry.byGame.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                Ainda sem interações registradas. Jogue qualquer exercício para começar a captar telemetria.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {telemetry.byGame
                  .filter((g) => (!onlyAlerts ? true : g.status !== 'balanced'))
                  .map((g) => {
                    const meta = STATUS_META[g.status];
                    return (
                      <div
                        key={g.gameSlug}
                        className="rounded-2xl p-3.5 flex flex-col gap-1.5"
                        style={{ background: 'var(--bg-subtle)' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold truncate">{g.gameName}</span>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-xs tabular flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-muted)' }}>
                          <span>{g.total}x</span>
                          <span>Prec {g.avgAccuracyPct}%</span>
                          <span>RT {g.avgRtMs}ms</span>
                          <span>Sobra {(g.avgRemainingMs / 1000).toFixed(1)}s</span>
                          <span>Aband {g.abandonRatePct}%</span>
                          <span>Ajuda {g.helpRatePct}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {telemetry?.source === 'local' && telemetry.totalInteractions > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearLocalTelemetryEvents();
                  void loadTelemetry();
                }}
                className="mt-1 h-10 rounded-xl text-xs font-semibold btn-soft cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Limpar telemetria local</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>

      {/* Resumo da base local */}
      <div className="surface-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-2 font-bold" style={{ color: 'var(--ok)' }}>
            <Database size={15} />
            <span>Base Local · 0 consumo Supabase</span>
          </span>
          <span className="tabular font-semibold" style={{ color: 'var(--text-soft)' }}>
            {users.length} perfis
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
            <div className="text-xl font-extrabold tabular">{users.length}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Usuários</div>
          </div>
          <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
            <div className="text-xl font-extrabold tabular" style={{ color: 'var(--accent)' }}>
              {avgGlobalPct}%
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Média</div>
          </div>
          <div className="rounded-2xl py-3 px-2" style={{ background: 'var(--bg-subtle)' }}>
            <div className="text-xl font-extrabold tabular" style={{ color: 'var(--ok)' }}>
              {totalSessions}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-soft)' }}>Sessões</div>
          </div>
        </div>
      </div>

      {/* Formulário rápido de novo usuário zerado */}
      {showCreate && (
        <form onSubmit={handleCreateSubmit} className="surface-card p-5 flex flex-col gap-3.5 animate-pop">
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              Novo usuário real (começa zerado)
            </div>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Inicia em 0% em todos os domínios e abre direto a conversa de anamnese com o usuário.
            </p>
          </div>
          <input
            type="text"
            placeholder="Nome do usuário (ex: Pedro Rocha)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-[15px] outline-none"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <div className="flex flex-wrap gap-2">
            {AGE_BRACKET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setNewAge(opt.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  newAge === opt.id ? 'btn-accent' : 'btn-soft'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="min-h-[46px] py-3 rounded-2xl text-sm font-semibold btn-soft cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!newName.trim()}
              className="min-h-[46px] py-3 rounded-2xl text-sm font-bold btn-accent cursor-pointer disabled:opacity-40"
            >
              Criar e iniciar anamnese
            </button>
          </div>
        </form>
      )}

      {/* Busca e ordenação */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-soft)' }}
          />
          <input
            type="text"
            placeholder="Buscar usuário..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm outline-none"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'var(--card-shadow)',
            }}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(
            [
              { id: 'index', label: 'Maior índice' },
              { id: 'sessions', label: 'Mais sessões' },
              { id: 'streak', label: 'Maior sequência' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSortBy(s.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                sortBy === s.id ? 'btn-accent' : 'btn-soft'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Usuários */}
      <div className="flex flex-col gap-3">
        {visibleUsers.map((u) => {
          const isActive = u.id === activeUserId;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectUser(u.id)}
              className="surface-card surface-card-click p-4 sm:p-5 flex flex-col gap-3.5 text-left cursor-pointer"
              style={
                isActive
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-glow)' }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[16px] font-bold truncate">{u.name}</span>
                    {u.isAdmin && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
                      >
                        ADM
                      </span>
                    )}
                    {isActive && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(16, 185, 129, 0.16)', color: 'var(--ok)' }}
                      >
                        Ativo
                      </span>
                    )}
                    {u.totalSessions === 0 && u.globalPct === 0 && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                      >
                        Zerado
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                    {getAgeBracketMeta(u.ageBracket).label} · {u.archetypeTitle}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-xl font-extrabold tabular leading-none">{u.globalPct}%</div>
                    <div className="text-xs tabular mt-1 inline-flex items-center gap-1" style={{ color: 'var(--text-soft)' }}>
                      <Flame size={12} style={{ color: 'var(--warn)' }} />
                      <span>{u.streak}d · {u.totalSessions}x</span>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-soft)' }} />
                </div>
              </div>

              {/* Mini-barras dos 6 domínios com boa leitura */}
              <div className="grid grid-cols-3 gap-2">
                {DOMAIN_LIST.map((d) => {
                  const pct = u.domainPcts[d.key] ?? 0;
                  return (
                    <div key={d.key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs tabular">
                        <span className="truncate font-medium" style={{ color: 'var(--text-muted)' }}>
                          {d.shortName}
                        </span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: d.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}

        {visibleUsers.length === 0 && (
          <div className="surface-card p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            <Users size={22} className="mx-auto mb-2" />
            Nenhum usuário encontrado com "{query}".
          </div>
        )}
      </div>

      {/* Restaurar base fictícia */}
      <div className="pt-1">
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="w-full min-h-[48px] py-3.5 rounded-2xl text-sm font-semibold btn-soft cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Restaurar usuários fictícios originais</span>
          </button>
        ) : (
          <div className="surface-card p-5 flex flex-col gap-3 text-center">
            <div className="text-sm font-bold">
              Reiniciar os 8 perfis fictícios locais para o estado inicial?
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[46px] py-3 rounded-2xl text-sm font-semibold btn-soft cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetDb();
                }}
                className="min-h-[46px] py-3 rounded-2xl text-sm font-bold cursor-pointer"
                style={{ background: 'rgba(239, 68, 68, 0.14)', color: 'var(--err)' }}
              >
                Sim, restaurar
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

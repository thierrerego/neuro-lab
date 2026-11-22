import { useState } from 'react';
import { Sparkles, Target, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ThemeMode } from '../types/cognitive';

interface AuthScreenProps {
  backendOnline: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onGuestLogin: () => void;
  onRemoteLogin: (userId: string, email?: string) => Promise<void>;
}

export function AuthScreen({
  backendOnline,
  theme,
  onToggleTheme,
  onGuestLogin,
  onRemoteLogin,
}: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || password.length < 6) {
      setError('E-mail válido e senha (6+ dígitos).');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data.user) {
          await onRemoteLogin(data.user.id, data.user.email);
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data.user) {
          await onRemoteLogin(data.user.id, data.user.email);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação local.';
      setError(backendOnline ? msg : 'Docker offline — use Acesso Rápido Local.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[390px] flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: backendOnline ? 'var(--ok)' : 'var(--warn)' }} />
            {backendOnline ? 'Docker Online' : 'Modo Local'}
          </span>
          <button
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center btn-soft cursor-pointer"
            style={{ color: 'var(--accent)' }}
          >
            {theme === 'gamified' ? <Target size={16} /> : <Sparkles size={16} />}
          </button>
        </div>

        <div className="text-center py-4">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center font-black text-3xl text-white mb-4"
            style={{ background: 'var(--accent-grad)', boxShadow: '0 10px 30px var(--accent-glow)' }}
          >
            N
          </div>
          <h1 className="text-3xl font-black tracking-tight">NeuroLab</h1>
        </div>

        <button
          onClick={onGuestLogin}
          className="w-full py-4 rounded-2xl font-extrabold text-base btn-accent flex items-center justify-center gap-2 cursor-pointer"
        >
          <Zap size={18} />
          <span>Acesso Rápido Local</span>
        </button>

        <form onSubmit={handleSubmit} className="surface-card p-4 flex flex-col gap-2.5">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <input
            type="password"
            placeholder="Senha (6+)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          {error && <div className="text-xs font-semibold text-center" style={{ color: 'var(--err)' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm btn-soft cursor-pointer disabled:opacity-50"
          >
            {loading ? '...' : isSignUp ? 'Criar conta local' : 'Entrar com conta'}
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp((v) => !v)}
            className="text-xs font-semibold py-1 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            {isSignUp ? 'Já tenho conta' : 'Criar conta'}
          </button>
        </form>

        <p className="text-[11px] text-center" style={{ color: 'var(--text-soft)' }}>
          Treino cognitivo recreativo · Sem finalidade médica
        </p>
      </div>
    </div>
  );
}

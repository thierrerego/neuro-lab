import { useState } from 'react';
import { Lock, Moon, ShieldCheck, Sun, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ThemeMode } from '../types/cognitive';

interface AuthScreenProps {
  backendOnline: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onGuestLogin: () => void;
  onRemoteLogin: (userId: string, email?: string, displayName?: string) => Promise<void>;
}

function usernameToAuthEmail(raw: string): { email: string; cleanUser: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    const clean = trimmed.toLowerCase();
    return { email: clean, cleanUser: clean.split('@')[0] || 'Participante' };
  }
  const slug = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (slug.length < 3) return null;
  return { email: `${slug}@neurolab.local`, cleanUser: trimmed };
}

function translateAuthError(message: string, backendOnline: boolean): string {
  if (!backendOnline) return 'Banco Docker offline — use o modo local ou ligue o Docker no PC.';
  const low = message.toLowerCase();
  if (low.includes('invalid login credentials')) return 'Usuário ou senha incorretos.';
  if (low.includes('user already registered') || low.includes('already been registered')) {
    return 'Esse usuário já existe. Troque para "Entrar" para acessar sua conta.';
  }
  if (low.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (low.includes('failed to fetch') || low.includes('network')) {
    return 'Sem conexão com o banco local. Verifique se o Docker está ligado.';
  }
  return message;
}

export function AuthScreen({
  backendOnline,
  theme,
  onToggleTheme,
  onGuestLogin,
  onRemoteLogin,
}: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = usernameToAuthEmail(username);
    if (!parsed) {
      setError('Digite um usuário com pelo menos 3 letras ou números.');
      return;
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error: err } = await supabase.auth.signUp({
          email: parsed.email,
          password,
          options: { data: { username: parsed.cleanUser } },
        });
        if (err) throw err;
        if (data.user) {
          await onRemoteLogin(data.user.id, data.user.email, parsed.cleanUser);
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password,
        });
        if (err) throw err;
        if (data.user) {
          await onRemoteLogin(data.user.id, data.user.email, parsed.cleanUser);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na autenticação.';
      setError(translateAuthError(msg, backendOnline));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[380px] flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: backendOnline ? 'var(--ok)' : 'var(--warn)' }} />
            {backendOnline ? 'Supabase Local Ativo' : 'Modo Local'}
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center btn-soft cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <div className="text-center py-2">
          <div
            className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center font-black text-2xl mb-3"
            style={{ background: 'var(--accent-grad)', color: 'var(--btn-fg)' }}
          >
            N
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">NeuroLab</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Treinamento cognitivo científico e acompanhamento psicométrico
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg)' }}>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${!isSignUp ? 'btn-accent' : ''}`}
              style={!isSignUp ? undefined : { color: 'var(--text-muted)' }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${isSignUp ? 'btn-accent' : ''}`}
              style={isSignUp ? undefined : { color: 'var(--text-muted)' }}
            >
              Criar conta
            </button>
          </div>

          <div className="relative">
            <User
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-soft)' }}
            />
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="Usuário (ex: thierre)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-soft)' }}
            />
            <input
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="Senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          {error && (
            <div className="text-xs font-medium text-center px-2" style={{ color: 'var(--err)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm btn-accent cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ShieldCheck size={15} />
            <span>{loading ? 'Conectando...' : isSignUp ? 'Criar conta e iniciar' : 'Entrar'}</span>
          </button>

          <p className="text-[11px] text-center leading-snug" style={{ color: 'var(--text-soft)' }}>
            Dados salvos no seu banco local e sincronizados entre dispositivos.
          </p>
        </form>

        <button
          type="button"
          onClick={onGuestLogin}
          className="w-full py-3 rounded-xl font-semibold text-xs btn-soft cursor-pointer"
        >
          Continuar sem conta (salvar apenas neste aparelho)
        </button>

        <p className="text-[11px] text-center" style={{ color: 'var(--text-soft)' }}>
          Treinamento cognitivo pessoal · Sem finalidade diagnóstica médica
        </p>
      </div>
    </div>
  );
}

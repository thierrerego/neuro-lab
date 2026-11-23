import { useState } from 'react';
import { Lock, Moon, ShieldCheck, Sun, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { signInLocalAccount, signUpLocalAccount } from '../lib/localUserDb';
import type { AppDataState } from '../lib/dataService';
import type { ThemeMode } from '../types/cognitive';

interface AuthScreenProps {
  backendOnline: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onGuestLogin: () => void;
  onLocalAccountLogin: (state: AppDataState) => void;
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
  onLocalAccountLogin,
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

    // Quando não há Supabase remoto/Docker ligado (ex.: GitHub Pages), salva contas locais com usuário + senha
    if (!backendOnline) {
      setLoading(true);
      try {
        const accountState = isSignUp
          ? signUpLocalAccount(username, password)
          : signInLocalAccount(username, password);
        onLocalAccountLogin(accountState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao acessar conta.');
      } finally {
        setLoading(false);
      }
      return;
    }

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
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] flex flex-col gap-6 animate-pop">
        <div className="flex justify-between items-center">
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: backendOnline ? 'var(--ok)' : 'var(--accent)' }}
            />
            {backendOnline ? 'Servidor Conectado' : 'Contas no Aparelho'}
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-all"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              boxShadow: 'var(--card-shadow)',
            }}
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="text-center py-2">
          <div
            className="w-16 h-16 mx-auto rounded-[20px] flex items-center justify-center font-extrabold text-3xl mb-4"
            style={{
              background: 'var(--accent-grad)',
              color: 'var(--btn-fg)',
              boxShadow: '0 10px 26px var(--accent-shadow)',
            }}
          >
            N
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">NeuroLab</h1>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Treinamento cognitivo científico e acompanhamento psicométrico
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-card p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 p-1.5 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError('');
              }}
              className="py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
              style={{
                background: !isSignUp ? 'var(--bg-card)' : 'transparent',
                color: !isSignUp ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: !isSignUp ? 'var(--card-shadow)' : 'none',
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError('');
              }}
              className="py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
              style={{
                background: isSignUp ? 'var(--bg-card)' : 'transparent',
                color: isSignUp ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: isSignUp ? 'var(--card-shadow)' : 'none',
              }}
            >
              Criar conta
            </button>
          </div>

          <div className="relative">
            <User
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
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
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-[15px] outline-none"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div className="relative">
            <Lock
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-soft)' }}
            />
            <input
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder={backendOnline ? 'Senha (mín. 6 caracteres)' : 'Senha (mín. 4 caracteres)'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-[15px] outline-none"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {error && (
            <div className="text-sm font-medium text-center px-2" style={{ color: 'var(--err)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[54px] py-4 rounded-2xl font-bold text-[15px] btn-accent cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} />
            <span>{loading ? 'Conectando...' : isSignUp ? 'Criar conta e iniciar' : 'Entrar'}</span>
          </button>

          <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-soft)' }}>
            {backendOnline
              ? 'Dados salvos no servidor e sincronizados entre dispositivos.'
              : 'Crie seu usuário e senha — cada pessoa mantém seu próprio histórico salvo neste aparelho.'}
          </p>
        </form>

        {/* Acesso rápido para demonstração */}
        <button
          type="button"
          onClick={onGuestLogin}
          className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl font-semibold text-xs btn-soft flex items-center justify-center gap-2 cursor-pointer"
        >
          <ShieldCheck size={16} className="shrink-0" />
          <span>Entrar como Teste ADM (Demo)</span>
        </button>

        <p className="text-xs text-center" style={{ color: 'var(--text-soft)' }}>
          Treinamento cognitivo pessoal · Sem finalidade diagnóstica médica
        </p>
      </div>
    </div>
  );
}

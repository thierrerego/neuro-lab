import { createClient } from '@supabase/supabase-js';

/**
 * Resolve a URL do Supabase de forma transparente:
 * - Se VITE_SUPABASE_URL apontar para nuvem (ex: *.supabase.co), usa direto.
 * - Em rede local / Tailscale via Vite (porta 5173/4173 ou domínio .ts.net), usa o proxy `/sb`
 *   na mesma origem — assim o celular acessa tudo por uma única porta sem erro de CORS/localhost.
 */
function resolveSupabaseUrl(): string {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const isLocalEnv = !envUrl || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(envUrl);

  if (!isLocalEnv) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const { origin, protocol, hostname, port } = window.location;
    if (port === '5173' || port === '4173' || hostname.endsWith('.ts.net')) {
      return `${origin}/sb`;
    }
    return `${protocol}//${hostname}:54321`;
  }

  return envUrl || 'http://127.0.0.1:54321';
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function checkBackendOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      signal: controller.signal,
      headers: { apikey: supabaseAnonKey },
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

-- =============================================================================
-- NeuroLab — Schema Inicial + Row Level Security (RLS)
-- Compatível com Docker Compose local (Postgres 16) e Supabase Cloud/CLI
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Jogador',
  theme_preference TEXT NOT NULL DEFAULT 'gamified' CHECK (theme_preference IN ('minimal', 'gamified')),
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'elite')),
  global_cognitive_index INTEGER NOT NULL DEFAULT 500,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  calibrated BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_played_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Pontuações dos 6 domínios cognitivos (Linha de Base vs. Atual)
CREATE TABLE IF NOT EXISTS public.domain_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  selective_attention INTEGER NOT NULL DEFAULT 500,
  working_memory INTEGER NOT NULL DEFAULT 500,
  fluid_reasoning INTEGER NOT NULL DEFAULT 500,
  processing_speed INTEGER NOT NULL DEFAULT 500,
  numerical_cognition INTEGER NOT NULL DEFAULT 500,
  inhibitory_control INTEGER NOT NULL DEFAULT 500,
  baseline_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Progresso de fases por minigame (Stage Engine)
CREATE TABLE IF NOT EXISTS public.game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  domain TEXT NOT NULL,
  current_stage INTEGER NOT NULL DEFAULT 1 CHECK (current_stage >= 1),
  highest_score INTEGER NOT NULL DEFAULT 0,
  total_plays INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_game_progress_user_slug UNIQUE (user_id, game_slug)
);

-- 4. Histórico detalhado de sessões cognitivas (métricas psicométricas)
CREATE TABLE IF NOT EXISTS public.cognitive_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  game_slug TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('calibration', 'guided', 'free')),
  stage_played INTEGER NOT NULL DEFAULT 1,
  stage_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_errors INTEGER NOT NULL DEFAULT 0,
  omission_errors INTEGER NOT NULL DEFAULT 0,
  rt_mean_ms INTEGER NOT NULL DEFAULT 0,
  rt_sd_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Protocolo diário adaptativo (3 domínios fracos + 1 manutenção)
CREATE TABLE IF NOT EXISTS public.daily_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  protocol_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recommended_games JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_games JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT uq_daily_protocol_user_date UNIQUE (user_id, protocol_date)
);

-- Índices úteis para consultas longitudinais
CREATE INDEX IF NOT EXISTS idx_sessions_user_created ON public.cognitive_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_domain ON public.cognitive_sessions (user_id, domain);
CREATE INDEX IF NOT EXISTS idx_progress_user ON public.game_progress (user_id);

-- Permissões básicas para roles do PostgREST/Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- =============================================================================
-- Row Level Security (RLS) — cada usuário acessa apenas os próprios dados
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_protocols ENABLE ROW LEVEL SECURITY;

-- Policies: profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Policies: domain_scores
DROP POLICY IF EXISTS "domain_scores_select_own" ON public.domain_scores;
CREATE POLICY "domain_scores_select_own" ON public.domain_scores FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "domain_scores_insert_own" ON public.domain_scores;
CREATE POLICY "domain_scores_insert_own" ON public.domain_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "domain_scores_update_own" ON public.domain_scores;
CREATE POLICY "domain_scores_update_own" ON public.domain_scores FOR UPDATE USING (auth.uid() = user_id);

-- Policies: game_progress
DROP POLICY IF EXISTS "game_progress_select_own" ON public.game_progress;
CREATE POLICY "game_progress_select_own" ON public.game_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "game_progress_insert_own" ON public.game_progress;
CREATE POLICY "game_progress_insert_own" ON public.game_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "game_progress_update_own" ON public.game_progress;
CREATE POLICY "game_progress_update_own" ON public.game_progress FOR UPDATE USING (auth.uid() = user_id);

-- Policies: cognitive_sessions
DROP POLICY IF EXISTS "cognitive_sessions_select_own" ON public.cognitive_sessions;
CREATE POLICY "cognitive_sessions_select_own" ON public.cognitive_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cognitive_sessions_insert_own" ON public.cognitive_sessions;
CREATE POLICY "cognitive_sessions_insert_own" ON public.cognitive_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies: daily_protocols
DROP POLICY IF EXISTS "daily_protocols_select_own" ON public.daily_protocols;
CREATE POLICY "daily_protocols_select_own" ON public.daily_protocols FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "daily_protocols_insert_own" ON public.daily_protocols;
CREATE POLICY "daily_protocols_insert_own" ON public.daily_protocols FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "daily_protocols_update_own" ON public.daily_protocols;
CREATE POLICY "daily_protocols_update_own" ON public.daily_protocols FOR UPDATE USING (auth.uid() = user_id);

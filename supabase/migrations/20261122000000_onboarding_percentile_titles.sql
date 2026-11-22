-- =============================================================================
-- NeuroLab — Migration Incremental: Onboarding Multi-Escolha, Percentil & Alcunhas
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS peak_time TEXT,
  ADD COLUMN IF NOT EXISTS current_title TEXT NOT NULL DEFAULT 'Observador';

ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS accuracy_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS speed_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percentile NUMERIC(4,1) NOT NULL DEFAULT 50.0,
  ADD COLUMN IF NOT EXISTS earned_title TEXT NOT NULL DEFAULT 'Analista';

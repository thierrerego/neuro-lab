-- =============================================================================
-- NeuroLab — Migration Incremental:
-- Faixa Etária, Contextos Múltiplos (JSONB), Modo Claro Gamificado e Nível Zero
-- =============================================================================

-- 1. Novos campos na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_bracket TEXT NOT NULL DEFAULT '25-34',
  ADD COLUMN IF NOT EXISTS application_contexts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Permite tema 'light' (Modo Claro do Gamificado) mantendo compatibilidade
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('gamified', 'light', 'minimal'));

-- 3. Nível Zero (baseStage = 0) como padrão inicial para todos os minigames
ALTER TABLE public.game_progress
  DROP CONSTRAINT IF EXISTS game_progress_current_stage_check;
ALTER TABLE public.game_progress
  ADD CONSTRAINT game_progress_current_stage_check
  CHECK (current_stage >= 0);
ALTER TABLE public.game_progress
  ALTER COLUMN current_stage SET DEFAULT 0;

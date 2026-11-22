-- =============================================================================
-- NeuroLab — Migration Incremental:
-- Remoção completa da camada RPG (batalhas, avatar e jornada) e consolidação
-- do tema Minimalista de Alta Precisão (Modo Escuro / Modo Claro).
-- Mantém intactas as tabelas: profiles, domain_scores, game_progress,
-- cognitive_sessions, daily_protocols e cognitive_snapshots.
-- =============================================================================

-- 1. Remove a tabela de histórico de batalhas RPG (se existir)
DROP TABLE IF EXISTS public.battle_logs CASCADE;

-- 2. Remove colunas obsoletas de RPG da tabela public.profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS avatar_gender,
  DROP COLUMN IF EXISTS avatar_level,
  DROP COLUMN IF EXISTS avatar_xp,
  DROP COLUMN IF EXISTS journey_node;

-- 3. Consolida preferência de tema exclusivamente para 'dark' (padrão) e 'light'
UPDATE public.profiles
SET theme_preference = CASE
  WHEN theme_preference = 'light' THEN 'light'
  ELSE 'dark'
END;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('dark', 'light'));

ALTER TABLE public.profiles
  ALTER COLUMN theme_preference SET DEFAULT 'dark';

-- =============================================================================
-- NeuroLab — Migration Incremental:
-- Sistema de Avatar RPG Sci-Fi Neural, Mapa de Jornada e Batalhas Híbridas
-- =============================================================================

-- 1. Campos de Avatar RPG e Progresso na Jornada em public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_gender TEXT NOT NULL DEFAULT 'male'
    CHECK (avatar_gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS avatar_level INTEGER NOT NULL DEFAULT 1
    CHECK (avatar_level >= 1),
  ADD COLUMN IF NOT EXISTS avatar_xp INTEGER NOT NULL DEFAULT 0
    CHECK (avatar_xp >= 0),
  ADD COLUMN IF NOT EXISTS journey_node INTEGER NOT NULL DEFAULT 1
    CHECK (journey_node >= 1);

-- 2. Histórico de batalhas na Arena Neural
CREATE TABLE IF NOT EXISTS public.battle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_number INTEGER NOT NULL CHECK (node_number >= 1),
  enemy_name TEXT NOT NULL,
  won BOOLEAN NOT NULL DEFAULT FALSE,
  turns_count INTEGER NOT NULL DEFAULT 0,
  weakest_stat_bottleneck TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_logs_user_created
  ON public.battle_logs (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.battle_logs TO authenticated, service_role;

ALTER TABLE public.battle_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "battle_logs_select_own" ON public.battle_logs;
CREATE POLICY "battle_logs_select_own"
  ON public.battle_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "battle_logs_insert_own" ON public.battle_logs;
CREATE POLICY "battle_logs_insert_own"
  ON public.battle_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

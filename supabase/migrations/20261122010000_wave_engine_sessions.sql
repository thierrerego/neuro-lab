-- =============================================================================
-- NeuroLab — Migration Incremental: Motor de 5 Micro-Níveis (Wave Engine)
-- =============================================================================

ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS waves_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_early BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS time_remaining_ms INTEGER NOT NULL DEFAULT 0;

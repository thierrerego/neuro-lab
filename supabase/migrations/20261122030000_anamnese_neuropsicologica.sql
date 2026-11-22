-- =============================================================================
-- NeuroLab — Migration Incremental: Anamnese Neuropsicológica em 5 Etapas
-- Adiciona gargalos comportamentais, fadiga basal (1-5) e contexto de aplicação
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cognitive_bottlenecks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mental_stamina_baseline INTEGER NOT NULL DEFAULT 3
    CHECK (mental_stamina_baseline BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS application_context TEXT;

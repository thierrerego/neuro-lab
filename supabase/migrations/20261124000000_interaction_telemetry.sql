-- =============================================================================
-- NeuroLab — Migration Incremental:
-- Telemetria de Interações Reais (Conclusão, Abandono, Ritmo e Desbalanceamento)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.interaction_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  age_bracket TEXT NOT NULL DEFAULT '25-34',
  domain TEXT NOT NULL,
  game_slug TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'free',
  difficulty_start NUMERIC(5,2) NOT NULL DEFAULT 1,
  difficulty_end NUMERIC(5,2) NOT NULL DEFAULT 1,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'time_up', 'abandoned', 'abandoned_tutorial')),
  hits INTEGER NOT NULL DEFAULT 0,
  target_hits INTEGER NOT NULL DEFAULT 10,
  commission_errors INTEGER NOT NULL DEFAULT 0,
  omission_errors INTEGER NOT NULL DEFAULT 0,
  accuracy_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  rt_mean_ms INTEGER NOT NULL DEFAULT 0,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  time_remaining_ms INTEGER NOT NULL DEFAULT 0,
  help_opens INTEGER NOT NULL DEFAULT 0,
  balance_flag TEXT NOT NULL DEFAULT 'balanced' CHECK (balance_flag IN ('too_easy', 'balanced', 'too_hard')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_game_created
  ON public.interaction_telemetry (game_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_age_created
  ON public.interaction_telemetry (age_bracket, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_outcome
  ON public.interaction_telemetry (outcome, created_at DESC);

GRANT SELECT, INSERT ON public.interaction_telemetry TO authenticated, service_role;

ALTER TABLE public.interaction_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telemetry_insert_own" ON public.interaction_telemetry;
CREATE POLICY "telemetry_insert_own"
  ON public.interaction_telemetry FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telemetry_select_own" ON public.interaction_telemetry;
CREATE POLICY "telemetry_select_own"
  ON public.interaction_telemetry FOR SELECT
  USING (auth.uid() = user_id);

-- Função agregada (sem dados pessoais) para o painel ADM identificar jogos desbalanceados e comportamento por idade
CREATE OR REPLACE FUNCTION public.get_admin_telemetry_summary(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := NOW() - (GREATEST(1, LEAST(365, COALESCE(p_days, 30))) || ' days')::INTERVAL;
  v_total INTEGER := 0;
  v_users INTEGER := 0;
  v_completed INTEGER := 0;
  v_abandoned INTEGER := 0;
  v_avg_acc NUMERIC(5,2) := 0;
  v_by_game JSONB := '[]'::jsonb;
  v_by_age JSONB := '[]'::jsonb;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(DISTINCT user_id)::INTEGER,
    COUNT(*) FILTER (WHERE outcome IN ('completed', 'time_up'))::INTEGER,
    COUNT(*) FILTER (WHERE outcome IN ('abandoned', 'abandoned_tutorial'))::INTEGER,
    COALESCE(ROUND(AVG(accuracy_pct) FILTER (WHERE outcome IN ('completed', 'time_up')), 1), 0)
  INTO v_total, v_users, v_completed, v_abandoned, v_avg_acc
  FROM public.interaction_telemetry
  WHERE created_at >= v_since;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb)
  INTO v_by_game
  FROM (
    SELECT
      jsonb_build_object(
        'gameSlug', game_slug,
        'domain', MIN(domain),
        'total', COUNT(*)::INTEGER,
        'completed', COUNT(*) FILTER (WHERE outcome IN ('completed', 'time_up'))::INTEGER,
        'abandoned', COUNT(*) FILTER (WHERE outcome IN ('abandoned', 'abandoned_tutorial'))::INTEGER,
        'abandonedTutorial', COUNT(*) FILTER (WHERE outcome = 'abandoned_tutorial')::INTEGER,
        'avgAccuracyPct', COALESCE(ROUND(AVG(accuracy_pct) FILTER (WHERE outcome IN ('completed', 'time_up')), 1), 0),
        'avgRtMs', COALESCE(ROUND(AVG(NULLIF(rt_mean_ms, 0)) FILTER (WHERE outcome IN ('completed', 'time_up')))::INTEGER, 0),
        'avgRemainingMs', COALESCE(ROUND(AVG(time_remaining_ms) FILTER (WHERE outcome IN ('completed', 'time_up')))::INTEGER, 0),
        'avgDifficulty', COALESCE(ROUND(AVG(difficulty_end), 2), 1),
        'helpRatePct', COALESCE(ROUND(AVG(CASE WHEN help_opens > 0 THEN 100.0 ELSE 0.0 END), 1), 0),
        'tooEasyCount', COUNT(*) FILTER (WHERE balance_flag = 'too_easy')::INTEGER,
        'tooHardCount', COUNT(*) FILTER (WHERE balance_flag = 'too_hard')::INTEGER
      ) AS row_data,
      COUNT(*) AS total
    FROM public.interaction_telemetry
    WHERE created_at >= v_since
    GROUP BY game_slug
  ) g;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY age_bracket), '[]'::jsonb)
  INTO v_by_age
  FROM (
    SELECT
      age_bracket,
      jsonb_build_object(
        'ageBracket', age_bracket,
        'total', COUNT(*)::INTEGER,
        'completionRatePct', COALESCE(ROUND(AVG(CASE WHEN outcome IN ('completed', 'time_up') THEN 100.0 ELSE 0.0 END), 1), 0),
        'avgAccuracyPct', COALESCE(ROUND(AVG(accuracy_pct) FILTER (WHERE outcome IN ('completed', 'time_up')), 1), 0),
        'avgRtMs', COALESCE(ROUND(AVG(NULLIF(rt_mean_ms, 0)) FILTER (WHERE outcome IN ('completed', 'time_up')))::INTEGER, 0),
        'avgDifficulty', COALESCE(ROUND(AVG(difficulty_end), 2), 1)
      ) AS row_data
    FROM public.interaction_telemetry
    WHERE created_at >= v_since
    GROUP BY age_bracket
  ) a;

  RETURN jsonb_build_object(
    'totalInteractions', v_total,
    'distinctUsers', v_users,
    'completionRatePct', CASE WHEN v_total > 0 THEN ROUND((v_completed::NUMERIC / v_total) * 100, 1) ELSE 0 END,
    'abandonRatePct', CASE WHEN v_total > 0 THEN ROUND((v_abandoned::NUMERIC / v_total) * 100, 1) ELSE 0 END,
    'avgAccuracyPct', v_avg_acc,
    'byGame', v_by_game,
    'byAgeBracket', v_by_age
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_telemetry_summary(INTEGER) TO authenticated, service_role;

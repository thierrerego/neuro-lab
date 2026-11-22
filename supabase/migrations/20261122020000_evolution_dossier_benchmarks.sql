-- =============================================================================
-- NeuroLab — Migration Incremental:
-- Sistema de Evolução Dupla (Game + Mental), Snapshots Diários e Benchmark Global
-- =============================================================================

-- 1. Tabela de retratos diários (snapshots) para curvas longitudinais precisas
CREATE TABLE IF NOT EXISTS public.cognitive_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  global_index INTEGER NOT NULL DEFAULT 500,
  domain_scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  avg_rt_ms INTEGER NOT NULL DEFAULT 0,
  avg_accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
  archetype_title TEXT NOT NULL DEFAULT 'Em Formação',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cognitive_snapshots_user_date UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_cognitive_snapshots_user_date
  ON public.cognitive_snapshots (user_id, snapshot_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cognitive_snapshots TO authenticated, service_role;

ALTER TABLE public.cognitive_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cognitive_snapshots_select_own" ON public.cognitive_snapshots;
CREATE POLICY "cognitive_snapshots_select_own"
  ON public.cognitive_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cognitive_snapshots_insert_own" ON public.cognitive_snapshots;
CREATE POLICY "cognitive_snapshots_insert_own"
  ON public.cognitive_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cognitive_snapshots_update_own" ON public.cognitive_snapshots;
CREATE POLICY "cognitive_snapshots_update_own"
  ON public.cognitive_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Trigger de upsert diário automático a cada nova sessão gravada
CREATE OR REPLACE FUNCTION public.sync_daily_cognitive_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_icg INTEGER := 500;
  v_scores JSONB := '{}'::jsonb;
  v_avg_rt INTEGER := 0;
  v_avg_acc NUMERIC(5,2) := 0;
  v_date DATE := (NEW.created_at AT TIME ZONE 'UTC')::DATE;
BEGIN
  SELECT COALESCE(global_cognitive_index, 500)
    INTO v_icg
    FROM public.profiles
   WHERE id = NEW.user_id;

  SELECT jsonb_build_object(
           'selective_attention', selective_attention,
           'working_memory', working_memory,
           'fluid_reasoning', fluid_reasoning,
           'processing_speed', processing_speed,
           'numerical_cognition', numerical_cognition,
           'inhibitory_control', inhibitory_control
         )
    INTO v_scores
    FROM public.domain_scores
   WHERE user_id = NEW.user_id;

  SELECT COALESCE(ROUND(AVG(NULLIF(rt_mean_ms, 0)))::INTEGER, 0),
         COALESCE(ROUND(AVG(accuracy_pct)::NUMERIC, 2), 0)
    INTO v_avg_rt, v_avg_acc
    FROM public.cognitive_sessions
   WHERE user_id = NEW.user_id
     AND (created_at AT TIME ZONE 'UTC')::DATE = v_date;

  INSERT INTO public.cognitive_snapshots (
    user_id,
    snapshot_date,
    global_index,
    domain_scores_json,
    avg_rt_ms,
    avg_accuracy
  )
  VALUES (
    NEW.user_id,
    v_date,
    COALESCE(v_icg, 500),
    COALESCE(v_scores, '{}'::jsonb),
    v_avg_rt,
    v_avg_acc
  )
  ON CONFLICT (user_id, snapshot_date)
  DO UPDATE SET
    global_index = EXCLUDED.global_index,
    domain_scores_json = EXCLUDED.domain_scores_json,
    avg_rt_ms = EXCLUDED.avg_rt_ms,
    avg_accuracy = EXCLUDED.avg_accuracy;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_daily_cognitive_snapshot ON public.cognitive_sessions;
CREATE TRIGGER trg_sync_daily_cognitive_snapshot
  AFTER INSERT ON public.cognitive_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_daily_cognitive_snapshot();

-- 3. Função RPC híbrida de benchmarks globais (dados reais >= 30 sessões de usuários distintos ou fallback normativo)
CREATE OR REPLACE FUNCTION public.get_global_benchmarks()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_sessions INTEGER := 0;
  v_distinct_users INTEGER := 0;
  v_use_real BOOLEAN := FALSE;
  v_global JSONB;
  v_domains JSONB;
  v_games JSONB;
  v_norm_domains JSONB := '{
    "selective_attention": {"mean": 530, "sd": 150, "p50": 530, "p75": 631, "p90": 722, "p99": 879, "avg_rt_ms": 1120},
    "working_memory":      {"mean": 505, "sd": 155, "p50": 505, "p75": 610, "p90": 704, "p99": 865, "avg_rt_ms": 1240},
    "fluid_reasoning":     {"mean": 498, "sd": 160, "p50": 498, "p75": 606, "p90": 703, "p99": 870, "avg_rt_ms": 1950},
    "processing_speed":    {"mean": 540, "sd": 145, "p50": 540, "p75": 638, "p90": 726, "p99": 877, "avg_rt_ms": 890},
    "numerical_cognition": {"mean": 512, "sd": 158, "p50": 512, "p75": 619, "p90": 714, "p99": 879, "avg_rt_ms": 1480},
    "inhibitory_control":  {"mean": 525, "sd": 152, "p50": 525, "p75": 628, "p90": 720, "p99": 878, "avg_rt_ms": 740}
  }'::jsonb;
  v_norm_games JSONB := '{
    "visual-search":      {"mean": 535, "sd": 150, "p50": 535, "p75": 636, "p90": 727, "p99": 884, "avg_rt_ms": 1100, "early_rate_pct": 36},
    "sustained-tracking": {"mean": 520, "sd": 152, "p50": 520, "p75": 623, "p90": 715, "p99": 874, "avg_rt_ms": 1290, "early_rate_pct": 28},
    "spatial-span":       {"mean": 510, "sd": 155, "p50": 510, "p75": 615, "p90": 709, "p99": 871, "avg_rt_ms": 1220, "early_rate_pct": 30},
    "dual-n-back":        {"mean": 495, "sd": 158, "p50": 495, "p75": 602, "p90": 698, "p99": 863, "avg_rt_ms": 1180, "early_rate_pct": 22},
    "raven-matrices":     {"mean": 492, "sd": 162, "p50": 492, "p75": 601, "p90": 700, "p99": 869, "avg_rt_ms": 2350, "early_rate_pct": 24},
    "path-logic":         {"mean": 515, "sd": 154, "p50": 515, "p75": 619, "p90": 712, "p99": 873, "avg_rt_ms": 1260, "early_rate_pct": 34},
    "speed-match":        {"mean": 548, "sd": 144, "p50": 548, "p75": 645, "p90": 733, "p99": 883, "avg_rt_ms": 740,  "early_rate_pct": 42},
    "symbol-digit":       {"mean": 532, "sd": 148, "p50": 532, "p75": 632, "p90": 722, "p99": 876, "avg_rt_ms": 1030, "early_rate_pct": 38},
    "chain-arithmetic":   {"mean": 508, "sd": 160, "p50": 508, "p75": 616, "p90": 713, "p99": 880, "avg_rt_ms": 1580, "early_rate_pct": 31},
    "number-comparison":  {"mean": 524, "sd": 154, "p50": 524, "p75": 628, "p90": 721, "p99": 882, "avg_rt_ms": 1310, "early_rate_pct": 37},
    "stroop-conflict":    {"mean": 528, "sd": 152, "p50": 528, "p75": 631, "p90": 723, "p99": 882, "avg_rt_ms": 870,  "early_rate_pct": 35},
    "go-nogo-reflex":     {"mean": 522, "sd": 154, "p50": 522, "p75": 626, "p90": 719, "p99": 880, "avg_rt_ms": 590,  "early_rate_pct": 32}
  }'::jsonb;
BEGIN
  SELECT COUNT(*)::INTEGER, COUNT(DISTINCT user_id)::INTEGER
    INTO v_total_sessions, v_distinct_users
    FROM public.cognitive_sessions;

  -- Usa base populacional real quando houver >= 30 sessões de usuários distintos
  v_use_real := (v_total_sessions >= 30 AND v_distinct_users >= 2);

  IF v_use_real THEN
    SELECT jsonb_build_object(
      'mean', COALESCE(ROUND(AVG(score))::INTEGER, 520),
      'sd',   GREATEST(60, COALESCE(ROUND(STDDEV_POP(score))::INTEGER, 145)),
      'p50',  COALESCE(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score))::INTEGER, 520),
      'p75',  COALESCE(ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score))::INTEGER, 618),
      'p90',  COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY score))::INTEGER, 706),
      'p99',  COALESCE(ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY score))::INTEGER, 857)
    )
      INTO v_global
      FROM public.cognitive_sessions;

    SELECT v_norm_domains || COALESCE(
      jsonb_object_agg(domain, stats) FILTER (WHERE cnt >= 10 AND users_cnt >= 2),
      '{}'::jsonb
    )
      INTO v_domains
      FROM (
        SELECT
          domain,
          COUNT(*) AS cnt,
          COUNT(DISTINCT user_id) AS users_cnt,
          jsonb_build_object(
            'mean', COALESCE(ROUND(AVG(score))::INTEGER, 520),
            'sd',   GREATEST(60, COALESCE(ROUND(STDDEV_POP(score))::INTEGER, 150)),
            'p50',  COALESCE(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score))::INTEGER, 520),
            'p75',  COALESCE(ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score))::INTEGER, 620),
            'p90',  COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY score))::INTEGER, 715),
            'p99',  COALESCE(ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY score))::INTEGER, 875),
            'avg_rt_ms', COALESCE(ROUND(AVG(NULLIF(rt_mean_ms, 0)))::INTEGER, 1100)
          ) AS stats
        FROM public.cognitive_sessions
        GROUP BY domain
      ) d;

    SELECT v_norm_games || COALESCE(
      jsonb_object_agg(game_slug, stats) FILTER (WHERE cnt >= 8 AND users_cnt >= 2),
      '{}'::jsonb
    )
      INTO v_games
      FROM (
        SELECT
          game_slug,
          COUNT(*) AS cnt,
          COUNT(DISTINCT user_id) AS users_cnt,
          jsonb_build_object(
            'mean', COALESCE(ROUND(AVG(score))::INTEGER, 520),
            'sd',   GREATEST(60, COALESCE(ROUND(STDDEV_POP(score))::INTEGER, 150)),
            'p50',  COALESCE(ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score))::INTEGER, 520),
            'p75',  COALESCE(ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score))::INTEGER, 620),
            'p90',  COALESCE(ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY score))::INTEGER, 715),
            'p99',  COALESCE(ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY score))::INTEGER, 875),
            'avg_rt_ms', COALESCE(ROUND(AVG(NULLIF(rt_mean_ms, 0)))::INTEGER, 1100),
            'early_rate_pct', COALESCE(ROUND(AVG(CASE WHEN completed_early THEN 100.0 ELSE 0.0 END))::INTEGER, 30)
          ) AS stats
        FROM public.cognitive_sessions
        GROUP BY game_slug
      ) g;
  ELSE
    v_global := '{"mean": 520, "sd": 145, "p50": 520, "p75": 618, "p90": 706, "p99": 857}'::jsonb;
    v_domains := v_norm_domains;
    v_games := v_norm_games;
  END IF;

  RETURN jsonb_build_object(
    'source', CASE WHEN v_use_real THEN 'population' ELSE 'normative' END,
    'sample_sessions', v_total_sessions,
    'distinct_users', v_distinct_users,
    'global', v_global,
    'domains', v_domains,
    'games', v_games
  );
END;
$$;

-- Alias compatível para chamadas via get_population_benchmarks()
CREATE OR REPLACE FUNCTION public.get_population_benchmarks()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_global_benchmarks();
$$;

GRANT EXECUTE ON FUNCTION public.get_global_benchmarks() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_population_benchmarks() TO anon, authenticated, service_role;

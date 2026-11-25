import type { AgeBracket, ComputedSessionResult } from '../types/cognitive';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getAgeBracketMeta } from '../engine/psychometricEngine';
import { getIntensityLabel } from '../engine/adaptiveEngine';

export type NextDifficultyTrend = 'harder' | 'easier' | 'steady';

export interface AdaptiveCoachInsight {
  source: 'gemini' | 'scientific_local';
  text: string;
  nextTrend: NextDifficultyTrend;
  nextTrendLabel: string;
  nextDifficultyDeltaPct: number;
}

function resolveNextTrend(result: ComputedSessionResult): {
  nextTrend: NextDifficultyTrend;
  nextTrendLabel: string;
  nextDifficultyDeltaPct: number;
} {
  if (result.adaptiveStatus === 'fast_track' && result.adaptiveDelta > 0) {
    const pct = Math.min(25, Math.max(15, result.adaptiveDelta * 10));
    return {
      nextTrend: 'harder',
      nextTrendLabel: `+${pct}% mais desafiador na próxima`,
      nextDifficultyDeltaPct: pct,
    };
  }
  if (result.adaptiveStatus === 'level_up' && result.adaptiveDelta > 0) {
    const pct = Math.min(18, Math.max(8, result.adaptiveDelta * 10));
    return {
      nextTrend: 'harder',
      nextTrendLabel: `+${pct}% mais desafiador na próxima`,
      nextDifficultyDeltaPct: pct,
    };
  }
  if (result.adaptiveStatus === 'step_down' || result.adaptiveStatus === 'ease_mode') {
    const pct = result.adaptiveStatus === 'step_down' ? Math.min(20, Math.max(10, Math.abs(result.adaptiveDelta) * 10)) : 10;
    return {
      nextTrend: 'easier',
      nextTrendLabel: `-${pct}% mais leve na próxima`,
      nextDifficultyDeltaPct: -pct,
    };
  }
  return {
    nextTrend: 'steady',
    nextTrendLabel: 'Mesmo ritmo na próxima (0%)',
    nextDifficultyDeltaPct: 0,
  };
}

function formatRtShort(rtMeanMs: number): string {
  if (!rtMeanMs || rtMeanMs <= 0) return '';
  return rtMeanMs >= 1000 ? `${(rtMeanMs / 1000).toFixed(1)}s` : `${Math.round(rtMeanMs)}ms`;
}

function buildLocalScientificInsight(
  result: ComputedSessionResult,
  ageBracket: AgeBracket
): AdaptiveCoachInsight {
  const ageLabel = getAgeBracketMeta(ageBracket).label;
  const eq = result.equilibriumIndex ?? result.stagePlayed;
  const expected = result.ageExpectedEquilibrium ?? 6.0;
  const delta = eq - expected;
  const intensity = getIntensityLabel(eq).toLowerCase();
  const rtText = formatRtShort(result.rtMeanMs);
  const { nextTrend, nextTrendLabel, nextDifficultyDeltaPct } = resolveNextTrend(result);

  let perfNote = '';
  if (!result.stageCleared && result.accuracyPct >= 80) {
    perfNote = `Sua precisão foi ótima (${result.accuracyPct}%), mas o tempo acabou antes de completar a meta.`;
  } else if (result.accuracyPct < 75 && delta >= 1.5) {
    perfNote = `Mesmo com ${result.accuracyPct}% de precisão, você chegou a um ${intensity} que poucas pessoas de ${ageLabel} alcançam.`;
  } else if (result.accuracyPct >= 92 && delta >= 0.8 && result.stageCleared) {
    perfNote = `Você manteve ${result.accuracyPct}% de precisão em ${intensity} — acima da média para ${ageLabel}.`;
  } else if (result.accuracyPct < 75) {
    perfNote = `Sua precisão ficou em ${result.accuracyPct}%. Vale focar em acertar com calma antes de acelerar.`;
  } else if (rtText) {
    perfNote = `Bom controle em ${intensity}, com ${result.accuracyPct}% de precisão e resposta média de ${rtText}.`;
  } else {
    perfNote = `Bom controle em ${intensity}, com ${result.accuracyPct}% de precisão para a faixa ${ageLabel}.`;
  }

  const nextHint =
    nextTrend === 'harder'
      ? `Na próxima rodada o desafio sobe ${nextDifficultyDeltaPct}% para acompanhar sua evolução.`
      : nextTrend === 'easier'
        ? `Na próxima rodada vamos aliviar ${Math.abs(nextDifficultyDeltaPct)}% o ritmo para você pegar embalo e subir de novo.`
        : 'Na próxima rodada vamos manter o mesmo ritmo para você consolidar velocidade e fechar a meta.';

  return {
    source: 'scientific_local',
    text: `${perfNote} ${nextHint}`,
    nextTrend,
    nextTrendLabel,
    nextDifficultyDeltaPct,
  };
}

/**
 * Camada híbrida de IA pós-sessão:
 * - Se VITE_GEMINI_API_KEY estiver configurada, gera um comentário curto e personalizado via Gemini.
 * - Caso contrário (ou se falhar/demorar), devolve instantaneamente a análise científica local.
 */
export async function generateAdaptiveCoachInsight(
  result: ComputedSessionResult,
  ageBracket: AgeBracket
): Promise<AdaptiveCoachInsight> {
  const fallback = buildLocalScientificInsight(result, ageBracket);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey || !apiKey.trim()) {
    return fallback;
  }

  const game = GAME_MAP[result.gameSlug];
  const domain = DOMAIN_MAP[result.domain];
  const ageLabel = getAgeBracketMeta(ageBracket).label;
  const intensity = getIntensityLabel(result.equilibriumIndex ?? result.stagePlayed);
  const { nextTrend, nextTrendLabel, nextDifficultyDeltaPct } = resolveNextTrend(result);
  const trendContext =
    nextTrend === 'harder'
      ? `o próximo exercício vai ficar +${nextDifficultyDeltaPct}% mais desafiador porque o usuário concluiu a meta com ótima precisão`
      : nextTrend === 'easier'
        ? `o próximo exercício vai ficar ${Math.abs(nextDifficultyDeltaPct)}% mais leve para ajudar o usuário a pegar ritmo`
        : 'o próximo exercício vai manter o mesmo ritmo para consolidar velocidade';

  const prompt = [
    'Você é um especialista em treino cognitivo comentando o resultado de um exercício do app NeuroLab.',
    'Escreva NO MÁXIMO 2 frases curtas em português do Brasil, em linguagem simples e motivadora, sem markdown e sem termos técnicos como "carga", "equilíbrio numérico", "motor adaptativo" ou "calibração".',
    `Deixe claro de forma natural que ${trendContext}.`,
    `Exercício: ${game?.name ?? result.gameSlug} (${domain?.name ?? result.domain})`,
    `Faixa etária: ${ageLabel} | Concluiu meta: ${result.stageCleared ? 'Sim' : 'Não'}`,
    `Ritmo atingido: ${intensity} | Precisão: ${result.accuracyPct}% | Tempo médio: ${result.rtMeanMs}ms | Superou: ${result.percentile}% da faixa etária`,
  ].join('\n');

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 110, temperature: 0.4 },
        }),
      }
    );
    window.clearTimeout(timer);
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return fallback;
    return { source: 'gemini', text, nextTrend, nextTrendLabel, nextDifficultyDeltaPct };
  } catch {
    return fallback;
  }
}

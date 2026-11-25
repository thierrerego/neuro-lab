import type { AgeBracket, ComputedSessionResult } from '../types/cognitive';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getAgeBracketMeta } from '../engine/psychometricEngine';
import { getIntensityLabel } from '../engine/adaptiveEngine';

export interface AdaptiveCoachInsight {
  source: 'gemini' | 'scientific_local';
  text: string;
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

  let perfNote = '';
  if (result.accuracyPct < 75 && delta >= 1.5) {
    perfNote = `Mesmo com ${result.accuracyPct}% de precisão, você chegou a um ${intensity} que poucas pessoas de ${ageLabel} alcançam.`;
  } else if (result.accuracyPct >= 92 && delta >= 0.8) {
    perfNote = `Você manteve ${result.accuracyPct}% de precisão em ${intensity} — acima da média para ${ageLabel}.`;
  } else if (result.accuracyPct < 75) {
    perfNote = `Sua precisão ficou em ${result.accuracyPct}%. Vale focar em acertar com calma antes de acelerar.`;
  } else if (rtText) {
    perfNote = `Bom controle em ${intensity}, com ${result.accuracyPct}% de precisão e resposta média de ${rtText}.`;
  } else {
    perfNote = `Bom controle em ${intensity}, com ${result.accuracyPct}% de precisão para a faixa ${ageLabel}.`;
  }

  const nextHint =
    result.rtMeanMs > 0 && result.targetRtMs && result.rtMeanMs <= result.targetRtMs
      ? 'Seu tempo de resposta está rápido — ótimo ritmo para manter o desafio subindo.'
      : 'Na próxima tentativa, tente ganhar um pouco mais de agilidade mantendo a precisão alta.';

  return {
    source: 'scientific_local',
    text: `${perfNote} ${nextHint}`,
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

  const prompt = [
    'Você é um especialista em treino cognitivo comentando o resultado de um exercício do app NeuroLab.',
    'Escreva NO MÁXIMO 2 frases curtas em português do Brasil, em linguagem simples e motivadora, sem markdown e sem termos técnicos como "carga", "equilíbrio numérico", "motor adaptativo" ou "calibração".',
    `Exercício: ${game?.name ?? result.gameSlug} (${domain?.name ?? result.domain})`,
    `Faixa etária: ${ageLabel}`,
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
    return { source: 'gemini', text };
  } catch {
    return fallback;
  }
}

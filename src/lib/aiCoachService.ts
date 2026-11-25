import type { AgeBracket, ComputedSessionResult } from '../types/cognitive';
import { DOMAIN_MAP, GAME_MAP } from '../engine/gameRegistry';
import { getAgeBracketMeta } from '../engine/psychometricEngine';

export interface AdaptiveCoachInsight {
  source: 'gemini' | 'scientific_local';
  text: string;
}

function buildLocalScientificInsight(
  result: ComputedSessionResult,
  ageBracket: AgeBracket
): AdaptiveCoachInsight {
  const ageLabel = getAgeBracketMeta(ageBracket).label;
  const eq = result.equilibriumIndex ?? result.stagePlayed;
  const expected = result.ageExpectedEquilibrium ?? 6.0;
  const delta = eq - expected;

  let perfNote = '';
  if (result.accuracyPct >= 92 && delta >= 0.8) {
    perfNote = `Você sustentou carga ${eq.toFixed(1)} com ${result.accuracyPct}% de precisão — acima da média de ${expected.toFixed(1)} esperada para ${ageLabel}.`;
  } else if (result.accuracyPct < 75) {
    perfNote = `Sua precisão ficou em ${result.accuracyPct}% (carga ${eq.toFixed(1)}). O motor reduziu a pressão para encontrar seu ponto de estabilidade antes de acelerar novamente.`;
  } else {
    perfNote = `Seu ponto de equilíbrio estabilizou em ${eq.toFixed(1)} (média ${expected.toFixed(1)} para ${ageLabel}), com tempo de reação de ${result.rtMeanMs}ms.`;
  }

  const nextHint =
    result.rtMeanMs > 0 && result.targetRtMs && result.rtMeanMs <= result.targetRtMs
      ? 'Na próxima rodada o sistema já parte de uma carga mais exigente.'
      : 'Na próxima rodada o foco será ganhar agilidade mantendo a precisão acima de 80%.';

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

  const prompt = [
    'Você é um neuropsicólogo analisando uma sessão adaptativa (sem níveis fixos) do app NeuroLab.',
    'Escreva NO MÁXIMO 2 frases curtas em português do Brasil, diretas e motivadoras, sem markdown.',
    `Exercício: ${game?.name ?? result.gameSlug} (${domain?.name ?? result.domain})`,
    `Faixa etária: ${ageLabel}`,
    `Ponto de equilíbrio atingido: ${(result.equilibriumIndex ?? result.stagePlayed).toFixed(1)} (média esperada da idade: ${(result.ageExpectedEquilibrium ?? 6).toFixed(1)})`,
    `Precisão: ${result.accuracyPct}% | RT médio: ${result.rtMeanMs}ms | Percentil da idade: ${result.percentile}%`,
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

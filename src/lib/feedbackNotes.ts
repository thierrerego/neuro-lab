import type { GameSlug } from '../types/cognitive';

export interface FeedbackNoteItem {
  id: string;
  createdAt: string;
  text: string;
  gameSlug?: GameSlug;
  gameName?: string;
  intensityLabel?: string;
  accuracyPct?: number;
  rtMeanMs?: number;
  percentile?: number;
}

const STORAGE_KEY = 'neurolab_feedback_notes_v1';

export function listFeedbackNotes(): FeedbackNoteItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedbackNoteItem[]) : [];
  } catch {
    return [];
  }
}

function saveFeedbackNotes(items: FeedbackNoteItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    // ignore storage quota errors
  }
}

export function addFeedbackNote(input: {
  text: string;
  gameSlug?: GameSlug;
  gameName?: string;
  intensityLabel?: string;
  accuracyPct?: number;
  rtMeanMs?: number;
  percentile?: number;
}): FeedbackNoteItem | null {
  const clean = input.text.trim();
  if (!clean) return null;

  const entry: FeedbackNoteItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    text: clean,
    gameSlug: input.gameSlug,
    gameName: input.gameName,
    intensityLabel: input.intensityLabel,
    accuracyPct: input.accuracyPct,
    rtMeanMs: input.rtMeanMs,
    percentile: input.percentile,
  };

  const current = listFeedbackNotes();
  saveFeedbackNotes([entry, ...current]);
  return entry;
}

export function deleteFeedbackNote(id: string): FeedbackNoteItem[] {
  const next = listFeedbackNotes().filter((n) => n.id !== id);
  saveFeedbackNotes(next);
  return next;
}

export function clearAllFeedbackNotes(): void {
  saveFeedbackNotes([]);
}

export function formatFeedbackNotesForExport(items: FeedbackNoteItem[]): string {
  if (items.length === 0) return 'Nenhuma anotação registrada.';
  const lines = [
    `=== ANOTAÇÕES E MELHORIAS · NEUROLAB (${items.length}) ===`,
    '',
  ];
  for (const item of items) {
    const dt = new Date(item.createdAt);
    const dateStr = dt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const ctxParts: string[] = [];
    if (item.gameName) ctxParts.push(item.gameName);
    if (item.intensityLabel) ctxParts.push(item.intensityLabel);
    if (typeof item.accuracyPct === 'number') ctxParts.push(`Prec. ${item.accuracyPct}%`);
    if (typeof item.rtMeanMs === 'number' && item.rtMeanMs > 0) ctxParts.push(`${item.rtMeanMs}ms`);
    if (typeof item.percentile === 'number') ctxParts.push(`Superou ${Math.round(item.percentile)}%`);

    const header = ctxParts.length > 0 ? `[${dateStr}] ${ctxParts.join(' · ')}` : `[${dateStr}] Anotação geral`;
    lines.push(header);
    lines.push(`- ${item.text}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

import type { DomainKey, DomainMeta, GameMeta, GameSlug } from '../types/cognitive';

export const DOMAIN_LIST: DomainMeta[] = [
  {
    key: 'selective_attention',
    shortName: 'Atenção',
    name: 'Atenção Seletiva',
    color: '#38bdf8',
    calibrationGame: 'visual-search',
  },
  {
    key: 'working_memory',
    shortName: 'Memória',
    name: 'Memória de Trabalho',
    color: '#a855f7',
    calibrationGame: 'spatial-span',
  },
  {
    key: 'fluid_reasoning',
    shortName: 'Raciocínio',
    name: 'Raciocínio Fluido',
    color: '#f472b6',
    calibrationGame: 'raven-matrices',
  },
  {
    key: 'processing_speed',
    shortName: 'Velocidade',
    name: 'Velocidade',
    color: '#fbbf24',
    calibrationGame: 'speed-match',
  },
  {
    key: 'numerical_cognition',
    shortName: 'Numérica',
    name: 'Cognição Numérica',
    color: '#34d399',
    calibrationGame: 'chain-arithmetic',
  },
  {
    key: 'inhibitory_control',
    shortName: 'Inibitório',
    name: 'Controle Inibitório',
    color: '#fb7185',
    calibrationGame: 'stroop-conflict',
  },
];

export const DOMAIN_MAP: Record<DomainKey, DomainMeta> = DOMAIN_LIST.reduce(
  (acc, item) => ({ ...acc, [item.key]: item }),
  {} as Record<DomainKey, DomainMeta>
);

/**
 * Catálogo modular de minigames (12 jogos jogáveis — 2 por domínio).
 * Para adicionar novos minigames no futuro, basta registrar aqui e mapear o componente.
 */
export const GAME_REGISTRY: GameMeta[] = [
  // 1. Atenção Seletiva & Sustentada
  {
    slug: 'visual-search',
    domain: 'selective_attention',
    name: 'Varredura Visual',
    shortTip: 'Toque nos alvos',
    durationSec: 35,
  },
  {
    slug: 'sustained-tracking',
    domain: 'selective_attention',
    name: 'Rastreamento',
    shortTip: 'Siga os alvos',
    durationSec: 42,
  },
  // 2. Memória de Trabalho
  {
    slug: 'spatial-span',
    domain: 'working_memory',
    name: 'Matriz Espacial',
    shortTip: 'Repita a ordem',
    durationSec: 45,
  },
  {
    slug: 'dual-n-back',
    domain: 'working_memory',
    name: 'N-Back',
    shortTip: 'Igual a N atrás?',
    durationSec: 40,
  },
  // 3. Raciocínio Fluido
  {
    slug: 'raven-matrices',
    domain: 'fluid_reasoning',
    name: 'Matrizes Lógicas',
    shortTip: 'Complete o padrão',
    durationSec: 45,
  },
  {
    slug: 'path-logic',
    domain: 'fluid_reasoning',
    name: 'Conexão Lógica',
    shortTip: '1 → A → 2 → B',
    durationSec: 40,
  },
  // 4. Velocidade de Processamento
  {
    slug: 'speed-match',
    domain: 'processing_speed',
    name: 'Comparação',
    shortTip: 'Igual ou diferente',
    durationSec: 35,
  },
  {
    slug: 'symbol-digit',
    domain: 'processing_speed',
    name: 'Decodificador',
    shortTip: 'Símbolo → número',
    durationSec: 35,
  },
  // 5. Cognição Numérica
  {
    slug: 'chain-arithmetic',
    domain: 'numerical_cognition',
    name: 'Aritmética',
    shortTip: 'Cálculo rápido',
    durationSec: 38,
  },
  {
    slug: 'number-comparison',
    domain: 'numerical_cognition',
    name: 'Balança',
    shortTip: 'Toque no maior',
    durationSec: 35,
  },
  // 6. Controle Inibitório
  {
    slug: 'stroop-conflict',
    domain: 'inhibitory_control',
    name: 'Stroop',
    shortTip: 'Cor da tinta',
    durationSec: 35,
  },
  {
    slug: 'go-nogo-reflex',
    domain: 'inhibitory_control',
    name: 'Go / No-Go',
    shortTip: 'Toque só no verde',
    durationSec: 35,
  },
];

export const GAME_MAP: Record<GameSlug, GameMeta> = GAME_REGISTRY.reduce(
  (acc, item) => ({ ...acc, [item.slug]: item }),
  {} as Record<GameSlug, GameMeta>
);

export const GAMES_BY_DOMAIN: Record<DomainKey, GameMeta[]> = DOMAIN_LIST.reduce((acc, d) => {
  acc[d.key] = GAME_REGISTRY.filter((g) => g.domain === d.key);
  return acc;
}, {} as Record<DomainKey, GameMeta[]>);

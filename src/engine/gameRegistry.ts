import type { DomainKey, DomainMeta, GameMeta, GameSlug } from '../types/cognitive';

export const DOMAIN_LIST: DomainMeta[] = [
  {
    key: 'selective_attention',
    shortName: 'Atenção',
    name: 'Atenção Seletiva',
    color: '#0EA5E9',
    calibrationGame: 'visual-search',
  },
  {
    key: 'working_memory',
    shortName: 'Memória',
    name: 'Memória',
    color: '#6366F1',
    calibrationGame: 'memory-pairs',
  },
  {
    key: 'fluid_reasoning',
    shortName: 'Raciocínio',
    name: 'Raciocínio Fluido',
    color: '#8B5CF6',
    calibrationGame: 'number-sequence',
  },
  {
    key: 'processing_speed',
    shortName: 'Velocidade',
    name: 'Velocidade de Processamento',
    color: '#D97706',
    calibrationGame: 'speed-match',
  },
  {
    key: 'numerical_cognition',
    shortName: 'Cálculo',
    name: 'Cálculo Mental',
    color: '#059669',
    calibrationGame: 'chain-arithmetic',
  },
  {
    key: 'inhibitory_control',
    shortName: 'Inibitório',
    name: 'Controle Inibitório',
    color: '#E11D48',
    calibrationGame: 'stroop-conflict',
  },
];

export const DOMAIN_MAP: Record<DomainKey, DomainMeta> = DOMAIN_LIST.reduce(
  (acc, item) => ({ ...acc, [item.key]: item }),
  {} as Record<DomainKey, DomainMeta>
);

/**
 * Catálogo completo de 24 exercícios cognitivos (4 por domínio).
 * Todos começam no Nível 1 (ultrabásico) e progridem em curva suave de Flow.
 */
export const GAME_REGISTRY: GameMeta[] = [
  // 1. Atenção Seletiva (4)
  {
    slug: 'visual-search',
    domain: 'selective_attention',
    name: 'Varredura Visual',
    shortTip: 'Toque nos alvos iguais',
    durationSec: 30,
  },
  {
    slug: 'sustained-tracking',
    domain: 'selective_attention',
    name: 'Rastreamento Sustentado',
    shortTip: 'Acompanhe os alvos',
    durationSec: 30,
  },
  {
    slug: 'odd-one-out',
    domain: 'selective_attention',
    name: 'Diferença Oculta',
    shortTip: 'Ache o símbolo diferente',
    durationSec: 30,
  },
  {
    slug: 'flanker-focus',
    domain: 'selective_attention',
    name: 'Filtro Direcional',
    shortTip: 'Siga só a seta do meio',
    durationSec: 30,
  },
  {
    slug: 'conjunction-search',
    domain: 'selective_attention',
    name: 'Conjunção Visual',
    shortTip: 'Combine forma e cor exatas',
    durationSec: 30,
  },
  {
    slug: 'ancient-numbers',
    domain: 'selective_attention',
    name: 'Números Antigos',
    shortTip: 'Toque em ordem 1 → 2 → 3',
    durationSec: 30,
  },
  {
    slug: 'crime-scene',
    domain: 'selective_attention',
    name: 'Cena do Crime',
    shortTip: 'Ache o item sem par',
    durationSec: 30,
  },
  {
    slug: 'treasure-hunt',
    domain: 'selective_attention',
    name: 'Caça ao Tesouro',
    shortTip: 'Qual cor aparece mais?',
    durationSec: 30,
  },
  {
    slug: 'identical-items',
    domain: 'selective_attention',
    name: 'Itens Idênticos',
    shortTip: 'Toque no item repetido',
    durationSec: 30,
  },
  {
    slug: 'missing-number',
    domain: 'selective_attention',
    name: 'Número Ausente',
    shortTip: 'Qual número está faltando?',
    durationSec: 30,
  },
  {
    slug: 'fan-count',
    domain: 'selective_attention',
    name: 'Número de Fãs',
    shortTip: 'Conte as camisas da cor',
    durationSec: 30,
  },

  // 2. Memória (Memória Visual/Normal + Memória de Trabalho — 4)
  {
    slug: 'memory-pairs',
    domain: 'working_memory',
    name: 'Jogo da Memória',
    shortTip: 'Encontre os pares iguais',
    durationSec: 30,
  },
  {
    slug: 'photo-recall',
    domain: 'working_memory',
    name: 'Memória Fotográfica',
    shortTip: 'Onde estava o ícone?',
    durationSec: 30,
  },
  {
    slug: 'spatial-span',
    domain: 'working_memory',
    name: 'Matriz Espacial',
    shortTip: 'Repita a sequência',
    durationSec: 30,
  },
  {
    slug: 'dual-n-back',
    domain: 'working_memory',
    name: 'Dual N-Back',
    shortTip: 'Igual a N passos atrás?',
    durationSec: 30,
  },
  {
    slug: 'reverse-digits',
    domain: 'working_memory',
    name: 'Dígitos Inversos',
    shortTip: 'Digite de trás pra frente',
    durationSec: 30,
  },
  {
    slug: 'pass-the-ball',
    domain: 'working_memory',
    name: 'Passe a Bola',
    shortTip: 'Trace a rota segura',
    durationSec: 30,
  },
  {
    slug: 'hidden-gold',
    domain: 'working_memory',
    name: 'Ouro Escondido',
    shortTip: 'Onde estavam as moedas?',
    durationSec: 30,
  },
  {
    slug: 'shopping-list',
    domain: 'working_memory',
    name: 'Lista de Compras',
    shortTip: 'Pegue os itens da lista',
    durationSec: 30,
  },
  {
    slug: 'match-pairs',
    domain: 'working_memory',
    name: 'Combine o Par',
    shortTip: 'Combine os emojis iguais',
    durationSec: 30,
  },
  {
    slug: 'phone-number',
    domain: 'working_memory',
    name: 'Número de Telefone',
    shortTip: 'Memorize e digite o número',
    durationSec: 30,
  },
  {
    slug: 'secret-code',
    domain: 'working_memory',
    name: 'Código Secreto',
    shortTip: 'Toque na ordem crescente',
    durationSec: 30,
  },
  {
    slug: 'strange-signals',
    domain: 'working_memory',
    name: 'Sinais Estranhos',
    shortTip: 'Repita a transmissão',
    durationSec: 30,
  },

  // 3. Raciocínio Fluido (4)
  {
    slug: 'number-sequence',
    domain: 'fluid_reasoning',
    name: 'Sequência Numérica',
    shortTip: 'Complete o próximo número',
    durationSec: 30,
  },
  {
    slug: 'logic-intruder',
    domain: 'fluid_reasoning',
    name: 'Intruso Lógico',
    shortTip: 'Ache o que não combina',
    durationSec: 30,
  },
  {
    slug: 'raven-matrices',
    domain: 'fluid_reasoning',
    name: 'Matrizes de Raven',
    shortTip: 'Complete o padrão',
    durationSec: 30,
  },
  {
    slug: 'path-logic',
    domain: 'fluid_reasoning',
    name: 'Conexão Lógica',
    shortTip: 'Ligue na ordem certa',
    durationSec: 30,
  },
  {
    slug: 'logic-balance',
    domain: 'fluid_reasoning',
    name: 'Balança Lógica',
    shortTip: 'Descubra o valor do símbolo',
    durationSec: 30,
  },
  {
    slug: 'secret-anagrams',
    domain: 'fluid_reasoning',
    name: 'Anagramas Secretos',
    shortTip: 'Ache o anagrama exato',
    durationSec: 30,
  },
  {
    slug: 'fish-out-of-water',
    domain: 'fluid_reasoning',
    name: "Peixe Fora d'Água",
    shortTip: 'Toque no intruso do grupo',
    durationSec: 30,
  },
  {
    slug: 'sort-trash',
    domain: 'fluid_reasoning',
    name: 'Separar o Lixo',
    shortTip: 'Jogue na lixeira certa',
    durationSec: 30,
  },
  {
    slug: 'complex-patterns',
    domain: 'fluid_reasoning',
    name: 'Padrões Complexos',
    shortTip: 'Rotação igual ou diferente?',
    durationSec: 30,
  },

  // 4. Velocidade de Processamento (4)
  {
    slug: 'speed-match',
    domain: 'processing_speed',
    name: 'Comparação Rápida',
    shortTip: 'Igual ou diferente',
    durationSec: 30,
  },
  {
    slug: 'symbol-digit',
    domain: 'processing_speed',
    name: 'Decodificador Símbolo-Dígito',
    shortTip: 'Símbolo → número',
    durationSec: 30,
  },
  {
    slug: 'schulte-order',
    domain: 'processing_speed',
    name: 'Ordem Crescente',
    shortTip: 'Toque de 1 em diante',
    durationSec: 30,
  },
  {
    slug: 'flash-match',
    domain: 'processing_speed',
    name: 'Pares Relâmpago',
    shortTip: 'Toque nos 2 iguais',
    durationSec: 30,
  },
  {
    slug: 'quick-pair',
    domain: 'processing_speed',
    name: 'Par Rápido',
    shortTip: 'Encontre o par idêntico',
    durationSec: 30,
  },

  // 5. Cálculo Mental (4)
  {
    slug: 'chain-arithmetic',
    domain: 'numerical_cognition',
    name: 'Aritmética Encadeada',
    shortTip: 'Cálculo rápido',
    durationSec: 30,
  },
  {
    slug: 'number-comparison',
    domain: 'numerical_cognition',
    name: 'Magnitude Numérica',
    shortTip: 'Toque no maior valor',
    durationSec: 30,
  },
  {
    slug: 'target-sum',
    domain: 'numerical_cognition',
    name: 'Soma Alvo',
    shortTip: '2 números que somam o alvo',
    durationSec: 30,
  },
  {
    slug: 'missing-operator',
    domain: 'numerical_cognition',
    name: 'Operador Oculto',
    shortTip: 'Qual sinal completa?',
    durationSec: 30,
  },
  {
    slug: 'quick-estimate',
    domain: 'numerical_cognition',
    name: 'Maior Expressão',
    shortTip: 'Toque na conta maior',
    durationSec: 30,
  },

  // 6. Controle Inibitório (4)
  {
    slug: 'stroop-conflict',
    domain: 'inhibitory_control',
    name: 'Conflito de Stroop',
    shortTip: 'Toque na cor da tinta',
    durationSec: 30,
  },
  {
    slug: 'go-nogo-reflex',
    domain: 'inhibitory_control',
    name: 'Reflexo Go / No-Go',
    shortTip: 'Toque só no verde',
    durationSec: 30,
  },
  {
    slug: 'opposite-arrow',
    domain: 'inhibitory_control',
    name: 'Comando Oposto',
    shortTip: 'Azul segue · Laranja inverte',
    durationSec: 30,
  },
  {
    slug: 'rule-switch',
    domain: 'inhibitory_control',
    name: 'Classificação por Regra',
    shortTip: 'Siga a regra do topo',
    durationSec: 30,
  },
  {
    slug: 'inverted-signal',
    domain: 'inhibitory_control',
    name: 'Regra Invertida',
    shortTip: 'Verde segue · Vermelho inverte',
    durationSec: 30,
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

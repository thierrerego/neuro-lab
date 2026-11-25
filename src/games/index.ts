import type { ComponentType } from 'react';
import type { GameSlug } from '../types/cognitive';
import type { MinigameProps } from './GameProps';
import { VisualSearchGame } from './VisualSearchGame';
import { SustainedTrackingGame } from './SustainedTrackingGame';
import { OddOneOutGame } from './OddOneOutGame';
import { FlankerFocusGame } from './FlankerFocusGame';
import { MemoryPairsGame } from './MemoryPairsGame';
import { PhotoRecallGame } from './PhotoRecallGame';
import { SpatialSpanGame } from './SpatialSpanGame';
import { DualNBackGame } from './DualNBackGame';
import { NumberSequenceGame } from './NumberSequenceGame';
import { LogicIntruderGame } from './LogicIntruderGame';
import { RavenMatricesGame } from './RavenMatricesGame';
import { PathLogicGame } from './PathLogicGame';
import { SpeedMatchGame } from './SpeedMatchGame';
import { SymbolDigitGame } from './SymbolDigitGame';
import { SchulteOrderGame } from './SchulteOrderGame';
import { FlashMatchGame } from './FlashMatchGame';
import { ChainArithmeticGame } from './ChainArithmeticGame';
import { NumberComparisonGame } from './NumberComparisonGame';
import { TargetSumGame } from './TargetSumGame';
import { MissingOperatorGame } from './MissingOperatorGame';
import { StroopConflictGame } from './StroopConflictGame';
import { GoNoGoReflexGame } from './GoNoGoReflexGame';
import { OppositeArrowGame } from './OppositeArrowGame';
import { RuleSwitchGame } from './RuleSwitchGame';
import { ConjunctionSearchGame } from './ConjunctionSearchGame';
import { ReverseDigitsGame } from './ReverseDigitsGame';
import { LogicBalanceGame } from './LogicBalanceGame';
import { PassTheBallGame } from './PassTheBallGame';
import { ShoppingListGame } from './ShoppingListGame';
import { PhoneNumberGame } from './PhoneNumberGame';
import { SecretCodeGame } from './SecretCodeGame';
import { CrimeSceneGame } from './CrimeSceneGame';
import { TreasureHuntGame } from './TreasureHuntGame';
import { MissingNumberGame } from './MissingNumberGame';
import { FanCountGame } from './FanCountGame';
import { SecretAnagramsGame } from './SecretAnagramsGame';
import { SortTrashGame } from './SortTrashGame';
import { ComplexPatternsGame } from './ComplexPatternsGame';
import { WhackTargetGame } from './WhackTargetGame';
import { ParityDashGame } from './ParityDashGame';
import { WordRadarGame } from './WordRadarGame';
import { ColorSortGame } from './ColorSortGame';
import { MathVerdictGame } from './MathVerdictGame';
import { ExactChangeGame } from './ExactChangeGame';
import { DoubleHalfGame } from './DoubleHalfGame';
import { BombDefuseGame } from './BombDefuseGame';
import { SimonSaysGame } from './SimonSaysGame';
import { MirrorWordsGame } from './MirrorWordsGame';

export const GAME_COMPONENTS: Record<GameSlug, ComponentType<MinigameProps>> = {
  // 1. Atenção Seletiva (9)
  'visual-search': VisualSearchGame,
  'sustained-tracking': SustainedTrackingGame,
  'odd-one-out': OddOneOutGame,
  'flanker-focus': FlankerFocusGame,
  'conjunction-search': ConjunctionSearchGame,
  'crime-scene': CrimeSceneGame,
  'treasure-hunt': TreasureHuntGame,
  'missing-number': MissingNumberGame,
  'fan-count': FanCountGame,
  // 2. Memória (9)
  'memory-pairs': MemoryPairsGame,
  'photo-recall': PhotoRecallGame,
  'spatial-span': SpatialSpanGame,
  'dual-n-back': DualNBackGame,
  'reverse-digits': ReverseDigitsGame,
  'pass-the-ball': PassTheBallGame,
  'shopping-list': ShoppingListGame,
  'phone-number': PhoneNumberGame,
  'secret-code': SecretCodeGame,
  // 3. Raciocínio Fluido (8)
  'number-sequence': NumberSequenceGame,
  'logic-intruder': LogicIntruderGame,
  'raven-matrices': RavenMatricesGame,
  'path-logic': PathLogicGame,
  'logic-balance': LogicBalanceGame,
  'secret-anagrams': SecretAnagramsGame,
  'sort-trash': SortTrashGame,
  'complex-patterns': ComplexPatternsGame,
  // 4. Velocidade de Processamento (8)
  'speed-match': SpeedMatchGame,
  'symbol-digit': SymbolDigitGame,
  'schulte-order': SchulteOrderGame,
  'flash-match': FlashMatchGame,
  'whack-target': WhackTargetGame,
  'parity-dash': ParityDashGame,
  'word-radar': WordRadarGame,
  'color-sort': ColorSortGame,
  // 5. Cálculo Mental (7)
  'chain-arithmetic': ChainArithmeticGame,
  'number-comparison': NumberComparisonGame,
  'target-sum': TargetSumGame,
  'missing-operator': MissingOperatorGame,
  'math-verdict': MathVerdictGame,
  'exact-change': ExactChangeGame,
  'double-half': DoubleHalfGame,
  // 6. Controle Inibitório (7)
  'stroop-conflict': StroopConflictGame,
  'go-nogo-reflex': GoNoGoReflexGame,
  'opposite-arrow': OppositeArrowGame,
  'rule-switch': RuleSwitchGame,
  'bomb-defuse': BombDefuseGame,
  'simon-says': SimonSaysGame,
  'mirror-words': MirrorWordsGame,
};

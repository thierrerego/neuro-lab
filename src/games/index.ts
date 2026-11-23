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
import { QuickPairGame } from './QuickPairGame';
import { QuickEstimateGame } from './QuickEstimateGame';
import { InvertedSignalGame } from './InvertedSignalGame';
import { PassTheBallGame } from './PassTheBallGame';
import { HiddenGoldGame } from './HiddenGoldGame';
import { ShoppingListGame } from './ShoppingListGame';
import { MatchPairsGame } from './MatchPairsGame';
import { PhoneNumberGame } from './PhoneNumberGame';
import { SecretCodeGame } from './SecretCodeGame';
import { StrangeSignalsGame } from './StrangeSignalsGame';
import { AncientNumbersGame } from './AncientNumbersGame';
import { CrimeSceneGame } from './CrimeSceneGame';
import { TreasureHuntGame } from './TreasureHuntGame';
import { IdenticalItemsGame } from './IdenticalItemsGame';
import { MissingNumberGame } from './MissingNumberGame';
import { FanCountGame } from './FanCountGame';
import { SecretAnagramsGame } from './SecretAnagramsGame';
import { FishOutOfWaterGame } from './FishOutOfWaterGame';
import { SortTrashGame } from './SortTrashGame';
import { ComplexPatternsGame } from './ComplexPatternsGame';

export const GAME_COMPONENTS: Record<GameSlug, ComponentType<MinigameProps>> = {
  // 1. Atenção Seletiva (11)
  'visual-search': VisualSearchGame,
  'sustained-tracking': SustainedTrackingGame,
  'odd-one-out': OddOneOutGame,
  'flanker-focus': FlankerFocusGame,
  'conjunction-search': ConjunctionSearchGame,
  'ancient-numbers': AncientNumbersGame,
  'crime-scene': CrimeSceneGame,
  'treasure-hunt': TreasureHuntGame,
  'identical-items': IdenticalItemsGame,
  'missing-number': MissingNumberGame,
  'fan-count': FanCountGame,
  // 2. Memória (12)
  'memory-pairs': MemoryPairsGame,
  'photo-recall': PhotoRecallGame,
  'spatial-span': SpatialSpanGame,
  'dual-n-back': DualNBackGame,
  'reverse-digits': ReverseDigitsGame,
  'pass-the-ball': PassTheBallGame,
  'hidden-gold': HiddenGoldGame,
  'shopping-list': ShoppingListGame,
  'match-pairs': MatchPairsGame,
  'phone-number': PhoneNumberGame,
  'secret-code': SecretCodeGame,
  'strange-signals': StrangeSignalsGame,
  // 3. Raciocínio Fluido (9)
  'number-sequence': NumberSequenceGame,
  'logic-intruder': LogicIntruderGame,
  'raven-matrices': RavenMatricesGame,
  'path-logic': PathLogicGame,
  'logic-balance': LogicBalanceGame,
  'secret-anagrams': SecretAnagramsGame,
  'fish-out-of-water': FishOutOfWaterGame,
  'sort-trash': SortTrashGame,
  'complex-patterns': ComplexPatternsGame,
  // 4. Velocidade de Processamento (5)
  'speed-match': SpeedMatchGame,
  'symbol-digit': SymbolDigitGame,
  'schulte-order': SchulteOrderGame,
  'flash-match': FlashMatchGame,
  'quick-pair': QuickPairGame,
  // 5. Cálculo Mental (5)
  'chain-arithmetic': ChainArithmeticGame,
  'number-comparison': NumberComparisonGame,
  'target-sum': TargetSumGame,
  'missing-operator': MissingOperatorGame,
  'quick-estimate': QuickEstimateGame,
  // 6. Controle Inibitório (5)
  'stroop-conflict': StroopConflictGame,
  'go-nogo-reflex': GoNoGoReflexGame,
  'opposite-arrow': OppositeArrowGame,
  'rule-switch': RuleSwitchGame,
  'inverted-signal': InvertedSignalGame,
};

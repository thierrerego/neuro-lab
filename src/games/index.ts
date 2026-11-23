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

export const GAME_COMPONENTS: Record<GameSlug, ComponentType<MinigameProps>> = {
  // 1. Atenção Seletiva (5)
  'visual-search': VisualSearchGame,
  'sustained-tracking': SustainedTrackingGame,
  'odd-one-out': OddOneOutGame,
  'flanker-focus': FlankerFocusGame,
  'conjunction-search': ConjunctionSearchGame,
  // 2. Memória (5)
  'memory-pairs': MemoryPairsGame,
  'photo-recall': PhotoRecallGame,
  'spatial-span': SpatialSpanGame,
  'dual-n-back': DualNBackGame,
  'reverse-digits': ReverseDigitsGame,
  // 3. Raciocínio Fluido (5)
  'number-sequence': NumberSequenceGame,
  'logic-intruder': LogicIntruderGame,
  'raven-matrices': RavenMatricesGame,
  'path-logic': PathLogicGame,
  'logic-balance': LogicBalanceGame,
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

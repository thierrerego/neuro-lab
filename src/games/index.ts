import type { ComponentType } from 'react';
import type { GameSlug } from '../types/cognitive';
import type { MinigameProps } from './GameProps';
import { VisualSearchGame } from './VisualSearchGame';
import { SustainedTrackingGame } from './SustainedTrackingGame';
import { SpatialSpanGame } from './SpatialSpanGame';
import { DualNBackGame } from './DualNBackGame';
import { RavenMatricesGame } from './RavenMatricesGame';
import { PathLogicGame } from './PathLogicGame';
import { SpeedMatchGame } from './SpeedMatchGame';
import { SymbolDigitGame } from './SymbolDigitGame';
import { ChainArithmeticGame } from './ChainArithmeticGame';
import { NumberComparisonGame } from './NumberComparisonGame';
import { StroopConflictGame } from './StroopConflictGame';
import { GoNoGoReflexGame } from './GoNoGoReflexGame';

export const GAME_COMPONENTS: Record<GameSlug, ComponentType<MinigameProps>> = {
  'visual-search': VisualSearchGame,
  'sustained-tracking': SustainedTrackingGame,
  'spatial-span': SpatialSpanGame,
  'dual-n-back': DualNBackGame,
  'raven-matrices': RavenMatricesGame,
  'path-logic': PathLogicGame,
  'speed-match': SpeedMatchGame,
  'symbol-digit': SymbolDigitGame,
  'chain-arithmetic': ChainArithmeticGame,
  'number-comparison': NumberComparisonGame,
  'stroop-conflict': StroopConflictGame,
  'go-nogo-reflex': GoNoGoReflexGame,
};

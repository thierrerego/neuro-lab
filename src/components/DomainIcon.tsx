import {
  Activity,
  ArrowLeftRight,
  ArrowUpDown,
  Brain,
  Calculator,
  Camera,
  Compass,
  Copy,
  Crosshair,
  Eye,
  GitBranch,
  Grid2x2,
  Hash,
  Layers,
  ListOrdered,
  Palette,
  PlusCircle,
  Repeat,
  Scale,
  ScanSearch,
  ShieldAlert,
  Shapes,
  Shuffle,
  Sigma,
  Sparkles,
  Unlink,
  Zap,
} from 'lucide-react';
import type { DomainKey, GameSlug } from '../types/cognitive';

export function DomainIcon({ domain, size = 18 }: { domain: DomainKey; size?: number }) {
  switch (domain) {
    case 'selective_attention':
      return <Eye size={size} />;
    case 'working_memory':
      return <Brain size={size} />;
    case 'fluid_reasoning':
      return <Shapes size={size} />;
    case 'processing_speed':
      return <Zap size={size} />;
    case 'numerical_cognition':
      return <Calculator size={size} />;
    case 'inhibitory_control':
      return <ShieldAlert size={size} />;
  }
}

export function GameIcon({ slug, size = 20 }: { slug: GameSlug; size?: number }) {
  switch (slug) {
    case 'visual-search':
      return <Crosshair size={size} />;
    case 'sustained-tracking':
      return <Compass size={size} />;
    case 'odd-one-out':
      return <ScanSearch size={size} />;
    case 'flanker-focus':
      return <ArrowLeftRight size={size} />;
    case 'memory-pairs':
      return <Layers size={size} />;
    case 'photo-recall':
      return <Camera size={size} />;
    case 'spatial-span':
      return <Grid2x2 size={size} />;
    case 'dual-n-back':
      return <Repeat size={size} />;
    case 'number-sequence':
      return <ArrowUpDown size={size} />;
    case 'logic-intruder':
      return <Unlink size={size} />;
    case 'raven-matrices':
      return <Shapes size={size} />;
    case 'path-logic':
      return <GitBranch size={size} />;
    case 'speed-match':
      return <Sparkles size={size} />;
    case 'symbol-digit':
      return <Hash size={size} />;
    case 'schulte-order':
      return <ListOrdered size={size} />;
    case 'flash-match':
      return <Copy size={size} />;
    case 'chain-arithmetic':
      return <Calculator size={size} />;
    case 'number-comparison':
      return <Scale size={size} />;
    case 'target-sum':
      return <PlusCircle size={size} />;
    case 'missing-operator':
      return <Sigma size={size} />;
    case 'stroop-conflict':
      return <Palette size={size} />;
    case 'go-nogo-reflex':
      return <Activity size={size} />;
    case 'opposite-arrow':
      return <Shuffle size={size} />;
    case 'rule-switch':
      return <ShieldAlert size={size} />;
    case 'conjunction-search':
      return <Crosshair size={size} />;
    case 'reverse-digits':
      return <ArrowUpDown size={size} />;
    case 'logic-balance':
      return <Scale size={size} />;
    case 'pass-the-ball':
      return <GitBranch size={size} />;
    case 'shopping-list':
      return <Layers size={size} />;
    case 'phone-number':
      return <Hash size={size} />;
    case 'secret-code':
      return <ListOrdered size={size} />;
    case 'crime-scene':
      return <ScanSearch size={size} />;
    case 'treasure-hunt':
      return <Palette size={size} />;
    case 'missing-number':
      return <Hash size={size} />;
    case 'fan-count':
      return <Eye size={size} />;
    case 'secret-anagrams':
      return <Shuffle size={size} />;
    case 'sort-trash':
      return <Repeat size={size} />;
    case 'complex-patterns':
      return <Shapes size={size} />;
    case 'whack-target':
      return <Zap size={size} />;
    case 'parity-dash':
      return <ArrowLeftRight size={size} />;
    case 'word-radar':
      return <ScanSearch size={size} />;
    case 'color-sort':
      return <Palette size={size} />;
    case 'math-verdict':
      return <Sigma size={size} />;
    case 'exact-change':
      return <Calculator size={size} />;
    case 'double-half':
      return <PlusCircle size={size} />;
    case 'bomb-defuse':
      return <ShieldAlert size={size} />;
    case 'simon-says':
      return <Sparkles size={size} />;
    case 'mirror-words':
      return <ArrowLeftRight size={size} />;
  }
}

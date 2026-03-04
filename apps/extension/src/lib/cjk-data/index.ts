export type {
  CharacterData,
  HanjaEntry,
  CharacterBreakdownEntry,
  VariantMaps,
  UnihanReading,
} from './types';

export { lookupHanzi, lookupHangulSyllable } from './hanzi';
export { lookupHanja } from './hanja';
export { toSimplified, toTraditional } from './variants';
export { resetCaches } from './loader';

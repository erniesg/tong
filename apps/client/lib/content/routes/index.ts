import type { SceneModule } from '../../relationship/types';
import { module as h0 } from './haeun/h0-arrival';
import { module as h1 } from './haeun/h1-paired';
import { module as h2 } from './haeun/h2-again';
import { module as j0 } from './jin/j0-pojangmacha';

export { HAEUN_BIDS, HAEUN_NEEDS } from './haeun/bids';

/** Story scenes in calendar order. */
export const STORY_MODULES: SceneModule[] = [h0, h1, h2, j0];

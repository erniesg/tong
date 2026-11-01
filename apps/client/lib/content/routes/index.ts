import type { SceneModule } from '../../relationship/types';
import { module as d1Airport } from './seoul/d1-airport';
import { module as d1Exit } from './seoul/d1-exit';
import { module as d1Station } from './seoul/d1-station';
import { module as d1Arrive } from './seoul/d1-arrive';
import { module as d1Orientation } from './seoul/d1-orientation';
import { module as h0 } from './haeun/h0-arrival';
import { module as h0Dorm } from './haeun/h0-dorm';
import { module as d1Bedtime } from './seoul/d1-bedtime';
import { module as h1 } from './haeun/h1-paired';
import { module as h2 } from './haeun/h2-again';
import { module as j0 } from './jin/j0-pojangmacha';

export { HAEUN_BIDS, HAEUN_NEEDS } from './haeun/bids';

/** Story scenes in calendar order. */
export const STORY_MODULES: SceneModule[] = [d1Airport, d1Exit, d1Station, d1Arrive, d1Orientation, h0, h0Dorm, d1Bedtime, h1, h2, j0];

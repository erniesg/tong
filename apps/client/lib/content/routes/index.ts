import type { SceneModule } from '../../relationship/types';
import { module as d1Train } from './seoul/d1-train';
import { module as d1Street } from './seoul/d1-street';
import { module as d1Cart } from './seoul/d1-cart';
import { module as d1Busker } from './seoul/d1-busker';
import { module as d1Poster } from './seoul/d1-poster';
import { module as d1Taxi } from './seoul/d1-taxi';
import { module as d1Sprint } from './seoul/d1-sprint';
import { module as d1Lobby } from './seoul/d1-lobby';
import { module as d1RoomB } from './haeun/d1-room-b';
import { module as d1Arrive } from './seoul/d1-arrive';
import { module as d1Orientation } from './seoul/d1-orientation';
import { module as h0 } from './haeun/h0-arrival';
import { module as h0Dorm } from './haeun/h0-dorm';
import { module as d1Bedtime } from './seoul/d1-bedtime';
import { module as h1 } from './haeun/h1-paired';
import { module as h2 } from './haeun/h2-again';
import { module as d2Mum } from './seoul/d2-mum';
import { module as d2Drill } from './seoul/d2-drill';
import { module as j0 } from './jin/j0-pojangmacha';

export { HAEUN_BIDS, HAEUN_NEEDS } from './haeun/bids';

/** Story scenes in calendar order. */
export const STORY_MODULES: SceneModule[] = [d1Train, d1Street, d1Cart, d1Busker, d1Poster, d1Taxi, d1Sprint, d1Lobby, d1RoomB, d1Arrive, d1Orientation, h0, h0Dorm, d1Bedtime, d2Mum, h1, d2Drill, h2, j0];

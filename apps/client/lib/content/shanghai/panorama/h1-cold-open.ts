/**
 * Shanghai panorama onboarding content pack (H1 cold-open).
 *
 * Coordinate system assumptions:
 * - `rect` values are normalized to the authored reference frame (0..1).
 * - x/y represent the top-left corner, width/height are fractions of frame size.
 * - Runtime should clamp values to [0, 1] and then multiply by rendered media bounds.
 * - Timing windows are in seconds from video start using inclusive `startSec` and exclusive `endSec`.
 */
export interface ShanghaiPanoramaPresentation {
  id: string;
  title: string;
  cityId: 'shanghai';
  sceneId: 'shanghai:h1';
  mode: 'cold_open';
  media: {
    type: 'video';
    src: string;
    posterSrc?: string;
    assumption: string;
    isTemporary: boolean;
  };
}

export interface ShanghaiPanoramaHotspotWindow {
  id: string;
  targetId: 'shoucheng' | 'dingman';
  startSec: number;
  endSec: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  note: string;
}

export interface ShanghaiPanoramaTongCallout {
  id: string;
  atSec: number;
  line: string;
}

export interface ShanghaiPanoramaHandoffCopy {
  ctaLabel: string;
  ctaHint: string;
  nextSceneTitle: string;
  nextSceneSummary: string;
}

export interface ShanghaiPanoramaColdOpenPack {
  presentation: ShanghaiPanoramaPresentation;
  hotspots: ShanghaiPanoramaHotspotWindow[];
  tongCallouts: ShanghaiPanoramaTongCallout[];
  handoff: ShanghaiPanoramaHandoffCopy;
}

export const SHANGHAI_H1_PANORAMA_COLD_OPEN: ShanghaiPanoramaColdOpenPack = {
  presentation: {
    id: 'shanghai:h1:panorama-cold-open',
    title: 'Shanghai Onboarding Panorama',
    cityId: 'shanghai',
    sceneId: 'shanghai:h1',
    mode: 'cold_open',
    media: {
      type: 'video',
      // Temporary: this clip is repo-visible today and keeps the route unblocked until
      // the final wide onboarding panorama lands in runtime assets.
      src: '/assets/webtoon/shanghai/h1/0.png',
      posterSrc: '/assets/webtoon/shanghai/h1/0.png',
      assumption:
        'Temporary fallback uses h1 panel 0 as still media because final wide onboarding clip is not yet in repo-visible assets.',
      isTemporary: true,
    },
  },
  hotspots: [
    {
      id: 'h1-shoucheng-open',
      targetId: 'shoucheng',
      startSec: 2,
      endSec: 7,
      rect: { x: 0.12, y: 0.36, width: 0.26, height: 0.52 },
      note: '守成 occupies left-table lane while setting the negotiation frame.',
    },
    {
      id: 'h1-dingman-open',
      targetId: 'dingman',
      startSec: 3.5,
      endSec: 9,
      rect: { x: 0.62, y: 0.32, width: 0.24, height: 0.56 },
      note: '丁漫 is seated on the right side, mostly steady while eating.',
    },
  ],
  tongCallouts: [
    {
      id: 'tong-eavesdrop-1',
      atSec: 4.2,
      line: 'Tong: Stay low and listen — this table is all subtext.',
    },
    {
      id: 'tong-eavesdrop-2',
      atSec: 8.1,
      line: 'Tong: Good. You caught both voices. Let’s enter H1.',
    },
  ],
  handoff: {
    ctaLabel: 'Enter H1 negotiation',
    ctaHint: 'Follow Tong into the dumpling-shop scene.',
    nextSceneTitle: 'H1 · 小笼包店',
    nextSceneSummary: 'Eavesdrop on 守成 and 丁漫, then pick up the first vocabulary beats.',
  },
};

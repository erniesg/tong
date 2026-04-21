import { runtimeAssetUrl } from '@/lib/runtime-assets';
import type { ShanghaiCharacterId } from '../characters';

/**
 * Shanghai onboarding panorama fixture (Phase P2).
 *
 * Coordinate system contract:
 * - Rects are normalized to [0..1] against the authored media frame itself.
 * - Runtime should map these rects after any letterbox/crop math from object-fit,
 *   then apply hit-testing in viewport pixels.
 */
export interface PanoramaHotspotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanoramaHotspotWindow {
  id: string;
  startMs: number;
  endMs: number;
  targetId: ShanghaiCharacterId;
  rect: PanoramaHotspotRect;
  label: string;
}

export interface TongEavesdropCallout {
  id: string;
  atMs: number;
  text: string;
}

export interface ShanghaiPanoramaColdOpenConfig {
  id: 'shanghai-panorama-cold-open-v1';
  presentation: {
    title: string;
    subtitle: string;
    mediaUrl: string;
    posterUrl: string;
    isTemporaryMedia: boolean;
    mediaAssumptionNote: string;
  };
  hotspots: PanoramaHotspotWindow[];
  tongCallouts: TongEavesdropCallout[];
  handoff: {
    ctaLabel: string;
    ctaHint: string;
    routeIntent: 'shanghai:onboarding:h1';
  };
}

// Temporary media assumption (explicit): final Shanghai wide onboarding clip
// is not checked into this repo yet, so we reuse a repo-visible 16:9 still.
const TEMP_WIDE_MEDIA = runtimeAssetUrl('/assets/webtoon/shanghai/h1/0.png');

export const SHANGHAI_PANORAMA_COLD_OPEN: ShanghaiPanoramaColdOpenConfig = {
  id: 'shanghai-panorama-cold-open-v1',
  presentation: {
    title: 'Shanghai · Dumpling Street',
    subtitle: 'Keep your head down. Listen before they notice you.',
    mediaUrl: TEMP_WIDE_MEDIA,
    posterUrl: TEMP_WIDE_MEDIA,
    isTemporaryMedia: true,
    mediaAssumptionNote:
      'Using /assets/webtoon/shanghai/h1/0.png as a temporary stand-in until the final wide onboarding clip lands in-repo.',
  },
  hotspots: [
    {
      id: 'hs-shoucheng-open',
      startMs: 2200,
      endMs: 6100,
      targetId: 'shoucheng',
      // Right side seat, upper torso and face in the current stand-in frame.
      rect: { x: 0.61, y: 0.19, width: 0.21, height: 0.5 },
      label: '守成 · Opening line',
    },
    {
      id: 'hs-dingman-retort',
      startMs: 6400,
      endMs: 9800,
      targetId: 'dingman',
      // Left side diner, tighter crop window for eat-then-retort beat.
      rect: { x: 0.22, y: 0.2, width: 0.2, height: 0.54 },
      label: '丁漫 · Dry response',
    },
  ],
  tongCallouts: [
    {
      id: 'tong-eavesdrop-1',
      atMs: 4700,
      text: 'Tong: That clipped opener is 守成. He starts from terms, not feelings.',
    },
    {
      id: 'tong-eavesdrop-2',
      atMs: 8600,
      text: 'Tong: 丁漫 answers with almost nothing. Watch who controls silence.',
    },
  ],
  handoff: {
    ctaLabel: 'Step into H1 negotiation',
    ctaHint: 'You caught enough. Move closer and take the first scene.',
    routeIntent: 'shanghai:onboarding:h1',
  },
};

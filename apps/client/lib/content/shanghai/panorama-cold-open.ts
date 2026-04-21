/**
 * Shanghai Panorama Content Pack (issue #257 support slice).
 *
 * This pack is intentionally fixture-driven and persistence-agnostic:
 * it only describes authored media timing, hotspot geometry, and handoff copy.
 */

export type NormalizedRect = {
  /** 0..1 fraction from the video's left edge. */
  x: number;
  /** 0..1 fraction from the video's top edge. */
  y: number;
  /** 0..1 fraction of the full frame width. */
  width: number;
  /** 0..1 fraction of the full frame height. */
  height: number;
};

export interface ShanghaiPanoramaHotspotWindow {
  id: string;
  targetId: 'shoucheng' | 'dingman';
  /** Milliseconds from clip start. */
  startMs: number;
  /** Milliseconds from clip start. */
  endMs: number;
  rect: NormalizedRect;
  note?: string;
}

export interface ShanghaiPanoramaCallout {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface ShanghaiPanoramaHandoffCta {
  title: string;
  body: string;
  primaryLabel: string;
  routeHint: 'H1';
}

export interface ShanghaiPanoramaPresentation {
  clipId: string;
  clipSrc: string;
  posterSrc: string;
  autoplayMuted: boolean;
  expectedAspectRatio: '21:9';
  durationMs: number;
}

export interface ShanghaiPanoramaColdOpenConfig {
  id: 'shanghai-panorama-cold-open-v1';
  cityId: 'shanghai';
  locationId: 'dumpling_shop';
  presentation: ShanghaiPanoramaPresentation;
  hotspotWindows: ShanghaiPanoramaHotspotWindow[];
  tongCallouts: ShanghaiPanoramaCallout[];
  handoffCta: ShanghaiPanoramaHandoffCta;
}

export const SHANGHAI_PANORAMA_COLD_OPEN_V1: ShanghaiPanoramaColdOpenConfig = {
  id: 'shanghai-panorama-cold-open-v1',
  cityId: 'shanghai',
  locationId: 'dumpling_shop',
  presentation: {
    clipId: 'shanghai-panorama-temp-tong-intro',
    // TEMP: use repo-visible placeholder until final Shanghai wide onboarding clip lands.
    // Replace with the final authored panorama media key/URL once available.
    clipSrc: '/assets/tong_intro.webm',
    posterSrc: '/assets/locations/shanghai-static.png',
    autoplayMuted: true,
    expectedAspectRatio: '21:9',
    durationMs: 13000,
  },
  // Coordinate convention:
  // - rect values are normalized against the source frame (x/y/width/height in 0..1)
  // - runtime should convert to px using the rendered video box AFTER letterboxing/cropping policy
  hotspotWindows: [
    {
      id: 'hs-shoucheng-open',
      targetId: 'shoucheng',
      startMs: 1800,
      endMs: 5600,
      rect: { x: 0.58, y: 0.22, width: 0.14, height: 0.58 },
      note: '守成 enters frame right and pauses at the table edge.',
    },
    {
      id: 'hs-dingman-open',
      targetId: 'dingman',
      startMs: 3300,
      endMs: 8100,
      rect: { x: 0.31, y: 0.24, width: 0.16, height: 0.56 },
      note: '丁漫 remains seated near the steam basket; quieter visual anchor.',
    },
  ],
  tongCallouts: [
    {
      id: 'tong-eavesdrop-1',
      startMs: 3900,
      endMs: 5800,
      text: 'Tong: Keep your voice low — this is 守成 and 丁漫 before they notice us.',
    },
    {
      id: 'tong-eavesdrop-2',
      startMs: 8600,
      endMs: 11100,
      text: 'Tong: Hear the tension? Let\'s step into H1 and catch the key lines.',
    },
  ],
  handoffCta: {
    title: 'Conversation is heating up.',
    body: 'Enter H1 at the dumpling shop and track how 守成 and 丁漫 frame willingness versus ability.',
    primaryLabel: 'Start H1 eavesdrop',
    routeHint: 'H1',
  },
};

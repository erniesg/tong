import { z } from "zod";

export const SafeZoneSchema = z.object({
  id: z.string(),
  description: z.string(),
  top: z.union([z.number(), z.string()]).optional(),
  left: z.union([z.number(), z.string()]).optional(),
  right: z.union([z.number(), z.string()]).optional(),
  bottom: z.union([z.number(), z.string()]).optional(),
  width: z.union([z.number(), z.string()]),
  height: z.union([z.number(), z.string()]),
});

export type SafeZone = z.infer<typeof SafeZoneSchema>;

export const PlatformFormatSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  variant: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.string(),
  safeZones: z.object({
    noGo: z.array(SafeZoneSchema),
    caution: z.array(SafeZoneSchema),
  }),
});

export type PlatformFormat = z.infer<typeof PlatformFormatSchema>;

// ── Platform Format Definitions ──────────────────────────────
// Ported from aether's platforms.json with safe zone data.
// Safe zone values use fractions (0-1) of canvas dimensions.

export const PLATFORM_FORMATS: Record<string, PlatformFormat> = {
  "instagram-post": {
    id: "instagram-post",
    name: "Instagram Post",
    platform: "instagram",
    variant: "post",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    safeZones: {
      noGo: [],
      caution: [
        { id: "ig-post-header", description: "Header bar (username, menu)", width: 1, height: 0.05, top: 0, left: 0 },
        { id: "ig-post-actions", description: "Like/comment/share bar", width: 1, height: 0.08, bottom: 0, left: 0 },
      ],
    },
  },
  "instagram-story": {
    id: "instagram-story",
    name: "Instagram Story",
    platform: "instagram",
    variant: "story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    safeZones: {
      noGo: [
        { id: "ig-story-top", description: "Status bar + story progress", width: 1, height: 0.1, top: 0, left: 0 },
        { id: "ig-story-bottom", description: "Reply bar + swipe up", width: 1, height: 0.12, bottom: 0, left: 0 },
      ],
      caution: [
        { id: "ig-story-username", description: "Username overlay", width: 0.6, height: 0.04, top: 0.1, left: 0.02 },
      ],
    },
  },
  "instagram-reel": {
    id: "instagram-reel",
    name: "Instagram Reel",
    platform: "instagram",
    variant: "reel",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    safeZones: {
      noGo: [
        { id: "ig-reel-top", description: "Status bar + header", width: 1, height: 0.08, top: 0, left: 0 },
        { id: "ig-reel-bottom", description: "Caption + nav bar", width: 1, height: 0.15, bottom: 0, left: 0 },
      ],
      caution: [
        { id: "ig-reel-actions", description: "Like/comment/share buttons", width: 0.1, height: 0.25, top: 0.45, right: 0 },
      ],
    },
  },
  "tiktok-video": {
    id: "tiktok-video",
    name: "TikTok Video",
    platform: "tiktok",
    variant: "video",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    safeZones: {
      noGo: [
        { id: "tt-top", description: "Status bar + following/for you tabs", width: 1, height: 0.1, top: 0, left: 0 },
        { id: "tt-bottom", description: "Caption + nav bar", width: 1, height: 0.15, bottom: 0, left: 0 },
      ],
      caution: [
        { id: "tt-actions", description: "Action buttons (like, comment, share, avatar)", width: 0.12, height: 0.35, top: 0.4, right: 0 },
        { id: "tt-username", description: "Username + description text", width: 0.75, height: 0.1, bottom: 0.15, left: 0.02 },
      ],
    },
  },
  "linkedin-post": {
    id: "linkedin-post",
    name: "LinkedIn Post",
    platform: "linkedin",
    variant: "post",
    width: 1200,
    height: 628,
    aspectRatio: "1.91:1",
    safeZones: {
      noGo: [],
      caution: [
        { id: "li-post-bottom", description: "Reaction/comment bar overlap", width: 1, height: 0.06, bottom: 0, left: 0 },
      ],
    },
  },
  "linkedin-carousel": {
    id: "linkedin-carousel",
    name: "LinkedIn Carousel",
    platform: "linkedin",
    variant: "carousel",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    safeZones: {
      noGo: [],
      caution: [
        { id: "li-carousel-nav-left", description: "Left nav arrow", width: 0.05, height: 0.08, top: 0.46, left: 0 },
        { id: "li-carousel-nav-right", description: "Right nav arrow", width: 0.05, height: 0.08, top: 0.46, right: 0 },
        { id: "li-carousel-counter", description: "Page counter", width: 0.1, height: 0.04, top: 0.02, right: 0.02 },
      ],
    },
  },
  "facebook-post": {
    id: "facebook-post",
    name: "Facebook Post",
    platform: "facebook",
    variant: "post",
    width: 1200,
    height: 628,
    aspectRatio: "1.91:1",
    safeZones: {
      noGo: [],
      caution: [
        { id: "fb-post-bottom", description: "Link preview / reaction bar", width: 1, height: 0.08, bottom: 0, left: 0 },
      ],
    },
  },
  "facebook-story": {
    id: "facebook-story",
    name: "Facebook Story",
    platform: "facebook",
    variant: "story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    safeZones: {
      noGo: [
        { id: "fb-story-top", description: "Progress bar + profile", width: 1, height: 0.1, top: 0, left: 0 },
        { id: "fb-story-bottom", description: "Reply bar", width: 1, height: 0.1, bottom: 0, left: 0 },
      ],
      caution: [],
    },
  },
  "twitter-post": {
    id: "twitter-post",
    name: "X / Twitter Post",
    platform: "twitter",
    variant: "post",
    width: 1600,
    height: 900,
    aspectRatio: "16:9",
    safeZones: {
      noGo: [],
      caution: [
        { id: "x-post-corners", description: "Rounded corner clipping", width: 0.03, height: 0.05, top: 0, left: 0 },
      ],
    },
  },
  "twitter-header": {
    id: "twitter-header",
    name: "X / Twitter Header",
    platform: "twitter",
    variant: "header",
    width: 1500,
    height: 500,
    aspectRatio: "3:1",
    safeZones: {
      noGo: [
        { id: "x-header-avatar", description: "Profile picture overlap", width: 0.12, height: 0.36, bottom: 0, left: 0.02 },
      ],
      caution: [],
    },
  },
  "youtube-thumbnail": {
    id: "youtube-thumbnail",
    name: "YouTube Thumbnail",
    platform: "youtube",
    variant: "thumbnail",
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    safeZones: {
      noGo: [],
      caution: [
        { id: "yt-duration", description: "Duration badge bottom-right", width: 0.08, height: 0.06, bottom: 0.02, right: 0.02 },
        { id: "yt-playlist", description: "Playlist icon top-right", width: 0.04, height: 0.06, top: 0.02, right: 0.02 },
      ],
    },
  },
  "youtube-short": {
    id: "youtube-short",
    name: "YouTube Short",
    platform: "youtube",
    variant: "short",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    safeZones: {
      noGo: [
        { id: "yt-short-top", description: "Status bar", width: 1, height: 0.05, top: 0, left: 0 },
        { id: "yt-short-bottom", description: "Title + nav bar", width: 1, height: 0.15, bottom: 0, left: 0 },
      ],
      caution: [
        { id: "yt-short-actions", description: "Like/dislike/comment/share", width: 0.1, height: 0.3, top: 0.4, right: 0 },
      ],
    },
  },
  "xiaohongshu-post": {
    id: "xiaohongshu-post",
    name: "Xiaohongshu Post",
    platform: "xiaohongshu",
    variant: "post",
    width: 1080,
    height: 1440,
    aspectRatio: "3:4",
    safeZones: {
      noGo: [],
      caution: [
        { id: "xhs-bottom", description: "Like/collect/comment bar", width: 1, height: 0.08, bottom: 0, left: 0 },
      ],
    },
  },
};

// ── Helper Functions ──────────────────────────────────────────

export function getFormat(id: string): PlatformFormat | undefined {
  return PLATFORM_FORMATS[id];
}

export function getAllFormats(): PlatformFormat[] {
  return Object.values(PLATFORM_FORMATS);
}

export function getFormatsByPlatform(platform: string): PlatformFormat[] {
  return getAllFormats().filter((f) => f.platform === platform);
}

export function getPlatforms(): string[] {
  return [...new Set(getAllFormats().map((f) => f.platform))];
}

/** Group formats by orientation */
export const VERTICAL_FORMATS = getAllFormats().filter((f) => f.height > f.width);
export const HORIZONTAL_FORMATS = getAllFormats().filter((f) => f.width > f.height);
export const SQUARE_FORMATS = getAllFormats().filter((f) => f.width === f.height);

/**
 * Derive CSS-like margins from safe zones (as 0-1 fractions).
 * Useful for computing the "content-safe" area within a format.
 */
export function deriveSafeMargins(format: PlatformFormat): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  let top = 0, right = 0, bottom = 0, left = 0;

  for (const zone of [...format.safeZones.noGo, ...format.safeZones.caution]) {
    const zTop = typeof zone.top === "number" ? zone.top : 0;
    const zBottom = typeof zone.bottom === "number" ? zone.bottom : 0;
    const zLeft = typeof zone.left === "number" ? zone.left : 0;
    const zRight = typeof zone.right === "number" ? zone.right : 0;
    const zH = typeof zone.height === "number" ? zone.height : 0;
    const zW = typeof zone.width === "number" ? zone.width : 0;

    // Full-width zones at top/bottom
    if (zW >= 0.9) {
      if (zone.top !== undefined && zTop < 0.3) top = Math.max(top, zTop + zH);
      if (zone.bottom !== undefined && zBottom < 0.3) bottom = Math.max(bottom, zBottom + zH);
    }
    // Side column zones
    if (zH >= 0.2) {
      if (zone.right !== undefined) right = Math.max(right, zRight + zW);
      if (zone.left !== undefined && zLeft < 0.1) left = Math.max(left, zLeft + zW);
    }
  }

  return { top, right, bottom, left };
}

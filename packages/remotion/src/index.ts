import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);

// Re-export schemas and utilities for server-side consumption
export { EventPosterPropsSchema, defaultEventPosterProps } from "./schemas/poster";
export type { EventPosterProps } from "./schemas/poster";

export { SocialCardPropsSchema, defaultSocialCardProps } from "./schemas/social-card";
export type { SocialCardProps } from "./schemas/social-card";

export {
  FormatSpecSchema,
  TextBlockSchema,
  SubjectLayerSchema,
  BackgroundLayerSchema,
  GradientOverlaySchema,
  BrandingSchema,
} from "./schemas/common";
export type {
  FormatSpec,
  TextBlock,
  SubjectLayer,
  BackgroundLayer,
  GradientOverlay,
  Branding,
} from "./schemas/common";

export {
  PLATFORM_FORMATS,
  getFormat,
  getAllFormats,
  getFormatsByPlatform,
  getPlatforms,
  deriveSafeMargins,
  VERTICAL_FORMATS,
  HORIZONTAL_FORMATS,
  SQUARE_FORMATS,
} from "./schemas/formats";
export type { PlatformFormat, SafeZone } from "./schemas/formats";

export { scaleFontSize, resolvePosition, resolveGravity, computeSubjectDimensions } from "./lib/layout-engine";

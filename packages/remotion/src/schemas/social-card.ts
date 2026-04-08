import { z } from "zod";
import {
  FormatSpecSchema,
  BackgroundLayerSchema,
  GradientOverlaySchema,
  TextBlockSchema,
  BrandingSchema,
} from "./common";

// ── Social Card Composition Props ───────────────────────────
// Simpler than EventPoster: no subject layer.
// For quote cards, announcements, title cards, simple promotions.

export const SocialCardPropsSchema = z.object({
  format: FormatSpecSchema,
  background: BackgroundLayerSchema,
  gradient: GradientOverlaySchema.optional(),
  text: z.array(TextBlockSchema).default([]),
  branding: BrandingSchema.optional(),
  showSafeZones: z.boolean().default(false),
});

export type SocialCardProps = z.infer<typeof SocialCardPropsSchema>;

export const defaultSocialCardProps: SocialCardProps = {
  format: {
    width: 1080,
    height: 1080,
    platform: "instagram",
    variant: "post",
    fps: 30,
    durationInFrames: 1,
  },
  background: {
    imageUrl: "",
    fit: "cover",
    blur: 0,
    brightness: 1,
    opacity: 1,
  },
  gradient: {
    enabled: true,
    direction: "bottom-up",
    color: "rgba(0,0,0,0.6)",
    height: 0.4,
  },
  text: [
    {
      content: "Your message here",
      fontFamily: "Inter",
      fontSize: 56,
      fontWeight: 700,
      color: "#FFFFFF",
      textAlign: "center",
      position: { x: 0.5, y: 0.5, anchor: "center" },
      maxWidth: 0.8,
      lineHeight: 1.2,
      letterSpacing: 0,
      textTransform: "none",
      enterAnimation: "none",
    },
  ],
  showSafeZones: false,
};

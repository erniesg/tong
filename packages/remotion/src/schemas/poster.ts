import { z } from "zod";
import {
  FormatSpecSchema,
  BackgroundLayerSchema,
  GradientOverlaySchema,
  SubjectLayerSchema,
  TextBlockSchema,
  BrandingSchema,
} from "./common";

// ── Event Poster Composition Props ──────────────────────────
// Full-featured composition: background + subject + text + branding.
// Supports both stills (durationInFrames=1) and video (animated layers).

export const EventPosterPropsSchema = z.object({
  format: FormatSpecSchema,
  background: BackgroundLayerSchema,
  gradient: GradientOverlaySchema.optional(),
  subject: SubjectLayerSchema.optional(),
  text: z.array(TextBlockSchema).default([]),
  branding: BrandingSchema.optional(),
  showSafeZones: z.boolean().default(false), // dev mode
});

export type EventPosterProps = z.infer<typeof EventPosterPropsSchema>;

// Default props for Remotion Studio preview
export const defaultEventPosterProps: EventPosterProps = {
  format: {
    width: 1080,
    height: 1920,
    platform: "instagram",
    variant: "story",
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
    color: "rgba(0,0,0,0.7)",
    height: 0.5,
  },
  text: [
    {
      content: "EVENT TITLE",
      fontFamily: "Inter",
      fontSize: 72,
      fontWeight: 800,
      color: "#FFFFFF",
      textAlign: "center",
      position: { x: 0.5, y: 0.75, anchor: "center" },
      maxWidth: 0.85,
      lineHeight: 1.1,
      letterSpacing: -1,
      textTransform: "uppercase",
      enterAnimation: "none",
    },
    {
      content: "Subtitle goes here",
      fontFamily: "Inter",
      fontSize: 32,
      fontWeight: 400,
      color: "rgba(255,255,255,0.8)",
      textAlign: "center",
      position: { x: 0.5, y: 0.83, anchor: "center" },
      maxWidth: 0.75,
      lineHeight: 1.3,
      letterSpacing: 0,
      textTransform: "none",
      enterAnimation: "none",
    },
  ],
  showSafeZones: false,
};

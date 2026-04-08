import { z } from "zod";

// ── Format Spec ──────────────────────────────────────────────
// Passed to every composition to define output dimensions.

export const FormatSpecSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  platform: z.string().optional(),
  variant: z.string().optional(),
  fps: z.number().default(30),
  durationInFrames: z.number().int().default(1), // 1 = still image
});

export type FormatSpec = z.infer<typeof FormatSpecSchema>;

// ── Anchor / Position ────────────────────────────────────────
// All coordinates are normalized 0-1, resolved to pixels at render time.

export const AnchorSchema = z.enum([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
]);

export type Anchor = z.infer<typeof AnchorSchema>;

export const PositionSchema = z.object({
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  anchor: AnchorSchema.default("center"),
});

export type Position = z.infer<typeof PositionSchema>;

// ── Text Block ───────────────────────────────────────────────
// Programmatic text rendered by TextLayer. fontSize is relative
// to a 1080px reference width and scales proportionally.

export const TextShadowSchema = z.object({
  color: z.string().default("rgba(0,0,0,0.5)"),
  blur: z.number().default(4),
  offsetX: z.number().default(0),
  offsetY: z.number().default(2),
});

export const TextBlockSchema = z.object({
  content: z.string(),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().default(48), // relative to 1080px width
  fontWeight: z.number().default(700),
  color: z.string().default("#FFFFFF"),
  textAlign: z.enum(["left", "center", "right"]).default("center"),
  position: PositionSchema,
  maxWidth: z.number().min(0).max(1).default(0.9), // fraction of canvas width
  lineHeight: z.number().default(1.2),
  letterSpacing: z.number().default(0), // px
  textTransform: z.enum(["none", "uppercase", "lowercase"]).default("none"),
  shadow: TextShadowSchema.optional(),
  // Animation (video only — ignored for stills)
  enterFrame: z.number().int().optional(),
  exitFrame: z.number().int().optional(),
  enterAnimation: z.enum(["fadeIn", "slideUp", "scaleIn", "none"]).default("none"),
});

export type TextBlock = z.infer<typeof TextBlockSchema>;

// ── Background Layer ─────────────────────────────────────────

export const BackgroundLayerSchema = z.object({
  imageUrl: z.string(), // URL, file path, or base64 data URI
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  blur: z.number().default(0),
  brightness: z.number().min(0).max(2).default(1),
  opacity: z.number().min(0).max(1).default(1),
});

export type BackgroundLayer = z.infer<typeof BackgroundLayerSchema>;

// ── Gradient Overlay ─────────────────────────────────────────

export const GradientOverlaySchema = z.object({
  enabled: z.boolean().default(true),
  direction: z.enum(["bottom-up", "top-down", "left-right", "right-left"]).default("bottom-up"),
  color: z.string().default("rgba(0,0,0,0.7)"),
  height: z.number().min(0).max(1).default(0.5), // fraction of canvas
});

export type GradientOverlay = z.infer<typeof GradientOverlaySchema>;

// ── Subject Layer ────────────────────────────────────────────
// Extracted subject (photo, character asset) with gravity-based positioning.

export const GravitySchema = z.enum([
  "bottom-center", "bottom-left", "bottom-right",
  "center", "center-left", "center-right",
  "top-center", "top-left", "top-right",
]);

export const SubjectLayerSchema = z.object({
  imageUrl: z.string(), // alpha PNG — URL, file path, or base64 data URI
  gravity: GravitySchema.default("bottom-center"),
  offsetX: z.number().default(0), // normalized 0-1
  offsetY: z.number().default(0), // normalized 0-1
  scale: z.number().min(0.1).max(3).default(0.8), // fraction of canvas height
  opacity: z.number().min(0).max(1).default(1),
  // Effects
  dropShadow: z.object({
    color: z.string().default("rgba(0,0,0,0.3)"),
    blur: z.number().default(20),
    offsetX: z.number().default(0),
    offsetY: z.number().default(10),
  }).optional(),
  contourLine: z.object({
    color: z.string().default("#FFFFFF"),
    width: z.number().default(3),
  }).optional(),
});

export type SubjectLayer = z.infer<typeof SubjectLayerSchema>;

// ── Branding ─────────────────────────────────────────────────

export const BrandingSchema = z.object({
  logoUrl: z.string().optional(),
  logoPosition: AnchorSchema.default("bottom-right"),
  logoScale: z.number().min(0.01).max(0.3).default(0.08), // fraction of width
  watermarkText: z.string().optional(),
});

export type Branding = z.infer<typeof BrandingSchema>;

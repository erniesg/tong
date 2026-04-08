import React from "react";
import { AbsoluteFill } from "remotion";
import type { SocialCardProps } from "../schemas/social-card";
import { BackgroundLayer } from "../components/BackgroundLayer";
import { GradientOverlay } from "../components/GradientOverlay";
import { TextLayer } from "../components/TextLayer";
import { SafeZoneGuide } from "../components/SafeZoneGuide";

/**
 * SocialCard — Simpler composition without subject layer.
 * For quote cards, announcements, title cards, promotions.
 *
 * Layer stack: Background → Gradient → Text[] → SafeZones (dev)
 */
export const SocialCard: React.FC<SocialCardProps> = ({
  format,
  background,
  gradient,
  text,
  branding,
  showSafeZones,
}) => {
  const { width, height } = format;
  const formatId = format.platform && format.variant
    ? `${format.platform}-${format.variant}`
    : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Layer 0: Background */}
      <BackgroundLayer {...background} width={width} height={height} />

      {/* Layer 1: Gradient overlay */}
      {gradient && (
        <GradientOverlay {...gradient} width={width} height={height} />
      )}

      {/* Layer 2: Text blocks */}
      {text.map((block, i) => (
        <TextLayer
          key={i}
          {...block}
          canvasWidth={width}
          canvasHeight={height}
        />
      ))}

      {/* Layer 3: Branding */}
      {branding?.logoUrl && (
        <div
          style={{
            position: "absolute",
            ...(branding.logoPosition.includes("bottom") ? { bottom: width * 0.03 } : { top: width * 0.03 }),
            ...(branding.logoPosition.includes("right") ? { right: width * 0.03 } : { left: width * 0.03 }),
          }}
        >
          <img
            src={branding.logoUrl}
            style={{
              width: width * (branding.logoScale || 0.08),
              height: "auto",
              opacity: 0.9,
            }}
          />
        </div>
      )}

      {/* Dev: Safe zone visualization */}
      {showSafeZones && formatId && (
        <SafeZoneGuide formatId={formatId} width={width} height={height} />
      )}
    </AbsoluteFill>
  );
};

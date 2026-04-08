import React from "react";
import { AbsoluteFill } from "remotion";
import type { EventPosterProps } from "../schemas/poster";
import { BackgroundLayer } from "../components/BackgroundLayer";
import { GradientOverlay } from "../components/GradientOverlay";
import { SubjectLayer } from "../components/SubjectLayer";
import { TextLayer } from "../components/TextLayer";
import { SafeZoneGuide } from "../components/SafeZoneGuide";

/**
 * EventPoster — Full-featured composition with layer stack:
 *   Background → Gradient → Subject → Text[] → SafeZones (dev)
 *
 * Works as both still (durationInFrames=1 → renderStill → PNG)
 * and video (durationInFrames>1 → renderMedia → MP4 with animations).
 */
export const EventPoster: React.FC<EventPosterProps> = ({
  format,
  background,
  gradient,
  subject,
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

      {/* Layer 1: Gradient overlay for text readability */}
      {gradient && (
        <GradientOverlay {...gradient} width={width} height={height} />
      )}

      {/* Layer 2: Subject (extracted photo, character asset) */}
      {subject && (
        <SubjectLayer {...subject} width={width} height={height} />
      )}

      {/* Layer 3: Text blocks */}
      {text.map((block, i) => (
        <TextLayer
          key={i}
          {...block}
          canvasWidth={width}
          canvasHeight={height}
        />
      ))}

      {/* Layer 4: Branding */}
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

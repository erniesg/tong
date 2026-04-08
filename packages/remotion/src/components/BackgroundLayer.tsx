import React from "react";
import { Img, useCurrentFrame, interpolate } from "remotion";
import type { BackgroundLayer as BackgroundLayerProps } from "../schemas/common";

export const BackgroundLayer: React.FC<
  BackgroundLayerProps & { width: number; height: number }
> = ({ imageUrl, fit, blur, brightness, opacity, width, height }) => {
  const filters: string[] = [];
  if (blur > 0) filters.push(`blur(${blur}px)`);
  if (brightness !== 1) filters.push(`brightness(${brightness})`);

  if (!imageUrl) {
    // Fallback: dark gradient background when no image provided
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        }}
      />
    );
  }

  return (
    <Img
      src={imageUrl}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        objectFit: fit,
        filter: filters.length > 0 ? filters.join(" ") : undefined,
        opacity,
      }}
    />
  );
};

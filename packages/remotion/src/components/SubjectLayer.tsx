import React, { useMemo } from "react";
import { Img } from "remotion";
import type { SubjectLayer as SubjectLayerProps } from "../schemas/common";
import { resolveGravity } from "../lib/layout-engine";

export const SubjectLayer: React.FC<
  SubjectLayerProps & {
    width: number;
    height: number;
    /** Natural dimensions of the subject image, if known */
    naturalWidth?: number;
    naturalHeight?: number;
  }
> = ({
  imageUrl,
  gravity,
  offsetX,
  offsetY,
  scale,
  opacity,
  dropShadow,
  contourLine,
  width: canvasWidth,
  height: canvasHeight,
  naturalWidth,
  naturalHeight,
}) => {
  if (!imageUrl) return null;

  // Default natural dimensions assume portrait character art (roughly 9:16)
  const natW = naturalWidth || 1970;
  const natH = naturalHeight || 3502;
  const aspect = natW / natH;

  // Subject height = scale * canvas height
  const subjectHeight = Math.round(canvasHeight * scale);
  const subjectWidth = Math.round(subjectHeight * aspect);

  const { left, top } = resolveGravity(
    gravity,
    subjectWidth,
    subjectHeight,
    canvasWidth,
    canvasHeight,
    offsetX,
    offsetY,
  );

  const filters: string[] = [];
  if (dropShadow) {
    filters.push(
      `drop-shadow(${dropShadow.offsetX}px ${dropShadow.offsetY}px ${dropShadow.blur}px ${dropShadow.color})`,
    );
  }

  return (
    <Img
      src={imageUrl}
      style={{
        position: "absolute",
        left,
        top,
        width: subjectWidth,
        height: subjectHeight,
        objectFit: "contain",
        opacity,
        filter: filters.length > 0 ? filters.join(" ") : undefined,
      }}
    />
  );
};

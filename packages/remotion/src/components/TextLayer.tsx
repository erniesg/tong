import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import type { TextBlock } from "../schemas/common";
import { scaleFontSize, resolvePosition } from "../lib/layout-engine";

export const TextLayer: React.FC<
  TextBlock & { canvasWidth: number; canvasHeight: number }
> = ({
  content,
  fontFamily,
  fontSize,
  fontWeight,
  color,
  textAlign,
  position,
  maxWidth,
  lineHeight,
  letterSpacing,
  textTransform,
  shadow,
  enterFrame,
  exitFrame,
  enterAnimation,
  canvasWidth,
  canvasHeight,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scaledFontSize = scaleFontSize(fontSize, canvasWidth);
  const elementWidth = canvasWidth * maxWidth;

  // Estimate element height for anchor positioning (rough, 2 lines)
  const estimatedHeight = scaledFontSize * lineHeight * 2;

  const { left, top } = resolvePosition(
    position,
    elementWidth,
    estimatedHeight,
    canvasWidth,
    canvasHeight,
  );

  // Animation calculations (only for video, ignored when durationInFrames=1)
  let animationOpacity = 1;
  let animationTranslateY = 0;
  let animationScale = 1;

  if (durationInFrames > 1 && enterAnimation !== "none" && enterFrame !== undefined) {
    const localFrame = frame - enterFrame;

    if (localFrame < 0) {
      animationOpacity = 0;
    } else {
      switch (enterAnimation) {
        case "fadeIn": {
          animationOpacity = interpolate(localFrame, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          break;
        }
        case "slideUp": {
          const springValue = spring({ frame: localFrame, fps, durationInFrames: 20 });
          animationOpacity = interpolate(localFrame, [0, 10], [0, 1], {
            extrapolateRight: "clamp",
          });
          animationTranslateY = interpolate(springValue, [0, 1], [40, 0]);
          break;
        }
        case "scaleIn": {
          const springValue = spring({ frame: localFrame, fps, durationInFrames: 20 });
          animationOpacity = interpolate(localFrame, [0, 8], [0, 1], {
            extrapolateRight: "clamp",
          });
          animationScale = interpolate(springValue, [0, 1], [0.5, 1]);
          break;
        }
      }
    }

    // Exit animation
    if (exitFrame !== undefined && frame >= exitFrame) {
      const exitLocal = frame - exitFrame;
      animationOpacity = interpolate(exitLocal, [0, 10], [1, 0], {
        extrapolateRight: "clamp",
      });
    }
  }

  const textShadow = shadow
    ? `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`
    : undefined;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: elementWidth,
        fontFamily,
        fontSize: scaledFontSize,
        fontWeight,
        color,
        textAlign,
        lineHeight,
        letterSpacing,
        textTransform,
        textShadow,
        opacity: animationOpacity,
        transform: `translateY(${animationTranslateY}px) scale(${animationScale})`,
        wordWrap: "break-word",
        whiteSpace: "pre-wrap",
      }}
    >
      {content}
    </div>
  );
};

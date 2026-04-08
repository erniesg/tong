import React from "react";
import type { GradientOverlay as GradientOverlayProps } from "../schemas/common";

const DIRECTION_MAP: Record<string, string> = {
  "bottom-up": "to top",
  "top-down": "to bottom",
  "left-right": "to right",
  "right-left": "to left",
};

export const GradientOverlay: React.FC<
  GradientOverlayProps & { width: number; height: number }
> = ({ enabled, direction, color, height: gradientHeight, width, height }) => {
  if (!enabled) return null;

  const cssDirection = DIRECTION_MAP[direction] || "to top";
  const gradientH = Math.round(height * gradientHeight);

  // Position based on direction
  const isTop = direction === "top-down";
  const isLeft = direction === "left-right";
  const isRight = direction === "right-left";

  const style: React.CSSProperties = {
    position: "absolute",
    left: 0,
    width: isLeft || isRight ? gradientH : width,
    height: isTop || direction === "bottom-up" ? gradientH : height,
    background: `linear-gradient(${cssDirection}, ${color}, transparent)`,
    pointerEvents: "none",
  };

  if (direction === "bottom-up") {
    style.bottom = 0;
  } else if (isTop) {
    style.top = 0;
  } else if (isLeft) {
    style.left = 0;
    style.top = 0;
    style.height = height;
  } else if (isRight) {
    style.right = 0;
    style.left = "auto";
    style.top = 0;
    style.height = height;
  }

  return <div style={style} />;
};

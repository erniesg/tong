import type { Anchor, Position, FormatSpec } from "../schemas/common";

const REFERENCE_WIDTH = 1080;

/**
 * Scale a fontSize (designed for 1080px width) to the actual format width.
 */
export function scaleFontSize(fontSize: number, formatWidth: number): number {
  return Math.round(fontSize * (formatWidth / REFERENCE_WIDTH));
}

/**
 * Resolve normalized 0-1 position + anchor to absolute top-left pixel coordinates.
 * Returns { left, top } for CSS absolute positioning.
 */
export function resolvePosition(
  position: Position,
  elementWidth: number,
  elementHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { left: number; top: number } {
  const cx = position.x * canvasWidth;
  const cy = position.y * canvasHeight;

  let left: number;
  let top: number;

  // Horizontal anchor
  if (position.anchor.includes("left")) {
    left = cx;
  } else if (position.anchor.includes("right")) {
    left = cx - elementWidth;
  } else {
    left = cx - elementWidth / 2;
  }

  // Vertical anchor
  if (position.anchor.includes("top")) {
    top = cy;
  } else if (position.anchor.includes("bottom")) {
    top = cy - elementHeight;
  } else {
    top = cy - elementHeight / 2;
  }

  return { left, top };
}

/**
 * Compute absolute position for a gravity-based subject layer.
 * Returns { left, top } for CSS absolute positioning.
 */
export function resolveGravity(
  gravity: string,
  subjectWidth: number,
  subjectHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  offsetX: number = 0,
  offsetY: number = 0,
): { left: number; top: number } {
  let left: number;
  let top: number;

  // Horizontal
  if (gravity.includes("left")) {
    left = 0;
  } else if (gravity.includes("right")) {
    left = canvasWidth - subjectWidth;
  } else {
    left = (canvasWidth - subjectWidth) / 2;
  }

  // Vertical
  if (gravity.includes("top")) {
    top = 0;
  } else if (gravity.includes("bottom")) {
    top = canvasHeight - subjectHeight;
  } else {
    top = (canvasHeight - subjectHeight) / 2;
  }

  // Apply normalized offsets
  left += offsetX * canvasWidth;
  top += offsetY * canvasHeight;

  return { left, top };
}

/**
 * Compute subject dimensions given scale (fraction of canvas height)
 * and the subject's natural aspect ratio.
 */
export function computeSubjectDimensions(
  naturalWidth: number,
  naturalHeight: number,
  canvasHeight: number,
  scale: number,
): { width: number; height: number } {
  const targetHeight = canvasHeight * scale;
  const aspect = naturalWidth / naturalHeight;
  return {
    width: Math.round(targetHeight * aspect),
    height: Math.round(targetHeight),
  };
}

import React from "react";
import type { PlatformFormat, SafeZone } from "../schemas/formats";
import { getFormat } from "../schemas/formats";

/**
 * Dev-only overlay that visualizes platform safe zones.
 * noGo zones render in red, caution zones in yellow.
 */
export const SafeZoneGuide: React.FC<{
  formatId?: string;
  width: number;
  height: number;
}> = ({ formatId, width, height }) => {
  if (!formatId) return null;

  const format = getFormat(formatId);
  if (!format) return null;

  const renderZone = (zone: SafeZone, color: string) => {
    const resolve = (val: number | string | undefined, dimension: number): number => {
      if (val === undefined) return 0;
      if (typeof val === "number") return val <= 1 ? val * dimension : val;
      return 0;
    };

    const zW = resolve(zone.width, width);
    const zH = resolve(zone.height, height);
    const zTop = zone.top !== undefined ? resolve(zone.top, height) : undefined;
    const zBottom = zone.bottom !== undefined ? resolve(zone.bottom, height) : undefined;
    const zLeft = zone.left !== undefined ? resolve(zone.left, width) : undefined;
    const zRight = zone.right !== undefined ? resolve(zone.right, width) : undefined;

    const style: React.CSSProperties = {
      position: "absolute",
      width: zW,
      height: zH,
      backgroundColor: color,
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: Math.min(zW, zH) * 0.15,
      color: "rgba(255,255,255,0.7)",
      fontFamily: "monospace",
      overflow: "hidden",
    };

    if (zTop !== undefined) style.top = zTop;
    if (zBottom !== undefined) style.bottom = zBottom;
    if (zLeft !== undefined) style.left = zLeft;
    if (zRight !== undefined) style.right = zRight;

    return (
      <div key={zone.id} style={style}>
        {zone.id}
      </div>
    );
  };

  return (
    <>
      {format.safeZones.noGo.map((z) => renderZone(z, "rgba(255,0,0,0.25)"))}
      {format.safeZones.caution.map((z) => renderZone(z, "rgba(255,200,0,0.2)"))}
    </>
  );
};

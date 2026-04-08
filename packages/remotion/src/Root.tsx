import React from "react";
import { Composition } from "remotion";
import { EventPoster } from "./compositions/EventPoster";
import { SocialCard } from "./compositions/SocialCard";
import { defaultEventPosterProps } from "./schemas/poster";
import { defaultSocialCardProps } from "./schemas/social-card";
import { PLATFORM_FORMATS } from "./schemas/formats";

/**
 * Root — Remotion composition registry.
 *
 * Registers compositions at multiple format sizes so they're all
 * previewable in Remotion Studio. The same compositions are used
 * programmatically by the server's renderStill/renderMedia calls
 * with arbitrary dimensions.
 */
export const RemotionRoot: React.FC = () => {
  // Register EventPoster at key format sizes for preview
  const posterFormats = [
    PLATFORM_FORMATS["instagram-story"],   // 9:16
    PLATFORM_FORMATS["instagram-post"],    // 1:1
    PLATFORM_FORMATS["linkedin-post"],     // 1.91:1
    PLATFORM_FORMATS["youtube-thumbnail"], // 16:9
    PLATFORM_FORMATS["twitter-header"],    // 3:1
    PLATFORM_FORMATS["xiaohongshu-post"],  // 3:4
  ];

  return (
    <>
      {/* EventPoster compositions — one per format for preview */}
      {posterFormats.map((fmt) => (
        <Composition
          key={`EventPoster-${fmt.id}`}
          id={`EventPoster-${fmt.id}`}
          component={EventPoster}
          durationInFrames={1}
          fps={30}
          width={fmt.width}
          height={fmt.height}
          defaultProps={{
            ...defaultEventPosterProps,
            format: {
              width: fmt.width,
              height: fmt.height,
              platform: fmt.platform,
              variant: fmt.variant,
              fps: 30,
              durationInFrames: 1,
            },
            showSafeZones: true,
          }}
        />
      ))}

      {/* SocialCard compositions — one per format for preview */}
      {posterFormats.map((fmt) => (
        <Composition
          key={`SocialCard-${fmt.id}`}
          id={`SocialCard-${fmt.id}`}
          component={SocialCard}
          durationInFrames={1}
          fps={30}
          width={fmt.width}
          height={fmt.height}
          defaultProps={{
            ...defaultSocialCardProps,
            format: {
              width: fmt.width,
              height: fmt.height,
              platform: fmt.platform,
              variant: fmt.variant,
              fps: 30,
              durationInFrames: 1,
            },
            showSafeZones: true,
          }}
        />
      ))}

      {/* Video versions for animation preview (5 seconds) */}
      <Composition
        id="EventPoster-video-9x16"
        component={EventPoster}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          ...defaultEventPosterProps,
          format: {
            width: 1080,
            height: 1920,
            platform: "instagram",
            variant: "reel",
            fps: 30,
            durationInFrames: 150,
          },
          text: [
            {
              content: "EVENT TITLE",
              fontFamily: "Inter",
              fontSize: 72,
              fontWeight: 800,
              color: "#FFFFFF",
              textAlign: "center" as const,
              position: { x: 0.5, y: 0.7, anchor: "center" as const },
              maxWidth: 0.85,
              lineHeight: 1.1,
              letterSpacing: -1,
              textTransform: "uppercase" as const,
              enterFrame: 15,
              enterAnimation: "slideUp" as const,
            },
            {
              content: "Subtitle with animation",
              fontFamily: "Inter",
              fontSize: 32,
              fontWeight: 400,
              color: "rgba(255,255,255,0.8)",
              textAlign: "center" as const,
              position: { x: 0.5, y: 0.8, anchor: "center" as const },
              maxWidth: 0.75,
              lineHeight: 1.3,
              letterSpacing: 0,
              textTransform: "none" as const,
              enterFrame: 30,
              enterAnimation: "fadeIn" as const,
            },
          ],
        }}
      />
    </>
  );
};

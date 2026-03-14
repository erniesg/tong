'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type HeroVideoSource = 'static' | 'hevc' | 'webm';

const STATIC_FALLBACK = '/assets/characters/tong/tong_neutral.png';
const HEVC_SOURCE = '/assets/tong_intro_alpha.mov';
const WEBM_SOURCE = '/assets/tong_intro.webm';

function isSafariFamily(ua: string) {
  return /Safari/i.test(ua) && !/(Chrome|CriOS|Edg|EdgiOS|Firefox|FxiOS|OPR|OPiOS|SamsungBrowser)/i.test(ua);
}

function detectSource(probe: HTMLVideoElement): HeroVideoSource {
  if (typeof window === 'undefined') return 'static';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'static';

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return 'static';

  const ua = navigator.userAgent;
  const canHevc = Boolean(
    probe.canPlayType('video/mp4; codecs="hvc1"') || probe.canPlayType('video/quicktime; codecs="hvc1"'),
  );
  const canWebm = Boolean(
    probe.canPlayType('video/webm; codecs="vp9"') || probe.canPlayType('video/webm; codecs="vp8"'),
  );

  if (isSafariFamily(ua) && canHevc) return 'hevc';
  if (canWebm) return 'webm';
  if (canHevc) return 'hevc';
  return 'static';
}

export default function TongHeroVideo() {
  const [source, setSource] = useState<HeroVideoSource>('static');
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const probe = document.createElement('video');
    setSource(detectSource(probe));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || source === 'static') return;

    setVideoReady(false);

    const tryPlay = async () => {
      try {
        await video.play();
      } catch {
        setVideoReady(false);
        setSource('static');
      }
    };

    void tryPlay();
  }, [source]);

  const src = source === 'hevc' ? HEVC_SOURCE : source === 'webm' ? WEBM_SOURCE : null;

  return (
    <div className="landing-hero-video-shell" aria-hidden="true">
      {source === 'static' ? (
        <Image
          src={STATIC_FALLBACK}
          alt=""
          width={960}
          height={960}
          priority
          className="landing-hero-poster"
        />
      ) : null}
      {src ? (
        <video
          key={src}
          ref={videoRef}
          className={`landing-hero-video${videoReady ? ' landing-hero-video--ready' : ''}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          src={src}
          onLoadedData={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          onError={() => {
            setVideoReady(false);
            setSource('static');
          }}
        />
      ) : null}
    </div>
  );
}

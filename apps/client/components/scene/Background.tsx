'use client';

interface BackgroundProps {
  imageUrl: string;
}

export function Background({ imageUrl }: BackgroundProps) {
  return (
    <div className="scene-background-layer" aria-hidden>
      <img className="scene-background-image" src={imageUrl} alt="" />
      <div className="scene-background-gradient" />
    </div>
  );
}

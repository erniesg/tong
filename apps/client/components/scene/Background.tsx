'use client';

interface BackgroundProps {
  imageUrl: string;
  ambientDescription?: string;
  fade?: boolean;
}

export function Background({ imageUrl, ambientDescription, fade = false }: BackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: 'center bottom',
            transition: fade ? 'opacity 0.5s ease-in-out' : undefined,
            animation: fade ? 'backdrop-fade-in 0.5s ease-in-out' : undefined,
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : ambientDescription ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-dark)] p-8">
          <p className="max-w-xs text-center text-base italic text-[var(--color-text-muted)]">
            {ambientDescription}
          </p>
        </div>
      ) : null}
      {/* Subtle bottom gradient — just enough for subtitle legibility */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
}

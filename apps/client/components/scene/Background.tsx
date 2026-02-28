'use client';

interface BackgroundProps {
  imageUrl: string;
  ambientDescription?: string;
}

export function Background({ imageUrl, ambientDescription }: BackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : ambientDescription ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-dark)] p-8">
          <p className="max-w-xs text-center text-base italic text-[var(--color-text-muted)]">
            {ambientDescription}
          </p>
        </div>
      ) : null}
      {/* Dark gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
    </div>
  );
}

'use client';

interface Props {
  label: string;
  pinyin?: string;
  description: string;
  className?: string;
}

export function HanziStrokeLabel({ label, pinyin, description, className }: Props) {
  return (
    <span className={className}>
      <span className="hanzi-stroke-label__name text-ko">{label}</span>
      {pinyin && <span className="hanzi-stroke-label__pinyin">{pinyin}</span>}
      <span className="hanzi-stroke-label__meaning">{description}</span>
    </span>
  );
}

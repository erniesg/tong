'use client';

import { useEffect, useRef, useState } from 'react';
import type { SlotLayout } from '@/lib/content/block-crush-data';

interface Props {
  targetChar: string;
  components: { piece: string; slot: string; colorHint: string }[];
  layout: SlotLayout;
  duration: number;
  onComplete: () => void;
}

/** Natural construction order for each layout type */
function getRevealOrder(layout: SlotLayout, components: { slot: string }[]): string[] {
  const slots = components.map((c) => c.slot);
  switch (layout) {
    case 'ko-cv-lr':
    case 'ko-cv-tb':
      return ['C', 'V'].filter((s) => slots.includes(s));
    case 'ko-cvf-lr':
    case 'ko-cvf-tb':
      return ['C', 'V', 'F'].filter((s) => slots.includes(s));
    case 'left-right':
      return ['left', 'right'].filter((s) => slots.includes(s));
    case 'top-bottom':
      return ['top', 'bottom'].filter((s) => slots.includes(s));
    case 'dakuten':
      return ['base', ...slots.filter((s) => s === 'dakuten' || s === 'handakuten')];
    case 'convert':
      return ['hiragana', 'convert'].filter((s) => slots.includes(s));
  }
}

type Phase = 'reveal' | 'converge' | 'merged';

export function CharAssemblyAnimation({ targetChar, components, layout, duration, onComplete }: Props) {
  const [revealedPieces, setRevealedPieces] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('reveal');
  const completeCalled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    completeCalled.current = false;
    setRevealedPieces(new Set());
    setPhase('reveal');

    const order = getRevealOrder(layout, components);
    const assembleEnd = duration * 0.45;
    const stagger = assembleEnd / Math.max(order.length, 1);
    const convergeAt = assembleEnd + 150;
    const mergeAt = duration * 0.65;
    const completeAt = duration * 0.92;

    // Phase 1: Reveal pieces one by one
    order.forEach((slot, i) => {
      const t = setTimeout(() => {
        setRevealedPieces((prev) => new Set(prev).add(slot));
      }, stagger * i);
      timers.current.push(t);
    });

    // Phase 2: Converge — pieces slide together
    timers.current.push(setTimeout(() => setPhase('converge'), convergeAt));

    // Phase 3: Merged — real character fades in
    timers.current.push(setTimeout(() => setPhase('merged'), mergeAt));

    // Complete
    timers.current.push(setTimeout(() => {
      if (!completeCalled.current) {
        completeCalled.current = true;
        onCompleteRef.current();
      }
    }, completeAt));

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [targetChar, layout, duration]);

  const converged = phase === 'converge' || phase === 'merged';
  const merged = phase === 'merged';

  function renderPiece(slotName: string) {
    const comp = components.find((c) => c.slot === slotName);
    if (!comp) return null;
    const revealed = revealedPieces.has(slotName);
    return (
      <div
        key={comp.slot}
        className={`bc-assembly__piece ${revealed ? 'bc-assembly__piece--revealed' : ''}`}
        style={{
          textShadow: revealed ? `0 0 10px ${comp.colorHint}` : 'none',
          color: revealed ? '#fff' : 'transparent',
          opacity: merged ? 0 : undefined,
        }}
      >
        {comp.piece}
      </div>
    );
  }

  function renderLayout() {
    const gap = converged ? 0 : 16;
    const row: React.CSSProperties = { display: 'flex', justifyContent: 'center', gap, transition: 'gap 0.4s ease-in-out' };
    const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap, transition: 'gap 0.4s ease-in-out' };

    switch (layout) {
      case 'ko-cv-lr':
        return <div style={row}>{renderPiece('C')}{renderPiece('V')}</div>;
      case 'ko-cv-tb':
        return <div style={col}>{renderPiece('C')}{renderPiece('V')}</div>;
      case 'ko-cvf-lr':
        return (
          <div style={col}>
            <div style={row}>{renderPiece('C')}{renderPiece('V')}</div>
            {renderPiece('F')}
          </div>
        );
      case 'ko-cvf-tb':
        return <div style={col}>{renderPiece('C')}{renderPiece('V')}{renderPiece('F')}</div>;
      case 'left-right':
        return <div style={row}>{renderPiece('left')}{renderPiece('right')}</div>;
      case 'top-bottom':
        return <div style={col}>{renderPiece('top')}{renderPiece('bottom')}</div>;
      case 'dakuten': {
        const markSlot = components.find((c) => c.slot === 'dakuten' || c.slot === 'handakuten')!.slot;
        return (
          <div style={{ ...row, alignItems: 'flex-start' }}>
            <div className="bc-assembly__piece-lg">{renderPiece('base')}</div>
            <div className="bc-assembly__piece-sm">{renderPiece(markSlot)}</div>
          </div>
        );
      }
      case 'convert':
        return <div style={row}>{renderPiece('hiragana')}{renderPiece('convert')}</div>;
    }
  }

  return (
    <div className="bc-assembly" style={{ position: 'relative' }}>
      {/* Pieces layer — fades out when merged */}
      <div style={{ transition: 'opacity 0.3s ease-out', opacity: merged ? 0 : 1 }}>
        {renderLayout()}
      </div>
      {/* Merged character — fades in on top */}
      <div
        className="bc-assembly__merged"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: merged ? 1 : 0,
          transition: 'opacity 0.4s ease-out',
          pointerEvents: 'none',
        }}
      >
        {targetChar}
      </div>
    </div>
  );
}

'use client';

import type { WebtoonUnlockRequest } from './WebtoonStrip';

interface WebtoonPurchaseSheetProps {
  request: WebtoonUnlockRequest | null;
  spBalance: number;
  onClose: () => void;
  onSpendSp: () => void;
  onActivateGamePass: () => void;
}

const SPEAKER_LABELS: Record<string, string> = {
  ayi: '方阿姨',
  dingman: '丁漫',
  shoucheng: '瞿守成',
  narrator: '旁白',
};

export function WebtoonPurchaseSheet({
  request,
  spBalance,
  onClose,
  onSpendSp,
  onActivateGamePass,
}: WebtoonPurchaseSheetProps) {
  if (!request) return null;

  const speakerLabel = SPEAKER_LABELS[request.speaker] ?? request.speaker;
  const canAffordCredits = request.reveal.kind === 'credits' ? spBalance >= request.reveal.cost : false;
  const headline = request.reveal.kind === 'credits' ? 'Unlock translation help' : 'Unlock Game Pass help';
  const balanceLabel = `${spBalance} SP available`;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 8, 16, 0.7)',
          backdropFilter: 'blur(12px)',
          zIndex: 90,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headline}
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          zIndex: 91,
          width: 'min(calc(100vw - 24px), 30rem)',
          padding: '18px 18px 16px',
          borderRadius: 20,
          border: '1px solid rgba(244,210,172,0.28)',
          background: 'linear-gradient(180deg, rgba(16,19,30,0.96), rgba(9,11,19,0.98))',
          color: '#fff8ee',
          boxShadow: '0 24px 60px rgba(0,0,0,0.38)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f4d2ac', opacity: 0.88 }}>
              {headline}
            </div>
            <div style={{ marginTop: 6, fontSize: '1rem', fontWeight: 700 }}>
              {speakerLabel}: {request.zh}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,248,238,0.72)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: 0,
            }}
          >
            Close
          </button>
        </div>

        <p style={{ margin: '10px 0 0', fontSize: '0.9rem', lineHeight: 1.45, color: 'rgba(255,248,238,0.8)' }}>
          {request.reveal.kind === 'credits'
            ? `Spend ${request.reveal.cost} SP to permanently reveal this bubble's English help on this device, or activate Game Pass to unlock every premium help bubble in the scene.`
            : 'Activate Game Pass locally on this device to unlock every premium help bubble in this scene. You can swap this handler to Stripe later.'}
        </p>

        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 14,
            background: 'rgba(244,210,172,0.08)',
            border: '1px solid rgba(244,210,172,0.16)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: '0.88rem',
          }}
        >
          <span style={{ color: 'rgba(255,248,238,0.72)' }}>Wallet</span>
          <strong style={{ color: '#f4d2ac' }}>{balanceLabel}</strong>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {request.reveal.kind === 'credits' ? (
            <button
              type="button"
              disabled={!canAffordCredits}
              onClick={onSpendSp}
              style={{
                border: 'none',
                borderRadius: 14,
                padding: '12px 14px',
                background: canAffordCredits ? '#f4d2ac' : 'rgba(244,210,172,0.18)',
                color: canAffordCredits ? '#0d0d1a' : 'rgba(255,248,238,0.56)',
                fontWeight: 700,
                cursor: canAffordCredits ? 'pointer' : 'not-allowed',
              }}
            >
              Spend {request.reveal.cost} SP
            </button>
          ) : null}

          <button
            type="button"
            onClick={onActivateGamePass}
            style={{
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff8ee',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Purchase Game Pass
          </button>

          <div style={{ fontSize: '0.78rem', lineHeight: 1.45, color: 'rgba(255,248,238,0.62)' }}>
            Game Pass purchase is local-only for now. When you wire Stripe later, replace the Game Pass button handler with checkout.
          </div>
        </div>
      </div>
    </>
  );
}

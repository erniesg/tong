'use client';

import { useCallback, useMemo, useState } from 'react';
import type { WebtoonEntitlement, WebtoonUnlockRequest } from '@/components/scene/WebtoonStrip';
import { dispatch, useGameState } from '@/lib/store/game-store';

interface SearchParamsLike {
  get(name: string): string | null;
}

export function useWebtoonUnlocks(sceneId: string, searchParams: SearchParamsLike) {
  const gameState = useGameState();
  const [previewSp, setPreviewSp] = useState(() => Number(searchParams.get('sp')) || 0);
  const [pendingUnlock, setPendingUnlock] = useState<WebtoonUnlockRequest | null>(null);
  const [autoOpenBubbleId, setAutoOpenBubbleId] = useState<string | null>(null);

  const bypass = searchParams.get('dev_pass') === '1';
  const gamePass = searchParams.get('game_pass') === '1' || gameState.gamePass?.active === true;
  const spBalance = gameState.sp + previewSp;

  const entitlement: WebtoonEntitlement = useMemo(
    () => ({
      bypass,
      gamePass,
      sp: spBalance,
      revealedBubbleIds: gameState.revealedBubbleHelp[sceneId] ?? {},
    }),
    [bypass, gamePass, gameState.revealedBubbleHelp, sceneId, spBalance],
  );

  const closePurchaseSheet = useCallback(() => {
    setPendingUnlock(null);
  }, []);

  const requestUnlock = useCallback((request: WebtoonUnlockRequest) => {
    setPendingUnlock(request);
  }, []);

  const revealBubble = useCallback((bubbleId: string) => {
    dispatch({ type: 'REVEAL_BUBBLE_HELP', sceneId, bubbleId });
    setAutoOpenBubbleId(bubbleId);
    setPendingUnlock(null);
  }, [sceneId]);

  const spendSp = useCallback(() => {
    if (!pendingUnlock || pendingUnlock.reveal.kind !== 'credits') return;
    if (spBalance < pendingUnlock.reveal.cost) return;

    let remainingCost = pendingUnlock.reveal.cost;
    if (previewSp > 0) {
      const previewSpend = Math.min(previewSp, remainingCost);
      remainingCost -= previewSpend;
      setPreviewSp((prev) => prev - previewSpend);
    }
    if (remainingCost > 0) {
      dispatch({ type: 'SPEND_SP', amount: remainingCost });
    }

    revealBubble(pendingUnlock.bubbleId);
  }, [pendingUnlock, previewSp, revealBubble, spBalance]);

  const activateGamePass = useCallback(() => {
    if (!pendingUnlock) return;
    dispatch({ type: 'SET_GAME_PASS', pass: { active: true, source: 'grant' } });
    setAutoOpenBubbleId(pendingUnlock.bubbleId);
    setPendingUnlock(null);
  }, [pendingUnlock]);

  return {
    entitlement,
    pendingUnlock,
    autoOpenBubbleId,
    spBalance,
    requestUnlock,
    closePurchaseSheet,
    spendSp,
    activateGamePass,
  };
}

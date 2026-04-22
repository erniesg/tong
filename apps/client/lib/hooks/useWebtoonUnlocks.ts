'use client';

import { useCallback, useMemo, useState } from 'react';
import type { WebtoonEntitlement, WebtoonUnlockRequest } from '@/components/scene/WebtoonStrip';
import { dispatch, useGameState } from '@/lib/store/game-store';
import { buildWebtoonBubbleUnlockKey, useCommerceState } from '@/lib/hooks/useCommerceState';

interface SearchParamsLike {
  get(name: string): string | null;
}

export function useWebtoonUnlocks(sceneId: string, searchParams: SearchParamsLike) {
  const gameState = useGameState();
  const [pendingUnlock, setPendingUnlock] = useState<WebtoonUnlockRequest | null>(null);
  const [autoOpenBubbleId, setAutoOpenBubbleId] = useState<string | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const bypass = searchParams.get('dev_pass') === '1';
  const commerce = useCommerceState({ sceneId });
  const gamePass = searchParams.get('game_pass') === '1' || commerce.gamePassActive || gameState.gamePass?.active === true;
  const spBalance = commerce.snapshot ? commerce.spBalance : gameState.sp;

  const entitlement: WebtoonEntitlement = useMemo(
    () => ({
      bypass,
      gamePass,
      sp: spBalance,
      revealedBubbleIds: {
        ...(commerce.revealedBubbleIds || {}),
        ...(gameState.revealedBubbleHelp[sceneId] ?? {}),
      },
    }),
    [bypass, commerce.revealedBubbleIds, gamePass, gameState.revealedBubbleHelp, sceneId, spBalance],
  );

  const closePurchaseSheet = useCallback(() => {
    setPendingUnlock(null);
    setPurchaseError(null);
  }, []);

  const requestUnlock = useCallback((request: WebtoonUnlockRequest) => {
    setPendingUnlock(request);
    setPurchaseError(null);
  }, []);

  const revealBubble = useCallback((bubbleId: string) => {
    dispatch({ type: 'REVEAL_BUBBLE_HELP', sceneId, bubbleId });
    setAutoOpenBubbleId(bubbleId);
    setPendingUnlock(null);
  }, [sceneId]);

  const spendSp = useCallback(async () => {
    if (!pendingUnlock || pendingUnlock.reveal.kind !== 'credits') return;
    if (spBalance < pendingUnlock.reveal.cost) return;

    setPurchaseBusy(true);
    setPurchaseError(null);
    try {
      await commerce.spendSp({
        amountSp: pendingUnlock.reveal.cost,
        reason: 'webtoon_unlock',
        idempotencyKey: `webtoon_unlock:${buildWebtoonBubbleUnlockKey(sceneId, pendingUnlock.bubbleId)}:demo-user-1:${pendingUnlock.reveal.cost}`,
        unlockKey: buildWebtoonBubbleUnlockKey(sceneId, pendingUnlock.bubbleId),
        unlockIdempotencyKey: `${buildWebtoonBubbleUnlockKey(sceneId, pendingUnlock.bubbleId)}:demo-user-1`,
        metadata: {
          sceneId,
          bubbleId: pendingUnlock.bubbleId,
        },
      });
      revealBubble(pendingUnlock.bubbleId);
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Unlock failed.');
    } finally {
      setPurchaseBusy(false);
    }
  }, [commerce, pendingUnlock, revealBubble, sceneId, spBalance]);

  const activateGamePass = useCallback(async () => {
    if (!pendingUnlock) return;
    setPurchaseBusy(true);
    setPurchaseError(null);
    try {
      await commerce.activateGamePass({
        sceneId,
        bubbleId: pendingUnlock.bubbleId,
      });
      revealBubble(pendingUnlock.bubbleId);
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Game Pass activation failed.');
    } finally {
      setPurchaseBusy(false);
    }
  }, [commerce, pendingUnlock, revealBubble, sceneId]);

  return {
    entitlement,
    pendingUnlock,
    autoOpenBubbleId,
    spBalance,
    purchaseBusy,
    purchaseError,
    requestUnlock,
    closePurchaseSheet,
    spendSp,
    activateGamePass,
  };
}

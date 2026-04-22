'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CommerceEntitlementsResponse,
  CommerceSpendRequest,
  CommerceSpendResponse,
} from '../../../../packages/contracts';
import {
  fetchCommerceEntitlements,
  grantCommerceUnlock,
  recordCommercePurchaseEvent,
  spendCommerceSp,
} from '@/lib/api';
import { dispatch } from '@/lib/store/game-store';

const DEFAULT_USER_ID = 'demo-user-1';

function normalizeSceneToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'scene';
}

export function buildSceneGamePassUnlockKey(sceneId: string) {
  return `unlock.game_pass.${normalizeSceneToken(sceneId)}`;
}

export function buildWebtoonBubbleUnlockKey(sceneId: string, bubbleId: string) {
  return `unlock.webtoon.${normalizeSceneToken(sceneId)}.${normalizeSceneToken(bubbleId)}`;
}

function hasActiveGamePass(entitlements: CommerceEntitlementsResponse['entitlements'], sceneId: string) {
  const sceneKey = buildSceneGamePassUnlockKey(sceneId);
  return entitlements.some((entitlement) => (
    entitlement.status === 'active'
    && (entitlement.productKey === sceneKey || entitlement.productKey === 'unlock.game_pass.all')
  ));
}

function getRevealedBubbleIds(entitlements: CommerceEntitlementsResponse['entitlements'], sceneId: string) {
  const revealed: Record<string, true> = {};
  const sceneToken = normalizeSceneToken(sceneId);

  for (const entitlement of entitlements) {
    if (entitlement.status !== 'active') continue;

    const metadataSceneId = typeof entitlement.metadata?.sceneId === 'string'
      ? entitlement.metadata.sceneId
      : null;
    const metadataBubbleId = typeof entitlement.metadata?.bubbleId === 'string'
      ? entitlement.metadata.bubbleId
      : null;

    if (metadataSceneId === sceneId && metadataBubbleId) {
      revealed[metadataBubbleId] = true;
      continue;
    }

    const prefix = `unlock.webtoon.${sceneToken}.`;
    if (entitlement.productKey.startsWith(prefix)) {
      const bubbleToken = entitlement.productKey.slice(prefix.length).trim();
      if (bubbleToken) {
        revealed[bubbleToken] = true;
      }
    }
  }

  return revealed;
}

interface UseCommerceStateOptions {
  sceneId: string;
  enabled?: boolean;
  userId?: string;
}

export function useCommerceState({ sceneId, enabled = true, userId = DEFAULT_USER_ID }: UseCommerceStateOptions) {
  const [snapshot, setSnapshot] = useState<CommerceEntitlementsResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const syncGameStore = useCallback((nextSnapshot: CommerceEntitlementsResponse) => {
    dispatch({ type: 'SET_SP', amount: nextSnapshot.balances.sp });
    dispatch({
      type: 'SET_GAME_PASS',
      pass: hasActiveGamePass(nextSnapshot.entitlements, sceneId)
        ? { active: true, source: 'grant' }
        : null,
    });
  }, [sceneId]);

  const refresh = useCallback(async () => {
    if (!enabled) return null;

    setLoading(true);
    setError(null);
    try {
      const nextSnapshot = await fetchCommerceEntitlements(userId);
      setSnapshot(nextSnapshot);
      syncGameStore(nextSnapshot);
      return nextSnapshot;
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Failed to load commerce state.';
      setError(message);
      throw refreshError;
    } finally {
      setLoading(false);
    }
  }, [enabled, syncGameStore, userId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh().catch(() => {});
  }, [enabled, refresh]);

  const spBalance = snapshot?.balances.sp ?? 0;
  const gamePassActive = useMemo(
    () => (snapshot ? hasActiveGamePass(snapshot.entitlements, sceneId) : false),
    [sceneId, snapshot],
  );
  const revealedBubbleIds = useMemo(
    () => (snapshot ? getRevealedBubbleIds(snapshot.entitlements, sceneId) : {}),
    [sceneId, snapshot],
  );

  const spendSp = useCallback(async (body: Omit<CommerceSpendRequest, 'userId'>) => {
    const response = await spendCommerceSp({
      ...body,
      userId,
    });

    if (response.accepted) {
      await refresh();
      return response;
    }

    const reason = response.reasonCode === 'insufficient_sp'
      ? 'Not enough SP.'
      : 'Unable to spend SP.';
    setError(reason);
    throw new Error(reason);
  }, [refresh, userId]);

  const activateGamePass = useCallback(async (metadata: Record<string, unknown> = {}) => {
    const providerEventId = `evt_demo_game_pass_${normalizeSceneToken(sceneId)}_${Date.now()}`;
    const purchaseEvent = await recordCommercePurchaseEvent({
      provider: 'stripe',
      providerEventId,
      eventType: 'checkout.session.completed',
      userId,
      occurredAtIso: new Date().toISOString(),
      amount: {
        currency: 'usd',
        subtotal: 0,
        total: 0,
      },
      metadata: {
        sceneId,
        demoMode: true,
        ...metadata,
      },
      payloadHash: `sha256:${providerEventId}`,
    });

    const unlockGrant = await grantCommerceUnlock({
      userId,
      unlockKey: buildSceneGamePassUnlockKey(sceneId),
      grantSource: 'purchase_event',
      idempotencyKey: `${buildSceneGamePassUnlockKey(sceneId)}:${userId}`,
      purchaseEventId: purchaseEvent.recordId,
      metadata: {
        sceneId,
        demoMode: true,
        ...metadata,
      },
    });

    await refresh();
    return { purchaseEvent, unlockGrant };
  }, [refresh, sceneId, userId]);

  return {
    error,
    gamePassActive,
    loading,
    refresh,
    revealedBubbleIds,
    snapshot,
    spBalance,
    spendSp,
    activateGamePass,
  };
}

export type UseCommerceStateResult = ReturnType<typeof useCommerceState>;
export type CommerceSpendResult = CommerceSpendResponse;

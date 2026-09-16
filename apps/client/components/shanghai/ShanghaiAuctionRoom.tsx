'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LiveAuctionSnapshot } from '@/lib/live-auction/contracts';
import { dispatch, useGameState } from '@/lib/store/game-store';
import styles from './ShanghaiOnboardingFlow.module.css';

const PARTICIPANT_KEY = 'tong:live-auction:participant';
const PAYMENT_HOLD_KEY = 'tong:live-auction:payment-pending';
const CHECKOUT_SESSION_KEY = 'tong:live-auction:checkout-session';
const SETTLEMENT_PREFIX = 'tong:live-auction:settlement:';
const RETURN_FALLBACK = '/game?phase=city_map&city=shanghai';
const TONG_POSTER_URL = '/assets/characters/tong/tong_cheerful.png';
const TOAST_LIFETIME_MS = 3_200;

function formatCountdown(snapshot: LiveAuctionSnapshot | null, nowMs: number) {
  if (!snapshot) return '--:--';
  const remaining = snapshot.status === 'paused' && typeof snapshot.timeRemainingMs === 'number'
    ? Math.max(0, snapshot.timeRemainingMs)
    : Math.max(0, new Date(snapshot.nextTransitionAtIso).getTime() - nowMs);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatFeedTime(atIso: string) {
  return new Date(atIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function buildUrlWithoutTransientParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete('restart');
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  return `${url.pathname}${url.search}${url.hash}`;
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

export function ShanghaiAuctionRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameState = useGameState();
  const onboardingComplete = gameState.onboardingStatus['shanghai:h1'] === 'completed';
  const displayName = gameState.playerProfile.englishName || gameState.playerName || 'You';
  const isAdmin = searchParams.get('admin') === '1';
  const restartRequested = searchParams.get('restart') === '1';
  const checkoutRequested = searchParams.get('checkout') === 'success';
  const checkoutCancelled = searchParams.get('checkout') === 'cancelled';
  const checkoutSessionIdFromUrl = searchParams.get('session_id');
  const checkoutSessionId = checkoutSessionIdFromUrl?.includes('CHECKOUT_SESSION_ID') ? null : checkoutSessionIdFromUrl;
  const returnHref = searchParams.get('return') || RETURN_FALLBACK;
  const eventId = searchParams.get('eventId');
  const [initialAvailableSp] = useState(() => Math.max(gameState.sp, 120));
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LiveAuctionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminAmount, setAdminAmount] = useState('120');
  const [bidAmount, setBidAmount] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(restartRequested);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [storedCheckoutSessionId, setStoredCheckoutSessionId] = useState<string | null>(null);
  const [showWinConfetti, setShowWinConfetti] = useState(false);
  const commentStreamRef = useRef<HTMLDivElement | null>(null);
  const syncedWalletRef = useRef<number | null>(null);
  const winCelebrationRef = useRef<string | null>(null);

  const confettiPieces = useMemo(() => {
    const palette = ['#ffd76a', '#ff9f6e', '#7cf0d2', '#8fb3ff', '#ff8dc7'];
    return Array.from({ length: 18 }, (_, index) => ({
      id: `confetti-${index}`,
      left: `${6 + (index % 9) * 10}%`,
      delay: `${(index % 6) * 0.08}s`,
      duration: `${1.6 + (index % 5) * 0.16}s`,
      color: palette[index % palette.length],
      rotate: `${-24 + (index % 7) * 10}deg`,
    }));
  }, []);

  const auctionBaseHref = useMemo(() => {
    const params = new URLSearchParams({ return: returnHref });
    if (isAdmin) params.set('admin', '1');
    if (eventId) params.set('eventId', eventId);
    return `/auction/shanghai-live?${params.toString()}`;
  }, [eventId, isAdmin, returnHref]);
  const auctionRestartHref = `${auctionBaseHref}&restart=1`;
  const effectiveCheckoutSessionId = checkoutSessionId || storedCheckoutSessionId;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setStoredCheckoutSessionId(window.sessionStorage.getItem(CHECKOUT_SESSION_KEY));
  }, []);

  const joinRoom = useCallback(async (clearSeat = false) => {
    const storedId = typeof window === 'undefined' ? null : window.localStorage.getItem(PARTICIPANT_KEY);
    if (clearSeat && typeof window !== 'undefined') {
      window.localStorage.removeItem(PARTICIPANT_KEY);
    }

    const payload = await postJson<{ participantId: string; snapshot: LiveAuctionSnapshot }>('/api/live-auction/join', {
      participantId: clearSeat ? undefined : storedId || undefined,
      displayName,
      availableSp: initialAvailableSp,
      isAdmin,
    });

    setParticipantId(payload.participantId);
    setSnapshot(payload.snapshot);
    setError(null);
    syncedWalletRef.current = null;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PARTICIPANT_KEY, payload.participantId);
    }

    return payload;
  }, [displayName, initialAvailableSp, isAdmin]);

  const clearCheckoutRecovery = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(PAYMENT_HOLD_KEY);
      window.sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
    }
    setStoredCheckoutSessionId(null);
  }, []);

  const syncStoredCheckoutCredit = useCallback(async (sessionId: string | null, allowPending = false) => {
    if (!participantId) return null;

    let payload:
      | {
        alreadyApplied: boolean;
        spAmount: number;
        snapshot: LiveAuctionSnapshot;
      }
      | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        payload = await postJson<{
          alreadyApplied: boolean;
          spAmount: number;
          snapshot: LiveAuctionSnapshot;
        }>('/api/billing/credit', {
          participantId,
          sessionId: sessionId || undefined,
        });
        break;
      } catch (creditError) {
        const message = creditError instanceof Error ? creditError.message : 'Stripe credit sync failed.';
        if (!message.includes('not paid yet')) {
          throw creditError;
        }
        if (allowPending) {
          return null;
        }
        if (attempt === 4) {
          throw creditError;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
    }

    if (!payload && !allowPending) {
      throw new Error('Stripe credit sync failed.');
    }

    return payload;
  }, [participantId]);

  useEffect(() => {
    if (!restartRequested) {
      setIsRestarting(false);
      return;
    }

    let cancelled = false;

    async function resetRoom() {
      try {
        setIsRestarting(true);
        setError(null);
        setBillingNotice('Tong started a fresh room. Countdown is live.');
        await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/reset', {});
        if (cancelled) return;
        await joinRoom(true);
        window.history.replaceState({}, '', buildUrlWithoutTransientParams());
      } catch (restartError) {
        if (cancelled) return;
        setError(restartError instanceof Error ? restartError.message : 'Fresh room reset failed.');
      } finally {
        if (!cancelled) {
          setIsRestarting(false);
        }
      }
    }

    void resetRoom();
    return () => {
      cancelled = true;
    };
  }, [joinRoom, restartRequested]);

  useEffect(() => {
    if (restartRequested || isRestarting || participantId) return;

    let cancelled = false;

    async function ensureSeat() {
      try {
        await joinRoom(false);
      } catch (joinError) {
        if (cancelled) return;
        setError(joinError instanceof Error ? joinError.message : 'Failed to join the live drop.');
      }
    }

    void ensureSeat();
    return () => {
      cancelled = true;
    };
  }, [isRestarting, joinRoom, participantId, restartRequested]);

  useEffect(() => {
    if (!participantId) return;

    const eventSource = new EventSource('/api/live-auction/stream');
    eventSource.onmessage = (event) => {
      const nextSnapshot = JSON.parse(event.data) as LiveAuctionSnapshot;
      setSnapshot(nextSnapshot);
    };
    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [participantId]);

  useEffect(() => {
    if (!participantId) return;
    if (!checkoutRequested && !storedCheckoutSessionId) return;

    let cancelled = false;
    const sessionId = effectiveCheckoutSessionId ?? null;

    async function syncStripeCredit() {
      try {
        const payload = await syncStoredCheckoutCredit(
          sessionId,
          !checkoutRequested,
        );

        if (!payload) {
          return;
        }

        if (cancelled) return;
        setSnapshot(payload.snapshot);
        const creditedPlayer = payload.snapshot.participants.find((participant) => participant.participantId === participantId);
        setBillingNotice(
          payload.alreadyApplied
            ? `Stripe top-up already synced. Wallet now ${creditedPlayer?.availableSp ?? '--'} SP.`
            : `Stripe top-up complete: +${payload.spAmount} SP. Wallet now ${creditedPlayer?.availableSp ?? '--'} SP. Spend it now.`,
        );

        if (cancelled) return;
        const resumed = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/payment-hold', {
          participantId,
          action: 'resume',
        });
        if (cancelled) return;
        setSnapshot(resumed.snapshot);
        const resumedPlayer = resumed.snapshot.participants.find((participant) => participant.participantId === participantId);
        setBillingNotice(
          payload.alreadyApplied
            ? `Stripe top-up already synced. Wallet now ${resumedPlayer?.availableSp ?? '--'} SP. Countdown resumed.`
            : `Stripe top-up complete: +${payload.spAmount} SP. Wallet now ${resumedPlayer?.availableSp ?? '--'} SP. Countdown resumed. Spend it now.`,
        );
        clearCheckoutRecovery();
        window.history.replaceState({}, '', buildUrlWithoutTransientParams());
      } catch (creditError) {
        if (cancelled) return;
        setError(creditError instanceof Error ? creditError.message : 'Stripe credit sync failed.');
      }
    }

    void syncStripeCredit();
    return () => {
      cancelled = true;
    };
  }, [
    checkoutRequested,
    clearCheckoutRecovery,
    effectiveCheckoutSessionId,
    participantId,
    storedCheckoutSessionId,
    syncStoredCheckoutCredit,
  ]);

  useEffect(() => {
    if (!checkoutCancelled || !participantId) return;

    let cancelled = false;

    async function resumeAfterCancel() {
      try {
        const payload = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/payment-hold', {
          participantId,
          action: 'resume',
        });
        if (cancelled) return;
        setSnapshot(payload.snapshot);
        clearCheckoutRecovery();
        setBillingNotice('Stripe checkout was cancelled. The room clock is running again.');
        window.history.replaceState({}, '', buildUrlWithoutTransientParams());
      } catch (resumeError) {
        if (cancelled) return;
        setError(resumeError instanceof Error ? resumeError.message : 'Countdown could not resume.');
      }
    }

    void resumeAfterCancel();
    return () => {
      cancelled = true;
    };
  }, [checkoutCancelled, clearCheckoutRecovery, participantId]);

  const player = useMemo(
    () => snapshot?.participants.find((participant) => participant.participantId === participantId) ?? null,
    [participantId, snapshot],
  );
  const leader = useMemo(
    () => snapshot?.participants.find((participant) => participant.isLeading) ?? null,
    [snapshot],
  );
  const playerWon = Boolean(
    snapshot
    && participantId
    && snapshot.status === 'closed'
    && snapshot.winner?.participantId === participantId
    && snapshot.winner.kind === 'player'
    && snapshot.closingReason !== 'admin_override',
  );
  const nextBidAmount = snapshot ? snapshot.currentBid + snapshot.minIncrement : null;
  const maxBidAmount = player?.availableSp ?? initialAvailableSp;
  const sliderMax = nextBidAmount ? Math.max(nextBidAmount, maxBidAmount) : Math.max(0, maxBidAmount);
  const canBid = Boolean(
    snapshot
    && snapshot.status === 'open'
    && player
    && nextBidAmount
    && maxBidAmount >= nextBidAmount,
  );
  const bidDisplayAmount = bidAmount || nextBidAmount || 0;
  const onboardingHref = `/onboarding/shanghai?return=${encodeURIComponent(returnHref)}`;
  const onboardingCtaLabel = onboardingComplete ? 'Replay Shanghai onboarding' : 'Unlock onboarding';

  useEffect(() => {
    if (!player) return;
    if (syncedWalletRef.current === null) {
      syncedWalletRef.current = player.availableSp;
      return;
    }

    const delta = player.availableSp - syncedWalletRef.current;
    if (delta !== 0) {
      dispatch({ type: 'ADD_SP', amount: delta });
      syncedWalletRef.current = player.availableSp;
      return;
    }

    syncedWalletRef.current = player.availableSp;
  }, [player]);

  useEffect(() => {
    if (!billingNotice) return;
    setToastMessage(billingNotice);
    const timer = window.setTimeout(() => setToastMessage(null), TOAST_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [billingNotice]);

  useEffect(() => {
    if (!playerWon || !snapshot?.closesAtIso) return;
    if (winCelebrationRef.current === snapshot.closesAtIso) return;

    winCelebrationRef.current = snapshot.closesAtIso;
    setShowWinConfetti(true);
    setBillingNotice(`You won the bid at ${snapshot.currentBid} SP. Shanghai unlock is ready.`);

    const timer = window.setTimeout(() => setShowWinConfetti(false), 2_800);
    return () => window.clearTimeout(timer);
  }, [playerWon, snapshot?.closesAtIso, snapshot?.currentBid]);

  useEffect(() => {
    if (!snapshot || !nextBidAmount) return;
    setBidAmount((current) => {
      const baseline = current > 0 ? current : nextBidAmount;
      return Math.min(Math.max(baseline, nextBidAmount), sliderMax);
    });
  }, [nextBidAmount, sliderMax, snapshot]);

  const handleBid = useCallback(async (amount: number) => {
    if (!snapshot || !participantId) return;
    try {
      setError(null);
      const payload = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/bid', {
        participantId,
        amount,
      });
      setSnapshot(payload.snapshot);
      const nextPlayer = payload.snapshot.participants.find((participant) => participant.participantId === participantId);
      setBillingNotice(
        nextPlayer
          ? `Bid locked at ${amount} SP. Wallet now ${nextPlayer.availableSp} SP.`
          : `Bid locked at ${amount} SP.`,
      );
    } catch (bidError) {
      setError(bidError instanceof Error ? bidError.message : 'Bid failed.');
    }
  }, [participantId, snapshot]);

  const handleTopUp = useCallback(async (amount: number) => {
    if (!participantId) return;
    try {
      setError(null);
      const payload = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/top-up', {
        participantId,
        amount,
      });
      setSnapshot(payload.snapshot);
      const nextPlayer = payload.snapshot.participants.find((participant) => participant.participantId === participantId);
      setBillingNotice(
        `${amount} demo SP landed. Wallet now ${nextPlayer?.availableSp ?? '--'} SP.`,
      );
    } catch (topUpError) {
      setError(topUpError instanceof Error ? topUpError.message : 'Top-up failed.');
    }
  }, [participantId]);

  const handleStripeCheckout = useCallback(async () => {
    if (!participantId) return;

    let holdStarted = false;

    try {
      setIsStartingCheckout(true);
      setError(null);

      const holdPayload = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/payment-hold', {
        participantId,
        action: 'start',
      });
      holdStarted = true;
      setSnapshot(holdPayload.snapshot);
      setBillingNotice('Tong froze the room clock while Stripe opens.');

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: participantId,
          returnTo: auctionBaseHref,
        }),
      });

      const payload = await response.json() as { checkoutUrl?: string; sessionId?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || 'Stripe checkout could not be started.');
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(PAYMENT_HOLD_KEY, participantId);
        if (payload.sessionId) {
          window.sessionStorage.setItem(CHECKOUT_SESSION_KEY, payload.sessionId);
          setStoredCheckoutSessionId(payload.sessionId);
        }
      }

      window.location.assign(payload.checkoutUrl);
    } catch (checkoutError) {
      if (holdStarted) {
        try {
          const resumed = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/payment-hold', {
            participantId,
            action: 'resume',
          });
          setSnapshot(resumed.snapshot);
          clearCheckoutRecovery();
        } catch {
          // Leave the original checkout error visible.
        }
      }

      setError(checkoutError instanceof Error ? checkoutError.message : 'Stripe checkout could not be started.');
    } finally {
      setIsStartingCheckout(false);
    }
  }, [auctionBaseHref, clearCheckoutRecovery, participantId]);

  const handleAdminClose = useCallback(async () => {
    if (!participantId) return;
    try {
      setError(null);
      const payload = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/admin-close', {
        participantId,
        amount: Number(adminAmount) || snapshot?.currentBid || 0,
      });
      setSnapshot(payload.snapshot);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'Admin close failed.');
    }
  }, [adminAmount, participantId, snapshot?.currentBid]);

  const handleResumeAuction = useCallback(async () => {
    if (!participantId) return;

    try {
      setError(null);
      if (effectiveCheckoutSessionId || checkoutRequested) {
        const creditPayload = await syncStoredCheckoutCredit(effectiveCheckoutSessionId ?? null, true);
        if (creditPayload) {
          setSnapshot(creditPayload.snapshot);
          const creditedPlayer = creditPayload.snapshot.participants.find((participant) => participant.participantId === participantId);
          setBillingNotice(
            creditPayload.alreadyApplied
              ? `Stripe top-up already synced. Wallet now ${creditedPlayer?.availableSp ?? '--'} SP.`
              : `Stripe top-up complete: +${creditPayload.spAmount} SP. Wallet now ${creditedPlayer?.availableSp ?? '--'} SP.`,
          );
        }
      }
      const payload = await postJson<{ snapshot: LiveAuctionSnapshot }>('/api/live-auction/payment-hold', {
        participantId,
        action: 'resume',
      });
      setSnapshot(payload.snapshot);
      clearCheckoutRecovery();
      setBillingNotice('Auction resumed. Keep bidding.');
      window.history.replaceState({}, '', buildUrlWithoutTransientParams());
    } catch (resumeError) {
      setError(resumeError instanceof Error ? resumeError.message : 'Auction could not resume.');
    }
  }, [checkoutRequested, clearCheckoutRecovery, effectiveCheckoutSessionId, participantId, syncStoredCheckoutCredit]);

  useEffect(() => {
    if (!participantId || !snapshot) return;
    if (snapshot.status !== 'paused' || snapshot.pausedByParticipantId !== participantId) return;
    if (checkoutCancelled || checkoutRequested || isStartingCheckout) return;
    if (!storedCheckoutSessionId) return;

    const timer = window.setTimeout(() => {
      void handleResumeAuction();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    checkoutCancelled,
    checkoutRequested,
    handleResumeAuction,
    isStartingCheckout,
    participantId,
    snapshot,
    storedCheckoutSessionId,
  ]);

  const isLoading = (!snapshot && !error) || isRestarting;
  const statusLabel = isLoading
    ? 'syncing...'
    : snapshot?.status === 'scheduled'
      ? `starts in ${formatCountdown(snapshot, nowMs)}`
      : snapshot?.status === 'paused'
        ? 'payment hold'
      : snapshot?.status === 'open'
        ? `${formatCountdown(snapshot, nowMs)} left`
        : 'settled';
  const countdownLabel = isLoading
    ? 'Loading'
    : snapshot?.status === 'scheduled'
      ? 'Starts in'
      : snapshot?.status === 'paused'
        ? 'Paused at'
      : snapshot?.status === 'open'
        ? 'Time left'
        : 'Settled';

  const tongLine = useMemo(() => {
    if (isLoading) return 'Tong is opening the live drop.';
    if (playerWon) return 'You won the invite. Tap unlock onboarding and head straight into Shanghai.';
    if (!snapshot) return 'Connecting the live room now.';
    if (snapshot.status === 'scheduled') return `Countdown started. Bidding opens in ${formatCountdown(snapshot, nowMs)}.`;
    if (snapshot.status === 'paused') return 'Stripe is open. The room clock is frozen until you come back.';
    if (snapshot.status === 'open' && leader?.participantId === participantId) {
      return `You are leading at ${snapshot.currentBid} SP. Hold your line until the clock hits zero.`;
    }
    if (snapshot.status === 'open' && !canBid) {
      return `You need ${nextBidAmount ? `${nextBidAmount} SP` : 'more SP'} to beat ${leader?.displayName || 'the room'}.`;
    }
    if (snapshot.status === 'open') {
      return `${leader?.displayName || 'A rival'} leads at ${snapshot.currentBid} SP. Slide your bid, then tap place bid.`;
    }
    return 'This room settled. Start a fresh bid when you want another demo round.';
  }, [canBid, isLoading, leader?.displayName, leader?.participantId, nextBidAmount, nowMs, participantId, playerWon, snapshot]);

  const liveComments = useMemo(() => {
    const items = (snapshot?.eventLog.slice(0, 5).reverse() ?? []).map((entry) => ({
      id: entry.entryId,
      speaker: entry.kind === 'top_up' ? 'Wallet' : entry.kind === 'house' ? 'Tong' : 'Live room',
      text: entry.text,
      meta: formatFeedTime(entry.atIso),
    }));

    items.push({
      id: 'tong-line',
      speaker: 'Tong',
      text: tongLine,
      meta: 'live guidance',
    });

    if (billingNotice) {
      items.push({
        id: 'billing-line',
        speaker: 'Wallet',
        text: billingNotice,
        meta: 'payment update',
      });
    }

    return items.slice(-6);
  }, [billingNotice, snapshot, tongLine]);

  useEffect(() => {
    const stream = commentStreamRef.current;
    if (!stream) return;
    stream.scrollTop = stream.scrollHeight;
  }, [liveComments]);

  return (
    <main className={`${styles.shell} ${styles.auctionRoot} ${styles.auctionCompactRoot}`}>
      <section className={styles.auctionCompactStage}>
        {snapshot ? <img className={styles.auctionCompactImage} src={snapshot.currentLot.imageUrl} alt="" /> : null}
        <div className={styles.auctionCompactWash} />
        {toastMessage ? (
          <div className={styles.auctionToast} role="status" aria-live="polite">
            <span className={styles.auctionToastEyebrow}>Wallet update</span>
            <strong>{toastMessage}</strong>
          </div>
        ) : null}
        {showWinConfetti ? (
          <div className={styles.auctionConfetti} aria-hidden="true">
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className={styles.auctionConfettiPiece}
                style={{
                  left: piece.left,
                  animationDelay: piece.delay,
                  animationDuration: piece.duration,
                  background: piece.color,
                  transform: `rotate(${piece.rotate})`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div className={styles.auctionCompactContent}>
          <header className={styles.auctionCompactHeader}>
            <div>
              <p className={styles.eyebrow}>Shanghai live auction</p>
              <h1 className={styles.auctionCompactTitle}>{snapshot?.currentLot.title || 'Opening the live invite.'}</h1>
              <p className={styles.auctionCompactSubtitle}>
                {snapshot?.currentLot.subtitle || 'Private Shanghai hangout unlock'} • 30 second bid
              </p>
            </div>
            <span
              className={`${styles.statusPill} ${snapshot?.status === 'open' ? styles.statusOpen : snapshot?.status === 'paused' ? styles.statusPaused : snapshot?.status === 'closed' ? styles.statusClosed : ''}`}
            >
              {statusLabel}
            </span>
          </header>

          <section className={styles.auctionCompactStats}>
            <div className={styles.auctionCompactStat}>
              <span className={styles.auctionStatLabel}>{countdownLabel}</span>
              <strong className={styles.auctionStatValue}>{snapshot ? formatCountdown(snapshot, nowMs) : '--:--'}</strong>
            </div>
            <div className={styles.auctionCompactStat}>
              <span className={styles.auctionStatLabel}>Highest bid</span>
              <strong className={styles.auctionStatValue}>{snapshot ? `${snapshot.currentBid} SP` : '--'}</strong>
            </div>
            <div className={styles.auctionCompactStat}>
              <span className={styles.auctionStatLabel}>Leader</span>
              <strong className={styles.auctionStatValue}>{leader?.displayName || (isLoading ? 'Syncing' : 'Waiting')}</strong>
            </div>
            <div className={styles.auctionCompactStat}>
              <span className={styles.auctionStatLabel}>Your wallet</span>
              <strong className={styles.auctionStatValue}>{player ? `${player.availableSp} SP` : `${initialAvailableSp} SP`}</strong>
            </div>
          </section>

          <section className={styles.auctionTongConsole}>
            <div className={styles.tongCircle}>
              <img className={styles.tongCircleImage} src={TONG_POSTER_URL} alt="Tong" />
            </div>
            <div className={styles.auctionLiveConsole}>
                <div className={styles.auctionLiveHeader}>
                  <div className={styles.auctionLiveHeaderTitle}>
                    <span className={styles.auctionLiveDot} />
                    <strong>Activity log</strong>
                  </div>
                  <p className={styles.auctionLiveHeaderCopy}>Live bids, wallet moves, and Stripe updates.</p>
                </div>
              <div ref={commentStreamRef} className={styles.auctionLiveStream}>
                {liveComments.map((item) => (
                  <div key={item.id} className={styles.auctionLiveItem}>
                    <div className={styles.auctionLiveMeta}>
                      <span className={styles.auctionLiveSpeaker}>{item.speaker}</span>
                      <span className={styles.subtle}>{item.meta}</span>
                    </div>
                    <p className={styles.auctionLiveText}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {snapshot?.status !== 'closed' ? (
            <>
              <section className={styles.auctionBidRail}>
                <div className={styles.auctionBidHeader}>
                  <div>
                    <span className={styles.auctionStatLabel}>Slide your bid</span>
                    <strong className={styles.bidComposerValue}>{bidDisplayAmount} SP</strong>
                  </div>
                  <span className={styles.subtle}>{nextBidAmount ? `Minimum ${nextBidAmount} SP` : '--'}</span>
                </div>
                <input
                  className={styles.bidSlider}
                  type="range"
                  min={nextBidAmount ?? 0}
                  max={sliderMax}
                  step={snapshot?.minIncrement ?? 5}
                  value={bidDisplayAmount}
                  disabled={!canBid}
                  onChange={(event) => setBidAmount(Number(event.target.value))}
                  aria-label="Bid SP amount"
                />
                <div className={styles.bidScale}>
                  <span>{nextBidAmount ? `${nextBidAmount} SP` : '--'}</span>
                  <span>{`${sliderMax} SP`}</span>
                </div>
                <div className={styles.auctionBidActions}>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${styles.bidCommitButton}`}
                    disabled={snapshot?.status === 'paused' ? false : !canBid || !bidAmount}
                    onClick={snapshot?.status === 'paused' ? handleResumeAuction : () => handleBid(bidAmount)}
                  >
                    {snapshot?.status === 'paused'
                      ? 'Apply top-up + resume'
                      : snapshot?.status === 'open'
                        ? `Place bid for ${bidDisplayAmount} SP`
                        : 'Countdown is starting'}
                  </button>
                  <button
                    type="button"
                    className={`${styles.secondaryButton} ${styles.bidBuyButton}`}
                    onClick={handleStripeCheckout}
                    disabled={isStartingCheckout}
                  >
                    {isStartingCheckout ? 'Opening Stripe…' : 'Buy +300 SP'}
                  </button>
                </div>
              </section>

              <section className={styles.auctionPurchaseRail}>
                <div>
                  <span className={styles.auctionStatLabel}>Need more SP?</span>
                  <strong className={styles.auctionPurchaseTitle}>
                    Demo top up instantly or pause the timer and open Stripe.
                  </strong>
                </div>
                <div className={styles.walletActions}>
                  {[25, 50].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleTopUp(amount)}
                    >
                      +{amount} demo SP
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleStripeCheckout}
                    disabled={isStartingCheckout}
                  >
                    {isStartingCheckout ? 'Opening Stripe…' : 'Pause timer + buy SP'}
                  </button>
                  {snapshot?.status === 'paused' ? (
                    <button type="button" className={styles.secondaryButton} onClick={handleResumeAuction}>
                      Resume auction
                    </button>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <div className={styles.auctionSettledRow}>
              {playerWon ? (
                <button type="button" className={styles.primaryButton} onClick={() => router.push(onboardingHref)}>
                  {onboardingCtaLabel}
                </button>
              ) : null}
              <button type="button" className={styles.secondaryButton} onClick={() => router.replace(auctionRestartHref)}>
                Start a new bid
              </button>
            </div>
          )}

          {isAdmin ? (
            <div className={styles.adminPanelInline}>
              <div>
                <p className={styles.stageTitle}>Admin override</p>
                <p className={styles.subtle}>Only visible with `?admin=1`.</p>
              </div>
              <div className={styles.adminRow}>
                <input
                  className={styles.amountInput}
                  inputMode="numeric"
                  value={adminAmount}
                  onChange={(event) => setAdminAmount(event.target.value)}
                  aria-label="Admin hammer price"
                />
                <button type="button" className={styles.secondaryButton} onClick={handleAdminClose}>
                  Close room
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className={styles.auctionError}>{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

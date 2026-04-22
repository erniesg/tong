'use client';

import type {
  LiveAuctionMediaKind,
  LiveAuctionSnapshot,
} from '../../../../../packages/contracts';
import {
  applyLiveAuctionAdminAction,
  fetchLiveAuctionState,
  joinLiveAuction,
  placeLiveAuctionBid,
} from '@/lib/api';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

const DEMO_PASSWORD = 'TONG-DEMO-ACCESS';

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url);
}

function AuctionEventContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const eventId = rawEventId ? decodeURIComponent(rawEventId) : 'shoucheng-dingman';
  const asAdmin = searchParams.get('admin') === '1';
  const adminKey = searchParams.get('admin_key') ?? '';
  const participantStorageKey = `tong.auction.participant.${eventId}.${asAdmin ? 'admin' : 'bidder'}`;

  const [snapshot, setSnapshot] = useState<LiveAuctionSnapshot | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [placingBid, setPlacingBid] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [customBid, setCustomBid] = useState('');
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [tickNow, setTickNow] = useState(Date.now());
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [adminMediaKind, setAdminMediaKind] = useState<LiveAuctionMediaKind>('generated_video');
  const [adminMediaUrl, setAdminMediaUrl] = useState('');
  const [adminMediaTitle, setAdminMediaTitle] = useState('');
  const [adminAnnouncement, setAdminAnnouncement] = useState('');
  const [demoReady, setDemoReady] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const currentDemo = typeof window !== 'undefined' ? window.localStorage.getItem('tong.demo.password') : null;
    if (currentDemo || searchParams.get('demo')) {
      setDemoReady(true);
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set('demo', DEMO_PASSWORD);
    router.replace(`/events/${encodeURIComponent(eventId)}?${next.toString()}`);
  }, [eventId, router, searchParams]);

  useEffect(() => {
    const timer = window.setInterval(() => setTickNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const media = snapshot.media;
    setAdminMediaKind(media?.kind ?? 'generated_video');
    setAdminMediaUrl(media?.url ?? '');
    setAdminMediaTitle(media?.title ?? '');
  }, [snapshot?.media?.kind, snapshot?.media?.title, snapshot?.media?.url]);

  useEffect(() => {
    let cancelled = false;

    async function joinRoom() {
      if (!demoReady) return;
      setJoining(true);
      setLoading(true);
      setError(null);
      try {
        const storedParticipantId = typeof window !== 'undefined'
          ? window.localStorage.getItem(participantStorageKey) || undefined
          : undefined;
        const response = await joinLiveAuction({
          eventId,
          participantId: storedParticipantId,
          asAdmin,
          adminKey,
        });
        if (cancelled) return;
        const nextParticipantId = response.participant.participantId;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(participantStorageKey, nextParticipantId);
        }
        setParticipantId(nextParticipantId);
        setSnapshot(response.snapshot);
        setServerOffsetMs(new Date(response.snapshot.serverNowIso).getTime() - Date.now());
      } catch (joinError) {
        if (cancelled) return;
        setError(joinError instanceof Error ? joinError.message : 'Failed to join the auction room.');
      } finally {
        if (!cancelled) {
          setJoining(false);
          setLoading(false);
        }
      }
    }

    void joinRoom();

    return () => {
      cancelled = true;
    };
  }, [adminKey, asAdmin, demoReady, eventId, participantStorageKey]);

  useEffect(() => {
    if (!participantId) return undefined;

    let cancelled = false;
    async function refreshState() {
      try {
        const nextSnapshot = await fetchLiveAuctionState({ eventId, participantId: participantId || undefined });
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setServerOffsetMs(new Date(nextSnapshot.serverNowIso).getTime() - Date.now());
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : 'Auction refresh failed.');
        }
      }
    }

    void refreshState();
    pollTimerRef.current = setInterval(() => {
      void refreshState();
    }, 1500);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [eventId, participantId]);

  const viewer = snapshot?.viewer ?? null;
  const leader = snapshot?.leader ?? null;
  const correctedNowMs = tickNow + serverOffsetMs;
  const remainingMs = snapshot
    ? Math.max(0, new Date(snapshot.endsAtIso).getTime() - correctedNowMs)
    : 0;
  const canBid = Boolean(viewer && snapshot?.status === 'open');
  const maxBid = viewer ? viewer.spAvailable + viewer.spCommitted : 0;
  const minNextBid = snapshot
    ? (leader ? leader.spCommitted + snapshot.minIncrementSp : snapshot.minOpeningBidSp)
    : 0;
  const suggestedBids = useMemo(() => {
    const candidates = [minNextBid, minNextBid + 5, minNextBid + 15]
      .filter((amount, index, values) => amount > 0 && amount <= maxBid && values.indexOf(amount) === index);
    return candidates;
  }, [maxBid, minNextBid]);
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const next = new URLSearchParams();
    next.set('demo', searchParams.get('demo') || DEMO_PASSWORD);
    return `${window.location.origin}/events/${encodeURIComponent(eventId)}?${next.toString()}`;
  }, [eventId, searchParams]);

  async function submitBid(amountSp: number) {
    if (!participantId || !snapshot || !viewer) return;
    setPlacingBid(true);
    setError(null);
    try {
      const response = await placeLiveAuctionBid({
        eventId,
        participantId,
        amountSp,
      });
      setSnapshot(response.snapshot);
      setServerOffsetMs(new Date(response.snapshot.serverNowIso).getTime() - Date.now());
      if (!response.accepted) {
        setError(response.reason ? `Bid rejected: ${response.reason}.` : 'Bid rejected.');
      } else {
        setCustomBid('');
      }
    } catch (bidError) {
      setError(bidError instanceof Error ? bidError.message : 'Bid failed.');
    } finally {
      setPlacingBid(false);
    }
  }

  async function submitAdminAction(body: Parameters<typeof applyLiveAuctionAdminAction>[0]) {
    setAdminBusy(true);
    setError(null);
    try {
      const response = await applyLiveAuctionAdminAction(body);
      setSnapshot(response.snapshot);
      setServerOffsetMs(new Date(response.snapshot.serverNowIso).getTime() - Date.now());
      if (body.action === 'announce' && 'message' in body) {
        setAdminAnnouncement(body.message);
      }
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : 'Admin action failed.');
    } finally {
      setAdminBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopyState('copied');
    window.setTimeout(() => setCopyState('idle'), 1500);
  }

  return (
    <main className="auction-shell">
      <section className="auction-backdrop" />
      <section className="auction-grid">
        <header className="auction-hero">
          <div>
            <p className="auction-kicker">Live Shanghai Event</p>
            <h1>{snapshot?.title ?? 'Shoucheng / Dingman Special Auction'}</h1>
            <p className="auction-subtitle">
              {snapshot?.subtitle ?? 'Join a live SP auction, track the countdown, and unlock the winner state in one shared room.'}
            </p>
          </div>
          <div className="auction-share">
            <code>{shareUrl || `/events/${eventId}`}</code>
            <button type="button" onClick={copyShareLink}>
              {copyState === 'copied' ? 'Copied' : 'Copy share link'}
            </button>
          </div>
        </header>

        <section className="auction-primary-card">
          <div className="auction-timer-row">
            <div>
              <p className="auction-label">Countdown</p>
              <div className="auction-timer">{formatCountdown(remainingMs)}</div>
              <p className="auction-caption">
                {snapshot?.status === 'closed'
                  ? 'Auction settled. Winner state is locked in below.'
                  : 'Timer is server-driven and refreshes from the live room snapshot.'}
              </p>
            </div>
            <div className="auction-leader">
              <p className="auction-label">Current leader</p>
              <div className="auction-leader-name">{leader?.displayName ?? 'No bids yet'}</div>
              <div className="auction-leader-amount">{leader ? `${leader.spCommitted} SP` : `${snapshot?.minOpeningBidSp ?? 10} SP opening`}</div>
            </div>
          </div>

          <div className="auction-media-card">
            <div className="auction-media-header">
              <div>
                <p className="auction-label">Event media</p>
                <h2>{snapshot?.media?.title || 'Stage feed offline'}</h2>
              </div>
              <span className="auction-media-pill">{snapshot?.media?.kind?.replace('_', ' ') ?? 'no media'}</span>
            </div>
            {snapshot?.media?.url ? (
              snapshot.media.kind === 'livestream' && !isVideoUrl(snapshot.media.url) ? (
                <iframe
                  className="auction-media-frame"
                  src={snapshot.media.url}
                  title={snapshot.media.title || 'Auction stream'}
                  allow="autoplay; encrypted-media; fullscreen"
                />
              ) : (
                <video
                  className="auction-media-frame"
                  src={snapshot.media.url}
                  controls
                  playsInline
                  muted={snapshot.media.kind !== 'uploaded_video'}
                  autoPlay={snapshot.media.kind !== 'uploaded_video'}
                />
              )
            ) : (
              <div className="auction-media-empty">
                <strong>Admin feed pending</strong>
                <p>Use the admin controls to attach a livestream, uploaded MP4/WebM, or generated teaser clip.</p>
              </div>
            )}
          </div>

          <div className="auction-bid-card">
            <div>
              <p className="auction-label">Your seat</p>
              <h2>{viewer?.displayName ?? 'Joining...'}</h2>
              <p className="auction-caption">
                {viewer
                  ? `${viewer.role === 'admin' ? 'Admin' : 'Bidder'} wallet: ${viewer.spAvailable} SP free, ${viewer.spCommitted} SP committed.`
                  : 'Waiting for room assignment.'}
              </p>
            </div>
            <div className="auction-bid-actions">
              {suggestedBids.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="auction-chip"
                  disabled={!canBid || placingBid}
                  onClick={() => void submitBid(amount)}
                >
                  Bid {amount} SP
                </button>
              ))}
              <div className="auction-custom-bid">
                <input
                  type="number"
                  inputMode="numeric"
                  min={minNextBid}
                  max={maxBid}
                  value={customBid}
                  onChange={(event) => setCustomBid(event.target.value)}
                  placeholder={String(minNextBid || 10)}
                />
                <button
                  type="button"
                  disabled={!canBid || placingBid || !customBid}
                  onClick={() => void submitBid(Number(customBid))}
                >
                  Place custom bid
                </button>
              </div>
              <p className="auction-caption">
                {snapshot?.status === 'closed'
                  ? 'Bidding is closed.'
                  : `Next valid bid: ${minNextBid} SP. Max you can commit right now: ${maxBid} SP.`}
              </p>
            </div>
          </div>
        </section>

        <aside className="auction-sidebar">
          <section className="auction-side-card">
            <p className="auction-label">Live ticker</p>
            <ul className="auction-feed">
              {(snapshot?.recentBids ?? []).map((bid) => (
                <li key={bid.bidId}>
                  <strong>{bid.displayName}</strong>
                  <span>{bid.amountSp} SP</span>
                  <small>{new Date(bid.placedAtIso).toLocaleTimeString()}</small>
                </li>
              ))}
              {snapshot?.recentBids?.length === 0 ? (
                <li className="auction-feed-empty">No bids yet. The first bid opens the room.</li>
              ) : null}
            </ul>
          </section>

          <section className="auction-side-card">
            <p className="auction-label">Participants</p>
            <ul className="auction-participants">
              {(snapshot?.participants ?? []).map((participant) => (
                <li key={participant.participantId}>
                  <div>
                    <strong>{participant.displayName}</strong>
                    <small>{participant.role}</small>
                  </div>
                  <span>{participant.spAvailable} free / {participant.spCommitted} held</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="auction-side-card auction-result-card">
            <p className="auction-label">Unlock state</p>
            {snapshot?.unlock.unlocked ? (
              <>
                <h2>{snapshot.unlock.winnerDisplayName} wins</h2>
                <p>{snapshot.unlock.winningBidSp} SP secured the unlock.</p>
                <span className="auction-result-pill">Unlocked: {snapshot.unlock.unlockKey}</span>
              </>
            ) : (
              <>
                <h2>Winner pending</h2>
                <p>The room settles automatically when the countdown ends or when admin closes the event.</p>
                <span className="auction-result-pill">Pending: {snapshot?.unlock.unlockKey ?? 'unlock.shanghai.auction.preview'}</span>
              </>
            )}
            {snapshot?.lastAnnouncement ? (
              <p className="auction-caption">{snapshot.lastAnnouncement}</p>
            ) : null}
          </section>

          {viewer?.role === 'admin' ? (
            <section className="auction-side-card">
              <p className="auction-label">Admin controls</p>
              <div className="auction-admin-grid">
                <button type="button" disabled={adminBusy} onClick={() => void submitAdminAction({ eventId, participantId: viewer.participantId, action: 'extend', seconds: 60 })}>
                  +60s
                </button>
                <button type="button" disabled={adminBusy} onClick={() => void submitAdminAction({ eventId, participantId: viewer.participantId, action: 'grant_sp', amountSp: 25 })}>
                  Grant self 25 SP
                </button>
                <button type="button" disabled={adminBusy} onClick={() => void submitAdminAction({ eventId, participantId: viewer.participantId, action: 'close_now' })}>
                  Close now
                </button>
                <button type="button" disabled={adminBusy} onClick={() => void submitAdminAction({ eventId, participantId: viewer.participantId, action: 'reset_demo' })}>
                  Reset room
                </button>
              </div>

              <div className="auction-admin-form">
                <label>
                  Media type
                  <select value={adminMediaKind} onChange={(event) => setAdminMediaKind(event.target.value as LiveAuctionMediaKind)}>
                    <option value="generated_video">Generated video</option>
                    <option value="uploaded_video">Uploaded video</option>
                    <option value="livestream">Livestream</option>
                  </select>
                </label>
                <label>
                  Media URL
                  <input value={adminMediaUrl} onChange={(event) => setAdminMediaUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label>
                  Media title
                  <input value={adminMediaTitle} onChange={(event) => setAdminMediaTitle(event.target.value)} placeholder="Rooftop reveal clip" />
                </label>
                <button
                  type="button"
                  disabled={adminBusy}
                  onClick={() => void submitAdminAction({
                    eventId,
                    participantId: viewer.participantId,
                    action: 'set_media',
                    media: { kind: adminMediaKind, url: adminMediaUrl, title: adminMediaTitle },
                  })}
                >
                  Publish media
                </button>
                <label>
                  Announcement
                  <input value={adminAnnouncement} onChange={(event) => setAdminAnnouncement(event.target.value)} placeholder="New teaser live now." />
                </label>
                <button
                  type="button"
                  disabled={adminBusy || !adminAnnouncement.trim()}
                  onClick={() => void submitAdminAction({
                    eventId,
                    participantId: viewer.participantId,
                    action: 'announce',
                    message: adminAnnouncement,
                  })}
                >
                  Post announcement
                </button>
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      {(loading || joining) && !snapshot ? (
        <div className="auction-status-banner">Joining live room...</div>
      ) : null}
      {error ? (
        <div className="auction-status-banner auction-status-banner--error">{error}</div>
      ) : null}

      <style jsx>{`
        .auction-shell {
          min-height: 100dvh;
          color: #fff8ef;
          background:
            radial-gradient(circle at top left, rgba(244, 178, 101, 0.18), transparent 32%),
            radial-gradient(circle at top right, rgba(214, 83, 63, 0.16), transparent 28%),
            linear-gradient(180deg, #15120f 0%, #0f1218 52%, #090b10 100%);
          position: relative;
          overflow: hidden;
        }

        .auction-backdrop {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.22;
          pointer-events: none;
        }

        .auction-grid {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 18px;
          padding: 24px 18px 56px;
          max-width: 1360px;
          margin: 0 auto;
        }

        .auction-hero,
        .auction-primary-card,
        .auction-side-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(12, 15, 22, 0.76);
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
        }

        .auction-hero {
          border-radius: 28px;
          padding: 24px;
          display: grid;
          gap: 18px;
        }

        .auction-kicker,
        .auction-label {
          margin: 0;
          font-size: 0.76rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #f2c28d;
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        .auction-hero h1 {
          font-size: clamp(2.1rem, 6vw, 4rem);
          line-height: 0.94;
          margin-top: 8px;
          max-width: 12ch;
        }

        .auction-subtitle,
        .auction-caption {
          color: rgba(255, 248, 239, 0.72);
          line-height: 1.5;
        }

        .auction-share {
          display: grid;
          gap: 10px;
        }

        .auction-share code {
          display: block;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          color: #fbe7cb;
          overflow-x: auto;
          white-space: nowrap;
        }

        .auction-share button,
        .auction-bid-actions button,
        .auction-admin-grid button,
        .auction-admin-form button {
          min-height: 48px;
          border-radius: 16px;
          border: none;
          cursor: pointer;
          font-weight: 700;
          background: linear-gradient(135deg, #f2c28d, #f07d56);
          color: #1a1410;
          padding: 0 16px;
        }

        .auction-share button:hover,
        .auction-bid-actions button:hover,
        .auction-admin-grid button:hover,
        .auction-admin-form button:hover {
          filter: brightness(1.04);
        }

        .auction-primary-card {
          border-radius: 28px;
          padding: 20px;
          display: grid;
          gap: 18px;
        }

        .auction-timer-row {
          display: grid;
          gap: 16px;
        }

        .auction-timer {
          font-size: clamp(2.6rem, 10vw, 5rem);
          line-height: 0.9;
          letter-spacing: -0.06em;
          margin: 8px 0;
        }

        .auction-leader {
          border-radius: 22px;
          padding: 18px;
          background: linear-gradient(160deg, rgba(242, 194, 141, 0.14), rgba(255, 255, 255, 0.04));
        }

        .auction-leader-name {
          margin-top: 10px;
          font-size: 1.35rem;
          font-weight: 700;
        }

        .auction-leader-amount {
          margin-top: 6px;
          color: #f2c28d;
          font-size: 1.05rem;
          font-weight: 700;
        }

        .auction-media-card,
        .auction-bid-card {
          border-radius: 22px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.035);
          display: grid;
          gap: 16px;
        }

        .auction-media-header {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: flex-start;
        }

        .auction-media-pill,
        .auction-result-pill {
          border-radius: 999px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.08);
          color: #fbe7cb;
          font-size: 0.82rem;
          white-space: nowrap;
        }

        .auction-media-frame,
        .auction-media-empty {
          width: 100%;
          aspect-ratio: 16 / 9;
          border: none;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        }

        .auction-media-empty {
          display: grid;
          place-items: center;
          text-align: center;
          padding: 18px;
          gap: 8px;
        }

        .auction-bid-actions {
          display: grid;
          gap: 12px;
        }

        .auction-chip {
          text-align: left;
        }

        .auction-custom-bid {
          display: grid;
          gap: 10px;
        }

        .auction-custom-bid input,
        .auction-admin-form input,
        .auction-admin-form select {
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: #fff8ef;
          padding: 0 14px;
        }

        .auction-sidebar {
          display: grid;
          gap: 18px;
        }

        .auction-side-card {
          border-radius: 24px;
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .auction-feed,
        .auction-participants {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }

        .auction-feed li,
        .auction-participants li {
          border-radius: 16px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          display: grid;
          gap: 4px;
        }

        .auction-feed li span,
        .auction-participants li span {
          color: #f2c28d;
          font-weight: 700;
        }

        .auction-feed li small,
        .auction-participants li small {
          color: rgba(255, 248, 239, 0.54);
        }

        .auction-feed-empty {
          color: rgba(255, 248, 239, 0.64);
        }

        .auction-result-card h2 {
          font-size: 1.4rem;
        }

        .auction-admin-grid,
        .auction-admin-form {
          display: grid;
          gap: 10px;
        }

        .auction-admin-form label {
          display: grid;
          gap: 6px;
          font-size: 0.88rem;
          color: rgba(255, 248, 239, 0.76);
        }

        .auction-status-banner {
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          max-width: min(calc(100vw - 24px), 40rem);
          padding: 12px 16px;
          border-radius: 18px;
          background: rgba(255, 248, 239, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(16px);
          z-index: 20;
        }

        .auction-status-banner--error {
          background: rgba(205, 72, 72, 0.2);
          color: #ffd5d5;
        }

        @media (min-width: 980px) {
          .auction-grid {
            grid-template-columns: minmax(0, 1.45fr) minmax(320px, 420px);
            align-items: start;
          }

          .auction-hero {
            grid-column: 1 / -1;
            grid-template-columns: minmax(0, 1fr) minmax(320px, 430px);
            align-items: end;
          }

          .auction-timer-row {
            grid-template-columns: 1.2fr 0.8fr;
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  );
}

export default function AuctionEventPage() {
  return (
    <Suspense fallback={null}>
      <AuctionEventContent />
    </Suspense>
  );
}

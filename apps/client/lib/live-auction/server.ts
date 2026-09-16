import type {
  LiveAuctionJoinRequest,
  LiveAuctionJoinResponse,
  LiveAuctionLogEntry,
  LiveAuctionParticipantKind,
  LiveAuctionSnapshot,
  LiveAuctionWinner,
} from './contracts';

type InternalParticipant = {
  participantId: string;
  displayName: string;
  kind: LiveAuctionParticipantKind;
  availableSp: number;
  currentBid: number;
  joinedAt: number;
  isAdmin?: boolean;
};

type Subscriber = (snapshot: LiveAuctionSnapshot) => void;

type InternalRoom = {
  roomId: string;
  title: string;
  version: number;
  status: LiveAuctionSnapshot['status'];
  opensAt: number;
  scheduledCloseAt: number;
  closesAt: number | null;
  currentLot: LiveAuctionSnapshot['currentLot'];
  currentBid: number;
  minIncrement: number;
  highestBidderId: string | null;
  winner: LiveAuctionWinner | null;
  closingReason: LiveAuctionSnapshot['closingReason'];
  participants: Map<string, InternalParticipant>;
  eventLog: LiveAuctionLogEntry[];
  subscribers: Set<Subscriber>;
  ticker: ReturnType<typeof setInterval> | null;
  lastBidAt: number;
  pausedFromStatus: Extract<LiveAuctionSnapshot['status'], 'scheduled' | 'open'> | null;
  pausedRemainingMs: number | null;
  pausedByParticipantId: string | null;
  pauseReason: LiveAuctionSnapshot['pauseReason'];
  pauseExpiresAt: number | null;
};

const ROOM_ID = 'shanghai-live-demo';
const OPEN_DELAY_MS = 0;
const OPEN_DURATION_MS = 30_000;
const ROOM_RECYCLE_MS = 45_000;
const PAYMENT_HOLD_MAX_MS = 4 * 60_000;
const LOT_IMAGE_URL = '/assets/webtoon/shanghai/h1/6.png';
const NPC_ROSTER = [
  { participantId: 'npc-agent-mei', displayName: 'Agent Mei' },
  { participantId: 'npc-bund-curator', displayName: 'Bund Curator' },
  { participantId: 'npc-collector-lin', displayName: 'Collector Lin' },
  { participantId: 'npc-house-18', displayName: 'House Paddle 18' },
  { participantId: 'npc-night-market-club', displayName: 'Night Market Club' },
  { participantId: 'npc-studio-three', displayName: 'Studio Three' },
];

declare global {
  // eslint-disable-next-line no-var
  var __tongShanghaiAuctionRoom: InternalRoom | undefined;
}

function now() {
  return Date.now();
}

function nextTransitionAt(room: InternalRoom): number {
  if (room.status === 'scheduled') return room.opensAt;
  if (room.status === 'open') return room.scheduledCloseAt;
  if (room.status === 'paused') return now() + Math.max(room.pausedRemainingMs ?? 0, 0);
  return room.closesAt ?? now();
}

function getRemainingMs(room: InternalRoom, timestamp = now()) {
  if (room.status === 'scheduled') return Math.max(room.opensAt - timestamp, 0);
  if (room.status === 'open') return Math.max(room.scheduledCloseAt - timestamp, 0);
  if (room.status === 'paused') return Math.max(room.pausedRemainingMs ?? 0, 0);
  return 0;
}

function createRoom(): InternalRoom {
  const createdAt = now();
  const room: InternalRoom = {
    roomId: ROOM_ID,
    title: 'Shanghai Special Event Auction',
    version: 1,
    status: 'scheduled',
    opensAt: createdAt + OPEN_DELAY_MS,
    scheduledCloseAt: createdAt + OPEN_DELAY_MS + OPEN_DURATION_MS,
    closesAt: null,
    currentLot: {
      lotId: 'lot-shanghai-hangout-001',
      title: 'After-Hours Dumpling Shop Invite',
      subtitle: 'Private Shanghai hangout unlock',
      description: 'Win Tong’s private after-hours slot to launch the Shanghai onboarding handoff and step into the first Dumpling Shop scene.',
      imageUrl: LOT_IMAGE_URL,
    },
    currentBid: 0,
    minIncrement: 5,
    highestBidderId: null,
    winner: null,
    closingReason: null,
    participants: new Map(),
    eventLog: [],
    subscribers: new Set(),
    ticker: null,
    lastBidAt: createdAt,
    pausedFromStatus: null,
    pausedRemainingMs: null,
    pausedByParticipantId: null,
    pauseReason: null,
    pauseExpiresAt: null,
  };

  for (const npc of NPC_ROSTER) {
    room.participants.set(npc.participantId, {
      participantId: npc.participantId,
      displayName: npc.displayName,
      kind: 'npc',
      availableSp: 95 + Math.floor(Math.random() * 110),
      currentBid: 0,
      joinedAt: createdAt - 5_000,
    });
  }

  seedPreviewBid(room);
  appendLog(room, 'house', 'Tong dropped one private Shanghai hangout invite into the room.');
  room.ticker = setInterval(() => tickRoom(room), 1_250);
  return room;
}

function seedPreviewBid(room: InternalRoom) {
  const contenders = [...room.participants.values()];
  const seeded = contenders[Math.floor(Math.random() * contenders.length)];
  if (!seeded) return;

  const previewBid = Math.min(seeded.availableSp, 35 + Math.floor(Math.random() * 4) * room.minIncrement);
  seeded.currentBid = previewBid;
  room.currentBid = previewBid;
  room.highestBidderId = seeded.participantId;
  appendLog(room, 'bid', `${seeded.displayName} opened the live tape at ${previewBid} SP.`);
}

function getRoom(options?: { skipTick?: boolean }) {
  if (
    globalThis.__tongShanghaiAuctionRoom
    && globalThis.__tongShanghaiAuctionRoom.status === 'closed'
    && globalThis.__tongShanghaiAuctionRoom.closesAt
    && now() - globalThis.__tongShanghaiAuctionRoom.closesAt > ROOM_RECYCLE_MS
  ) {
    globalThis.__tongShanghaiAuctionRoom = undefined;
  }

  if (!globalThis.__tongShanghaiAuctionRoom) {
    globalThis.__tongShanghaiAuctionRoom = createRoom();
  }

  if (!options?.skipTick) {
    tickRoom(globalThis.__tongShanghaiAuctionRoom);
  }
  return globalThis.__tongShanghaiAuctionRoom;
}

function appendLog(room: InternalRoom, kind: LiveAuctionLogEntry['kind'], text: string) {
  room.eventLog.unshift({
    entryId: `${kind}-${room.version + 1}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text,
    atIso: new Date(now()).toISOString(),
  });
  room.eventLog = room.eventLog.slice(0, 18);
}

function toSnapshot(room: InternalRoom): LiveAuctionSnapshot {
  return {
    roomId: room.roomId,
    title: room.title,
    version: room.version,
    status: room.status,
    opensAtIso: new Date(room.opensAt).toISOString(),
    scheduledCloseAtIso: new Date(room.scheduledCloseAt).toISOString(),
    closesAtIso: room.closesAt ? new Date(room.closesAt).toISOString() : null,
    nextTransitionAtIso: new Date(nextTransitionAt(room)).toISOString(),
    currentLot: room.currentLot,
    currentBid: room.currentBid,
    minIncrement: room.minIncrement,
    timeRemainingMs: getRemainingMs(room),
    highestBidderId: room.highestBidderId,
    participants: [...room.participants.values()]
      .sort((left, right) => {
        if (left.participantId === room.highestBidderId) return -1;
        if (right.participantId === room.highestBidderId) return 1;
        if (right.currentBid !== left.currentBid) return right.currentBid - left.currentBid;
        return right.availableSp - left.availableSp;
      })
      .map((participant) => ({
        participantId: participant.participantId,
        displayName: participant.displayName,
        kind: participant.kind,
        availableSp: participant.availableSp,
        currentBid: participant.currentBid,
        isLeading: participant.participantId === room.highestBidderId,
        joinedAtIso: new Date(participant.joinedAt).toISOString(),
        isAdmin: participant.isAdmin,
      })),
    eventLog: room.eventLog,
    winner: room.winner,
    pauseReason: room.pauseReason,
    pausedByParticipantId: room.pausedByParticipantId,
    closingReason: room.closingReason,
  };
}

function broadcast(room: InternalRoom) {
  room.version += 1;
  const snapshot = toSnapshot(room);
  for (const subscriber of room.subscribers) {
    subscriber(snapshot);
  }
}

function tickRoom(room: InternalRoom) {
  const timestamp = now();

  if (room.status === 'paused') {
    if (room.pauseExpiresAt && timestamp >= room.pauseExpiresAt) {
      resumePaymentHold(room, room.pausedByParticipantId, 'Stripe hold expired. Countdown resumed.');
    }
    return;
  }

  if (room.status === 'scheduled' && timestamp >= room.opensAt) {
    room.status = 'open';
    appendLog(room, 'house', 'Bidding for the Shanghai hangout invite is now live.');
    broadcast(room);
    return;
  }

  if (room.status !== 'open') {
    return;
  }

  if (timestamp >= room.scheduledCloseAt) {
    closeRoom({
      room,
      participantId: room.highestBidderId,
      amount: room.currentBid,
      reason: 'timer',
      allowOverride: true,
    });
    return;
  }

  if (timestamp - room.lastBidAt < 1_850) {
    return;
  }

  if (Math.random() < 0.72) {
    runNpcBid(room);
  }
}

function pauseForPayment(room: InternalRoom, participantId: string) {
  const participant = room.participants.get(participantId);
  if (!participant) {
    throw new Error('Participant not found.');
  }
  if (room.status === 'closed') {
    throw new Error('Auction already settled.');
  }
  if (room.status === 'paused') {
    if (room.pausedByParticipantId === participantId) {
      return toSnapshot(room);
    }
    throw new Error('Another checkout is already holding the room.');
  }

  room.pausedFromStatus = room.status === 'scheduled' ? 'scheduled' : 'open';
  room.pausedRemainingMs = getRemainingMs(room);
  room.pausedByParticipantId = participantId;
  room.pauseReason = 'payment';
  room.pauseExpiresAt = now() + PAYMENT_HOLD_MAX_MS;
  room.status = 'paused';

  appendLog(room, 'house', `${participant.displayName} opened Stripe. Tong froze the room clock.`);
  broadcast(room);
  return toSnapshot(room);
}

function resumePaymentHold(room: InternalRoom, participantId: string | null, message?: string) {
  if (room.status !== 'paused') {
    return toSnapshot(room);
  }

  if (participantId && room.pausedByParticipantId && room.pausedByParticipantId !== participantId) {
    throw new Error('This payment hold belongs to another bidder.');
  }

  const timestamp = now();
  const resumeStatus = room.pausedFromStatus ?? 'open';
  const remainingMs = Math.max(room.pausedRemainingMs ?? 0, 0);

  room.status = resumeStatus;
  if (resumeStatus === 'scheduled') {
    room.opensAt = timestamp + remainingMs;
    room.scheduledCloseAt = room.opensAt + OPEN_DURATION_MS;
  } else {
    room.scheduledCloseAt = timestamp + remainingMs;
    room.lastBidAt = timestamp;
  }

  room.pausedFromStatus = null;
  room.pausedRemainingMs = null;
  room.pausedByParticipantId = null;
  room.pauseReason = null;
  room.pauseExpiresAt = null;

  appendLog(room, 'house', message || 'Stripe closed. Countdown resumed.');
  broadcast(room);
  return toSnapshot(room);
}

function runNpcBid(room: InternalRoom) {
  const floor = room.currentBid + room.minIncrement;
  const contenders = [...room.participants.values()].filter((participant) => (
    participant.kind === 'npc'
    && participant.availableSp >= floor
    && participant.participantId !== room.highestBidderId
  ));

  if (!contenders.length) {
    return;
  }

  const contender = contenders[Math.floor(Math.random() * contenders.length)] ?? contenders[0];
  const ceiling = Math.max(floor, Math.min(contender.availableSp, floor + 25));
  const amount = ceiling - ((ceiling - floor) % room.minIncrement);
  setBid(room, contender.participantId, amount);
}

function setBid(room: InternalRoom, participantId: string, amount: number) {
  const participant = room.participants.get(participantId);
  if (!participant) {
    throw new Error('Participant not found.');
  }
  if (room.status === 'paused') {
    throw new Error('Stripe checkout is holding the room clock.');
  }
  if (room.status !== 'open') {
    throw new Error('Auction is not open yet.');
  }
  if (amount < room.currentBid + room.minIncrement) {
    throw new Error(`Bid must be at least ${room.currentBid + room.minIncrement} SP.`);
  }
  const additionalCommitment = amount - participant.currentBid;
  if (additionalCommitment > participant.availableSp) {
    throw new Error(`${participant.displayName} does not have enough SP.`);
  }

  const previousLeaderId = room.highestBidderId;
  const previousLeader = previousLeaderId ? room.participants.get(previousLeaderId) : null;

  if (previousLeader && previousLeader.participantId !== participantId && previousLeader.currentBid > 0) {
    previousLeader.availableSp += previousLeader.currentBid;
    previousLeader.currentBid = 0;
  }

  participant.availableSp -= additionalCommitment;
  participant.currentBid = amount;

  room.currentBid = amount;
  room.highestBidderId = participantId;
  room.lastBidAt = now();

  appendLog(room, 'bid', `${participant.displayName} moved to ${amount} SP.`);
  broadcast(room);
}

function resolveWinner(room: InternalRoom, participantId: string | null, amount: number): LiveAuctionWinner | null {
  if (!participantId) {
    return null;
  }

  const participant = room.participants.get(participantId);
  if (!participant) {
    return null;
  }

  return {
    participantId: participant.participantId,
    displayName: participant.displayName,
    amount,
    kind: participant.kind,
  };
}

function closeRoom({
  participantId,
  amount,
  reason,
  allowOverride = false,
  room: providedRoom,
}: {
  participantId: string | null;
  amount: number;
  reason: NonNullable<LiveAuctionSnapshot['closingReason']>;
  allowOverride?: boolean;
  room?: InternalRoom;
}) {
  const room = providedRoom ?? getRoom({ skipTick: true });
  const participant = participantId ? room.participants.get(participantId) : null;

  if (!allowOverride && !participant?.isAdmin) {
    throw new Error('Only an admin can close the room.');
  }

  if (room.status === 'closed') {
    return toSnapshot(room);
  }

  room.status = 'closed';
  room.closesAt = now();
  room.closingReason = reason;

  if (reason === 'admin_override' && participant) {
    const overrideAmount = Math.max(0, Math.floor(amount));
    room.currentBid = overrideAmount;
    room.highestBidderId = participant.participantId;
    participant.currentBid = overrideAmount;
    room.winner = resolveWinner(room, participant.participantId, overrideAmount);
    appendLog(room, 'close', `${participant.displayName} forced the hammer down at ${overrideAmount} SP.`);
  } else {
    const closingAmount = Math.max(room.currentBid, Math.max(0, Math.floor(amount)));
    room.currentBid = closingAmount;
    room.winner = resolveWinner(room, room.highestBidderId, closingAmount);
    appendLog(room, 'close', `The room closed at ${closingAmount} SP.`);
  }

  broadcast(room);

  if (room.ticker) {
    clearInterval(room.ticker);
    room.ticker = null;
  }

  return toSnapshot(room);
}

export function getSnapshot(): LiveAuctionSnapshot {
  return toSnapshot(getRoom());
}

export function resetAuctionRoom(): LiveAuctionSnapshot {
  const existing = globalThis.__tongShanghaiAuctionRoom;
  if (existing?.ticker) {
    clearInterval(existing.ticker);
  }
  globalThis.__tongShanghaiAuctionRoom = undefined;
  return getSnapshot();
}

export function joinRoom(request: LiveAuctionJoinRequest): LiveAuctionJoinResponse {
  const room = getRoom();
  const participantId = request.participantId?.trim() || crypto.randomUUID();
  const existing = room.participants.get(participantId);

  if (existing) {
    existing.displayName = request.displayName;
    existing.availableSp = Math.max(existing.availableSp, Math.floor(request.availableSp));
    existing.isAdmin = existing.isAdmin || request.isAdmin;
  } else {
    room.participants.set(participantId, {
      participantId,
      displayName: request.displayName,
      kind: request.isAdmin ? 'admin' : 'player',
      availableSp: Math.max(0, Math.floor(request.availableSp)),
      currentBid: 0,
      joinedAt: now(),
      isAdmin: request.isAdmin,
    });
    appendLog(room, 'join', `${request.displayName} entered with ${Math.floor(request.availableSp)} SP.`);
    broadcast(room);
  }

  return {
    participantId,
    snapshot: toSnapshot(room),
  };
}

export function placeBid(participantId: string, amount: number) {
  const room = getRoom();
  setBid(room, participantId, Math.floor(amount));
  return toSnapshot(room);
}

export function topUpParticipant(participantId: string, amount: number) {
  const room = getRoom();
  const participant = room.participants.get(participantId);
  if (!participant) {
    throw new Error('Participant not found.');
  }
  const topUpAmount = Math.max(0, Math.floor(amount));
  participant.availableSp += topUpAmount;
  appendLog(room, 'top_up', `${participant.displayName} topped up ${topUpAmount} SP.`);
  broadcast(room);
  return toSnapshot(room);
}

export function startPaymentHold(participantId: string) {
  const room = getRoom();
  return pauseForPayment(room, participantId);
}

export function finishPaymentHold(participantId: string) {
  const room = getRoom();
  return resumePaymentHold(room, participantId);
}

export function closeAuction(participantId: string, amount: number) {
  return closeRoom({
    participantId,
    amount,
    reason: 'admin_override',
  });
}

export function subscribe(subscriber: Subscriber) {
  const room = getRoom();
  room.subscribers.add(subscriber);
  subscriber(toSnapshot(room));

  return () => {
    room.subscribers.delete(subscriber);
  };
}

import crypto from 'node:crypto';

const ROOM_CATALOG = {
  'shoucheng-dingman': {
    title: 'Shoucheng / Dingman Special Auction',
    subtitle: 'Bid SP to unlock the rooftop preview and claim the winner reveal.',
    durationMs: 12 * 60 * 1000,
    minOpeningBidSp: 10,
    minIncrementSp: 5,
    unlockKey: 'unlock.shanghai.auction.preview',
    media: {
      kind: 'generated_video',
      url: '',
      title: 'Admin can attach a stream, uploaded video, or generated clip.',
    },
  },
};

const BIDDER_NAME_PARTS = [
  ['Lotus', 'Echo'],
  ['Neon', 'Bao'],
  ['Velvet', 'Signal'],
  ['Paper', 'Lantern'],
  ['Jade', 'Receipt'],
  ['Pearl', 'Switchboard'],
  ['Steam', 'Orbit'],
  ['Cinder', 'Voucher'],
  ['Plum', 'Frequency'],
  ['Rooftop', 'Static'],
];

const roomState = new Map();

function nowMs() {
  return Date.now();
}

function toIso(ms) {
  return new Date(ms).toISOString();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeEventId(eventId) {
  return typeof eventId === 'string' && eventId.trim() ? eventId.trim() : 'shoucheng-dingman';
}

function getRoomTemplate(eventId) {
  return ROOM_CATALOG[eventId] ?? null;
}

function buildParticipantView(participant, leaderId) {
  return {
    participantId: participant.participantId,
    displayName: participant.displayName,
    role: participant.role,
    spAvailable: Math.max(0, participant.walletSp - participant.currentBidSp),
    spCommitted: participant.currentBidSp,
    startingSp: participant.startingSp,
    joinedAtIso: toIso(participant.joinedAtMs),
    isLeading: participant.participantId === leaderId,
  };
}

function getLeaderBid(room) {
  if (!room.leadingBidId) return null;
  return room.bids.find((bid) => bid.bidId === room.leadingBidId) ?? null;
}

function createRoom(eventId) {
  const template = getRoomTemplate(eventId);
  if (!template) return null;

  const startedAtMs = nowMs();
  const room = {
    eventId,
    title: template.title,
    subtitle: template.subtitle,
    status: 'open',
    createdAtMs: startedAtMs,
    endsAtMs: startedAtMs + template.durationMs,
    durationMs: template.durationMs,
    minOpeningBidSp: template.minOpeningBidSp,
    minIncrementSp: template.minIncrementSp,
    unlockKey: template.unlockKey,
    media: template.media ? { ...template.media } : null,
    participants: new Map(),
    bids: [],
    leadingBidId: null,
    unlock: {
      unlockKey: template.unlockKey,
      unlocked: false,
      winnerParticipantId: null,
      winnerDisplayName: null,
      winningBidSp: null,
      unlockedAtMs: null,
    },
    lastAnnouncement: 'Auction room is live. Highest bidder unlocks the rooftop preview.',
  };

  roomState.set(eventId, room);
  return room;
}

function ensureRoom(eventId) {
  const normalized = normalizeEventId(eventId);
  const existing = roomState.get(normalized);
  if (existing) {
    maybeCloseRoom(existing);
    return existing;
  }
  return createRoom(normalized);
}

function makeBidderName(usedNames) {
  const available = BIDDER_NAME_PARTS
    .map((parts) => `${parts[0]} ${parts[1]}`)
    .filter((name) => !usedNames.has(name));

  const base = available.length > 0
    ? available[randomInt(0, available.length - 1)]
    : `Bidder ${randomInt(100, 999)}`;

  return base;
}

function ensureParticipant(room, options = {}) {
  const {
    participantId,
    preferredName,
    asAdmin = false,
    adminKey = '',
    adminSecret = '',
  } = options;

  if (participantId && room.participants.has(participantId)) {
    const participant = room.participants.get(participantId);
    if (asAdmin && adminSecret && adminKey === adminSecret) {
      participant.role = 'admin';
      if (participant.walletSp < 180) {
        participant.walletSp = 180;
        participant.startingSp = Math.max(participant.startingSp, 180);
      }
    }
    return participant;
  }

  const usedNames = new Set([...room.participants.values()].map((participant) => participant.displayName));
  const allowedAdmin = Boolean(asAdmin && adminSecret && adminKey === adminSecret);
  const nextParticipantId = participantId
    || `${allowedAdmin ? 'admin' : 'bidder'}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const displayName = typeof preferredName === 'string' && preferredName.trim()
    ? preferredName.trim().slice(0, 24)
    : allowedAdmin
      ? 'Stage Manager'
      : makeBidderName(usedNames);
  const walletSp = allowedAdmin ? randomInt(160, 240) : randomInt(60, 140);
  const participant = {
    participantId: nextParticipantId,
    displayName,
    role: allowedAdmin ? 'admin' : 'bidder',
    walletSp,
    startingSp: walletSp,
    currentBidSp: 0,
    joinedAtMs: nowMs(),
  };
  room.participants.set(nextParticipantId, participant);
  return participant;
}

function buildSnapshot(room, viewerParticipantId = null) {
  maybeCloseRoom(room);
  const leaderBid = getLeaderBid(room);
  const leaderId = leaderBid?.participantId ?? null;
  const participants = [...room.participants.values()]
    .map((participant) => buildParticipantView(participant, leaderId))
    .sort((left, right) => {
      if (left.isLeading !== right.isLeading) return left.isLeading ? -1 : 1;
      if (left.role !== right.role) return left.role === 'admin' ? -1 : 1;
      return left.displayName.localeCompare(right.displayName);
    });
  const viewer = viewerParticipantId && room.participants.has(viewerParticipantId)
    ? buildParticipantView(room.participants.get(viewerParticipantId), leaderId)
    : null;
  const leader = leaderId && room.participants.has(leaderId)
    ? buildParticipantView(room.participants.get(leaderId), leaderId)
    : null;

  return {
    eventId: room.eventId,
    title: room.title,
    subtitle: room.subtitle,
    status: room.status,
    serverNowIso: toIso(nowMs()),
    createdAtIso: toIso(room.createdAtMs),
    endsAtIso: toIso(room.endsAtMs),
    minOpeningBidSp: room.minOpeningBidSp,
    minIncrementSp: room.minIncrementSp,
    participantCount: room.participants.size,
    media: room.media ? { ...room.media } : null,
    viewer,
    leader,
    participants,
    recentBids: room.bids
      .slice(-12)
      .reverse()
      .map((bid) => ({
        bidId: bid.bidId,
        participantId: bid.participantId,
        displayName: bid.displayName,
        role: bid.role,
        amountSp: bid.amountSp,
        previousAmountSp: bid.previousAmountSp,
        placedAtIso: toIso(bid.placedAtMs),
      })),
    unlock: {
      unlockKey: room.unlock.unlockKey,
      unlocked: room.unlock.unlocked,
      winnerParticipantId: room.unlock.winnerParticipantId,
      winnerDisplayName: room.unlock.winnerDisplayName,
      winningBidSp: room.unlock.winningBidSp,
      unlockedAtIso: room.unlock.unlockedAtMs ? toIso(room.unlock.unlockedAtMs) : null,
    },
    lastAnnouncement: room.lastAnnouncement ?? null,
  };
}

function closeRoom(room, reason = 'countdown_finished') {
  if (room.status === 'closed') return room;

  room.status = 'closed';
  room.endsAtMs = Math.min(room.endsAtMs, nowMs());
  const leaderBid = getLeaderBid(room);
  if (leaderBid) {
    room.unlock = {
      unlockKey: room.unlockKey,
      unlocked: true,
      winnerParticipantId: leaderBid.participantId,
      winnerDisplayName: leaderBid.displayName,
      winningBidSp: leaderBid.amountSp,
      unlockedAtMs: nowMs(),
    };
    room.lastAnnouncement = reason === 'admin_closed'
      ? `Auction closed by admin. ${leaderBid.displayName} wins with ${leaderBid.amountSp} SP.`
      : `${leaderBid.displayName} wins with ${leaderBid.amountSp} SP and unlocks the rooftop preview.`;
  } else {
    room.lastAnnouncement = reason === 'admin_closed'
      ? 'Auction closed by admin without a winning bid.'
      : 'Auction ended without a winning bid.';
  }
  return room;
}

function maybeCloseRoom(room) {
  if (room.status !== 'open') return room;
  if (nowMs() >= room.endsAtMs) {
    closeRoom(room, 'countdown_finished');
  }
  return room;
}

function joinLiveAuction(body = {}, options = {}) {
  const room = ensureRoom(body.eventId);
  if (!room) {
    return { statusCode: 404, payload: { error: 'event_not_found' } };
  }

  const participant = ensureParticipant(room, {
    participantId: body.participantId,
    preferredName: body.preferredName,
    asAdmin: body.asAdmin,
    adminKey: body.adminKey,
    adminSecret: options.adminSecret,
  });

  return {
    statusCode: 200,
    payload: {
      participant: buildParticipantView(participant, getLeaderBid(room)?.participantId ?? null),
      snapshot: buildSnapshot(room, participant.participantId),
    },
  };
}

function getLiveAuctionState(query = {}) {
  const room = ensureRoom(query.eventId);
  if (!room) {
    return { statusCode: 404, payload: { error: 'event_not_found' } };
  }

  return {
    statusCode: 200,
    payload: buildSnapshot(room, typeof query.participantId === 'string' ? query.participantId : null),
  };
}

function placeLiveAuctionBid(body = {}) {
  const room = ensureRoom(body.eventId);
  if (!room) {
    return { statusCode: 404, payload: { error: 'event_not_found' } };
  }

  const participant = typeof body.participantId === 'string'
    ? room.participants.get(body.participantId)
    : null;
  if (!participant) {
    return {
      statusCode: 404,
      payload: {
        accepted: false,
        reason: 'participant_not_found',
        snapshot: buildSnapshot(room),
      },
    };
  }

  maybeCloseRoom(room);
  if (room.status !== 'open') {
    return {
      statusCode: 409,
      payload: {
        accepted: false,
        reason: 'auction_closed',
        snapshot: buildSnapshot(room, participant.participantId),
      },
    };
  }

  const amountSp = Number(body.amountSp);
  if (!Number.isFinite(amountSp) || amountSp <= 0 || !Number.isInteger(amountSp)) {
    return {
      statusCode: 400,
      payload: {
        accepted: false,
        reason: 'invalid_amount',
        snapshot: buildSnapshot(room, participant.participantId),
      },
    };
  }

  const leaderBid = getLeaderBid(room);
  const nextMinimum = leaderBid
    ? leaderBid.amountSp + room.minIncrementSp
    : room.minOpeningBidSp;
  if (amountSp < nextMinimum) {
    return {
      statusCode: 409,
      payload: {
        accepted: false,
        reason: 'bid_too_low',
        snapshot: buildSnapshot(room, participant.participantId),
      },
    };
  }

  if (amountSp > participant.walletSp) {
    return {
      statusCode: 409,
      payload: {
        accepted: false,
        reason: 'insufficient_sp',
        snapshot: buildSnapshot(room, participant.participantId),
      },
    };
  }

  if (leaderBid && leaderBid.participantId !== participant.participantId) {
    const previousLeader = room.participants.get(leaderBid.participantId);
    if (previousLeader) previousLeader.currentBidSp = 0;
  }

  participant.currentBidSp = amountSp;
  const bid = {
    bidId: `bid_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
    participantId: participant.participantId,
    displayName: participant.displayName,
    role: participant.role,
    amountSp,
    previousAmountSp: leaderBid?.amountSp ?? 0,
    placedAtMs: nowMs(),
  };
  room.bids.push(bid);
  room.leadingBidId = bid.bidId;
  room.lastAnnouncement = `${participant.displayName} jumps to ${amountSp} SP.`;

  return {
    statusCode: 200,
    payload: {
      accepted: true,
      bid: {
        bidId: bid.bidId,
        participantId: bid.participantId,
        displayName: bid.displayName,
        role: bid.role,
        amountSp: bid.amountSp,
        previousAmountSp: bid.previousAmountSp,
        placedAtIso: toIso(bid.placedAtMs),
      },
      snapshot: buildSnapshot(room, participant.participantId),
    },
  };
}

function applyLiveAuctionAdminAction(body = {}) {
  const room = ensureRoom(body.eventId);
  if (!room) {
    return { statusCode: 404, payload: { error: 'event_not_found' } };
  }

  const participant = typeof body.participantId === 'string'
    ? room.participants.get(body.participantId)
    : null;
  if (!participant || participant.role !== 'admin') {
    return { statusCode: 403, payload: { error: 'admin_required' } };
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (action === 'set_media') {
    const media = body.media && typeof body.media === 'object' ? body.media : null;
    room.media = media && typeof media.kind === 'string'
      ? {
        kind: media.kind,
        url: typeof media.url === 'string' ? media.url : '',
        title: typeof media.title === 'string' ? media.title : '',
      }
      : null;
    room.lastAnnouncement = room.media?.title
      ? `Admin switched media: ${room.media.title}.`
      : 'Admin cleared the event media.';
  } else if (action === 'extend') {
    const seconds = Math.max(5, Math.min(15 * 60, Number(body.seconds) || 0));
    room.endsAtMs = Math.max(nowMs(), room.endsAtMs) + (seconds * 1000);
    if (room.status === 'closed') {
      room.status = 'open';
    }
    room.lastAnnouncement = `Admin extended the room by ${seconds} seconds.`;
  } else if (action === 'close_now') {
    closeRoom(room, 'admin_closed');
  } else if (action === 'grant_sp') {
    const amountSp = Math.max(1, Math.min(500, Number(body.amountSp) || 0));
    const targetId = typeof body.targetParticipantId === 'string' && room.participants.has(body.targetParticipantId)
      ? body.targetParticipantId
      : participant.participantId;
    const targetParticipant = room.participants.get(targetId);
    targetParticipant.walletSp += amountSp;
    targetParticipant.startingSp += amountSp;
    room.lastAnnouncement = `Admin granted ${amountSp} SP to ${targetParticipant.displayName}.`;
  } else if (action === 'announce') {
    const message = typeof body.message === 'string' && body.message.trim()
      ? body.message.trim().slice(0, 160)
      : 'Admin posted an update.';
    room.lastAnnouncement = message;
  } else if (action === 'reset_demo') {
    const currentParticipants = [...room.participants.values()];
    room.status = 'open';
    room.endsAtMs = nowMs() + room.durationMs;
    room.bids = [];
    room.leadingBidId = null;
    room.unlock = {
      unlockKey: room.unlockKey,
      unlocked: false,
      winnerParticipantId: null,
      winnerDisplayName: null,
      winningBidSp: null,
      unlockedAtMs: null,
    };
    for (const existing of currentParticipants) {
      existing.currentBidSp = 0;
    }
    room.lastAnnouncement = 'Admin reset the demo room and reopened bidding.';
  } else {
    return { statusCode: 400, payload: { error: 'unsupported_action' } };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      snapshot: buildSnapshot(room, participant.participantId),
    },
  };
}

export {
  applyLiveAuctionAdminAction,
  getLiveAuctionState,
  joinLiveAuction,
  placeLiveAuctionBid,
};

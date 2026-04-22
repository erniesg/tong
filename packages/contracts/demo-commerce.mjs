function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'item';
}

function buildGrantId(idempotencyKey) {
  return `grant_${normalizeToken(idempotencyKey)}`;
}

function buildEntitlementId(userId, productKey) {
  return `ent_${normalizeToken(userId)}_${normalizeToken(productKey)}`;
}

function buildPurchaseEventRecordId(providerEventId) {
  const compactEventId = String(providerEventId || '').replace(/^evt_/, '');
  return `pevt_${normalizeToken(compactEventId)}`;
}

function buildSpendId(idempotencyKey) {
  return `spend_${normalizeToken(idempotencyKey)}`;
}

function inferEntitlementType(productKey, fallbackType = 'feature_access') {
  if (typeof productKey !== 'string') return fallbackType;
  if (productKey.includes('collectible.') || productKey.includes('polaroid')) return 'collectible';
  if (productKey.includes('mission')) return 'mission_unlock';
  if (productKey.includes('location') || productKey.includes('secret.')) return 'location_unlock';
  return fallbackType;
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === 'object' ? cloneJson(metadata) : undefined;
}

export function createDemoCommerceApi(fixtures) {
  const ledgers = new Map();
  const purchaseEvents = new Map();
  const unlockGrants = new Map();
  const spendEvents = new Map();

  function ensureLedger(userId) {
    const normalizedUserId = String(userId || '').trim() || String(fixtures.entitlements?.userId || 'demo-user-1');
    const existing = ledgers.get(normalizedUserId);
    if (existing) return existing;

    const entitlementsFixture = cloneJson(fixtures.entitlements || {});
    const ledger = {
      userId: normalizedUserId,
      balances: cloneJson(entitlementsFixture.balances || { xp: 0, sp: 0, rp: 0 }),
      entitlements: cloneJson(entitlementsFixture.entitlements || []),
    };
    ledgers.set(normalizedUserId, ledger);
    return ledger;
  }

  function getEntitlements(userId) {
    const ledger = ensureLedger(userId);
    return {
      userId: ledger.userId,
      asOfIso: nowIso(),
      balances: cloneJson(ledger.balances),
      entitlements: cloneJson(ledger.entitlements),
    };
  }

  function recordPurchaseEvent(body = {}) {
    const fixture = cloneJson(fixtures.purchaseEvent || {});
    const provider = typeof body.provider === 'string' && body.provider.trim()
      ? body.provider.trim()
      : fixture.provider || 'stripe';
    const providerEventId = typeof body.providerEventId === 'string' && body.providerEventId.trim()
      ? body.providerEventId.trim()
      : fixture.providerEventId || 'evt_demo_checkout';
    const dedupeKey = `${provider}:${providerEventId}`;
    if (purchaseEvents.has(dedupeKey)) {
      const existing = purchaseEvents.get(dedupeKey);
      return {
        ...cloneJson(existing),
        status: 'duplicate',
      };
    }

    const userId = typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : fixture.userId || 'demo-user-1';
    ensureLedger(userId);

    const response = {
      ...fixture,
      recordId: dedupeKey === `${fixture.provider}:${fixture.providerEventId}`
        ? fixture.recordId
        : buildPurchaseEventRecordId(providerEventId),
      status: 'recorded',
      provider,
      providerEventId,
      eventType: typeof body.eventType === 'string' && body.eventType.trim()
        ? body.eventType.trim()
        : fixture.eventType || 'checkout.session.completed',
      userId,
      occurredAtIso: typeof body.occurredAtIso === 'string' && body.occurredAtIso.trim()
        ? body.occurredAtIso.trim()
        : fixture.occurredAtIso || nowIso(),
      recordedAtIso: nowIso(),
      dedupeKey,
      amount: body.amount && typeof body.amount === 'object'
        ? {
            ...(fixture.amount || {}),
            ...cloneJson(body.amount),
          }
        : cloneJson(fixture.amount || {}),
      metadata: normalizeMetadata(body.metadata) || cloneJson(fixture.metadata || {}),
      payloadHash: typeof body.payloadHash === 'string' && body.payloadHash.trim()
        ? body.payloadHash.trim()
        : fixture.payloadHash || 'sha256:demo_checkout_payload_hash',
    };

    purchaseEvents.set(dedupeKey, response);
    return cloneJson(response);
  }

  function grantUnlock(body = {}) {
    const fixture = cloneJson(fixtures.unlockGrant || {});
    const userId = typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : fixture.userId || 'demo-user-1';
    const unlockKey = typeof body.unlockKey === 'string' && body.unlockKey.trim()
      ? body.unlockKey.trim()
      : fixture.unlockKey || 'unlock.demo.feature';
    const grantSource = typeof body.grantSource === 'string' && body.grantSource.trim()
      ? body.grantSource.trim()
      : fixture.grantSource || 'admin_manual';
    const purchaseEventId = typeof body.purchaseEventId === 'string' && body.purchaseEventId.trim()
      ? body.purchaseEventId.trim()
      : fixture.purchaseEventId || null;
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : `${unlockKey}:${userId}`;
    if (unlockGrants.has(idempotencyKey)) {
      return cloneJson(unlockGrants.get(idempotencyKey));
    }

    const ledger = ensureLedger(userId);
    const existingEntitlement = ledger.entitlements.find((entitlement) => entitlement.productKey === unlockKey);
    const grantedAtIso = nowIso();
    const entitlement = existingEntitlement
      ? {
          ...existingEntitlement,
          status: 'active',
          purchaseEventId,
          metadata: normalizeMetadata(body.metadata) || existingEntitlement.metadata,
        }
      : {
          ...(fixture.entitlement || {}),
          entitlementId: buildEntitlementId(userId, unlockKey),
          productKey: unlockKey,
          type: inferEntitlementType(unlockKey, fixture.entitlement?.type || 'feature_access'),
          status: 'active',
          grantedAtIso,
          source: grantSource,
          purchaseEventId,
          metadata: normalizeMetadata(body.metadata) || cloneJson(fixture.entitlement?.metadata || {}),
        };

    if (existingEntitlement) {
      Object.assign(existingEntitlement, entitlement);
    } else {
      ledger.entitlements.push(entitlement);
    }

    const response = {
      ...fixture,
      grantId: buildGrantId(idempotencyKey),
      status: existingEntitlement ? 'already_granted' : 'granted',
      userId,
      unlockKey,
      grantSource,
      grantedAtIso,
      idempotencyKey,
      purchaseEventId,
      entitlement: cloneJson(entitlement),
    };

    unlockGrants.set(idempotencyKey, response);
    return cloneJson(response);
  }

  function spend(body = {}) {
    const fixture = cloneJson(fixtures.spend || {});
    const userId = typeof body.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : fixture.userId || 'demo-user-1';
    const ledger = ensureLedger(userId);
    const amountSp = Number(body.amountSp);
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : fixture.reason || 'credit_gate';
    const unlockKey = typeof body.unlockKey === 'string' && body.unlockKey.trim()
      ? body.unlockKey.trim()
      : '';
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : `${reason}:${unlockKey || 'sp'}:${userId}:${Number.isFinite(amountSp) ? amountSp : 'invalid'}`;
    if (spendEvents.has(idempotencyKey)) {
      return cloneJson(spendEvents.get(idempotencyKey));
    }

    if (unlockKey) {
      const existingEntitlement = ledger.entitlements.find((entitlement) => entitlement.productKey === unlockKey);
      if (existingEntitlement) {
        const response = {
          ...fixture,
          accepted: true,
          spendId: buildSpendId(idempotencyKey),
          userId,
          amountSp: 0,
          requestedAmountSp: Number.isFinite(amountSp) ? amountSp : fixture.requestedAmountSp || 0,
          reason,
          balances: cloneJson(ledger.balances),
          spentAtIso: nowIso(),
          idempotencyKey,
          unlockGrant: {
            grantId: buildGrantId(`${unlockKey}:${userId}`),
            status: 'already_granted',
            userId,
            unlockKey,
            grantSource: existingEntitlement.source || 'wallet_spend',
            grantedAtIso: existingEntitlement.grantedAtIso || nowIso(),
            idempotencyKey: `${unlockKey}:${userId}`,
            purchaseEventId: existingEntitlement.purchaseEventId || null,
            entitlement: cloneJson(existingEntitlement),
          },
        };
        spendEvents.set(idempotencyKey, response);
        return cloneJson(response);
      }
    }

    if (!Number.isFinite(amountSp) || amountSp <= 0 || !Number.isInteger(amountSp)) {
      const response = {
        ...fixture,
        accepted: false,
        reasonCode: 'invalid_amount',
        userId,
        amountSp: 0,
        requestedAmountSp: Number.isFinite(amountSp) ? amountSp : fixture.requestedAmountSp || 0,
        reason,
        balances: cloneJson(ledger.balances),
        spentAtIso: null,
        idempotencyKey,
        unlockGrant: null,
      };
      spendEvents.set(idempotencyKey, response);
      return cloneJson(response);
    }

    if (amountSp > Number(ledger.balances.sp || 0)) {
      const response = {
        ...fixture,
        accepted: false,
        reasonCode: 'insufficient_sp',
        userId,
        amountSp: 0,
        requestedAmountSp: amountSp,
        reason,
        balances: cloneJson(ledger.balances),
        spentAtIso: null,
        idempotencyKey,
        unlockGrant: null,
      };
      spendEvents.set(idempotencyKey, response);
      return cloneJson(response);
    }

    ledger.balances.sp -= amountSp;
    const unlockGrant = unlockKey
      ? grantUnlock({
          userId,
          unlockKey,
          grantSource: typeof body.grantSource === 'string' && body.grantSource.trim()
            ? body.grantSource.trim()
            : 'wallet_spend',
          idempotencyKey: typeof body.unlockIdempotencyKey === 'string' && body.unlockIdempotencyKey.trim()
            ? body.unlockIdempotencyKey.trim()
            : `${unlockKey}:${userId}`,
          metadata: normalizeMetadata(body.metadata),
        })
      : null;

    const response = {
      ...fixture,
      accepted: true,
      spendId: buildSpendId(idempotencyKey),
      userId,
      amountSp,
      requestedAmountSp: amountSp,
      reason,
      balances: cloneJson(ledger.balances),
      spentAtIso: nowIso(),
      idempotencyKey,
      unlockGrant,
    };

    spendEvents.set(idempotencyKey, response);
    return cloneJson(response);
  }

  return {
    getEntitlements,
    grantUnlock,
    recordPurchaseEvent,
    spend,
  };
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { createDemoCommerceApi } = await import('../../../../packages/contracts/demo-commerce.mjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(filename) {
  const fixturePath = path.resolve(__dirname, '../../../../packages/contracts/fixtures', filename);
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function createCommerceApi() {
  return createDemoCommerceApi({
    entitlements: loadFixture('commerce.entitlements.sample.json'),
    purchaseEvent: loadFixture('commerce.purchase-event.sample.json'),
    spend: loadFixture('commerce.spend.sample.json'),
    unlockGrant: loadFixture('commerce.unlock-grant.sample.json'),
  });
}

describe('demo commerce ledger', () => {
  it('seeds balances from the entitlements fixture', () => {
    const commerceApi = createCommerceApi();
    const entitlements = commerceApi.getEntitlements('demo-user-1');

    assert.equal(entitlements.userId, 'demo-user-1');
    assert.equal(entitlements.balances.sp, 160);
    assert.ok(Array.isArray(entitlements.entitlements));
    assert.ok(entitlements.entitlements.length >= 1);
  });

  it('spends SP once and grants a webtoon unlock entitlement', () => {
    const commerceApi = createCommerceApi();
    const response = commerceApi.spend({
      userId: 'demo-user-1',
      amountSp: 5,
      reason: 'webtoon_unlock',
      idempotencyKey: 'webtoon_unlock:unlock.webtoon.shanghai_h1.ayi_02:demo-user-1:5',
      unlockKey: 'unlock.webtoon.shanghai_h1.ayi_02',
      metadata: {
        sceneId: 'shanghai-h1',
        bubbleId: 'ayi_02',
      },
    });

    assert.equal(response.accepted, true);
    assert.equal(response.amountSp, 5);
    assert.equal(response.balances.sp, 155);
    assert.equal(response.unlockGrant?.status, 'granted');

    const duplicate = commerceApi.spend({
      userId: 'demo-user-1',
      amountSp: 5,
      reason: 'webtoon_unlock',
      idempotencyKey: 'webtoon_unlock:unlock.webtoon.shanghai_h1.ayi_02:demo-user-1:5',
      unlockKey: 'unlock.webtoon.shanghai_h1.ayi_02',
    });
    assert.equal(duplicate.balances.sp, 155);

    const entitlements = commerceApi.getEntitlements('demo-user-1');
    assert.equal(
      entitlements.entitlements.some((entitlement) => entitlement.productKey === 'unlock.webtoon.shanghai_h1.ayi_02'),
      true,
    );
  });

  it('dedupes demo purchase events and can grant a scene game pass entitlement', () => {
    const commerceApi = createCommerceApi();
    const purchase = commerceApi.recordPurchaseEvent({
      provider: 'stripe',
      providerEventId: 'evt_demo_game_pass_shanghai_h1',
      eventType: 'checkout.session.completed',
      userId: 'demo-user-1',
      occurredAtIso: '2026-04-22T08:00:00.000Z',
      amount: { currency: 'usd', subtotal: 0, total: 0 },
      metadata: { sceneId: 'shanghai-h1', demoMode: true },
      payloadHash: 'sha256:evt_demo_game_pass_shanghai_h1',
    });
    const duplicate = commerceApi.recordPurchaseEvent({
      provider: 'stripe',
      providerEventId: 'evt_demo_game_pass_shanghai_h1',
      userId: 'demo-user-1',
    });

    assert.equal(purchase.status, 'recorded');
    assert.equal(duplicate.status, 'duplicate');

    const grant = commerceApi.grantUnlock({
      userId: 'demo-user-1',
      unlockKey: 'unlock.game_pass.shanghai_h1',
      grantSource: 'purchase_event',
      purchaseEventId: purchase.recordId,
      idempotencyKey: 'unlock.game_pass.shanghai_h1:demo-user-1',
      metadata: { sceneId: 'shanghai-h1', demoMode: true },
    });

    assert.equal(grant.status, 'granted');
    const entitlements = commerceApi.getEntitlements('demo-user-1');
    assert.equal(
      entitlements.entitlements.some((entitlement) => entitlement.productKey === 'unlock.game_pass.shanghai_h1'),
      true,
    );
  });
});

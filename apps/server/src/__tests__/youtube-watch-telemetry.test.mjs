import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { __testing } from '../index.mjs';

const userId = 'issue-103-user';

const buildPayload = ({ eventId, activeWatchMs, completionRatio, capturedAtIso }) => ({
  consent: {
    enabled: true,
    grantedAtIso: '2026-04-18T06:00:00.000Z',
    policyVersion: 'youtube-watch-telemetry-v1',
    retentionDays: 30,
  },
  events: [
    {
      eventId,
      sessionId: 'session-1',
      videoId: 'abc123def45',
      videoUrl: 'https://www.youtube.com/watch?v=abc123def45',
      title: 'Integration test clip',
      lang: 'ko',
      subtitleTrack: 'ko',
      sessionStartedAtIso: '2026-04-18T06:00:00.000Z',
      sessionEndedAtIso: capturedAtIso,
      activeWatchMs,
      completionRatio,
      eventCapturedAtIso: capturedAtIso,
    },
  ],
});

describe('YouTube watch telemetry ingestion', () => {
  beforeEach(() => {
    __testing.resetState();
  });

  it('upserts newer snapshots for the same session and feeds downstream ingestion', () => {
    const initial = __testing.ingestYouTubeWatchTelemetry(
      userId,
      buildPayload({
        eventId: 'event-1',
        activeWatchMs: 65_000,
        completionRatio: 0.2,
        capturedAtIso: '2026-04-18T06:01:05.000Z',
      }),
    );

    assert.equal(initial.acceptedEvents, 1);
    assert.equal(initial.retainedEvents, 1);
    assert.equal(__testing.state.youtubeTelemetryByUser.get(userId).events.length, 1);

    const updated = __testing.ingestYouTubeWatchTelemetry(
      userId,
      buildPayload({
        eventId: 'event-2',
        activeWatchMs: 180_000,
        completionRatio: 0.75,
        capturedAtIso: '2026-04-18T06:03:00.000Z',
      }),
    );

    assert.equal(updated.acceptedEvents, 1);
    assert.equal(updated.dedupedEvents, 0);
    assert.equal(updated.retainedEvents, 1);

    const storedEvents = __testing.state.youtubeTelemetryByUser.get(userId).events;
    assert.equal(storedEvents.length, 1);
    assert.equal(storedEvents[0].eventId, 'event-2');
    assert.equal(storedEvents[0].activeWatchMs, 180_000);
    assert.equal(storedEvents[0].completionRatio, 0.75);

    const ingestion = __testing.runIngestionForUser(userId, { includeSources: ['youtube'] });
    const topMedia = ingestion.mediaProfile.sourceBreakdown.youtube.topMedia.find(
      (item) => item.mediaId === 'abc123def45',
    );

    assert.ok(topMedia);
    assert.equal(topMedia.minutes, 3);
    assert.equal(
      ingestion.mediaProfile.sourceBreakdown.youtube.topMedia.filter((item) => item.mediaId === 'abc123def45').length,
      1,
    );
    assert.ok(ingestion.mediaProfile.sourceBreakdown.youtube.itemsConsumed >= 1);
    assert.equal(ingestion.mediaProfile.sourceBreakdown.spotify.itemsConsumed, 0);
  });
});

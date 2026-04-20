export const PLAYTEST_FINDING_ROUTE_STATUSES = [
  'unrouted',
  'skip',
  'update_issue',
  'new_issue',
  'direct_pr',
  'human_review',
  'done',
] as const;

export const PLAYTEST_FINDING_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;

export type PlaytestFindingRouteStatus = (typeof PLAYTEST_FINDING_ROUTE_STATUSES)[number];
export type PlaytestFindingSeverity = (typeof PLAYTEST_FINDING_SEVERITIES)[number];

export type ArtifactLink = {
  href: string;
  label: string;
  source: string;
};

export type ManualOverrideState = {
  active: boolean;
  status: PlaytestFindingRouteStatus | null;
  reason: string | null;
  confidence: number | null;
  actor: string | null;
  note: string | null;
  updatedAt: string;
};

export type FindingHistoryEvent = {
  type: string;
  at: string;
  actor: string | null;
  data: Record<string, unknown>;
};

type RouteState = {
  status: PlaytestFindingRouteStatus;
  reason: string | null;
  confidence: number | null;
};

type LinkedRefs = {
  issueRefs: string[];
  prRefs: string[];
};

type FindingRecord = {
  findingId: string;
  fingerprint: string;
  sessionId: string;
  analysisId: string | null;
  observedAtText: string | null;
  observedAtMs: number | null;
  observedAtIso: string | null;
  category: string;
  severity: PlaytestFindingSeverity;
  summary: string;
  description: string | null;
  suggestedFix: string | null;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  artifactLinks: ArtifactLink[];
  inferredComponent: string | null;
  routeState: RouteState;
  linkedRefs: LinkedRefs;
  manualOverride: ManualOverrideState | null;
  history: FindingHistoryEvent[];
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

type SqlResult = {
  changes: number;
};

export type SqlExecutor = {
  get<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> | T | null;
  all<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> | T[];
  run(sql: string, params?: unknown[]): Promise<SqlResult> | SqlResult;
};

type UpsertArgs = {
  analysisData: Record<string, any>;
  analysisId: string | null;
  publicBase: string;
  sessionId: string;
};

type UpsertResult = {
  deduped: number;
  findingIds: string[];
  inserted: number;
};

function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map((value) => sanitizeString(value)).filter(Boolean))];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clampConfidence(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeSeverity(value: unknown): PlaytestFindingSeverity {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 5) return 'critical';
    if (value >= 4) return 'high';
    if (value >= 3) return 'medium';
    return 'low';
  }

  const text = sanitizeString(value).toLowerCase();
  if ((PLAYTEST_FINDING_SEVERITIES as readonly string[]).includes(text)) {
    return text as PlaytestFindingSeverity;
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    return normalizeSeverity(numeric);
  }

  return 'medium';
}

export function isValidRouteStatus(value: unknown): value is PlaytestFindingRouteStatus {
  return typeof value === 'string' && (PLAYTEST_FINDING_ROUTE_STATUSES as readonly string[]).includes(value);
}

function normalizeRouteStatus(value: unknown, fallback: PlaytestFindingRouteStatus = 'unrouted'): PlaytestFindingRouteStatus {
  return isValidRouteStatus(value) ? value : fallback;
}

function normalizeIsoTimestamp(value: unknown): string | null {
  const text = sanitizeString(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function parseTimestampTextToMs(value: string): number | null {
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) {
    return null;
  }
  const parts = value.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  if (parts.length === 2) {
    return ((parts[0] * 60) + parts[1]) * 1000;
  }
  return (((parts[0] * 60 * 60) + (parts[1] * 60) + parts[2]) * 1000);
}

function normalizeObservedAt(rawFinding: Record<string, unknown>): {
  observedAtIso: string | null;
  observedAtMs: number | null;
  observedAtText: string | null;
} {
  const textCandidate =
    sanitizeString(rawFinding.timestampText)
    || sanitizeString(rawFinding.timestamp)
    || sanitizeString(rawFinding.observedAtText)
    || sanitizeString(rawFinding.observedAt);

  if (textCandidate) {
    const parsedMs = parseTimestampTextToMs(textCandidate);
    if (parsedMs !== null) {
      return {
        observedAtIso: null,
        observedAtMs: parsedMs,
        observedAtText: textCandidate,
      };
    }

    const parsedIso = normalizeIsoTimestamp(textCandidate);
    if (parsedIso) {
      return {
        observedAtIso: parsedIso,
        observedAtMs: null,
        observedAtText: textCandidate,
      };
    }
  }

  const msCandidate = Number(rawFinding.timestampMs ?? rawFinding.startMs ?? rawFinding.observedAtMs);
  return {
    observedAtIso: normalizeIsoTimestamp(rawFinding.timestampIso ?? rawFinding.detectedAt ?? rawFinding.observedAtIso),
    observedAtMs: Number.isFinite(msCandidate) ? msCandidate : null,
    observedAtText: textCandidate || null,
  };
}

function sanitizeComponent(value: unknown): string | null {
  const component = sanitizeString(value, 200);
  return component || null;
}

function buildFallbackArtifactLinks(publicBase: string, sessionId: string, analysisId: string | null): ArtifactLink[] {
  const analysisPath = analysisId ? `playtest/${sessionId}/analysis.json` : '';
  return [
    {
      href: `${publicBase}/playtest/${sessionId}/recording.webm`,
      label: 'recording',
      source: 'playtest-session',
    },
    {
      href: `${publicBase}/playtest/${sessionId}/annotations.json`,
      label: 'annotations',
      source: 'playtest-session',
    },
    {
      href: `${publicBase}/${analysisPath || `playtest/${sessionId}/analysis.json`}`,
      label: 'analysis',
      source: 'playtest-session',
    },
  ];
}

function normalizeArtifactLinks(values: unknown, fallbackLinks: ArtifactLink[]): ArtifactLink[] {
  const links: ArtifactLink[] = [];
  const seen = new Set<string>();
  const sourceValues = Array.isArray(values) ? values : [];

  const pushLink = (hrefValue: unknown, labelValue: unknown, sourceValue: unknown) => {
    const href = sanitizeString(hrefValue, 1000);
    if (!/^https?:\/\//i.test(href) || seen.has(href)) {
      return;
    }
    seen.add(href);
    links.push({
      href,
      label: sanitizeString(labelValue, 100) || 'artifact',
      source: sanitizeString(sourceValue, 100) || 'analysis',
    });
  };

  for (const item of sourceValues) {
    if (typeof item === 'string') {
      pushLink(item, 'artifact', 'analysis');
      continue;
    }
    if (isObject(item)) {
      pushLink(item.href ?? item.url, item.label, item.source);
    }
  }

  for (const fallback of fallbackLinks) {
    pushLink(fallback.href, fallback.label, fallback.source);
  }

  return links;
}

function normalizeCategory(rawFinding: Record<string, unknown>): string {
  return (
    sanitizeString(rawFinding.category)
    || sanitizeString(rawFinding.issueType)
    || sanitizeString(rawFinding.type)
    || 'uncategorized'
  ).toLowerCase();
}

function normalizeSummary(rawFinding: Record<string, unknown>): string {
  return (
    sanitizeString(rawFinding.summary)
    || sanitizeString(rawFinding.description)
    || sanitizeString(rawFinding.title)
    || sanitizeString(rawFinding.issue)
    || sanitizeString(rawFinding.correctedVersion)
    || 'Unnamed finding'
  ).slice(0, 500);
}

function buildFingerprint(parts: Array<string | number | null>): string {
  const canonical = parts.map((part) => String(part ?? '')).join('|').toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ptf_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function extractAnalysisFindings(analysisData: Record<string, any>): Record<string, any>[] {
  const candidates = [
    analysisData.findings,
    analysisData.issues,
    analysisData.result?.findings,
    analysisData.result?.issues,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const normalized = candidate.filter((value) => isObject(value)) as Record<string, any>[];
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return [];
}

export function normalizeFindingListLimit(rawValue: string | null, fallback = 50, max = 200): number {
  if (rawValue === null || rawValue.trim() === '') {
    return fallback;
  }
  const numeric = Number(rawValue);
  const safeValue = Number.isFinite(numeric) ? numeric : fallback;
  return Math.min(max, Math.max(1, Math.trunc(safeValue)));
}

function normalizeIncomingFinding(args: {
  analysisId: string | null;
  fallbackLinks: ArtifactLink[];
  finding: Record<string, any>;
  sessionId: string;
}): Omit<FindingRecord, 'createdAt' | 'firstSeenAt' | 'findingId' | 'history' | 'lastSeenAt' | 'linkedRefs' | 'manualOverride' | 'routeState' | 'updatedAt'> {
  const observedAt = normalizeObservedAt(args.finding);
  const category = normalizeCategory(args.finding);
  const severity = normalizeSeverity(args.finding.severity ?? args.finding.priority);
  const summary = normalizeSummary(args.finding);
  const inferredComponent = sanitizeComponent(
    args.finding.affectedComponent
    ?? args.finding.inferredComponent
    ?? args.finding.component
    ?? args.finding.path,
  );

  return {
    analysisId: args.analysisId,
    artifactLinks: normalizeArtifactLinks(args.finding.artifactLinks, args.fallbackLinks),
    actualBehavior: sanitizeString(args.finding.whatActuallyHappened, 1000) || null,
    category,
    description: sanitizeString(args.finding.description ?? args.finding.summary, 1000) || null,
    expectedBehavior: sanitizeString(args.finding.whatUserExpected, 1000) || null,
    fingerprint: buildFingerprint([
      args.sessionId,
      observedAt.observedAtMs,
      observedAt.observedAtText,
      observedAt.observedAtIso,
      category,
      severity,
      summary,
      inferredComponent,
    ]),
    inferredComponent,
    observedAtIso: observedAt.observedAtIso,
    observedAtMs: observedAt.observedAtMs,
    observedAtText: observedAt.observedAtText,
    sessionId: args.sessionId,
    severity,
    suggestedFix: sanitizeString(args.finding.suggestedFix ?? args.finding.correctedVersion, 1000) || null,
    summary,
  };
}

function buildHistoryEvent(type: string, actor: string | null, data: Record<string, unknown>): FindingHistoryEvent {
  return {
    type,
    at: new Date().toISOString(),
    actor,
    data,
  };
}

function parseLinkedRefs(row: Record<string, unknown>): LinkedRefs {
  return {
    issueRefs: uniqueStrings(safeJsonParse<unknown[]>((row.linked_issue_refs_json ?? row.linked_issue_refs) as string, [])),
    prRefs: uniqueStrings(safeJsonParse<unknown[]>((row.linked_pr_refs_json ?? row.linked_pr_refs) as string, [])),
  };
}

function parseManualOverride(row: Record<string, unknown>): ManualOverrideState | null {
  const override = safeJsonParse<Record<string, unknown> | null>(row.manual_override_json, null);
  if (!override || !isObject(override)) {
    return null;
  }
  return {
    active: Boolean(override.active),
    actor: sanitizeString(override.actor, 120) || null,
    confidence: clampConfidence(override.confidence),
    note: sanitizeString(override.note, 1000) || null,
    reason: sanitizeString(override.reason, 500) || null,
    status: isValidRouteStatus(override.status) ? override.status : null,
    updatedAt: sanitizeString(override.updatedAt, 100) || new Date().toISOString(),
  };
}

function parseHistory(row: Record<string, unknown>): FindingHistoryEvent[] {
  const history = safeJsonParse<unknown[]>(row.history_json, []);
  return history.filter((item) => isObject(item)).map((item) => ({
    type: sanitizeString(item.type, 80) || 'unknown',
    at: sanitizeString(item.at, 100) || new Date().toISOString(),
    actor: sanitizeString(item.actor, 120) || null,
    data: isObject(item.data) ? item.data : {},
  }));
}

function hydrateFindingRecord(row: Record<string, unknown>): FindingRecord {
  return {
    findingId: sanitizeString(row.finding_id, 120),
    fingerprint: sanitizeString(row.fingerprint, 120),
    sessionId: sanitizeString(row.session_id, 120),
    analysisId: sanitizeString(row.analysis_id, 120) || null,
    observedAtText: sanitizeString(row.observed_at_text, 120) || null,
    observedAtMs: Number.isFinite(Number(row.observed_at_ms)) ? Number(row.observed_at_ms) : null,
    observedAtIso: sanitizeString(row.observed_at_iso, 100) || null,
    category: sanitizeString(row.category, 120) || 'uncategorized',
    severity: normalizeSeverity(row.severity),
    summary: sanitizeString(row.summary, 500) || 'Unnamed finding',
    description: sanitizeString(row.description, 1000) || null,
    suggestedFix: sanitizeString(row.suggested_fix, 1000) || null,
    expectedBehavior: sanitizeString(row.expected_behavior, 1000) || null,
    actualBehavior: sanitizeString(row.actual_behavior, 1000) || null,
    artifactLinks: normalizeArtifactLinks(safeJsonParse<unknown[]>(row.artifact_links_json, []), []),
    inferredComponent: sanitizeString(row.inferred_component, 200) || null,
    routeState: {
      status: normalizeRouteStatus(row.route_status),
      reason: sanitizeString(row.route_reason, 500) || null,
      confidence: clampConfidence(row.route_confidence),
    },
    linkedRefs: parseLinkedRefs(row),
    manualOverride: parseManualOverride(row),
    history: parseHistory(row),
    firstSeenAt: sanitizeString(row.first_seen_at, 100) || '',
    lastSeenAt: sanitizeString(row.last_seen_at, 100) || '',
    createdAt: sanitizeString(row.created_at, 100) || '',
    updatedAt: sanitizeString(row.updated_at, 100) || '',
  };
}

async function getFindingRowById(sql: SqlExecutor, findingId: string): Promise<Record<string, unknown> | null> {
  return await sql.get<Record<string, unknown>>(
    `SELECT * FROM playtest_findings_ledger WHERE finding_id = ?`,
    [findingId],
  );
}

async function writeFindingUpdate(sql: SqlExecutor, record: FindingRecord): Promise<FindingRecord> {
  await sql.run(
    `UPDATE playtest_findings_ledger
     SET analysis_id = ?,
         observed_at_text = ?,
         observed_at_ms = ?,
         observed_at_iso = ?,
         category = ?,
         severity = ?,
         summary = ?,
         description = ?,
         suggested_fix = ?,
         expected_behavior = ?,
         actual_behavior = ?,
         artifact_links_json = ?,
         inferred_component = ?,
         route_status = ?,
         route_reason = ?,
         route_confidence = ?,
         linked_issue_refs_json = ?,
         linked_pr_refs_json = ?,
         manual_override_json = ?,
         history_json = ?,
         first_seen_at = ?,
         last_seen_at = ?,
         updated_at = ?
     WHERE finding_id = ?`,
    [
      record.analysisId,
      record.observedAtText,
      record.observedAtMs,
      record.observedAtIso,
      record.category,
      record.severity,
      record.summary,
      record.description,
      record.suggestedFix,
      record.expectedBehavior,
      record.actualBehavior,
      JSON.stringify(record.artifactLinks),
      record.inferredComponent,
      record.routeState.status,
      record.routeState.reason,
      record.routeState.confidence,
      JSON.stringify(record.linkedRefs.issueRefs),
      JSON.stringify(record.linkedRefs.prRefs),
      record.manualOverride ? JSON.stringify(record.manualOverride) : null,
      JSON.stringify(record.history),
      record.firstSeenAt,
      record.lastSeenAt,
      record.updatedAt,
      record.findingId,
    ],
  );

  const row = await getFindingRowById(sql, record.findingId);
  if (!row) {
    throw new Error(`finding ${record.findingId} disappeared during update`);
  }
  return hydrateFindingRecord(row);
}

export async function upsertFindingLedgerEntries(sql: SqlExecutor, args: UpsertArgs): Promise<UpsertResult | null> {
  const rawFindings = extractAnalysisFindings(args.analysisData);
  if (rawFindings.length === 0) {
    return null;
  }

  const fallbackLinks = buildFallbackArtifactLinks(args.publicBase, args.sessionId, args.analysisId);
  let inserted = 0;
  let deduped = 0;
  const findingIds: string[] = [];

  for (const rawFinding of rawFindings) {
    const incoming = normalizeIncomingFinding({
      analysisId: args.analysisId,
      fallbackLinks,
      finding: rawFinding,
      sessionId: args.sessionId,
    });
    const nowIso = new Date().toISOString();
    const existingRow = await sql.get<Record<string, unknown>>(
      `SELECT * FROM playtest_findings_ledger WHERE fingerprint = ?`,
      [incoming.fingerprint],
    );

    if (existingRow) {
      deduped += 1;
      const existing = hydrateFindingRecord(existingRow);
      const mergedHistory = [...existing.history];
      if (
        existing.analysisId !== incoming.analysisId
        || existing.summary !== incoming.summary
        || existing.description !== incoming.description
      ) {
        mergedHistory.push(buildHistoryEvent('reingested', null, {
          analysisId: incoming.analysisId,
          summary: incoming.summary,
        }));
      }

      const updated = await writeFindingUpdate(sql, {
        ...existing,
        analysisId: incoming.analysisId,
        observedAtText: incoming.observedAtText,
        observedAtMs: incoming.observedAtMs,
        observedAtIso: incoming.observedAtIso,
        category: incoming.category,
        severity: incoming.severity,
        summary: incoming.summary,
        description: incoming.description,
        suggestedFix: incoming.suggestedFix,
        expectedBehavior: incoming.expectedBehavior,
        actualBehavior: incoming.actualBehavior,
        artifactLinks: normalizeArtifactLinks(
          [...existing.artifactLinks, ...incoming.artifactLinks],
          [],
        ),
        inferredComponent: incoming.inferredComponent,
        history: mergedHistory,
        lastSeenAt: nowIso,
        updatedAt: nowIso,
      });
      findingIds.push(updated.findingId);
      continue;
    }

    inserted += 1;
    const findingId = `finding_${crypto.randomUUID()}`;
    const history = [
      buildHistoryEvent('ingested', null, {
        analysisId: incoming.analysisId,
        summary: incoming.summary,
      }),
    ];

    await sql.run(
      `INSERT INTO playtest_findings_ledger (
         finding_id, fingerprint, session_id, analysis_id,
         observed_at_text, observed_at_ms, observed_at_iso,
         category, severity, summary, description, suggested_fix,
         expected_behavior, actual_behavior, artifact_links_json,
         inferred_component, route_status, route_reason, route_confidence,
         linked_issue_refs_json, linked_pr_refs_json, manual_override_json,
         history_json, first_seen_at, last_seen_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unrouted', NULL, NULL, '[]', '[]', NULL, ?, ?, ?, ?, ?)`,
      [
        findingId,
        incoming.fingerprint,
        incoming.sessionId,
        incoming.analysisId,
        incoming.observedAtText,
        incoming.observedAtMs,
        incoming.observedAtIso,
        incoming.category,
        incoming.severity,
        incoming.summary,
        incoming.description,
        incoming.suggestedFix,
        incoming.expectedBehavior,
        incoming.actualBehavior,
        JSON.stringify(incoming.artifactLinks),
        incoming.inferredComponent,
        JSON.stringify(history),
        nowIso,
        nowIso,
        nowIso,
        nowIso,
      ],
    );
    findingIds.push(findingId);
  }

  return { deduped, findingIds, inserted };
}

export async function listUnroutedFindings(sql: SqlExecutor, limit = 50): Promise<FindingRecord[]> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const rows = await sql.all<Record<string, unknown>>(
    `SELECT * FROM playtest_findings_ledger
     WHERE route_status = 'unrouted'
     ORDER BY updated_at DESC
     LIMIT ?`,
    [safeLimit],
  );
  return rows.map(hydrateFindingRecord);
}

export async function updateFindingRoute(
  sql: SqlExecutor,
  findingId: string,
  args: { actor?: unknown; confidence?: unknown; reason?: unknown; status?: unknown; },
): Promise<FindingRecord | null> {
  const row = await getFindingRowById(sql, findingId);
  if (!row) {
    return null;
  }
  const existing = hydrateFindingRecord(row);
  const nowIso = new Date().toISOString();
  const nextStatus = normalizeRouteStatus(args.status, existing.routeState.status);
  const nextReason = sanitizeString(args.reason, 500) || null;
  const nextConfidence = clampConfidence(args.confidence);
  return writeFindingUpdate(sql, {
    ...existing,
    history: [
      ...existing.history,
      buildHistoryEvent('route_updated', sanitizeString(args.actor, 120) || null, {
        confidence: nextConfidence,
        reason: nextReason,
        status: nextStatus,
      }),
    ],
    routeState: {
      status: nextStatus,
      reason: nextReason,
      confidence: nextConfidence,
    },
    updatedAt: nowIso,
  });
}

export async function attachFindingRefs(
  sql: SqlExecutor,
  findingId: string,
  args: { actor?: unknown; issueRefs?: unknown; prRefs?: unknown; },
): Promise<FindingRecord | null> {
  const row = await getFindingRowById(sql, findingId);
  if (!row) {
    return null;
  }
  const existing = hydrateFindingRecord(row);
  const linkedRefs = {
    issueRefs: uniqueStrings([...existing.linkedRefs.issueRefs, ...((args.issueRefs as unknown[]) || [])]),
    prRefs: uniqueStrings([...existing.linkedRefs.prRefs, ...((args.prRefs as unknown[]) || [])]),
  };

  return writeFindingUpdate(sql, {
    ...existing,
    history: [
      ...existing.history,
      buildHistoryEvent('refs_attached', sanitizeString(args.actor, 120) || null, linkedRefs),
    ],
    linkedRefs,
    updatedAt: new Date().toISOString(),
  });
}

export async function retryFinding(
  sql: SqlExecutor,
  findingId: string,
  actor?: unknown,
): Promise<FindingRecord | null> {
  const row = await getFindingRowById(sql, findingId);
  if (!row) {
    return null;
  }
  const existing = hydrateFindingRecord(row);
  return writeFindingUpdate(sql, {
    ...existing,
    history: [
      ...existing.history,
      buildHistoryEvent('retry_requested', sanitizeString(actor, 120) || null, {}),
    ],
    routeState: {
      status: 'unrouted',
      reason: 'retry_requested',
      confidence: null,
    },
    updatedAt: new Date().toISOString(),
  });
}

export async function reopenFinding(
  sql: SqlExecutor,
  findingId: string,
  args: { actor?: unknown; reason?: unknown; },
): Promise<FindingRecord | null> {
  const row = await getFindingRowById(sql, findingId);
  if (!row) {
    return null;
  }
  const existing = hydrateFindingRecord(row);
  const reason = sanitizeString(args.reason, 500) || 'reopened_for_followup';
  return writeFindingUpdate(sql, {
    ...existing,
    history: [
      ...existing.history,
      buildHistoryEvent('reopened', sanitizeString(args.actor, 120) || null, { reason }),
    ],
    routeState: {
      status: 'unrouted',
      reason,
      confidence: null,
    },
    updatedAt: new Date().toISOString(),
  });
}

export async function setFindingManualOverride(
  sql: SqlExecutor,
  findingId: string,
  args: {
    active?: unknown;
    actor?: unknown;
    confidence?: unknown;
    note?: unknown;
    reason?: unknown;
    status?: unknown;
  },
): Promise<FindingRecord | null> {
  const row = await getFindingRowById(sql, findingId);
  if (!row) {
    return null;
  }
  const existing = hydrateFindingRecord(row);
  const active = Boolean(args.active);
  const nextStatus = isValidRouteStatus(args.status) ? args.status : existing.routeState.status;
  const nextOverride: ManualOverrideState = {
    active,
    actor: sanitizeString(args.actor, 120) || null,
    confidence: clampConfidence(args.confidence),
    note: sanitizeString(args.note, 1000) || null,
    reason: sanitizeString(args.reason, 500) || null,
    status: active ? nextStatus : null,
    updatedAt: new Date().toISOString(),
  };

  return writeFindingUpdate(sql, {
    ...existing,
    history: [
      ...existing.history,
      buildHistoryEvent('manual_override_updated', nextOverride.actor, nextOverride as unknown as Record<string, unknown>),
    ],
    manualOverride: nextOverride,
    routeState: active
      ? {
        status: nextStatus,
        reason: nextOverride.reason,
        confidence: nextOverride.confidence,
      }
      : existing.routeState,
    updatedAt: new Date().toISOString(),
  });
}

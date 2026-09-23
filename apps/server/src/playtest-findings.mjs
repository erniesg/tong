import crypto from 'node:crypto';

const ROUTE_STATUSES = new Set([
  'unrouted',
  'skip',
  'update_issue',
  'new_issue',
  'direct_pr',
  'human_review',
  'done',
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

function slugify(value) {
  return normalizeString(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function buildFingerprintKey(sessionId, finding) {
  const stableFields = [
    sessionId,
    slugify(finding.category),
    slugify(finding.severity),
    slugify(finding.affectedComponent),
    normalizeString(finding.description).toLowerCase(),
    normalizeString(finding.whatUserExpected).toLowerCase(),
    normalizeString(finding.whatActuallyHappened).toLowerCase(),
  ];
  const raw = stableFields.join('|');
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  return {
    dedupeKey: digest,
    findingId: `pf_${digest.slice(0, 16)}`,
  };
}

function normalizeArtifactLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => {
      if (typeof link === 'string') {
        const href = link.trim();
        return href ? { href } : null;
      }
      if (!link || typeof link !== 'object') return null;
      const href = normalizeString(link.href || link.url);
      if (!href) return null;
      return {
        href,
        label: normalizeString(link.label) || undefined,
        type: normalizeString(link.type) || undefined,
      };
    })
    .filter(Boolean);
}

export function normalizeRawFinding(raw) {
  const finding = raw && typeof raw === 'object' ? raw : {};
  return {
    category: normalizeString(finding.category) || 'unknown',
    severity: normalizeString(finding.severity) || 'unknown',
    description: normalizeString(finding.description) || 'No description provided.',
    whatUserExpected: normalizeString(finding.whatUserExpected) || undefined,
    whatActuallyHappened: normalizeString(finding.whatActuallyHappened) || undefined,
    suggestedFix: normalizeString(finding.suggestedFix) || undefined,
    affectedComponent: normalizeString(finding.affectedComponent) || undefined,
    inferredComponent: normalizeString(finding.inferredComponent || finding.affectedComponent) || undefined,
    confidence: toConfidence(finding.confidence),
    artifactLinks: normalizeArtifactLinks(finding.artifactLinks || finding.artifacts || []),
  };
}

function appendAuditEvent(record, event) {
  const auditEvent = {
    at: nowIso(),
    ...event,
  };
  record.auditTrail = Array.isArray(record.auditTrail) ? record.auditTrail : [];
  record.auditTrail.push(auditEvent);
}

export function ingestPlaytestFindings({ findingsMap, sessionId, findings, analysisId = null }) {
  const cleanSessionId = normalizeString(sessionId);
  if (!cleanSessionId) {
    throw new Error('sessionId_required');
  }
  if (!Array.isArray(findings) || findings.length === 0) {
    throw new Error('findings_required');
  }

  let created = 0;
  let updated = 0;
  const records = [];

  for (const rawFinding of findings) {
    const normalized = normalizeRawFinding(rawFinding);
    const { dedupeKey, findingId } = buildFingerprintKey(cleanSessionId, normalized);

    const existing = findingsMap.get(findingId);
    if (existing) {
      existing.lastSeenAt = nowIso();
      existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      existing.category = normalized.category;
      existing.severity = normalized.severity;
      existing.description = normalized.description;
      existing.whatUserExpected = normalized.whatUserExpected;
      existing.whatActuallyHappened = normalized.whatActuallyHappened;
      existing.suggestedFix = normalized.suggestedFix;
      existing.inferredComponent = normalized.inferredComponent;
      existing.artifactLinks = normalized.artifactLinks;
      if (analysisId) existing.analysisIds = [...new Set([...(existing.analysisIds || []), analysisId])];
      appendAuditEvent(existing, {
        type: 'finding.reobserved',
        dedupeKey,
        sessionId: cleanSessionId,
      });
      findingsMap.set(findingId, existing);
      updated += 1;
      records.push(existing);
      continue;
    }

    const createdAt = nowIso();
    const record = {
      findingId,
      dedupeKey,
      sessionId: cleanSessionId,
      createdAt,
      updatedAt: createdAt,
      firstSeenAt: createdAt,
      lastSeenAt: createdAt,
      category: normalized.category,
      severity: normalized.severity,
      description: normalized.description,
      whatUserExpected: normalized.whatUserExpected,
      whatActuallyHappened: normalized.whatActuallyHappened,
      suggestedFix: normalized.suggestedFix,
      inferredComponent: normalized.inferredComponent,
      artifactLinks: normalized.artifactLinks,
      routeStatus: 'unrouted',
      routeReason: null,
      routeConfidence: normalized.confidence,
      githubIssueRef: null,
      githubPrRef: null,
      humanOverride: null,
      occurrenceCount: 1,
      analysisIds: analysisId ? [analysisId] : [],
      auditTrail: [
        {
          at: createdAt,
          type: 'finding.created',
          sessionId: cleanSessionId,
          dedupeKey,
        },
      ],
    };

    findingsMap.set(findingId, record);
    created += 1;
    records.push(record);
  }

  return {
    sessionId: cleanSessionId,
    analysisId,
    created,
    updated,
    total: records.length,
    findings: records,
  };
}

export function listPlaytestFindings({ findingsMap, routeStatus = null, sessionId = null }) {
  const byRoute = normalizeString(routeStatus);
  const bySession = normalizeString(sessionId);
  return [...findingsMap.values()]
    .filter((item) => (!byRoute || item.routeStatus === byRoute) && (!bySession || item.sessionId === bySession))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

function getRequiredFinding(findingsMap, findingId) {
  const record = findingsMap.get(findingId);
  if (!record) {
    const error = new Error('finding_not_found');
    error.code = 'finding_not_found';
    throw error;
  }
  return record;
}

export function updateFindingRoute({ findingsMap, findingId, routeStatus, reason = '', confidence = null, actor = '' }) {
  const status = normalizeString(routeStatus);
  if (!ROUTE_STATUSES.has(status)) {
    throw new Error('invalid_route_status');
  }
  const record = getRequiredFinding(findingsMap, findingId);
  record.routeStatus = status;
  record.routeReason = normalizeString(reason) || null;
  record.routeConfidence = toConfidence(confidence);
  record.updatedAt = nowIso();
  appendAuditEvent(record, {
    type: 'route.updated',
    routeStatus: status,
    reason: record.routeReason,
    confidence: record.routeConfidence,
    actor: normalizeString(actor) || undefined,
  });
  findingsMap.set(findingId, record);
  return record;
}

export function linkFindingGithubRefs({ findingsMap, findingId, issueRef = null, prRef = null, actor = '' }) {
  const record = getRequiredFinding(findingsMap, findingId);
  const nextIssueRef = normalizeString(issueRef) || null;
  const nextPrRef = normalizeString(prRef) || null;
  record.githubIssueRef = nextIssueRef;
  record.githubPrRef = nextPrRef;
  record.updatedAt = nowIso();
  appendAuditEvent(record, {
    type: 'github.linked',
    issueRef: nextIssueRef,
    prRef: nextPrRef,
    actor: normalizeString(actor) || undefined,
  });
  findingsMap.set(findingId, record);
  return record;
}

export function storeFindingOverride({ findingsMap, findingId, override, actor = '' }) {
  const record = getRequiredFinding(findingsMap, findingId);
  const cleanOverride = override && typeof override === 'object' ? structuredClone(override) : null;
  record.humanOverride = {
    ...(cleanOverride || {}),
    actor: normalizeString(actor) || cleanOverride?.actor || null,
    updatedAt: nowIso(),
  };
  record.updatedAt = nowIso();
  appendAuditEvent(record, {
    type: 'override.stored',
    actor: normalizeString(actor) || undefined,
  });
  findingsMap.set(findingId, record);
  return record;
}

export function reopenFinding({ findingsMap, findingId, reason = '', actor = '' }) {
  return updateFindingRoute({
    findingsMap,
    findingId,
    routeStatus: 'unrouted',
    reason: normalizeString(reason) || 'reopened',
    confidence: null,
    actor,
  });
}

export const __testing = {
  buildFingerprintKey,
  ROUTE_STATUSES,
};

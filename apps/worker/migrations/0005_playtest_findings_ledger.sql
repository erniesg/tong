CREATE TABLE IF NOT EXISTS playtest_findings_ledger (
  finding_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  analysis_id TEXT,
  finding_timestamp_ms INTEGER,
  finding_timestamp_iso TEXT,
  category TEXT,
  severity TEXT,
  summary TEXT NOT NULL,
  artifact_links TEXT NOT NULL DEFAULT '[]',
  inferred_component TEXT,
  route_status TEXT NOT NULL DEFAULT 'unrouted',
  route_reason TEXT,
  route_confidence REAL,
  route_updated_at TEXT,
  linked_issue_refs TEXT NOT NULL DEFAULT '[]',
  linked_pr_refs TEXT NOT NULL DEFAULT '[]',
  human_override_state TEXT NOT NULL DEFAULT '{"active":false}',
  route_attempt_count INTEGER NOT NULL DEFAULT 0,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playtest_findings_route_status
  ON playtest_findings_ledger(route_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_playtest_findings_session
  ON playtest_findings_ledger(session_id, updated_at DESC);

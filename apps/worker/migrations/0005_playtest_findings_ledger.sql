CREATE TABLE IF NOT EXISTS playtest_findings_ledger (
  finding_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  analysis_id TEXT,
  observed_at_text TEXT,
  observed_at_ms INTEGER,
  observed_at_iso TEXT,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  suggested_fix TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  artifact_links_json TEXT NOT NULL DEFAULT '[]',
  inferred_component TEXT,
  route_status TEXT NOT NULL DEFAULT 'unrouted',
  route_reason TEXT,
  route_confidence REAL,
  linked_issue_refs_json TEXT NOT NULL DEFAULT '[]',
  linked_pr_refs_json TEXT NOT NULL DEFAULT '[]',
  manual_override_json TEXT,
  history_json TEXT NOT NULL DEFAULT '[]',
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playtest_findings_ledger_route_status
  ON playtest_findings_ledger(route_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_playtest_findings_ledger_session
  ON playtest_findings_ledger(session_id, updated_at DESC);

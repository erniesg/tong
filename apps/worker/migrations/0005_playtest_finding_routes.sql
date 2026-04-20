CREATE TABLE IF NOT EXISTS playtest_finding_routes (
  finding_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  analysis_id TEXT,
  finding_timestamp TEXT NOT NULL,
  finding_category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  location_pathname TEXT,
  artifact_anchor TEXT,
  artifact_links TEXT NOT NULL DEFAULT '[]',
  inferred_component TEXT NOT NULL,
  route_status TEXT NOT NULL DEFAULT 'unrouted',
  route_reason TEXT,
  route_confidence REAL,
  issue_refs TEXT NOT NULL DEFAULT '[]',
  pr_refs TEXT NOT NULL DEFAULT '[]',
  human_override_state TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  routed_at TEXT,
  reopened_at TEXT,
  last_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playtest_finding_routes_status_ts
  ON playtest_finding_routes (route_status, finding_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_playtest_finding_routes_session
  ON playtest_finding_routes (session_id, finding_timestamp DESC);

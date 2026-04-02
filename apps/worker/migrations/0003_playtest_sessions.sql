CREATE TABLE IF NOT EXISTS playtest_sessions (
  session_id TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  scene_type TEXT NOT NULL,
  language TEXT NOT NULL,
  location_id TEXT,
  hangout_id TEXT,
  exercise_types TEXT,
  seed INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  r2_recording_key TEXT,
  r2_annotations_key TEXT,
  analysis_id TEXT,
  autofix_pr_url TEXT,
  pipeline_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

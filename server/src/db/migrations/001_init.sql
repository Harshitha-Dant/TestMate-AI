-- 001_init: full TestMate AI schema.
-- Conventions: snake_case columns, ISO-8601 UTC timestamps (TEXT), JSON stored as TEXT,
-- is_demo = 1 marks rows created by the demo seed so they can be cleared.

CREATE TABLE projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  description  TEXT    NOT NULL DEFAULT '',
  is_demo      INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE test_suites (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module       TEXT    NOT NULL CHECK (module IN ('chatbot', 'memory', 'multilingual', 'api')),
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  is_demo      INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (project_id, module, name)
);
CREATE INDEX idx_test_suites_project ON test_suites(project_id, module);

-- Single-turn tests: chatbot Q&A and multilingual cases.
CREATE TABLE test_cases (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id           INTEGER REFERENCES test_suites(id) ON DELETE SET NULL,
  module             TEXT    NOT NULL CHECK (module IN ('chatbot', 'multilingual')),
  title              TEXT    NOT NULL,
  input              TEXT    NOT NULL,
  expected           TEXT    NOT NULL DEFAULT '',
  criteria           TEXT    NOT NULL DEFAULT '{}',  -- JSON: keywords, thresholds, match mode
  input_language     TEXT,
  expected_language  TEXT,
  expected_intent    TEXT,
  is_demo            INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_test_cases_project ON test_cases(project_id, module);
CREATE INDEX idx_test_cases_suite ON test_cases(suite_id);

-- Multi-turn memory scripts (definitions). Run transcripts live in test_executions.details.
CREATE TABLE conversation_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id     INTEGER REFERENCES test_suites(id) ON DELETE SET NULL,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  is_demo      INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_conversation_sessions_project ON conversation_sessions(project_id);

CREATE TABLE conversation_turns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  user_message  TEXT    NOT NULL,
  expectation   TEXT    NOT NULL DEFAULT '{}',  -- JSON: expected recall, forbidden terms, check type
  UNIQUE (session_id, position)
);

-- API Studio sends (history = one row per send). Secret-like header values are masked before storage.
CREATE TABLE api_requests (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id           INTEGER REFERENCES test_suites(id) ON DELETE SET NULL,
  name               TEXT    NOT NULL DEFAULT '',
  method             TEXT    NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
  url                TEXT    NOT NULL,
  headers            TEXT    NOT NULL DEFAULT '[]',
  body               TEXT,
  assertions         TEXT    NOT NULL DEFAULT '[]',  -- JSON: [{path, type, value}]
  response_status    INTEGER,
  response_time_ms   INTEGER,
  response_headers   TEXT,
  response_body      TEXT,
  error_kind         TEXT,
  error_message      TEXT,
  is_demo            INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_api_requests_project ON api_requests(project_id, created_at);

CREATE TABLE regression_runs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id          INTEGER REFERENCES test_suites(id) ON DELETE SET NULL,
  baseline_run_id   INTEGER REFERENCES regression_runs(id) ON DELETE SET NULL,
  label             TEXT    NOT NULL DEFAULT '',
  total             INTEGER NOT NULL DEFAULT 0,
  passed            INTEGER NOT NULL DEFAULT 0,
  failed            INTEGER NOT NULL DEFAULT 0,
  needs_review      INTEGER NOT NULL DEFAULT 0,
  pass_rate         REAL    NOT NULL DEFAULT 0,
  is_demo           INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_regression_runs_suite ON regression_runs(project_id, suite_id, created_at);

-- One row per evaluated run of any test (chatbot, memory, multilingual, api).
CREATE TABLE test_executions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  module              TEXT    NOT NULL CHECK (module IN ('chatbot', 'memory', 'multilingual', 'api')),
  test_case_id        INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
  session_id          INTEGER REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  api_request_id      INTEGER REFERENCES api_requests(id) ON DELETE SET NULL,
  regression_run_id   INTEGER REFERENCES regression_runs(id) ON DELETE SET NULL,
  title               TEXT    NOT NULL DEFAULT '',
  status              TEXT    NOT NULL CHECK (status IN ('passed', 'failed', 'needs_review', 'error')),
  score               REAL,
  source              TEXT    NOT NULL CHECK (source IN ('mock', 'live')),
  evaluator           TEXT    NOT NULL DEFAULT 'rule-based' CHECK (evaluator IN ('rule-based')),
  input               TEXT    NOT NULL DEFAULT '',
  output              TEXT    NOT NULL DEFAULT '',
  explanation         TEXT    NOT NULL DEFAULT '',
  details             TEXT    NOT NULL DEFAULT '{}',  -- JSON: per-check results, transcripts, language info
  language            TEXT,
  duration_ms         INTEGER,
  override_status     TEXT    CHECK (override_status IS NULL OR override_status IN ('passed', 'failed', 'needs_review')),
  override_note       TEXT,
  overridden_at       TEXT,
  is_demo             INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_test_executions_project ON test_executions(project_id, module, created_at);
CREATE INDEX idx_test_executions_case ON test_executions(test_case_id);
CREATE INDEX idx_test_executions_run ON test_executions(regression_run_id);

CREATE TABLE regression_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          INTEGER NOT NULL REFERENCES regression_runs(id) ON DELETE CASCADE,
  test_case_id    INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
  test_title      TEXT    NOT NULL,
  execution_id    INTEGER REFERENCES test_executions(id) ON DELETE SET NULL,
  status          TEXT    NOT NULL CHECK (status IN ('passed', 'failed', 'needs_review', 'error')),
  previous_status TEXT,
  change          TEXT    NOT NULL CHECK (change IN ('new_failure', 'fixed', 'unchanged', 'new_test', 'changed'))
);
CREATE INDEX idx_regression_results_run ON regression_results(run_id);

CREATE TABLE bug_reports (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id            INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  execution_id          INTEGER REFERENCES test_executions(id) ON DELETE SET NULL,
  title                 TEXT    NOT NULL,
  module                TEXT    CHECK (module IS NULL OR module IN ('chatbot', 'memory', 'multilingual', 'api')),
  category              TEXT    NOT NULL DEFAULT 'other',
  severity              TEXT    NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status                TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
  failure_explanation   TEXT    NOT NULL DEFAULT '',
  notes                 TEXT    NOT NULL DEFAULT '',
  is_demo               INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_bug_reports_project ON bug_reports(project_id, status);

CREATE TABLE bug_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bug_id      INTEGER NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  action      TEXT    NOT NULL,  -- created | updated | commented
  field       TEXT,
  old_value   TEXT,
  new_value   TEXT,
  note        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_bug_history_bug ON bug_history(bug_id);

-- Global key/value settings (JSON values). Secrets never go here; they live in server env only.
CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

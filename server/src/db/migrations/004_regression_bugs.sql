-- 004_regression_bugs: generic item identity for regression results (cases, scripts, saved API requests)
-- and links from bugs back to the run and item that produced them.
ALTER TABLE regression_runs ADD COLUMN errors INTEGER NOT NULL DEFAULT 0;
ALTER TABLE regression_results ADD COLUMN item_key TEXT NOT NULL DEFAULT '';
ALTER TABLE regression_results ADD COLUMN previous_execution_id INTEGER REFERENCES test_executions(id) ON DELETE SET NULL;
CREATE INDEX idx_regression_results_item ON regression_results(item_key);

ALTER TABLE bug_reports ADD COLUMN item_key TEXT;
ALTER TABLE bug_reports ADD COLUMN regression_run_id INTEGER REFERENCES regression_runs(id) ON DELETE SET NULL;
CREATE INDEX idx_bug_reports_item ON bug_reports(project_id, item_key);

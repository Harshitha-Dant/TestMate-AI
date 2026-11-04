-- 003_api_studio: saved requests vs. send history, body type, and response metadata.
ALTER TABLE api_requests ADD COLUMN kind TEXT NOT NULL DEFAULT 'history' CHECK (kind IN ('history', 'saved'));
ALTER TABLE api_requests ADD COLUMN body_type TEXT NOT NULL DEFAULT 'json' CHECK (body_type IN ('none', 'json', 'text'));
-- JSON: { statusText, truncated, bodyBytes, contentType, redirects, remoteAddress }
ALTER TABLE api_requests ADD COLUMN response_meta TEXT;
CREATE INDEX idx_api_requests_kind ON api_requests(project_id, kind, created_at);

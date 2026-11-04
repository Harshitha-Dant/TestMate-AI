# TestMate AI

"Test Smarter. Build Reliable AI." A local testing platform for chatbots and APIs. The full brief and its milestones are in the original build brief; the progress so far is listed below.

## Milestone status
- [x] M1: Scaffold, DB schema/migrations, design system, app shell + sidebar, project CRUD
- [x] M2: Provider/Evaluator architecture, Chatbot Test Lab, execution persistence
- [x] M3: Conversation Memory Lab
- [x] M4: Multilingual Lab
- [x] M5: API Test Studio with SSRF protections. Code: server/src/lib/safeHttp/ (ipAddress, safeRequest: DNS checked and the
  connection pinned to the checked IP, every redirect re-validated, timeout and size cap), lib/secrets.ts (masking,
  {{secret:NAME}} → TESTMATE_SECRET_NAME), lib/jsonPath.ts, evaluators/apiEvaluator.ts, services/apiStudioService.ts.
  Routes: /projects/:id/api-studio/{send,history,saved}; global settings at /api/settings/api-studio (allowLocalhost off
  by default). Results are source "live". API suites re-run their saved requests. Vite proxy key is "/api/" (with the
  slash), so client routes like /api-studio aren't proxied.
- [x] M6: Regression testing + Bug Intelligence. A regression run (services/regressionService) snapshots a suite through
  runService.runSuiteItems, keying each item as case:<id> | script:<id> | api:<savedId>. lib/regressionDiff classifies
  each item: new_failure (passed → failed/error), fixed (not passing → passed), changed, new_test, unchanged; items
  only in the baseline are "removed". The baseline defaults to the suite's previous run, and any two runs of a suite
  can be compared. Executions carry regression_run_id. With createBugs, each new failure opens a bug (category
  regression, severity high); if an unresolved bug already tracks that item, it gets a history note instead.
  services/bugService handles suggestions from an execution (heuristic category/severity, editable), CRUD, history
  per changed field, comments and the summary. Routes: /regression/{runs, runs/:id, compare?from&to} and
  /bugs{, /summary, /suggest?executionId, /:id}. UI: pages/regression, pages/bugs (?id= deep link), plus a
  "Report bug" action in ExecutionResult for any non-passing result. Demo: "v1.0 baseline" and "v1.1" runs (v1.1
  simulated with mock seed 7 at a 35% fault rate), 2 auto-opened bugs and 1 hand-reported bug with history.
  The regression diff uses Tailwind container queries (@container) so it fits narrow columns.
- [x] M7: Dashboard (real data), Test History, Reports (CSV/PDF), Settings. services/analyticsService.overview(days)
  computes every dashboard and report number from stored executions. It uses the "latest result per test" (grouped by
  case | script | module+input) for pass rates and the AI Quality Score: QUALITY_WEIGHTS chatbot 0.5 / memory 0.2 /
  multilingual 0.15 / api 0.15, renormalized over modules with results, with needs review counting half (formula text
  in shared QUALITY_FORMULA, shown in the UI tooltip and the PDF). Exports (services/reportService): executions CSV and
  regression CSV via lib/csv (BOM, RFC 4180, formula-injection guard), plus a PDF via pdfkit (lib/pdfReport,
  built-in Helvetica, so non-Latin text becomes "?"). Routes: /projects/:id/analytics?days=N|all,
  /reports/{executions.csv, regression.csv, report.pdf}; global /api/settings/preferences, POST/DELETE /api/demo.
  The executions list takes status/source/q/days filters (Test History). The labs accept ?case=<id> / ?script=<id>
  deep links. Theme is dark | light | system in localStorage (lib/theme.ts); the light tokens live in
  :root[data-theme=light] in index.css. Charts use Recharts (components/charts/TrendChart) with chart-only tokens
  --color-chart-fail/pass/review, which passed the dataviz validator on both surfaces; the stack order
  failed → passed → review keeps the warm hues apart. Pages are lazy-loaded (App.tsx + Suspense in AppShell).
- [x] M8: Polish, full test pass, README. Live chatbot provider (providers/httpChatbotProvider.ts): POST JSON
  {message, messages}, reply read by JSON path (or the raw body when the path is ""), sent through safeRequest (same SSRF
  rules and Allow localhost setting as API Studio), headers only via {{secret:NAME}}. Stored per project in
  project_settings key "chatbot_target" (GET/PUT /projects/:id/provider/target); providerService.forProject() returns
  {provider, config, mode} and every lab uses it, results source "live". UI: components/provider/ChatbotTargetPanel
  (Simulated | Live toggle) in SingleTurnLab and MemoryLabPage. ErrorBoundary around routed pages (keyed by path);
  PageHeader sets document.title. `npm start` serves client/dist when it exists (createApp(db, {clientDir})).
  `npm run smoke` (server/scripts/smoke.ts) spawns the real server on a temp DB and a free port, exercises every
  module against a local stand-in target, restarts and checks persistence. `npm run check` = typecheck + lint + tests
  + smoke. Client unit tests live next to the code (*.test.ts). README.md has setup, Known limitations, publishing.

Every nav module now has a real page (the placeholder mechanism was removed in M7). New pages: add a lazy route in `client/src/App.tsx` and an item in `lib/nav.ts`.

## Environment
Windows 11, 8 GB RAM, Node 26.13 / npm 11.20. No Docker, no paid APIs. npm scripts must be cross-platform.
SQLite driver: **better-sqlite3 13.0.3**. It ships N-API prebuilds (`prebuilds/win32-x64.node`), so it needs no build tools. npm 11 lists its install script as "not covered by allowScripts". That warning is harmless: the prebuilt binary loads without the script.

## Commands (run from repo root)
| Command | What |
|---|---|
| `npm run dev` | API (tsx watch, :4000) + Vite client (:5173, proxies `/api`) via concurrently |
| `npm test` | Server Vitest + Supertest suites (in-memory DB); client Vitest |
| `npm run smoke` | End-to-end: real server process, temp DB, every module, restart persistence check |
| `npm run check` | typecheck + lint + test + smoke |
| `npm start` | API; also serves the built client (`npm run build`) on the same port |
| `npm run typecheck` | `tsc` for shared, server, client |
| `npm run lint` | ESLint flat config (`eslint.config.js`) |
| `npm run build` | Production client build |
| `npm run db:migrate` / `db:seed` / `db:clear-demo` | Migrations, demo data (is_demo=1, "Demo:" prefix; the seed really runs demo cases through the mock), remove demo data |

Env (optional root `.env`, loaded with `process.loadEnvFile`): `TESTMATE_API_PORT` (default 4000), `TESTMATE_DB_PATH` (default `server/data/testmate.db`) and `TESTMATE_SECRET_<NAME>` for `{{secret:NAME}}`. Use `TESTMATE_API_PORT`, never a generic `PORT`: preview tools set `PORT=5173` and the API would steal the client's port.

## Structure
```
shared/src/types/      DTOs + enums (api envelope, domain consts, project); imported as @testmate/shared (TS source)
server/src/
  app.ts               createApp(db): express app factory used by index.ts and tests
  index.ts, config.ts
  db/                  connection.ts, migrate.ts, migrations/NNN_*.sql, seed.ts, cli.ts, json.ts, repositories/
  routes/index.ts      global routes + project-scoped router mounted at /projects/:projectId (requireProject)
  routes/ → controllers/ → services/ → db/repositories/
  providers/           ChatbotProvider interface; MockChatbotProvider (+ mockKnowledgeBase, memory window); HttpChatbotProvider (live)
  evaluators/          Evaluator interface; RuleBasedEvaluator (single turn); ConversationEvaluator (multi-turn);
                       MultilingualEvaluator (rule-based checks + reply language, intent, declared input language)
  services/            projectService, suiteService, testCaseService, conversationService, multilingualService
                       (samples, per-language summary),
                       runService (runTestCase, runConversation, runSuite for chatbot/multilingual/memory),
                       executionService (list/get/override), providerService (per-project mock config)
  validators/          zod schemas (parse in controllers; ZodError → 400 in errorHandler)
  middleware/          errorHandler (envelope, no stack/body logging), notFoundHandler, projectScope (requireProject, projectIdOf)
  lib/                 errors.ts (HttpError helpers), http.ts (sendOk, getDb), text.ts (normalize, containsPhrase, tokenOverlap, hashUnit),
                       conversationFacts.ts (English-pattern fact extraction: user facts, bot assertions, recall slots),
                       languageDetect.ts (script ranges + Tanglish/Hinglish word lists), intents.ts (reply intent signatures)
server/test/           *.test.ts, helpers.setup() = in-memory migrated DB + app
server/scripts/smoke.ts end-to-end smoke test (npm run smoke)
client/src/
  api/                 client.ts (apiRequest, ApiClientError), one file per resource
  hooks/useAsync.ts    loading/data/error with reload() (shows loading) and refresh() (quiet)
  context/ProjectContext.tsx  projects + active project (localStorage, try/catch)
  components/ui/       Card, Button/IconButton, Badge, StatusBadge/SourceBadge, Field, SelectField, TagInput, Modal (md|lg),
                       ConfirmDialog, States (Loading/Empty/Error), PageHeader
  components/layout/   AppShell (desktop sidebar + mobile drawer), Sidebar, ProjectSwitcher
  components/          RequireProject (render-prop; key pages by project.id), execution/ (ExecutionResult: single reply or
                       ConversationTranscript; CheckList, OverridePanel, RunHistory), provider/MockProviderCard,
                       suites/ (SuitePanel, SuiteFormModal; reusable across modules)
  lib/faults.ts        faultLabel() for injected mock faults; lib/languages.ts langAttr/languageName/intentName
  pages/chatbot/SingleTurnLab.tsx  shared lab used by ChatbotLabPage and MultilingualLabPage (renderTop, extraActions,
                       renderCaseMeta); TestCaseFormModal takes `module` and shows language/intent fields for multilingual
  components/language/ LanguageDetectionView + CompositionBar; execution/LanguagePanel shows detections in results
  api/testing.ts       suitesApi, testCasesApi, conversationsApi, executionsApi, providerApi; api/multilingual.ts
  pages/<module>/      page + its modals
  lib/nav.ts           nav sections and items (label, icon, summary, milestone)
  styles/index.css     Tailwind v4 @theme tokens
```

## Conventions
- API envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`. Validation details are `[{ path, message }]`.
- Project-scoped resources live under `/api/projects/:projectId/...`. Every repo query filters by project_id. Current routes:
  `suites` (GET ?module, POST, PATCH/DELETE :id, POST :id/run), `test-cases` (GET ?module&suiteId=id|none, POST, GET/PUT/DELETE :id, POST :id/run),
  `conversations` (GET ?suiteId, POST, GET/PUT/DELETE :id, POST :id/run),
  `multilingual/summary` (GET), `multilingual/samples` (POST, idempotent by title). Global: `POST /api/language/detect {text}`.
  `executions` (GET ?module&testCaseId&sessionId&limit&offset → {items,total}, GET :id, PATCH :id/override), `provider/mock` (GET/PUT).
- Deleting a test case or suite keeps its executions (FK SET NULL), so history survives.
- Rule-based evaluator: each check yields pass/review/fail/skip and the overall status is the worst one. Forbidden terms, empty replies,
  exact-mode mismatches and length violations are hard fails. Missing keywords mean review at 50%+ coverage and fail below that.
  Relevance is the token overlap with the expected answer; up to 20 points below the threshold means review.
  Short words (<4 chars, including digits) must match whole; longer ones may take a suffix.
- Mock provider: deterministic (hash of seed + question). Faults (omit_detail, off_topic, forbidden_claim, empty) are injected at
  `failureRate` and recorded in `details.simulation.faultInjected`; the UI shows which fault was injected. Config is stored per project
  in `project_settings` (key `mock_provider`).
- Memory: the mock sees only the last `memoryWindow` user turns. It acknowledges stated facts, recalls them (latest value wins),
  resolves follow-ups from the previous visible turn's intent, and says "I don't remember your X" when a fact fell out of the window.
  `wrong_memory` is injected only when the bot actually knows the fact. Turns are statement | recall (mustInclude) |
  follow_up (mustIncludeAny), and any kind can have mustNotInclude. The evaluator classifies issues as context_loss
  (fact missing or forgotten), wrong_memory (another value or a forbidden or outdated fact), contradiction (bot assertion ≠ user's
  latest fact, or ≠ its own earlier assertion), follow_up_invalid, missing_info or empty_reply. Results go in `details.memory`
  (transcript, firstFailureTurn, memoryWindow, facts), and the execution score is the % of turns that passed.
- Multilingual: languages are en | te | te-Latn (Tanglish) | hi | hi-Latn (Hinglish) | mixed | unknown. Detection: words in Telugu
  or Devanagari script are counted by Unicode range; text is mixed when both scripts make up 25%+ of the words or Latin
  words make up 40%+ alongside a native script. All-Latin text is te-Latn or hi-Latn when 2+ lexicon words match, otherwise en.
  Verdicts: same language → pass; same language in another script → review; mixed with the right primary language → review;
  unknown → review; anything else → fail ("wrong language"). Multilingual cases require `expectedLanguage`; intent and text
  criteria are optional. The mock answers in the question's language (the primary one for mixed text) using
  `MOCK_KNOWLEDGE_BASE[].answers`. The `wrong_language` fault exists only when hints.multilingual is set, so the other labs'
  fault picks are unchanged. normalize() strips ZWNJ/ZWJ. Use `lang={langAttr(...)}` on any user-language text.
- Demo seed: the demo project uses mock seed 4888, found by searching seeds so each failure type shows once (context loss at
  turn 6, wrong memory at turn 3, one wrong-language reply, a few chatbot failures). Re-search it if demo data or fault logic changes.
- Overrides keep the evaluator's `status`. `effectiveStatus` = override ?? status, and a note (3+ chars) is required.
- DB: snake_case columns, ISO UTC text timestamps, JSON in TEXT columns, `is_demo` on seedable tables. Foreign keys are ON and the project delete cascades. Schema changes require a new migration file. Never edit applied ones.
- Every execution stores `source` ('mock' | 'live') and `evaluator` ('rule-based'). The UI must visibly label mock results as simulated.
- Never log headers or bodies, and never return secrets to the client.
- Every data view has loading, empty and error states. No hardcoded metrics.
- Keep files small: one component per file, with page-specific modals next to their page.

## Design tokens (Charcoal Bento Grid)
bg `#17191D` · card `#24272D` · card-2 `#2D3037` · fg `#F4F3EF` · muted `#A5A8B0` · accent `#A78BFA` · success `#9AD9BB` · failure `#F28B82` · warning `#F3D58A` · line `white/7%`.
Tailwind classes: `bg-bg`, `bg-card`, `bg-card-2`, `text-fg`, `text-muted`, `text-accent`, `border-line`, `rounded-card`, `shadow-card`.
Accent is for highlights only (active nav bar, focus ring, small badges), never large backgrounds. Primary buttons are off-white (`bg-fg text-bg`).
Fonts: Inter Variable plus bundled Noto Sans Telugu and Devanagari (@fontsource), so no CDN is needed.
Never use raw `white`/`black` utilities for surfaces or hovers; use `fg/<opacity>` so the light theme works. Shared
module labels and lab paths live in `lib/modules.ts` (keep constants out of component files, or Fast Refresh breaks).
Layout gotcha: grid items default to min-width:auto, so use `grid-cols-1` / `minmax(0,…)` / `min-w-0` around wide content (tables)
or it will cause horizontal page scroll on mobile.

## Pinned stack
React 19.3.1, react-router-dom 7.18.5, recharts 3.10.1 (+ react-is 19.3.1), pdfkit 0.20.2, Vite 7.3.7, Tailwind 4.3.4 (@tailwindcss/vite), Express 5.3.0, zod 4.6.7, better-sqlite3 13.0.3, TypeScript 5.9.3, Vitest 4.1.12, Supertest 7.3.1, tsx 4.23.15, ESLint 9.39.5 + typescript-eslint 8.72.1 + react-hooks 7.1.1, lucide-react 1.67.0.

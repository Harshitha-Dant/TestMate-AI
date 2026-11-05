# TestMate AI

**Test Smarter. Build Reliable AI.**

TestMate AI is a local testing platform for chatbots and HTTP APIs. You write test cases, run them against a
built-in simulated chatbot or your own live endpoint, and get rule-based verdicts, regression diffs, bug tracking,
a dashboard and exportable reports. Everything runs on your machine with SQLite. It needs no Docker, no cloud
account and no paid API.

> **How results are judged.** Every verdict comes from transparent, rule-based checks (keywords, forbidden terms,
> token overlap, script-based language detection, JSON field checks). TestMate AI does **not** use an AI model to
> grade answers and does not claim semantic or translation understanding. Each result is stored with
> `source: "mock" | "live"` and `evaluator: "rule-based"`, and the UI labels simulated results as **Simulated**.

## Features

| Module | What it does |
|---|---|
| **Projects** | Separate workspaces. Every test, run, bug and setting belongs to a project. |
| **Chatbot Test Lab** | Single-turn test cases with required keywords, forbidden terms, expected answer and relevance threshold, length limits and exact match. Suites, run history and manual overrides (with a required note). |
| **Conversation Memory Lab** | Multi-turn scripts with statement, recall and follow-up turns. Detects context loss, wrong memory, contradictions and invalid follow-ups, and shows the first failing turn. |
| **Multilingual Lab** | English, Telugu, Hindi, Tanglish, Hinglish and mixed text. Checks that the reply is in the expected language and script, plus optional intent and text criteria. Includes a language detector you can try on any text. |
| **API Test Studio** | Send HTTP requests, check the status, response time and JSON fields, then save requests into suites. SSRF protections are built in (see Security). |
| **Live chatbot endpoint** | Point the Chatbot, Multilingual and Memory labs at your own HTTP chatbot instead of the simulator. |
| **Regression testing** | Snapshot a suite, compare any two runs, see new failures, fixes and changes, and open bugs automatically. |
| **Bug Intelligence** | Bug reports with suggested category and severity, status workflow, comments and change history. |
| **Dashboard** | AI Quality Score, pass rates per module, trends and insights, all computed from stored runs. |
| **Test History** | Every execution, filterable by status, source, date range and text. |
| **Reports** | Executions CSV, regression CSV and a PDF summary. |
| **Settings** | Dark, light or system theme, quality target, request safety settings, and demo data. |

## The simulated chatbot

The built-in **mock provider** lets you use every lab without a real bot. It answers from a small support
knowledge base, deterministically: the same seed and question always give the same answer. You can make it fail
on purpose with an adjustable fault rate (omitted detail, off-topic, forbidden claim, empty reply, wrong memory,
wrong language) to see how failures look. Its memory window is configurable, so it forgets the way a real bot
with limited context does. Mock results are always labeled **Simulated** and are never presented as a real AI reply.

## Requirements

- Windows 10/11, macOS or Linux (developed and tested on Windows 11 with 8 GB RAM)
- **Node.js 22.13 or newer** (tested with Node 26.13 and npm 11.20)
- No build tools needed: the SQLite driver (better-sqlite3) ships prebuilt binaries.

## Install and run (Windows PowerShell)

```powershell
# 1. Get the code, then open a terminal in the project folder
cd C:\TestMate-AI

# 2. Install all workspaces (client, server, shared)
npm install

# 3. Optional: create the database and load demo data
npm run db:migrate
npm run db:seed

# 4. Start the API (port 4000) and the web app (port 5173)
npm run dev
```

Open **http://localhost:5173**. Stop with `Ctrl+C`.

The database is created automatically on first start (`server\data\testmate.db`), so step 3 is only needed for
the demo data. You can also load or remove the demo from **Settings → Demo data**.

No compiler or Visual Studio is needed. better-sqlite3 ships a prebuilt Windows binary, and the root
`package.json` has an `allowScripts` policy that skips its build-from-source script (`better-sqlite3: false`) and
allows esbuild's setup script. If you see `gyp ERR! find VS`, your npm is ignoring that policy: update npm
(`npm install -g npm@latest`) and run `npm install` again.

### Production-style run (one port)

```powershell
npm run build
npm start
```

Open **http://localhost:4000**. The API serves the built UI and the `/api` routes on the same port.

## Scripts

Run from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | API with auto-reload (`:4000`) and Vite dev server (`:5173`, proxies `/api/`) |
| `npm run build` | Type-checks and builds the client into `client/dist` |
| `npm start` | API server; also serves `client/dist` when it exists |
| `npm test` | Server tests (Vitest + Supertest, in-memory DB) and client unit tests |
| `npm run smoke` | End-to-end smoke test: starts the real server on a temp DB, exercises every module, restarts it and checks persistence |
| `npm run typecheck` | TypeScript for shared, server and client |
| `npm run lint` | ESLint |
| `npm run check` | typecheck + lint + tests + smoke |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Create the demo project ("Demo: Support Bot") |
| `npm run db:clear-demo` | Remove all demo data and keep your own |

## Configuration

Copy `.env.example` to `.env` only if you need to change something. All values are optional.

| Variable | Default | Meaning |
|---|---|---|
| `TESTMATE_API_PORT` | `4000` | API port. The Vite dev server proxies `/api/` to it. |
| `TESTMATE_DB_PATH` | `server/data/testmate.db` | SQLite file location |
| `TESTMATE_SECRET_<NAME>` | none | A secret you reference as `{{secret:NAME}}` |
| `TESTMATE_PUBLIC_MODE` | off | `1` turns on public mode for an online deployment (see below) |
| `TESTMATE_ADMIN_KEY` | none | Required in public mode, at least 24 characters. Never put it in a file you commit |
| `TESTMATE_TRUST_PROXY_HOPS` | `1` | Public mode only: reverse proxies in front of the app, used to find each visitor's IP for rate limits |

**Secrets.** Never type a real token into a header. Put it in `.env`:

```
TESTMATE_SECRET_SUPPORT_BOT_TOKEN=abc123
```

Then use `Bearer {{secret:SUPPORT_BOT_TOKEN}}` as the header value in API Studio or the live chatbot settings. The
server substitutes it when sending. The value is never stored in the database, never returned to the browser and
never logged. Restart the server after editing `.env`.

## Using a live chatbot

In the Chatbot, Multilingual or Memory lab, open **Chatbot under test → Live** and enter the URL. TestMate
AI sends:

```json
POST <your url>
{ "message": "latest user message", "messages": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }] }
```

`messages` holds the conversation so far, which the Memory Lab needs. Untick **Send the conversation history** to send only the
last message. The reply is read from the JSON field you name (default `reply`, nested paths like
`data.choices[0].text` work), or from the raw body if the field is left empty. Live results are labeled **Live**.
The same SSRF rules as API Studio apply, so a bot on `localhost` needs **Allow localhost** (Settings → Request safety).

## Testing

```powershell
npm test         # 166 server tests in 22 files + 14 client tests in 3 files
npm run smoke    # 23 end-to-end checks against a real server process
npm run check    # everything, including typecheck and lint
```

## Demo data

`npm run db:seed` (or **Settings → Demo data → Load demo data**) creates **Demo: Support Bot** with chatbot, memory,
multilingual and API suites. They are real runs through the simulator, plus two regression runs ("v1.0 baseline"
and "v1.1", where v1.1 uses a higher fault rate), two bugs opened by the regression and one reported by hand.
Demo rows are flagged in the database and removed with `npm run db:clear-demo` without touching your own data.

## Security

- **SSRF protection** in API Studio and live endpoints: only `http`/`https`. Private, loopback, link-local,
  carrier-grade NAT, multicast and cloud-metadata addresses are blocked, including IPv4 hidden inside IPv6. DNS is
  resolved and every answer is checked, the connection is pinned to the checked IP, and every redirect (max 5) is
  re-validated. **Allow localhost** is off by default and only opens loopback, not the private network.
- Request timeout and response size cap (Settings → Request safety).
- Authorization and secret-like headers, query values and JSON fields are masked before storage and in the UI.
- The server never logs request headers or bodies.
- CSV exports guard against spreadsheet formula injection.
- All input is validated with zod and errors use one envelope: `{ ok: false, error: { code, message, details } }`.
- **Public mode** (`TESTMATE_PUBLIC_MODE=1`, for an online deployment only): deleting anything, removing demo
  data and changing app-wide settings need the admin key (sent as the `X-TestMate-Admin-Key` header, compared in
  constant time, never returned or logged; wrong guesses are limited to 5 a minute). "Allow localhost" is forced
  off, timeouts are capped at 8 s and responses at 256 KB. Each visitor gets 20 runs and 60 changes a minute, all
  visitors together get 300 requests to other servers an hour, and there can be at most 25 projects. The server
  refuses to start in public mode without a valid admin key. Off by default, so local use is unchanged.

## Project structure

```
TestMate-AI/
├── client/                  React 19 + Vite + Tailwind 4
│   └── src/
│       ├── api/             typed fetch wrappers, one file per resource
│       ├── components/      ui/, layout/, execution/, provider/, charts/, suites/, language/
│       ├── context/         active project
│       ├── hooks/           useAsync
│       ├── lib/             nav, theme, formatting, language names
│       ├── pages/           dashboard, chatbot, memory, multilingual, api, regression, bugs, history, reports, settings, projects
│       └── styles/          design tokens (dark and light)
├── server/                  Express 5 + better-sqlite3
│   ├── scripts/smoke.ts     end-to-end smoke test
│   ├── src/
│   │   ├── db/              connection, migrations/*.sql, repositories, seed
│   │   ├── routes/ → controllers/ → services/ → db/repositories/
│   │   ├── providers/       mock chatbot, live HTTP chatbot
│   │   ├── evaluators/      rule-based, conversation, multilingual, API checks
│   │   ├── lib/             safeHttp (SSRF), secrets, csv, pdfReport, language detection, text helpers
│   │   ├── validators/      zod schemas
│   │   └── middleware/      error handler, project scope
│   └── test/                Vitest + Supertest suites
├── shared/                  TypeScript types and constants used by both sides
├── deploy/render/           start.sh (restore, then run under Litestream) and litestream.yml
├── Dockerfile, render.yaml  container image and Render blueprint for the free online deployment
├── DEPLOY.md                step-by-step online deployment guide
├── .env.example
├── eslint.config.js
└── package.json             npm workspaces
```

## Known limitations

- **Rule-based evaluation only.** Keyword and token-overlap checks miss paraphrases and can pass a reply that
  mentions the right words in a wrong sentence. There is no semantic similarity and no LLM judge.
- **Language detection is heuristic.** It counts Telugu and Devanagari script ranges and matches small Tanglish and
  Hinglish word lists. It does not translate or check meaning. Romanized text with few lexicon words is read as
  English, and other languages are reported as English or unknown.
- **Memory checks are English-pattern based.** Fact extraction ("my name is…", "I live in…") uses English patterns,
  so memory scripts in other languages are only checked by their keyword expectations.
- **The mock chatbot is a simulator**, not a model. Its knowledge base is small and fixed, and its faults are
  injected on purpose. Use a live endpoint to test a real bot.
- **Live endpoint format is fixed**: JSON POST with `message` and `messages`, reply read from one JSON field. Bots
  with other request shapes, streaming replies or OAuth logins need a small adapter in front of them.
- **The PDF report uses a built-in Latin font**, so Telugu and Hindi text appears as "?" in the PDF. CSV exports
  keep all characters.
- **No user accounts.** Locally there is no login. Online, public mode protects destructive actions with a single
  admin key, but every visitor sees and shares the same projects and results.
- **Runs are synchronous.** A suite run completes within one request, which is fine for dozens of tests but not for
  thousands of slow live calls.
- SQLite in one file: no concurrent multi-process writers.
- Tested on Windows 11 and Chromium-based browsers. macOS and Linux should work (scripts are cross-platform) but
  were not tested.

## Deploy online (free)

TestMate AI can run on a public HTTPS address at no cost: a **Render** free web service runs the Docker image,
**Litestream** copies every database change to a private **Backblaze B2** bucket and restores it at startup, and
public mode protects the shared demo. No payment card is needed. [DEPLOY.md](DEPLOY.md) has the full steps, the
free limits and what could cost money.

Expect a wake-up of about a minute after 15 minutes without visitors, and up to about a second of changes lost if
the server is killed abruptly.

## Publish to GitHub

The `.gitignore` already excludes `node_modules`, build output, `.env` files and `*.db` files, so your database and
secrets stay local.

```powershell
cd C:\TestMate-AI
git init
git add .
git status            # check that no .env or .db file is listed
git commit -m "TestMate AI: initial version"
git branch -M main
```

Create an empty repository on GitHub (github.com → **New repository**, no README or .gitignore), then:

```powershell
git remote add origin https://github.com/<your-user>/testmate-ai.git
git push -u origin main
```

Or, with the GitHub CLI installed and signed in (`gh auth login`):

```powershell
gh repo create testmate-ai --private --source . --push
```

## Tech stack

React 19, React Router 7, Vite 7, Tailwind CSS 4, Recharts 3, lucide-react · Node.js, Express 5, zod 4,
better-sqlite3, pdfkit · TypeScript 5.9, Vitest 4, Supertest, ESLint 9 · npm workspaces.

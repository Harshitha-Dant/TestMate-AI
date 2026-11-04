/**
 * End-to-end smoke test: starts the real API server (as a separate process) against a temporary database,
 * exercises every module over HTTP, restarts the server and checks that the data survived.
 * No internet needed: API Studio and the live-chatbot check talk to a tiny local server.
 *
 * Run from the repo root: npm run smoke
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "testmate-smoke-"));
const dbPath = path.join(tmpDir, "smoke.db");
let passed = 0;
let server: ChildProcess | null = null;
let base = "";

function check(condition: unknown, label: string): void {
  if (!condition) throw new Error(`FAILED: ${label}`);
  passed++;
  console.log(`  ✓ ${label}`);
}

async function freePort(): Promise<number> {
  const s = http.createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address() as AddressInfo;
  await new Promise<void>((r) => s.close(() => r()));
  return port;
}

async function startServer(port: number): Promise<void> {
  server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, TESTMATE_DB_PATH: dbPath, TESTMATE_API_PORT: String(port), TESTMATE_SECRET_SMOKE_TOKEN: "smoke-secret" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout?.on("data", (d) => (output += d));
  server.stderr?.on("data", (d) => (output += d));
  base = `http://127.0.0.1:${port}/api`;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start:\n${output}`);
}

async function stopServer(): Promise<void> {
  if (!server) return;
  const proc = server;
  server = null;
  await new Promise<void>((resolve) => {
    proc.once("exit", () => resolve());
    proc.kill();
  });
}

// The smoke test reads loosely typed JSON; the server tests cover the exact shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api<T = any>(method: string, url: string, body?: unknown): Promise<{ status: number; data: T; raw: Response }> {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("application/json") ? ((await res.json()) as { data: T }).data : (undefined as T);
  return { status: res.status, data, raw: res };
}

/** Local stand-in for a public API and a live chatbot. */
async function startTarget(): Promise<{ url: string; close: () => Promise<void> }> {
  const target = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url?.startsWith("/todo")) return res.end(JSON.stringify({ id: 1, title: "Smoke", completed: false }));
      if (req.url?.startsWith("/bot")) {
        const msg = JSON.parse(raw).message as string;
        const auth = req.headers.authorization === "Bearer smoke-secret";
        return res.end(JSON.stringify({ reply: auth && /refund/i.test(msg) ? "Refunds take 5-7 business days." : "Sorry?" }));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => target.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(target.address() as AddressInfo).port}`, close: () => new Promise((r) => target.close(() => r())) };
}

async function main(): Promise<void> {
  const port = await freePort();
  const target = await startTarget();
  console.log(`Smoke test · temp DB ${dbPath}`);

  console.log("\nStarting server");
  await startServer(port);
  check(true, `server healthy on port ${port}`);

  console.log("\nProjects");
  const project = await api("POST", "/projects", { name: "Smoke Bot" });
  check(project.status === 201, "project created");
  const p = `/projects/${project.data.id}`;
  check((await api("PUT", "/settings/api-studio", { allowLocalhost: true, timeoutMs: 5000, maxResponseKb: 256 })).status === 200, "API safety settings saved (localhost on for the local target)");
  await api("PUT", `${p}/provider/mock`, { mode: "knowledge-base", failureRate: 0, faults: [], seed: 1, memoryWindow: 4 });

  console.log("\nChatbot Lab");
  const suite = await api("POST", `${p}/suites`, { module: "chatbot", name: "FAQ" });
  for (const [title, input, kw] of [["Refund", "How long does a refund take?", "5-7 business days"], ["Points", "How many loyalty points do I have?", "points"]]) {
    await api("POST", `${p}/test-cases`, { title, input, criteria: { requiredKeywords: [kw] }, suiteId: suite.data.id });
  }
  const chatRun = await api("POST", `${p}/suites/${suite.data.id}/run`);
  check(chatRun.data.total === 2 && chatRun.data.passed === 1 && chatRun.data.failed === 1, "suite run: 1 passed, 1 failed (as designed)");
  check(chatRun.data.executions.every((e: { source: string }) => e.source === "mock"), "simulated results are labeled mock");

  console.log("\nMemory Lab");
  const script = await api("POST", `${p}/conversations`, {
    title: "Name recall",
    turns: [{ userMessage: "My name is Ravi." }, { userMessage: "What is my name?", expectation: { kind: "recall", mustInclude: ["Ravi"] } }],
  });
  const memRun = await api("POST", `${p}/conversations/${script.data.id}/run`);
  check(memRun.data.status === "passed" && memRun.data.details.memory.transcript.length === 2, "conversation passes with full transcript");

  console.log("\nMultilingual Lab");
  const samples = await api("POST", `${p}/multilingual/samples`);
  check(samples.data.created.length === 8, "8 sample scenarios added");
  const mlRun = await api("POST", `${p}/suites/${samples.data.suiteId}/run`);
  const telugu = mlRun.data.executions.find((e: { title: string }) => e.title === "Order status · Telugu");
  check(telugu?.language === "te" && telugu.status === "passed", "Telugu question answered in Telugu");

  console.log("\nAPI Test Studio");
  const send = await api("POST", `${p}/api-studio/send`, {
    method: "GET",
    url: `${target.url}/todo`,
    expectations: { status: 200, fields: [{ path: "id", type: "number", equals: "1" }] },
  });
  check(send.data.execution.status === "passed" && send.data.execution.source === "live", "live request passes its checks");
  const blocked = await api("POST", `${p}/api-studio/send`, { method: "GET", url: "http://169.254.169.254/latest/meta-data/" });
  check(blocked.data.entry.error?.kind === "blocked", "cloud metadata address blocked (SSRF)");

  console.log("\nLive chatbot endpoint");
  await api("PUT", `${p}/provider/target`, {
    kind: "http",
    http: { url: `${target.url}/bot`, replyPath: "reply", sendHistory: true, headers: [{ key: "Authorization", value: "Bearer {{secret:SMOKE_TOKEN}}", enabled: true }] },
  });
  const tcs = await api("GET", `${p}/test-cases?module=chatbot`);
  const liveRun = await api("POST", `${p}/test-cases/${tcs.data[0].id}/run`);
  check(liveRun.data.source === "live" && liveRun.data.status === "passed", "live chatbot run passes, secret resolved from env");
  await api("PUT", `${p}/provider/target`, { kind: "mock" });

  console.log("\nRegression + bugs");
  const r1 = await api("POST", `${p}/regression/runs`, { suiteId: suite.data.id, label: "v1" });
  await api("PUT", `${p}/provider/mock`, { mode: "knowledge-base", failureRate: 1, faults: ["empty"], seed: 1, memoryWindow: 4 });
  const r2 = await api("POST", `${p}/regression/runs`, { suiteId: suite.data.id, label: "v2", createBugs: true });
  check(r1.data.diff.to.passRate === 50 && r2.data.diff.counts.new_failure === 1, "regression detects the new failure");
  check(r2.data.bugsCreated.length === 1, "bug opened automatically");
  const bugId = r2.data.bugsCreated[0];
  const updated = await api("PATCH", `${p}/bugs/${bugId}`, { status: "in_progress", comment: "Investigating" });
  check(updated.data.history.length === 2, "bug status change recorded in history");

  console.log("\nDashboard, history, reports, settings");
  const analytics = await api("GET", `${p}/analytics?days=7`);
  check(typeof analytics.data.quality.score === "number" && analytics.data.totals.executions >= 15, `analytics from stored runs (score ${analytics.data.quality.score}, ${analytics.data.totals.executions} runs)`);
  const failedHistory = await api("GET", `${p}/executions?status=failed&limit=100`);
  check(failedHistory.data.total >= 2, "history filter by status");
  const csv = await api("GET", `${p}/reports/executions.csv`);
  check(csv.raw.headers.get("content-type")?.includes("text/csv") && (await csv.raw.text()).split("\r\n").length > 10, "executions CSV export");
  const pdf = await fetch(`${base}${p}/reports/report.pdf`);
  check(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString() === "%PDF-", "PDF report export");
  check((await api("GET", "/settings/preferences")).data.qualityTarget === 80, "preferences readable");

  const before = {
    projects: (await api("GET", "/projects")).data.length,
    runs: (await api("GET", `${p}/executions?limit=1`)).data.total,
    bugs: (await api("GET", `${p}/bugs`)).data.length,
  };

  console.log("\nRestart (persistence)");
  await stopServer();
  await startServer(port);
  const after = {
    projects: (await api("GET", "/projects")).data.length,
    runs: (await api("GET", `${p}/executions?limit=1`)).data.total,
    bugs: (await api("GET", `${p}/bugs`)).data.length,
  };
  check(JSON.stringify(before) === JSON.stringify(after), `data survived restart (${after.projects} project, ${after.runs} runs, ${after.bugs} bug)`);
  const bug = await api("GET", `${p}/bugs/${bugId}`);
  check(bug.data.status === "in_progress", "bug status persisted");

  console.log("\nDemo data");
  const demo = await api("POST", "/demo");
  check(demo.status === 201 && demo.data.created, "demo project seeded");
  const cleared = await api("DELETE", "/demo");
  check(cleared.data.removed.projects === 1 && (await api("GET", "/projects")).data.length === 1, "demo data removed, user project kept");

  await stopServer();
  await target.close();
  console.log(`\nSmoke test passed: ${passed} checks.`);
}

main()
  .catch(async (err) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    await stopServer();
  })
  .finally(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the SQLite file briefly; the OS temp folder cleans it up later.
    }
    // The local target server may keep the event loop alive after a failure.
    setTimeout(() => process.exit(), 200).unref();
  });

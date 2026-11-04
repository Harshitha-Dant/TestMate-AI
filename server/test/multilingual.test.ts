import type { TestCriteria } from "@testmate/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MultilingualEvaluator, languageVerdict } from "../src/evaluators/multilingualEvaluator";
import { detectLanguage } from "../src/lib/languageDetect";
import { DEFAULT_MOCK_CONFIG, MockChatbotProvider, replyLanguageFor } from "../src/providers/mockChatbotProvider";
import { setup } from "./helpers";

const criteria: TestCriteria = {
  matchMode: "keywords",
  requiredKeywords: [],
  forbiddenKeywords: [],
  minRelevance: 60,
  minLength: null,
  maxLength: null,
};

describe("multilingual mock replies", () => {
  const bot = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 0 });
  const ask = async (q: string, hints = {}) => (await bot.reply([{ role: "user", content: q }], hints)).text;

  it("answers in the language of the question", async () => {
    expect(await ask("నా ఆర్డర్ ఎక్కడ ఉంది?")).toContain("ట్రాక్");
    expect(await ask("Naa order ekkada undi?")).toContain("track cheyyochu");
    expect(await ask("मेरा ऑर्डर कहाँ है?")).toContain("ट्रैक");
    expect(await ask("Mera order kahan hai?")).toContain("track kar sakte hain");
    expect(await ask("Mujhe refund kab milega?")).toContain("aa jayega");
    expect(replyLanguageFor("నా order status ఏంటి? Please చెప్పండి")).toBe("te");
  });

  it("injects wrong_language only for multilingual runs", async () => {
    const wrong = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 1, faults: ["wrong_language"] });
    const telugu = await wrong.reply([{ role: "user", content: "నా ఆర్డర్ ఎక్కడ ఉంది?" }], { multilingual: true });
    expect(telugu.faultInjected).toBe("wrong_language");
    expect(detectLanguage(telugu.text).language).toBe("en");
    const english = await wrong.reply([{ role: "user", content: "Where is my order?" }], { multilingual: true });
    expect(detectLanguage(english.text).language).toBe("hi");
    const chatbot = await wrong.reply([{ role: "user", content: "Where is my order?" }]);
    expect(chatbot.faultInjected).toBeNull();
  });
});

describe("MultilingualEvaluator", () => {
  const evaluator = new MultilingualEvaluator();
  const run = (input: string, output: string, extra: object = {}) =>
    evaluator.evaluate({
      input,
      output,
      expected: "",
      criteria,
      inputLanguage: null,
      expectedLanguage: "te",
      expectedIntent: "order_status",
      ...extra,
    });

  it("passes a reply in the right language that answers the intent", () => {
    const r = run("నా ఆర్డర్ ఎక్కడ ఉంది?", "మీ ఆర్డర్‌ను 'నా ఆర్డర్లు' విభాగంలో ట్రాక్ చేయవచ్చు.", { inputLanguage: "te" });
    expect(r.status).toBe("passed");
    expect(r.language).toMatchObject({ detectedIntent: "order_status", output: { language: "te" }, input: { language: "te" } });
  });

  it("fails a reply in the wrong language", () => {
    const r = run("నా ఆర్డర్ ఎక్కడ ఉంది?", "You can track your order from My Orders.");
    expect(r.status).toBe("failed");
    expect(r.explanation).toContain("Wrong language: expected Telugu");
  });

  it("flags the wrong intent and unrecognizable intents", () => {
    expect(run("x", "రీఫండ్ 5-7 పని దినాలలో జమ అవుతుంది.").checks.find((c) => c.id === "intent")).toMatchObject({
      outcome: "fail",
      detail: 'Reply answers "Refund" instead of "Order status".',
    });
    expect(run("x", "క్షమించండి, సమాచారం లేదు.").checks.find((c) => c.id === "intent")!.outcome).toBe("review");
  });

  it("asks for review when the declared input language looks wrong", () => {
    const r = run("Where is my order?", "మీ ఆర్డర్‌ను ట్రాక్ చేయవచ్చు.", { inputLanguage: "hi" });
    expect(r.status).toBe("needs_review");
    expect(r.checks.find((c) => c.id === "input_language")!.detail).toContain("says the question is Hindi");
  });

  it("grades script and mixing differences", () => {
    expect(languageVerdict("te", detectLanguage("Mee order ni My Orders lo track cheyyochu")).outcome).toBe("review");
    expect(languageVerdict("te", detectLanguage("నా order status ఏంటి? Please చెప్పండి")).outcome).toBe("review");
    expect(languageVerdict("mixed", detectLanguage("నా order status ఏంటి? Please చెప్పండి")).outcome).toBe("pass");
    expect(languageVerdict("hi", detectLanguage("Where is my order?")).outcome).toBe("fail");
    expect(languageVerdict("en", detectLanguage("")).outcome).toBe("review");
  });
});

describe("multilingual API", () => {
  async function withProject(failureRate = 0) {
    const ctx = setup();
    const res = await request(ctx.app).post("/api/projects").send({ name: "Bot" }).expect(201);
    const base = `/api/projects/${res.body.data.id}`;
    await request(ctx.app)
      .put(`${base}/provider/mock`)
      .send({ mode: "knowledge-base", failureRate, faults: ["wrong_language"], seed: 1, memoryWindow: 4 })
      .expect(200);
    return { ...ctx, base };
  }

  it("detects language through the API", async () => {
    const { app } = setup();
    const res = await request(app).post("/api/language/detect").send({ text: "Mera order kahan hai?" }).expect(200);
    expect(res.body.data).toMatchObject({ language: "hi-Latn", method: "lexicon", evidence: ["mera", "kahan", "hai"] });
  });

  it("requires an expected reply language for multilingual cases", async () => {
    const { app, base } = await withProject();
    const res = await request(app)
      .post(`${base}/test-cases`)
      .send({ module: "multilingual", title: "x", input: "నా ఆర్డర్ ఎక్కడ ఉంది?" })
      .expect(400);
    expect(res.body.error.details[0].path).toBe("expectedLanguage");
    await request(app)
      .post(`${base}/test-cases`)
      .send({ module: "multilingual", title: "x", input: "hi", expectedLanguage: "klingon" })
      .expect(400);
  });

  it("adds sample scenarios once, runs them, and summarizes per language", async () => {
    const { app, base } = await withProject(0);
    const added = await request(app).post(`${base}/multilingual/samples`).expect(201);
    expect(added.body.data.created).toHaveLength(8);
    const again = await request(app).post(`${base}/multilingual/samples`).expect(201);
    expect(again.body.data.created).toHaveLength(0);

    const run = await request(app).post(`${base}/suites/${added.body.data.suiteId}/run`).expect(200);
    expect(run.body.data).toMatchObject({ total: 8, passed: 8 });
    const telugu = run.body.data.executions.find((e: { title: string }) => e.title === "Order status · Telugu");
    expect(telugu).toMatchObject({ module: "multilingual", source: "mock", language: "te" });
    expect(telugu.details.language.detectedIntent).toBe("order_status");

    const summary = await request(app).get(`${base}/multilingual/summary`).expect(200);
    expect(summary.body.data.map((r: { language: string }) => r.language)).toEqual(["en", "te", "te-Latn", "hi", "hi-Latn", "mixed"]);
    expect(summary.body.data[1]).toMatchObject({ language: "te", cases: 2, run: 2, passed: 2, passRate: 100, wrongLanguage: 0 });
  });

  it("counts wrong-language replies in the summary", async () => {
    const { app, base } = await withProject(1);
    const added = await request(app).post(`${base}/multilingual/samples`).expect(201);
    await request(app).post(`${base}/suites/${added.body.data.suiteId}/run`).expect(200);
    const summary = await request(app).get(`${base}/multilingual/summary`).expect(200);
    const hindi = summary.body.data.find((r: { language: string }) => r.language === "hi");
    expect(hindi).toMatchObject({ failed: 1, wrongLanguage: 1, passRate: 0 });
  });
});

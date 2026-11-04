import type { HttpChatbotConfig } from "@testmate/shared";
import { getPath, parsePath } from "../lib/jsonPath";
import { SafeHttpError } from "../lib/safeHttp/errors";
import { safeRequest, type SafeRequestOptions } from "../lib/safeHttp/safeRequest";
import { containsMask, resolveSecrets } from "../lib/secrets";
import type { ChatbotProvider, ChatMessage, ProviderReply } from "./types";

/**
 * A real chatbot at a user-supplied HTTP endpoint. Every call goes through the API Studio's SSRF-safe client
 * (private/metadata addresses blocked, DNS pinned, redirects re-checked, timeout and size cap), and secret
 * headers come only from {{secret:NAME}} placeholders resolved from the server environment.
 * Results are labeled "live". Simulation hints (expected answers, forbidden terms) are never sent.
 */
export class HttpChatbotProvider implements ChatbotProvider {
  readonly name = "http";
  readonly source = "live" as const;

  constructor(
    private readonly config: HttpChatbotConfig,
    private readonly transport: SafeRequestOptions,
  ) {}

  async reply(messages: ChatMessage[]): Promise<ProviderReply> {
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
    for (const h of this.config.headers) {
      if (!h.enabled || !h.key.trim()) continue;
      if (containsMask(h.value)) throw new Error(`Header "${h.key}" has a masked value; use {{secret:NAME}} in the chatbot settings.`);
      headers[h.key.trim().toLowerCase()] = resolveSecrets(h.value);
    }
    const body = JSON.stringify({ message: last, messages: this.config.sendHistory ? messages : [{ role: "user", content: last }] });

    let res;
    try {
      res = await safeRequest({ method: "POST", url: resolveSecrets(this.config.url), headers, body }, this.transport);
    } catch (err) {
      throw new Error(err instanceof SafeHttpError ? err.message : String(err));
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`The chatbot endpoint answered HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}.`);
    }
    if (res.truncated) throw new Error("The chatbot reply was larger than the response size limit.");
    if (!this.config.replyPath.trim()) return { text: res.body };

    let json: unknown;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new Error("The chatbot endpoint did not return JSON. Clear “reply field” to use the raw text body instead.");
    }
    const segments = parsePath(this.config.replyPath);
    if (!segments) throw new Error(`"${this.config.replyPath}" is not a valid reply path.`);
    const { found, value } = getPath(json, segments);
    if (!found) throw new Error(`The chatbot response has no "${this.config.replyPath}" field.`);
    if (typeof value !== "string") throw new Error(`"${this.config.replyPath}" in the chatbot response is not text.`);
    return { text: value };
  }
}

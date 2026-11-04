import type { TestModule } from "@testmate/shared";

export const MODULE_NAMES: Record<TestModule, string> = { chatbot: "Chatbot", memory: "Memory", multilingual: "Multilingual", api: "API" };

/** Where each module's tests live, for "open in lab" links. */
export const LAB_PATH: Record<TestModule, string> = { chatbot: "/chatbot", memory: "/memory", multilingual: "/multilingual", api: "/api-studio" };

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { defineConfig } from "vite";

const envFile = new URL("../.env", import.meta.url);
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const apiTarget = process.env.TESTMATE_API_URL ?? `http://localhost:${process.env.TESTMATE_API_PORT ?? 4000}`;

// Trailing slash matters: "/api" alone would also capture client routes such as /api-studio.
const proxy = { "/api/": { target: apiTarget, changeOrigin: false } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { proxy },
});

#!/usr/bin/env node
/**
 * Validates .env.local against the variables the app actually uses.
 * Run with: npm run check:env
 *
 * - REQUIRED (core): the app cannot function without these.
 * - OPTIONAL (per-feature): missing ones only disable that feature.
 *
 * This is a standalone check — it never runs at build/runtime, so it can't
 * break the app. It just gives a clear, early "you forgot X" signal.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: "Supabase project URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "Supabase anon/public key",
  SUPABASE_SERVICE_ROLE_KEY: "Supabase service_role key (server)",
  ANTHROPIC_API_KEY: "Anthropic key — powers the AI Dungeon Master",
};

const OPTIONAL = {
  OPENAI_API_KEY: "OpenAI — image generation (portraits, scenes)",
  ELEVENLABS_API_KEY: "ElevenLabs — narration + sound effects",
  STRIPE_SECRET_KEY: "Stripe — checkout (billing currently dormant)",
  STRIPE_WEBHOOK_SECRET: "Stripe — webhook signature verification",
  STRIPE_PRICE_TAVERN: "Stripe — Tavern Patron price id",
  STRIPE_PRICE_DM: "Stripe — Dungeon Master price id",
  STRIPE_PRICE_LEGENDARY: "Stripe — Legendary Hero price id",
  INVITE_SECRET: "Party invite-token signing secret",
  NEXT_PUBLIC_BASE_URL: "Base URL for Stripe redirects",
};

// Parse .env.local (simple KEY=VALUE), then let real process.env override.
const fromFile = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) fromFile[m[1]] = m[2];
  }
} else {
  console.warn("⚠  No .env.local found — checking process.env only.\n");
}
const get = (k) => (process.env[k] ?? fromFile[k] ?? "").trim();

let missingRequired = 0;
console.log("Required (core):");
for (const [key, desc] of Object.entries(REQUIRED)) {
  const ok = get(key).length > 0;
  if (!ok) missingRequired++;
  console.log(`  ${ok ? "✓" : "✗ MISSING"}  ${key}  — ${desc}`);
}

console.log("\nOptional (per-feature):");
for (const [key, desc] of Object.entries(OPTIONAL)) {
  const ok = get(key).length > 0;
  console.log(`  ${ok ? "✓" : "·  not set"}  ${key}  — ${desc}`);
}

if (missingRequired > 0) {
  console.error(`\n✗ ${missingRequired} required variable(s) missing. The app will not work correctly.`);
  process.exit(1);
}
console.log("\n✓ All required environment variables are present.");

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { numbersToWords } from "../../../lib/numberSpeech";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_VOICES = ["chronicler", "gravedigger", "bard", "oracle", "shade", "sage"] as const;
type AllowedVoice = typeof ALLOWED_VOICES[number];

const VOICE_CONFIG: Record<AllowedVoice, {
  voiceId:    string;
  stability:  number;
  similarity: number;
  style:      number;
}> = {
  // All voices use stability >= 0.60 and style <= 0.40. At stability < 0.5 the
  // model produces erratic phonemes that sound like "speaking in tongues" or
  // moaning between words. Style above ~0.4 adds dramatic flair at the cost of
  // clarity. The settings below trade a small amount of expressive range for
  // crisp, always-intelligible narration that strictly tracks on-screen text.
  chronicler: {
    voiceId:    "JBFqnCBsd6RMkjVDRZzb",
    stability:  0.78,
    similarity: 0.78,
    style:      0.25,
  },
  gravedigger: {
    voiceId:    "N2lVS1w4EtoT3dr4eOWO",
    // 0.68 → 0.76 + style 0.40 → 0.34: steadier inflection, fewer odd emphases.
    stability:  0.76,
    similarity: 0.80,
    style:      0.34,
  },
  bard: {
    voiceId:    "pFZP5JQG7iQjIQuC4Bku",
    // Lifted 0.62 → 0.74 → 0.80 after continued reports of slurring / odd
    // inflection on bard, the most popular default voice. 0.80 keeps the playful
    // prosody while keeping emphasis and phonemes steady on short-to-medium clips.
    stability:  0.80,
    similarity: 0.80,
    style:      0.28,   // was 0.32 — a touch less expressive overshoot
  },
  oracle: {
    voiceId:    "Xb7hH8MSUJpSbSDYk0k2",
    stability:  0.82,
    similarity: 0.82,
    style:      0.12,
  },
  shade: {
    voiceId:    "SOYHLrjzK2X1ezoPC6cr",
    // Same rationale as bard — 0.65 → 0.72 → 0.78. Shade's hard-edged delivery
    // amplified any erratic phonemes / odd inflection; 0.78 steadies it.
    stability:  0.78,
    similarity: 0.80,
    style:      0.28,
  },
  sage: {
    voiceId:    "pqHfZKP75CvOlQylNhV4",
    stability:  0.82,
    similarity: 0.82,
    style:      0.12,
  },
};

const DEFAULT_VOICE: AllowedVoice = "chronicler";
const MODEL_ID = "eleven_turbo_v2_5";
const BUCKET = "scenes";

// Regexes built from code-point escapes via the RegExp constructor so the
// source file never holds literal control / zero-width characters (which the
// TypeScript parser refuses to handle).
//   Zero-width chars + bidi marks + format chars + BOM
const INVISIBLE_RE = new RegExp(
  "[\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]",
  "g",
);
//   C0 control chars (preserve \n=0x0A, \r=0x0D, \t=0x09) + DEL + C1 controls
const CONTROL_RE = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]",
  "g",
);
//   Pictographic emoji blocks (incl. supplementary). Anything not text or
//   common punctuation that TTS would vocalise as nonsense syllables.
const EMOJI_RE = new RegExp(
  "[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}]",
  "gu",
);
//   Smart quotes -> straight quote
const SMART_SQUOTE_RE = new RegExp("[\\u2018\\u2019\\u201A\\u201B]", "g");
const SMART_DQUOTE_RE = new RegExp("[\\u201C\\u201D\\u201E\\u201F]", "g");
//   Unicode horizontal ellipsis
const ELLIPSIS_RE = new RegExp("\\u2026", "g");
//   Em-dash and en-dash with surrounding whitespace
const DASH_RE = new RegExp("\\s*[\\u2014\\u2013]\\s*", "g");
//   Catch-all: anything that isn't a letter, number, punctuation, mark, or
//   whitespace gets dropped. Prevents any stray glyph from leaking through.
const NON_TEXT_RE = new RegExp("[^\\p{L}\\p{N}\\p{P}\\p{Zs}\\p{M}\\n\\r\\t]", "gu");

function normalizeForTTS(raw: string): string {
  return raw
    // Strip markdown asterisks (bold/italic markers confuse TTS)
    .replace(/\*/g, "")
    // Strip ALL bracketed content — system tokens like [HP:Aria:-9], [1d8+3], etc.
    .replace(/\[[^\]]*\]/g, "")
    .replace(/=/g, " equals ")
    // Strip pictographic emoji — TTS vocalises them as nonsense syllables
    .replace(EMOJI_RE, "")
    // Strip invisible Unicode (zero-width, bidi, format, BOM)
    .replace(INVISIBLE_RE, "")
    // Strip C0 / C1 control characters (preserve \n \r \t)
    .replace(CONTROL_RE, "")
    // Normalize smart quotes -> straight quotes
    .replace(SMART_SQUOTE_RE, "'")
    .replace(SMART_DQUOTE_RE, '"')
    // Ellipsis (single char) and triple-dot sequences -> comma pause.
    // TTS otherwise vocalises "..." as a trailing breath / moan.
    .replace(ELLIPSIS_RE, ", ")
    .replace(/\.{3,}/g, ", ")
    // Markdown horizontal rules (---, ***, ___, longer) — strip the whole line
    .replace(/^[-*_]{2,}\s*$/gm, "")
    // Em-dashes / en-dashes -> natural comma pause
    .replace(DASH_RE, ", ")
    // Closing-quote → attribution pacing fix. ElevenLabs Turbo voices sometimes
    // produce a click, gulp, or stutter at the boundary where a quoted question
    // or exclamation ends and the narrator picks up the attribution
    // (e.g. `"You the elf from the letter?" he says,`). Inserting a comma after
    // the closing quote — only when followed by a lowercase attribution word —
    // gives the model an explicit pause cue and avoids the artifact. The text
    // is still grammatically valid in fiction. Capitalized words after the
    // quote (a new sentence) are left untouched.
    .replace(/([!?])(["'])\s+(?=[a-z])/g, "$1$2, ")
    // Same fix for a quoted statement ending with a period followed by
    // attribution: `"...something." he nodded.` → `"...something.", he nodded.`
    // Only triggers when the next word is lowercase (an attribution like "he
    // said"), never when it starts a new sentence with a capital letter.
    .replace(/(\.)(["'])\s+(?=[a-z])/g, "$1$2, ")
    // Hyphen as separator between words ("HP - Max HP") -> comma pause
    .replace(/\s+-\s+/g, ", ")
    // Leading list-bullet hyphens
    .replace(/^-+\s*/gm, "")
    // Trailing lone hyphen at end of line
    .replace(/-+\s*$/gm, "")
    // Remaining isolated hyphens not part of a compound word
    .replace(/(?<![a-zA-Z0-9])-+(?![a-zA-Z0-9])/g, " ")
    // Strip bare parentheses. The TTS prosody often stumbles on parenthetical
    // clauses; keep the inner words but drop the brackets.
    .replace(/[()]/g, "")
    // Catch-all: strip anything left over that isn't normal text content
    .replace(NON_TEXT_RE, "")
    // Collapse runs of commas (artifacts from em-dash / ellipsis replacement)
    .replace(/,\s*(?:,\s*)+/g, ", ")
    // Collapse extra whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}

// numbersToWords runs as the LAST step (after symbol stripping) so the engine
// pronounces "5" as "five" and "d20" as "d twenty" instead of slurring digits.

async function synthesize(text: string, voice: string, fresh = false): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response("ElevenLabs key not configured", { status: 500 });
  // "Nothing to narrate" cases below return 204 No Content (not 400). The client
  // treats a 204 as "skip this slot" exactly like the old 400, but a 2xx status
  // does NOT show up in the browser console as a failed-resource error — these
  // skips are an expected, frequent part of normal play, not faults.
  if (!text?.trim()) return new Response(null, { status: 204 });

  text = numbersToWords(normalizeForTTS(text));

  // Skip short fragments. Given < ~16 chars of context (raised from 4
  // after continued reports of slurring), ElevenLabs cannot reliably establish
  // prosody and often produces a moan, hum, or "speaking in tongues" burst.
  if (text.length < 16) return new Response(null, { status: 204 });
  // Skip text that's purely punctuation / non-alphanumeric after normalization.
  if (!/[A-Za-z]/.test(text)) return new Response(null, { status: 204 });

  const safeVoice: AllowedVoice = ALLOWED_VOICES.includes(voice as AllowedVoice)
    ? (voice as AllowedVoice)
    : DEFAULT_VOICE;
  const { voiceId, stability, similarity, style } = VOICE_CONFIG[safeVoice];

  // Deterministic storage key — same text+voice always maps to the same file
  const hash = crypto
    .createHash("sha256")
    .update(`${safeVoice}:${text.slice(0, 5000)}`)
    .digest("hex")
    .slice(0, 24);
  const storageFile = `narration/${hash}.mp3`;

  // Minimum bytes for valid audio. Turbo v2.5 produces MP3 at ~64-96 kbps so
  // each char of text yields ~600-800 bytes. We require >= 300 bytes/char before
  // trusting a cached file — anything smaller is a previously-truncated upload.
  const minBytes = Math.max(4096, Math.floor(text.length * 300));

  // Cache-poisoning defense: don't trust the cache for short clips. If an
  // earlier generation produced a garbled clip (rare but happens at low char
  // counts where ElevenLabs has insufficient prosody context), the size
  // check at the cache-read step cannot detect it, and the clip would
  // replay forever. For text under 80 chars we always regenerate. The cost
  // is a few extra TTS calls per session; the gain is that a one-time bad
  // clip cannot persist.
  const SHORT_TEXT_NOCACHE = 80;
  const cacheable = text.length >= SHORT_TEXT_NOCACHE;

  if (!fresh && cacheable) {
    const { data: listed } = await supabase.storage.from(BUCKET).list("narration", { search: hash.slice(0, 8) });
    const cached = listed?.find(f => f.name === `${hash}.mp3`);
    const cachedSize = (cached?.metadata as { size?: number } | undefined)?.size ?? 0;
    if (cached && cachedSize >= minBytes) {
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageFile);
      return Response.json({ audioUrl: publicUrl });
    }
    if (cached && cachedSize < minBytes) {
      console.warn(`[api/narrate] Stale truncated cache (${cachedSize} bytes for ${text.length} chars, need >=${minBytes}) — regenerating`);
    }
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method:  "POST",
    headers: {
      "xi-api-key":   apiKey,
      "Content-Type": "application/json",
      "Accept":       "audio/mpeg",
    },
    body: JSON.stringify({
      text:     text.slice(0, 5000),
      model_id: MODEL_ID,
      voice_settings: {
        stability,
        similarity_boost:  similarity,
        style,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    let parsed: { detail?: { code?: string } } = {};
    try { parsed = JSON.parse(msg); } catch { /* ignore */ }
    if (res.status === 401 && parsed.detail?.code === "quota_exceeded") {
      console.warn("[api/narrate] ElevenLabs quota exhausted");
      return new Response("quota_exceeded", { status: 402 });
    }
    console.error("[api/narrate] ElevenLabs:", res.status, msg);
    return new Response("TTS unavailable", { status: 500 });
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());

  const contentLen = parseInt(res.headers.get("content-length") ?? "0", 10);
  if (audioBuffer.length < minBytes || (contentLen > 0 && Math.abs(contentLen - audioBuffer.length) > 64)) {
    console.warn(`[api/narrate] Truncated TTS payload (got ${audioBuffer.length} bytes, expected >=${minBytes}, content-length ${contentLen}) — not caching`);
    const retryRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body:   JSON.stringify({
        text:     text.slice(0, 5000),
        model_id: MODEL_ID,
        voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: true },
      }),
    });
    if (!retryRes.ok) return new Response("TTS truncated", { status: 502 });
    const retryBuf = Buffer.from(await retryRes.arrayBuffer());
    const retryLen = parseInt(retryRes.headers.get("content-length") ?? "0", 10);
    if (retryBuf.length < minBytes || (retryLen > 0 && Math.abs(retryLen - retryBuf.length) > 64)) {
      console.warn(`[api/narrate] Retry also truncated (got ${retryBuf.length} bytes) — giving up`);
      return new Response("TTS truncated", { status: 502 });
    }
    // Always cache the retry result — even short clips that came through
    // retry are now known-good (size + content-length sanity passed).
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storageFile, retryBuf, { contentType: "audio/mpeg", upsert: true });
    if (upErr) {
      console.error("[api/narrate] Supabase upload (retry):", upErr.message);
      return new Response("Upload failed", { status: 500 });
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageFile);
    return Response.json({ audioUrl: `${publicUrl}?v=${Date.now()}` });
  }

  // For short clips (< SHORT_TEXT_NOCACHE), return the audio inline as a data
  // URL instead of caching. Prevents any single bad clip from persisting in
  // the bucket and re-serving on future identical text.
  if (!cacheable) {
    const dataUrl = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
    return Response.json({ audioUrl: dataUrl });
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageFile, audioBuffer, { contentType: "audio/mpeg", upsert: true });

  if (error) {
    console.error("[api/narrate] Supabase upload:", error.message);
    return new Response("Upload failed", { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storageFile);
  return Response.json({ audioUrl: fresh ? `${publicUrl}?v=${Date.now()}` : publicUrl });
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice, fresh } = (await req.json()) as { text: string; voice?: string; fresh?: boolean };
    return await synthesize(text, voice ?? DEFAULT_VOICE, !!fresh);
  } catch (err) {
    console.error("[api/narrate]", err);
    return Response.json({ error: "TTS unavailable" }, { status: 500 });
  }
}

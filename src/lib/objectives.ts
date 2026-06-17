// Campaign objectives ("quest spine"). Each campaign is generated with an ordered
// list of milestones from a clear opening objective to the campaign's end. The
// list is FIXED at creation; the DM reveals each milestone as the party discovers
// it (hidden -> active) and marks it complete when achieved (active -> done) via
// deterministic [OBJECTIVE-NEW:n] / [OBJECTIVE-DONE:n] tags. The tracker shows the
// revealed objectives and shimmers the current one. Persisted in campaigns.objectives.

export type ObjectiveStatus = "hidden" | "active" | "done";
export type Objective = { id: string; text: string; status: ObjectiveStatus };

/**
 * Build the initial ordered objective list from generated milestone strings. The
 * first is ACTIVE (the campaign's clear opening objective); the rest are HIDDEN
 * until the DM reveals them in order.
 */
export function initObjectives(texts: unknown): Objective[] {
  const arr = Array.isArray(texts) ? texts : [];
  const clean = arr.map(t => String(t ?? "").trim()).filter(Boolean).slice(0, 8);
  return clean.map((text, i) => ({ id: `obj-${i + 1}`, text, status: i === 0 ? "active" : "hidden" }));
}

/** Coerce a stored value (jsonb, maybe null) into a valid Objective[]. */
export function normalizeObjectives(value: unknown): Objective[] {
  if (!Array.isArray(value)) return [];
  const out: Objective[] = [];
  value.forEach((o, i) => {
    if (!o || typeof o !== "object") return;
    const text = String((o as { text?: unknown }).text ?? "").trim();
    if (!text) return;
    const raw = String((o as { status?: unknown }).status ?? "hidden");
    const status: ObjectiveStatus = raw === "active" || raw === "done" ? raw : "hidden";
    const id = String((o as { id?: unknown }).id ?? `obj-${i + 1}`);
    out.push({ id, text, status });
  });
  return out;
}

/** Parse [OBJECTIVE-NEW:n] / [OBJECTIVE-DONE:n] tags (1-based) from DM text. */
export function parseObjectiveTags(text: string): { reveal: number[]; done: number[] } {
  const reveal: number[] = [];
  const done: number[] = [];
  if (!text) return { reveal, done };
  const re = /\[OBJECTIVE-(NEW|DONE):\s*(\d+)\s*\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[2], 10);
    if (!Number.isFinite(n) || n < 1) continue;
    (m[1].toUpperCase() === "NEW" ? reveal : done).push(n);
  }
  return { reveal, done };
}

/**
 * Apply reveal/done tags (1-based indices) to the list. Revealing sets hidden ->
 * active for that objective and everything before it (you can't be on objective 3
 * without having discovered 1 and 2). Completing sets -> done, ensures it was
 * revealed, and auto-reveals the next objective so the party always has a current
 * goal. Returns the same array reference when nothing changed.
 */
export function applyObjectiveTags(
  objectives: Objective[],
  tags: { reveal: number[]; done: number[] },
): Objective[] {
  if (!objectives.length) return objectives;
  const next = objectives.map(o => ({ ...o }));
  let changed = false;
  const revealThrough = (idx: number) => {
    for (let i = 0; i <= idx && i < next.length; i++) {
      if (next[i].status === "hidden") { next[i].status = "active"; changed = true; }
    }
  };
  for (const n of tags.reveal) {
    const i = n - 1;
    if (i >= 0 && i < next.length) revealThrough(i);
  }
  for (const n of tags.done) {
    const i = n - 1;
    if (i < 0 || i >= next.length) continue;
    revealThrough(i);
    if (next[i].status !== "done") { next[i].status = "done"; changed = true; }
    if (i + 1 < next.length && next[i + 1].status === "hidden") { next[i + 1].status = "active"; changed = true; }
  }
  return changed ? next : objectives;
}

/** Objectives the tracker should display (revealed = active or done), in order. */
export function visibleObjectives(objectives: Objective[]): Objective[] {
  return objectives.filter(o => o.status !== "hidden");
}

/** Id of the current goal — the first revealed-but-not-done objective. Shimmers in the UI. */
export function currentObjectiveId(objectives: Objective[]): string | null {
  return objectives.find(o => o.status === "active")?.id ?? null;
}

/** Numbered, status-annotated list for the DM prompt (full spine, including hidden). */
export function objectivesForPrompt(objectives: Objective[]): string {
  return objectives
    .map((o, i) => `${i + 1}. [${o.status}]${currentObjectiveId(objectives) === o.id ? " (current)" : ""} ${o.text}`)
    .join("\n");
}

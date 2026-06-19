// NPC presence tags the DM emits so the engine can show a portrait card for story
// characters (innkeepers, guards, guides, villains in dialogue — anyone present who
// isn't a combat enemy):
//   [NPC:Name:short visual description]  — the NPC is present in the scene
//   [NPC-GONE:Name]                      — the NPC has left
// Tags are stripped from the displayed/spoken text. Names are matched case-
// insensitively so re-introducing the same NPC updates rather than duplicates.

export type NpcEntered = { name: string; desc: string };
export type NpcTags = { entered: NpcEntered[]; gone: string[] };

const NPC_RE      = /\[NPC:([^:\]]{1,40}):([^\]]{0,200})\]/gi;
const NPC_GONE_RE = /\[NPC-GONE:([^\]]{1,40})\]/gi;

export function parseNpcTags(narrative: string): NpcTags {
  const entered: NpcEntered[] = [];
  const gone: string[] = [];
  if (!narrative) return { entered, gone };

  let m: RegExpExecArray | null;
  NPC_RE.lastIndex = 0;
  while ((m = NPC_RE.exec(narrative)) !== null) {
    const name = m[1].trim();
    const desc = m[2].trim();
    if (name) entered.push({ name, desc });
  }
  NPC_GONE_RE.lastIndex = 0;
  while ((m = NPC_GONE_RE.exec(narrative)) !== null) {
    const name = m[1].trim();
    if (name) gone.push(name);
  }
  return { entered, gone };
}

/** Strip NPC tags from text headed to display / TTS. */
export function stripNpcTags(text: string): string {
  return text.replace(NPC_RE, "").replace(NPC_GONE_RE, "");
}

// Maps the frontend chat history into the {role, content} array sent to the DM
// model. Extracted from the chat route so the attribution logic can be unit
// tested in isolation (see scripts/test-dm-message-format.ts).
//
// THE BUG THIS PREVENTS: player messages are normally prefixed "[Name]: ..." so
// the DM knows who is speaking. If a player message reaches the DM WITHOUT a
// sender (campaign bootstrap "Begin our adventure.", party join/leave
// announcements, or any stray system trigger), the old code sent the content
// RAW — and the model, primed to expect a [Name] prefix, broke the fourth wall
// to ask "This message isn't tagged with a character name — who's speaking?".
// Framing sender-less messages as [SYSTEM]: turns them into an out-of-world
// stage cue the DM handles in-character.

export type FrontendMessage = { role: string; content: string; sender?: string };
export type DMMessage = { role: "user" | "assistant"; content: string };

export function formatMessagesForDM(messages: FrontendMessage[]): DMMessage[] {
  return messages
    .filter((m) => m.role === "player" || m.role === "dm")
    .map((m) => {
      if (m.role === "dm") return { role: "assistant" as const, content: m.content };
      const sender = (m.sender ?? "").trim();
      return {
        role: "user" as const,
        content: sender ? `[${sender}]: ${m.content}` : `[SYSTEM]: ${m.content}`,
      };
    });
}

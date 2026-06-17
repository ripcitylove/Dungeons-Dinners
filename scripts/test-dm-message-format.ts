// Verifies the DM message attribution never sends an unattributed player line
// (which made the DM break character: "who's speaking?"). Run:
//   node scripts/test-dm-message-format.ts
import { formatMessagesForDM } from "../src/lib/dmMessageFormat.ts";

let pass = 0;
const fails: string[] = [];
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) pass++;
  else fails.push(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
};

// Normal in-character action → [Name]: prefix
{
  const out = formatMessagesForDM([{ role: "player", content: "I draw my sword.", sender: "Pookie" }]);
  check("tagged action gets [Name]: prefix", out[0].content === "[Pookie]: I draw my sword.", out[0].content);
  check("tagged action is a user turn", out[0].role === "user");
}
// DM reply → assistant, unchanged
{
  const out = formatMessagesForDM([{ role: "dm", content: "The door creaks open." }]);
  check("dm becomes assistant", out[0].role === "assistant" && out[0].content === "The door creaks open.");
}
// THE BUG: player message with NO sender → must be framed, never bare
{
  const out = formatMessagesForDM([{ role: "player", content: "Drag Tiegan to safety, away from danger" }]);
  check("sender-less player message is framed as [SYSTEM]", out[0].content === "[SYSTEM]: Drag Tiegan to safety, away from danger", out[0].content);
}
// Empty-string sender (opening trigger, join/leave) → framed, not bare
{
  const out = formatMessagesForDM([{ role: "player", content: "Begin our adventure.", sender: "" }]);
  check("empty-sender trigger is framed as [SYSTEM]", out[0].content === "[SYSTEM]: Begin our adventure.", out[0].content);
}
// Whitespace-only sender → framed
{
  const out = formatMessagesForDM([{ role: "player", content: "X joins the party.", sender: "   " }]);
  check("whitespace-only sender is framed as [SYSTEM]", out[0].content === "[SYSTEM]: X joins the party.", out[0].content);
}
// system-role messages are dropped (prior behavior)
{
  const out = formatMessagesForDM([{ role: "system", content: "— Tiegan has fallen unconscious —" }]);
  check("system role is dropped", out.length === 0);
}
// INVARIANT over a mixed transcript: every user message is attributed
// (starts with "[") — never a bare player line that triggers "who's speaking?".
{
  const transcript: { role: string; content: string; sender?: string }[] = [
    { role: "player", content: "Begin our adventure.", sender: "" },
    { role: "dm", content: "You stand at the tavern door." },
    { role: "player", content: "I look around.", sender: "Pookie" },
    { role: "dm", content: "What do you do, Pookie?" },
    { role: "player", content: "Use shortbow to attack the nearest threat" }, // <- the bug: no sender
    { role: "system", content: "— turn passed —" },
  ];
  const out = formatMessagesForDM(transcript);
  const bareUser = out.filter(m => m.role === "user" && !m.content.startsWith("["));
  check("no bare unattributed user messages in mixed transcript", bareUser.length === 0,
    bareUser.length ? `bare: ${JSON.stringify(bareUser)}` : "");
}

console.log(`\nDM message-format battery: ${pass} checks passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Every player message is attributed; the DM can never receive an unidentified speaker.");

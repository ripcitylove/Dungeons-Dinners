// Verifies scene-wide silence is detected (so bustling ambiance stops) while a
// single NPC going quiet, or ordinary "quiet" prose, does NOT mute the scene.
import { detectAmbianceMood } from "../src/lib/ambianceMood.ts";

let pass = 0;
const fails: string[] = [];
const silent = (name: string, text: string) => {
  if (detectAmbianceMood(text) === "silent") pass++;
  else fails.push(`  ✗ expected SILENT: ${name}`);
};
const normal = (name: string, text: string) => {
  if (detectAmbianceMood(text) === null) pass++;
  else fails.push(`  ✗ expected normal (null): ${name}`);
};

// Should mute ambiance — scene-wide unnatural silence
silent("screenshot: harbor remains unnaturally silent", "The harbor remains unnaturally silent, the golden light pulsing with quiet urgency.");
silent("log: harbor goes completely silent + no waves/gulls", "The golden light pulses again — and this time the harbor goes completely silent. No waves. No gulls. No distant tavern noise.");
silent("utter silence fell", "An utter silence fell over the chamber.");
silent("forest grows eerily quiet", "The forest grows eerily quiet around you.");
silent("deathly silent", "The hall is deathly silent now.");
silent("all sound vanished", "In an instant, all sound vanished from the square.");
silent("dead silence", "Dead silence. Even your own heartbeat sounds loud.");
silent("not a single sound", "You strain to hear — not a single sound reaches you.");
silent("silence so heavy", "A silence so heavy it presses on your ears settles over the camp.");
silent("everything falls still", "Everything falls still, as if the world is holding its breath.");

// Should NOT mute — a person quieting, or 'quiet' as ordinary description
normal("one NPC falls silent", "The bard falls silent, studying your face.");
normal("she goes quiet", "She goes quiet for a moment, then nods.");
normal("quiet tavern as setting", "A quiet tavern sits at the end of the lane, lanterns glowing.");
normal("quiet hum of the market", "The quiet hum of the market fills the morning air.");
normal("plain narration", "The orc collapses and the party presses deeper into the cavern.");
normal("he whispers quietly", "He leans in and whispers quietly so the guards won't hear.");

console.log(`\nAmbiance-mood battery: ${pass} passed, ${fails.length} failed.`);
if (fails.length) { console.log(fails.join("\n")); process.exitCode = 1; }
else console.log("✓ Scene-wide silence mutes ambiance; a single voice quieting does not.");

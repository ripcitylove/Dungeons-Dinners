import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import "./globals.css";
import LandingNav from "../components/LandingNav";
import { LandingIcon, type LandingIconName } from "../components/LandingIcons";

const CLASS_COLORS: Record<string, string> = {
  Fighter: "#ef4444", Wizard: "#8b5cf6", Rogue: "#94a3b8",
  Cleric: "#f59e0b", Paladin: "#f97316", Ranger: "#22c55e",
  Bard: "#ec4899", Warlock: "#7c3aed", Barbarian: "#dc2626",
  Druid: "#16a34a", Monk: "#0ea5e9", Sorcerer: "#a855f7",
};

async function getAdventurers() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await sb
      .from("characters")
      .select("name, race, class, portrait_url")
      .not("portrait_url", "is", null)
      .neq("portrait_url", "")
      .limit(100);
    if (!data?.length) return [];
    const arr = [...data];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 8).map(c => ({ name: c.name as string, race: c.race as string, cls: c.class as string, url: c.portrait_url as string }));
  } catch {
    return [];
  }
}

type FeatureCard = { icon: LandingIconName; title: string; desc: string };
type StepCard    = { n: string; icon: LandingIconName; title: string; desc: string };

const FEATURES: FeatureCard[] = [
  {
    icon: "dungeon-master",
    title: "Expert AI Dungeon Master",
    desc: "Claude — Anthropic's most capable model — runs the whole world. Every NPC voice, every rule, every dice math. It remembers what your party has done and serves it back when the moment's right.",
  },
  {
    icon: "combat",
    title: "Living Combat Engine",
    desc: "Initiative, attack rolls, saving throws, spell slots, conditions, item bonuses — all tracked automatically. Encounters scale to your party size so every fight is earned, never canned.",
  },
  {
    icon: "multiplayer",
    title: "Pull Up a Chair",
    desc: "Gather the whole table around one screen for couch co-op. Everyone shares the adventure while the DM runs the world — HP, gold, XP, and status effects all tracked live as the story unfolds.",
  },
  {
    icon: "voice",
    title: "AI Voice & Atmosphere",
    desc: "Pick a narrator voice and the DM reads the story aloud. Dynamic music tracks shift between exploration, combat, and the tavern. Built to play on a TV with friends and snacks.",
  },
  {
    icon: "portrait",
    title: "AI Painted Portraits",
    desc: "Every character gets a one-of-a-kind painted portrait the moment they're rolled — race, class, sex, and appearance all baked in. Regenerate anytime until it tastes right.",
  },
  {
    icon: "controller",
    title: "PC & Xbox Ready",
    desc: "Built for couch viewing. Console-class fonts, controller-friendly focus rings, and full keyboard / D-pad navigation in MS Edge on Xbox. Dinner on the table, dragons on the screen.",
  },
];

const STEPS: StepCard[] = [
  {
    n: "01",
    icon: "forge",
    title: "Forge Your Hero",
    desc: "Pick race, class, sex, alignment, and roll your stats. The AI paints a one-of-a-kind portrait and gives them a backstory hook. Levels, gold, and gear persist across every campaign they join — like a regular at the tavern.",
  },
  {
    n: "02",
    icon: "map",
    title: "Set the Table",
    desc: "Create your own world with a single prompt. Play solo, or gather the party around one screen for couch co-op — the DM scales the courses to fit either way.",
  },
  {
    n: "03",
    icon: "spellbook",
    title: "Let the Legend Begin",
    desc: "The Dungeon Master opens with a scene, voices every NPC, runs every encounter, and remembers everything your party does. The kitchen never closes — resume anytime, exactly where you left off.",
  },
];

export default async function Home() {
  const adventurers = await getAdventurers();
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <LandingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "100px 24px 80px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Deep background glow */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(ellipse 90% 55% at 50% 48%, rgba(30,27,75,0.85) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "800px", height: "400px", background: "var(--primary)", filter: "blur(220px)", opacity: 0.1, zIndex: 0 }} />

        {/* Dragon — left, contained to its half with inner fade */}
        <div className="hero-img-panel hero-img-left animate-float" style={{ animationDelay: "0.3s" }}>
          <Image src="/Dragon_Ramen.png" alt="" fill sizes="(max-width: 860px) 1px, 46vw" style={{ objectFit: "contain", objectPosition: "right center" }} priority />
          <div className="hero-fade-right" />
        </div>

        {/* Party — right, contained to its half with inner fade */}
        <div className="hero-img-panel hero-img-right animate-float" style={{ animationDelay: "1.1s" }}>
          <Image src="/GangGang.png" alt="" fill sizes="(max-width: 860px) 1px, 46vw" style={{ objectFit: "contain", objectPosition: "left center" }} priority />
          <div className="hero-fade-left" />
        </div>

        {/* Center content — above images */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "680px" }}>
          <div className="animate-fade-in" style={{
            display: "inline-block",
            background: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(245,158,11,0.12))",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: "100px",
            padding: "6px 18px",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#c4b5fd",
            marginBottom: "28px",
          }}>
            AI Dungeons · Real Friends · Hot Plates
          </div>

          <h1 className="animate-fade-in delay-100 shimmer-heading" style={{
            fontSize: "clamp(3rem, 7vw, 5.8rem)",
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: "-0.02em",
            marginBottom: "28px",
          }}>
            Your Next Great<br />Adventure Awaits
          </h1>

          <p className="animate-fade-in delay-200" style={{
            fontSize: "clamp(1rem, 2vw, 1.15rem)",
            color: "var(--subtle)",
            maxWidth: "560px",
            marginBottom: "44px",
            lineHeight: 1.85,
          }}>
            No human DM needed. Claude AI voices every NPC, runs every encounter,
            and remembers your party&apos;s every choice. Pull up a chair —
            every player gets a seat at the table.
          </p>

          <div className="animate-fade-in delay-300" style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/auth">
              <button className="btn-primary" style={{ fontSize: "0.7rem", padding: "16px 44px", borderRadius: "10px" }}>
                Enter the Tavern
              </button>
            </Link>
            <a href="#how-it-works">
              <button className="btn-secondary" style={{ fontSize: "0.79rem", padding: "16px 28px", borderRadius: "10px" }}>
                How It Works ↓
              </button>
            </a>
          </div>

          {/* Stats strip */}
          <div className="animate-fade-in delay-300" style={{
            display: "flex",
            gap: "0",
            marginTop: "64px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            overflow: "hidden",
          }}>
            {[
              { value: "5e", label: "Rules at the Table" },
              { value: "10", label: "Seats at the Table" },
              { value: "AI", label: "Dungeon Master" },
              { value: "∞", label: "Stories on the Menu" },
            ].map(({ value, label }, i) => (
              <div key={label} style={{
                textAlign: "center",
                padding: "20px 32px",
                borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}>
                <div style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)", fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>{value}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Adventurers Showcase ──────────────────────────────────────────────── */}
      {adventurers.length > 0 && (
        <section style={{ padding: "100px 24px", textAlign: "center", borderTop: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "800px", height: "400px", background: "var(--primary)", filter: "blur(180px)", opacity: 0.06, zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ color: "var(--primary)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>Real Players. Real Characters.</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, marginBottom: "16px" }}>Meet the Adventurers</h2>
            <p style={{ color: "var(--subtle)", maxWidth: "480px", margin: "0 auto 60px", lineHeight: 1.8, fontSize: "0.79rem" }}>
              Every character gets a one-of-a-kind AI-painted portrait the moment they&apos;re created.
            </p>

            <div style={{
              display: "flex",
              gap: "24px",
              justifyContent: "center",
              flexWrap: "wrap",
              maxWidth: "1200px",
              margin: "0 auto",
            }}>
              {adventurers.map(({ name, race, cls, url }, i) => {
                const color = CLASS_COLORS[cls] ?? "var(--primary)";
                return (
                  <div key={name} className="portrait-card" style={{ animationDelay: `${i * 0.3}s` }}>
                    <div style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "3/4",
                      overflow: "hidden",
                      borderRadius: "12px 12px 0 0",
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        background: `linear-gradient(to top, ${color}22 0%, transparent 50%)`,
                        pointerEvents: "none",
                      }} />
                    </div>
                    <div style={{
                      padding: "14px 16px",
                      background: `linear-gradient(135deg, rgba(22,30,50,0.95), rgba(15,20,40,0.98))`,
                      borderTop: `2px solid ${color}55`,
                      borderRadius: "0 0 12px 12px",
                    }}>
                      <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#f1f5f9", marginBottom: "3px" }}>{name}</div>
                      <div style={{ fontSize: "0.65rem", color, fontWeight: 600, letterSpacing: "0.04em" }}>{race} · {cls}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── What Is This ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid var(--border)" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "72px",
          alignItems: "center",
          maxWidth: "1100px",
          margin: "0 auto",
        }}>
          <div>
            <p style={{ color: "var(--primary)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>No Human DM Required</p>
            <h2 style={{ fontSize: "clamp(1.9rem, 4vw, 2.9rem)", fontWeight: 900, lineHeight: 1.18, marginBottom: "28px" }}>
              The AI Runs the World.<br />
              <span style={{ color: "var(--primary)" }}>You Just Eat &amp; Play.</span>
            </h2>
            <p style={{ color: "var(--subtle)", lineHeight: 1.9, marginBottom: "22px", fontSize: "0.79rem" }}>
              Dungeons &amp; Dinner Legends puts Claude AI in the Dungeon Master&apos;s seat.
              It runs enemies, voices NPCs, builds encounters, drops loot, and weaves the
              overarching narrative — completely autonomously, faithful to D&amp;D 5e rules.
            </p>
            <p style={{ color: "var(--subtle)", lineHeight: 1.9, fontSize: "0.79rem" }}>
              Every person at the table plays a character. No one sits out to manage the game.
              Order delivery, crack a drink, roll up a hero, and dive in — the AI handles the rest.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              "Follows D&D 5e rules faithfully — spells, conditions, item bonuses, and stat blocks all correct",
              "Reacts to your choices in real time, crafting fresh narrative on the fly",
              "Tracks all combat: initiative, HP, spell slots, conditions, status effects, and loot",
              "Scales encounter difficulty to your party size and average level on every turn",
              "Voices NPCs, merchants, villains, and wandering monsters with distinct personalities",
              "Plays solo or with the whole party gathered around one screen for couch co-op",
              "Remembers the choices, boasts, mercies, and grudges your party leaves behind",
              "Resume anytime — every session picks up exactly where you left off",
            ].map((text) => (
              <div key={text} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ color: "var(--primary)", marginTop: "3px", flexShrink: 0, fontSize: "0.74rem" }}>✦</span>
                <span style={{ color: "#cbd5e1", lineHeight: 1.7, fontSize: "0.79rem" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <p style={{ color: "var(--primary)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>Everything on the Menu</p>
        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.7rem)", fontWeight: 800, marginBottom: "16px" }}>Served Up Hot &amp; Ready</h2>
        <p style={{ color: "var(--subtle)", maxWidth: "480px", margin: "0 auto 60px", lineHeight: 1.8, fontSize: "0.79rem" }}>
          Every system of D&amp;D 5e faithfully implemented — so you can focus on the food, the friends, and the fight.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "22px", maxWidth: "1240px", margin: "0 auto", alignItems: "stretch" }}>
          {FEATURES.map(({ icon, title, desc }, i) => (
            <div key={title} className="glass-panel feature-card-lg animate-float" style={{ animationDelay: `${i * 0.7}s`, textAlign: "center", alignItems: "center" }}>
              <LandingIcon name={icon} size={80} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "white", letterSpacing: "0.01em", lineHeight: 1.25 }}>{title}</h3>
              <p style={{ color: "var(--subtle)", fontSize: "0.82rem", lineHeight: 1.75, maxWidth: "32ch" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "100px 24px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <p style={{ color: "var(--primary)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>Three Courses to Glory</p>
        <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.7rem)", fontWeight: 800, marginBottom: "60px" }}>How to Play</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", maxWidth: "900px", margin: "0 auto" }}>
          {STEPS.map(({ n, icon, title, desc }) => (
            <div key={n} className="glass-panel step-card">
              <div style={{ position: "absolute", top: "-4px", right: "18px", fontSize: "5rem", fontWeight: 900, color: "rgba(139,92,246,0.07)", lineHeight: 1, userSelect: "none", pointerEvents: "none" }}>{n}</div>
              <div style={{ marginBottom: "16px" }}><LandingIcon name={icon} size={64} /></div>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "12px", color: "white" }}>{title}</h3>
              <p style={{ color: "var(--subtle)", fontSize: "0.74rem", lineHeight: 1.8 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 24px", textAlign: "center", borderTop: "1px solid var(--border)", position: "relative" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "700px", height: "350px", background: "var(--primary)", filter: "blur(180px)", opacity: 0.1, zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{
            fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
            fontWeight: 900,
            marginBottom: "24px",
            background: "linear-gradient(155deg, #ffffff 25%, #c4b5fd 60%, #f59e0b 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.1,
          }}>
            The Table Is Set.<br />Dinner Awaits.
          </h2>
          <p style={{ color: "var(--subtle)", fontSize: "0.7rem", maxWidth: "420px", margin: "0 auto 48px", lineHeight: 1.85 }}>
            Your hero is one click away. Forge a legend, share the meal, and step into a world
            that never runs out of next courses.
          </p>
          <Link href="/auth">
            <button className="btn-primary" style={{ fontSize: "0.9rem", padding: "20px 60px", borderRadius: "12px" }}>
              Enter the Tavern
            </button>
          </Link>
        </div>
      </section>

      {/* ── Publisher Badge ───────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: "20px", right: "20px", zIndex: 50,
        background: "white", borderRadius: "14px", padding: "8px",
        boxShadow: "0 0 0 1px rgba(139,92,246,0.35), 0 0 24px rgba(139,92,246,0.45), 0 0 52px rgba(139,92,246,0.2), 0 8px 32px rgba(0,0,0,0.55)",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/DrinkPlayLogo.jpg" alt="Drink and Play Publishing" style={{ width: "120px", height: "120px", objectFit: "cover", display: "block", borderRadius: "8px" }} />
      </div>
    </main>
  );
}

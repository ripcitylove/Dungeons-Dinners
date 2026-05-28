import Link from "next/link";
import "./globals.css";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", background: "#0d0906" }}>

      {/* Override the global purple-tinted body gradient */}
      <div style={{ position: "fixed", inset: 0, zIndex: -3, background: "#0d0906" }} />

      {/* Warm firelight radial glow — centre of page */}
      <div style={{
        position: "fixed", inset: 0, zIndex: -2, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 44%, rgba(200, 82, 14, 0.2) 0%, transparent 62%)"
      }} />

      {/* Edge vignette */}
      <div style={{
        position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 50%, transparent 32%, rgba(4, 2, 1, 0.68) 100%)"
      }} />

      {/* ── Drink & Play Publishing badge (bottom-right) ── */}
      <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 50 }}>
        <div style={{
          background: "rgba(244, 237, 218, 0.97)",
          borderRadius: "14px",
          padding: "8px",
          boxShadow: "0 6px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(155, 110, 40, 0.4)",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/DrinkPlayLogo.jpg"
            alt="Drink and Play Publishing"
            style={{ width: "86px", display: "block", borderRadius: "6px" }}
          />
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ position: "relative", zIndex: 10, padding: "20px 36px", display: "flex", justifyContent: "flex-end" }}>
        <Link href="/auth">
          <button className="btn-tavern-outline">Log In</button>
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 20px 80px",
        position: "relative",
        zIndex: 10,
      }}>

        {/* Game logo */}
        <div className="animate-fade-in" style={{ position: "relative", marginBottom: "32px" }}>
          {/* Amber halo */}
          <div style={{
            position: "absolute", inset: "-40px", borderRadius: "50%", zIndex: -1,
            background: "radial-gradient(circle, rgba(215, 100, 18, 0.28) 0%, transparent 68%)",
            filter: "blur(28px)",
          }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/DNDLegendsLogo.png"
            alt="Dungeons and Dinner Legends — A Drink and Play Game"
            style={{
              width: "100%",
              maxWidth: "500px",
              maxHeight: "80vh",
              objectFit: "contain",
              display: "block",
              filter: "drop-shadow(0 0 44px rgba(205, 98, 16, 0.55)) drop-shadow(0 10px 40px rgba(0,0,0,0.85))",
            }}
          />
        </div>

        {/* Subtitle */}
        <p
          className="animate-fade-in delay-100"
          style={{ color: "#9a7850", fontSize: "1.05rem", maxWidth: "480px", lineHeight: 1.8, marginBottom: "40px", letterSpacing: "0.01em" }}
        >
          AI Dungeon Master · Full D&amp;D 5e rules · Real-time multiplayer
          <br />
          <span style={{ color: "#6b5035", fontSize: "0.9rem" }}>Forge your party. Let the story begin.</span>
        </p>

        {/* CTA */}
        <div className="animate-fade-in delay-200">
          <Link href="/auth">
            <button className="btn-amber">Enter the Tavern</button>
          </Link>
        </div>

        {/* Divider */}
        <div
          className="animate-fade-in delay-300"
          style={{ display: "flex", alignItems: "center", gap: "18px", margin: "72px 0 36px", width: "100%", maxWidth: "860px" }}
        >
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, rgba(155, 95, 28, 0.35))" }} />
          <span style={{ color: "#6b5035", fontSize: "1rem" }}>⚔</span>
          <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, rgba(155, 95, 28, 0.35))" }} />
        </div>

        {/* Feature cards */}
        <div
          className="animate-fade-in delay-300"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", maxWidth: "860px", width: "100%" }}
        >
          <div className="tavern-card" style={{ padding: "28px 24px", textAlign: "left" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "14px" }}>🧙‍♂️</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px", color: "#e8c88a" }}>Expert AI DM</h3>
            <p style={{ color: "#7a6040", fontSize: "0.88rem", lineHeight: 1.65 }}>
              Knows every rule, monster, and spell. Crafts dynamic encounters and unforgettable narrative on the fly.
            </p>
          </div>

          <div className="tavern-card animate-float" style={{ padding: "28px 24px", textAlign: "left" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "14px" }}>🎲</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px", color: "#e8c88a" }}>Live Combat &amp; Dice</h3>
            <p style={{ color: "#7a6040", fontSize: "0.88rem", lineHeight: 1.65 }}>
              Real-time encounters with tracked enemies, dice rolls, loot, and XP — everything your party needs.
            </p>
          </div>

          <div className="tavern-card" style={{ padding: "28px 24px", textAlign: "left" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "14px" }}>🌍</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px", color: "#e8c88a" }}>Multiplayer Worlds</h3>
            <p style={{ color: "#7a6040", fontSize: "0.88rem", lineHeight: 1.65 }}>
              Play solo or with your party. Share a campaign link and every hero joins the same living world.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

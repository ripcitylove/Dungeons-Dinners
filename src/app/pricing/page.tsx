"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import "../globals.css";

export default function Pricing() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const router = useRouter();

  const handleSubscribe = async (tier: string) => {
    setLoadingTier(tier);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, userId: user.id }),
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initialize checkout");
        setLoadingTier(null);
      }
    } catch (error) {
      console.error(error);
      setLoadingTier(null);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "40px 20px", alignItems: "center" }}>
      <nav style={{ width: "100%", maxWidth: "1200px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px" }}>
        <Link href="/" style={{ fontSize: "1.5rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "var(--primary)" }}>⬡</span> D&D Legends
        </Link>
        <Link href="/dashboard" className="btn-secondary">Back to Tavern</Link>
      </nav>

      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <h1 className="animate-fade-in" style={{ fontSize: "3.5rem", fontWeight: 800, background: "linear-gradient(to right, #fff, #cbd5e1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "16px" }}>
          Choose Your Destiny
        </h1>
        <p className="animate-fade-in delay-100" style={{ fontSize: "1.25rem", color: "#94a3b8", maxWidth: "600px", margin: "0 auto" }}>
          Unlock the full power of your AI Dungeon Master. From casual adventurers to legendary heroes.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px", width: "100%", maxWidth: "1200px" }}>

        {/* Free */}
        <div className="glass-panel animate-fade-in delay-200" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "8px" }}>Free Trial</h3>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "24px" }}>
            $0<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 400 }}> / session</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: "12px", flex: 1, color: "#cbd5e1" }}>
            <li>✓ 1 Active Campaign</li>
            <li>✓ Max Level 3 Characters</li>
            <li>✓ Up to 3 Players</li>
            <li>✓ Claude AI Dungeon Master</li>
          </ul>
          <Link href="/create-character" style={{ width: "100%" }}>
            <button className="btn-secondary" style={{ width: "100%" }}>Start Playing</button>
          </Link>
        </div>

        {/* Tavern Patron */}
        <div className="glass-panel animate-fade-in delay-300" style={{ padding: "32px", display: "flex", flexDirection: "column", position: "relative", transform: "scale(1.05)", border: "1px solid var(--primary)", boxShadow: "0 0 30px rgba(139, 92, 246, 0.2)" }}>
          <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "var(--primary)", color: "white", padding: "4px 12px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold" }}>
            MOST POPULAR
          </div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "8px", color: "var(--primary)" }}>Tavern Patron</h3>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "24px" }}>
            $9.99<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 400 }}> / month</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: "12px", flex: 1, color: "#cbd5e1" }}>
            <li>✓ 5 Saved Campaigns</li>
            <li>✓ Persistent Session History</li>
            <li>✓ Up to 5 Players per Party</li>
            <li>✓ Claude Sonnet AI DM</li>
          </ul>
          <button className="btn-primary" style={{ width: "100%" }} onClick={() => handleSubscribe("Tavern Patron")} disabled={loadingTier !== null}>
            {loadingTier === "Tavern Patron" ? "Processing..." : "Subscribe Now"}
          </button>
        </div>

        {/* Dungeon Master */}
        <div className="glass-panel animate-fade-in delay-300" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "8px" }}>Dungeon Master</h3>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "24px" }}>
            $19.99<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 400 }}> / month</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: "12px", flex: 1, color: "#cbd5e1" }}>
            <li>✓ Unlimited Campaigns</li>
            <li>✓ Up to 10 Players per Party</li>
            <li>✓ Claude Opus AI DM</li>
            <li>✓ Priority Response Speed</li>
          </ul>
          <button className="btn-secondary" style={{ width: "100%" }} onClick={() => handleSubscribe("Dungeon Master")} disabled={loadingTier !== null}>
            {loadingTier === "Dungeon Master" ? "Processing..." : "Subscribe Now"}
          </button>
        </div>

        {/* Legendary Hero */}
        <div className="glass-panel animate-fade-in delay-300" style={{ padding: "32px", display: "flex", flexDirection: "column", border: "1px solid var(--secondary)" }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "8px", color: "var(--secondary)" }}>Legendary Hero</h3>
          <div style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "24px" }}>
            $39.99<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 400 }}> / month</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: "12px", flex: 1, color: "#cbd5e1" }}>
            <li>✓ Everything in DM tier</li>
            <li>✓ Real-time Scene Image Generation</li>
            <li>✓ Custom Character Portraits</li>
            <li>✓ Priority Support</li>
          </ul>
          <button className="btn-secondary" style={{ width: "100%", borderColor: "var(--secondary)", color: "var(--secondary)" }} onClick={() => handleSubscribe("Legendary Hero")} disabled={loadingTier !== null}>
            {loadingTier === "Legendary Hero" ? "Processing..." : "Become a Legend"}
          </button>
        </div>

      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import "../globals.css";

type Campaign = { id: string; title: string; description: string; created_at: string };
type Character = { id: string; name: string; race: string; class: string; level: number };
type Tier = "free" | "tavern" | "dm" | "legendary";

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  tavern: "Tavern Patron",
  dm: "Dungeon Master",
  legendary: "Legendary Hero",
};

const TIER_COLORS: Record<Tier, string> = {
  free: "#64748b",
  tavern: "var(--primary)",
  dm: "var(--secondary)",
  legendary: "#f59e0b",
};

const CAMPAIGN_LIMITS: Record<Tier, number> = {
  free: 1,
  tavern: 5,
  dm: Infinity,
  legendary: Infinity,
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tier, setTier] = useState<Tier>("free");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }

      setUserEmail(user.email ?? "");

      const [charsRes, campsRes, profileRes] = await Promise.all([
        supabase.from("characters").select("id, name, race, class, level").eq("user_id", user.id),
        supabase.from("campaigns").select("id, title, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("subscription_tier").eq("id", user.id).maybeSingle(),
      ]);

      if (charsRes.data) setCharacters(charsRes.data as Character[]);
      if (campsRes.data) setCampaigns(campsRes.data as Campaign[]);
      if (profileRes.data?.subscription_tier) setTier(profileRes.data.subscription_tier as Tier);

      setLoading(false);
    }
    loadDashboard();
  }, [router]);

  const startNewCampaign = async () => {
    const limit = CAMPAIGN_LIMITS[tier];
    if (campaigns.length >= limit) {
      const upgradeMsg = tier === "free"
        ? "Free accounts can only have 1 campaign. Upgrade to Tavern Patron for 5, or DM tier for unlimited."
        : `Your ${TIER_LABELS[tier]} plan allows up to ${limit} campaigns. Upgrade for unlimited.`;
      alert(upgradeMsg);
      router.push("/pricing");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("campaigns")
      .insert([{ title: "New Adventure", description: "A freshly created campaign.", user_id: user.id }])
      .select();

    if (!error && data?.[0]) {
      router.push(`/campaign/${data[0].id}`);
    } else {
      console.error(error);
      alert("Failed to start campaign.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        Loading Tavern...
      </div>
    );
  }

  const campaignLimit = CAMPAIGN_LIMITS[tier];
  const atLimit = campaigns.length >= campaignLimit;

  return (
    <main style={{ minHeight: "100vh", padding: "40px" }}>
      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
          <span style={{ color: "var(--primary)" }}>⬡</span> Tavern Dashboard
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {/* Tier badge */}
          <span style={{
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "0.8rem",
            fontWeight: "bold",
            border: `1px solid ${TIER_COLORS[tier]}`,
            color: TIER_COLORS[tier],
          }}>
            {TIER_LABELS[tier]}
          </span>
          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{userEmail}</span>
          {tier === "free" && (
            <Link href="/pricing">
              <button className="btn-primary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                Upgrade ↑
              </button>
            </Link>
          )}
          <button onClick={signOut} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            Sign Out
          </button>
        </div>
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "32px" }}>
        {/* Campaigns */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <h2 style={{ fontSize: "1.8rem" }}>Active Campaigns</h2>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {campaigns.length} / {campaignLimit === Infinity ? "∞" : campaignLimit} used
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {campaigns.length === 0 && (
              <p style={{ color: "#94a3b8" }}>No campaigns yet. Start one below!</p>
            )}

            {campaigns.map((camp) => (
              <div key={camp.id} className="glass-panel animate-fade-in" style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1.2rem", marginBottom: "6px" }}>{camp.title}</h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "8px" }}>{camp.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <code style={{ fontSize: "0.72rem", color: "#475569", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: "4px" }}>
                      ID: {camp.id.slice(0, 8)}...
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/campaign/${camp.id}`)}
                      style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}
                    >
                      🔗 Copy invite link
                    </button>
                  </div>
                </div>
                <Link href={`/campaign/${camp.id}`}>
                  <button className="btn-primary">Resume Session</button>
                </Link>
              </div>
            ))}

            {/* New campaign button */}
            <div
              className="glass-panel animate-fade-in"
              style={{ padding: "24px", display: "flex", justifyContent: "center", alignItems: "center", borderStyle: "dashed", opacity: atLimit ? 0.6 : 1 }}
            >
              {atLimit ? (
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#94a3b8", marginBottom: "12px", fontSize: "0.9rem" }}>
                    Campaign limit reached ({campaigns.length}/{campaignLimit === Infinity ? "∞" : campaignLimit})
                  </p>
                  <Link href="/pricing">
                    <button className="btn-primary" style={{ fontSize: "0.9rem" }}>Upgrade for More →</button>
                  </Link>
                </div>
              ) : (
                <button onClick={startNewCampaign} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.5rem" }}>+</span> Start New Campaign
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Character Roster */}
        <section>
          <h2 style={{ fontSize: "1.8rem", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            Your Roster
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {characters.length === 0 && (
              <p style={{ color: "#94a3b8" }}>No characters yet.</p>
            )}

            {characters.map((char) => (
              <div key={char.id} className="glass-panel animate-fade-in" style={{ padding: "16px", display: "flex", gap: "14px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "8px", background: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                  ⚔️
                </div>
                <div>
                  <h4 style={{ fontWeight: "bold" }}>{char.name}</h4>
                  <p style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                    {char.race} {char.class} · Lvl {char.level}
                  </p>
                </div>
              </div>
            ))}

            <Link href="/create-character" style={{ textDecoration: "none" }}>
              <div className="glass-panel animate-fade-in" style={{ padding: "16px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", borderStyle: "dashed" }}>
                <span style={{ color: "var(--primary)", fontWeight: "bold" }}>+ Create New Character</span>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

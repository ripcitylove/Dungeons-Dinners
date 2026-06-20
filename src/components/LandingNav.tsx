"use client";

import { useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { D20Icon } from "./D20Icon";

export default function LandingNav() {
  const [showSignup, setShowSignup] = useState(false);

  return (
    <>
      <nav className="glass-panel" style={{ margin: "20px", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <div className="nav-brand" style={{ fontSize: "1.5rem" }}>
          <span className="nav-brand-mark"><D20Icon className="d20-glow" size="1.1em" /></span>
          <span>Dungeons &amp; Dinner Legends</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            className="btn-secondary"
            onClick={() => setShowSignup(true)}
            style={{ fontSize: "0.79rem", padding: "10px 18px" }}
          >
            How can I sign up?
          </button>
          <Link href="/auth"><button className="btn-secondary">Log In</button></Link>
        </div>
      </nav>

      {showSignup && typeof window !== "undefined" && createPortal(
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowSignup(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <div className="glass-panel" style={{
            maxWidth: "480px", width: "100%", padding: "44px 40px",
            textAlign: "center", position: "relative",
            border: "1px solid rgba(139,92,246,0.35)",
            boxShadow: "0 0 60px rgba(139,92,246,0.15), 0 24px 80px rgba(0,0,0,0.6)",
          }}>
            <button
              onClick={() => setShowSignup(false)}
              style={{
                position: "absolute", top: "16px", right: "18px",
                background: "transparent", border: "none", color: "#64748b",
                fontSize: "1.05rem", cursor: "pointer", lineHeight: 1,
              }}
            >
              ✕
            </button>

            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔒</div>

            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "14px", color: "white" }}>
              Private Access Only
            </h2>

            <p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: "0.85rem", marginBottom: "20px" }}>
              Dungeons &amp; Dinner Legends is currently in <strong style={{ color: "#c4b5fd" }}>closed development</strong> and not yet open to the public.
            </p>

            <p style={{ color: "#64748b", lineHeight: 1.75, fontSize: "0.79rem", marginBottom: "32px" }}>
              We&apos;re actively building and testing new features. Access is limited at this time.
              Stay tuned — the tavern doors will open soon.
            </p>

            <button
              className="btn-primary"
              onClick={() => setShowSignup(false)}
              style={{ marginTop: "28px", padding: "12px 36px" }}
            >
              Got It
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

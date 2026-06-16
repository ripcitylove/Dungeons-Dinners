"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import '../globals.css';

export default function AuthPage() {
  const [mode, setMode]         = useState<'login' | 'forgot'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sentMsg, setSentMsg]   = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Trigger music while still in the user-gesture context (before any awaits).
    window.__dndMusicPlay?.();

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard');
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSentMsg('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setSentMsg('Check your email for a password reset link.');
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'login' | 'forgot') => {
    setMode(next);
    setErrorMsg('');
    setSentMsg('');
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', top: '15%', left: '15%', width: '350px', height: '350px', background: 'var(--primary)', filter: 'blur(160px)', opacity: 0.1, zIndex: -1 }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '300px', height: '300px', background: '#f59e0b', filter: 'blur(160px)', opacity: 0.06, zIndex: -1 }} />

      <Link href="/" className="nav-brand" style={{ position: 'absolute', top: '40px', left: '40px', fontSize: '1.5rem' }}>
        <span className="nav-brand-mark">⬡</span> Dungeons &amp; Dinner Legends
      </Link>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '560px', padding: '44px 44px' }}>

        {mode === 'login' ? (
          <>
            <h1 style={{ fontSize: '2.3rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
              Enter the Tavern
            </h1>
            <p style={{ color: 'var(--subtle)', textAlign: 'center', marginBottom: '32px' }}>
              Log in to resume your campaign.
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '1.05rem' }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border)', color: 'white' }}
                  placeholder="adventurer@realm.com"
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <label style={{ color: '#cbd5e1', fontSize: '1.05rem' }}>Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.95rem', cursor: 'pointer', padding: 0 }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border)', color: 'white' }}
                  placeholder="••••••••"
                />
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '0.95rem', textAlign: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ padding: '14px', marginTop: '8px' }} disabled={loading}>
                {loading ? 'Entering…' : 'Log In'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '2.3rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
              Reset Password
            </h1>
            <p style={{ color: 'var(--subtle)', textAlign: 'center', marginBottom: '32px', fontSize: '1.05rem' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {sentMsg ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📬</div>
                <p style={{ color: '#86efac', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '24px' }}>{sentMsg}</p>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '1.05rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Back to login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '1.05rem' }}>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border)', color: 'white' }}
                    placeholder="adventurer@realm.com"
                  />
                </div>

                {errorMsg && (
                  <div style={{ color: '#ef4444', fontSize: '0.95rem', textAlign: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {errorMsg}
                  </div>
                )}

                <button type="submit" className="btn-primary" style={{ padding: '14px', marginTop: '4px' }} disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--subtle)', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'center' }}
                >
                  ← Back to login
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}

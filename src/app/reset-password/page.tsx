"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import '../globals.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady]       = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone]         = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => router.push('/auth'), 2500);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', top: '15%', left: '15%', width: '350px', height: '350px', background: 'var(--primary)', filter: 'blur(160px)', opacity: 0.1, zIndex: -1 }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '300px', height: '300px', background: '#f59e0b', filter: 'blur(160px)', opacity: 0.06, zIndex: -1 }} />

      <Link href="/" style={{ position: 'absolute', top: '40px', left: '40px', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--primary)' }}>⬡</span> Dungeons and Dinner Legends
      </Link>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✅</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '12px' }}>Password Updated!</h1>
            <p style={{ color: 'var(--subtle)', fontSize: '0.9rem' }}>Redirecting you to login…</p>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--muted)' }}>🔗</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '12px' }}>Verifying Link…</h1>
            <p style={{ color: 'var(--subtle)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Processing your reset link. If this page doesn&apos;t update, the link may have expired.
            </p>
            <Link href="/auth" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
              Request a new link →
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
              Set New Password
            </h1>
            <p style={{ color: 'var(--subtle)', textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border)', color: 'white' }}
                  placeholder="••••••••"
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.45)', border: '1px solid var(--border)', color: 'white' }}
                  placeholder="••••••••"
                />
              </div>

              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ padding: '14px', marginTop: '8px' }} disabled={loading}>
                {loading ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

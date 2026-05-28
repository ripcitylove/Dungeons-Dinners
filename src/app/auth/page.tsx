"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { ALLOWED_EMAIL } from '../../lib/allowedUsers';
import '../globals.css';

export default function AuthPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Trigger music while still in the user-gesture context (before any awaits).
    // MusicPlayer persists across routes so the track continues into the dashboard.
    window.__dndMusicPlay?.();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user?.email !== ALLOWED_EMAIL) {
        await supabase.auth.signOut();
        throw new Error('Access restricted. This application is private.');
      }

      router.push('/dashboard');
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', top: '15%', left: '15%', width: '350px', height: '350px', background: 'var(--primary)', filter: 'blur(160px)', opacity: 0.1, zIndex: -1 }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '15%', width: '300px', height: '300px', background: '#f59e0b', filter: 'blur(160px)', opacity: 0.06, zIndex: -1 }} />

      <Link href="/" style={{ position: 'absolute', top: '40px', left: '40px', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--primary)' }}>⬡</span> D&amp;D Legends
      </Link>

      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>
          Enter the Tavern
        </h1>
        <p style={{ color: 'var(--subtle)', textAlign: 'center', marginBottom: '32px' }}>
          Log in to resume your campaign.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>Email Address</label>
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
            <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>Password</label>
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
            <div style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ padding: '14px', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Entering…' : 'Log In'}
          </button>
        </form>
      </div>
    </main>
  );
}

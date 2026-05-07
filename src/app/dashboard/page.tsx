"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import '../globals.css';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // Fetch Characters
      const { data: chars } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user.id);
      
      if (chars) setCharacters(chars);

      // Fetch Campaigns
      const { data: camps } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id);
        
      if (camps) setCampaigns(camps);
      
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  const startNewCampaign = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Create a new campaign record
    const { data, error } = await supabase.from('campaigns').insert([
      { title: 'New Adventure', description: 'A freshly created campaign.', user_id: user.id }
    ]).select();

    if (!error && data && data.length > 0) {
      router.push(`/campaign/${data[0].id}`);
    } else {
      console.error(error);
      alert('Failed to start campaign.');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading Tavern...</div>;
  }

  return (
    <main style={{ minHeight: '100vh', padding: '40px' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          <span style={{ color: 'var(--primary)' }}>⬡</span> Tavern Dashboard
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>Welcome, Adventurer</span>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--card-bg)', border: '2px solid var(--primary)' }}></div>
        </div>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Active Campaigns */}
        <section>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Active Campaigns</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {campaigns.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No active campaigns yet.</p>
            ) : (
              campaigns.map(camp => (
                <div key={camp.id} className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{camp.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{camp.description}</p>
                  </div>
                  <Link href={`/campaign/${camp.id}`}><button className="btn-primary">Resume Session</button></Link>
                </div>
              ))
            )}

            <div className="glass-panel animate-fade-in delay-100" style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' }}>
              <button onClick={startNewCampaign} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>+</span> Start New Campaign
              </button>
            </div>

          </div>
        </section>

        {/* Character Roster */}
        <section>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Your Roster</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {characters.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>You have no characters.</p>
            ) : (
              characters.map(char => (
                <div key={char.id} className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'var(--secondary)' }}></div>
                  <div>
                    <h4 style={{ fontWeight: 'bold' }}>{char.name}</h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{char.race} {char.class} • Lvl {char.level}</p>
                  </div>
                </div>
              ))
            )}

            <Link href="/create-character" style={{ textDecoration: 'none' }}>
              <div className="glass-panel animate-fade-in delay-300" style={{ padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>+ Create New Character</span>
              </div>
            </Link>

          </div>
        </section>
      </div>
    </main>
  );
}

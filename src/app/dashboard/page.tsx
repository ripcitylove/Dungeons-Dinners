import Link from 'next/link';
import '../globals.css';

export default function Dashboard() {
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
            
            <div className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Curse of the Shadow King</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>DM: AI (GPT-4) • 4 Players • Level 3</p>
              </div>
              <button className="btn-primary">Resume Session</button>
            </div>

            <div className="glass-panel animate-fade-in delay-100" style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' }}>
              <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.5rem' }}>+</span> Start New Campaign
              </button>
            </div>

          </div>
        </section>

        {/* Character Roster */}
        <section>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Your Roster</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="glass-panel animate-fade-in delay-200" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'var(--secondary)' }}></div>
              <div>
                <h4 style={{ fontWeight: 'bold' }}>Thorin Oakenshield</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Dwarf Fighter • Lvl 3</p>
              </div>
            </div>

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

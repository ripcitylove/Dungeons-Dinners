import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <nav className="glass-panel" style={{ margin: '20px', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--primary)' }}>⬡</span> D&D Legends
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/auth"><button className="btn-secondary">Login</button></Link>
          <Link href="/create-character"><button className="btn-primary">Start Free Trial</button></Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px', position: 'relative' }}>
        
        {/* Background Image Overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -2 }}>
          <Image src="/hero_bg.png" alt="Hero Background" layout="fill" objectFit="cover" style={{ opacity: 0.15, mixBlendMode: 'screen' }} priority />
        </div>

        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(150px)', opacity: 0.2, zIndex: -1, borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: '300px', height: '300px', background: 'var(--secondary)', filter: 'blur(150px)', opacity: 0.1, zIndex: -1, borderRadius: '50%' }}></div>

        <div className="animate-fade-in">
          <span style={{ padding: '6px 16px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            The Ultimate AI Dungeon Master
          </span>
        </div>

        <h1 className="animate-fade-in delay-100" style={{ fontSize: '4.5rem', fontWeight: 800, maxWidth: '800px', margin: '24px 0', lineHeight: 1.1, background: 'linear-gradient(to right, #fff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your Next Great Adventure Awaits
        </h1>
        
        <p className="animate-fade-in delay-200" style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '600px', marginBottom: '40px', lineHeight: 1.6 }}>
          Experience a premium, fully-voiced, AI-curated Dungeons & Dragons campaign. Roll 3D dice, see your world generated in real-time, and play seamlessly with up to 10 friends.
        </p>

        <div className="animate-fade-in delay-300" style={{ display: 'flex', gap: '16px' }}>
          <Link href="/create-character"><button className="btn-primary" style={{ fontSize: '1.125rem', padding: '16px 32px' }}>Forge Your Legend</button></Link>
          <Link href="/pricing"><button className="btn-secondary" style={{ fontSize: '1.125rem', padding: '16px 32px' }}>View Pricing</button></Link>
        </div>

        {/* Feature Cards */}
        <div className="animate-fade-in delay-300" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '80px', maxWidth: '1000px', width: '100%' }}>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'left' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🧙‍♂️</div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Expert AI DM</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>Our AI knows every rule, monster, and spell. It crafts dynamic, unforgettable narratives on the fly.</p>
          </div>
          <div className="glass-panel animate-float" style={{ padding: '24px', textAlign: 'left' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🎲</div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Premium 3D Dice</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>Feel every roll with our physics-based 3D dice engine, complete with satisfying soundscapes.</p>
          </div>
          <div className="glass-panel" style={{ padding: '24px', textAlign: 'left' }}>
            <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🎨</div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Visual Storytelling</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>Immerse yourself with real-time generated scenes, character portraits, and ambient music.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

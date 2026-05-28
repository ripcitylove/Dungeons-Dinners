import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Navigation */}
      <nav className="glass-panel" style={{ margin: '20px', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--primary)' }}>⬡</span>
          <span>D&amp;D Legends</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/auth"><button className="btn-secondary">Log In</button></Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px 80px', position: 'relative' }}>

        {/* Background Image */}
        <div style={{ position: 'absolute', inset: 0, zIndex: -2 }}>
          <Image
            src="/hero_bg.png"
            alt=""
            fill
            style={{ objectFit: 'cover', opacity: 0.12, mixBlendMode: 'screen' }}
            priority
          />
        </div>

        {/* Decorative glows */}
        <div style={{ position: 'absolute', top: '5%', left: '10%', width: '400px', height: '400px', background: 'var(--primary)', filter: 'blur(160px)', opacity: 0.15, zIndex: -1, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: '350px', height: '350px', background: 'var(--secondary)', filter: 'blur(160px)', opacity: 0.08, zIndex: -1, borderRadius: '50%' }} />

        {/* Badge */}
        <div className="animate-fade-in">
          <span style={{ padding: '6px 18px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600, border: '1px solid rgba(139, 92, 246, 0.25)', letterSpacing: '0.02em' }}>
            AI Dungeon Master
          </span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-in delay-100"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', fontWeight: 800, maxWidth: '820px', margin: '28px 0 20px', lineHeight: 1.1, background: 'linear-gradient(160deg, #fff 30%, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          Your Next Great Adventure Awaits
        </h1>

        {/* Sub-headline */}
        <p
          className="animate-fade-in delay-200"
          style={{ fontSize: '1.2rem', color: 'var(--subtle)', maxWidth: '580px', marginBottom: '44px', lineHeight: 1.7 }}
        >
          D&amp;D 5e powered by a true AI Dungeon Master. Forge your hero, join your party, and let the story unfold — no human DM required.
        </p>

        {/* CTAs */}
        <div className="animate-fade-in delay-300" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/auth">
            <button className="btn-primary" style={{ fontSize: '1.1rem', padding: '16px 36px' }}>
              Enter the Tavern
            </button>
          </Link>
        </div>

        {/* Publisher badge */}
        <a
          href="https://drinkandplaypublishing.com"
          target="_blank"
          rel="noopener noreferrer"
          className="badge-hover"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 50,
            background: 'white',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/DrinkPlayLogo.jpg" alt="Drink and Play Publishing" style={{ width: '90px', height: '90px', objectFit: 'contain', display: 'block', borderRadius: '6px' }} />
        </a>

        {/* Feature Cards */}
        <div
          className="animate-fade-in delay-300"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '80px', maxWidth: '1000px', width: '100%' }}
        >
          <div className="glass-panel animate-float" style={{ padding: '28px', textAlign: 'left', animationDelay: '0s' }}>
            <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🧙‍♂️</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Expert AI DM</h3>
            <p style={{ color: 'var(--subtle)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Knows every rule, monster, and spell. Crafts dynamic encounters and unforgettable narrative on the fly.
            </p>
          </div>
          <div className="glass-panel animate-float" style={{ padding: '28px', textAlign: 'left', animationDelay: '2s' }}>
            <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🎲</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Live Combat & Dice</h3>
            <p style={{ color: 'var(--subtle)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Real-time encounters with tracked enemies, dice rolls, loot, XP — everything your party needs at the table.
            </p>
          </div>
          <div className="glass-panel animate-float" style={{ padding: '28px', textAlign: 'left', animationDelay: '4s' }}>
            <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🌍</div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>Multiplayer Worlds</h3>
            <p style={{ color: 'var(--subtle)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Play solo or with up to 10 friends. Share a campaign link and every hero joins the same living world.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState, useEffect, useRef, use } from 'react';
import Image from 'next/image';
import { supabase } from '../../../lib/supabaseClient';
import '../../globals.css';
import DiceRoller from '../../../components/DiceRoller';

export default function CampaignSession(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  
  const [messages, setMessages] = useState<{role: 'dm' | 'player' | 'system', content: string, sender?: string}[]>([
    { role: 'system', content: 'Welcome to the Curse of the Shadow King. The tavern is loud, but a hooded figure approaches your table...' },
    { role: 'dm', content: '"Ah, brave adventurers. I have a task for you, if you possess the courage," the hooded figure rasps.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [character, setCharacter] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load User's Character
  useEffect(() => {
    async function loadCharacter() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: chars } = await supabase.from('characters').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
      if (chars && chars.length > 0) {
        setCharacter(chars[0]);
      }
    }
    loadCharacter();
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`campaign_${params.id}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'action_received' }, (payload) => {
        const data = payload.payload;
        setMessages(prev => [...prev, { role: 'player', content: data.action, sender: data.player }]);
        
        setIsTyping(true);
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: data.action })
        })
        .then(res => res.json())
        .then(resData => {
          setIsTyping(false);
          setMessages(prev => [...prev, { role: 'dm', content: resData.reply }]);
        });
      })
      .subscribe();

    let audioCtx: any, osc: any, gain: any;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContext();
      osc = audioCtx.createOscillator();
      gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
    } catch(e) { console.error(e); }

    return () => {
      supabase.removeChannel(channel);
      if (osc) osc.stop();
      if (audioCtx) audioCtx.close();
    }
  }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const playerName = character ? character.name : 'Unknown Hero';
    const payload = { campaignId: params.id, player: playerName, action: input };
    
    channelRef.current?.send({ type: 'broadcast', event: 'action_received', payload: payload });
    
    setMessages(prev => [...prev, { role: 'player', content: input, sender: playerName }]);
    setIsTyping(true);
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: input })
    })
    .then(res => res.json())
    .then(resData => {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'dm', content: resData.reply }]);
    });
    setInput('');
  };

  const handleDiceResult = (result: number) => {
    setShowDice(false);
    const playerName = character ? character.name : 'Unknown Hero';
    const actionText = `[Rolled a ${result}]`;
    const payload = { campaignId: params.id, player: playerName, action: actionText };
    
    channelRef.current?.send({ type: 'broadcast', event: 'action_received', payload: payload });
    
    setMessages(prev => [...prev, { role: 'player', content: actionText, sender: playerName }]);
    setIsTyping(true);
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionText })
    })
    .then(res => res.json())
    .then(resData => {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'dm', content: resData.reply }]);
    });
  };

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'row' }}>
      
      {showDice && <DiceRoller onRollComplete={handleDiceResult} />}

      {/* Pane 1: Visual Narrative (Left) */}
      <div style={{ flex: 1, position: 'relative', borderRight: '1px solid var(--border)' }}>
        <Image src="/hero_bg.png" alt="Current Scene" layout="fill" objectFit="cover" style={{ opacity: 0.8 }} priority />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
          <h2 className="animate-fade-in" style={{ fontSize: '2rem', fontWeight: 'bold', textShadow: '0 2px 10px black' }}>The Broken Cask Tavern</h2>
          <p style={{ color: '#cbd5e1', textShadow: '0 1px 5px black' }}>Dimly lit, smelling of stale ale and woodsmoke. A hooded figure awaits.</p>
        </div>
      </div>

      {/* Pane 2: Chat (Middle) */}
      <div style={{ flex: '0 0 500px', display: 'flex', flexDirection: 'column', background: 'var(--background)', borderRight: '1px solid var(--border)' }}>
        <header className="glass-panel" style={{ margin: '20px', padding: '16px', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Curse of the Shadow King</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>DM: AI • Turn: {character?.name || 'You'}</p>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className="animate-fade-in" style={{ alignSelf: msg.role === 'player' ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'player' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'player' && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{msg.sender}</span>}
              {msg.role === 'dm' && <span style={{ fontSize: '0.75rem', color: '#8b5cf6', marginBottom: '4px', fontWeight: 'bold' }}>Dungeon Master</span>}
              <div style={{ padding: '12px 16px', borderRadius: '12px', fontSize: '0.95rem', lineHeight: 1.5, background: msg.role === 'dm' ? 'rgba(139, 92, 246, 0.15)' : msg.role === 'system' ? 'transparent' : 'var(--card-bg)', border: msg.role === 'dm' ? '1px solid rgba(139, 92, 246, 0.3)' : msg.role === 'system' ? 'none' : '1px solid var(--border)', fontStyle: msg.role === 'system' ? 'italic' : 'normal', color: msg.role === 'system' ? '#94a3b8' : 'white', textAlign: msg.role === 'system' ? 'center' : 'left' }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="animate-fade-in" style={{ alignSelf: 'flex-start', padding: '12px 16px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
              <span className="animate-float" style={{ display: 'inline-block', color: 'var(--primary)', fontSize: '0.9rem' }}>The DM is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => setShowDice(true)} style={{ padding: '0 16px', fontSize: '1.2rem' }} title="Roll Dice">🎲</button>
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Describe your action..." style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', padding: '12px 16px' }} />
            <button className="btn-primary" onClick={handleSend}>Send</button>
          </div>
        </div>
      </div>

      {/* Pane 3: Character Sheet (Right) */}
      <div style={{ flex: '0 0 320px', background: 'var(--card-bg)', overflowY: 'auto', padding: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Character Sheet</h2>
        
        {character ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header / Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: 'var(--secondary)' }}></div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{character.name}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{character.race} {character.class} • Lvl {character.level}</div>
              </div>
            </div>

            {/* Health Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span>Hit Points</span>
                <span style={{ fontWeight: 'bold' }}>{character.hp} / {character.max_hp}</span>
              </div>
              <div style={{ width: '100%', height: '12px', background: '#3f3f46', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${(character.hp / character.max_hp) * 100}%`, height: '100%', background: '#ef4444', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>

            {/* Ability Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
                <div key={stat} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', padding: '12px 0', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>{stat}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {stat === 'STR' && character.strength}
                    {stat === 'DEX' && character.dexterity}
                    {stat === 'CON' && character.constitution}
                    {stat === 'INT' && character.intelligence}
                    {stat === 'WIS' && character.wisdom}
                    {stat === 'CHA' && character.charisma}
                  </div>
                </div>
              ))}
            </div>

            {/* Inventory */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--primary)' }}>Inventory</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '8px' }}>
                <span>Gold Pieces</span>
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{character.inventory?.gold || 0}g</span>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Weapons & Armor</div>
                {character.inventory?.weapons?.map((w: string, i: number) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '4px', fontSize: '0.9rem' }}>⚔️ {w}</div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Items & Trinkets</div>
                {character.inventory?.items?.map((item: string, i: number) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '4px', fontSize: '0.9rem' }}>🎒 {item}</div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>Loading sheet...</div>
        )}
      </div>
    </main>
  );
}

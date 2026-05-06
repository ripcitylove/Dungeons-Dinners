"use client";

import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Image from 'next/image';
import '../../globals.css';
import DiceRoller from '../../../components/DiceRoller';

// Initialize socket outside component
let socket: any;

export default function CampaignSession({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<{role: 'dm' | 'player' | 'system', content: string, sender?: string}[]>([
    { role: 'system', content: 'Welcome to the Curse of the Shadow King. The tavern is loud, but a hooded figure approaches your table...' },
    { role: 'dm', content: '"Ah, brave adventurers. I have a task for you, if you possess the courage," the hooded figure rasps.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket = io();
    socket.emit('join_campaign', params.id);

    socket.on('action_received', (data: any) => {
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
    });

    // Start Ambient Soundscape
    let audioCtx: any, osc: any, gain: any;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioContext();
      osc = audioCtx.createOscillator();
      gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = 55; // Low dark ambient drone
      
      gain.gain.value = 0.05; // Very quiet background drone
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
    } catch(e) { console.error(e); }

    return () => {
      socket.disconnect();
      if (osc) osc.stop();
      if (audioCtx) audioCtx.close();
    }
  }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    socket.emit('player_action', { campaignId: params.id, player: 'Thorin', action: input });
    setInput('');
  };

  const handleDiceResult = (result: number) => {
    setShowDice(false);
    socket.emit('player_action', { campaignId: params.id, player: 'Thorin', action: `[Rolled a ${result}]` });
  };

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'row' }}>
      
      {showDice && <DiceRoller onRollComplete={handleDiceResult} />}

      {/* Visual Narrative Left Pane */}
      <div style={{ flex: 1, position: 'relative', borderRight: '1px solid var(--border)' }}>
        <Image src="/hero_bg.png" alt="Current Scene" layout="fill" objectFit="cover" style={{ opacity: 0.8 }} priority />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
          <h2 className="animate-fade-in" style={{ fontSize: '2rem', fontWeight: 'bold', textShadow: '0 2px 10px black' }}>The Broken Cask Tavern</h2>
          <p style={{ color: '#cbd5e1', textShadow: '0 1px 5px black' }}>Dimly lit, smelling of stale ale and woodsmoke. A hooded figure awaits.</p>
        </div>
      </div>

      {/* Chat Pane Right */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
        {/* Header */}
        <header className="glass-panel" style={{ margin: '20px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Curse of the Shadow King</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>DM: AI • Turn: Thorin</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Thorin</div>
              <div style={{ width: '100px', height: '8px', background: '#3f3f46', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ width: '100%', height: '100%', background: '#ef4444' }}></div>
              </div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--secondary)' }}></div>
          </div>
        </header>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className="animate-fade-in" style={{ 
              alignSelf: msg.role === 'player' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'player' ? 'flex-end' : 'flex-start'
            }}>
              {msg.role === 'player' && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{msg.sender}</span>}
              {msg.role === 'dm' && <span style={{ fontSize: '0.75rem', color: '#8b5cf6', marginBottom: '4px', fontWeight: 'bold' }}>Dungeon Master</span>}
              
              <div style={{ 
                padding: '12px 16px', borderRadius: '12px', fontSize: '0.95rem', lineHeight: 1.5,
                background: msg.role === 'dm' ? 'rgba(139, 92, 246, 0.15)' : msg.role === 'system' ? 'transparent' : 'var(--card-bg)',
                border: msg.role === 'dm' ? '1px solid rgba(139, 92, 246, 0.3)' : msg.role === 'system' ? 'none' : '1px solid var(--border)',
                fontStyle: msg.role === 'system' ? 'italic' : 'normal',
                color: msg.role === 'system' ? '#94a3b8' : 'white',
                textAlign: msg.role === 'system' ? 'center' : 'left'
              }}>
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

        {/* Input Area */}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => setShowDice(true)} style={{ padding: '0 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }} title="Roll Dice">
              🎲
            </button>
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Describe your action..."
              style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '0.95rem', outline: 'none', padding: '12px 16px' }}
            />
            <button className="btn-primary" onClick={handleSend} style={{ padding: '0 24px' }}>Send</button>
          </div>
        </div>
      </div>
    </main>
  );
}

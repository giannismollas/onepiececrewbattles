import React, { useState } from 'react';
import { Volume2, VolumeX, BookOpen, Shield, Anchor, History, Home as HomeIcon } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function Header({ currentRoute, navigate, onOpenRules }) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    soundEffects.setMuted(nextMuted);
    if (!nextMuted) soundEffects.playButtonClick();
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEffects.setVolume(val);
    if (muted) {
      setMuted(false);
      soundEffects.setMuted(false);
    }
  };

  return (
    <header className="glass-panel" style={{ margin: '16px 20px', padding: '12px 24px', borderBottom: '1px solid var(--border-gold)' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: 0 }}>
        
        {/* Brand / Logo */}
        <div 
          onClick={() => navigate('/')} 
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ffd700, #b8860b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-gold)'
          }}>
            <Anchor size={26} color="#070d18" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-pirate" style={{ fontSize: '1.7rem', color: 'var(--gold-light)', lineHeight: 1 }}>
              GRAND LINE NAVAL BATTLES
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cinzel)', letterSpacing: '1px' }}>
              SHIP VS SHIP MULTIPLAYER SIMULATOR
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            className={`btn btn-sm ${currentRoute === '/' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => { soundEffects.playButtonClick(); navigate('/'); }}
          >
            <HomeIcon size={16} /> Home
          </button>

          <button 
            className={`btn btn-sm ${currentRoute === '/history' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => { soundEffects.playButtonClick(); navigate('/history'); }}
          >
            <History size={16} /> Battle History
          </button>

          <button 
            className="btn btn-sm btn-outline"
            onClick={() => { soundEffects.playButtonClick(); onOpenRules(); }}
          >
            <BookOpen size={16} /> Rules & Codex
          </button>

          {/* Sound Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(7, 13, 24, 0.6)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button 
              onClick={toggleMute}
              style={{ background: 'none', border: 'none', color: muted ? 'var(--crimson-primary)' : 'var(--gold-light)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={volume} 
              onChange={handleVolumeChange} 
              style={{ width: '60px', accentColor: 'var(--gold-light)', cursor: 'pointer' }}
              title="Volume"
            />
          </div>
        </div>

      </div>
    </header>
  );
}

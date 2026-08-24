import React from 'react';
import { X, Shield, Swords, Wrench, EyeOff, Dices, Award, Anchor } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '780px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-gold)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Anchor color="var(--gold-light)" size={24} />
            <h2 className="font-pirate text-gold" style={{ fontSize: '1.8rem' }}>CAPTAIN'S COMBAT CODEX & RULES</h2>
          </div>
          <button 
            onClick={() => { soundEffects.playButtonClick(); onClose(); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontSize: '0.95rem', color: 'var(--text-main)' }}>
          
          {/* 1. Core Goal */}
          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--gold-light)' }}>
            <h3 className="font-cinzel text-gold" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Award size={18} /> VICTORY CONDITION
            </h3>
            <p>
              Your primary objective is to <strong>locate and destroy the enemy ship's Engine</strong> (reduce its HP to 0) or force the opposing captain to <strong>Surrender</strong>.
            </p>
          </div>

          {/* 2. Hidden Engine Rule */}
          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid #9b59b6' }}>
            <h3 className="font-cinzel" style={{ color: '#d29bcf', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <EyeOff size={18} /> THE HIDDEN ENGINE
            </h3>
            <p>
              Every combat vessel has an Engine hidden secretly in one of the ship's positions. 
              The opponent cannot see where your Engine is located until they attack that specific position! 
              The Engine occupies its own position and does not consume offensive weapon slots.
            </p>
          </div>

          {/* 3. 1d6 Dice Combat System */}
          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--crimson-primary)' }}>
            <h3 className="font-cinzel text-crimson" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Dices size={18} /> 1D6 COMBAT DICE MODIFIERS
            </h3>
            <p style={{ marginBottom: '12px' }}>
              Every attack rolls a server-authoritative 1d6 die to determine the actual impact multiplier:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>🎲 Roll 1</div>
                <div style={{ color: 'var(--crimson-primary)', fontWeight: 'bold' }}>50% DMG</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>🎲 Roll 2</div>
                <div style={{ color: '#e67e22', fontWeight: 'bold' }}>75% DMG</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>🎲 Roll 3</div>
                <div style={{ color: '#f1c40f', fontWeight: 'bold' }}>90% DMG</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>🎲 Roll 4</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>100% DMG</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>🎲 Roll 5</div>
                <div style={{ color: 'var(--seafoam-primary)', fontWeight: 'bold' }}>125% DMG</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--gold-light)' }}>🎲 Roll 6</div>
                <div style={{ color: 'var(--gold-light)', fontWeight: 'bold' }}>150% DMG</div>
              </div>
            </div>
          </div>

          {/* 4. Weapons & Shields & Repairs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--shield-blue)' }}>
              <h3 className="font-cinzel" style={{ color: 'var(--shield-blue)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Shield size={18} /> NAVAL SHIELDS
              </h3>
              <p style={{ fontSize: '0.88rem' }}>
                Shields protect one chosen weapon or the Engine from incoming damage. 
                When hit, the shield absorbs damage first. The opponent only learns a Shield was hit—never what lies beneath!
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--seafoam-primary)' }}>
              <h3 className="font-cinzel text-seafoam" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Wrench size={18} /> REPAIRS & NO REVIVE
              </h3>
              <p style={{ fontSize: '0.88rem' }}>
                Repair Kits restore +25 HP to a damaged object (&gt;0 HP). 
                Repairing consumes your entire turn. <strong>Destroyed objects (0 HP) cannot be repaired or revived!</strong>
              </p>
            </div>
          </div>

          {/* 5. Isolated Lobbies & Tokens */}
          <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--border-gold)' }}>
            <h3 className="font-cinzel text-gold" style={{ marginBottom: '6px' }}>
              🔒 ZERO-LOGIN MULTIPLAYER & ISOLATED LOBBIES
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No accounts or passwords needed. Each battle is an isolated session identified by its Lobby Code and accessed via private cryptographic player tokens. 
              The Admin link provides spectator supervision with full unmasked inspection and moderation controls.
            </p>
          </div>

        </div>

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button className="btn btn-gold" onClick={() => { soundEffects.playButtonClick(); onClose(); }}>
            Understood, Captain!
          </button>
        </div>
      </div>
    </div>
  );
}

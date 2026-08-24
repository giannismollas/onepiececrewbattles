import React, { useState } from 'react';
import { Copy, Check, ShieldAlert, Share2, Users, Eye, X, Anchor, Hash } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function LobbyShareModal({ isOpen, onClose, lobbyInfo, onProceed }) {
  const [copiedType, setCopiedType] = useState(null);

  if (!isOpen || !lobbyInfo) return null;

  const origin = window.location.origin;
  const inviteLink = `${origin}/lobby/${lobbyInfo.publicCode}`;
  const playerLink = lobbyInfo.playerToken ? `${origin}/battle/${lobbyInfo.publicCode}/p/${lobbyInfo.playerToken}` : '';
  const adminLink = lobbyInfo.adminToken ? `${origin}/battle/${lobbyInfo.publicCode}/admin/${lobbyInfo.adminToken}` : '';

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    soundEffects.playButtonClick();
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-gold)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Share2 color="var(--gold-light)" size={24} />
            <h2 className="font-pirate text-gold" style={{ fontSize: '1.8rem' }}>LOBBY CODE & DISPATCH LINKS</h2>
          </div>
          {onClose && (
            <button 
              onClick={() => { soundEffects.playButtonClick(); onClose(); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* 1. Big Lobby Code Card */}
        <div className="gold-panel" style={{ padding: '18px 24px', textAlign: 'center', marginBottom: '20px', background: 'rgba(245, 166, 35, 0.1)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'var(--font-cinzel)' }}>
            PUBLIC LOBBY CODE (GIVE TO DEFENDER)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', margin: '8px 0' }}>
            <div className="font-pirate text-gold" style={{ fontSize: '2.8rem', letterSpacing: '3px' }}>
              {lobbyInfo.publicCode}
            </div>
            <button 
              className="btn btn-gold btn-sm"
              onClick={() => copyToClipboard(lobbyInfo.publicCode, 'code')}
              style={{ minWidth: '120px' }}
            >
              {copiedType === 'code' ? <><Check size={14} /> Copied Code</> : <><Copy size={14} /> Copy Code</>}
            </button>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--seafoam-primary)' }}>
            ✓ The Defender can join by typing this code on the homepage or clicking the invite link below.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 2. Opponent Invite Link */}
          <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--crimson-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: 'var(--crimson-primary)' }}>
                <Users size={16} /> OPPONENT DIRECT INVITE LINK (PLAYER 2 / DEFENDER)
              </div>
              <span className="badge badge-crimson">Direct Link</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                readOnly 
                value={inviteLink} 
                className="input-dark" 
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              <button 
                className="btn btn-crimson btn-sm"
                onClick={() => copyToClipboard(inviteLink, 'invite')}
                style={{ minWidth: '110px' }}
              >
                {copiedType === 'invite' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Opens the join screen directly with this lobby code pre-filled.
            </p>
          </div>

          {/* 3. Player 1 Private Link */}
          {playerLink && (
            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid var(--gold-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: 'var(--gold-light)' }}>
                  <Anchor size={16} /> YOUR PRIVATE PLAYER LINK (ATTACKER)
                </div>
                <span className="badge badge-gold">Private Token</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={playerLink} 
                  className="input-dark" 
                  style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                />
                <button 
                  className="btn btn-gold btn-sm"
                  onClick={() => copyToClipboard(playerLink, 'player')}
                  style={{ minWidth: '110px' }}
                >
                  {copiedType === 'player' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Link</>}
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Bookmark or copy this link. If you close your tab, this link restores your controls and game state.
              </p>
            </div>
          )}

          {/* 4. Admin Spectator Link */}
          {adminLink && (
            <div className="glass-panel" style={{ padding: '14px', borderLeft: '4px solid #9b59b6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#d29bcf' }}>
                  <Eye size={16} /> ADMINISTRATOR SPECTATOR LINK
                </div>
                <span className="badge" style={{ background: 'rgba(155, 89, 182, 0.2)', color: '#d29bcf', border: '1px solid rgba(155, 89, 182, 0.4)' }}>
                  Moderator Only
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={adminLink} 
                  className="input-dark" 
                  style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                />
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => copyToClipboard(adminLink, 'admin')}
                  style={{ minWidth: '110px' }}
                >
                  {copiedType === 'admin' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Admin</>}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#e74c3c', fontSize: '0.75rem' }}>
                <ShieldAlert size={14} />
                <span>Confidential: Anyone with this link can inspect all hidden engines, shields, and moderator controls.</span>
              </div>
            </div>
          )}

        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {onProceed && (
            <button className="btn btn-gold btn-lg" onClick={() => { soundEffects.playButtonClick(); onProceed(); }}>
              Enter Ship Outfitter →
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

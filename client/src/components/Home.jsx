import React, { useState, useEffect } from 'react';
import { Anchor, Swords, Users, Shield, Award, PlusCircle, ArrowRight, Dices, EyeOff, Wrench, History, Compass, Sparkles } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';
import LobbyShareModal from './LobbyShareModal';

export default function Home({ navigate, onOpenRules }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Create form state
  const [createCaptain, setCreateCaptain] = useState('');
  const [createCrew, setCreateCrew] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdLobbyInfo, setCreatedLobbyInfo] = useState(null);

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [joinCaptain, setJoinCaptain] = useState('');
  const [joinCrew, setJoinCrew] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Recent battles preview
  const [recentBattles, setRecentBattles] = useState([]);

  useEffect(() => {
    fetch('/api/history?limit=3')
      .then(res => res.json())
      .then(data => {
        if (data && data.history) {
          setRecentBattles(data.history);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreateLobby = async (e) => {
    e.preventDefault();
    if (!createCaptain.trim() || !createCrew.trim()) return;

    setIsCreating(true);
    soundEffects.playButtonClick();

    try {
      const res = await fetch('/api/lobby/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainName: createCaptain.trim(),
          crewName: createCrew.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedLobbyInfo(data);
        setShowCreateModal(false);
      } else {
        alert(data.error || 'Failed to create lobby');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async (e) => {
    e.preventDefault();
    setJoinError(null);
    let code = joinCode.trim();
    if (!code) return;

    // Support full URLs pasted in
    if (code.includes('/lobby/')) {
      code = code.split('/lobby/')[1].split('/')[0];
    } else if (code.includes('/battle/')) {
      code = code.split('/battle/')[1].split('/')[0];
    }

    setIsJoining(true);
    soundEffects.playButtonClick();

    try {
      const res = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicCode: code.toUpperCase(),
          captainName: joinCaptain.trim() || 'Defender Captain',
          crewName: joinCrew.trim() || 'Defender Crew'
        })
      });
      const data = await res.json();
      if (res.ok) {
        navigate(`/battle/${data.publicCode}/p/${data.playerToken}`);
      } else {
        if (data.error === 'LOBBY_FULL') {
          setJoinError('This battle lobby is already full (2 players are engaged).');
        } else {
          setJoinError(data.error || 'Could not join lobby.');
        }
      }
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* HERO SECTION */}
      <section className="gold-panel" style={{ padding: '60px 40px', marginTop: '20px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 215, 0, 0.1)', padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--border-gold)', marginBottom: '20px' }}>
          <Sparkles size={16} color="var(--gold-light)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--gold-light)', fontWeight: 600, letterSpacing: '1px' }}>
            TACTICAL MULTIPLAYER NAVAL WARFARE
          </span>
        </div>

        <h1 className="font-pirate" style={{ fontSize: '3.8rem', color: 'var(--gold-light)', textShadow: '0 0 25px rgba(255, 215, 0, 0.4)', lineHeight: 1.1, marginBottom: '16px' }}>
          SHIP VS SHIP
        </h1>

        <p className="font-cinzel" style={{ fontSize: '1.35rem', color: '#e0e6ed', maxWidth: '750px', margin: '0 auto 36px', lineHeight: 1.6 }}>
          "Build your ship. Hide your Engine. Find your enemy's weakness."
        </p>

        <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto 40px', fontSize: '0.95rem' }}>
          No accounts. No registrations. Enter your captain and crew names, configure weapon slots, place your secret engine, and engage in real-time 1d6 server-authoritative combat.
        </p>

        {/* Hero CTAs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-gold btn-lg"
            onClick={() => { soundEffects.playButtonClick(); setShowCreateModal(true); }}
          >
            <PlusCircle size={20} /> CREATE BATTLE LOBBY
          </button>

          <button 
            className="btn btn-crimson btn-lg"
            onClick={() => { soundEffects.playButtonClick(); setShowJoinModal(true); }}
          >
            <Swords size={20} /> JOIN BATTLE
          </button>

          <button 
            className="btn btn-outline btn-lg"
            onClick={() => { soundEffects.playButtonClick(); navigate('/history'); }}
          >
            <History size={20} /> BATTLE HISTORY
          </button>
        </div>
      </section>

      {/* 7-STEP COMBAT FLOW */}
      <section style={{ marginTop: '50px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 className="font-pirate text-gold" style={{ fontSize: '2.4rem' }}>HOW NAVAL COMBAT WORKS</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Seven simple steps from shipyard preparation to crushing enemy flagship defeat</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {[
            { step: '1', title: 'Create Lobby', desc: 'Generate a unique isolated battle instance with private links.', icon: <PlusCircle color="var(--gold-light)" size={24} /> },
            { step: '2', title: 'Invite Enemy', desc: 'Dispatch your invite link to Player 2 or supervisor Admin.', icon: <Users color="var(--crimson-primary)" size={24} /> },
            { step: '3', title: 'Outfit Ship', desc: 'Select your ship hull and drag deadly offensive weapons into slots.', icon: <Swords color="#3498db" size={24} /> },
            { step: '4', title: 'Hide Engine', desc: 'Choose a secret position to conceal your Engine from enemy radar.', icon: <EyeOff color="#9b59b6" size={24} /> },
            { step: '5', title: 'Ready Up', desc: 'Lock in your naval layout and initiate real-time synchronized battle.', icon: <Shield color="var(--seafoam-primary)" size={24} /> },
            { step: '6', title: 'Roll & Fire', desc: 'Choose weapons and enemy coordinates with server 1d6 damage modifiers.', icon: <Dices color="var(--gold-light)" size={24} /> },
            { step: '7', title: 'Destroy Engine', desc: 'Reduce enemy Engine to 0 HP for glorious permanent victory.', icon: <Award color="var(--crimson-primary)" size={24} /> }
          ].map((item) => (
            <div key={item.step} className="glass-panel" style={{ padding: '20px', position: 'relative', borderTop: '3px solid var(--gold-light)' }}>
              <div style={{ position: 'absolute', top: '12px', right: '14px', fontSize: '1.6rem', fontFamily: 'var(--font-pirate)', color: 'rgba(255, 215, 0, 0.2)' }}>
                #{item.step}
              </div>
              <div style={{ marginBottom: '12px' }}>{item.icon}</div>
              <h3 className="font-cinzel" style={{ fontSize: '1rem', color: 'var(--gold-light)', marginBottom: '6px' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* RECENT BATTLES TICKER */}
      {recentBattles.length > 0 && (
        <section style={{ marginTop: '50px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 className="font-pirate text-gold" style={{ fontSize: '2.2rem' }}>RECENT GRAND LINE CLASHES</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Permanent battle records saved directly into the naval archives</p>
            </div>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => { soundEffects.playButtonClick(); navigate('/history'); }}
            >
              View All History →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {recentBattles.map((b) => (
              <div key={b.id} className="gold-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge badge-gold font-pirate" style={{ fontSize: '1rem' }}>{b.public_code}</span>
                  <span className="badge badge-seafoam">{b.end_reason}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0', textAlign: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--gold-light)' }}>{b.winner_captain}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.winner_crew}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--seafoam-primary)', marginTop: '4px' }}>🏆 Winner ({b.winner_ship})</div>
                  </div>
                  <div style={{ padding: '0 12px', color: 'var(--crimson-primary)', fontWeight: 'bold', fontFamily: 'var(--font-cinzel)' }}>
                    VS
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{b.loser_captain}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.loser_crew}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Defeated ({b.loser_ship})</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>⚔️ {b.rounds} Rounds</span>
                  <button 
                    className="btn btn-gold btn-sm"
                    onClick={() => { soundEffects.playButtonClick(); navigate(`/replay/${b.public_code}`); }}
                  >
                    View Replay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CREATE LOBBY MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-pirate text-gold" style={{ fontSize: '2rem', marginBottom: '8px' }}>
              CREATE BATTLE LOBBY
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Establish a new independent naval session. You will be registered as <strong>Player 1 / Attacker</strong>.
            </p>

            <form onSubmit={handleCreateLobby} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
                  CAPTAIN NAME
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Monkey D. Luffy" 
                  value={createCaptain}
                  onChange={(e) => setCreateCaptain(e.target.value)}
                  className="input-dark"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
                  CREW / FLEET NAME
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Straw Hat Pirates" 
                  value={createCrew}
                  onChange={(e) => setCreateCrew(e.target.value)}
                  className="input-dark"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-gold"
                  disabled={isCreating}
                >
                  {isCreating ? 'Commissioning Ship...' : 'Confirm & Create Lobby →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN LOBBY MODAL */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-pirate text-crimson" style={{ fontSize: '2rem', marginBottom: '8px' }}>
              JOIN BATTLE LOBBY
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Enter the opponent's Public Lobby Code or paste the invite link to join as <strong>Player 2 / Defender</strong>.
            </p>

            {joinError && (
              <div style={{ background: 'rgba(231, 76, 60, 0.2)', border: '1px solid var(--crimson-primary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', color: '#ff7675', fontSize: '0.88rem', marginBottom: '16px' }}>
                ⚠️ {joinError}
              </div>
            )}

            <form onSubmit={handleJoinLobby} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
                  LOBBY CODE OR INVITE LINK
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. SHIP-7X4K92" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="input-dark"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
                  DEFENDING CAPTAIN NAME
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Marshall D. Teach" 
                  value={joinCaptain}
                  onChange={(e) => setJoinCaptain(e.target.value)}
                  className="input-dark"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
                  DEFENDING CREW NAME
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Blackbeard Pirates" 
                  value={joinCrew}
                  onChange={(e) => setJoinCrew(e.target.value)}
                  className="input-dark"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-crimson"
                  disabled={isJoining}
                >
                  {isJoining ? 'Engaging Fleet...' : 'Join Battle →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOBBY CREATED SHARE MODAL */}
      <LobbyShareModal 
        isOpen={!!createdLobbyInfo}
        onClose={() => setCreatedLobbyInfo(null)}
        lobbyInfo={createdLobbyInfo}
        onProceed={() => {
          navigate(`/battle/${createdLobbyInfo.publicCode}/p/${createdLobbyInfo.playerToken}`);
        }}
      />

    </div>
  );
}

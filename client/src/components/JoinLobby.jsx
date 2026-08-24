import React, { useState, useEffect } from 'react';
import { Swords, Anchor, Users, ShieldAlert, ArrowLeft } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function JoinLobby({ publicCode, navigate }) {
  const [captainName, setCaptainName] = useState('');
  const [crewName, setCrewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lobbyData, setLobbyData] = useState(null);
  const [error, setError] = useState(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    fetch(`/api/lobby/${publicCode}`)
      .then(res => {
        if (!res.ok) throw new Error('Lobby not found.');
        return res.json();
      })
      .then(data => {
        setLobbyData(data);
        if (data.players && data.players.defender) {
          setIsFull(true);
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [publicCode]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!captainName.trim() || !crewName.trim()) return;

    setSubmitting(true);
    soundEffects.playButtonClick();

    try {
      const res = await fetch('/api/lobby/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicCode: publicCode.toUpperCase(),
          captainName: captainName.trim(),
          crewName: crewName.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        navigate(`/battle/${publicCode}/p/${data.playerToken}`);
      } else {
        if (data.error === 'LOBBY_FULL') {
          setIsFull(true);
        } else {
          setError(data.error || 'Failed to join lobby.');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
        <h2 className="font-pirate text-gold" style={{ fontSize: '2rem' }}>Consulting Naval Compass...</h2>
      </div>
    );
  }

  if (error && !isFull) {
    return (
      <div className="container" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="gold-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <ShieldAlert size={48} color="var(--crimson-primary)" style={{ marginBottom: '16px' }} />
          <h2 className="font-pirate text-crimson" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>
            LOBBY NOT FOUND
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            The battle lobby <strong>{publicCode}</strong> does not exist or has already dissolved.
          </p>
          <button className="btn btn-gold" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Return to Sea
          </button>
        </div>
      </div>
    );
  }

  if (isFull) {
    return (
      <div className="container" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="gold-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <Users size={48} color="var(--gold-light)" style={{ marginBottom: '16px' }} />
          <h2 className="font-pirate text-gold" style={{ fontSize: '2.4rem', marginBottom: '8px' }}>
            LOBBY FULL
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Battle lobby <strong>{publicCode}</strong> already has two active captains locked in combat.
          </p>
          
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ENGAGED CREWS:</div>
            <div style={{ color: 'var(--gold-light)', fontWeight: 'bold', marginTop: '4px' }}>
              🏴‍☠️ {lobbyData?.players?.attacker?.captainName} ({lobbyData?.players?.attacker?.crewName})
            </div>
            <div style={{ color: 'var(--crimson-primary)', fontWeight: 'bold', marginTop: '4px' }}>
              🏴‍☠️ {lobbyData?.players?.defender?.captainName} ({lobbyData?.players?.defender?.crewName})
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn btn-outline" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '640px', marginTop: '40px' }}>
      <div className="gold-panel" style={{ padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="badge badge-gold" style={{ marginBottom: '12px' }}>
            OPPONENT CHALLENGE RECEIVED
          </div>
          <h1 className="font-pirate text-crimson" style={{ fontSize: '2.8rem', lineHeight: 1.1 }}>
            JOIN BATTLE
          </h1>
          <p className="font-cinzel text-gold" style={{ fontSize: '1.2rem', marginTop: '8px' }}>
            Lobby: {publicCode}
          </p>
        </div>

        {lobbyData?.players?.attacker && (
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', borderLeft: '4px solid var(--gold-light)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-cinzel)' }}>
              CHALLENGER (PLAYER 1 / ATTACKER)
            </div>
            <div style={{ fontSize: '1.15rem', color: 'var(--gold-light)', fontWeight: 'bold', marginTop: '2px' }}>
              {lobbyData.players.attacker.captainName}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Crew: {lobbyData.players.attacker.crewName}
            </div>
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
              YOUR CAPTAIN NAME (DEFENDER)
            </label>
            <input 
              type="text" 
              required
              placeholder="e.g. Marshall D. Teach" 
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              className="input-dark"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cinzel)' }}>
              YOUR CREW / FLEET NAME
            </label>
            <input 
              type="text" 
              required
              placeholder="e.g. Blackbeard Pirates" 
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
              className="input-dark"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} /> Home
            </button>

            <button 
              type="submit" 
              className="btn btn-crimson btn-lg"
              disabled={submitting}
            >
              <Swords size={20} /> {submitting ? 'Accepting Challenge...' : 'Join Lobby as Defender →'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

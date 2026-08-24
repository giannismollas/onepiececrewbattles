import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, ArrowLeft, Swords, Award, Dices, Shield } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function BattleReplay({ publicCode, navigate }) {
  const [battleData, setBattleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1500); // ms per step

  useEffect(() => {
    fetch(`/api/history/${publicCode}`)
      .then(res => {
        if (!res.ok) throw new Error('Battle history record not found.');
        return res.json();
      })
      .then(data => {
        setBattleData(data);
        if (data.actions && data.actions.length > 0) {
          setCurrentStepIdx(0);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [publicCode]);

  // Auto playback timer
  useEffect(() => {
    let timer = null;
    if (isPlaying && battleData?.actions && battleData.actions.length > 0) {
      timer = setInterval(() => {
        setCurrentStepIdx(prev => {
          if (prev >= battleData.actions.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          // Play sound on each auto step
          const act = battleData.actions[next];
          if (act.action_type === 'ATTACK') soundEffects.playCannon();
          else if (act.action_type === 'REPAIR') soundEffects.playRepair();
          return next;
        });
      }, playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, battleData, playbackSpeed]);

  const handleStepChange = (newIdx) => {
    if (!battleData?.actions) return;
    const clamped = Math.max(0, Math.min(battleData.actions.length - 1, newIdx));
    setCurrentStepIdx(clamped);
    soundEffects.playButtonClick();
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2 className="font-pirate text-gold" style={{ fontSize: '2.2rem' }}>Reconstructing Naval Logbook...</h2>
      </div>
    );
  }

  if (error || !battleData) {
    return (
      <div className="container" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="gold-panel" style={{ padding: '36px', textAlign: 'center' }}>
          <h2 className="font-pirate text-crimson" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>
            LOGBOOK NOT FOUND
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{error || 'Battle replay unavailable.'}</p>
          <button className="btn btn-gold" onClick={() => navigate('/history')}>
            <ArrowLeft size={16} /> Return to History
          </button>
        </div>
      </div>
    );
  }

  const { record, actions = [] } = battleData;
  const currentAction = actions[currentStepIdx] || null;
  let currentDetails = null;
  if (currentAction && currentAction.details_json) {
    try {
      currentDetails = JSON.parse(currentAction.details_json);
    } catch {}
  }

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* HEADER BANNER */}
      <div className="gold-panel" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-gold font-pirate" style={{ fontSize: '1.1rem' }}>
                REPLAY: {record.public_code}
              </span>
              <span className="badge badge-seafoam">
                {record.end_reason}
              </span>
            </div>
            <h2 className="font-pirate text-gold" style={{ fontSize: '2.4rem', marginTop: '4px', lineHeight: 1.1 }}>
              {record.winner_captain} VS {record.loser_captain}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Winner: <strong style={{ color: 'var(--gold-light)' }}>{record.winner_captain} ({record.winner_crew})</strong> • Total Rounds: {record.rounds} • Date: {new Date(record.created_at).toLocaleDateString()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={() => navigate('/history')}>
              <ArrowLeft size={16} /> History List
            </button>
            <button className="btn btn-gold" onClick={() => navigate('/')}>
              New Battle
            </button>
          </div>
        </div>
      </div>

      {/* REPLAY SCRUBBER CONTROLS */}
      <div className="gold-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="font-cinzel" style={{ fontSize: '1rem', color: 'var(--gold-light)' }}>
            TIMELINE: Step <strong>{currentStepIdx + 1}</strong> of <strong>{actions.length}</strong> {currentAction ? `(Round ${currentAction.round})` : ''}
          </div>
          
          {/* Speed selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>Playback Speed:</span>
            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(parseInt(e.target.value, 10))}
              className="input-dark"
              style={{ width: '80px', padding: '4px 8px', fontSize: '0.8rem' }}
            >
              <option value="2500">0.5x</option>
              <option value="1500">1.0x</option>
              <option value="800">2.0x</option>
              <option value="400">4.0x</option>
            </select>
          </div>
        </div>

        {/* Scrubber Slider */}
        <input 
          type="range" 
          min="0" 
          max={actions.length - 1} 
          value={currentStepIdx} 
          onChange={(e) => handleStepChange(parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: 'var(--gold-light)', cursor: 'pointer', marginBottom: '16px' }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => handleStepChange(0)}
            disabled={currentStepIdx === 0}
          >
            <SkipBack size={16} /> First Step
          </button>

          <button 
            className="btn btn-outline"
            onClick={() => handleStepChange(currentStepIdx - 1)}
            disabled={currentStepIdx === 0}
          >
            ← Previous
          </button>

          <button 
            className={`btn ${isPlaying ? 'btn-crimson' : 'btn-gold'} btn-lg`}
            onClick={() => {
              soundEffects.playButtonClick();
              if (currentStepIdx >= actions.length - 1) setCurrentStepIdx(0);
              setIsPlaying(!isPlaying);
            }}
            style={{ minWidth: '150px' }}
          >
            {isPlaying ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Auto Play</>}
          </button>

          <button 
            className="btn btn-outline"
            onClick={() => handleStepChange(currentStepIdx + 1)}
            disabled={currentStepIdx >= actions.length - 1}
          >
            Next →
          </button>

          <button 
            className="btn btn-outline btn-sm"
            onClick={() => handleStepChange(actions.length - 1)}
            disabled={currentStepIdx >= actions.length - 1}
          >
            <SkipForward size={16} /> Final Step
          </button>
        </div>
      </div>

      {/* CURRENT STEP HIGHLIGHT CARD & FULL COMBAT FEED */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* CURRENT STEP CARD */}
        {currentAction && (
          <div className="gold-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '10px', marginBottom: '16px' }}>
              <span className="badge badge-gold">ACTION DETAILS (STEP {currentStepIdx + 1})</span>
              <span className="font-pirate text-gold" style={{ fontSize: '1.3rem' }}>
                ROUND {currentAction.round}
              </span>
            </div>

            {/* Action Summary */}
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px', lineHeight: 1.4 }}>
              {currentAction.result_summary}
            </div>

            {currentAction.action_type === 'ATTACK' && (
              <div className="glass-panel" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', textAlign: 'center' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1D6 ROLL</div>
                  <div className="font-pirate text-gold" style={{ fontSize: '1.8rem', lineHeight: 1 }}>
                    🎲 {currentAction.dice_roll}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MULTIPLIER</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--seafoam-primary)', marginTop: '4px' }}>
                    {Math.round((currentAction.damage_multiplier || 1) * 100)}%
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FINAL DAMAGE</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--crimson-primary)' }}>
                    {currentAction.final_damage} DMG
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TARGET SLOT</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--gold-light)', marginTop: '4px' }}>
                    Pos {currentAction.target_position}
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '14px', textAlign: 'right' }}>
              Logged: {new Date(currentAction.created_at).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* FULL LOG FEED (CLICKABLE) */}
        <div className="parchment-box" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', borderBottom: '2px solid #8b5a2b', paddingBottom: '8px', marginBottom: '12px' }}>
            COMPLETE BATTLE LOGBOOK
          </h3>
          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
            {actions.map((act, idx) => {
              const isCurrent = (idx === currentStepIdx);
              return (
                <div 
                  key={act.id}
                  onClick={() => handleStepChange(idx)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: isCurrent ? 'rgba(139, 90, 43, 0.25)' : 'transparent',
                    borderLeft: isCurrent ? '4px solid #8b5a2b' : '4px solid transparent',
                    borderBottom: '1px dotted rgba(139,90,43,0.3)',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#8b5a2b' }}>
                    <span>Step {idx + 1} (Round {act.round})</span>
                    <span>{new Date(act.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ fontWeight: isCurrent ? 'bold' : 'normal', marginTop: '2px' }}>
                    {act.result_summary}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}

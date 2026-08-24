import React, { useState } from 'react';
import { Shield, Eye, AlertTriangle, Play, Pause, XCircle, RotateCcw, Award, Wrench, ShieldAlert } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function AdminSpectator({ lobbyState, adminToken, onRefresh, navigate }) {
  const { lobby, adminView, combatLog = [] } = lobbyState;
  const p1 = adminView?.attacker;
  const p2 = adminView?.defender;

  const [commandLoading, setCommandLoading] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState(null);

  // HP Adjuster modal state
  const [showHpModal, setShowHpModal] = useState(false);
  const [hpTargetPlayer, setHpTargetPlayer] = useState('P1');
  const [hpTargetType, setHpTargetType] = useState('ENGINE');
  const [hpTargetPos, setHpTargetPos] = useState(1);
  const [newHpVal, setNewHpVal] = useState(100);

  const runAdminCommand = async (command, params = {}) => {
    setCommandLoading(true);
    setAdminFeedback(null);
    soundEffects.playButtonClick();

    try {
      const res = await fetch(`/api/lobby/${lobby.publicCode}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: adminToken,
          command,
          params
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminFeedback({ type: 'error', text: data.error || 'Admin command failed' });
      } else {
        setAdminFeedback({ type: 'success', text: data.summary || 'Command executed successfully.' });
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setAdminFeedback({ type: 'error', text: err.message });
    } finally {
      setCommandLoading(false);
    }
  };

  const handleApplyHp = () => {
    setShowHpModal(false);
    const targetPlayerObj = (hpTargetPlayer === 'P1') ? p1?.player : p2?.player;
    if (!targetPlayerObj) return;

    runAdminCommand('ADJUST_HP', {
      playerId: targetPlayerObj.id,
      targetType: hpTargetType,
      position: hpTargetPos,
      newHp: parseInt(newHpVal, 10)
    });
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* ADMIN HEADER */}
      <div className="gold-panel" style={{ padding: '20px 24px', marginBottom: '20px', borderLeft: '6px solid #9b59b6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye color="#d29bcf" size={24} />
              <span className="badge" style={{ background: '#9b59b6', color: '#fff', fontSize: '0.9rem' }}>
                ADMINISTRATOR COMMAND DECK
              </span>
              <span className="badge badge-gold font-pirate" style={{ fontSize: '1.1rem' }}>
                {lobby.publicCode}
              </span>
            </div>
            <h2 className="font-pirate text-gold" style={{ fontSize: '2.4rem', marginTop: '6px', lineHeight: 1.1 }}>
              UNMASKED BATTLE SUPERVISION
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Status: <strong>{lobby.status}</strong> • Round: <strong>{lobby.round}</strong> • Turn: <strong>{lobby.currentTurnCaptain || 'N/A'}</strong>
            </div>
          </div>

          {/* Quick Moderator Toolbar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {lobby.status === 'ACTIVE' ? (
              <button 
                className="btn btn-sm btn-outline" 
                onClick={() => runAdminCommand('PAUSE_BATTLE')}
                disabled={commandLoading}
              >
                <Pause size={16} /> Pause Match
              </button>
            ) : lobby.status === 'PAUSED' ? (
              <button 
                className="btn btn-sm btn-seafoam" 
                onClick={() => runAdminCommand('RESUME_BATTLE')}
                disabled={commandLoading}
              >
                <Play size={16} /> Resume Match
              </button>
            ) : null}

            <button 
              className="btn btn-sm btn-outline"
              onClick={() => runAdminCommand('UNDO_LAST_ACTION')}
              disabled={commandLoading || combatLog.length === 0}
            >
              <RotateCcw size={16} /> Undo Turn
            </button>

            <button 
              className="btn btn-sm btn-outline"
              onClick={() => setShowHpModal(true)}
              disabled={commandLoading}
            >
              <Wrench size={16} /> Adjust HP
            </button>

            <button 
              className="btn btn-sm btn-crimson"
              onClick={() => {
                if (window.confirm('Are you sure you want to force cancel this battle?')) {
                  runAdminCommand('CANCEL_BATTLE');
                }
              }}
              disabled={commandLoading || lobby.status === 'COMPLETED' || lobby.status === 'CANCELLED'}
            >
              <XCircle size={16} /> Cancel Battle
            </button>
          </div>
        </div>
      </div>

      {adminFeedback && (
        <div style={{ 
          background: adminFeedback.type === 'error' ? 'rgba(231, 76, 60, 0.25)' : 'rgba(46, 204, 113, 0.25)', 
          border: `1px solid ${adminFeedback.type === 'error' ? 'var(--crimson-primary)' : '#2ecc71'}`,
          padding: '10px 16px', 
          borderRadius: 'var(--radius-md)', 
          color: adminFeedback.type === 'error' ? '#ff7675' : '#2ecc71', 
          marginBottom: '16px' 
        }}>
          {adminFeedback.text}
        </div>
      )}

      {/* DUAL UNMASKED SHIP GRIDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* PLAYER 1 (ATTACKER) UNMASKED */}
        <div className="gold-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '8px', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-gold">PLAYER 1 / ATTACKER</span>
              <h3 className="font-pirate text-gold" style={{ fontSize: '1.8rem', marginTop: '4px' }}>
                {p1?.player?.captainName} ({p1?.player?.crewName})
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ship: {p1?.setup?.ship?.ship_name} • Ready: {p1?.player?.ready ? 'YES' : 'NO'}
              </div>
            </div>
            <button 
              className="btn btn-sm btn-outline" 
              style={{ fontSize: '0.75rem', borderColor: 'var(--gold-light)' }}
              onClick={() => runAdminCommand('FORCE_WIN_ATTACKER')}
              disabled={lobby.status === 'COMPLETED'}
            >
              <Award size={14} /> Force Win P1
            </button>
          </div>

          {/* Engine Reveal */}
          <div className="glass-panel" style={{ padding: '12px', marginBottom: '12px', borderLeft: '4px solid #9b59b6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#d29bcf' }}>
                🔥 Engine Concealed at Position {p1?.setup?.enginePosition}
              </span>
              <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>
                {p1?.setup?.engineCurrentHp} / {p1?.setup?.engineMaxHp} HP
              </span>
            </div>
          </div>

          {/* Shield Reveal */}
          {p1?.setup?.shield && (
            <div className="glass-panel" style={{ padding: '10px', marginBottom: '12px', borderLeft: '4px solid var(--shield-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--shield-blue)', fontWeight: 'bold' }}>
                  🛡️ Shield on {p1.setup.shield.protected_type === 'ENGINE' ? 'Engine' : `Pos ${p1.setup.shield.protected_position}`}
                </span>
                <span>{p1.setup.shield.current_hp} / {p1.setup.shield.max_hp} HP</span>
              </div>
            </div>
          )}

          {/* Weapons List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {p1?.setup?.weapons?.map(w => (
              <div key={w.position} className="glass-panel" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Pos {w.position}:</strong> {w.weapon_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${w.is_destroyed ? 'badge-crimson' : 'badge-gold'}`}>
                    {w.is_destroyed ? 'DESTROYED' : `${w.current_hp}/${w.max_hp} HP`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PLAYER 2 (DEFENDER) UNMASKED */}
        <div className="gold-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '8px', marginBottom: '14px' }}>
            <div>
              <span className="badge badge-crimson">PLAYER 2 / DEFENDER</span>
              <h3 className="font-pirate text-crimson" style={{ fontSize: '1.8rem', marginTop: '4px' }}>
                {p2?.player ? `${p2.player.captainName} (${p2.player.crewName})` : 'Waiting for Defender...'}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ship: {p2?.setup?.ship?.ship_name || 'N/A'} • Ready: {p2?.player?.ready ? 'YES' : 'NO'}
              </div>
            </div>
            {p2?.player && (
              <button 
                className="btn btn-sm btn-outline" 
                style={{ fontSize: '0.75rem', borderColor: 'var(--crimson-primary)' }}
                onClick={() => runAdminCommand('FORCE_WIN_DEFENDER')}
                disabled={lobby.status === 'COMPLETED'}
              >
                <Award size={14} /> Force Win P2
              </button>
            )}
          </div>

          {p2?.setup ? (
            <>
              {/* Engine Reveal */}
              <div className="glass-panel" style={{ padding: '12px', marginBottom: '12px', borderLeft: '4px solid #9b59b6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#d29bcf' }}>
                    🔥 Engine Concealed at Position {p2.setup.enginePosition}
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>
                    {p2.setup.engineCurrentHp} / {p2.setup.engineMaxHp} HP
                  </span>
                </div>
              </div>

              {/* Shield Reveal */}
              {p2.setup.shield && (
                <div className="glass-panel" style={{ padding: '10px', marginBottom: '12px', borderLeft: '4px solid var(--shield-blue)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--shield-blue)', fontWeight: 'bold' }}>
                      🛡️ Shield on {p2.setup.shield.protected_type === 'ENGINE' ? 'Engine' : `Pos ${p2.setup.shield.protected_position}`}
                    </span>
                    <span>{p2.setup.shield.current_hp} / {p2.setup.shield.max_hp} HP</span>
                  </div>
                </div>
              )}

              {/* Weapons List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {p2.setup.weapons?.map(w => (
                  <div key={w.position} className="glass-panel" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Pos {w.position}:</strong> {w.weapon_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${w.is_destroyed ? 'badge-crimson' : 'badge-gold'}`}>
                        {w.is_destroyed ? 'DESTROYED' : `${w.current_hp}/${w.max_hp} HP`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
              Defender has not joined the lobby yet.
            </div>
          )}
        </div>

      </div>

      {/* COMBAT LOG */}
      <div className="parchment-box" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '2px solid #8b5a2b', paddingBottom: '8px', marginBottom: '12px' }}>
          FULL COMBAT ACTION AUDIT LOG ({combatLog.length} Actions)
        </h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {combatLog.map((log) => (
            <div key={log.id} style={{ borderBottom: '1px dotted rgba(139,90,43,0.4)', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#8b5a2b' }}>
                <span>Round {log.round} • {log.action_type}</span>
                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                {log.result_summary}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ADJUST HP MODAL */}
      {showHpModal && (
        <div className="modal-overlay" onClick={() => setShowHpModal(false)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-pirate text-gold" style={{ fontSize: '1.8rem', marginBottom: '16px' }}>
              MANUAL HP ADJUSTER
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  TARGET PLAYER:
                </label>
                <select value={hpTargetPlayer} onChange={(e) => setHpTargetPlayer(e.target.value)} className="input-dark">
                  <option value="P1">Player 1 ({p1?.player?.captainName || 'Attacker'})</option>
                  <option value="P2">Player 2 ({p2?.player?.captainName || 'Defender'})</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  TARGET OBJECT:
                </label>
                <select value={hpTargetType} onChange={(e) => setHpTargetType(e.target.value)} className="input-dark">
                  <option value="ENGINE">Engine Core</option>
                  <option value="WEAPON">Weapon Position</option>
                </select>
              </div>

              {hpTargetType === 'WEAPON' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    WEAPON POSITION (1-10):
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={hpTargetPos} 
                    onChange={(e) => setHpTargetPos(parseInt(e.target.value, 10))} 
                    className="input-dark" 
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  NEW HP VALUE:
                </label>
                <input 
                  type="number" 
                  min="0" 
                  max="1000" 
                  value={newHpVal} 
                  onChange={(e) => setNewHpVal(e.target.value)} 
                  className="input-dark" 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button className="btn btn-outline" onClick={() => setShowHpModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-gold" onClick={handleApplyHp}>
                  Apply HP Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

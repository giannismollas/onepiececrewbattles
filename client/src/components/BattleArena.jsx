import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Swords, Wrench, Shield, AlertTriangle, Dices, Crosshair, Award, Flag, Share2, Volume2, ArrowRight, RotateCcw, ShieldAlert } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function BattleArena({ lobbyState, token, onOpenShare, navigate }) {
  const { lobby, viewer, yourSide, enemySide, combatLog = [] } = lobbyState;
  const yourPlayer = yourSide?.player;
  const yourSetup = yourSide?.setup;
  const enemyPlayer = enemySide?.player;
  const enemySetup = enemySide?.setup;

  const [selectedWeaponPos, setSelectedWeaponPos] = useState(null);
  const [selectedTargetPos, setSelectedTargetPos] = useState(1);
  const [activeActionTab, setActiveActionTab] = useState('attack'); // 'attack' | 'repair'
  const [selectedRepairTarget, setSelectedRepairTarget] = useState({ type: 'ENGINE', pos: yourSetup?.enginePosition || 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Animated dice banner state
  const [lastDiceData, setLastDiceData] = useState(null);
  const [isRollingDice, setIsRollingDice] = useState(false);

  // Surrender confirmation modal
  const [showSurrenderModal, setShowSurrenderModal] = useState(false);

  // Victory sound trigger
  const hasTriggeredVictorySound = useRef(false);
  const combatLogScrollRef = useRef(null);

  // Auto-scroll combat log to bottom
  useEffect(() => {
    if (combatLogScrollRef.current) {
      combatLogScrollRef.current.scrollTop = combatLogScrollRef.current.scrollHeight;
    }
  }, [combatLog]);

  // Operational weapons helper
  const operationalWeapons = yourSetup?.weapons?.filter(w => w.current_hp > 0 && !w.is_destroyed) || [];

  // Automatically select first operational weapon if none selected or selected is destroyed
  useEffect(() => {
    if (operationalWeapons.length > 0) {
      const isCurrentValid = operationalWeapons.some(w => w.position === selectedWeaponPos);
      if (!isCurrentValid) {
        setSelectedWeaponPos(operationalWeapons[0].position);
      }
    } else {
      setSelectedWeaponPos(null);
    }
  }, [yourSetup?.weapons, selectedWeaponPos]);

  // Listen to battle finish
  useEffect(() => {
    if ((lobby.status === 'COMPLETED' || lobby.status === 'SURRENDERED') && !hasTriggeredVictorySound.current) {
      hasTriggeredVictorySound.current = true;
      const isWinner = (lobby.winnerPlayerId === yourPlayer?.id);
      if (isWinner) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        soundEffects.playVictory();
      } else {
        soundEffects.playDefeat();
      }
    }
  }, [lobby.status, lobby.winnerPlayerId, yourPlayer?.id]);

  // Execute Attack
  const handleAttack = async () => {
    if (!lobby.isYourTurn) return;
    if (!selectedWeaponPos) {
      setActionError('⚠️ Select an operational weapon to fire.');
      return;
    }
    if (!selectedTargetPos) {
      setActionError('⚠️ Select an enemy target coordinate.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setIsRollingDice(true);
    soundEffects.playDiceRoll();

    try {
      const res = await fetch(`/api/lobby/${lobby.publicCode}/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          weaponPosition: selectedWeaponPos,
          targetPosition: selectedTargetPos
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Attack failed');
      } else {
        setLastDiceData(data);
        // Play weapon audio
        const wObj = yourSetup?.weapons?.find(w => w.position === selectedWeaponPos);
        const wDefId = wObj?.weapon_definition_id || '';
        setTimeout(() => {
          if (wDefId.includes('cannon')) soundEffects.playCannon();
          else if (wDefId.includes('ballista') || wDefId.includes('bow') || wDefId.includes('crossbow')) soundEffects.playBallista();
          else if (wDefId.includes('catapult') || wDefId.includes('mangonel')) soundEffects.playCatapult();
          else soundEffects.playCannon();

          if (data.details?.shieldHit) {
            setTimeout(() => soundEffects.playShieldClang(), 200);
          }
          if (data.details?.targetType === 'ENGINE') {
            setTimeout(() => soundEffects.playEngineHit(), 300);
          }
        }, 350);
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setIsRollingDice(false), 800);
    }
  };

  // Automatically select first valid repair target when targets change
  useEffect(() => {
    if (repairableTargets.length > 0) {
      const isCurrentValid = repairableTargets.some(t => t.type === selectedRepairTarget?.type && t.pos === selectedRepairTarget?.pos);
      if (!isCurrentValid) {
        setSelectedRepairTarget({ type: repairableTargets[0].type, pos: repairableTargets[0].pos });
      }
    } else {
      setSelectedRepairTarget(null);
    }
  }, [yourSetup?.engineCurrentHp, yourSetup?.weapons]);

  // Execute Repair
  const handleRepair = async () => {
    if (!lobby.isYourTurn) return;

    // Resolve target accurately
    const target = (selectedRepairTarget && repairableTargets.some(t => t.type === selectedRepairTarget.type && t.pos === selectedRepairTarget.pos))
      ? selectedRepairTarget
      : (repairableTargets.length > 0 ? repairableTargets[0] : null);

    if (!target) {
      setActionError('⚠️ No damaged operational target to repair.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    soundEffects.playRepair();

    try {
      const res = await fetch(`/api/lobby/${lobby.publicCode}/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          targetType: target.type,
          targetPosition: target.pos,
          repairDefinitionId: 'repair-kit'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Repair failed');
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Surrender
  const handleSurrender = async () => {
    setIsSubmitting(true);
    setShowSurrenderModal(false);
    soundEffects.playDefeat();

    try {
      await fetch(`/api/lobby/${lobby.publicCode}/surrender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // HP progress helpers
  const getHpPercent = (curr, max) => Math.max(0, Math.min(100, Math.round((curr / max) * 100)));
  const getHpColorClass = (curr, max) => {
    const p = (curr / max) * 100;
    if (p > 50) return 'hp-bar-green';
    if (p > 25) return 'hp-bar-yellow';
    return 'hp-bar-red';
  };

  const isGameOver = (lobby.status === 'COMPLETED' || lobby.status === 'SURRENDERED');
  const isWinner = (lobby.winnerPlayerId === yourPlayer?.id);

  // Available repairs count
  const repairItem = yourSetup?.repairs?.find(r => r.repair_definition_id === 'repair-kit') || { remaining_quantity: 0 };

  // Collect repairable objects (damaged but > 0 HP, not destroyed, NO shields)
  const repairableTargets = [];
  if (yourSetup?.engineCurrentHp > 0 && yourSetup?.engineCurrentHp < yourSetup?.engineMaxHp) {
    repairableTargets.push({
      type: 'ENGINE',
      pos: yourSetup.enginePosition,
      name: `Engine Core (Pos ${yourSetup.enginePosition})`,
      curr: yourSetup.engineCurrentHp,
      max: yourSetup.engineMaxHp
    });
  }
  if (yourSetup?.weapons) {
    yourSetup.weapons.forEach(w => {
      if (w.current_hp > 0 && w.current_hp < w.max_hp && !w.is_destroyed) {
        repairableTargets.push({
          type: 'WEAPON',
          pos: w.position,
          name: `Pos ${w.position}: ${w.weapon_name}`,
          curr: w.current_hp,
          max: w.max_hp
        });
      }
    });
  }

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* 1. MATCH STATUS BANNER */}
      <div className="gold-panel" style={{ padding: '16px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Left: Crews info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="badge badge-gold font-pirate" style={{ fontSize: '1.1rem' }}>
              {lobby.publicCode}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <span style={{ color: 'var(--gold-light)' }}>{yourPlayer?.captainName}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontFamily: 'var(--font-cinzel)' }}>VS</span>
                <span style={{ color: 'var(--crimson-primary)' }}>{enemyPlayer?.captainName || 'Enemy'}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {yourPlayer?.crewName} vs {enemyPlayer?.crewName || 'Opponent Fleet'}
              </div>
            </div>
          </div>

          {/* Center: Round & Turn Pulse */}
          <div style={{ textAlign: 'center' }}>
            <div className="font-pirate text-gold" style={{ fontSize: '1.6rem', letterSpacing: '1px' }}>
              ROUND {lobby.round}
            </div>
            <div style={{ marginTop: '2px' }}>
              {isGameOver ? (
                <span className={`badge ${isWinner ? 'badge-seafoam' : 'badge-crimson'}`} style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                  {isWinner ? '🏆 VICTORY ACHIEVED' : '💀 DEFEAT'}
                </span>
              ) : lobby.isYourTurn ? (
                <span className="badge badge-gold turn-pulse" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                  ⭐ YOUR TURN - CHOOSE ACTION
                </span>
              ) : (
                <span className="badge badge-crimson" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                  ⏳ {lobby.currentTurnCaptain ? `${lobby.currentTurnCaptain}'s Turn` : "Opponent's Turn"}...
                </span>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="btn btn-outline btn-sm" onClick={onOpenShare}>
              <Share2 size={16} /> Links
            </button>
            {!isGameOver && (
              <button 
                className="btn btn-outline btn-sm" 
                style={{ borderColor: 'var(--crimson-primary)', color: 'var(--crimson-primary)' }}
                onClick={() => setShowSurrenderModal(true)}
              >
                <Flag size={16} /> Surrender
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ERROR ALERT */}
      {actionError && (
        <div style={{ background: 'rgba(231, 76, 60, 0.25)', border: '1px solid var(--crimson-primary)', padding: '10px 16px', borderRadius: 'var(--radius-md)', color: '#ff7675', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* 2. THREE-COLUMN BATTLE GRID */}
      <div className="battle-grid">
        
        {/* COLUMN 1: YOUR SHIP DECK */}
        <div className="gold-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '10px', marginBottom: '14px' }}>
            <div>
              <h3 className="font-pirate text-gold" style={{ fontSize: '1.6rem' }}>
                YOUR FLAGSHIP
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {yourSetup?.ship?.ship_name || 'Combat Ship'} ({yourPlayer?.role})
              </div>
            </div>
            <span className="badge badge-gold">DEFENSE DECK</span>
          </div>

          {/* Engine HP Bar */}
          <div className="glass-panel" style={{ padding: '14px', marginBottom: '14px', borderLeft: '4px solid #9b59b6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', color: '#d29bcf', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                <Shield size={16} /> ENGINE CORE (POS {yourSetup?.enginePosition})
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: yourSetup?.engineCurrentHp <= 50 ? 'var(--crimson-primary)' : '#2ecc71' }}>
                {yourSetup?.engineCurrentHp} / {yourSetup?.engineMaxHp} HP
              </span>
            </div>
            <div className="hp-bar-container">
              <div 
                className={`hp-bar-fill ${getHpColorClass(yourSetup?.engineCurrentHp, yourSetup?.engineMaxHp)}`}
                style={{ width: `${getHpPercent(yourSetup?.engineCurrentHp, yourSetup?.engineMaxHp)}%` }}
              />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              *Hidden secretly from enemy radar. Protect at all costs!
            </div>
          </div>

          {/* Shield Status if active */}
          {yourSetup?.shield && (
            <div className="glass-panel" style={{ padding: '12px', marginBottom: '14px', borderLeft: '4px solid var(--shield-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--shield-blue)', fontSize: '0.88rem' }}>
                  🛡️ {yourSetup.shield.shield_name}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--shield-blue)' }}>
                  {yourSetup.shield.current_hp} / {yourSetup.shield.max_hp} HP
                </span>
              </div>
              <div className="hp-bar-container" style={{ height: '8px' }}>
                <div 
                  className="hp-bar-fill hp-bar-shield" 
                  style={{ width: `${getHpPercent(yourSetup.shield.current_hp, yourSetup.shield.max_hp)}%` }} 
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Protecting: {yourSetup.shield.protected_type === 'ENGINE' ? `Engine Core` : `Weapon Pos ${yourSetup.shield.protected_position}`} (Shields cannot be repaired!)
              </div>
            </div>
          )}

          {/* Weapon Slots List */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'var(--font-cinzel)' }}>
              WEAPON BATTERIES
            </div>

            {(!yourSetup?.weapons || yourSetup.weapons.length === 0) ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
                No offensive weapons equipped.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {yourSetup.weapons.map((w) => {
                  const isDestroyed = (w.current_hp <= 0 || w.is_destroyed);
                  const isSelected = (selectedWeaponPos === w.position);

                  return (
                    <div 
                      key={w.position}
                      onClick={() => {
                        if (!isDestroyed) {
                          soundEffects.playButtonClick();
                          setSelectedWeaponPos(w.position);
                        }
                      }}
                      className="glass-panel"
                      style={{
                        padding: '10px 12px',
                        cursor: isDestroyed ? 'not-allowed' : 'pointer',
                        border: isSelected ? '2px solid var(--gold-light)' : '1px solid var(--border-subtle)',
                        background: isDestroyed ? 'rgba(231, 76, 60, 0.1)' : (isSelected ? 'rgba(245, 166, 35, 0.15)' : 'rgba(7, 13, 24, 0.6)'),
                        opacity: isDestroyed ? 0.45 : 1
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: isSelected ? 'var(--gold-light)' : 'var(--text-main)' }}>
                          Pos {w.position}: {w.weapon_name}
                        </div>
                        <span className={`badge ${isDestroyed ? 'badge-crimson' : 'badge-gold'}`} style={{ fontSize: '0.7rem' }}>
                          {isDestroyed ? 'DESTROYED' : `${w.base_damage} DMG`}
                        </span>
                      </div>

                      <div className="hp-bar-container" style={{ height: '8px' }}>
                        <div 
                          className={`hp-bar-fill ${getHpColorClass(w.current_hp, w.max_hp)}`} 
                          style={{ width: `${getHpPercent(w.current_hp, w.max_hp)}%` }} 
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        <span>HP: {w.current_hp}/{w.max_hp}</span>
                        {isSelected && !isDestroyed && <span style={{ color: 'var(--gold-light)' }}>✓ READY TO FIRE</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Repair Kits remaining */}
          <div className="glass-panel" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <Wrench size={16} color="var(--seafoam-primary)" />
              <span style={{ color: 'var(--text-muted)' }}>Repair Inventory:</span>
            </div>
            <span className="badge badge-seafoam">
              {repairItem.remaining_quantity}x Kits Left
            </span>
          </div>

        </div>

        {/* COLUMN 2: ACTION CENTER & LIVE COMBAT LOG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Animated 3D Dice Banner */}
          {lastDiceData && (
            <div className="gold-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(16, 29, 48, 0.95)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                SERVER 1D6 DICE ROLL RESULT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', margin: '8px 0' }}>
                <div className={`font-pirate text-gold ${isRollingDice ? 'anim-dice' : ''}`} style={{ fontSize: '3rem', lineHeight: 1 }}>
                  🎲 {lastDiceData.diceRoll}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="badge badge-gold" style={{ fontSize: '0.9rem' }}>
                    {Math.round(lastDiceData.damageMultiplier * 100)}% Multiplier
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--crimson-primary)', marginTop: '2px' }}>
                    {lastDiceData.finalDamage} TOTAL DMG
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                {lastDiceData.resultSummary}
              </div>
            </div>
          )}

          {/* Action Tabs & Controls */}
          <div className="gold-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                className={`btn btn-sm ${activeActionTab === 'attack' ? 'btn-crimson' : 'btn-outline'}`}
                onClick={() => { soundEffects.playButtonClick(); setActiveActionTab('attack'); }}
                style={{ flex: 1 }}
              >
                <Swords size={16} /> ATTACK ENEMY
              </button>
              <button 
                className={`btn btn-sm ${activeActionTab === 'repair' ? 'btn-seafoam' : 'btn-outline'}`}
                onClick={() => { soundEffects.playButtonClick(); setActiveActionTab('repair'); }}
                style={{ flex: 1 }}
              >
                <Wrench size={16} /> REPAIR (+25 HP)
              </button>
            </div>

            {/* TAB: ATTACK */}
            {activeActionTab === 'attack' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      FIRING WEAPON:
                    </label>
                    <select 
                      value={selectedWeaponPos || ''} 
                      onChange={(e) => {
                        soundEffects.playButtonClick();
                        setSelectedWeaponPos(parseInt(e.target.value, 10));
                      }}
                      className="input-dark"
                      disabled={!lobby.isYourTurn || isSubmitting || isGameOver || operationalWeapons.length === 0}
                    >
                      {operationalWeapons.length === 0 ? (
                        <option value="">No operational weapons available</option>
                      ) : (
                        operationalWeapons.map(w => (
                          <option key={w.position} value={w.position}>
                            Pos {w.position}: {w.weapon_name} ({w.base_damage} DMG • {w.current_hp}/{w.max_hp} HP)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      ENEMY TARGET COORDINATE:
                    </label>
                    <select 
                      value={selectedTargetPos} 
                      onChange={(e) => {
                        soundEffects.playButtonClick();
                        setSelectedTargetPos(parseInt(e.target.value, 10));
                      }}
                      className="input-dark"
                      disabled={!lobby.isYourTurn || isSubmitting || isGameOver}
                    >
                      {enemySetup?.radarPositions?.map(r => (
                        <option key={r.position} value={r.position}>
                          Enemy Position {r.position} ({r.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button 
                  className={`btn btn-lg btn-crimson ${lobby.isYourTurn && !isGameOver ? 'turn-pulse' : ''}`}
                  onClick={handleAttack}
                  disabled={!lobby.isYourTurn || isSubmitting || isGameOver || operationalWeapons.length === 0}
                  style={{ width: '100%' }}
                >
                  <Crosshair size={20} />
                  {isSubmitting ? 'Calculating Trajectory...' : 'FIRE BROADSIDE! (1d6 Roll)'}
                </button>
              </div>
            )}

            {/* TAB: REPAIR */}
            {activeActionTab === 'repair' && (
              <div>
                <div style={{ background: 'rgba(52, 152, 219, 0.1)', border: '1px solid rgba(52, 152, 219, 0.3)', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--shield-blue)', marginBottom: '12px' }}>
                  🛡️ Note: Shields cannot be repaired. Destroyed objects (0 HP) cannot be repaired or revived.
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    SELECT DAMAGED TARGET TO REPAIR (+25 HP):
                  </label>
                  <select 
                    value={selectedRepairTarget ? `${selectedRepairTarget.type}_${selectedRepairTarget.pos}` : (repairableTargets[0] ? `${repairableTargets[0].type}_${repairableTargets[0].pos}` : '')}
                    onChange={(e) => {
                      soundEffects.playButtonClick();
                      const val = e.target.value;
                      if (val.startsWith('ENGINE_')) {
                        const p = parseInt(val.replace('ENGINE_', ''), 10);
                        setSelectedRepairTarget({ type: 'ENGINE', pos: p });
                      } else if (val.startsWith('WEAPON_')) {
                        const p = parseInt(val.replace('WEAPON_', ''), 10);
                        setSelectedRepairTarget({ type: 'WEAPON', pos: p });
                      }
                    }}
                    className="input-dark"
                    disabled={!lobby.isYourTurn || isSubmitting || isGameOver || repairableTargets.length === 0}
                  >
                    {repairableTargets.length === 0 ? (
                      <option value="">No damaged targets (Ship is at full health)</option>
                    ) : (
                      repairableTargets.map(t => (
                        <option key={`${t.type}_${t.pos}`} value={`${t.type}_${t.pos}`}>
                          {t.name} - {t.curr}/{t.max} HP (Damaged)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button 
                  className="btn btn-lg btn-seafoam"
                  onClick={handleRepair}
                  disabled={!lobby.isYourTurn || isSubmitting || isGameOver || repairItem.remaining_quantity <= 0 || repairableTargets.length === 0}
                  style={{ width: '100%' }}
                >
                  <Wrench size={20} />
                  {repairItem.remaining_quantity <= 0 ? 'No Repair Kits Remaining' : (repairableTargets.length === 0 ? 'No Damaged Objects to Repair' : 'CONFIRM REPAIR (+25 HP)')}
                </button>
              </div>
            )}
          </div>

          {/* LIVE COMBAT LOG (PARCHMENT SCROLL) */}
          <div className="parchment-box" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #8b5a2b', paddingBottom: '6px', marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1rem', letterSpacing: '1px' }}>
                📜 NAVAL BATTLE DISPATCH & LOG
              </span>
              <span style={{ fontSize: '0.8rem', color: '#5c3a21' }}>
                {combatLog.length} Actions Recorded
              </span>
            </div>

            <div 
              ref={combatLogScrollRef}
              style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', fontSize: '0.88rem' }}
            >
              {combatLog.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8b5a2b', padding: '20px 0', fontStyle: 'italic' }}>
                  No cannon fire exchanged yet. Attacker begins Round 1.
                </div>
              ) : (
                combatLog.map((log) => (
                  <div key={log.id} style={{ borderBottom: '1px dotted rgba(139,90,43,0.4)', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8b5a2b' }}>
                      <span>Round {log.round}</span>
                      <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontWeight: log.action_type === 'ATTACK' ? 'bold' : 'normal', marginTop: '2px' }}>
                      {log.result_summary}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* COLUMN 3: ENEMY SHIP RADAR GRID */}
        <div className="gold-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '10px', marginBottom: '14px' }}>
            <div>
              <h3 className="font-pirate text-crimson" style={{ fontSize: '1.6rem' }}>
                ENEMY VESSEL
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {enemySetup?.ship?.name || 'Enemy Fleet'} ({enemyPlayer?.role || 'Defender'})
              </div>
            </div>
            <span className="badge badge-crimson">RADAR TARGET</span>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Select enemy coordinate to target. Fog of War reveals information only upon impact.
          </p>

          {/* Enemy Radar Positions Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {enemySetup?.radarPositions?.map((r) => {
              const isSelected = (selectedTargetPos === r.position);

              // Status badge styling
              let statusBadge = <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#8b9bb4' }}>? UNKNOWN</span>;
              let bg = 'rgba(7, 13, 24, 0.6)';
              let border = isSelected ? '2px solid var(--crimson-primary)' : '1px solid var(--border-subtle)';

              if (r.status === 'EMPTY') {
                statusBadge = <span className="badge" style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db' }}>🌊 MISS (0 DMG)</span>;
              } else if (r.status === 'SHIELD_HIT') {
                statusBadge = <span className="badge badge-shield">🛡️ SHIELD HIT</span>;
                bg = 'rgba(52, 152, 219, 0.12)';
              } else if (r.status === 'HIT' || r.status === 'WEAPON_HIT' || r.status === 'ENGINE_HIT') {
                statusBadge = <span className="badge badge-crimson">🎯 HIT (DAMAGED)</span>;
                bg = 'rgba(231, 76, 60, 0.18)';
              } else if (r.status === 'WEAPON_DESTROYED') {
                statusBadge = <span className="badge badge-crimson">💥 TARGET DESTROYED</span>;
                bg = 'rgba(231, 76, 60, 0.25)';
              } else if (r.status === 'ENGINE_DESTROYED') {
                statusBadge = <span className="badge badge-crimson">💀 ENGINE DESTROYED!</span>;
                bg = 'rgba(231, 76, 60, 0.4)';
              }

              return (
                <div 
                  key={r.position}
                  onClick={() => {
                    soundEffects.playButtonClick();
                    setSelectedTargetPos(r.position);
                  }}
                  className="glass-panel"
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    background: bg,
                    border,
                    boxShadow: isSelected ? '0 0 15px var(--crimson-glow)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: isSelected ? 'var(--crimson-primary)' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? '#fff' : 'var(--gold-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}>
                      {r.position}
                    </div>
                    <span className="font-pirate" style={{ fontSize: '1.15rem', color: isSelected ? 'var(--crimson-primary)' : 'var(--text-main)' }}>
                      POSITION {r.position}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {statusBadge}
                    {isSelected && <Crosshair size={18} color="var(--crimson-primary)" />}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* 3. VICTORY / DEFEAT MODAL */}
      {isGameOver && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px' }}>
              {isWinner ? (
                <Award size={64} color="var(--gold-light)" style={{ filter: 'drop-shadow(0 0 15px var(--gold-glow))' }} />
              ) : (
                <AlertTriangle size={64} color="var(--crimson-primary)" />
              )}
            </div>

            <h2 className="font-pirate" style={{ fontSize: '3rem', color: isWinner ? 'var(--gold-light)' : 'var(--crimson-primary)', lineHeight: 1.1, marginBottom: '8px' }}>
              {isWinner ? 'GLORIOUS VICTORY!' : 'DEFEAT AT SEA'}
            </h2>

            <p className="font-cinzel" style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '20px' }}>
              {lobby.endReason === 'ENGINE_DESTROYED' ? 'Enemy Engine Has Been Utterly Destroyed!' : 'Match Terminated via Surrender'}
            </p>

            <div className="gold-panel" style={{ padding: '16px', margin: '0 auto 24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Winner:</span>
                <strong style={{ color: 'var(--gold-light)' }}>{isWinner ? yourPlayer?.captainName : enemyPlayer?.captainName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Rounds Exchanged:</span>
                <strong>{lobby.round} Rounds</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Outcome Reason:</span>
                <span className="badge badge-gold">{lobby.endReason}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-gold btn-lg"
                onClick={() => navigate(`/replay/${lobby.publicCode}`)}
              >
                <RotateCcw size={18} /> View Battle Replay
              </button>
              <button 
                className="btn btn-outline btn-lg"
                onClick={() => navigate('/')}
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SURRENDER CONFIRMATION MODAL */}
      {showSurrenderModal && (
        <div className="modal-overlay" onClick={() => setShowSurrenderModal(false)}>
          <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <Flag size={48} color="var(--crimson-primary)" style={{ marginBottom: '12px' }} />
            <h3 className="font-pirate text-crimson" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>
              STRIKE THE COLORS?
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Are you certain you wish to surrender? This will immediately forfeit the match and grant victory to {enemyPlayer?.captainName || 'the enemy'}.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
              <button className="btn btn-outline" onClick={() => setShowSurrenderModal(false)}>
                Never! Fight On!
              </button>
              <button className="btn btn-crimson" onClick={handleSurrender}>
                Yes, Surrender
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

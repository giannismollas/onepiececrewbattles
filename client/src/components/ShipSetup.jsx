import React, { useState, useEffect } from 'react';
import { Anchor, Shield, Wrench, EyeOff, Swords, CheckCircle, AlertTriangle, Lock, Unlock, Share2, Plus, Minus, Trash2, Crosshair, Sparkles, ShoppingBag, Package, X } from 'lucide-react';
import { soundEffects } from '../services/soundEffects';

export default function ShipSetup({ lobbyState, token, onOpenShare, onOpenRules }) {
  const { lobby, viewer, players, yourSide, enemySide } = lobbyState;
  const yourPlayer = yourSide?.player;
  const yourSetup = yourSide?.setup;

  const [definitions, setDefinitions] = useState({ ships: [], weapons: [], shields: [], repairs: [] });
  const [selectedShipId, setSelectedShipId] = useState(yourSetup?.ship?.ship_definition_id || 'ship');
  const [enginePos, setEnginePos] = useState(yourSetup?.enginePosition || 1);
  const [weaponSlots, setWeaponSlots] = useState({}); // { [pos]: { weaponDefinitionId, alias } }
  const [shieldPos, setShieldPos] = useState(yourSetup?.shield?.protected_position || 1);
  const [hasShieldAttached, setHasShieldAttached] = useState(!!yourSetup?.shield);
  const [shieldDefId, setShieldDefId] = useState(yourSetup?.shield?.shield_definition_id || 'iron-shield');
  const [repairQty, setRepairQty] = useState(yourSetup?.repairs?.[0]?.quantity !== undefined ? yourSetup.repairs[0].quantity : 0);

  // Dragging item tracking
  const [dragItem, setDragItem] = useState(null); // { type: 'WEAPON'|'ENGINE'|'SHIELD'|'REPAIR', id: string }
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [drawerTab, setDrawerTab] = useState('weapons'); // 'weapons' | 'items' | 'ships'

  // Fetch definitions
  useEffect(() => {
    fetch('/api/definitions')
      .then(res => res.json())
      .then(data => setDefinitions(data))
      .catch(() => {});
  }, []);

  // Sync state from server on load / update
  useEffect(() => {
    if (yourSetup) {
      if (yourSetup.ship?.ship_definition_id) setSelectedShipId(yourSetup.ship.ship_definition_id);
      if (yourSetup.enginePosition) setEnginePos(yourSetup.enginePosition);
      
      const newSlots = {};
      if (Array.isArray(yourSetup.weapons)) {
        yourSetup.weapons.forEach(w => {
          newSlots[w.position] = {
            weaponDefinitionId: w.weapon_definition_id,
            alias: w.alias || ''
          };
        });
      }
      setWeaponSlots(newSlots);

      if (yourSetup.shield) {
        setHasShieldAttached(true);
        setShieldPos(yourSetup.shield.protected_position);
        setShieldDefId(yourSetup.shield.shield_definition_id || 'iron-shield');
      } else {
        setHasShieldAttached(false);
      }

      if (yourSetup.repairs && yourSetup.repairs.length > 0 && yourSetup.repairs[0].quantity !== undefined) {
        setRepairQty(yourSetup.repairs[0].quantity);
      } else {
        setRepairQty(0);
      }
    }
  }, [yourSetup]);

  const currentShipDef = definitions.ships.find(s => s.id === selectedShipId) || {
    name: 'Ship',
    weapon_slots: 4,
    engine_hp: 200,
    is_combat: 1,
    capacity: 3
  };

  const isLocked = !!yourPlayer?.ready;

  // Unified save function
  const persistSetup = async (targetEnginePos, targetWeaponSlots, targetShieldPos, targetHasShield, targetRepairQty = repairQty) => {
    setIsSaving(true);
    setSetupError(null);

    const weaponArray = Object.entries(targetWeaponSlots).map(([pos, data]) => ({
      position: parseInt(pos, 10),
      weaponDefinitionId: data.weaponDefinitionId,
      alias: data.alias || ''
    }));

    const shieldPayload = targetHasShield ? {
      shieldDefinitionId: shieldDefId,
      protectedType: targetShieldPos === targetEnginePos ? 'ENGINE' : 'WEAPON',
      protectedPosition: targetShieldPos
    } : null;

    try {
      const res = await fetch(`/api/lobby/${lobby.publicCode}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          enginePosition: targetEnginePos,
          weapons: weaponArray,
          shield: shieldPayload,
          repairs: { repairDefinitionId: 'repair-kit', quantity: targetRepairQty }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || 'Failed to save setup');
        return false;
      } else {
        setSaveSuccessMsg('✓ Layout saved');
        setTimeout(() => setSaveSuccessMsg(null), 2000);
        return true;
      }
    } catch (err) {
      setSetupError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Change ship
  const handleSelectShip = async (shipId) => {
    if (isLocked) return;
    const targetShip = definitions.ships.find(s => s.id === shipId);
    if (!targetShip || !targetShip.is_combat) {
      setSetupError('Selected vessel cannot participate in Ship VS Ship combat.');
      return;
    }

    soundEffects.playButtonClick();
    setSelectedShipId(shipId);
    setSetupError(null);

    try {
      await fetch(`/api/lobby/${lobby.publicCode}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, shipDefinitionId: shipId })
      });
      // Adjust engine position if outside new bounds
      let newEngPos = enginePos;
      if (newEngPos > targetShip.weapon_slots) newEngPos = 1;
      setEnginePos(newEngPos);

      // Filter weapons outside bounds
      const filteredSlots = {};
      Object.entries(weaponSlots).forEach(([pos, data]) => {
        const p = parseInt(pos, 10);
        if (p <= targetShip.weapon_slots && p !== newEngPos) {
          filteredSlots[p] = data;
        }
      });
      setWeaponSlots(filteredSlots);
      persistSetup(newEngPos, filteredSlots, shieldPos > targetShip.weapon_slots ? 1 : shieldPos, hasShieldAttached, repairQty);
    } catch (err) {
      setSetupError(err.message);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (type, id) => {
    if (isLocked) return;
    setDragItem({ type, id });
  };

  const handleDropOnPosition = (pos) => {
    if (isLocked || !dragItem) return;
    const p = parseInt(pos, 10);
    soundEffects.playButtonClick();

    if (dragItem.type === 'WEAPON') {
      if (p === enginePos) {
        setSetupError(`Position ${p} holds your Engine. Move the Engine elsewhere before placing a weapon here.`);
        setDragItem(null);
        return;
      }
      const updated = { ...weaponSlots, [p]: { weaponDefinitionId: dragItem.id, alias: '' } };
      setWeaponSlots(updated);
      persistSetup(enginePos, updated, shieldPos, hasShieldAttached, repairQty);
    } else if (dragItem.type === 'ENGINE') {
      setEnginePos(p);
      const updated = { ...weaponSlots };
      delete updated[p];
      setWeaponSlots(updated);
      persistSetup(p, updated, shieldPos, hasShieldAttached, repairQty);
    } else if (dragItem.type === 'SHIELD') {
      setHasShieldAttached(true);
      setShieldPos(p);
      setShieldDefId(dragItem.id || 'iron-shield');
      persistSetup(enginePos, weaponSlots, p, true, repairQty);
    }

    setDragItem(null);
  };

  // Drop on Ship Inventory
  const handleDropOnInventory = () => {
    if (isLocked || !dragItem) return;
    if (dragItem.type === 'REPAIR') {
      handleAddRepairKit();
    }
    setDragItem(null);
  };

  const handleSetEngine = (pos) => {
    if (isLocked) return;
    soundEffects.playButtonClick();
    const p = parseInt(pos, 10);
    setEnginePos(p);
    const updated = { ...weaponSlots };
    delete updated[p];
    setWeaponSlots(updated);
    persistSetup(p, updated, shieldPos, hasShieldAttached, repairQty);
  };

  const handleAttachShield = (pos) => {
    if (isLocked) return;
    soundEffects.playButtonClick();
    const p = parseInt(pos, 10);
    setHasShieldAttached(true);
    setShieldPos(p);
    persistSetup(enginePos, weaponSlots, p, true, repairQty);
  };

  const handleRemoveShield = () => {
    if (isLocked) return;
    soundEffects.playButtonClick();
    setHasShieldAttached(false);
    persistSetup(enginePos, weaponSlots, shieldPos, false, repairQty);
  };

  const handleRemoveWeapon = (pos) => {
    if (isLocked) return;
    soundEffects.playButtonClick();
    const p = parseInt(pos, 10);
    const updated = { ...weaponSlots };
    delete updated[p];
    setWeaponSlots(updated);
    persistSetup(enginePos, updated, shieldPos, hasShieldAttached, repairQty);
  };

  // Add a repair kit item to Ship Inventory
  const handleAddRepairKit = () => {
    if (isLocked) return;
    soundEffects.playButtonClick();
    const nextQty = Math.min(10, repairQty + 1);
    setRepairQty(nextQty);
    persistSetup(enginePos, weaponSlots, shieldPos, hasShieldAttached, nextQty);
  };

  // Remove a specific repair kit from Ship Inventory
  const handleRemoveRepairKit = () => {
    if (isLocked) return;
    soundEffects.playButtonClick();
    const nextQty = Math.max(0, repairQty - 1);
    setRepairQty(nextQty);
    persistSetup(enginePos, weaponSlots, shieldPos, hasShieldAttached, nextQty);
  };

  // Lock & Ready handler
  const handleToggleReady = async () => {
    setSetupError(null);
    setIsTogglingReady(true);
    soundEffects.playButtonClick();

    if (!isLocked) {
      // Validate at least 1 weapon equipped
      const equippedCount = Object.keys(weaponSlots).length;
      if (equippedCount === 0) {
        setSetupError('⚠️ You must equip at least one weapon in an empty slot before locking in Ready!');
        setIsTogglingReady(false);
        return;
      }

      // Save setup first to guarantee database synchronization
      const saveOk = await persistSetup(enginePos, weaponSlots, shieldPos, hasShieldAttached, repairQty);
      if (!saveOk) {
        setIsTogglingReady(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/lobby/${lobby.publicCode}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || 'Failed to toggle ready.');
      }
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setIsTogglingReady(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      
      {/* 1. TOP STATUS & READY BAR */}
      <div className="gold-panel" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-gold btn-sm font-pirate"
                onClick={() => {
                  navigator.clipboard.writeText(lobby.publicCode);
                  soundEffects.playButtonClick();
                  setSaveSuccessMsg(`✓ Copied Code: ${lobby.publicCode}`);
                  setTimeout(() => setSaveSuccessMsg(null), 2500);
                }}
                style={{ fontSize: '1rem', letterSpacing: '1px', padding: '4px 10px' }}
                title="Click to copy Lobby Code"
              >
                📋 CODE: {lobby.publicCode} (Copy)
              </button>
              <span className={`badge ${isLocked ? 'badge-seafoam' : 'badge-gold'}`}>
                {isLocked ? '🔒 LOCKED & READY' : '⚓ CUSTOMIZING OUTFIT'}
              </span>
              {saveSuccessMsg && <span style={{ color: 'var(--seafoam-primary)', fontSize: '0.85rem' }}>{saveSuccessMsg}</span>}
            </div>
            <h2 className="font-pirate text-gold" style={{ fontSize: '2.4rem', marginTop: '4px', lineHeight: 1.1 }}>
              {yourPlayer?.captainName} ({yourPlayer?.crewName})
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Role: <strong style={{ color: 'var(--gold-light)' }}>{yourPlayer?.role}</strong> • Flagship: <strong>{currentShipDef.name}</strong> ({currentShipDef.weapon_slots} Total Slots • Engine: {currentShipDef.engine_hp} HP)
            </div>
          </div>

          {/* Opponent Status & Ready Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={onOpenShare}>
              <Share2 size={16} /> Share Links
            </button>

            {/* Opponent Tracker */}
            <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OPPONENT:</div>
              {enemySide?.player ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{enemySide.player.captainName}</span>
                  <span className={`badge ${enemySide.player.ready ? 'badge-seafoam' : 'badge-crimson'}`}>
                    {enemySide.player.ready ? 'READY' : 'CUSTOMIZING'}
                  </span>
                </div>
              ) : (
                <span className="badge badge-crimson">WAITING FOR DEFENDER...</span>
              )}
            </div>

            {/* LOCK & READY BUTTON */}
            <button 
              className={`btn btn-lg ${isLocked ? 'btn-seafoam' : 'btn-gold turn-pulse'}`}
              onClick={handleToggleReady}
              disabled={isTogglingReady || isSaving}
              style={{ minWidth: '180px' }}
            >
              {isLocked ? (
                <><Unlock size={18} /> UNREADY / EDIT</>
              ) : (
                <><Lock size={18} /> LOCK & READY</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {setupError && (
        <div style={{ background: 'rgba(231, 76, 60, 0.25)', border: '1px solid var(--crimson-primary)', padding: '12px 18px', borderRadius: 'var(--radius-md)', color: '#ff7675', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={20} />
          <span>{setupError}</span>
        </div>
      )}

      {/* 2. MAIN OUTFITTING GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) 380px', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: SHIP HULL GRID + SHIP INVENTORY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 1. SHIP HULL SLOTS */}
          <div className="gold-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 className="font-pirate text-gold" style={{ fontSize: '1.9rem' }}>
                  {currentShipDef.name.toUpperCase()} HULL POSITIONS
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Drag Weapons, Engine Core, or Iron Shield from the right into any slot.
                </p>
              </div>
              <div className="badge badge-gold">
                {Object.keys(weaponSlots).length} Weapons Placed
              </div>
            </div>

            {/* Slots Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Array.from({ length: currentShipDef.weapon_slots }, (_, idx) => {
                const pos = idx + 1;
                const isEngine = (pos === enginePos);
                const weapon = weaponSlots[pos];
                const wepDef = weapon ? definitions.weapons.find(w => w.id === weapon.weaponDefinitionId) : null;
                const isShielded = (hasShieldAttached && shieldPos === pos);

                return (
                  <div 
                    key={pos}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnPosition(pos)}
                    className="glass-panel"
                    style={{
                      padding: '16px',
                      border: isShielded 
                        ? '2px solid var(--shield-blue)' 
                        : (isEngine ? '2px solid #9b59b6' : (weapon ? '1px solid var(--border-gold)' : '2px dashed rgba(255,255,255,0.15)')),
                      background: isEngine ? 'rgba(155, 89, 182, 0.12)' : (weapon ? 'rgba(16, 29, 48, 0.95)' : 'rgba(7, 13, 24, 0.6)'),
                      boxShadow: isShielded ? '0 0 15px var(--shield-glow)' : (isEngine ? '0 0 15px rgba(155, 89, 182, 0.3)' : 'none'),
                      borderRadius: 'var(--radius-md)',
                      minHeight: '170px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    {/* Slot Top Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="font-pirate text-gold" style={{ fontSize: '1.3rem' }}>
                          POSITION {pos}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {isShielded && (
                          <span className="badge badge-shield" style={{ fontSize: '0.7rem' }}>
                            🛡️ SHIELDED (50 HP)
                          </span>
                        )}
                        {isEngine && (
                          <span className="badge" style={{ background: '#9b59b6', color: '#fff', fontSize: '0.7rem' }}>
                            🔥 CONCEALED ENGINE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Slot Middle Body */}
                    {isEngine ? (
                      <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#d29bcf', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <EyeOff size={18} /> SECRET ENGINE CORE
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          ❤️ {currentShipDef.engine_hp} HP • Hidden from Enemy Radar
                        </div>
                      </div>
                    ) : weapon && wepDef ? (
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--gold-light)', fontSize: '1.1rem' }}>
                          {wepDef.name}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          💥 Base DMG: <strong style={{ color: 'var(--crimson-primary)' }}>{wepDef.base_damage}</strong> • ❤️ HP: {wepDef.max_hp}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>EMPTY POSITION</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                          {!isLocked ? 'Drop weapon, engine, or shield here' : 'Vacant'}
                        </div>
                      </div>
                    )}

                    {/* Slot Bottom Controls */}
                    {!isLocked && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {/* Shield Toggle Button */}
                          {isShielded ? (
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={handleRemoveShield}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#ff7675', borderColor: 'rgba(231,76,60,0.4)' }}
                              title="Remove Shield from this slot"
                            >
                              Remove Shield
                            </button>
                          ) : (
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => handleAttachShield(pos)}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--shield-blue)', borderColor: 'rgba(52,152,219,0.4)' }}
                              title="Attach Iron Shield to this position"
                            >
                              🛡️ Shield
                            </button>
                          )}

                          {/* Set Engine Button if not already engine */}
                          {!isEngine && (
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => handleSetEngine(pos)}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#d29bcf', borderColor: 'rgba(155,89,182,0.4)' }}
                              title="Conceal Engine in this slot"
                            >
                              🔥 Engine
                            </button>
                          )}
                        </div>

                        {/* Remove Weapon button if weapon present */}
                        {weapon && (
                          <button 
                            className="btn btn-outline btn-sm"
                            onClick={() => handleRemoveWeapon(pos)}
                            style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                            title="Unequip Weapon"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. SHIP INVENTORY & BACKPACK (DRAG TARGET ZONE) */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnInventory}
            className="gold-panel" 
            style={{ 
              padding: '20px 24px', 
              borderLeft: '4px solid var(--seafoam-primary)',
              background: dragItem?.type === 'REPAIR' ? 'rgba(26, 188, 156, 0.15)' : 'rgba(16, 29, 48, 0.95)',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-gold)', paddingBottom: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag color="var(--seafoam-primary)" size={22} />
                <h3 className="font-pirate text-seafoam" style={{ fontSize: '1.7rem' }}>
                  SHIP INVENTORY & REPAIR ITEMS
                </h3>
              </div>
              <span className="badge badge-seafoam">
                {repairQty}x Total Items Loaded
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Drag <strong>Repair Kits</strong> from the Items drawer into this inventory as many times as you want! Each kit restores +25 HP during battle.
            </p>

            {/* Inventory Grid Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              
              {/* Individual Repair Kit Cards */}
              {Array.from({ length: repairQty }, (_, index) => (
                <div 
                  key={index} 
                  className="glass-panel"
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(26, 188, 156, 0.12)',
                    border: '1px solid var(--seafoam-primary)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: 'rgba(26, 188, 156, 0.25)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <Wrench size={16} color="var(--seafoam-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--seafoam-primary)', fontSize: '0.88rem' }}>
                        Repair Kit #{index + 1}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        +25 HP (0 Beli)
                      </div>
                    </div>
                  </div>

                  {!isLocked && (
                    <button 
                      className="btn btn-outline btn-sm"
                      onClick={handleRemoveRepairKit}
                      style={{ 
                        padding: '4px 6px', 
                        color: '#ff7675', 
                        borderColor: 'rgba(231,76,60,0.4)',
                        background: 'rgba(231,76,60,0.1)'
                      }}
                      title="Remove this Repair Kit"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add / Drop Card */}
              {!isLocked && (
                <div 
                  onClick={handleAddRepairKit}
                  style={{
                    padding: '12px 14px',
                    border: '2px dashed rgba(26, 188, 156, 0.4)',
                    background: 'rgba(7, 13, 24, 0.5)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    minHeight: '52px',
                    color: 'var(--seafoam-primary)',
                    fontSize: '0.85rem'
                  }}
                  title="Click to add another kit or drag from the right"
                >
                  <Plus size={16} /> Drop or Click to Add (+1 Kit)
                </div>
              )}

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: NAVAL ARSENAL & EQUIPMENT DRAWER */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          
          {/* Drawer Tabs */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-gold)', paddingBottom: '10px', marginBottom: '14px' }}>
            <button 
              className={`btn btn-sm ${drawerTab === 'weapons' ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => { soundEffects.playButtonClick(); setDrawerTab('weapons'); }}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.8rem' }}
            >
              <Swords size={14} /> Weapons
            </button>

            <button 
              className={`btn btn-sm ${drawerTab === 'items' ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => { soundEffects.playButtonClick(); setDrawerTab('items'); }}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.8rem' }}
            >
              <Shield size={14} /> Items
            </button>

            <button 
              className={`btn btn-sm ${drawerTab === 'ships' ? 'btn-gold' : 'btn-outline'}`}
              onClick={() => { soundEffects.playButtonClick(); setDrawerTab('ships'); }}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.8rem' }}
              disabled={isLocked}
            >
              <Anchor size={14} /> Ships
            </button>
          </div>

          {/* TAB 1: WEAPONS DRAWER */}
          {drawerTab === 'weapons' && (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Drag weapon into any slot, or click to equip into the first available position:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
                {definitions.weapons.map((w) => (
                  <div 
                    key={w.id}
                    draggable={!isLocked}
                    onDragStart={() => handleDragStart('WEAPON', w.id)}
                    onClick={() => {
                      if (isLocked) return;
                      // Find first vacant position that is not engine
                      for (let p = 1; p <= currentShipDef.weapon_slots; p++) {
                        if (p !== enginePos && !weaponSlots[p]) {
                          soundEffects.playButtonClick();
                          const updated = { ...weaponSlots, [p]: { weaponDefinitionId: w.id, alias: '' } };
                          setWeaponSlots(updated);
                          persistSetup(enginePos, updated, shieldPos, hasShieldAttached, repairQty);
                          break;
                        }
                      }
                    }}
                    className="glass-panel"
                    style={{
                      padding: '12px',
                      cursor: isLocked ? 'default' : 'grab',
                      background: 'rgba(7, 13, 24, 0.75)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--gold-light)', fontSize: '0.95rem' }}>
                        {w.name}
                      </div>
                      <span className="badge badge-crimson" style={{ fontSize: '0.75rem' }}>
                        {w.base_damage} DMG
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>❤️ HP: {w.max_hp}</span>
                      <span style={{ color: 'var(--gold-light)' }}>{w.price.toLocaleString()} Beli</span>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>
                      {w.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ITEMS & SHIP MODULES (SHIELD, ENGINE, REPAIR KITS) */}
          {drawerTab === 'items' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Drag tactical items onto your Ship Hull or into your Ship Inventory:
              </p>

              {/* 1. DRAGGABLE ENGINE ITEM */}
              <div 
                draggable={!isLocked}
                onDragStart={() => handleDragStart('ENGINE', 'engine')}
                className="glass-panel"
                style={{
                  padding: '14px',
                  border: '2px solid #9b59b6',
                  background: 'rgba(155, 89, 182, 0.15)',
                  cursor: isLocked ? 'default' : 'grab'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#d29bcf', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <EyeOff size={16} /> 🔥 CONCEALED ENGINE CORE
                  </div>
                  <span className="badge" style={{ background: '#9b59b6', color: '#fff' }}>
                    Pos {enginePos}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ❤️ {currentShipDef.engine_hp} HP • Destroying enemy engine = Victory!
                </div>
                <div style={{ fontSize: '0.74rem', color: '#d29bcf', marginTop: '6px' }}>
                  *Drag onto any position 1-{currentShipDef.weapon_slots} to conceal it there.
                </div>
              </div>

              {/* 2. DRAGGABLE SHIELD ITEM */}
              <div 
                draggable={!isLocked}
                onDragStart={() => handleDragStart('SHIELD', 'iron-shield')}
                className="glass-panel"
                style={{
                  padding: '14px',
                  border: '2px solid var(--shield-blue)',
                  background: 'rgba(52, 152, 219, 0.15)',
                  cursor: isLocked ? 'default' : 'grab'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--shield-blue)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} /> 🛡️ IRON NAVAL SHIELD
                  </div>
                  <span className="badge badge-shield">
                    {hasShieldAttached ? `Pos ${shieldPos}` : 'Unassigned'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  🛡️ 50 HP • Absorbs incoming damage before underlying target is hit.
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--shield-blue)', marginTop: '6px' }}>
                  *Drag onto any slot to protect that weapon or the engine. Shields cannot be repaired!
                </div>
              </div>

              {/* 3. DRAGGABLE REPAIR KIT ITEM */}
              <div 
                draggable={!isLocked}
                onDragStart={() => handleDragStart('REPAIR', 'repair-kit')}
                onClick={() => {
                  if (!isLocked) handleAddRepairKit();
                }}
                className="glass-panel"
                style={{
                  padding: '14px',
                  border: '2px solid var(--seafoam-primary)',
                  background: 'rgba(26, 188, 156, 0.15)',
                  cursor: isLocked ? 'default' : 'grab'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--seafoam-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={16} /> 🛠️ EMERGENCY REPAIR KIT
                  </div>
                  <span className="badge badge-seafoam">0 Beli (Free)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Restores +25 HP to a damaged weapon or Engine during combat (consumes turn).
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--seafoam-primary)', marginTop: '6px' }}>
                  *Drag this item into your Ship Inventory as many times as you want! (or click to add)
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SELECT SHIP VESSEL */}
          {drawerTab === 'ships' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Select a combat ship hull to increase slot capacity:
              </p>

              {definitions.ships.map((s) => {
                const isSelected = (s.id === selectedShipId);
                return (
                  <div 
                    key={s.id}
                    onClick={() => handleSelectShip(s.id)}
                    className="glass-panel"
                    style={{
                      padding: '12px',
                      cursor: s.is_combat && !isLocked ? 'pointer' : 'not-allowed',
                      opacity: s.is_combat ? 1 : 0.45,
                      border: isSelected ? '2px solid var(--gold-light)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(245, 166, 35, 0.15)' : 'rgba(7, 13, 24, 0.7)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 'bold', color: isSelected ? 'var(--gold-light)' : 'var(--text-main)', fontSize: '0.95rem' }}>
                        {s.name}
                      </div>
                      <span className={`badge ${s.is_combat ? 'badge-gold' : 'badge-crimson'}`} style={{ fontSize: '0.7rem' }}>
                        {s.weapon_slots} SLOTS
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <span>❤️ Engine: {s.engine_hp} HP</span>
                      <span style={{ color: 'var(--gold-light)' }}>{s.price.toLocaleString()} Beli</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

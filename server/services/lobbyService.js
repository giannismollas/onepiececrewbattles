import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db/database.js';

// Generates readable public codes like SHIP-7X4K92
function generatePublicCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'SHIP-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateSecureToken() {
  return crypto.randomBytes(24).toString('hex');
}

export const LobbyService = {
  // Create a new lobby with Player 1 (Attacker)
  createLobby(captainName, crewName) {
    let publicCode = generatePublicCode();
    // Ensure uniqueness
    let existing = db.prepare('SELECT id FROM lobbies WHERE public_code = ?').get(publicCode);
    while (existing) {
      publicCode = generatePublicCode();
      existing = db.prepare('SELECT id FROM lobbies WHERE public_code = ?').get(publicCode);
    }

    const lobbyId = uuidv4();
    const playerId = uuidv4();
    const playerToken = generateSecureToken();
    const adminToken = generateSecureToken();
    const now = new Date().toISOString();

    const createTransaction = db.transaction(() => {
      // 1. Create lobby
      db.prepare(`
        INSERT INTO lobbies (id, public_code, status, current_round, created_at)
        VALUES (?, ?, 'WAITING_FOR_PLAYER', 1, ?)
      `).run(lobbyId, publicCode, now);

      // 2. Create Player 1 (Attacker)
      db.prepare(`
        INSERT INTO lobby_players (id, lobby_id, role, captain_name, crew_name, player_token, ready, joined_at, last_seen)
        VALUES (?, ?, 'ATTACKER', ?, ?, ?, 0, ?, ?)
      `).run(playerId, lobbyId, captainName.trim() || 'Attacker Captain', crewName.trim() || 'Attacker Crew', playerToken, now, now);

      // 3. Create Admin Token
      db.prepare(`
        INSERT INTO lobby_admin_access (id, lobby_id, admin_token, created_at)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), lobbyId, adminToken, now);

      // 4. Default ship setup for Player 1 (Ship definition: 'ship')
      const defaultShip = db.prepare('SELECT * FROM ship_definitions WHERE id = ?').get('ship');
      db.prepare(`
        INSERT INTO lobby_ship_setups (id, lobby_id, player_id, ship_definition_id, engine_position, engine_current_hp, engine_max_hp, locked)
        VALUES (?, ?, ?, 'ship', 1, ?, ?, 0)
      `).run(uuidv4(), lobbyId, playerId, defaultShip.engine_hp, defaultShip.engine_hp);

      // Default 0x repair kits (players buy them for 0 Beli in setup)
      db.prepare(`
        INSERT INTO lobby_repairs (id, lobby_id, player_id, repair_definition_id, quantity, remaining_quantity)
        VALUES (?, ?, ?, 'repair-kit', 0, 0)
      `).run(uuidv4(), lobbyId, playerId);
    });

    createTransaction();

    return {
      lobbyId,
      publicCode,
      playerToken,
      adminToken,
      role: 'ATTACKER'
    };
  },

  // Join lobby as Player 2 (Defender)
  joinLobby(publicCode, captainName, crewName) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE public_code = ?').get(publicCode);
    if (!lobby) {
      throw new Error('Lobby not found.');
    }

    // Check if player 2 already exists
    const defender = db.prepare(`SELECT * FROM lobby_players WHERE lobby_id = ? AND role = 'DEFENDER'`).get(lobby.id);
    if (defender) {
      throw new Error('LOBBY_FULL');
    }

    const playerId = uuidv4();
    const playerToken = generateSecureToken();
    const now = new Date().toISOString();

    const joinTransaction = db.transaction(() => {
      // 1. Insert Defender
      db.prepare(`
        INSERT INTO lobby_players (id, lobby_id, role, captain_name, crew_name, player_token, ready, joined_at, last_seen)
        VALUES (?, ?, 'DEFENDER', ?, ?, ?, 0, ?, ?)
      `).run(playerId, lobby.id, captainName.trim() || 'Defender Captain', crewName.trim() || 'Defender Crew', playerToken, now, now);

      // 2. Update lobby status to SETUP if it was WAITING_FOR_PLAYER
      if (lobby.status === 'WAITING_FOR_PLAYER') {
        db.prepare(`UPDATE lobbies SET status = 'SETUP' WHERE id = ?`).run(lobby.id);
      }

      // 3. Default ship setup for Player 2
      const defaultShip = db.prepare('SELECT * FROM ship_definitions WHERE id = ?').get('ship');
      db.prepare(`
        INSERT INTO lobby_ship_setups (id, lobby_id, player_id, ship_definition_id, engine_position, engine_current_hp, engine_max_hp, locked)
        VALUES (?, ?, ?, 'ship', 1, ?, ?, 0)
      `).run(uuidv4(), lobby.id, playerId, defaultShip.engine_hp, defaultShip.engine_hp);

      // Default 0x repair kit
      db.prepare(`
        INSERT INTO lobby_repairs (id, lobby_id, player_id, repair_definition_id, quantity, remaining_quantity)
        VALUES (?, ?, ?, 'repair-kit', 0, 0)
      `).run(uuidv4(), lobby.id, playerId);
    });

    joinTransaction();

    return {
      lobbyId: lobby.id,
      publicCode: lobby.public_code,
      playerToken,
      role: 'DEFENDER'
    };
  },

  // Lookup player / admin by token
  authenticateToken(publicCode, token) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE public_code = ?').get(publicCode);
    if (!lobby) return null;

    // Check player token
    const player = db.prepare('SELECT * FROM lobby_players WHERE lobby_id = ? AND player_token = ?').get(lobby.id, token);
    if (player) {
      return {
        type: 'PLAYER',
        lobby,
        player,
        role: player.role
      };
    }

    // Check admin token
    const admin = db.prepare('SELECT * FROM lobby_admin_access WHERE lobby_id = ? AND admin_token = ?').get(lobby.id, token);
    if (admin) {
      return {
        type: 'ADMIN',
        lobby,
        role: 'ADMIN'
      };
    }

    return null;
  },

  // Select ship for a player
  selectShip(lobbyId, playerId, shipDefinitionId) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    if (!lobby || (lobby.status !== 'WAITING_FOR_PLAYER' && lobby.status !== 'SETUP' && lobby.status !== 'READY')) {
      throw new Error('Cannot change ship while battle is active or completed.');
    }

    const player = db.prepare('SELECT * FROM lobby_players WHERE id = ?').get(playerId);
    if (player.ready) {
      throw new Error('Cannot change ship while locked in READY state.');
    }

    const shipDef = db.prepare('SELECT * FROM ship_definitions WHERE id = ?').get(shipDefinitionId);
    if (!shipDef) {
      throw new Error('Ship definition not found.');
    }
    if (!shipDef.is_combat) {
      throw new Error('Selected ship cannot participate in Ship VS Ship combat.');
    }

    const tx = db.transaction(() => {
      // Update setup
      db.prepare(`
        UPDATE lobby_ship_setups
        SET ship_definition_id = ?, engine_current_hp = ?, engine_max_hp = ?
        WHERE lobby_id = ? AND player_id = ?
      `).run(shipDef.id, shipDef.engine_hp, shipDef.engine_hp, lobbyId, playerId);

      // Remove any weapons/shields placed in positions outside new slot count
      db.prepare(`
        DELETE FROM lobby_weapon_positions
        WHERE lobby_id = ? AND player_id = ? AND position > ?
      `).run(lobbyId, playerId, shipDef.weapon_slots);

      db.prepare(`
        DELETE FROM lobby_shields
        WHERE lobby_id = ? AND player_id = ? AND protected_type = 'WEAPON' AND protected_position > ?
      `).run(lobbyId, playerId, shipDef.weapon_slots);

      // Make sure engine position is within bounds
      const setup = db.prepare('SELECT engine_position FROM lobby_ship_setups WHERE lobby_id = ? AND player_id = ?').get(lobbyId, playerId);
      if (setup.engine_position > shipDef.weapon_slots) {
        db.prepare('UPDATE lobby_ship_setups SET engine_position = 1 WHERE lobby_id = ? AND player_id = ?').run(lobbyId, playerId);
      }
    });

    tx();
  },

  // Save complete layout (weapons, engine, shield, repairs)
  saveSetup(lobbyId, playerId, { enginePosition, weapons, shield, repairs }) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    if (!lobby || (lobby.status !== 'WAITING_FOR_PLAYER' && lobby.status !== 'SETUP' && lobby.status !== 'READY')) {
      throw new Error('Cannot modify setup after battle has started.');
    }

    const player = db.prepare('SELECT * FROM lobby_players WHERE id = ?').get(playerId);
    if (player.ready) {
      throw new Error('Unready first to modify setup.');
    }

    const setup = db.prepare('SELECT * FROM lobby_ship_setups WHERE lobby_id = ? AND player_id = ?').get(lobbyId, playerId);
    const shipDef = db.prepare('SELECT * FROM ship_definitions WHERE id = ?').get(setup.ship_definition_id);

    const targetEnginePos = parseInt(enginePosition, 10) || 1;
    if (targetEnginePos < 1 || targetEnginePos > shipDef.weapon_slots) {
      throw new Error(`Engine position must be between 1 and ${shipDef.weapon_slots}.`);
    }

    // Validate weapons
    const placedPositions = new Set();
    if (Array.isArray(weapons)) {
      for (const w of weapons) {
        const pos = parseInt(w.position, 10);
        if (pos < 1 || pos > shipDef.weapon_slots) {
          throw new Error(`Weapon position ${pos} is out of bounds for ship (1-${shipDef.weapon_slots}).`);
        }
        if (pos === targetEnginePos) {
          throw new Error(`Position ${pos} is occupied by the Engine. Offensive weapons cannot share the Engine position.`);
        }
        if (placedPositions.has(pos)) {
          throw new Error(`Position ${pos} has multiple weapons assigned.`);
        }
        placedPositions.add(pos);
      }
    }

    const tx = db.transaction(() => {
      // 1. Update engine position
      db.prepare(`
        UPDATE lobby_ship_setups
        SET engine_position = ?
        WHERE lobby_id = ? AND player_id = ?
      `).run(targetEnginePos, lobbyId, playerId);

      // 2. Clear previous weapons
      db.prepare('DELETE FROM lobby_weapon_positions WHERE lobby_id = ? AND player_id = ?').run(lobbyId, playerId);

      // 3. Insert new weapons
      if (Array.isArray(weapons)) {
        const insertWeapon = db.prepare(`
          INSERT INTO lobby_weapon_positions (id, lobby_id, player_id, position, weapon_definition_id, current_hp, max_hp, alias, is_destroyed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `);
        for (const w of weapons) {
          const wDef = db.prepare('SELECT * FROM weapon_definitions WHERE id = ?').get(w.weaponDefinitionId);
          if (wDef) {
            insertWeapon.run(
              uuidv4(),
              lobbyId,
              playerId,
              parseInt(w.position, 10),
              wDef.id,
              wDef.max_hp,
              wDef.max_hp,
              (w.alias || '').trim()
            );
          }
        }
      }

      // 4. Update shield
      db.prepare('DELETE FROM lobby_shields WHERE lobby_id = ? AND player_id = ?').run(lobbyId, playerId);
      if (shield && shield.shieldDefinitionId) {
        const shieldDef = db.prepare('SELECT * FROM shield_definitions WHERE id = ?').get(shield.shieldDefinitionId);
        if (shieldDef) {
          const protType = shield.protectedType === 'ENGINE' ? 'ENGINE' : 'WEAPON';
          const protPos = protType === 'ENGINE' ? targetEnginePos : (parseInt(shield.protectedPosition, 10) || 1);
          db.prepare(`
            INSERT INTO lobby_shields (id, lobby_id, player_id, protected_type, protected_position, current_hp, max_hp, shield_definition_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), lobbyId, playerId, protType, protPos, shieldDef.max_hp, shieldDef.max_hp, shieldDef.id);
        }
      }

      // 5. Update repairs
      db.prepare('DELETE FROM lobby_repairs WHERE lobby_id = ? AND player_id = ?').run(lobbyId, playerId);
      const repairDefId = (repairs && repairs.repairDefinitionId) || 'repair-kit';
      const repairQty = (repairs && repairs.quantity !== undefined) ? Math.max(0, parseInt(repairs.quantity, 10) || 0) : 0;
      db.prepare(`
        INSERT INTO lobby_repairs (id, lobby_id, player_id, repair_definition_id, quantity, remaining_quantity)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), lobbyId, playerId, repairDefId, repairQty, repairQty);
    });

    tx();
  },

  // Toggle ready state
  toggleReady(lobbyId, playerId) {
    const player = db.prepare('SELECT * FROM lobby_players WHERE id = ? AND lobby_id = ?').get(playerId, lobbyId);
    if (!player) throw new Error('Player not found.');

    const newReady = player.ready ? 0 : 1;

    // Validate that at least 1 weapon is equipped before readying
    if (newReady === 1) {
      const wepCount = db.prepare('SELECT COUNT(*) as c FROM lobby_weapon_positions WHERE lobby_id = ? AND player_id = ?').get(lobbyId, playerId);
      if (!wepCount || wepCount.c === 0) {
        throw new Error('You must equip at least one weapon on your ship before locking in Ready!');
      }
    }

    const tx = db.transaction(() => {
      db.prepare('UPDATE lobby_players SET ready = ? WHERE id = ?').run(newReady, playerId);

      // Check if both players are ready
      const allPlayers = db.prepare('SELECT * FROM lobby_players WHERE lobby_id = ?').all(lobbyId);
      const p1 = allPlayers.find(p => p.role === 'ATTACKER');
      const p2 = allPlayers.find(p => p.role === 'DEFENDER');

      if (p1 && p2 && p1.ready === 1 && p2.ready === 1 && (p1.id === playerId ? newReady === 1 : p1.ready === 1) && (p2.id === playerId ? newReady === 1 : p2.ready === 1)) {
        // Start battle!
        const now = new Date().toISOString();
        db.prepare(`
          UPDATE lobbies
          SET status = 'ACTIVE', current_round = 1, current_turn_player_id = ?, started_at = ?
          WHERE id = ?
        `).run(p1.id, now, lobbyId);

        // Record battle action
        db.prepare(`
          INSERT INTO battle_actions (id, lobby_id, round, player_id, action_type, result_summary, created_at)
          VALUES (?, ?, 1, ?, 'ADMIN_COMMAND', 'Battle started! Player 1 (Attacker) opens Round 1.', ?)
        `).run(uuidv4(), lobbyId, p1.id, now);
      } else {
        // Update status to SETUP if it was READY or vice-versa
        const anyReady = (p1 && p1.ready) || (p2 && p2.ready);
        const currentLobby = db.prepare('SELECT status FROM lobbies WHERE id = ?').get(lobbyId);
        if (currentLobby.status !== 'ACTIVE' && currentLobby.status !== 'COMPLETED' && currentLobby.status !== 'SURRENDERED') {
          db.prepare('UPDATE lobbies SET status = ? WHERE id = ?').run(anyReady ? 'READY' : 'SETUP', lobbyId);
        }
      }
    });

    tx();
  }
};

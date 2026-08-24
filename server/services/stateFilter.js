import db from '../db/database.js';

export const StateFilter = {
  // Build role-tailored filtered game state
  getFilteredState(publicCode, token = null) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE public_code = ?').get(publicCode);
    if (!lobby) return null;

    const players = db.prepare('SELECT * FROM lobby_players WHERE lobby_id = ?').all(lobby.id);
    const p1 = players.find(p => p.role === 'ATTACKER') || null;
    const p2 = players.find(p => p.role === 'DEFENDER') || null;

    // Check if token matches Admin
    let isAdmin = false;
    if (token) {
      const adminRecord = db.prepare('SELECT * FROM lobby_admin_access WHERE lobby_id = ? AND admin_token = ?').get(lobby.id, token);
      if (adminRecord) isAdmin = true;
    }

    // Check if token matches Player 1 or Player 2
    const currentPlayer = token ? players.find(p => p.player_token === token) : null;
    const role = isAdmin ? 'ADMIN' : (currentPlayer ? currentPlayer.role : 'SPECTATOR');

    // Helper: fetch full private setup for a player
    const getFullSetup = (player) => {
      if (!player) return null;

      const setup = db.prepare(`
        SELECT ls.*, sd.name as ship_name, sd.capacity, sd.engine_hp as def_engine_hp, sd.weapon_slots, sd.is_combat, sd.description, sd.icon
        FROM lobby_ship_setups ls
        JOIN ship_definitions sd ON ls.ship_definition_id = sd.id
        WHERE ls.lobby_id = ? AND ls.player_id = ?
      `).get(lobby.id, player.id);

      const weapons = db.prepare(`
        SELECT wp.*, wd.name as weapon_name, wd.base_damage, wd.icon, wd.description
        FROM lobby_weapon_positions wp
        JOIN weapon_definitions wd ON wp.weapon_definition_id = wd.id
        WHERE wp.lobby_id = ? AND wp.player_id = ?
        ORDER BY wp.position ASC
      `).all(lobby.id, player.id);

      const shield = db.prepare(`
        SELECT ls.*, sd.name as shield_name, sd.description
        FROM lobby_shields ls
        JOIN shield_definitions sd ON ls.shield_definition_id = sd.id
        WHERE ls.lobby_id = ? AND ls.player_id = ?
      `).get(lobby.id, player.id);

      const repairs = db.prepare(`
        SELECT lr.*, rd.name as repair_name, rd.repair_amount, rd.description
        FROM lobby_repairs lr
        JOIN repair_definitions rd ON lr.repair_definition_id = rd.id
        WHERE lr.lobby_id = ? AND lr.player_id = ?
      `).all(lobby.id, player.id);

      return {
        ship: setup,
        enginePosition: setup ? setup.engine_position : 1,
        engineCurrentHp: setup ? setup.engine_current_hp : 200,
        engineMaxHp: setup ? setup.engine_max_hp : 200,
        weapons,
        shield: shield || null,
        repairs
      };
    };

    // Helper: fetch masked enemy setup based on what observer has discovered
    const getMaskedEnemySetup = (enemyPlayer, observerPlayerId) => {
      if (!enemyPlayer) return null;

      const enemySetup = db.prepare(`
        SELECT ls.ship_definition_id, sd.name as ship_name, sd.capacity, sd.weapon_slots, sd.icon
        FROM lobby_ship_setups ls
        JOIN ship_definitions sd ON ls.ship_definition_id = sd.id
        WHERE ls.lobby_id = ? AND ls.player_id = ?
      `).get(lobby.id, enemyPlayer.id);

      if (!enemySetup) return null;

      // Fetch discoveries made by observer against this enemy
      const discoveries = db.prepare(`
        SELECT target_position, status, revealed_name, revealed_type
        FROM player_discoveries
        WHERE lobby_id = ? AND observer_player_id = ?
      `).all(lobby.id, observerPlayerId);

      const discoveryMap = {};
      for (const d of discoveries) {
        discoveryMap[d.target_position] = d;
      }

      // Generate radar grid of positions
      const radarPositions = [];
      for (let i = 1; i <= enemySetup.weapon_slots; i++) {
        if (discoveryMap[i]) {
          radarPositions.push({
            position: i,
            status: discoveryMap[i].status, // 'EMPTY', 'SHIELD_HIT', 'WEAPON_HIT', 'WEAPON_DESTROYED', 'ENGINE_HIT', 'ENGINE_DESTROYED'
            revealedName: discoveryMap[i].revealed_name || null,
            revealedType: discoveryMap[i].revealed_type || null
          });
        } else {
          radarPositions.push({
            position: i,
            status: 'UNKNOWN',
            revealedName: null,
            revealedType: null
          });
        }
      }

      return {
        ship: {
          name: enemySetup.ship_name,
          capacity: enemySetup.capacity,
          weaponSlots: enemySetup.weapon_slots,
          icon: enemySetup.icon
        },
        radarPositions
      };
    };

    // Combat log (Recent actions)
    const combatActions = db.prepare(`
      SELECT ba.*, lp.captain_name, lp.crew_name, lp.role as player_role
      FROM battle_actions ba
      LEFT JOIN lobby_players lp ON ba.player_id = lp.id
      WHERE ba.lobby_id = ?
      ORDER BY ba.created_at ASC
    `).all(lobby.id);

    // Build payload according to role
    let yourSide = null;
    let enemySide = null;
    let adminView = null;

    if (role === 'ATTACKER') {
      yourSide = {
        player: { id: p1.id, role: p1.role, captainName: p1.captain_name, crewName: p1.crew_name, ready: p1.ready },
        setup: getFullSetup(p1)
      };
      enemySide = {
        player: p2 ? { role: p2.role, captainName: p2.captain_name, crewName: p2.crew_name, ready: p2.ready } : null,
        setup: p2 ? getMaskedEnemySetup(p2, p1.id) : null
      };
    } else if (role === 'DEFENDER') {
      yourSide = {
        player: { id: p2.id, role: p2.role, captainName: p2.captain_name, crewName: p2.crew_name, ready: p2.ready },
        setup: getFullSetup(p2)
      };
      enemySide = {
        player: p1 ? { role: p1.role, captainName: p1.captain_name, crewName: p1.crew_name, ready: p1.ready } : null,
        setup: p1 ? getMaskedEnemySetup(p1, p2.id) : null
      };
    }

    if (role === 'ADMIN') {
      adminView = {
        attacker: {
          player: p1 ? { id: p1.id, role: p1.role, captainName: p1.captain_name, crewName: p1.crew_name, ready: p1.ready } : null,
          setup: getFullSetup(p1)
        },
        defender: {
          player: p2 ? { id: p2.id, role: p2.role, captainName: p2.captain_name, crewName: p2.crew_name, ready: p2.ready } : null,
          setup: getFullSetup(p2)
        }
      };
    }

    // Determine current turn name
    let turnCaptainName = '';
    if (lobby.current_turn_player_id) {
      const turnPlayer = players.find(p => p.id === lobby.current_turn_player_id);
      if (turnPlayer) turnCaptainName = turnPlayer.captain_name;
    }

    return {
      lobby: {
        id: lobby.id,
        publicCode: lobby.public_code,
        status: lobby.status,
        round: lobby.current_round,
        currentTurnPlayerId: lobby.current_turn_player_id,
        currentTurnCaptain: turnCaptainName,
        isYourTurn: currentPlayer ? (lobby.current_turn_player_id === currentPlayer.id) : false,
        winnerPlayerId: lobby.winner_player_id,
        loserPlayerId: lobby.loser_player_id,
        endReason: lobby.end_reason,
        createdAt: lobby.created_at,
        startedAt: lobby.started_at,
        endedAt: lobby.ended_at
      },
      viewer: {
        role,
        isAdmin,
        isPlayer: !!currentPlayer
      },
      players: {
        attacker: p1 ? { role: 'ATTACKER', captainName: p1.captain_name, crewName: p1.crew_name, ready: p1.ready } : null,
        defender: p2 ? { role: 'DEFENDER', captainName: p2.captain_name, crewName: p2.crew_name, ready: p2.ready } : null
      },
      yourSide,
      enemySide,
      adminView,
      combatLog: combatActions
    };
  }
};

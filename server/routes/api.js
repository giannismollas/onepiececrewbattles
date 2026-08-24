import express from 'express';
import db from '../db/database.js';
import { LobbyService } from '../services/lobbyService.js';
import { CombatEngine } from '../services/combatEngine.js';
import { StateFilter } from '../services/stateFilter.js';
import { broadcastLobbyUpdate } from '../socket.js';

const router = express.Router();

// 1. Get all definitions (ships, weapons, shields, repairs)
router.get('/definitions', (req, res) => {
  try {
    const ships = db.prepare('SELECT * FROM ship_definitions WHERE enabled = 1 ORDER BY is_combat DESC, capacity ASC').all();
    const weapons = db.prepare('SELECT * FROM weapon_definitions WHERE enabled = 1 ORDER BY base_damage ASC').all();
    const shields = db.prepare('SELECT * FROM shield_definitions WHERE enabled = 1 ORDER BY max_hp ASC').all();
    const repairs = db.prepare('SELECT * FROM repair_definitions WHERE enabled = 1 ORDER BY repair_amount ASC').all();

    res.json({ ships, weapons, shields, repairs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create lobby
router.post('/lobby/create', (req, res) => {
  try {
    const { captainName, crewName } = req.body;
    const result = LobbyService.createLobby(captainName, crewName);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Join lobby as Defender
router.post('/lobby/join', (req, res) => {
  try {
    const { publicCode, captainName, crewName } = req.body;
    if (!publicCode) {
      return res.status(400).json({ error: 'Public lobby code is required.' });
    }
    const result = LobbyService.joinLobby(publicCode.toUpperCase().trim(), captainName, crewName);
    broadcastLobbyUpdate(result.publicCode);
    res.json(result);
  } catch (err) {
    if (err.message === 'LOBBY_FULL') {
      return res.status(403).json({ error: 'LOBBY_FULL', message: 'This battle lobby is already full (2 players engaged).' });
    }
    res.status(400).json({ error: err.message });
  }
});

// 4. Get filtered lobby state
router.get('/lobby/:publicCode', (req, res) => {
  try {
    const { publicCode } = req.params;
    const token = req.query.token || null;
    const state = StateFilter.getFilteredState(publicCode.toUpperCase().trim(), token);
    if (!state) {
      return res.status(404).json({ error: 'Lobby not found.' });
    }
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Select ship
router.post('/lobby/:publicCode/ship', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token, shipDefinitionId } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'PLAYER') {
      return res.status(401).json({ error: 'Invalid or missing player authorization.' });
    }

    LobbyService.selectShip(auth.lobby.id, auth.player.id, shipDefinitionId);
    broadcastLobbyUpdate(publicCode.toUpperCase().trim());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Save ship setup (weapons, engine, shield, repairs)
router.post('/lobby/:publicCode/setup', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token, enginePosition, weapons, shield, repairs } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'PLAYER') {
      return res.status(401).json({ error: 'Invalid player authorization.' });
    }

    LobbyService.saveSetup(auth.lobby.id, auth.player.id, { enginePosition, weapons, shield, repairs });
    broadcastLobbyUpdate(publicCode.toUpperCase().trim());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Toggle Ready status
router.post('/lobby/:publicCode/ready', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'PLAYER') {
      return res.status(401).json({ error: 'Invalid player authorization.' });
    }

    LobbyService.toggleReady(auth.lobby.id, auth.player.id);
    broadcastLobbyUpdate(publicCode.toUpperCase().trim());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Attack action
router.post('/lobby/:publicCode/attack', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token, weaponPosition, targetPosition } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'PLAYER') {
      return res.status(401).json({ error: 'Invalid player authorization.' });
    }

    const result = CombatEngine.executeAttack(auth.lobby.id, auth.player.id, { weaponPosition, targetPosition });
    broadcastLobbyUpdate(publicCode.toUpperCase().trim(), {
      type: 'ATTACK_RESOLVED',
      data: result
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Repair action
router.post('/lobby/:publicCode/repair', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token, targetType, targetPosition, repairDefinitionId } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'PLAYER') {
      return res.status(401).json({ error: 'Invalid player authorization.' });
    }

    const result = CombatEngine.executeRepair(auth.lobby.id, auth.player.id, { targetType, targetPosition, repairDefinitionId });
    broadcastLobbyUpdate(publicCode.toUpperCase().trim(), {
      type: 'REPAIR_RESOLVED',
      data: result
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Surrender action
router.post('/lobby/:publicCode/surrender', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'PLAYER') {
      return res.status(401).json({ error: 'Invalid player authorization.' });
    }

    const result = CombatEngine.executeSurrender(auth.lobby.id, auth.player.id);
    broadcastLobbyUpdate(publicCode.toUpperCase().trim(), {
      type: 'BATTLE_SURRENDERED',
      data: result
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Admin Command
router.post('/lobby/:publicCode/admin', (req, res) => {
  try {
    const { publicCode } = req.params;
    const { token, command, params } = req.body;
    const auth = LobbyService.authenticateToken(publicCode.toUpperCase().trim(), token);
    if (!auth || auth.type !== 'ADMIN') {
      return res.status(401).json({ error: 'Unauthorized. Valid admin token required.' });
    }

    const result = CombatEngine.executeAdminCommand(auth.lobby.id, command, params || {});
    broadcastLobbyUpdate(publicCode.toUpperCase().trim(), {
      type: 'ADMIN_COMMAND',
      data: result
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Battle History List
router.get('/history', (req, res) => {
  try {
    const { search, endReason, sort = 'newest', limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM battle_history WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (public_code LIKE ? OR winner_captain LIKE ? OR winner_crew LIKE ? OR loser_captain LIKE ? OR loser_crew LIKE ? OR winner_ship LIKE ? OR loser_ship LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    if (endReason && endReason !== 'ALL') {
      query += ' AND end_reason = ?';
      params.push(endReason);
    }

    if (sort === 'oldest') {
      query += ' ORDER BY created_at ASC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const history = db.prepare(query).all(...params);
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM battle_history').get().count;

    res.json({ history, totalCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Single Battle History & Replay Log
router.get('/history/:publicCode', (req, res) => {
  try {
    const { publicCode } = req.params;
    const record = db.prepare('SELECT * FROM battle_history WHERE public_code = ?').get(publicCode.toUpperCase().trim());
    if (!record) {
      return res.status(404).json({ error: 'Battle record not found.' });
    }

    const actions = db.prepare(`
      SELECT ba.*, lp.captain_name, lp.crew_name
      FROM battle_actions ba
      LEFT JOIN lobby_players lp ON ba.player_id = lp.id
      WHERE ba.lobby_id = ?
      ORDER BY ba.created_at ASC
    `).all(record.lobby_id);

    res.json({ record, actions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

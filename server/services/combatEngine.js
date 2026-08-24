import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';

const DICE_MULTIPLIERS = {
  1: 0.50,
  2: 0.75,
  3: 0.90,
  4: 1.00,
  5: 1.25,
  6: 1.50
};

export const CombatEngine = {
  // Execute an attack action
  executeAttack(lobbyId, playerId, { weaponPosition, targetPosition }) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    if (!lobby) throw new Error('Lobby not found.');
    if (lobby.status !== 'ACTIVE') throw new Error(`Battle is not active (Status: ${lobby.status}).`);
    if (lobby.current_turn_player_id !== playerId) throw new Error("It is not your turn!");

    const attacker = db.prepare('SELECT * FROM lobby_players WHERE id = ?').get(playerId);
    const defender = db.prepare('SELECT * FROM lobby_players WHERE lobby_id = ? AND id != ?').get(lobbyId, playerId);
    if (!defender) throw new Error('Defender not found.');

    const wPos = parseInt(weaponPosition, 10);
    const tPos = parseInt(targetPosition, 10);

    // Validate attacker weapon
    const weapon = db.prepare(`
      SELECT wp.*, wd.name as weapon_name, wd.base_damage, wd.icon
      FROM lobby_weapon_positions wp
      JOIN weapon_definitions wd ON wp.weapon_definition_id = wd.id
      WHERE wp.lobby_id = ? AND wp.player_id = ? AND wp.position = ?
    `).get(lobbyId, playerId, wPos);

    if (!weapon) throw new Error(`No weapon found at position ${wPos}.`);
    if (weapon.current_hp <= 0 || weapon.is_destroyed) throw new Error(`Weapon ${weapon.weapon_name} at position ${wPos} is destroyed and cannot fire.`);

    // Validate defender ship bounds
    const defSetup = db.prepare(`
      SELECT ls.*, sd.weapon_slots, sd.name as ship_name
      FROM lobby_ship_setups ls
      JOIN ship_definitions sd ON ls.ship_definition_id = sd.id
      WHERE ls.lobby_id = ? AND ls.player_id = ?
    `).get(lobbyId, defender.id);

    if (tPos < 1 || tPos > defSetup.weapon_slots) {
      throw new Error(`Target position ${tPos} is out of bounds for enemy ship (1-${defSetup.weapon_slots}).`);
    }

    // Roll 1d6 server-side
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const damageMultiplier = DICE_MULTIPLIERS[diceRoll];
    const finalDamage = Math.round(weapon.base_damage * damageMultiplier);

    let resultSummary = '';
    let details = {
      attackerCaptain: attacker.captain_name,
      attackerCrew: attacker.crew_name,
      weaponName: weapon.weapon_name,
      weaponPosition: wPos,
      targetPosition: tPos,
      diceRoll,
      damageMultiplier,
      baseDamage: weapon.base_damage,
      finalDamage,
      shieldHit: false,
      shieldDamage: 0,
      shieldDestroyed: false,
      targetType: 'EMPTY',
      targetDamage: 0,
      targetDestroyed: false,
      isGameOver: false,
      winner: null
    };

    const actionTx = db.transaction(() => {
      let remainingDamage = finalDamage;

      // 1. Check if defender has shield protecting this target position
      // A shield can protect a WEAPON at targetPosition or the ENGINE if targetPosition == engine_position
      const isEngineAtPos = (defSetup.engine_position === tPos);
      const shield = db.prepare(`
        SELECT * FROM lobby_shields
        WHERE lobby_id = ? AND player_id = ?
        AND (
          (protected_type = 'WEAPON' AND protected_position = ?)
          OR
          (protected_type = 'ENGINE' AND protected_position = ?)
        )
      `).get(lobbyId, defender.id, tPos, tPos);

      if (shield && shield.current_hp > 0) {
        const shieldAbsorb = Math.min(shield.current_hp, remainingDamage);
        const newShieldHp = shield.current_hp - shieldAbsorb;
        remainingDamage -= shieldAbsorb;

        db.prepare('UPDATE lobby_shields SET current_hp = ? WHERE id = ?').run(newShieldHp, shield.id);

        details.shieldHit = true;
        details.shieldDamage = shieldAbsorb;
        details.shieldDestroyed = (newShieldHp === 0);

        // Record discovery for attacker (without revealing what is underneath!)
        db.prepare(`
          INSERT INTO player_discoveries (id, lobby_id, observer_player_id, target_position, status, revealed_type, last_updated)
          VALUES (?, ?, ?, ?, 'SHIELD_HIT', 'SHIELD', ?)
          ON CONFLICT(id) DO UPDATE SET status = 'SHIELD_HIT', last_updated = ?
        `).run(uuidv4(), lobbyId, playerId, tPos, new Date().toISOString(), new Date().toISOString());
      }

      // 2. Apply remaining damage to underlying object
      if (remainingDamage > 0) {
        if (isEngineAtPos) {
          // Engine Hit
          const newEngineHp = Math.max(0, defSetup.engine_current_hp - remainingDamage);
          db.prepare('UPDATE lobby_ship_setups SET engine_current_hp = ? WHERE id = ?').run(newEngineHp, defSetup.id);

          details.targetType = 'ENGINE';
          details.targetDamage = remainingDamage;
          details.targetDestroyed = (newEngineHp === 0);
          details.engineHpRemaining = newEngineHp;

          if (newEngineHp === 0) {
            details.isGameOver = true;
            details.winner = attacker;
            details.loser = defender;
            details.endReason = 'ENGINE_DESTROYED';

            // Reveal engine destroyed
            db.prepare(`
              INSERT INTO player_discoveries (id, lobby_id, observer_player_id, target_position, status, revealed_name, revealed_type, last_updated)
              VALUES (?, ?, ?, ?, 'ENGINE_DESTROYED', 'Engine Core', 'ENGINE', ?)
            `).run(uuidv4(), lobbyId, playerId, tPos, new Date().toISOString());
          } else {
            // Secret hit: do NOT reveal it is the engine to the attacker!
            db.prepare(`
              INSERT INTO player_discoveries (id, lobby_id, observer_player_id, target_position, status, revealed_type, last_updated)
              VALUES (?, ?, ?, ?, 'HIT', 'TARGET', ?)
            `).run(uuidv4(), lobbyId, playerId, tPos, new Date().toISOString());
          }
        } else {
          // Check if there is a weapon at targetPosition
          const defWeapon = db.prepare(`
            SELECT wp.*, wd.name as weapon_name
            FROM lobby_weapon_positions wp
            JOIN weapon_definitions wd ON wp.weapon_definition_id = wd.id
            WHERE wp.lobby_id = ? AND wp.player_id = ? AND wp.position = ?
          `).get(lobbyId, defender.id, tPos);

          if (defWeapon && defWeapon.current_hp > 0) {
            // Weapon Hit
            const newWepHp = Math.max(0, defWeapon.current_hp - remainingDamage);
            const isWepDestroyed = (newWepHp === 0 ? 1 : 0);
            db.prepare('UPDATE lobby_weapon_positions SET current_hp = ?, is_destroyed = ? WHERE id = ?').run(newWepHp, isWepDestroyed, defWeapon.id);

            details.targetType = 'WEAPON';
            details.targetName = defWeapon.weapon_name;
            details.targetDamage = remainingDamage;
            details.targetDestroyed = (isWepDestroyed === 1);
            details.weaponHpRemaining = newWepHp;

            // Discovery: Record HIT (without revealing exact weapon type to keep secret)
            db.prepare(`
              INSERT INTO player_discoveries (id, lobby_id, observer_player_id, target_position, status, revealed_type, last_updated)
              VALUES (?, ?, ?, ?, 'HIT', 'TARGET', ?)
            `).run(uuidv4(), lobbyId, playerId, tPos, new Date().toISOString());
          } else {
            // Empty position or already destroyed
            details.targetType = 'EMPTY';
            // Record discovery
            db.prepare(`
              INSERT INTO player_discoveries (id, lobby_id, observer_player_id, target_position, status, revealed_type, last_updated)
              VALUES (?, ?, ?, ?, 'EMPTY', 'EMPTY', ?)
            `).run(uuidv4(), lobbyId, playerId, tPos, new Date().toISOString());
          }
        }
      } else if (!details.shieldHit) {
        // Pure empty miss -> 0 damage
        details.targetType = 'EMPTY';
        db.prepare(`
          INSERT INTO player_discoveries (id, lobby_id, observer_player_id, target_position, status, revealed_type, last_updated)
          VALUES (?, ?, ?, ?, 'EMPTY', 'EMPTY', ?)
        `).run(uuidv4(), lobbyId, playerId, tPos, new Date().toISOString());
      }

      // If pure miss, actual damage dealt is 0
      const actualDmgDealt = (details.targetType === 'EMPTY' && !details.shieldHit) ? 0 : finalDamage;
      details.finalDamage = actualDmgDealt;

      // 3. Build Result Summary (Secretive & Clear)
      let summaryParts = [];

      if (details.targetType === 'EMPTY' && !details.shieldHit) {
        summaryParts.push(`${attacker.captain_name} (${attacker.crew_name}) fired [Pos ${wPos}] at enemy Pos ${tPos}. 🎲 Roll: ${diceRoll} (${damageMultiplier * 100}%) -> 0 DMG. 🌊 MISS! Position ${tPos} is empty.`);
      } else {
        summaryParts.push(`${attacker.captain_name} (${attacker.crew_name}) fired [Pos ${wPos}] at enemy Pos ${tPos}. 🎲 Roll: ${diceRoll} (${damageMultiplier * 100}%) -> ${actualDmgDealt} DMG.`);

        if (details.shieldHit) {
          summaryParts.push(`🛡️ SHIELD HIT! Shield absorbed ${details.shieldDamage} DMG.${details.shieldDestroyed ? ' Shield shattered!' : ''}`);
        }

        if (details.targetDestroyed && details.targetType === 'ENGINE') {
          summaryParts.push(`🏆 ENGINE DESTROYED! Position ${tPos} was the Engine Core! ${attacker.captain_name} wins the battle!`);
        } else if (remainingDamage > 0) {
          summaryParts.push(`🎯 DIRECT HIT on Position ${tPos}! Dealt ${remainingDamage} Damage.`);
        }
      }

      resultSummary = summaryParts.join(' ');

      // 4. Record action log
      const actionId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO battle_actions (id, lobby_id, round, player_id, action_type, weapon_position, target_position, dice_roll, base_damage, damage_multiplier, final_damage, result_summary, details_json, created_at)
        VALUES (?, ?, ?, ?, 'ATTACK', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        actionId,
        lobbyId,
        lobby.current_round,
        playerId,
        wPos,
        tPos,
        diceRoll,
        weapon.base_damage,
        damageMultiplier,
        actualDmgDealt,
        resultSummary,
        JSON.stringify(details),
        now
      );

      // 5. Check game over or switch turn
      if (details.isGameOver) {
        // Battle finished
        db.prepare(`
          UPDATE lobbies
          SET status = 'COMPLETED', winner_player_id = ?, loser_player_id = ?, end_reason = ?, ended_at = ?
          WHERE id = ?
        `).run(attacker.id, defender.id, 'ENGINE_DESTROYED', now, lobbyId);

        // Record history
        const p1Setup = db.prepare('SELECT sd.name FROM lobby_ship_setups ls JOIN ship_definitions sd ON ls.ship_definition_id = sd.id WHERE ls.lobby_id = ? AND ls.player_id = ?').get(lobbyId, attacker.id);
        const p2Setup = db.prepare('SELECT sd.name FROM lobby_ship_setups ls JOIN ship_definitions sd ON ls.ship_definition_id = sd.id WHERE ls.lobby_id = ? AND ls.player_id = ?').get(lobbyId, defender.id);

        db.prepare(`
          INSERT INTO battle_history (id, lobby_id, public_code, winner_captain, winner_crew, winner_ship, loser_captain, loser_crew, loser_ship, end_reason, rounds, summary_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENGINE_DESTROYED', ?, ?, ?)
        `).run(
          uuidv4(),
          lobbyId,
          lobby.public_code,
          attacker.captain_name,
          attacker.crew_name,
          p1Setup ? p1Setup.name : 'Ship',
          defender.captain_name,
          defender.crew_name,
          p2Setup ? p2Setup.name : 'Ship',
          lobby.current_round,
          JSON.stringify({ endReason: 'ENGINE_DESTROYED', finalRound: lobby.current_round }),
          now
        );
      } else {
        // Switch turn
        const nextRound = (defender.role === 'ATTACKER') ? (lobby.current_round + 1) : lobby.current_round;
        db.prepare(`
          UPDATE lobbies
          SET current_turn_player_id = ?, current_round = ?
          WHERE id = ?
        `).run(defender.id, nextRound, lobbyId);
      }
    });

    actionTx();

    return {
      success: true,
      diceRoll,
      damageMultiplier,
      finalDamage,
      resultSummary,
      details
    };
  },

  // Execute a repair action (consumes entire turn)
  executeRepair(lobbyId, playerId, { targetType, targetPosition, repairDefinitionId }) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    if (!lobby || lobby.status !== 'ACTIVE') throw new Error('Battle is not active.');
    if (lobby.current_turn_player_id !== playerId) throw new Error("It is not your turn!");

    const player = db.prepare('SELECT * FROM lobby_players WHERE id = ?').get(playerId);
    const defender = db.prepare('SELECT * FROM lobby_players WHERE lobby_id = ? AND id != ?').get(lobbyId, playerId);

    const repDefId = repairDefinitionId || 'repair-kit';
    const repDef = db.prepare('SELECT * FROM repair_definitions WHERE id = ?').get(repDefId);
    if (!repDef) throw new Error('Repair definition not found.');

    const repairItem = db.prepare('SELECT * FROM lobby_repairs WHERE lobby_id = ? AND player_id = ? AND repair_definition_id = ?').get(lobbyId, playerId, repDef.id);
    if (!repairItem || repairItem.remaining_quantity <= 0) {
      throw new Error(`No ${repDef.name} remaining.`);
    }

    const tPos = parseInt(targetPosition, 10);
    const isEngine = (targetType === 'ENGINE');

    let repairedName = '';
    let oldHp = 0;
    let newHp = 0;
    let maxHp = 0;

    const tx = db.transaction(() => {
      if (isEngine) {
        const setup = db.prepare('SELECT * FROM lobby_ship_setups WHERE lobby_id = ? AND player_id = ?').get(lobbyId, playerId);
        if (setup.engine_current_hp <= 0) {
          throw new Error('Destroyed Engine cannot be repaired!');
        }
        if (setup.engine_current_hp >= setup.engine_max_hp) {
          throw new Error('Engine is already at full health.');
        }
        oldHp = setup.engine_current_hp;
        newHp = Math.min(setup.engine_max_hp, oldHp + repDef.repair_amount);
        maxHp = setup.engine_max_hp;
        repairedName = 'Engine';

        db.prepare('UPDATE lobby_ship_setups SET engine_current_hp = ? WHERE id = ?').run(newHp, setup.id);
      } else {
        const weapon = db.prepare(`
          SELECT wp.*, wd.name as weapon_name
          FROM lobby_weapon_positions wp
          JOIN weapon_definitions wd ON wp.weapon_definition_id = wd.id
          WHERE wp.lobby_id = ? AND wp.player_id = ? AND wp.position = ?
        `).get(lobbyId, playerId, tPos);

        if (!weapon) throw new Error(`No weapon found at position ${tPos}.`);
        if (weapon.current_hp <= 0 || weapon.is_destroyed) {
          throw new Error(`Destroyed weapon at position ${tPos} cannot be repaired! No revive allowed.`);
        }
        if (weapon.current_hp >= weapon.max_hp) {
          throw new Error(`Weapon ${weapon.weapon_name} is already at full health.`);
        }

        oldHp = weapon.current_hp;
        newHp = Math.min(weapon.max_hp, oldHp + repDef.repair_amount);
        maxHp = weapon.max_hp;
        repairedName = `${weapon.weapon_name} (Pos ${tPos})`;

        db.prepare('UPDATE lobby_weapon_positions SET current_hp = ? WHERE id = ?').run(newHp, weapon.id);
      }

      // Deduct repair quantity
      db.prepare('UPDATE lobby_repairs SET remaining_quantity = remaining_quantity - 1 WHERE id = ?').run(repairItem.id);

      const healAmount = newHp - oldHp;
      const resultSummary = `🛠️ REPAIR! ${player.captain_name} used ${repDef.name} on ${repairedName}: +${healAmount} HP (${newHp}/${maxHp} HP). Turn consumed.`;

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO battle_actions (id, lobby_id, round, player_id, action_type, target_position, result_summary, details_json, created_at)
        VALUES (?, ?, ?, ?, 'REPAIR', ?, ?, ?, ?)
      `).run(
        uuidv4(),
        lobbyId,
        lobby.current_round,
        playerId,
        tPos,
        resultSummary,
        JSON.stringify({
          captain: player.captain_name,
          repairedName,
          healAmount,
          oldHp,
          newHp,
          maxHp
        }),
        now
      );

      // Switch turn
      const nextRound = (defender.role === 'ATTACKER') ? (lobby.current_round + 1) : lobby.current_round;
      db.prepare(`
        UPDATE lobbies
        SET current_turn_player_id = ?, current_round = ?
        WHERE id = ?
      `).run(defender.id, nextRound, lobbyId);
    });

    tx();

    return {
      success: true,
      repairedName,
      oldHp,
      newHp,
      maxHp
    };
  },

  // Surrender action
  executeSurrender(lobbyId, playerId) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    if (!lobby || lobby.status !== 'ACTIVE') throw new Error('Battle is not active.');

    const loser = db.prepare('SELECT * FROM lobby_players WHERE id = ?').get(playerId);
    const winner = db.prepare('SELECT * FROM lobby_players WHERE lobby_id = ? AND id != ?').get(lobbyId, playerId);
    if (!winner) throw new Error('Opponent not found.');

    const now = new Date().toISOString();
    const resultSummary = `🏳️ SURRENDER! ${loser.captain_name} (${loser.crew_name}) surrendered! Victory to ${winner.captain_name} (${winner.crew_name})!`;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE lobbies
        SET status = 'SURRENDERED', winner_player_id = ?, loser_player_id = ?, end_reason = 'SURRENDER', ended_at = ?
        WHERE id = ?
      `).run(winner.id, loser.id, now, lobbyId);

      db.prepare(`
        INSERT INTO battle_actions (id, lobby_id, round, player_id, action_type, result_summary, created_at)
        VALUES (?, ?, ?, ?, 'SURRENDER', ?, ?)
      `).run(uuidv4(), lobbyId, lobby.current_round, playerId, resultSummary, now);

      const p1Setup = db.prepare('SELECT sd.name FROM lobby_ship_setups ls JOIN ship_definitions sd ON ls.ship_definition_id = sd.id WHERE ls.lobby_id = ? AND ls.player_id = ?').get(lobbyId, winner.id);
      const p2Setup = db.prepare('SELECT sd.name FROM lobby_ship_setups ls JOIN ship_definitions sd ON ls.ship_definition_id = sd.id WHERE ls.lobby_id = ? AND ls.player_id = ?').get(lobbyId, loser.id);

      db.prepare(`
        INSERT INTO battle_history (id, lobby_id, public_code, winner_captain, winner_crew, winner_ship, loser_captain, loser_crew, loser_ship, end_reason, rounds, summary_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SURRENDER', ?, ?, ?)
      `).run(
        uuidv4(),
        lobbyId,
        lobby.public_code,
        winner.captain_name,
        winner.crew_name,
        p1Setup ? p1Setup.name : 'Ship',
        loser.captain_name,
        loser.crew_name,
        p2Setup ? p2Setup.name : 'Ship',
        lobby.current_round,
        JSON.stringify({ endReason: 'SURRENDER', finalRound: lobby.current_round }),
        now
      );
    });

    tx();

    return {
      success: true,
      resultSummary
    };
  },

  // Admin moderation commands
  executeAdminCommand(lobbyId, command, params) {
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    if (!lobby) throw new Error('Lobby not found.');

    const now = new Date().toISOString();
    let summary = `Admin executed command: ${command}`;

    const tx = db.transaction(() => {
      switch (command) {
        case 'PAUSE_BATTLE':
          db.prepare("UPDATE lobbies SET status = 'PAUSED' WHERE id = ?").run(lobbyId);
          summary = '⏸️ Battle paused by Administrator.';
          break;

        case 'RESUME_BATTLE':
          db.prepare("UPDATE lobbies SET status = 'ACTIVE' WHERE id = ?").run(lobbyId);
          summary = '▶️ Battle resumed by Administrator.';
          break;

        case 'CANCEL_BATTLE':
          db.prepare("UPDATE lobbies SET status = 'CANCELLED', ended_at = ? WHERE id = ?").run(now, lobbyId);
          summary = '❌ Battle cancelled by Administrator.';
          break;

        case 'FORCE_WIN_ATTACKER': {
          const p1 = db.prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND role = 'ATTACKER'").get(lobbyId);
          const p2 = db.prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND role = 'DEFENDER'").get(lobbyId);
          if (p1 && p2) {
            db.prepare("UPDATE lobbies SET status = 'COMPLETED', winner_player_id = ?, loser_player_id = ?, end_reason = 'ADMIN_DECISION', ended_at = ? WHERE id = ?")
              .run(p1.id, p2.id, now, lobbyId);
            summary = `⚖️ Administrator awarded match victory to Attacker (${p1.captain_name}).`;
          }
          break;
        }

        case 'FORCE_WIN_DEFENDER': {
          const p1 = db.prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND role = 'ATTACKER'").get(lobbyId);
          const p2 = db.prepare("SELECT * FROM lobby_players WHERE lobby_id = ? AND role = 'DEFENDER'").get(lobbyId);
          if (p1 && p2) {
            db.prepare("UPDATE lobbies SET status = 'COMPLETED', winner_player_id = ?, loser_player_id = ?, end_reason = 'ADMIN_DECISION', ended_at = ? WHERE id = ?")
              .run(p2.id, p1.id, now, lobbyId);
            summary = `⚖️ Administrator awarded match victory to Defender (${p2.captain_name}).`;
          }
          break;
        }

        case 'ADJUST_HP': {
          const { playerId, targetType, position, newHp } = params;
          const hpVal = Math.max(0, parseInt(newHp, 10) || 0);
          if (targetType === 'ENGINE') {
            db.prepare('UPDATE lobby_ship_setups SET engine_current_hp = ? WHERE lobby_id = ? AND player_id = ?').run(hpVal, lobbyId, playerId);
            summary = `🔧 Administrator set Engine HP to ${hpVal}.`;
          } else if (targetType === 'WEAPON') {
            const isDest = hpVal === 0 ? 1 : 0;
            db.prepare('UPDATE lobby_weapon_positions SET current_hp = ?, is_destroyed = ? WHERE lobby_id = ? AND player_id = ? AND position = ?')
              .run(hpVal, isDest, lobbyId, playerId, parseInt(position, 10));
            summary = `🔧 Administrator set Weapon Pos ${position} HP to ${hpVal}.`;
          }
          break;
        }

        case 'UNDO_LAST_ACTION': {
          const lastAction = db.prepare("SELECT * FROM battle_actions WHERE lobby_id = ? AND action_type = 'ATTACK' ORDER BY created_at DESC LIMIT 1").get(lobbyId);
          if (lastAction) {
            db.prepare('DELETE FROM battle_actions WHERE id = ?').run(lastAction.id);
            // Switch turn back
            db.prepare('UPDATE lobbies SET current_turn_player_id = ? WHERE id = ?').run(lastAction.player_id, lobbyId);
            summary = '↩️ Last attack action was undone by Administrator.';
          }
          break;
        }

        default:
          throw new Error(`Unknown admin command: ${command}`);
      }

      db.prepare(`
        INSERT INTO battle_actions (id, lobby_id, round, action_type, result_summary, created_at)
        VALUES (?, ?, ?, 'ADMIN_COMMAND', ?, ?)
      `).run(uuidv4(), lobbyId, lobby.current_round, summary, now);
    });

    tx();

    return {
      success: true,
      summary
    };
  }
};

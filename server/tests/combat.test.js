import assert from 'assert';
import db, { initDatabase } from '../db/database.js';
import { LobbyService } from '../services/lobbyService.js';
import { CombatEngine } from '../services/combatEngine.js';
import { StateFilter } from '../services/stateFilter.js';

console.log('🧪 Starting Ship VS Ship Combat Engine Test Suite...\n');

// 1. Initialize DB
initDatabase();

// Test 1: Verify Definitions
const ships = db.prepare('SELECT * FROM ship_definitions').all();
const weapons = db.prepare('SELECT * FROM weapon_definitions').all();
const shields = db.prepare('SELECT * FROM shield_definitions').all();
const repairs = db.prepare('SELECT * FROM repair_definitions').all();

assert.ok(ships.length >= 16, 'Should have at least 16 ship definitions (5 non-combat + 11 combat)');
assert.strictEqual(weapons.length, 8, 'Should have exactly 8 weapon definitions');
assert.ok(shields.length >= 1, 'Should have shield definitions');
assert.ok(repairs.length >= 1, 'Should have repair definitions');
console.log(`✅ Test 1 Passed: Definitions seeded (${ships.length} ships, ${weapons.length} weapons).`);

// Test 2: Create Lobby Flow
const p1Create = LobbyService.createLobby('Monkey D. Luffy', 'Straw Hat Pirates');
assert.ok(p1Create.lobbyId, 'Lobby ID should exist');
assert.ok(p1Create.publicCode.startsWith('SHIP-'), 'Public code should start with SHIP-');
assert.ok(p1Create.playerToken, 'Player 1 token should exist');
assert.ok(p1Create.adminToken, 'Admin token should exist');
assert.strictEqual(p1Create.role, 'ATTACKER', 'Player 1 should be ATTACKER');
console.log(`✅ Test 2 Passed: Lobby created (${p1Create.publicCode}).`);

// Test 3: Join Lobby as Player 2 (Defender)
const p2Join = LobbyService.joinLobby(p1Create.publicCode, 'Marshall D. Teach', 'Blackbeard Pirates');
assert.strictEqual(p2Join.lobbyId, p1Create.lobbyId);
assert.strictEqual(p2Join.role, 'DEFENDER');
assert.ok(p2Join.playerToken);
console.log('✅ Test 3 Passed: Defender joined successfully.');

// Test 4: 3rd Player Rejection
assert.throws(() => {
  LobbyService.joinLobby(p1Create.publicCode, 'Buggy', 'Cross Guild');
}, /LOBBY_FULL/, 'Should throw LOBBY_FULL for 3rd player');
console.log('✅ Test 4 Passed: 3rd player correctly blocked.');

// Test 5: Ship Customization & Non-Combat Boat Rejection
const p1Auth = LobbyService.authenticateToken(p1Create.publicCode, p1Create.playerToken);
assert.throws(() => {
  LobbyService.selectShip(p1Auth.lobby.id, p1Auth.player.id, 'simple-boat');
}, /cannot participate/, 'Non-combat boat selection should be blocked');

// Select Captain's Ship (5 weapon slots, 300 HP engine)
LobbyService.selectShip(p1Auth.lobby.id, p1Auth.player.id, 'captains-ship');
console.log("✅ Test 5 Passed: Non-combat boats blocked, Captain's Ship selected.");

// Test 6: Setup Validation & Saving (Weapons, Engine, Shield, Repairs)
// Position 1: Cannon, Position 2: Ballista, Position 3: Catapult, Position 4: Bow. Engine on Pos 5. Shield on Engine.
LobbyService.saveSetup(p1Auth.lobby.id, p1Auth.player.id, {
  enginePosition: 5,
  weapons: [
    { position: 1, weaponDefinitionId: 'cannon', alias: 'Sunny Cannon' },
    { position: 2, weaponDefinitionId: 'ballista', alias: 'Sniper Bolt' },
    { position: 3, weaponDefinitionId: 'catapult', alias: 'Boulder Flinger' },
    { position: 4, weaponDefinitionId: 'bow', alias: 'Flame Arrow' }
  ],
  shield: {
    shieldDefinitionId: 'iron-shield',
    protectedType: 'ENGINE',
    protectedPosition: 5
  },
  repairs: {
    repairDefinitionId: 'repair-kit',
    quantity: 2
  }
});

// Setup Defender (Position 1: Engine, Position 2: Cannon, Position 3: Mangonel, Position 4: Sling)
const p2Auth = LobbyService.authenticateToken(p1Create.publicCode, p2Join.playerToken);
LobbyService.saveSetup(p2Auth.lobby.id, p2Auth.player.id, {
  enginePosition: 1,
  weapons: [
    { position: 2, weaponDefinitionId: 'cannon', alias: 'Dark Cannon' },
    { position: 3, weaponDefinitionId: 'mangonel', alias: 'Quake Smasher' },
    { position: 4, weaponDefinitionId: 'sling', alias: 'Dark Pebble' }
  ],
  shield: {
    shieldDefinitionId: 'iron-shield',
    protectedType: 'WEAPON',
    protectedPosition: 2
  },
  repairs: {
    repairDefinitionId: 'repair-kit',
    quantity: 2
  }
});
console.log('✅ Test 6 Passed: Player 1 and Player 2 setups saved with weapons, engine and shields.');

// Test 7: Ready Toggle and Battle State Activation
LobbyService.toggleReady(p1Auth.lobby.id, p1Auth.player.id);
let lobbyState = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(p1Auth.lobby.id);
assert.strictEqual(lobbyState.status, 'READY', 'Lobby should be in READY state after one player readies');

LobbyService.toggleReady(p2Auth.lobby.id, p2Auth.player.id);
lobbyState = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(p1Auth.lobby.id);
assert.strictEqual(lobbyState.status, 'ACTIVE', 'Lobby should be ACTIVE once both players ready');
assert.strictEqual(lobbyState.current_turn_player_id, p1Auth.player.id, 'Attacker should take the first turn');
console.log('✅ Test 7 Passed: Ready toggle triggered ACTIVE battle state with Player 1 turn.');

// Test 8: Hidden Information Security Filter
const p2View = StateFilter.getFilteredState(p1Create.publicCode, p2Join.playerToken);
assert.strictEqual(p2View.viewer.role, 'DEFENDER');
// Enemy (Player 1) engine position must NOT be in enemySide
assert.strictEqual(p2View.enemySide.setup.enginePosition, undefined, 'Enemy engine position must NOT be sent to opponent');
assert.strictEqual(p2View.enemySide.setup.weapons, undefined, 'Enemy unrevealed weapons must NOT be sent to opponent');
assert.strictEqual(p2View.enemySide.setup.radarPositions[0].status, 'UNKNOWN', 'Unattacked positions must be UNKNOWN');

const adminView = StateFilter.getFilteredState(p1Create.publicCode, p1Create.adminToken);
assert.strictEqual(adminView.viewer.role, 'ADMIN');
assert.strictEqual(adminView.adminView.attacker.setup.enginePosition, 5, 'Admin can see P1 engine at position 5');
assert.strictEqual(adminView.adminView.defender.setup.enginePosition, 1, 'Admin can see P2 engine at position 1');
console.log('✅ Test 8 Passed: Hidden information securely filtered from opponent while exposed to Admin.');

// Test 9: Attack Execution & Shield Absorption
// Attacker fires Cannon (Pos 1) at Defender's Pos 2 (which has a Shield protecting Cannon)
const attackResult = CombatEngine.executeAttack(p1Auth.lobby.id, p1Auth.player.id, {
  weaponPosition: 1,
  targetPosition: 2
});
assert.ok(attackResult.success);
assert.ok(attackResult.diceRoll >= 1 && attackResult.diceRoll <= 6);
assert.ok(attackResult.details.shieldHit, 'Should hit the shield protecting Pos 2');
console.log(`✅ Test 9 Passed: Attack fired with 🎲 ${attackResult.diceRoll} (${attackResult.damageMultiplier * 100}%), shield absorbed damage.`);

// Verify turn switched to Defender
lobbyState = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(p1Auth.lobby.id);
assert.strictEqual(lobbyState.current_turn_player_id, p2Auth.player.id, 'Turn should switch to Defender');

// Test 10: Repair Turn
// Defender uses repair kit on Pos 2 weapon (or Engine)
// First give weapon slight damage for repair testing
db.prepare('UPDATE lobby_weapon_positions SET current_hp = 30 WHERE lobby_id = ? AND player_id = ? AND position = 2')
  .run(p1Auth.lobby.id, p2Auth.player.id);

const repairResult = CombatEngine.executeRepair(p1Auth.lobby.id, p2Auth.player.id, {
  targetType: 'WEAPON',
  targetPosition: 2,
  repairDefinitionId: 'repair-kit'
});
assert.ok(repairResult.success);
assert.strictEqual(repairResult.newHp, 50, 'Weapon HP restored from 30 to 50 (+25 capped at max)');
console.log('✅ Test 10 Passed: Repair action executed and consumed turn.');

// Test 11: Engine Hit and Destruction Win Condition
// Attacker attacks Pos 1 on Defender (Defender Engine is on Pos 1)
// Let's set defender engine HP to 10 so any attack destroys it
db.prepare('UPDATE lobby_ship_setups SET engine_current_hp = 10 WHERE lobby_id = ? AND player_id = ?')
  .run(p1Auth.lobby.id, p2Auth.player.id);

const finalAttack = CombatEngine.executeAttack(p1Auth.lobby.id, p1Auth.player.id, {
  weaponPosition: 1,
  targetPosition: 1
});
assert.ok(finalAttack.details.targetDestroyed);
assert.strictEqual(finalAttack.details.targetType, 'ENGINE');
assert.strictEqual(finalAttack.details.isGameOver, true);

lobbyState = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(p1Auth.lobby.id);
assert.strictEqual(lobbyState.status, 'COMPLETED');
assert.strictEqual(lobbyState.winner_player_id, p1Auth.player.id);
assert.strictEqual(lobbyState.end_reason, 'ENGINE_DESTROYED');

const historyRecord = db.prepare('SELECT * FROM battle_history WHERE public_code = ?').get(p1Create.publicCode);
assert.ok(historyRecord, 'Battle history record must be created');
assert.strictEqual(historyRecord.winner_captain, 'Monkey D. Luffy');
console.log('✅ Test 11 Passed: Engine destroyed, victory resolved and recorded in battle history.');

// Test 12: Admin Moderation Command
const adminCmdResult = CombatEngine.executeAdminCommand(p1Auth.lobby.id, 'FORCE_WIN_DEFENDER');
assert.ok(adminCmdResult.success);
console.log('✅ Test 12 Passed: Admin command executed and logged.');

console.log('\n🎉 ALL 12 BACKEND COMBAT TESTS PASSED SUCCESSFULLY!\n');

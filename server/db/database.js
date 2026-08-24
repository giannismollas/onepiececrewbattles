import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'battles.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Lobbies table
    CREATE TABLE IF NOT EXISTS lobbies (
      id TEXT PRIMARY KEY,
      public_code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING_FOR_PLAYER',
      current_round INTEGER NOT NULL DEFAULT 1,
      current_turn_player_id TEXT,
      winner_player_id TEXT,
      loser_player_id TEXT,
      end_reason TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT
    );

    -- Lobby players table
    CREATE TABLE IF NOT EXISTS lobby_players (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'ATTACKER' | 'DEFENDER'
      captain_name TEXT NOT NULL,
      crew_name TEXT NOT NULL,
      player_token TEXT UNIQUE NOT NULL,
      ready INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      last_seen TEXT,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE
    );

    -- Lobby admin access table
    CREATE TABLE IF NOT EXISTS lobby_admin_access (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      admin_token TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE
    );

    -- Ship definitions table
    CREATE TABLE IF NOT EXISTS ship_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      engine_hp INTEGER NOT NULL,
      weapon_slots INTEGER NOT NULL,
      is_combat INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      icon TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- Weapon definitions table
    CREATE TABLE IF NOT EXISTS weapon_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_damage INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      icon TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- Shield definitions table
    CREATE TABLE IF NOT EXISTS shield_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_hp INTEGER NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- Repair definitions table
    CREATE TABLE IF NOT EXISTS repair_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repair_amount INTEGER NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- Lobby ship setups table
    CREATE TABLE IF NOT EXISTS lobby_ship_setups (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      ship_definition_id TEXT NOT NULL,
      engine_position INTEGER NOT NULL DEFAULT 1,
      engine_current_hp INTEGER NOT NULL DEFAULT 200,
      engine_max_hp INTEGER NOT NULL DEFAULT 200,
      locked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES lobby_players(id) ON DELETE CASCADE,
      FOREIGN KEY (ship_definition_id) REFERENCES ship_definitions(id)
    );

    -- Lobby weapon positions table
    CREATE TABLE IF NOT EXISTS lobby_weapon_positions (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      weapon_definition_id TEXT NOT NULL,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      alias TEXT,
      is_destroyed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES lobby_players(id) ON DELETE CASCADE,
      FOREIGN KEY (weapon_definition_id) REFERENCES weapon_definitions(id)
    );

    -- Lobby shields table
    CREATE TABLE IF NOT EXISTS lobby_shields (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      protected_type TEXT NOT NULL, -- 'WEAPON' | 'ENGINE'
      protected_position INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      shield_definition_id TEXT NOT NULL,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES lobby_players(id) ON DELETE CASCADE,
      FOREIGN KEY (shield_definition_id) REFERENCES shield_definitions(id)
    );

    -- Lobby repairs table
    CREATE TABLE IF NOT EXISTS lobby_repairs (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      repair_definition_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 2,
      remaining_quantity INTEGER NOT NULL DEFAULT 2,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES lobby_players(id) ON DELETE CASCADE,
      FOREIGN KEY (repair_definition_id) REFERENCES repair_definitions(id)
    );

    -- Player discoveries table (fog-of-war tracking: what an observer knows about enemy positions)
    CREATE TABLE IF NOT EXISTS player_discoveries (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      observer_player_id TEXT NOT NULL,
      target_position INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'EMPTY', 'SHIELD_HIT', 'WEAPON_HIT', 'WEAPON_DESTROYED', 'ENGINE_HIT'
      revealed_name TEXT,
      revealed_type TEXT,
      last_updated TEXT NOT NULL,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
      FOREIGN KEY (observer_player_id) REFERENCES lobby_players(id) ON DELETE CASCADE
    );

    -- Battle actions log table
    CREATE TABLE IF NOT EXISTS battle_actions (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      player_id TEXT,
      action_type TEXT NOT NULL, -- 'ATTACK' | 'REPAIR' | 'SURRENDER' | 'ADMIN_COMMAND'
      weapon_position INTEGER,
      target_position INTEGER,
      dice_roll INTEGER,
      base_damage INTEGER,
      damage_multiplier REAL,
      final_damage INTEGER,
      result_summary TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE
    );

    -- Battle history table
    CREATE TABLE IF NOT EXISTS battle_history (
      id TEXT PRIMARY KEY,
      lobby_id TEXT NOT NULL,
      public_code TEXT NOT NULL,
      winner_captain TEXT NOT NULL,
      winner_crew TEXT NOT NULL,
      winner_ship TEXT NOT NULL,
      loser_captain TEXT NOT NULL,
      loser_crew TEXT NOT NULL,
      loser_ship TEXT NOT NULL,
      end_reason TEXT NOT NULL,
      rounds INTEGER NOT NULL,
      summary_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  seedDefinitions();
}

function seedDefinitions() {
  const countShips = db.prepare('SELECT COUNT(*) as count FROM ship_definitions').get();
  if (countShips.count === 0) {
    const insertShip = db.prepare(`
      INSERT INTO ship_definitions (id, name, capacity, price, engine_hp, weapon_slots, is_combat, description, icon)
      VALUES (@id, @name, @capacity, @price, @engine_hp, @weapon_slots, @is_combat, @description, @icon)
    `);

    const ships = [
      // Non-combat boats
      { id: 'simple-boat', name: 'Simple Boat', capacity: 1, price: 10000, engine_hp: 0, weapon_slots: 0, is_combat: 0, description: 'Basic wooden raft. Cannot engage in ship-to-ship combat.', icon: 'raft' },
      { id: 'small-sail-boat', name: 'Small Sail Boat', capacity: 1, price: 20000, engine_hp: 0, weapon_slots: 0, is_combat: 0, description: 'Single-sail skiff for calm waters. Non-combat.', icon: 'sailboat' },
      { id: 'heavy-boat', name: 'Heavy Boat', capacity: 1, price: 30000, engine_hp: 0, weapon_slots: 0, is_combat: 0, description: 'Reinforced transport boat. Non-combat.', icon: 'heavy-boat' },
      { id: 'papous-tent-boat', name: "Papou's Tent Boat", capacity: 1, price: 10000, engine_hp: 0, weapon_slots: 0, is_combat: 0, description: 'Comfortable covered boat. Non-combat.', icon: 'tent-boat' },
      { id: 'duo-boat', name: 'Duo Boat', capacity: 2, price: 15000, engine_hp: 0, weapon_slots: 0, is_combat: 0, description: 'Two-seater rowing craft. Non-combat.', icon: 'duo-boat' },

      // Combat Ships
      { id: 'ship', name: 'Ship', capacity: 3, price: 50000, engine_hp: 200, weapon_slots: 4, is_combat: 1, description: 'Standard pirate brigantine with 4 weapon positions and 200 HP Engine.', icon: 'caravel' },
      { id: 'transport-ship', name: 'Transport Ship', capacity: 4, price: 75000, engine_hp: 200, weapon_slots: 4, is_combat: 1, description: 'Sturdy vessel designed for long voyages with 4 weapon positions.', icon: 'transport' },
      { id: 'pink-transport-ship', name: 'Pink Transport Ship', capacity: 4, price: 90000, engine_hp: 200, weapon_slots: 4, is_combat: 1, description: 'Flashy customized transport vessel with 4 weapon positions.', icon: 'pink-transport' },
      { id: 'small-cannon-ship', name: 'Small Cannon Ship', capacity: 5, price: 110000, engine_hp: 200, weapon_slots: 4, is_combat: 1, description: 'Combat-focused gunboat fitted with 4 weapon positions.', icon: 'gunboat' },
      { id: 'captains-ship', name: "Captain's Ship", capacity: 6, price: 150000, engine_hp: 300, weapon_slots: 5, is_combat: 1, description: 'Commanding flagship with 300 HP Engine and 5 weapon positions.', icon: 'galleon' },
      { id: 'rider', name: 'Rider', capacity: 8, price: 200000, engine_hp: 300, weapon_slots: 6, is_combat: 1, description: 'High-speed combat cruiser with 6 weapon positions and 300 HP Engine.', icon: 'cruiser' },
      { id: 'clown-ship', name: 'Clown Ship', capacity: 5, price: 180000, engine_hp: 300, weapon_slots: 6, is_combat: 1, description: 'Tricky pirate vessel with 6 weapon positions and 300 HP Engine.', icon: 'circus-ship' },
      { id: 'mill-ship', name: 'Mill Ship', capacity: 8, price: 260000, engine_hp: 300, weapon_slots: 8, is_combat: 1, description: 'Heavy paddle-wheel warship with 8 weapon positions.', icon: 'mill' },
      { id: 'red-dragon', name: 'Red Dragon', capacity: 10, price: 320000, engine_hp: 300, weapon_slots: 8, is_combat: 1, description: 'Intimidating dragon-prow dreadnought with 8 weapon positions.', icon: 'dragon-ship' },
      { id: 'typhoon', name: 'Typhoon', capacity: 15, price: 500000, engine_hp: 450, weapon_slots: 10, is_combat: 1, description: 'Colossal titan of the seas with 450 HP Engine and 10 weapon positions.', icon: 'typhoon' },
      { id: 'fleet-of-god', name: 'Fleet of God', capacity: 15, price: 750000, engine_hp: 500, weapon_slots: 10, is_combat: 1, description: 'Legendary apex ark powered by ancient technology. 500 HP Engine, 10 weapon slots.', icon: 'ark-god' }
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insertShip.run(item);
    });
    insertMany(ships);
  }

  const countWeapons = db.prepare('SELECT COUNT(*) as count FROM weapon_definitions').get();
  if (countWeapons.count === 0) {
    const insertWeapon = db.prepare(`
      INSERT INTO weapon_definitions (id, name, base_damage, max_hp, price, description, icon)
      VALUES (@id, @name, @base_damage, @max_hp, @price, @description, @icon)
    `);

    const weapons = [
      { id: 'cannon', name: 'Cannon', base_damage: 20, max_hp: 50, price: 5000, description: 'Heavy iron naval cannon delivering devastating broadside damage.', icon: 'cannon' },
      { id: 'ballista', name: 'Ballista', base_damage: 15, max_hp: 40, price: 3500, description: 'Precision bolt thrower with solid hull-piercing capability.', icon: 'ballista' },
      { id: 'catapult', name: 'Catapult', base_damage: 30, max_hp: 60, price: 7500, description: 'High-arc artillery flinging heavy boulders to crush enemy emplacements.', icon: 'catapult' },
      { id: 'mangonel', name: 'Mangonel', base_damage: 40, max_hp: 70, price: 10000, description: 'Massive torsion war engine boasting extreme impact power.', icon: 'mangonel' },
      { id: 'bow', name: 'Bow', base_damage: 10, max_hp: 30, price: 1500, description: 'Quick archery station for rapid harassment attacks.', icon: 'bow' },
      { id: 'crossbow', name: 'Crossbow', base_damage: 15, max_hp: 35, price: 2500, description: 'Mechanical bow with high tension and accurate targeting.', icon: 'crossbow' },
      { id: 'sling', name: 'Sling', base_damage: 5, max_hp: 20, price: 500, description: 'Light projectile sling for skirmishing.', icon: 'sling' },
      { id: 'thrown-stone', name: 'Thrown Stone', base_damage: 10, max_hp: 25, price: 800, description: 'Raw brute-force boulders hurled by crew members.', icon: 'stone' }
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insertWeapon.run(item);
    });
    insertMany(weapons);
  }

  const countShields = db.prepare('SELECT COUNT(*) as count FROM shield_definitions').get();
  if (countShields.count === 0) {
    const insertShield = db.prepare(`
      INSERT INTO shield_definitions (id, name, max_hp, price, description)
      VALUES (@id, @name, @max_hp, @price, @description)
    `);

    const shields = [
      { id: 'iron-shield', name: 'Iron Naval Shield', max_hp: 50, price: 4000, description: 'Reinforced iron plating protecting one weapon position or the Engine from attacks.' },
      { id: 'wooden-barrier', name: 'Wooden Barrier', max_hp: 35, price: 2000, description: 'Treated oak barricade absorbing initial enemy fire.' },
      { id: 'marine-adamant', name: 'Marine Adamant Plating', max_hp: 75, price: 8000, description: 'High-grade military alloy shield granting maximum defense.' }
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insertShield.run(item);
    });
    insertMany(shields);
  }

  const countRepairs = db.prepare('SELECT COUNT(*) as count FROM repair_definitions').get();
  if (countRepairs.count === 0) {
    const insertRepair = db.prepare(`
      INSERT INTO repair_definitions (id, name, repair_amount, price, description)
      VALUES (@id, @name, @repair_amount, @price, @description)
    `);

    const repairs = [
      { id: 'repair-kit', name: 'Repair Kit', repair_amount: 25, price: 2000, description: 'Emergency wood & tool kit restoring +25 HP to a damaged (non-destroyed) target. Consumes turn.' },
      { id: 'master-shipwright-kit', name: 'Master Shipwright Kit', repair_amount: 50, price: 5000, description: 'Advanced pirate carpentry supplies restoring +50 HP to a damaged target. Consumes turn.' }
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) insertRepair.run(item);
    });
    insertMany(repairs);
  }
}

export default db;

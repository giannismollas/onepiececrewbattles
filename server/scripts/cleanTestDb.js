import db from '../db/database.js';

try {
  const info1 = db.prepare("DELETE FROM battle_history WHERE public_code LIKE 'SHIP-%' AND winner_captain = 'Monkey D. Luffy' AND loser_captain = 'Marshall D. Teach' AND rounds = 2").run();
  console.log(`Cleaned mock test battles.`);
} catch (err) {
  console.error(err);
}

const db = require('./db');
const bcrypt = require('bcryptjs');

/**
 * Seeds initial users (flat members) and a default group.
 * Safe to run multiple times — checks for existing records.
 */
function seed() {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    console.log('[seed] Database already seeded, skipping.');
    return;
  }

  console.log('[seed] Seeding initial data...');

  // Flat members — default password is their name lowercase
  const members = [
    { name: 'Aisha',  email: 'aisha@flatmates.app',  pwd: 'aisha123'  },
    { name: 'Rohan',  email: 'rohan@flatmates.app',  pwd: 'rohan123'  },
    { name: 'Priya',  email: 'priya@flatmates.app',  pwd: 'priya123'  },
    { name: 'Meera',  email: 'meera@flatmates.app',  pwd: 'meera123'  },
    { name: 'Sam',    email: 'sam@flatmates.app',    pwd: 'sam123'    },
    { name: 'Dev',    email: 'dev@flatmates.app',    pwd: 'dev123'    },
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  );

  const userIds = {};
  for (const m of members) {
    const hash = bcrypt.hashSync(m.pwd, 10);
    const result = insertUser.run(m.name, m.email, hash);
    userIds[m.name] = result.lastInsertRowid;
  }

  // Create the main flat group
  const groupResult = db.prepare(
    'INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)'
  ).run('The Flat', 'Shared flat expenses - Aisha, Rohan, Priya, Meera, Sam', userIds['Aisha']);

  const groupId = groupResult.lastInsertRowid;

  // Membership timeline
  // Aisha, Rohan, Priya — from Feb 1
  // Meera — Feb 1 to Mar 31
  // Sam — Apr 8 onwards
  // Dev — guest (not a permanent member, appears as guest)
  const addMember = db.prepare(
    'INSERT INTO group_members (group_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?)'
  );

  addMember.run(groupId, userIds['Aisha'], '2026-02-01', null);
  addMember.run(groupId, userIds['Rohan'], '2026-02-01', null);
  addMember.run(groupId, userIds['Priya'], '2026-02-01', null);
  addMember.run(groupId, userIds['Meera'], '2026-02-01', '2026-03-31');
  addMember.run(groupId, userIds['Sam'],   '2026-04-08', null);

  // Dev as guest member
  db.prepare('INSERT INTO guest_members (name, group_id) VALUES (?, ?)').run('Dev', groupId);
  db.prepare('INSERT INTO guest_members (name, group_id) VALUES (?, ?)').run("Dev's friend Kabir", groupId);

  console.log('[seed] Done. Created', members.length, 'users and 1 group.');
  return { userIds, groupId };
}

module.exports = { seed };

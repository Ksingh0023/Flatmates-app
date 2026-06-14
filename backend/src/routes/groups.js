const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/groups — list all groups the current user belongs to
router.get('/', requireAuth, (req, res) => {
  const groups = db.prepare(`
    SELECT g.id, g.name, g.description, g.created_at,
           COUNT(DISTINCT gm.user_id) as member_count
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ? AND gm.left_at IS NULL
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all(req.user.id);

  res.json(groups);
});

// POST /api/groups — create a new group
router.post('/', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const result = db.prepare(
    'INSERT INTO groups (name, description, created_by) VALUES (?, ?, ?)'
  ).run(name.trim(), description || null, req.user.id);

  // Creator is automatically a member from today
  db.prepare(
    'INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)'
  ).run(result.lastInsertRowid, req.user.id, new Date().toISOString().split('T')[0]);

  res.status(201).json({ id: result.lastInsertRowid, name, description });
});

// GET /api/groups/:id — get group details + members
router.get('/:id', requireAuth, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, gm.joined_at, gm.left_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at, u.name
  `).all(req.params.id);

  const guests = db.prepare(
    'SELECT id, name FROM guest_members WHERE group_id = ?'
  ).all(req.params.id);

  res.json({ ...group, members, guests });
});

// POST /api/groups/:id/members — add a member
router.post('/:id/members', requireAuth, (req, res) => {
  const { user_id, joined_at } = req.body;
  if (!user_id || !joined_at) {
    return res.status(400).json({ error: 'user_id and joined_at are required' });
  }

  // Check if user already active in group
  const existing = db.prepare(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND left_at IS NULL'
  ).get(req.params.id, user_id);

  if (existing) {
    return res.status(409).json({ error: 'User is already an active member of this group' });
  }

  db.prepare(
    'INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)'
  ).run(req.params.id, user_id, joined_at);

  res.status(201).json({ message: 'Member added' });
});

// PATCH /api/groups/:id/members/:uid/leave — record member leaving
router.patch('/:id/members/:uid/leave', requireAuth, (req, res) => {
  const { left_at } = req.body;
  if (!left_at) return res.status(400).json({ error: 'left_at date is required' });

  db.prepare(
    'UPDATE group_members SET left_at = ? WHERE group_id = ? AND user_id = ? AND left_at IS NULL'
  ).run(left_at, req.params.id, req.params.uid);

  res.json({ message: 'Member marked as left' });
});

// DELETE /api/groups/:id — delete group (only creator)
router.delete('/:id', requireAuth, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only the group creator can delete it' });
  }

  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  res.json({ message: 'Group deleted' });
});

module.exports = router;

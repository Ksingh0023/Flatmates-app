const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/settlements?group_id=X
router.get('/', requireAuth, (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  const settlements = db.prepare(`
    SELECT s.*,
           u1.name as paid_by_name,
           u2.name as paid_to_name
    FROM settlements s
    JOIN users u1 ON u1.id = s.paid_by
    JOIN users u2 ON u2.id = s.paid_to
    WHERE s.group_id = ?
    ORDER BY s.date DESC
  `).all(group_id);

  res.json(settlements);
});

// POST /api/settlements — record a payment/settlement
router.post('/', requireAuth, (req, res) => {
  const { group_id, paid_by, paid_to, amount, currency = 'INR', exchange_rate = 1, date, notes } = req.body;

  if (!group_id || !paid_by || !paid_to || !amount || !date) {
    return res.status(400).json({ error: 'group_id, paid_by, paid_to, amount and date are required' });
  }

  if (paid_by === paid_to) {
    return res.status(400).json({ error: 'paid_by and paid_to cannot be the same person' });
  }

  const amountINR = +(amount * exchange_rate).toFixed(2);

  const result = db.prepare(`
    INSERT INTO settlements (group_id, paid_by, paid_to, amount, currency, amount_inr, date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(group_id, paid_by, paid_to, amount, currency, amountINR, date, notes || null);

  const settlement = db.prepare(`
    SELECT s.*, u1.name as paid_by_name, u2.name as paid_to_name
    FROM settlements s
    JOIN users u1 ON u1.id = s.paid_by
    JOIN users u2 ON u2.id = s.paid_to
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(settlement);
});

// DELETE /api/settlements/:id — remove a settlement
router.delete('/:id', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM settlements WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Settlement not found' });

  db.prepare('DELETE FROM settlements WHERE id = ?').run(s.id);
  res.json({ message: 'Settlement removed' });
});

module.exports = router;

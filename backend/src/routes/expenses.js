const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { computeSplits, parseSplitDetails } = require('../services/splitService');
const { computeBalances, simplifyDebts, getMemberBreakdown } = require('../services/balanceService');

const router = express.Router();

// GET /api/expenses?group_id=X — list expenses for a group
router.get('/', requireAuth, (req, res) => {
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });

  const expenses = db.prepare(`
    SELECT e.*, u.name as paid_by_name
    FROM expenses e
    JOIN users u ON u.id = e.paid_by
    WHERE e.group_id = ? AND e.is_deleted = 0
    ORDER BY e.date DESC, e.created_at DESC
  `).all(group_id);

  // Attach splits for each expense
  for (const exp of expenses) {
    exp.splits = db.prepare(`
      SELECT es.*, u.name as user_name
      FROM expense_splits es
      JOIN users u ON u.id = es.user_id
      WHERE es.expense_id = ?
    `).all(exp.id);
  }

  res.json(expenses);
});

// GET /api/expenses/:id — get single expense with full breakdown
router.get('/:id', requireAuth, (req, res) => {
  const expense = db.prepare(`
    SELECT e.*, u.name as paid_by_name
    FROM expenses e
    JOIN users u ON u.id = e.paid_by
    WHERE e.id = ? AND e.is_deleted = 0
  `).get(req.params.id);

  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  expense.splits = db.prepare(`
    SELECT es.*, u.name as user_name
    FROM expense_splits es
    JOIN users u ON u.id = es.user_id
    WHERE es.expense_id = ?
  `).all(expense.id);

  res.json(expense);
});

// POST /api/expenses — create a new expense
router.post('/', requireAuth, (req, res) => {
  const {
    group_id, description, date, paid_by,
    amount, currency = 'INR', exchange_rate = 1,
    split_type, notes, splits: rawSplits
  } = req.body;

  if (!group_id || !description || !date || !paid_by || amount == null || !split_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const amountINR = +(amount * exchange_rate).toFixed(2);

  // Resolve member userIds from the split list
  let splitMembers = rawSplits; // [ { userId, shareAmount?, sharePct?, shareUnits? } ]

  // If split_details provided as object keyed by name, resolve to userId
  let detailsByUserId = {};
  if (req.body.split_details_by_name) {
    const nameToId = {};
    const allUsers = db.prepare('SELECT id, name FROM users').all();
    for (const u of allUsers) nameToId[u.name.toLowerCase()] = u.id;

    for (const [name, val] of Object.entries(req.body.split_details_by_name)) {
      const uid = nameToId[name.toLowerCase()];
      if (uid) detailsByUserId[uid] = val;
    }
  }

  // Compute splits
  let computedSplits;
  try {
    const members = splitMembers.map(s => ({ userId: s.userId }));
    computedSplits = computeSplits(split_type, amountINR, members, detailsByUserId);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Write expense + splits in a transaction
  const insertExpense = db.prepare(`
    INSERT INTO expenses (group_id, description, date, paid_by, amount, currency, amount_inr, exchange_rate, split_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSplit = db.prepare(`
    INSERT INTO expense_splits (expense_id, user_id, share_amount, share_pct, share_units)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    const result = insertExpense.run(
      group_id, description, date, paid_by,
      amount, currency, amountINR, exchange_rate,
      split_type, notes || null
    );
    const expId = result.lastInsertRowid;

    for (const s of computedSplits) {
      insertSplit.run(expId, s.userId, s.shareAmount, s.sharePct || null, s.shareUnits || null);
    }

    return expId;
  });

  const expId = tx();
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expId);
  expense.splits = db.prepare(`
    SELECT es.*, u.name as user_name
    FROM expense_splits es JOIN users u ON u.id = es.user_id
    WHERE es.expense_id = ?
  `).all(expId);

  res.status(201).json(expense);
});

// PATCH /api/expenses/:id — edit expense
router.patch('/:id', requireAuth, (req, res) => {
  const exp = db.prepare('SELECT * FROM expenses WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Expense not found' });

  const { description, date, notes } = req.body;

  db.prepare(`
    UPDATE expenses SET description = ?, date = ?, notes = ?
    WHERE id = ?
  `).run(
    description || exp.description,
    date || exp.date,
    notes !== undefined ? notes : exp.notes,
    exp.id
  );

  res.json({ message: 'Updated' });
});

// DELETE /api/expenses/:id — soft delete
router.delete('/:id', requireAuth, (req, res) => {
  const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Expense not found' });

  db.prepare('UPDATE expenses SET is_deleted = 1 WHERE id = ?').run(exp.id);
  res.json({ message: 'Expense deleted' });
});

// GET /api/expenses/balances/:groupId — group-wide balance summary
router.get('/balances/:groupId', requireAuth, (req, res) => {
  const balances = computeBalances(req.params.groupId);
  const transactions = simplifyDebts(balances);
  res.json({ balances, transactions });
});

// GET /api/expenses/breakdown/:groupId/:userId — member expense breakdown
router.get('/breakdown/:groupId/:userId', requireAuth, (req, res) => {
  const data = getMemberBreakdown(req.params.groupId, req.params.userId);
  res.json(data);
});

module.exports = router;

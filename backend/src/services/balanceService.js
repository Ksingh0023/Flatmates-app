/**
 * Balance Calculation Service
 *
 * Computes net balances for all members in a group by:
 * 1. Summing what each person paid (credits)
 * 2. Subtracting what each person owes (debits from expense splits)
 * 3. Accounting for settlements
 *
 * Result: net[userId] = positive means others owe them, negative means they owe others.
 *
 * Debt simplification: minimise number of transactions using a greedy algorithm.
 */

const db = require('../db/db');

/**
 * Compute raw net balances for all members of a group.
 * @param {number} groupId
 * @returns {Object} map of userId -> { name, net, paid, owed }
 */
function computeBalances(groupId) {
  // Get all active + past members of this group
  const members = db.prepare(`
    SELECT u.id, u.name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    GROUP BY u.id
  `).all(groupId);

  const balances = {};
  for (const m of members) {
    balances[m.id] = { name: m.name, paid: 0, owed: 0, net: 0 };
  }

  // Amount paid by each person (credit)
  const paid = db.prepare(`
    SELECT paid_by, SUM(amount_inr) as total
    FROM expenses
    WHERE group_id = ? AND is_deleted = 0
    GROUP BY paid_by
  `).all(groupId);

  for (const row of paid) {
    if (balances[row.paid_by]) {
      balances[row.paid_by].paid += row.total;
    }
  }

  // Amount owed by each person (debit from splits)
  const splits = db.prepare(`
    SELECT es.user_id, SUM(es.share_amount) as total
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    WHERE e.group_id = ? AND e.is_deleted = 0
    GROUP BY es.user_id
  `).all(groupId);

  for (const row of splits) {
    if (balances[row.user_id]) {
      balances[row.user_id].owed += row.total;
    }
  }

  // Settlements: paying reduces what you owe, receiving reduces what others owe you
  const settlements = db.prepare(`
    SELECT paid_by, paid_to, amount_inr
    FROM settlements
    WHERE group_id = ?
  `).all(groupId);

  for (const s of settlements) {
    if (balances[s.paid_by]) balances[s.paid_by].paid   += s.amount_inr;
    if (balances[s.paid_to]) balances[s.paid_to].owed   += s.amount_inr;
  }

  // Net = paid - owed
  for (const id in balances) {
    balances[id].net = +(balances[id].paid - balances[id].owed).toFixed(2);
    balances[id].paid = +balances[id].paid.toFixed(2);
    balances[id].owed = +balances[id].owed.toFixed(2);
  }

  return balances;
}

/**
 * Simplify debts: given net balances, compute the minimum set of transactions
 * to settle all debts. Uses a greedy algorithm (creditors & debtors lists).
 *
 * @param {Object} balances - output of computeBalances()
 * @returns {Array} [ { from, fromName, to, toName, amount } ]
 */
function simplifyDebts(balances) {
  // Separate into debtors (net < 0) and creditors (net > 0)
  const debtors   = [];
  const creditors = [];

  for (const [id, b] of Object.entries(balances)) {
    if (b.net < -0.01) debtors.push({ id: +id, name: b.name, amount: -b.net });
    if (b.net > 0.01)  creditors.push({ id: +id, name: b.name, amount: b.net });
  }

  const transactions = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amt = Math.min(d.amount, c.amount);

    transactions.push({
      from:     d.id,
      fromName: d.name,
      to:       c.id,
      toName:   c.name,
      amount:   +amt.toFixed(2)
    });

    d.amount -= amt;
    c.amount -= amt;

    if (d.amount < 0.01) i++;
    if (c.amount < 0.01) j++;
  }

  return transactions;
}

/**
 * Get per-member expense breakdown: which expenses contribute to their balance.
 * Used by Rohan's "show me exactly which expenses make up my balance" requirement.
 */
function getMemberBreakdown(groupId, userId) {
  const expenses = db.prepare(`
    SELECT e.id, e.description, e.date, e.amount_inr, e.currency, e.amount,
           e.split_type, e.notes,
           u.name as paid_by_name,
           es.share_amount
    FROM expense_splits es
    JOIN expenses e ON e.id = es.expense_id
    JOIN users u ON u.id = e.paid_by
    WHERE e.group_id = ? AND es.user_id = ? AND e.is_deleted = 0
    ORDER BY e.date
  `).all(groupId, userId);

  const paid = db.prepare(`
    SELECT e.id, e.description, e.date, e.amount_inr, e.currency, e.amount,
           e.split_type, e.notes
    FROM expenses e
    WHERE e.group_id = ? AND e.paid_by = ? AND e.is_deleted = 0
    ORDER BY e.date
  `).all(groupId, userId);

  const settledOut = db.prepare(`
    SELECT s.*, u.name as to_name
    FROM settlements s JOIN users u ON u.id = s.paid_to
    WHERE s.group_id = ? AND s.paid_by = ?
  `).all(groupId, userId);

  const settledIn = db.prepare(`
    SELECT s.*, u.name as from_name
    FROM settlements s JOIN users u ON u.id = s.paid_by
    WHERE s.group_id = ? AND s.paid_to = ?
  `).all(groupId, userId);

  return { expenses, paid, settledOut, settledIn };
}

module.exports = { computeBalances, simplifyDebts, getMemberBreakdown };

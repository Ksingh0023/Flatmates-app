const express = require('express');
const multer  = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { detectAnomalies } = require('../services/importService');
const { computeSplits, parseSplitDetails } = require('../services/splitService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Exchange rates (historical — March 2026 Goa trip)
// USD rate at time of Goa trip (approx Bank of India rate, March 2026)
const DEFAULT_RATES = { USD: 84.5, INR: 1 };

// POST /api/import/parse — upload CSV, run anomaly detection, return review payload
router.post('/parse', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!req.body.group_id) return res.status(400).json({ error: 'group_id required' });

  let rows;
  try {
    // Auto-detect delimiter: try tab first (the provided file is TSV), fall back to comma
    const rawText = req.file.buffer.toString('utf8');
    const firstLine = rawText.split('\n')[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    rows = parse(rawText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      delimiter,
    });
  } catch (err) {
    return res.status(400).json({ error: `CSV parse error: ${err.message}` });
  }

  // Fetch current group members for membership timeline validation
  const dbMembers = db.prepare(`
    SELECT u.name, gm.joined_at, gm.left_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
  `).all(req.body.group_id);

  // Run anomaly detection
  const annotated = detectAnomalies(rows, dbMembers);

  // Create import session record
  const session = db.prepare(`
    INSERT INTO import_sessions (filename, imported_by, total_rows, status)
    VALUES (?, ?, ?, 'pending')
  `).run(req.file.originalname, req.user.id, rows.length);

  const sessionId = session.lastInsertRowid;

  // Save anomalies to DB (for report generation)
  const insertAnomaly = db.prepare(`
    INSERT INTO import_anomalies (session_id, csv_row, anomaly_type, description, original_value, suggested_fix, resolution)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of annotated) {
    for (const anomaly of row._anomalies) {
      insertAnomaly.run(
        sessionId,
        row._csvRow,
        anomaly.type,
        anomaly.description,
        anomaly.originalValue || null,
        anomaly.suggested || null,
        'pending'
      );
    }
    for (const fix of row._autoFixes) {
      insertAnomaly.run(
        sessionId,
        row._csvRow,
        fix.type,
        fix.description,
        null,
        null,
        'auto_fixed'
      );
    }
  }

  res.json({
    sessionId,
    totalRows: rows.length,
    flaggedRows: annotated.filter(r => r._action === 'flag').length,
    cleanRows:   annotated.filter(r => r._action === 'accept').length,
    rows: annotated
  });
});

// POST /api/import/confirm — user has reviewed and made decisions; write to DB
router.post('/confirm', requireAuth, (req, res) => {
  const { sessionId, group_id, decisions, exchange_rates = {} } = req.body;

  if (!sessionId || !group_id || !decisions) {
    return res.status(400).json({ error: 'sessionId, group_id and decisions required' });
  }

  // Fetch all users for name->id resolution
  const allUsers = db.prepare('SELECT id, name FROM users').all();
  const nameToId = {};
  for (const u of allUsers) nameToId[u.name.toLowerCase()] = u.id;

  // Merge default rates with user-provided overrides
  const rates = { ...DEFAULT_RATES, ...exchange_rates };

  const insertExpense = db.prepare(`
    INSERT INTO expenses (group_id, description, date, paid_by, amount, currency, amount_inr, exchange_rate, split_type, notes, import_row)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSplit = db.prepare(`
    INSERT INTO expense_splits (expense_id, user_id, share_amount, share_pct, share_units)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSettlement = db.prepare(`
    INSERT INTO settlements (group_id, paid_by, paid_to, amount, currency, amount_inr, date, notes, import_row)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGuest = db.prepare(`
    INSERT OR IGNORE INTO guest_members (name, group_id) VALUES (?, ?)
  `);

  let accepted = 0, skipped = 0;
  const importReport = [];

  const tx = db.transaction(() => {
    for (const decision of decisions) {
      const { csvRow, action, row, resolvedPayerName, resolvedSplitType, resolvedDate, resolvedCurrency, isSettlement } = decision;

      if (action === 'skip') {
        skipped++;
        importReport.push({ csvRow, action: 'SKIPPED', reason: decision.skipReason || 'User chose to skip' });
        continue;
      }

      // Resolve payer
      const payerName = resolvedPayerName || row._payerName;
      const payerId = nameToId[payerName?.toLowerCase()];
      if (!payerId) {
        importReport.push({ csvRow, action: 'SKIPPED', reason: `Could not resolve payer: ${payerName}` });
        skipped++;
        continue;
      }

      const date = resolvedDate || row._parsedDate;
      const currency = resolvedCurrency || row._currency || 'INR';
      const amount = row._parsedAmount;
      const rate = rates[currency] || 1;
      const amountINR = +(Math.abs(amount) * rate).toFixed(2);
      const isRefund = row._isRefund || amount < 0;

      // Settlement record
      if (isSettlement || row._isSettlement) {
        // For settlements: split_with should have exactly one person
        const splitWith = (row.split_with || '').split(';').map(s => s.trim()).filter(Boolean);
        const toName = splitWith.find(n => n.toLowerCase() !== payerName?.toLowerCase());
        const toId = nameToId[toName?.toLowerCase()];

        if (toId) {
          insertSettlement.run(
            group_id, payerId, toId,
            Math.abs(amount), currency, amountINR,
            date, row.notes || null, csvRow
          );
          accepted++;
          importReport.push({ csvRow, action: 'SETTLEMENT', description: row.description });
        } else {
          importReport.push({ csvRow, action: 'SKIPPED', reason: `Settlement recipient not resolved` });
          skipped++;
        }
        continue;
      }

      // Expense record
      const splitType = resolvedSplitType || row.split_type || 'equal';
      const splitWithRaw = (row.split_with || '').split(';').map(s => s.trim()).filter(Boolean);

      // Resolve member userIds for split
      const splitMembers = [];
      for (const name of splitWithRaw) {
        const uid = nameToId[name.toLowerCase()];
        if (uid) {
          splitMembers.push({ userId: uid });
        } else if (name.includes("'s friend") || name.toLowerCase() === 'kabir') {
          // Guest — insert guest record, skip from monetary split
          insertGuest.run(name, group_id);
          importReport.push({ csvRow, note: `Guest "${name}" created, excluded from split amount` });
        } else {
          importReport.push({ csvRow, note: `Could not resolve split member: ${name}, excluded` });
        }
      }

      if (splitMembers.length === 0) {
        importReport.push({ csvRow, action: 'SKIPPED', reason: 'No valid split members' });
        skipped++;
        continue;
      }

      // Parse split details
      let detailsByUserId = {};
      if (row.split_details && row.split_details.trim()) {
        const detailsByName = parseSplitDetails(row.split_details);
        for (const [name, val] of Object.entries(detailsByName)) {
          const uid = nameToId[name.toLowerCase()];
          if (uid) detailsByUserId[uid] = val;
        }
      }

      // Compute splits
      let computedSplits;
      try {
        const amtForSplit = isRefund ? -amountINR : amountINR;
        computedSplits = computeSplits(splitType, Math.abs(amtForSplit), splitMembers, detailsByUserId);
        // For refunds, negate the amounts
        if (isRefund) computedSplits = computedSplits.map(s => ({ ...s, shareAmount: -s.shareAmount }));
      } catch (err) {
        importReport.push({ csvRow, action: 'SKIPPED', reason: `Split error: ${err.message}` });
        skipped++;
        continue;
      }

      const expResult = insertExpense.run(
        group_id,
        row.description,
        date,
        payerId,
        Math.abs(amount),
        currency,
        isRefund ? -amountINR : amountINR,
        rate,
        splitType,
        row.notes || null,
        csvRow
      );

      const expId = expResult.lastInsertRowid;
      for (const s of computedSplits) {
        insertSplit.run(expId, s.userId, s.shareAmount, s.sharePct || null, s.shareUnits || null);
      }

      accepted++;
      importReport.push({ csvRow, action: 'ACCEPTED', description: row.description, isRefund });
    }

    // Update session stats
    db.prepare(`
      UPDATE import_sessions
      SET accepted_rows = ?, skipped_rows = ?, status = 'complete'
      WHERE id = ?
    `).run(accepted, skipped, sessionId);

    // Mark all anomalies for this session as resolved
    db.prepare(`
      UPDATE import_anomalies SET resolution = 'user_approved', resolved_at = CURRENT_TIMESTAMP
      WHERE session_id = ? AND resolution = 'pending'
    `).run(sessionId);
  });

  tx();

  res.json({
    message: 'Import complete',
    accepted,
    skipped,
    report: importReport
  });
});

// GET /api/import/report/:sessionId — download import report
router.get('/report/:sessionId', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM import_sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const anomalies = db.prepare(`
    SELECT * FROM import_anomalies WHERE session_id = ? ORDER BY csv_row
  `).all(req.params.sessionId);

  res.json({ session, anomalies });
});

module.exports = router;

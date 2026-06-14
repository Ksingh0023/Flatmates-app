/**
 * CSV Import Pipeline
 *
 * Processes expenses_export.csv in stages:
 * 1. Parse raw rows
 * 2. Run anomaly detection (18 checks)
 * 3. Return annotated rows for user review
 * 4. On confirmation, write accepted rows to DB
 *
 * Policy decisions (documented in SCOPE.md and DECISIONS.md):
 * - Negative amounts → refund, auto-classified
 * - Zero amounts → flag, suggest skip
 * - Missing currency → flag, suggest INR
 * - Missing payer → flag, must be resolved by user
 * - Name case mismatch → auto-fix (normalise)
 * - Unknown name (fuzzy match) → auto-suggest, user confirms
 * - Settlements (blank split_type + keywords) → reclassify
 * - Exact duplicate → flag, suggest skip
 * - Fuzzy duplicate → flag, user picks
 * - Percentage ≠ 100% → flag as error
 * - Inactive member in split → flag
 * - Ambiguous date → flag, user picks interpretation
 * - Comma in amount → auto-fix (strip comma)
 * - Excess decimal precision → auto-fix (round to 2dp)
 * - Conflicting split_type and split_details → flag
 * - Unknown/guest member in split → flag, auto-create guest
 */

const { parseSplitDetails } = require('./splitService');

// Known member names and their canonical forms
const KNOWN_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

// Settlement keywords to detect misclassified settlements
const SETTLEMENT_KEYWORDS = [
  'paid back', 'paid aisha', 'paid rohan', 'paid priya', 'paid meera', 'paid sam', 'paid dev',
  'settlement', 'settle', 'repayment', 'reimburs', 'deposit'
];

// Levenshtein distance for fuzzy name matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function fuzzyMatchMember(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  // Exact case-insensitive match
  const exact = KNOWN_MEMBERS.find(m => m.toLowerCase() === lower);
  if (exact) return { match: exact, confidence: 'exact' };

  // Fuzzy match (distance <= 2)
  let best = null, bestDist = 99;
  for (const m of KNOWN_MEMBERS) {
    const d = levenshtein(lower, m.toLowerCase());
    if (d < bestDist) { bestDist = d; best = m; }
  }
  if (bestDist <= 2) return { match: best, confidence: 'fuzzy', distance: bestDist };

  return null;
}

/**
 * Try to parse a date string using multiple formats.
 * Returns { date: 'YYYY-MM-DD', ambiguous: bool, alternatives: [] }
 */
function parseDate(raw) {
  if (!raw || raw.trim() === '') return { date: null, error: 'Missing date' };

  raw = raw.trim();

  // Format 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: raw, ambiguous: false };
  }

  // Format 2: DD/MM/YYYY
  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const asDD_MM = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;  // treat as DD/MM/YYYY
    const asMM_DD = `${y}-${d.padStart(2,'0')}-${m.padStart(2,'0')}`;  // treat as MM/DD/YYYY

    // If day <= 12, both interpretations are valid calendar dates → ambiguous
    if (parseInt(d) <= 12 && parseInt(m) <= 12) {
      return {
        date: asDD_MM,  // default: DD/MM/YYYY (Indian convention)
        ambiguous: true,
        alternatives: [
          { label: `${d} ${getMonthName(m)} ${y} (DD/MM/YYYY — Indian format)`, value: asDD_MM },
          { label: `${m} ${getMonthName(d)} ${y} (MM/DD/YYYY — US format)`,     value: asMM_DD }
        ]
      };
    }
    // If day > 12, only DD/MM/YYYY is valid
    return { date: asDD_MM, ambiguous: false };
  }

  // Format 3: "Mar 14" — month name + day, no year
  const shortMatch = raw.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (shortMatch) {
    const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
                     jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    const mo = months[shortMatch[1].toLowerCase()];
    const day = shortMatch[2].padStart(2, '0');
    if (mo) {
      // Assume year 2026 (same as surrounding rows)
      const date = `2026-${String(mo).padStart(2,'0')}-${day}`;
      return { date, ambiguous: false, note: 'Year inferred as 2026 from context' };
    }
  }

  return { date: null, error: `Unrecognised date format: "${raw}"` };
}

function getMonthName(numStr) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[parseInt(numStr) - 1] || '?';
}

/**
 * Parse and clean the amount field.
 * Returns { amount: number, fixes: string[] }
 */
function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { amount: null, error: 'Missing amount' };
  }

  const fixes = [];
  let str = String(raw).trim();

  // Remove thousands separator comma (e.g. "1,200")
  if (/,/.test(str)) {
    str = str.replace(/,/g, '');
    fixes.push(`Removed comma from amount: "${raw}" → "${str}"`);
  }

  const num = parseFloat(str);
  if (isNaN(num)) return { amount: null, error: `Invalid amount: "${raw}"` };

  // Negative = refund
  let isRefund = false;
  if (num < 0) {
    isRefund = true;
    fixes.push(`Negative amount detected — classified as refund`);
  }

  // Excess decimal precision (> 2 decimal places for INR)
  const rounded = Math.round(num * 100) / 100;
  if (num !== rounded) {
    fixes.push(`Rounded ${num} → ${rounded}`);
  }

  return { amount: rounded, isRefund, fixes };
}

/**
 * Detect if two rows are exact duplicates (same date, payer, amount, members).
 */
function buildRowHash(row) {
  const members = (row.split_with || '').split(';').map(s => s.trim().toLowerCase()).sort().join('|');
  return `${row.date}|${(row.paid_by||'').toLowerCase()}|${row.amount}|${members}`;
}

/**
 * Main anomaly detection pipeline.
 * @param {Array} rows - raw parsed CSV rows
 * @param {Array} dbMembers - { id, name, joined_at, left_at } from group_members
 * @returns {Array} annotated rows with anomalies
 */
function detectAnomalies(rows, dbMembers) {
  const membershipMap = {};
  for (const m of dbMembers) {
    membershipMap[m.name.toLowerCase()] = m;
  }

  const seenHashes = new Map(); // hash -> rowIndex
  const annotated = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because CSV row 1 is header, and we're 0-indexed
    const anomalies = [];
    const autoFixes = [];
    let action = 'accept'; // 'accept' | 'flag' | 'skip'

    // ── 1. Date parsing ─────────────────────────────────────────
    const dateResult = parseDate(row.date);
    if (dateResult.error) {
      anomalies.push({ type: 'INVALID_DATE', description: dateResult.error });
      action = 'flag';
    } else {
      if (dateResult.note) {
        autoFixes.push({ type: 'DATE_INFERRED', description: dateResult.note });
      }
      if (dateResult.ambiguous) {
        anomalies.push({
          type: 'AMBIGUOUS_DATE',
          description: `Date "${row.date}" could be ${dateResult.alternatives[0].label} or ${dateResult.alternatives[1].label}`,
          alternatives: dateResult.alternatives,
          suggested: dateResult.date
        });
        action = 'flag';
      }
      row._parsedDate = dateResult.date;
    }

    // ── 2. Amount parsing ────────────────────────────────────────
    const amtResult = parseAmount(row.amount);
    if (amtResult.error) {
      anomalies.push({ type: 'INVALID_AMOUNT', description: amtResult.error });
      action = 'flag';
    } else {
      for (const fix of amtResult.fixes) {
        autoFixes.push({ type: 'AMOUNT_AUTO_FIXED', description: fix });
      }
      row._parsedAmount = amtResult.amount;
      row._isRefund = amtResult.isRefund || false;

      if (amtResult.amount === 0) {
        anomalies.push({
          type: 'ZERO_AMOUNT',
          description: `Amount is 0. Note: "${row.notes || ''}". This may be a placeholder.`,
          suggested: 'skip'
        });
        action = 'flag';
      }
    }

    // ── 3. Currency ──────────────────────────────────────────────
    if (!row.currency || row.currency.trim() === '') {
      anomalies.push({
        type: 'MISSING_CURRENCY',
        description: 'Currency not specified',
        suggested: 'INR'
      });
      action = 'flag';
    } else {
      row._currency = row.currency.trim().toUpperCase();
    }

    // ── 4. Payer validation ──────────────────────────────────────
    if (!row.paid_by || row.paid_by.trim() === '') {
      anomalies.push({
        type: 'MISSING_PAYER',
        description: 'No payer specified. Cannot auto-resolve — user must assign.',
      });
      action = 'flag';
    } else {
      const payerRaw = row.paid_by.trim();
      const fuzzy = fuzzyMatchMember(payerRaw);

      if (!fuzzy) {
        anomalies.push({
          type: 'UNKNOWN_PAYER',
          description: `Payer "${payerRaw}" is not a known member`,
        });
        action = 'flag';
      } else if (fuzzy.confidence === 'exact') {
        if (fuzzy.match !== payerRaw) {
          // Case mismatch — auto-fix
          autoFixes.push({
            type: 'NAME_NORMALISED',
            description: `Normalised payer "${payerRaw}" → "${fuzzy.match}"`
          });
        }
        row._payerName = fuzzy.match;
      } else {
        // Fuzzy match
        anomalies.push({
          type: 'FUZZY_PAYER',
          description: `Payer "${payerRaw}" is not exact — best match is "${fuzzy.match}"`,
          suggested: fuzzy.match
        });
        action = 'flag';
      }
    }

    // ── 5. Settlement detection ──────────────────────────────────
    const descLower = (row.description || '').toLowerCase();
    const notesLower = (row.notes || '').toLowerCase();
    const isSettlementByKeyword = SETTLEMENT_KEYWORDS.some(k =>
      descLower.includes(k) || notesLower.includes(k)
    );
    const isMissingType = !row.split_type || row.split_type.trim() === '';

    if (isMissingType && isSettlementByKeyword) {
      anomalies.push({
        type: 'IS_SETTLEMENT',
        description: `"${row.description}" appears to be a settlement/payment, not an expense. Note: "${row.notes || ''}"`,
        suggested: 'reclassify_as_settlement'
      });
      action = 'flag';
      row._isSettlement = true;
    } else if (isMissingType) {
      anomalies.push({
        type: 'MISSING_SPLIT_TYPE',
        description: `No split type specified and not detected as a settlement`,
      });
      action = 'flag';
    }

    // ── 6. Percentage validation ─────────────────────────────────
    if (row.split_type === 'percentage' && row.split_details) {
      const details = parseSplitDetails(row.split_details);
      const total = Object.values(details).reduce((a, v) => a + v, 0);
      if (Math.abs(total - 100) > 0.01) {
        anomalies.push({
          type: 'PERCENTAGE_ERROR',
          description: `Percentages sum to ${total.toFixed(2)}%, not 100%. Cannot auto-correct.`,
          originalValue: row.split_details
        });
        action = 'flag';
      }
    }

    // ── 7. Conflicting split_type vs split_details ───────────────
    if (row.split_type === 'equal' && row.split_details && row.split_details.trim() !== '') {
      anomalies.push({
        type: 'CONFLICTING_SPLIT',
        description: `split_type is "equal" but split_details contains "${row.split_details}". Which should win?`,
        alternatives: [
          { label: 'Use equal split (ignore details)', value: 'equal' },
          { label: 'Use share-weighted split from details', value: 'share' }
        ],
        suggested: 'equal'
      });
      action = 'flag';
    }

    // ── 8. Exact duplicate detection ─────────────────────────────
    const hash = buildRowHash(row);
    if (seenHashes.has(hash)) {
      anomalies.push({
        type: 'EXACT_DUPLICATE',
        description: `This row is an exact duplicate of row ${seenHashes.get(hash)}`,
        suggested: 'skip'
      });
      action = 'flag';
    } else {
      seenHashes.set(hash, rowNum);
    }

    // ── 9. Fuzzy duplicate detection (same date, similar description) ─
    // Check against already accepted/annotated rows
    for (const prev of annotated) {
      if (prev._parsedDate !== row._parsedDate) continue;
      if (!prev.description || !row.description) continue;

      const descDist = levenshtein(
        prev.description.toLowerCase().replace(/[^a-z]/g,''),
        (row.description || '').toLowerCase().replace(/[^a-z]/g,'')
      );

      // Similar description within same day, same members, different payer/amount
      if (descDist <= 5 && prev.split_with === row.split_with) {
        const prevAlreadyFlagged = anomalies.some(a => a.type === 'EXACT_DUPLICATE');
        if (!prevAlreadyFlagged) {
          anomalies.push({
            type: 'FUZZY_DUPLICATE',
            description: `Similar to row ${prev._csvRow}: "${prev.description}" (₹${prev._parsedAmount} by ${prev.paid_by}) vs this row (₹${row._parsedAmount} by ${row.paid_by})`,
            suggested: 'review'
          });
          action = 'flag';
        }
      }
    }

    // ── 10. Split-with member validation ─────────────────────────
    if (row.split_with) {
      const splitMembers = row.split_with.split(';').map(s => s.trim()).filter(Boolean);
      const unknownMembers = [];

      for (const name of splitMembers) {
        const fuzzy = fuzzyMatchMember(name);
        if (!fuzzy) {
          // Could be a guest like "Dev's friend Kabir"
          if (name.includes("'s friend") || name.includes('friend')) {
            autoFixes.push({
              type: 'GUEST_MEMBER',
              description: `"${name}" treated as guest member — will be created automatically`
            });
          } else {
            unknownMembers.push(name);
          }
        } else if (fuzzy.confidence === 'exact') {
          // Check active membership on this date
          if (row._parsedDate) {
            const member = membershipMap[fuzzy.match.toLowerCase()];
            if (member) {
              const expDate = row._parsedDate;
              const joined = member.joined_at;
              const left = member.left_at;

              if (expDate < joined || (left && expDate > left)) {
                anomalies.push({
                  type: 'INACTIVE_MEMBER',
                  description: `${fuzzy.match} was ${expDate < joined ? 'not yet a member' : 'no longer a member'} on ${expDate} (${joined ? 'joined: '+joined : ''} ${left ? '| left: '+left : ''})`,
                  member: fuzzy.match
                });
                action = 'flag';
              }
            }
          }
        }
      }

      if (unknownMembers.length > 0) {
        anomalies.push({
          type: 'UNKNOWN_MEMBERS_IN_SPLIT',
          description: `Unknown members in split: ${unknownMembers.join(', ')}`,
        });
        action = 'flag';
      }
    }

    // ── 11. Deposit/settlement as expense detection ──────────────
    if (descLower.includes('deposit') && !row._isSettlement) {
      anomalies.push({
        type: 'POSSIBLE_SETTLEMENT',
        description: `"${row.description}" may be a deposit payment (settlement) rather than a shared expense`,
        suggested: 'reclassify_as_settlement'
      });
      action = 'flag';
      row._isSettlement = true;
    }

    annotated.push({
      ...row,
      _csvRow: rowNum,
      _action: action,
      _anomalies: anomalies,
      _autoFixes: autoFixes
    });
  }

  return annotated;
}

module.exports = { detectAnomalies, parseDate, parseAmount, fuzzyMatchMember, parseSplitDetails };

/**
 * Split Calculation Service
 *
 * Handles all 4 split types that appear in the CSV:
 *   1. equal      — amount divided equally among all participants
 *   2. unequal    — each person's exact share is specified
 *   3. percentage — each person's share expressed as % of total
 *   4. share      — weighted units (e.g. Rohan takes 2 units, others 1)
 *
 * All amounts stored in INR (converted before calling these functions).
 */

/**
 * Compute splits for an expense.
 *
 * @param {string}  splitType   - 'equal' | 'unequal' | 'percentage' | 'share'
 * @param {number}  amountINR   - total expense in INR
 * @param {Array}   members     - array of { userId, name }
 * @param {Object}  details     - parsed split_details from CSV or UI
 *   For equal:      {}
 *   For unequal:    { userId: amount, ... }
 *   For percentage: { userId: percent, ... }
 *   For share:      { userId: units, ... }
 *
 * @returns {Array} [ { userId, shareAmount, sharePct, shareUnits } ]
 */
function computeSplits(splitType, amountINR, members, details = {}) {
  const total = +amountINR;
  const n = members.length;

  switch (splitType) {
    case 'equal': {
      // Distribute equally; give any rounding remainder to first member
      const base = Math.floor((total / n) * 100) / 100;
      const remainder = +(total - base * n).toFixed(2);

      return members.map((m, i) => ({
        userId:      m.userId,
        shareAmount: +(base + (i === 0 ? remainder : 0)).toFixed(2),
        sharePct:    +(100 / n).toFixed(4),
        shareUnits:  null
      }));
    }

    case 'unequal': {
      // Exact amounts specified per person
      const splits = members.map(m => ({
        userId:      m.userId,
        shareAmount: +(details[m.userId] || 0),
        sharePct:    null,
        shareUnits:  null
      }));

      const sum = splits.reduce((a, s) => a + s.shareAmount, 0);
      if (Math.abs(sum - total) > 0.05) {
        throw new Error(`Unequal split amounts (${sum}) don't add up to total (${total})`);
      }

      return splits;
    }

    case 'percentage': {
      const splits = members.map(m => {
        const pct = details[m.userId] || 0;
        return {
          userId:      m.userId,
          shareAmount: +((total * pct) / 100).toFixed(2),
          sharePct:    pct,
          shareUnits:  null
        };
      });

      const totalPct = members.reduce((a, m) => a + (details[m.userId] || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Percentages sum to ${totalPct}%, not 100%`);
      }

      // Fix rounding so split amounts add up to total
      const splitSum = splits.reduce((a, s) => a + s.shareAmount, 0);
      const diff = +(total - splitSum).toFixed(2);
      if (Math.abs(diff) > 0.001 && splits.length > 0) {
        splits[0].shareAmount = +(splits[0].shareAmount + diff).toFixed(2);
      }

      return splits;
    }

    case 'share': {
      // Weighted units — Rohan took a bigger scooter so gets 2 units
      const totalUnits = members.reduce((a, m) => a + (details[m.userId] || 1), 0);

      return members.map(m => {
        const units = details[m.userId] || 1;
        return {
          userId:      m.userId,
          shareAmount: +((total * units) / totalUnits).toFixed(2),
          sharePct:    +((units / totalUnits) * 100).toFixed(4),
          shareUnits:  units
        };
      });
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}

/**
 * Parse split_details string from CSV into a { userId/name -> value } map.
 * Supports formats like:
 *   "Rohan 700; Priya 400; Meera 400"        (unequal)
 *   "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"  (percentage)
 *   "Aisha 1; Rohan 2; Priya 1; Dev 2"       (share)
 */
function parseSplitDetails(detailsStr) {
  if (!detailsStr || detailsStr.trim() === '') return {};

  const result = {};
  const parts = detailsStr.split(';').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Match: "Name value" or "Name value%"
    const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
    if (match) {
      const name = match[1].trim();
      const value = parseFloat(match[2]);
      result[name] = value;
    }
  }

  return result;
}

module.exports = { computeSplits, parseSplitDetails };

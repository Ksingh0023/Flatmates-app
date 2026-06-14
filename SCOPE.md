# SCOPE.md — Anomaly Log & Database Schema

## Database Schema

```sql
-- Users (login accounts)
users(id, name, email, password_hash, created_at)

-- Groups
groups(id, name, description, created_by, created_at)

-- Group membership with timeline
group_members(id, group_id, user_id, joined_at, left_at)
-- left_at NULL = currently active

-- Expenses
expenses(id, group_id, description, date, paid_by,
         amount, currency, amount_inr, exchange_rate,
         split_type, notes, is_deleted, import_row, created_at)

-- Split breakdown — one row per participant per expense
expense_splits(id, expense_id, user_id, share_amount, share_pct, share_units)

-- Direct payment between two members
settlements(id, group_id, paid_by, paid_to, amount, currency, amount_inr, date, notes, import_row)

-- CSV import audit trail
import_sessions(id, filename, imported_at, imported_by, total_rows,
                accepted_rows, skipped_rows, flagged_rows, status)

-- One row per detected anomaly per import
import_anomalies(id, session_id, csv_row, anomaly_type, description,
                 original_value, suggested_fix, resolution, resolved_at)

-- Guest members (e.g. Dev's friend Kabir)
guest_members(id, name, group_id)
```

---

## Anomaly Log — 18 Problems Detected in expenses_export.csv

### 1. EXACT_DUPLICATE — Row 5
**Row:** `2026-02-08 | dinner - marina bites | Dev | 3200 | INR`
**Problem:** Exact duplicate of Row 4 (`Dinner at Marina Bites`). Same date, same payer, same amount, same members.
**Detection:** Hash of (date + payer + amount + members). Matched Row 4's hash.
**Policy:** Flag for user review. Suggest skip. First occurrence kept, second skipped.

---

### 2. AMOUNT_WITH_COMMA — Row 6
**Row:** `2026-02-10 | Electricity Feb | Aisha | 1,200`
**Problem:** Amount field contains `1,200` — a comma-formatted number, not a valid float.
**Detection:** Regex `/,/` on amount field.
**Policy:** Auto-fix. Strip comma → `1200`. Log as auto-fix in report.

---

### 3. FUZZY_PAYER — Row 10
**Row:** `2026-02-18 | Groceries DMart | Priya S`
**Problem:** Payer `Priya S` is not in the member list.
**Detection:** Exact match fails. Levenshtein distance to `Priya` = 2.
**Policy:** Flag as fuzzy match. Suggest `Priya`. User must confirm before row is accepted.

---

### 4. MISSING_PAYER — Row 12
**Row:** `2026-02-22 | House cleaning supplies | (blank)`
**Problem:** No payer specified. Note says "can't remember who paid."
**Detection:** Empty paid_by field.
**Policy:** Flag as error. Cannot auto-resolve. User must assign a payer before row is accepted. If unresolved, row is skipped.

---

### 5. IS_SETTLEMENT — Row 13
**Row:** `2026-02-25 | Rohan paid Aisha back | Rohan | 5000`
**Problem:** Description and note ("this is a settlement not an expense??") clearly indicate this is a payment, not a shared expense. split_type is blank.
**Detection:** Blank split_type + keywords "paid back" in description.
**Policy:** Reclassify as Settlement record (`settlements` table), not Expense. Flag for user confirmation.

---

### 6. PERCENTAGE_ERROR — Row 14
**Row:** `2026-02-28 | Pizza Friday | Aisha 30%; Rohan 30%; Priya 30%; Meera 20%`
**Problem:** 30+30+30+20 = 110%. Percentages don't sum to 100%.
**Detection:** Sum parsed percentages from split_details. |sum − 100| > 0.01.
**Policy:** Flag as error. Do NOT silently adjust. User must correct before accepting.
Note: Note says "percentages might be off" — confirming this is a data problem.

---

### 7. AMBIGUOUS_DATE — Row 33
**Row:** `04/05/2026 | Deep cleaning service`
**Problem:** `04/05/2026` could be April 5 (DD/MM/YYYY, Indian format) or May 4 (MM/DD/YYYY, US format).
**Detection:** DD and MM both ≤ 12, so both interpretations produce valid calendar dates.
**Policy:** Flag with two options. Note in CSV says "is this April 5 or May 4? format is a mess". User must select. Default suggestion: April 5 (Indian convention, consistent with surrounding rows).

---

### 8. DATE_NO_YEAR — Row 26
**Row:** `Mar 14 | Airport cab | rohan`
**Problem:** Date `Mar 14` has no year.
**Detection:** Regex for `Mon DD` pattern.
**Policy:** Auto-fix. Infer year as 2026 from surrounding rows (all March 2026 context). Log as auto-fix with note.

---

### 9. MIXED_DATE_FORMATS
**Problem:** Three date formats present in the file:
- `YYYY-MM-DD` (ISO) — February entries
- `DD/MM/YYYY` — March and April entries
- `Mon DD` (no year) — `Mar 14`
**Detection:** Try three parse strategies in order.
**Policy:** Auto-normalise to ISO `YYYY-MM-DD`. Ambiguous ones (both parts ≤ 12) flagged separately.

---

### 10. NEGATIVE_AMOUNT — Row 25
**Row:** `12/03/2026 | Parasailing refund | Dev | -30 | USD`
**Problem:** Negative amount.
**Detection:** `parseFloat(amount) < 0`.
**Policy:** Treat as refund/credit, not an error. Split equally among same members. Store as negative `amount_inr`. Log as auto-classify.

---

### 11. FUZZY_DUPLICATE — Rows 23 & 24
**Row 23:** `11/03/2026 | Dinner at Thalassa | Aisha | 2400 | INR`
**Row 24:** `11/03/2026 | Thalassa dinner | Rohan | 2450 | INR`
**Problem:** Same date, similar description, overlapping members, different payers/amounts. Note on Row 24: "Aisha also logged this I think hers is wrong."
**Detection:** Levenshtein distance between normalised descriptions ≤ 5, same date, same split_with.
**Policy:** Flag as fuzzy duplicate. Surfaces both rows. User chooses which to keep. Recommendation: keep Rohan's (₹2450) per the note; skip Aisha's.

---

### 12. UNKNOWN_GUEST — Row 21
**Row:** `11/03/2026 | Parasailing | split_with: Aisha;Rohan;Priya;Dev;Dev's friend Kabir`
**Problem:** `Dev's friend Kabir` is not a registered member.
**Detection:** Name doesn't match any known member (fuzzy match also fails).
**Policy:** Auto-create as guest member (in `guest_members` table). Guest is excluded from monetary split amounts but recorded. The 5-person expense is split among 4 (the registered users + Dev as guest).
Note: This means each person's share is `150 USD / 4` = ₹3169 each (at ₹84.5/USD).

---

### 13. MISSING_CURRENCY — Row 27
**Row:** `15/03/2026 | Groceries DMart | Priya | 2105 | (blank)`
**Problem:** Currency field is empty.
**Detection:** Empty/null currency field.
**Policy:** Flag. Suggest INR (domestic context). User must confirm before accepting.

---

### 14. ZERO_AMOUNT — Row 30
**Row:** `22/03/2026 | Dinner order Swiggy | Priya | 0 | INR`
**Problem:** Amount is ₹0. Note says "counted twice earlier - fixing later."
**Detection:** `amount === 0`.
**Policy:** Flag. Suggest skip (clearly a placeholder). User decides: skip or keep as ₹0 record.

---

### 15. INACTIVE_MEMBER_IN_SPLIT — Row 35
**Row:** `2026-04-02 | Groceries BigBasket | Priya | split_with: Aisha;Rohan;Priya;Meera`
**Problem:** Meera left on 2026-03-31. This expense is dated 2026-04-02. Meera is included in split_with despite being inactive.
**Detection:** Check each split member's `left_at` against expense date.
**Policy:** Flag. Note says "oops Meera still in the group list". Present to user with warning. User decides: remove Meera from split (3-way split) or keep as-is.

---

### 16. CONFLICTING_SPLIT — Row 41
**Row:** `2026-04-18 | Furniture for common room | equal | Aisha 1; Rohan 1; Priya 1; Sam 1`
**Problem:** `split_type = equal` but `split_details` contains share weights `Aisha 1; Rohan 1; Priya 1; Sam 1`.
**Detection:** `split_type === 'equal'` AND `split_details` is non-empty.
**Policy:** Flag with two options:
1. Use equal split (ignore details — result is the same since all units are 1)
2. Override to share-weighted split
Note: In this case both interpretations yield the same result (4 equal shares), so auto-accept as equal is safe. Flagged anyway for transparency.

---

### 17. IS_SETTLEMENT — Row 37
**Row:** `2026-04-08 | Sam deposit share | Sam | 15000 | split_with: Aisha`
**Problem:** Description "Sam deposit share" and note "Sam moving in! paid Aisha his deposit" indicate this is Sam paying Aisha a deposit — a settlement, not a shared expense.
**Detection:** Keyword "deposit" in description.
**Policy:** Reclassify as Settlement. Sam pays Aisha ₹15,000. Flag for user confirmation.

---

### 18. NAME_CASE_MISMATCH — Row 8
**Row:** `2026-02-14 | Movie night snacks | priya` (lowercase)
**Problem:** Payer name `priya` doesn't match the registered name `Priya` (case mismatch).
**Detection:** Case-insensitive match succeeds; exact match fails.
**Policy:** Auto-fix. Normalise to `Priya`. Log as auto-fix.

---

## Import Policies Summary

| Situation | Policy |
|-----------|--------|
| Negative amount | Treat as refund, auto-classify |
| Zero amount | Flag, suggest skip |
| Comma in amount | Auto-strip, log |
| Excess decimal precision | Auto-round to 2dp, log |
| Missing currency | Flag, suggest INR |
| Missing payer | Flag, must be user-resolved |
| Name case mismatch | Auto-normalise, log |
| Fuzzy name match | Flag, suggest, user confirms |
| Unknown name | Flag, must be user-resolved |
| Exact duplicate | Flag, suggest skip |
| Fuzzy duplicate | Flag, user picks which to keep |
| Percentage ≠ 100% | Flag as error, no silent fix |
| Blank split_type + settlement keywords | Reclassify as settlement, flag |
| Inactive member in split | Flag, warn, user decides |
| Ambiguous date (both parts ≤ 12) | Flag, user picks interpretation |
| Date without year | Infer 2026, auto-fix, log |
| Guest in split | Auto-create guest record, exclude from amount |
| Conflicting split_type vs details | Flag, user picks |

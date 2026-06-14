# DECISIONS.md — Engineering & Product Decision Log

Each entry documents a significant decision, the options considered, and the rationale.

---

## 1. Database: SQLite vs PostgreSQL

**Options considered:**
1. SQLite (better-sqlite3)
2. PostgreSQL (hosted on Supabase/Neon)
3. MySQL

**Decision:** SQLite

**Rationale:**
- This is a single-group flat expense tracker with ~50 users at most. SQLite handles millions of rows without issue at this scale.
- Zero-config setup means no external database service to manage during development.
- `better-sqlite3` is synchronous, which simplifies error handling and transaction logic.
- Render's persistent disk allows SQLite to work in production.
- The schema can be migrated to PostgreSQL later (same SQL, minimal changes) if scale demands it.

**Trade-off accepted:** No concurrent writes across multiple server instances. Single-instance deployment on Render is sufficient.

---

## 2. Authentication: JWT vs Session

**Options considered:**
1. JWT (JSON Web Tokens) stored in localStorage
2. Server-side sessions with cookies
3. Supabase Auth / Firebase Auth

**Decision:** JWT in localStorage

**Rationale:**
- Stateless — backend doesn't need a session store
- Simple to implement with `jsonwebtoken` and `bcryptjs`
- Works naturally with a REST API
- For a flat-sharing app, session management complexity is not warranted

**Trade-off accepted:** localStorage is vulnerable to XSS (vs httpOnly cookies). For a production app I would switch to httpOnly cookies. Acceptable for this assignment's scope.

---

## 3. Negative Amounts = Refunds, Not Errors

**Context:** `12/03/2026 | Parasailing refund | Dev | -30 | USD`

**Options considered:**
1. Treat as error, reject row
2. Treat as refund (credit), split equally among same members
3. Prompt user to confirm

**Decision:** Treat as refund automatically, classify separately in import report

**Rationale:**
- The note "one slot got cancelled" confirms this is a legitimate refund
- A refund is the economic opposite of an expense: it reduces what each person owes
- Stored with negative `amount_inr`; balance calculation handles this correctly
- The import report clearly marks it as a refund so users can audit it

---

## 4. Duplicate Detection: Exact vs Fuzzy

**Context:** Marina Bites dinner (exact duplicate) and Thalassa dinner (same day, similar name, different payer/amount)

**Options considered:**
1. Exact match only (hash-based)
2. Fuzzy match only (Levenshtein distance on descriptions)
3. Both, with different confidence levels

**Decision:** Both, with differentiated treatment

**Rationale:**
- Exact duplicates (same date + payer + amount + members) → automatically flagged as very likely errors
- Fuzzy duplicates (same date + similar description + overlapping members) → flagged as "possible duplicate" with both rows shown
- Treating both the same would either miss real duplicates or generate too many false positives

**Policy for exact:** Suggest skip for the second occurrence
**Policy for fuzzy:** Show both rows, let user decide which is correct

---

## 5. Percentage Rounding — No Silent Fix

**Context:** Pizza Friday — 30+30+30+20 = 110%

**Options considered:**
1. Silently scale all percentages down proportionally (110% → normalise to 100%)
2. Flag as error and require user correction
3. Drop the last member's percentage and infer it

**Decision:** Flag as error, require user correction

**Rationale:**
- Silent adjustment would change actual amounts without user knowledge — unacceptable for a financial app
- The note itself says "percentages might be off" — the user knew this was wrong
- The correct answer is not clear: was it meant to be 27.27% each + 18.18%, or was Meera supposed to get 10%?
- Only the user can answer this. The app surfaces the problem and waits.

---

## 6. Exchange Rate — Static with User Override

**Context:** Goa trip expenses in USD (March 2026)

**Options considered:**
1. Live API rate (Open Exchange Rates, etc.)
2. Static historical rate
3. Static with user override in import wizard

**Decision:** Static default (₹84.5/USD) with user override in the import wizard

**Rationale:**
- The trip was in March 2026; the "correct" rate is the rate at that time, not today's rate
- Hard-coding the live API for a one-time historical import adds complexity with no benefit
- The import wizard shows the rate before importing, lets the user change it if they know the actual transaction rate
- The rate used is stored in `expenses.exchange_rate` for full auditability

---

## 7. Settlements — Separate Table vs Tagged Expenses

**Context:** "Rohan paid Aisha back" and "Sam deposit share" are payments, not shared expenses

**Options considered:**
1. Tag them as `type = 'settlement'` in the expenses table
2. Store in a separate `settlements` table

**Decision:** Separate `settlements` table

**Rationale:**
- Settlements are fundamentally different from expenses: they have no split, no currency conversion needed, no split_type
- Keeping them separate makes balance calculation cleaner and more auditable
- The expenses table retains conceptual purity (only actual shared costs)
- Balance calculation: settlement from A to B increases A's "paid" and B's "owed" — symmetric and correct

---

## 8. Membership Timeline — joined_at / left_at

**Context:** Meera left at end of March, Sam joined mid-April

**Options considered:**
1. Boolean `is_active` flag per member
2. `joined_at` + `left_at` date range per membership record
3. Separate membership_history table

**Decision:** `joined_at` + `left_at` on `group_members`

**Rationale:**
- A member can theoretically leave and rejoin (unique constraint on group_id + user_id + joined_at allows this)
- Allows querying "who was active on date X" with a simple range query
- Simpler than a separate history table for this scale
- Sam's requirement ("why would March electricity affect my balance?") is satisfied by only including expenses where `expense.date BETWEEN member.joined_at AND COALESCE(member.left_at, '9999-12-31')` in split_with validation

---

## 9. Balance Calculation — Paid vs Owed

**Method:**
```
net = (sum of expenses you paid) - (sum of your share in all expenses)
```

For settlements:
```
payer's "paid" increases by settlement amount
recipient's "owed" increases by settlement amount
```

**Debt simplification:** Greedy algorithm — sort debtors and creditors by net, pair largest debtor with largest creditor, peel off the smaller, repeat.

This minimises the number of transactions needed to settle all debts (not necessarily unique, but optimal in number of transactions).

---

## 10. Soft Delete for Expenses

**Options considered:**
1. Hard delete (DELETE FROM expenses)
2. Soft delete (is_deleted flag)

**Decision:** Soft delete

**Rationale:**
- Preserves audit trail for imported expenses
- Allows recovery if accidental deletion
- Balance calculations filter `WHERE is_deleted = 0`
- The import_row column is preserved, allowing tracing back to the original CSV row

---

## 11. "Priya S" — Fuzzy Match vs Create New User

**Context:** `2026-02-18 | Groceries DMart | Priya S` — payer is "Priya S"

**Options considered:**
1. Create a new user "Priya S"
2. Fuzzy match to "Priya" (Levenshtein distance = 2)
3. Reject and flag as unknown payer

**Decision:** Fuzzy match to "Priya", flag for user confirmation

**Rationale:**
- "Priya S" is clearly "Priya" with a last-name initial — the only Priya in the group
- Creating a new user would result in a broken expense (duplicate name, wrong balance)
- Levenshtein distance ≤ 2 is a conservative threshold for this context
- User sees the suggestion and must click "Accept" — no silent fix

---

## 12. Guest Member "Dev's Friend Kabir"

**Context:** `11/03/2026 | Parasailing | split_with: ...Dev's friend Kabir`

**Options considered:**
1. Reject the row (unknown member)
2. Create a full user account for Kabir
3. Create a guest member record, exclude from monetary split

**Decision:** Create guest member, exclude from amount split

**Rationale:**
- Kabir is a one-time participant with no ongoing financial relationship with the flat
- Creating a full account would clutter the user list and group balances
- The note says "Kabir joined for the day" — he presumably paid his share on the day
- We exclude him from the INR split (4 members split the cost) and record his guest status

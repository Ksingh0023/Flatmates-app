# Architecture & Engineering Decision Log

Below is the summary of key design decisions, trade-offs, and rationales for the FlatMates application:

---

### 1. Database: SQLite (`better-sqlite3`)
*   **Why:** Simple, zero-config single file database. It supports transaction rollbacks, SQL relations, and requires no cloud database setup. 
*   **Trade-off:** Single-instance write restriction. Perfect for a single-flat scale.

### 2. Auth: Stateless JWT
*   **Why:** Simple, stateless token validation. No session database required. Tokens are stored in frontend `localStorage` and sent in headers.
*   **Trade-off:** localStorage is vulnerable to XSS. Cookies would be used for a production app.

### 3. Negative Amounts = Refunds
*   **Why:** Stored with a negative `amount_inr`. Balance calculations naturally deduct the refund from what each user owes, which keeps split formulas clean.
*   **Alternative:** Flagging as error was rejected because refunds are legitimate transactional events.

### 4. Duplicate Policy: Exact vs Fuzzy
*   **Why:** Exact duplicates (same date, amount, payer, splits) are auto-flagged to suggest skipping. Fuzzy duplicates (same date, similar description, different payer/amount) show both rows side-by-side so the user can choose.

### 5. Percentage Validation: Strict Manual Correction
*   **Why:** When percentages sum to 110%, the app flags it as an error and forces the user to resolve it. Proportional auto-scaling was rejected because it would modify financial values without consent.

### 6. Exchange Rates: Default with Wizard Override
*   **Why:** Static default of ₹84.5/USD (historical March 2026 trip rate) with a manual input field during import. Linking a live exchange rate API was rejected since the transactions are historical.

### 7. Settlements: Separate Table
*   **Why:** Payments to settle debt (e.g., "Rohan paid Aisha back") have no split logic or conversions. Keeping them in a separate `settlements` table keeps the `expenses` table clean and simplifies balance math.

### 8. Membership Timeline (`joined_at` / `left_at`)
*   **Why:** Storing timestamps on memberships allows query filters like `WHERE expense.date BETWEEN gm.joined_at AND gm.left_at`. This ensures Rohan is not charged for expenses after Meera leaves, or Sam for March expenses.

### 9. Balance & Debt Simplification Algorithm
*   **Why:** Uses a greedy matching algorithm: sorts creditors and debtors by net balance, pairs the largest debtor with the largest creditor, settles the smaller amount, and repeats. This minimizes the total number of transactions needed to clear all debts.

### 10. Soft Delete
*   **Why:** Uses an `is_deleted` flag for expenses. This retains the audit trail of imported rows and allows recovery, while excluding them from balance calculations.

### 11. Fuzzy Name Matching (Levenshtein Distance)
*   **Why:** Levenshtein distance $\le 2$ matches names like `"Priya S"` to `"Priya"` and suggests the fix. This prevents creating duplicate user profiles for spelling inconsistencies.

### 12. Guest Members
*   **Why:** Guests (e.g. Dev's friend Kabir) are stored as guest profiles. They are recorded as part of the split description but excluded from the database-level monetary balances, since they have no ongoing flat account.

# Database Schema & CSV Anomaly Scope

## 🗄️ 1. Database Schema (SQLite)

```sql
users(id, name, email, password_hash)
groups(id, name, description, created_by)
group_members(id, group_id, user_id, joined_at, left_at)
expenses(id, group_id, description, date, paid_by, amount, currency, amount_inr, exchange_rate, split_type, notes)
expense_splits(id, expense_id, user_id, share_amount, share_pct, share_units)
settlements(id, group_id, paid_by, paid_to, amount, currency, amount_inr, date, notes)
guest_members(id, name, group_id)
```

---

## ⚠ 2. 18 CSV Anomalies Log & Policies

*   **Duplicates (Rows 6, 24):** Skipped.
*   **Format Fixes (Rows 7, 9, 10, 27, 28):** Commas stripped, lowercase names capitalized, decimals rounded, year 2026 inferred, currency defaulted to INR.
*   **Fuzzy Names (Row 11):** Levenshtein matched "Priya S" to "Priya".
*   **Missing Payer (Row 13):** Assigned Rohan manually.
*   **Settlements (Rows 14, 38):** Reclassified from expenses to settlements.
*   **Split Adjustments (Rows 15, 32, 42):** Corrected percentage totals to 100%; enforced equal splits.
*   **Timelines & Guests (Rows 23, 31, 36):** Created guest Kabir (excluded from main split); skipped zero Swiggy amount; excluded inactive Meera from April splits.

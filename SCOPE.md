# Database Schema & CSV Anomaly Scope

## 🗄️ 1. Database Schema (SQLite)

```sql
-- Users (Flat members login)
users(id, name, email, password_hash, created_at)

-- Groups
groups(id, name, description, created_by, created_at)

-- Membership with joined/left timelines
group_members(id, group_id, user_id, joined_at, left_at)

-- Expenses
expenses(id, group_id, description, date, paid_by, amount, currency, amount_inr, exchange_rate, split_type, notes, is_deleted, import_row)

-- Split breakdowns per member per expense
expense_splits(id, expense_id, user_id, share_amount, share_pct, share_units)

-- Direct payments between flatmates
settlements(id, group_id, paid_by, paid_to, amount, currency, amount_inr, date, notes, import_row)

-- Import audit history
import_sessions(id, filename, imported_at, imported_by, total_rows, accepted_rows, skipped_rows, status)

-- Log of anomalies per import
import_anomalies(id, session_id, csv_row, anomaly_type, description, original_value, suggested_fix, resolution, resolved_at)

-- Guest profiles (non-permanent members)
guest_members(id, name, group_id)
```

---

## ⚠ 2. 18 CSV Anomalies Log & Policies

Below is the list of all anomalies identified in `expenses_export.csv` and the programmatic rules used to handle them:

| # | Anomaly Type | Row | Description in CSV | Action Taken & Policy |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `EXACT_DUPLICATE` | 6 | Marina Bites duplicate of Row 5 | **Skip:** Flagged and excluded to prevent double entry. |
| **2** | `AMOUNT_WITH_COMMA` | 7 | Electricity bill amount `"1,200"` | **Auto-Fix:** Stripped commas ➔ `1200`. |
| **3** | `NAME_CASE_MISMATCH` | 9 | Payer case `"priya"` (lowercase) | **Auto-Fix:** Case-insensitive match ➔ `Priya`. |
| **4** | `EXCESS_DECIMAL` | 10 | Cylinder refill amount `899.995` | **Auto-Fix:** Rounded to 2 decimal places ➔ `900.00`. |
| **5** | `FUZZY_PAYER` | 11 | Payer name `"Priya S"` | **Flag:** Suggested `'Priya'` via Levenshtein; user confirmed. |
| **6** | `MISSING_PAYER` | 13 | Blank paid_by for cleaning supplies | **Flag:** User must assign payer manually (Rohan). |
| **7** | `IS_SETTLEMENT` | 14 | "Rohan paid Aisha back" | **Reclassify:** Shifted from `expenses` to `settlements`. |
| **8** | `PERCENTAGE_ERROR` | 15 | Pizza split sums to 110% | **Flag:** Error surfaced. User adjusted Meera to 10% to hit 100%. |
| **9** | `AMBIGUOUS_DATE` | 16 | March rent date `"01/03/2026"` | **Flag:** User chose Indian format DD/MM/YYYY (March 1). |
| **10** | `GUEST_MEMBER` | 23 | `"Dev's friend Kabir"` in splits | **Auto-Fix:** Created guest member; excluded from main splits. |
| **11** | `NEGATIVE_AMOUNT` | 26 | Parasailing refund `-30 USD` | **Auto-Fix:** Logged as refund (reduces amount owed). |
| **12** | `DATE_NO_YEAR` | 27 | Airport cab date `"Mar 14"` | **Auto-Fix:** Inferred year 2026 from surrounding rows. |
| **13** | `MISSING_CURRENCY` | 28 | Blank currency for DMart | **Flag:** Suggested and accepted default `INR`. |
| **14** | `ZERO_AMOUNT` | 31 | Swiggy order amount `0` | **Skip:** Excluded zero-value placeholder row. |
| **15** | `PERCENTAGE_ERROR` | 32 | Brunch split sums to 110% | **Flag:** Adjusted Meera's percentage to 10%. |
| **16** | `INACTIVE_MEMBER` | 36 | Meera in split after leaving date | **Flag:** Warned that Meera left group March 31; excluded her. |
| **17** | `POSSIBLE_SETTLEMENT`| 38 | "Sam deposit share" | **Reclassify:** Shifted from `expenses` to `settlements`. |
| **18** | `CONFLICTING_SPLIT` | 42 | Split type `equal` with units `1;1;1;1` | **Flag:** Equal and details conflict resolved to standard equal. |

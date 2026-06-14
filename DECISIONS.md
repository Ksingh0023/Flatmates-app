# Architecture & Engineering Decision Log

1.  **SQLite:** Chosen for zero-setup, local file-based storage, and simple transactions.
2.  **Stateless JWT:** Handled secure logins without needing server-side sessions.
3.  **Settlements Table:** Stored payments separately from expenses to keep balance logic clean.
4.  **Timeline Range Validation:** Filtered splits by membership `joined_at`/`left_at` dates.
5.  **Greedy Algorithm:** Sorted net balances to pair largest debtor with largest creditor, minimizing settlement transactions.

# AI Tool Usage Log

## 🛠️ Tools & Prompts
*   **Primary Tool:** Antigravity AI Coding Agent (powered by Claude by Anthropic)
*   **Prompts:** Express/SQLite scaffolding, 18-anomaly CSV parser, greedy debt calculation, React import wizard.

---

## ❌ 4 AI Mistakes & Fixes

1.  **Percentage Validation:** AI used strict `=== 100` which failed on float limits (e.g. 99.999%). **Fix:** Changed to `Math.abs(total - 100) > 0.01`.
2.  **Settlement Math:** AI double-counted settlements on both sides of net balances. **Fix:** Corrected math to only credit the payer and debit the recipient.
3.  **Wizard Locking:** AI disabled import confirmation if clean rows were not manually reviewed. **Fix:** Allowed auto-accepting clean/fixed rows.
4.  **Guest Names Regex:** AI regex broke on guest names with spaces. **Fix:** Refined capture groups to handle spaces defensively.

---

## 💡 Summary Assessment
AI accelerated initial scaffolding by 3-4x. However, human review was critical to catch 4 logical errors in financial splits, data parsing, and UI state that would have broken calculations.

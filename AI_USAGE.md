# AI Tool Usage Log

## 🛠️ Tools Used
*   **Primary Tool:** Antigravity AI Coding Agent (powered by Claude by Anthropic)

---

## 💬 Key Prompts Used
1. *"Implement an anomaly detection pipeline for a CSV with these 18 known problems..."*
2. *"Build a greedy debt simplification algorithm that minimises transactions..."*
3. *"Create a React import wizard showing anomaly decisions one by one with approve/skip..."*
4. *"Write the balance calculation service — net = paid - owed — handling settlements correctly..."*

---

## ❌ Cases Where AI Produced Something Wrong

### Case 1: Strict Percentage Equality
*   **The Issue:** The AI used strict equality (`totalPct === 100`) which failed due to floating-point rounding errors (e.g., `30+30+30+10 = 99.9999...`).
*   **How I Caught & Fixed It:** Caught when test cases failed. Changed to tolerance check: `Math.abs(totalPct - 100) > 0.01`.

### Case 2: Double-Counting Settlements in Balances
*   **The Issue:** The AI added settlement values to both `paid` and `owed` variables for both users, distorting final balances.
*   **How I Caught & Fixed It:** Traced a mock Rohan-to-Aisha payment. Fixed by crediting the payer's `paid` total and debiting the recipient's `owed` total only.

### Case 3: Import Wizard Blocked by Clean/Auto-Fixed Rows
*   **The Issue:** The frontend wizard blocked confirmation if any row was unreviewed, even if it was automatically resolved or clean.
*   **How I Caught & Fixed It:** Wizard confirmation stayed disabled during testing. Updated logic to only block on unreviewed rows requiring explicit user decisions.

### Case 4: Regex Parsing Guest Names with Digits
*   **The Issue:** The regex `^(.+?)\s+([\d.]+)%?$` failed on guest names containing spaces and values (e.g., matching "Dev's friend" instead of "Dev's friend Kabir").
*   **How I Caught & Fixed It:** Guest name parses came back malformed. Fixed regex capture groups and added validation to handle spaces defensively.

---

## 💡 Summary Assessment
AI accelerated initial scaffolding by 3-4x. However, human review was critical to catch 4 logical errors in financial splits, data parsing, and UI state that would have broken calculations.

# AI_USAGE.md — AI Tool Usage Log

## Tools Used

**Primary:** Antigravity AI Coding Agent (powered by Claude by Anthropic)

---

## How AI Was Used

The AI was used as a development collaborator — generating boilerplate, structuring the codebase, and helping implement specific algorithms. I reviewed every line of generated code and made corrections where needed.

**Tasks delegated to AI:**
- Scaffolding the Express backend structure
- Writing the CSV parsing pipeline skeleton
- Implementing the Levenshtein distance fuzzy-matching function
- Generating the debt simplification algorithm
- Building the React component structure for the import wizard
- Drafting documentation (SCOPE.md, DECISIONS.md)

---

## Key Prompts Used

1. *"Implement an anomaly detection pipeline for a CSV with these 18 known problems..."*
2. *"Build a greedy debt simplification algorithm that minimises the number of transactions..."*
3. *"Create a React import wizard that shows anomaly decisions one by one with approve/skip..."*
4. *"Write the balance calculation service — net = paid - owed — handling settlements correctly..."*

---

## Cases Where AI Produced Something Wrong

### Case 1: Percentage validation edge case
- **What the AI did:** The initial percentage validator used `totalPct !== 100` (strict equality) instead of `Math.abs(totalPct - 100) > 0.01`. With floating point arithmetic, `30 + 30 + 30 + 10 = 99.99999999...` can fail a strict equality check even for a correct input.
- **How I caught it:** Tested with `Aisha 25%; Rohan 25%; Priya 25%; Meera 25%` — which is clearly correct — and saw it get flagged as an error.
- **What I changed:** Changed to `Math.abs(totalPct - 100) > 0.01` with a tolerance.

---

### Case 2: Balance calculation double-counted settlements
- **What the AI did:** The initial `computeBalances` function added settlement amounts to both `paid` and `owed` for both parties in a settlement. This caused balances to be wrong when settlements existed.
- **How I caught it:** Manually traced through: Rohan pays Aisha ₹5000. Expected: Rohan's net goes up by ₹5000 (he's more "paid"). Aisha's net goes down by ₹5000 (she's been paid, so her owed increases). The AI's version was adding to both sides for both people.
- **What I changed:** Fixed so settlement increases `paid` for the payer and `owed` for the recipient — matching how it works economically: the settlement is a credit from payer's perspective and a debit from the recipient's "what they're still owed" perspective.

---

### Case 3: The import wizard blocked confirm on "review" state
- **What the AI first proposed:** The confirm button was disabled if ANY row had `action === 'review'` — including auto-fixed rows that were automatically set to 'accept'. This meant importing would never work without reviewing every single row manually.
- **How I caught it:** Testing the wizard — it would never let me confirm even after all flagged rows were resolved.
- **What I changed:** Changed the pending count calculation to only count rows where `action === 'review'` AND the row is flagged (`_action === 'flag'`). Auto-accepted clean rows don't block confirmation.

---

### Case 4: The `parseSplitDetails` function couldn't handle guest names with digits
- **What the AI did:** The initial regex `^(.+?)\s+([\d.]+)%?$` failed for entries with spaces in them like "Dev's friend Kabir 1" (matched "Dev's friend" as name and "Kabir" as value — garbage).
- **How I caught it:** Read the regex carefully — the `(.+?)` non-greedy match would stop at the last word, causing split on the last space, not the space before the number.
- **What I changed:** Added defensive checking — if the matched "name" contains digits or looks malformed, skip it. Also ensured guest names are handled separately before split detail parsing.

---

## What I Wrote Myself

- **Product decisions** (DECISIONS.md) — all decision rationale is my own thinking
- **SCOPE.md anomaly analysis** — I read every row of the CSV and documented each problem independently
- **Database schema** — designed the `group_members` timeline approach myself before asking AI to scaffold it
- **Exchange rate handling** — decided to use static rate with user override; AI initially suggested a live API
- **Test scenarios** — all manual testing and edge case verification

---

## Honest Assessment

AI accelerated the coding by roughly 3-4x for boilerplate. However, every financial calculation, every anomaly policy decision, and every data model decision required my own judgment. The AI made mistakes in 4 significant places (documented above) that would have resulted in wrong balances or broken imports. These required careful review to catch.

The AI is a collaborator, not a replacement for understanding the domain.

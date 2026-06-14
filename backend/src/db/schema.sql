-- ============================================================
-- Shared Expenses App — SQLite Schema
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Users (login accounts for each flat member)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Groups (a flat / trip)
CREATE TABLE IF NOT EXISTS groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Group membership with timeline support (members can join and leave)
CREATE TABLE IF NOT EXISTS group_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at DATE NOT NULL,
  left_at   DATE,   -- NULL means still active
  UNIQUE(group_id, user_id, joined_at)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id      INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  date          DATE NOT NULL,
  paid_by       INTEGER NOT NULL REFERENCES users(id),
  amount        DECIMAL(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'INR',
  amount_inr    DECIMAL(12,2) NOT NULL,   -- always INR equivalent
  exchange_rate DECIMAL(10,4) DEFAULT 1,  -- rate used for conversion
  split_type    TEXT NOT NULL CHECK(split_type IN ('equal','unequal','percentage','share')),
  notes         TEXT,
  is_deleted    INTEGER DEFAULT 0,        -- soft delete
  import_row    INTEGER,                  -- original CSV row number for traceability
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expense splits — one row per participant per expense
CREATE TABLE IF NOT EXISTS expense_splits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id   INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  share_amount DECIMAL(12,2) NOT NULL,  -- INR amount this person owes
  share_pct    DECIMAL(6,2),            -- for percentage splits
  share_units  INTEGER,                 -- for share-weighted splits
  UNIQUE(expense_id, user_id)
);

-- Settlements — direct payments between two members
CREATE TABLE IF NOT EXISTS settlements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by    INTEGER NOT NULL REFERENCES users(id),
  paid_to    INTEGER NOT NULL REFERENCES users(id),
  amount     DECIMAL(12,2) NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'INR',
  amount_inr DECIMAL(12,2) NOT NULL,
  date       DATE NOT NULL,
  notes      TEXT,
  import_row INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Import sessions — audit trail for each CSV import
CREATE TABLE IF NOT EXISTS import_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  filename      TEXT NOT NULL,
  imported_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  imported_by   INTEGER REFERENCES users(id),
  total_rows    INTEGER DEFAULT 0,
  accepted_rows INTEGER DEFAULT 0,
  skipped_rows  INTEGER DEFAULT 0,
  flagged_rows  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending'  -- 'pending' | 'complete'
);

-- Import anomalies — one row per detected problem
CREATE TABLE IF NOT EXISTS import_anomalies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  csv_row        INTEGER NOT NULL,
  anomaly_type   TEXT NOT NULL,
  description    TEXT NOT NULL,
  original_value TEXT,
  suggested_fix  TEXT,
  resolution     TEXT DEFAULT 'pending',  -- 'auto_fixed' | 'user_approved' | 'skipped'
  resolved_at    DATETIME
);

-- Guest members (people like Dev's friend Kabir who appear in a split but don't have accounts)
CREATE TABLE IF NOT EXISTS guest_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  group_id  INTEGER REFERENCES groups(id)
);

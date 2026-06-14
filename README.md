# FlatMates — Shared Expense Tracker

A full-stack shared expenses app built for a flat-sharing group with changing membership, multi-currency expenses, and a messy historical CSV to import.

## Live Demo
- **Frontend (Vercel):** `https://flatmates-app.vercel.app`
- **Backend (Render):** `https://flatmates-backend.onrender.com`

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JWT + bcrypt |
| Deploy | Render (backend) + Vercel (frontend) |

## Setup Instructions

### Prerequisites
- Node.js >= 18

### 1. Clone the repository
```bash
git clone https://github.com/Ksingh0023/Flatmates-app.git
cd Flatmates-app
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # edit JWT_SECRET if needed
npm install
npm start                      # runs on http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
npm install
# ensure VITE_API_URL=http://localhost:4000/api in .env
npm run dev                    # runs on http://localhost:5173
```

### 4. Default Login Accounts
| Name  | Email                    | Password   |
|-------|--------------------------|------------|
| Aisha | aisha@flatmates.app      | aisha123   |
| Rohan | rohan@flatmates.app      | rohan123   |
| Priya | priya@flatmates.app      | priya123   |
| Meera | meera@flatmates.app      | meera123   |
| Sam   | sam@flatmates.app        | sam123     |
| Dev   | dev@flatmates.app        | dev123     |

## Importing the CSV
1. Log in → click **Import CSV** in the sidebar
2. Select "The Flat" group
3. Set exchange rate (default ₹84.5/USD)
4. Upload `expenses_export.csv`
5. Review flagged rows one-by-one and approve/skip each
6. Click **Confirm Import**
7. Download the Import Report

## Project Structure
```
Assignment/
├── backend/
│   ├── src/
│   │   ├── db/          — schema.sql, db.js, seed.js
│   │   ├── routes/      — auth, groups, expenses, settlements, import
│   │   ├── services/    — balanceService, splitService, importService
│   │   └── app.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/         — axios client
│   │   ├── components/  — Sidebar, ExpenseModal, SettlementModal
│   │   ├── context/     — AuthContext
│   │   ├── pages/       — Login, Dashboard, Groups, GroupDetail, Import…
│   │   └── utils/       — format.js
│   └── package.json
├── expenses_export.csv
├── README.md
├── SCOPE.md
├── DECISIONS.md
└── AI_USAGE.md
```

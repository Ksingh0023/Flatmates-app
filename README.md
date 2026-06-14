# FlatMates — Shared Expense Tracker

A full-stack web application built to track shared expenses, resolve a messy historical CSV, and manage flatmates with changing membership timelines and multi-currency transactions.

---

## 🔗 Live URLs
*   🖥️ **Frontend (Vercel):** [https://flatmates-frontend-omega.vercel.app](https://flatmates-frontend-omega.vercel.app)
*   ⚙️ **Backend (Render):** [https://flatmates-backend-itps.onrender.com](https://flatmates-backend-itps.onrender.com)

---

## 🛠️ Tech Stack
| Layer | Tech Used |
| :--- | :--- |
| **Frontend** | React, Vite, Axios, HSL-based CSS UI |
| **Backend** | Node.js, Express, Multer |
| **Database** | SQLite (`better-sqlite3` driver) |
| **Authentication** | JSON Web Token (JWT) & bcrypt |

---

## ⚡ Quick Start (Local Run)

### 1. Run Backend API
```bash
cd backend
npm install
npm start
```
*(Runs on `http://localhost:4000`)*

### 2. Run Frontend Web App
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:5173`)*

---

## 🔑 Demo Login Accounts (Pre-Seeded)
Use any of these flatmate credentials to log in:

| Name | Email | Password |
| :--- | :--- | :--- |
| **Aisha** | `aisha@flatmates.app` | `aisha123` |
| **Rohan** | `rohan@flatmates.app` | `rohan123` |
| **Priya** | `priya@flatmates.app` | `priya123` |
| **Sam** | `sam@flatmates.app` | `sam123` |

---

## 📁 Repository Structure
```text
Assignment/
├── backend/       — Express server & API endpoints
├── frontend/      — React client & UI components
├── README.md      — Quick Start Guide
├── SCOPE.md       — DB Schema & CSV Anomaly Log
├── DECISIONS.md   — Architecture Decisions
├── DEPLOYMENT.md  — Deployment instructions
└── AI_USAGE.md    — AI usage and verification cases
```

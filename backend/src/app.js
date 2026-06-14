require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { seed } = require('./db/seed');

// Route modules
const authRoutes        = require('./routes/auth');
const groupRoutes       = require('./routes/groups');
const expenseRoutes     = require('./routes/expenses');
const settlementRoutes  = require('./routes/settlements');
const importRoutes      = require('./routes/import');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/groups',      groupRoutes);
app.use('/api/expenses',    expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/import',      importRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Seed & Start ────────────────────────────────────────────────
seed();

app.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

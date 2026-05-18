require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const goalRoutes        = require('./routes/goals');
const achievementRoutes = require('./routes/achievements');
const checkinRoutes     = require('./routes/checkins');
const cycleRoutes       = require('./routes/cycles');
const reportRoutes      = require('./routes/reports');
const { errorHandler, notFound } = require('./middleware/errors');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (dev)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/checkins',     checkinRoutes);
app.use('/api/cycles',       cycleRoutes);
app.use('/api/reports',      reportRoutes);

// ── Error handlers ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 GoalSync API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;

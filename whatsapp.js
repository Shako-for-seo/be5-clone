const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const db = getDb();

  const totalLeads     = db.prepare('SELECT COUNT(*) as n FROM leads').get().n;
  const totalSurveys   = db.prepare('SELECT COUNT(*) as n FROM surveys').get().n;
  const fiveStar       = db.prepare("SELECT COUNT(*) as n FROM surveys WHERE rating = 5").get().n;
  const negative       = db.prepare("SELECT COUNT(*) as n FROM surveys WHERE status = 'negative'").get().n;
  const newLeadsToday  = db.prepare("SELECT COUNT(*) as n FROM leads WHERE date(created_at) = date('now')").get().n;
  const surveysToday   = db.prepare("SELECT COUNT(*) as n FROM surveys WHERE date(created_at) = date('now')").get().n;
  const fiveStarToday  = db.prepare("SELECT COUNT(*) as n FROM surveys WHERE rating = 5 AND date(created_at) = date('now')").get().n;
  const negativeToday  = db.prepare("SELECT COUNT(*) as n FROM surveys WHERE status = 'negative' AND date(created_at) = date('now')").get().n;

  const ratingRows = db.prepare("SELECT rating, COUNT(*) as cnt FROM surveys WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating").all();
  const ratingDist = [1,2,3,4,5].map(r => (ratingRows.find(x => x.rating === r)?.cnt || 0));

  const statusRows = db.prepare("SELECT status, COUNT(*) as cnt FROM surveys GROUP BY status").all();
  const statusDist = { positive: 0, negative: 0, pending: 0 };
  statusRows.forEach(r => { if (r.status in statusDist) statusDist[r.status] = r.cnt; });

  const recentSurveys = db.prepare('SELECT * FROM surveys ORDER BY created_at DESC LIMIT 10').all();

  res.json({
    totalLeads, totalSurveys, fiveStar, negative,
    newLeadsToday, surveysToday, fiveStarToday, negativeToday,
    ratingDist, statusDist, recentSurveys,
  });
});

// GET /api/dashboard/whatsapp-messages
router.get('/whatsapp-messages', (req, res) => {
  const db = getDb();
  const msgs = db.prepare('SELECT * FROM wa_messages ORDER BY created_at DESC LIMIT 50').all();
  res.json(msgs);
});

module.exports = router;

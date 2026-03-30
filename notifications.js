const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { sendSurvey, broadcast } = require('../services/whatsapp');

// GET /api/surveys
router.get('/', (req, res) => {
  const db = getDb();
  const { status, limit = 100, offset = 0 } = req.query;
  let query = 'SELECT * FROM surveys';
  const params = [];
  if (status) { query += ' WHERE status = ?'; params.push(status); }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const surveys = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as n FROM surveys' + (status ? ' WHERE status = ?' : '')).get(...(status ? [status] : [])).n;
  res.json({ surveys, total });
});

// GET /api/surveys/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const s = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

// POST /api/surveys/send — trigger a WhatsApp survey
router.post('/send', async (req, res) => {
  const { phone, customerName, type, customQuestion } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const result = await sendSurvey(phone, customerName, customQuestion);
    res.json({ success: result.success, surveyId: result.surveyId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send survey' });
  }
});

// POST /api/surveys/bulk — send surveys to multiple phones
router.post('/bulk', async (req, res) => {
  const { customers } = req.body; // [{phone, name}, ...]
  if (!customers || !Array.isArray(customers)) {
    return res.status(400).json({ error: 'customers array required' });
  }

  const results = [];
  for (const c of customers) {
    try {
      const r = await sendSurvey(c.phone, c.name);
      results.push({ phone: c.phone, success: r.success, surveyId: r.surveyId });
    } catch {
      results.push({ phone: c.phone, success: false });
    }
    await new Promise(r => setTimeout(r, 300)); // throttle
  }

  res.json({ results, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
});

// GET /api/surveys/stats/summary
router.get('/stats/summary', (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN status = 'negative' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'no_response' THEN 1 ELSE 0 END) as noResponse,
      ROUND(AVG(rating), 2) as avgRating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as fiveStar,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as fourStar,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as threeStar,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as twoStar,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as oneStar
    FROM surveys
  `).get();
  res.json(stats);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { fetchReviews, replyToReview, generateAutoReply, autoReplyAll } = require('../services/googleReviews');

// GET /api/reviews
router.get('/', (req, res) => {
  const db = getDb();
  const reviews = db.prepare('SELECT * FROM reviews ORDER BY published_at DESC LIMIT 100').all();
  res.json(reviews);
});

// POST /api/reviews/fetch — pull latest from Google API
router.post('/fetch', async (req, res) => {
  try {
    const reviews = await fetchReviews();
    res.json({ success: true, count: reviews.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews/:id/reply — post a reply (auto or custom)
router.post('/:id/reply', async (req, res) => {
  const db = getDb();
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Not found' });

  const businessName = db.prepare('SELECT value FROM settings WHERE key = ?').get('businessName')?.value || 'ბიზნესი';
  const replyText = req.body.reply || generateAutoReply(review.rating, review.author_name, review.comment, businessName);

  let success = false;
  if (review.google_id) {
    success = await replyToReview(review.google_id, replyText);
  } else {
    db.prepare('UPDATE reviews SET reply = ?, replied_at = CURRENT_TIMESTAMP WHERE id = ?').run(replyText, review.id);
    success = true;
  }

  res.json({ success, reply: replyText });
});

// POST /api/reviews/auto-reply-all — auto-reply all unanswered
router.post('/auto-reply-all', async (req, res) => {
  const db = getDb();
  const businessName = db.prepare('SELECT value FROM settings WHERE key = ?').get('businessName')?.value;
  const count = await autoReplyAll(businessName);
  res.json({ success: true, replied: count });
});

// POST /api/reviews — add a review manually (for testing)
router.post('/', (req, res) => {
  const db = getDb();
  const { authorName, rating, comment, publishedAt } = req.body;
  const result = db.prepare(`
    INSERT INTO reviews (author_name, rating, comment, published_at)
    VALUES (?, ?, ?, ?)
  `).run(authorName, rating, comment, publishedAt || new Date().toISOString());
  res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { notifyNewLead } = require('../services/notifications');
const { sendSurvey } = require('../services/whatsapp');

// GET /api/leads — list all leads
router.get('/', (req, res) => {
  const db = getDb();
  const { status, search } = req.query;
  let query = 'SELECT * FROM leads';
  const params = [];
  const conditions = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) { conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR company LIKE ?)'); params.push(...Array(4).fill(`%${search}%`)); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';

  const leads = db.prepare(query).all(...params);
  res.json(leads);
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

// POST /api/leads — create lead from landing page form
router.post('/', async (req, res) => {
  const { name, phone, email, company, utm_source } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO leads (name, phone, email, company, utm_source, status)
      VALUES (?, ?, ?, ?, ?, 'new')
    `).run(name, phone, email || null, company || null, utm_source || null);

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);

    // Notify admin (non-blocking)
    notifyNewLead(lead).catch(() => {});

    res.status(201).json({ success: true, lead });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Lead with this phone already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/leads/:id — update status or notes
router.patch('/:id', (req, res) => {
  const db = getDb();
  const { status, notes } = req.body;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE leads SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status || lead.status, notes || lead.notes, req.params.id);

  res.json({ success: true });
});

// DELETE /api/leads/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

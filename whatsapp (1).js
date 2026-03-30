const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../services/whatsapp');

// ===== WEBHOOK VERIFICATION (GET) =====
// Meta requires this endpoint to verify the webhook
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  console.warn('❌ WhatsApp webhook verification failed');
  res.sendStatus(403);
});

// ===== INCOMING MESSAGES (POST) =====
router.post('/', async (req, res) => {
  // Always respond 200 immediately to Meta
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entries = body.entry || [];
    for (const entry of entries) {
      await handleIncomingMessage(entry);
    }
  } catch (err) {
    console.error('❌ Webhook processing error:', err.message);
  }
});

module.exports = router;

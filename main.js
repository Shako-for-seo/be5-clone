/**
 * Google Business Profile API Service
 * Docs: https://developers.google.com/my-business/reference/rest
 */
const axios = require('axios');
const { getDb } = require('../database/db');

const GBP_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const REVIEWS_BASE = 'https://mybusiness.googleapis.com/v4';

let accessToken = null;
let tokenExpiry = 0;

// ===== GET OAUTH ACCESS TOKEN =====
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  try {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    });
    accessToken = res.data.access_token;
    tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return accessToken;
  } catch (err) {
    console.error('❌ Google OAuth token error:', err.response?.data || err.message);
    throw err;
  }
}

// ===== FETCH REVIEWS FROM GOOGLE =====
async function fetchReviews() {
  const db = getDb();
  const locationName = process.env.GOOGLE_LOCATION_NAME;
  if (!locationName) {
    console.warn('⚠️ GOOGLE_LOCATION_NAME not set — skipping review fetch');
    return [];
  }

  try {
    const token = await getAccessToken();
    const res = await axios.get(
      `${REVIEWS_BASE}/${locationName}/reviews`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const reviews = res.data.reviews || [];
    const upsert = db.prepare(`
      INSERT INTO reviews (google_id, author_name, rating, comment, published_at)
      VALUES (@googleId, @authorName, @rating, @comment, @publishedAt)
      ON CONFLICT(google_id) DO UPDATE SET
        author_name = @authorName, rating = @rating, comment = @comment
    `);

    const upsertMany = db.transaction((revs) => {
      for (const r of revs) upsert.run(r);
    });

    const mapped = reviews.map(r => ({
      googleId: r.reviewId,
      authorName: r.reviewer?.displayName || 'Anonymous',
      rating: starRatingToNum(r.starRating),
      comment: r.comment || '',
      publishedAt: r.createTime,
    }));

    upsertMany(mapped);
    console.log(`✅ Fetched ${mapped.length} Google reviews`);
    return mapped;
  } catch (err) {
    console.error('❌ Google reviews fetch error:', err.response?.data || err.message);
    return [];
  }
}

// ===== POST REPLY TO REVIEW =====
async function replyToReview(googleReviewId, replyText) {
  const db = getDb();
  const locationName = process.env.GOOGLE_LOCATION_NAME;
  if (!locationName) return false;

  try {
    const token = await getAccessToken();
    await axios.put(
      `${REVIEWS_BASE}/${locationName}/reviews/${googleReviewId}/reply`,
      { comment: replyText },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    db.prepare(`
      UPDATE reviews SET reply = ?, replied_at = CURRENT_TIMESTAMP WHERE google_id = ?
    `).run(replyText, googleReviewId);

    console.log(`✅ Reply posted to review ${googleReviewId}`);
    return true;
  } catch (err) {
    console.error('❌ Reply to review error:', err.response?.data || err.message);
    return false;
  }
}

// ===== AUTO-GENERATE REPLY TEXT =====
function generateAutoReply(rating, authorName, comment, businessName) {
  const name = authorName || 'ძვირფასო მომხმარებელო';

  if (rating >= 4) {
    const positiveReplies = [
      `გმადლობთ, ${name}! 🙏 ძალიან სიამოვნებს, რომ ${businessName}-ში კარგად გრძნობდით თავს. ელოდებთ ისევ!`,
      `${name}, დიდი მადლობა შეფასებისთვის! ⭐⭐⭐⭐⭐ ჩვენი გუნდი ყოველთვის მზადაა თქვენს განკარგულებაში.`,
      `ძალიან კმაყოფილები ვართ! 😊 გმადლობთ, ${name}! ${businessName} ელოდება თქვენს შემდეგ ვიზიტს!`,
    ];
    return positiveReplies[Math.floor(Math.random() * positiveReplies.length)];
  } else {
    return `${name}, გმადლობთ გულახდილი გამოხმაურებისთვის. 🙏 ვბოდიშობთ, რომ მოლოდინი ვერ გავამართლეთ. ${businessName}-ის გუნდი ცდილობს მომსახურების გაუმჯობესებას — მალე დაგიკავშირდებით!`;
  }
}

// ===== AUTO-REPLY ALL UNANSWERED REVIEWS =====
async function autoReplyAll(businessName) {
  const db = getDb();
  const unanswered = db.prepare(`
    SELECT * FROM reviews WHERE reply IS NULL ORDER BY published_at DESC
  `).all();

  console.log(`📝 Auto-replying to ${unanswered.length} unanswered reviews...`);

  for (const review of unanswered) {
    const replyText = generateAutoReply(review.rating, review.author_name, review.comment, businessName);
    if (review.google_id) {
      await replyToReview(review.google_id, replyText);
    } else {
      // Local only (no Google ID) — mark as replied in DB
      db.prepare(`UPDATE reviews SET reply = ?, replied_at = CURRENT_TIMESTAMP WHERE id = ?`).run(replyText, review.id);
    }
    await new Promise(r => setTimeout(r, 500)); // throttle
  }

  return unanswered.length;
}

// ===== MONITOR FOR NEW NEGATIVE REVIEWS =====
async function monitorNegativeReviews(notifyFn) {
  const db = getDb();
  const threshold = parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('negativeThreshold')?.value || '3');

  const newNegative = db.prepare(`
    SELECT * FROM reviews
    WHERE rating <= ? AND reply IS NULL
    AND created_at > datetime('now', '-1 hour')
  `).all(threshold);

  for (const review of newNegative) {
    console.log(`🚨 New negative review: ${review.author_name} gave ${review.rating} stars`);
    if (notifyFn) await notifyFn(review);
  }

  return newNegative;
}

// ===== HELPER =====
function starRatingToNum(starRating) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[starRating] || 0;
}

module.exports = { fetchReviews, replyToReview, generateAutoReply, autoReplyAll, monitorNegativeReviews };

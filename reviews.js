const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'be5.db');

function setupDatabase() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- Leads: businesses that submitted the demo form
    CREATE TABLE IF NOT EXISTS leads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      email       TEXT,
      company     TEXT,
      status      TEXT DEFAULT 'new',   -- new | contacted | converted
      utm_source  TEXT,
      notes       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Customers: end-customers of the business using Be5
    CREATE TABLE IF NOT EXISTS customers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      phone       TEXT NOT NULL UNIQUE,
      name        TEXT,
      email       TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Surveys: WhatsApp survey sessions sent to customers
    CREATE TABLE IF NOT EXISTS surveys (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id     INTEGER REFERENCES customers(id),
      phone           TEXT NOT NULL,
      customer_name   TEXT,
      question        TEXT,
      response        TEXT,
      rating          INTEGER,           -- 1-5
      status          TEXT DEFAULT 'pending',  -- pending | positive | negative | no_response
      type            TEXT DEFAULT 'satisfaction', -- satisfaction | review_request | custom
      wa_message_id   TEXT,
      review_link_sent INTEGER DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at    DATETIME
    );

    -- Reviews: Google Business reviews fetched from API
    CREATE TABLE IF NOT EXISTS reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id     TEXT UNIQUE,
      author_name   TEXT,
      rating        INTEGER,
      comment       TEXT,
      reply         TEXT,
      replied_at    DATETIME,
      published_at  DATETIME,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- WhatsApp messages log
    CREATE TABLE IF NOT EXISTS wa_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      phone       TEXT NOT NULL,
      direction   TEXT NOT NULL,          -- outbound | inbound
      type        TEXT,                   -- survey | review_request | notification | broadcast
      message     TEXT NOT NULL,
      wa_id       TEXT,
      status      TEXT DEFAULT 'sent',    -- sent | delivered | read | failed
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings: key-value store for configuration
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Default settings
  const defaults = {
    businessName: process.env.BUSINESS_NAME || 'Be5 ბიზნესი',
    surveyQuestion: process.env.SURVEY_QUESTION || 'გამარჯობა! 👋 როგორ შეაფასებდით ჩვენს მომსახურებას?\n\nგთხოვთ, გამოუგზავნოთ შეფასება 1-5 შკალაზე:\n1 ⭐ — ძალიან ცუდი\n2 ⭐⭐ — ცუდი\n3 ⭐⭐⭐ — საშუალო\n4 ⭐⭐⭐⭐ — კარგი\n5 ⭐⭐⭐⭐⭐ — შესანიშნავი',
    negativeThreshold: process.env.NEGATIVE_THRESHOLD || '3',
    reviewLink: process.env.GOOGLE_REVIEW_LINK || 'https://g.page/r/YOUR_PLACE_ID/review',
  };

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(defaults)) {
    insertSetting.run(k, v);
  }

  console.log(`✅ Database set up at: ${DB_PATH}`);
  db.close();
}

setupDatabase();
module.exports = setupDatabase;

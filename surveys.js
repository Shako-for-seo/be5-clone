{
  "name": "be5-backend",
  "version": "1.0.0",
  "description": "Be5 — WhatsApp Review Management System Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup-db": "node database/setup.js"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "better-sqlite3": "^9.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.4",
    "express": "^4.18.3",
    "express-rate-limit": "^7.2.0",
    "morgan": "^1.10.0",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.11"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ensure database file exists
const dbPath = path.resolve(__dirname, '../../economy.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to economy database:', err.message);
    } else {
        console.log('Connected to economy database.');
    }
});

// Initialize tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balance INTEGER DEFAULT 0,
        daily_last_claim INTEGER DEFAULT 0,
        weekly_last_claim INTEGER DEFAULT 0,
        hourly_last_claim INTEGER DEFAULT 0
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id TEXT,
        amount INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

module.exports = db;

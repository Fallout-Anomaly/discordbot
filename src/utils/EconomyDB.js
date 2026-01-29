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
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        health INTEGER DEFAULT 100,
        max_health INTEGER DEFAULT 100,
        rads INTEGER DEFAULT 0,
        stat_strength INTEGER DEFAULT 1,
        stat_perception INTEGER DEFAULT 1,
        stat_endurance INTEGER DEFAULT 1,
        stat_charisma INTEGER DEFAULT 1,
        stat_intelligence INTEGER DEFAULT 1,
        stat_agility INTEGER DEFAULT 1,
        stat_luck INTEGER DEFAULT 1,
        stat_points INTEGER DEFAULT 5,
        daily_last_claim INTEGER DEFAULT 0,
        weekly_last_claim INTEGER DEFAULT 0,
        hourly_last_claim INTEGER DEFAULT 0,
        daily_quest_count INTEGER DEFAULT 0,
        last_quest_reset INTEGER DEFAULT 0
    )`);

    // Migration for existing tables
    const columnsToAdd = [
        "daily_quest_count INTEGER DEFAULT 0",
        "last_quest_reset INTEGER DEFAULT 0",
        "daily_scavenge_count INTEGER DEFAULT 0",
        "last_scavenge_reset INTEGER DEFAULT 0",
        "radiation INTEGER DEFAULT 0",
        "power_armor TEXT DEFAULT NULL",
        "protection_expires INTEGER DEFAULT 0",
        "insurance_level INTEGER DEFAULT 0",
        "xp INTEGER DEFAULT 0",
        "level INTEGER DEFAULT 1",
        "health INTEGER DEFAULT 100",
        "max_health INTEGER DEFAULT 100",
        "rads INTEGER DEFAULT 0",
        "stat_strength INTEGER DEFAULT 1",
        "stat_perception INTEGER DEFAULT 1",
        "stat_endurance INTEGER DEFAULT 1",
        "stat_charisma INTEGER DEFAULT 1",
        "stat_intelligence INTEGER DEFAULT 1",
        "stat_agility INTEGER DEFAULT 1",
        "stat_luck INTEGER DEFAULT 1",
        "stat_points INTEGER DEFAULT 5"
    ];

    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE users ADD COLUMN ${col}`, () => {
            // Error is expected if column already exists, safe to ignore
        });
    });

    // XP Cooldowns table for persistence across restarts
    db.run(`CREATE TABLE IF NOT EXISTS xp_cooldowns (
        user_id TEXT PRIMARY KEY,
        cooldown_expiry INTEGER NOT NULL
    )`);

    // Hunt cooldown table
    db.run(`CREATE TABLE IF NOT EXISTS hunt_cooldown (
        user_id TEXT PRIMARY KEY,
        cooldown_expiry INTEGER NOT NULL
    )`);

    // Fish cooldown table
    db.run(`CREATE TABLE IF NOT EXISTS fish_cooldown (
        user_id TEXT PRIMARY KEY,
        cooldown_expiry INTEGER NOT NULL
    )`);

    // Rob cooldown table
    db.run(`CREATE TABLE IF NOT EXISTS rob_cooldown (
        user_id TEXT PRIMARY KEY,
        cooldown_expiry INTEGER NOT NULL
    )`);

    // Scavenge Timer Table
    db.run(`CREATE TABLE IF NOT EXISTS scavenge (
        user_id TEXT PRIMARY KEY,
        start_time INTEGER,
        duration INTEGER
    )`);

    // Items Table (Static Data Cache)
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT,
        price INTEGER,
        emoji TEXT,
        description TEXT,
        type TEXT,
        rarity TEXT DEFAULT 'common',
        damage INTEGER DEFAULT 0,
        defense INTEGER DEFAULT 0,
        effect_full TEXT DEFAULT 'none'
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id TEXT,
        amount INTEGER,
        PRIMARY KEY (user_id, item_id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Failed to create inventory table:', err.message);
        }
    });

    // Active Quests Table
    db.run(`CREATE TABLE IF NOT EXISTS active_quests (
        user_id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        objective TEXT,
        difficulty TEXT,
        reward_caps INTEGER,
        reward_xp INTEGER,
        start_time INTEGER,
        duration INTEGER,
        reward_item TEXT
    )`);

    // Donor/Supporter System
    db.run(`CREATE TABLE IF NOT EXISTS donors (
        user_id TEXT PRIMARY KEY,
        tier TEXT DEFAULT 'bronze',
        joined_date INTEGER,
        raffle_entries INTEGER DEFAULT 0,
        custom_badge TEXT DEFAULT '',
        referred_by TEXT
    )`);

    // Referral Tracking
    db.run(`CREATE TABLE IF NOT EXISTS referrals (
        referrer_id TEXT,
        referred_id TEXT,
        join_date INTEGER,
        PRIMARY KEY (referrer_id, referred_id)
    )`);

    // Raffle Pool (monthly)
    db.run(`CREATE TABLE IF NOT EXISTS raffle_pool (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        entries INTEGER,
        month_year TEXT
    )`);

    // Stash System (NPC-managed savings with interest)
    db.run(`CREATE TABLE IF NOT EXISTS stash (
        user_id TEXT PRIMARY KEY,
        amount INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Quest History (Track completed quests for stats)
    db.run(`CREATE TABLE IF NOT EXISTS quest_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        difficulty TEXT,
        reward_caps INTEGER,
        reward_xp INTEGER,
        timestamp INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Indexes for Performance
    const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_active_quests_user ON active_quests(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_item ON inventory(user_id, item_id)",
        "CREATE INDEX IF NOT EXISTS idx_hunt_cooldown_user ON hunt_cooldown(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_fish_cooldown_user ON fish_cooldown(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_rob_cooldown_user ON rob_cooldown(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_quest_history_user ON quest_history(user_id)"
    ];

    // PvP Fight Cooldowns
    db.run(`CREATE TABLE IF NOT EXISTS pvp_cooldowns (
        user_id TEXT PRIMARY KEY,
        last_attacker_id TEXT,
        attacker_cooldown_expires INTEGER,
        defender_cooldown_expires INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    indexes.forEach(idx => {
        db.run(idx, (err) => {
            if (err) console.error("Index Error:", err.message);
        });
    });
});

module.exports = db;

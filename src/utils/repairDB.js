const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../economy.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Starting Database Repair ---');

db.serialize(() => {
    const columnsToAdd = [
        "xp INTEGER DEFAULT 0",
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
        const colName = col.split(' ')[0];
        console.log(`Attempting to add column: ${colName}`);
        db.run(`ALTER TABLE users ADD COLUMN ${col}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`  -> Column ${colName} already exists.`);
                } else {
                    console.error(`  -> Failed to add ${colName}:`, err.message);
                }
            } else {
                console.log(`  -> Successfully added ${colName}!`);
            }
        });
    });
    
    // Also ensure items table exists
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
    )`, (err) => {
        if(err) console.error("Error creating items table:", err);
        else console.log("Items table check passed.");
    });
});

setTimeout(() => {
    console.log('--- Repair Complete (Wait 2s before closing) ---');
}, 2000);

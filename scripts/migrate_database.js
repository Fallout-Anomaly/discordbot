const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '../database.db');
const db = new Database(dbPath);

console.log('🔧 Starting database migration...');

try {
    // Get current table schema
    const tableInfo = db.prepare("PRAGMA table_info(active_quests)").all();
    console.log('Current columns:', tableInfo.map(col => col.name).join(', '));

    // Check for missing columns and add them
    const expectedColumns = ['id', 'user_id', 'quest_id', 'faction_id', 'started_at', 'complete_at', 'title', 'description', 'objective', 'difficulty', 'reward_caps', 'reward_xp', 'start_time', 'duration', 'reward_item'];
    const existingColumns = tableInfo.map(col => col.name);
    const missingColumns = expectedColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
        console.log('✅ All expected columns exist!');
    } else {
        console.log('❌ Missing columns:', missingColumns.join(', '));
        console.log('\n⚠️  The database schema is outdated. Please delete the database file and restart the bot:');
        console.log(`    rm ${dbPath}`);
        console.log('\nThe bot will recreate the database with the correct schema on startup.');
    }

} catch (error) {
    if (error.message.includes('no such table')) {
        console.log('✅ Table does not exist yet - will be created on bot startup');
    } else {
        console.error('❌ Error:', error.message);
    }
}

db.close();

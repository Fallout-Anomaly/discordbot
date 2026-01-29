const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '../database.db');
console.log(`📁 Database path: ${dbPath}`);

try {
    const db = new Database(dbPath);
    console.log('✅ Connected to database\n');

    // Get current table schema
    const tableInfo = db.prepare("PRAGMA table_info(active_quests)").all();
    const existingColumns = tableInfo.map(col => col.name);
    
    console.log('📋 Current active_quests columns:');
    console.log(existingColumns.join(', '));
    console.log('');

    // Define expected columns
    const expectedColumns = {
        'quest_id': 'TEXT',
        'faction_id': 'TEXT',
        'title': 'TEXT',
        'description': 'TEXT',
        'objective': 'TEXT',
        'difficulty': 'TEXT',
        'reward_caps': 'INTEGER',
        'reward_xp': 'INTEGER',
        'start_time': 'INTEGER',
        'duration': 'INTEGER',
        'reward_item': 'TEXT'
    };

    // Find missing columns
    const missingColumns = Object.keys(expectedColumns).filter(col => !existingColumns.includes(col));

    if (missingColumns.length === 0) {
        console.log('✅ All required columns exist! No migration needed.\n');
        db.close();
        process.exit(0);
    }

    console.log('❌ Missing columns:', missingColumns.join(', '));
    console.log('\n🔧 Adding missing columns...\n');

    // Add each missing column
    for (const column of missingColumns) {
        const dataType = expectedColumns[column];
        const alterSQL = `ALTER TABLE active_quests ADD COLUMN ${column} ${dataType}`;
        
        try {
            db.exec(alterSQL);
            console.log(`  ✅ Added ${column} (${dataType})`);
        } catch (error) {
            console.error(`  ❌ Failed to add ${column}:`, error.message);
        }
    }

    console.log('\n✅ Migration complete! All columns now exist.');
    console.log('📊 Updated active_quests columns:');
    
    // Verify final schema
    const finalTableInfo = db.prepare("PRAGMA table_info(active_quests)").all();
    console.log(finalTableInfo.map(col => col.name).join(', '));
    
    db.close();
    process.exit(0);

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

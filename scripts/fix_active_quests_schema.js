const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '../economy.sqlite');
console.log(`📁 Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Could not connect to database:', err.message);
        process.exit(1);
    }
    
    console.log('✅ Connected to database\n');

    // Get current table schema
    db.all("PRAGMA table_info(active_quests)", (err, tableInfo) => {
        if (err) {
            console.error('❌ Error reading table schema:', err.message);
            db.close();
            process.exit(1);
        }

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
            return;
        }

        console.log('❌ Missing columns:', missingColumns.join(', '));
        console.log('\n🔧 Adding missing columns...\n');

        // Add each missing column sequentially
        let index = 0;
        
        function addNextColumn() {
            if (index >= missingColumns.length) {
                // Done adding columns, verify final schema
                console.log('\n✅ Migration complete! All columns now exist.');
                console.log('📊 Updated active_quests columns:');
                
                db.all("PRAGMA table_info(active_quests)", (err, finalTableInfo) => {
                    if (!err) {
                        console.log(finalTableInfo.map(col => col.name).join(', '));
                    }
                    db.close();
                    process.exit(0);
                });
                return;
            }

            const column = missingColumns[index];
            const dataType = expectedColumns[column];
            const alterSQL = `ALTER TABLE active_quests ADD COLUMN ${column} ${dataType}`;
            
            db.run(alterSQL, (err) => {
                if (err) {
                    console.error(`  ❌ Failed to add ${column}:`, err.message);
                } else {
                    console.log(`  ✅ Added ${column} (${dataType})`);
                }
                index++;
                addNextColumn();
            });
        }

        addNextColumn();
    });
});

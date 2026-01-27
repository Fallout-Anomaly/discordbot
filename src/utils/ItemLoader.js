const db = require('./EconomyDB');
const items = require('../data/items.json');
const { success, info, error } = require('./Console');

class ItemLoader {
    static async syncItems() {
        info('Syncing items to database...');
        
        db.serialize(() => {
            const stmt = db.prepare(`INSERT OR REPLACE INTO items (id, name, price, emoji, description, type, rarity, damage, defense, effect_full) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            
            items.forEach(item => {
                stmt.run(
                    item.id,
                    item.name,
                    item.price,
                    item.emoji,
                    item.description,
                    item.type,
                    item.rarity || 'common',
                    item.damage || 0,
                    item.defense || 0,
                    item.effect_full || 'none'
                );
            });

            stmt.finalize((err) => {
                if (err) {
                    error('Failed to sync items: ' + err.message);
                } else {
                    success(`Synced ${items.length} items to the database.`);
                }
            });
        });
    }
}

module.exports = ItemLoader;

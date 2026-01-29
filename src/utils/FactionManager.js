const db = require('./EconomyDB');

const FACTION_PERKS = {
    brotherhood: {
        Ally: [{ name: 'weapon_durability', value: 0.1 }],
        Veteran: [{ name: 'weapon_durability', value: 0.15 }, { name: 'strength_bonus', value: 1 }],
        Champion: [{ name: 'weapon_durability', value: 0.2 }, { name: 'strength_bonus', value: 2 }, { name: 'melee_damage', value: 0.1 }]
    },
    institute: {
        Ally: [{ name: 'energy_weapon_bonus', value: 0.05 }],
        Veteran: [{ name: 'energy_weapon_bonus', value: 0.1 }, { name: 'tech_crafting', value: 1 }],
        Champion: [{ name: 'energy_weapon_bonus', value: 0.15 }, { name: 'tech_crafting', value: 2 }, { name: 'synth_detection', value: 1 }]
    },
    minutemen: {
        Ally: [{ name: 'settlement_income', value: 0.1 }],
        Veteran: [{ name: 'settlement_income', value: 0.2 }, { name: 'charisma_bonus', value: 1 }],
        Champion: [{ name: 'settlement_income', value: 0.3 }, { name: 'charisma_bonus', value: 2 }, { name: 'recruitment', value: 1 }]
    },
    railroad: {
        Ally: [{ name: 'stealth_bonus', value: 0.05 }],
        Veteran: [{ name: 'stealth_bonus', value: 0.1 }, { name: 'infiltration', value: 1 }],
        Champion: [{ name: 'stealth_bonus', value: 0.15 }, { name: 'infiltration', value: 2 }, { name: 'sabotage', value: 1 }]
    },
    raiders: {
        Ally: [{ name: 'loot_bonus', value: 0.1 }],
        Veteran: [{ name: 'loot_bonus', value: 0.2 }, { name: 'intimidation', value: 1 }],
        Champion: [{ name: 'loot_bonus', value: 0.3 }, { name: 'intimidation', value: 2 }, { name: 'raid_damage', value: 0.15 }]
    },
    wastelanders: {
        Ally: [{ name: 'survival_bonus', value: 0.05 }],
        Veteran: [{ name: 'survival_bonus', value: 0.1 }, { name: 'balanced_training', value: 1 }],
        Champion: [{ name: 'survival_bonus', value: 0.15 }, { name: 'balanced_training', value: 2 }, { name: 'adaptability', value: 1 }]
    },
    smugglers: {
        Ally: [{ name: 'black_market_access', value: 1 }, { name: 'caps_bonus', value: 0.15 }],
        Veteran: [{ name: 'black_market_access', value: 2 }, { name: 'caps_bonus', value: 0.25 }, { name: 'fencing', value: 1 }],
        Champion: [{ name: 'black_market_access', value: 3 }, { name: 'caps_bonus', value: 0.4 }, { name: 'smuggling_routes', value: 2 }]
    },
    mercenaries: {
        Ally: [{ name: 'contract_bonus', value: 0.1 }, { name: 'damage_bonus', value: 0.05 }],
        Veteran: [{ name: 'contract_bonus', value: 0.2 }, { name: 'damage_bonus', value: 0.1 }, { name: 'solo_ops', value: 1 }],
        Champion: [{ name: 'contract_bonus', value: 0.3 }, { name: 'damage_bonus', value: 0.15 }, { name: 'elite_training', value: 2 }]
    },
    syndicate: {
        Ally: [{ name: 'black_market_access', value: 1 }, { name: 'crime_profit', value: 0.2 }],
        Veteran: [{ name: 'black_market_access', value: 2 }, { name: 'crime_profit', value: 0.35 }, { name: 'racketeering', value: 1 }],
        Champion: [{ name: 'black_market_access', value: 3 }, { name: 'crime_profit', value: 0.5 }, { name: 'crime_empire', value: 3 }]
    }
};

const REP_THRESHOLDS = {
    Outsider: -100,
    Neutral: -50,
    Ally: 0,
    Veteran: 50,
    Champion: 80
};

// Get player's faction standings
async function getPlayerFactionStats(userId) {
    return new Promise((resolve) => {
        db.all(
            `SELECT pf.faction_id, pf.reputation, pf.rank, f.name, f.emoji, f.color, f.type,
                    pa.faction_id as allegiance_faction, pa.allegiance_locked
             FROM player_factions pf
             LEFT JOIN factions f ON pf.faction_id = f.id
             LEFT JOIN player_allegiance pa ON pf.user_id = pa.user_id AND pf.faction_id = pa.faction_id
             WHERE pf.user_id = ?
             ORDER BY f.type DESC, pf.reputation DESC`,
            [userId],
            (err, rows) => {
                const stats = {};
                (rows || []).forEach(row => {
                    stats[row.faction_id] = {
                        reputation: row.reputation,
                        rank: row.rank,
                        name: row.name,
                        emoji: row.emoji,
                        color: row.color,
                        type: row.type,
                        isAllegiance: !!row.allegiance_faction,
                        allegiance_locked: !!row.allegiance_locked
                    };
                });
                resolve(stats);
            }
        );
    });
}

// Get player's chosen allegiance
async function getPlayerAllegiance(userId) {
    return new Promise((resolve) => {
        db.get(
            `SELECT pa.faction_id, pa.allegiance_locked, f.name, f.emoji FROM player_allegiance pa
             LEFT JOIN factions f ON pa.faction_id = f.id WHERE pa.user_id = ?`,
            [userId],
            (err, row) => resolve(row || null)
        );
    });
}

// Calculate rank based on reputation
function getRankFromRep(rep) {
    if (rep >= REP_THRESHOLDS.Champion) return 'Champion';
    if (rep >= REP_THRESHOLDS.Veteran) return 'Veteran';
    if (rep >= REP_THRESHOLDS.Ally) return 'Ally';
    if (rep >= REP_THRESHOLDS.Neutral) return 'Neutral';
    return 'Outsider';
}

// Modify player reputation
async function modifyReputation(userId, factionId, amount) {
    const stats = await getPlayerFactionStats(userId);
    const currentRep = stats[factionId]?.reputation || 0;
    const newRep = Math.max(-100, Math.min(100, currentRep + amount));
    const newRank = getRankFromRep(newRep);

    return new Promise((resolve) => {
        db.run(
            `INSERT INTO player_factions (user_id, faction_id, reputation, rank, last_rep_gain) 
             VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, faction_id) 
             DO UPDATE SET reputation = ?, rank = ?, last_rep_gain = ?`,
            [userId, factionId, newRep, newRank, Date.now(), newRep, newRank, Date.now()],
            () => resolve({ reputation: newRep, rank: newRank, delta: amount })
        );
    });
}

// Choose allegiance at level 10+
async function chooseAllegiance(userId, factionId, userLevel) {
    if (userLevel < 10) {
        return { success: false, reason: 'You must be level 10 to choose an allegiance.' };
    }

    const allegiance = await getPlayerAllegiance(userId);
    if (allegiance?.allegiance_locked) {
        return { success: false, reason: 'Your allegiance is already locked in.' };
    }

    const faction = await new Promise((resolve) => {
        db.get('SELECT type FROM factions WHERE id = ?', [factionId], (err, row) => resolve(row));
    });

    if (!faction) {
        return { success: false, reason: 'Faction not found.' };
    }

    if (faction.type !== 'major' && faction.type !== 'black-market') {
        return { success: false, reason: 'Invalid faction type.' };
    }

    return new Promise((resolve) => {
        db.run(
            `INSERT INTO player_allegiance (user_id, faction_id, allegiance_locked) 
             VALUES (?, ?, 1) ON CONFLICT(user_id) 
             DO UPDATE SET faction_id = ?, allegiance_locked = 1`,
            [userId, factionId, factionId],
            () => {
                resolve({
                    success: true,
                    message: `Allegiance locked to ${factionId}. Your choices matter now.`
                });
            }
        );
    });
}

// Check if can access faction content
async function canAccessFaction(userId, targetFactionId) {
    const allegiance = await getPlayerAllegiance(userId);
    const targetFaction = await new Promise((resolve) => {
        db.get('SELECT type FROM factions WHERE id = ?', [targetFactionId], (err, row) => resolve(row));
    });

    if (!allegiance?.faction_id) {
        // Pre-allegiance: can access anything
        return true;
    }

    const factions = await new Promise((resolve) => {
        db.all('SELECT id, type FROM factions WHERE type = "major"', (err, rows) => resolve(rows || []));
    });

    const majorFactions = factions.filter(f => f.type === 'major').map(f => f.id);

    // If target is major faction and different from allegiance
    if (majorFactions.includes(targetFactionId) && targetFactionId !== allegiance.faction_id) {
        return false; // Locked out
    }

    // If allegiance is major and target is black-market
    if (targetFaction?.type === 'black-market' && majorFactions.includes(allegiance.faction_id)) {
        return false; // Major faction members can't use black-market
    }

    return true;
}

// Get active perks for player
async function getPlayerPerks(userId) {
    const allegiance = await getPlayerAllegiance(userId);
    if (!allegiance?.faction_id) return [];

    const stats = await getPlayerFactionStats(userId);
    const factionData = stats[allegiance.faction_id];
    if (!factionData) return [];

    const perks = FACTION_PERKS[allegiance.faction_id]?.[factionData.rank] || [];
    return perks;
}

// Initialize player factions (run on first login)
async function initializePlayerFactions(userId) {
    return new Promise((resolve) => {
        const factionIds = ['brotherhood', 'institute', 'minutemen', 'railroad', 'raiders', 'wastelanders', 'smugglers', 'mercenaries', 'syndicate'];
        let completed = 0;

        factionIds.forEach(factionId => {
            db.run(
                `INSERT OR IGNORE INTO player_factions (user_id, faction_id, reputation, rank) 
                 VALUES (?, ?, 0, 'Neutral')`,
                [userId, factionId],
                () => {
                    completed++;
                    if (completed === factionIds.length) resolve();
                }
            );
        });
    });
}

module.exports = {
    getPlayerFactionStats,
    getPlayerAllegiance,
    getRankFromRep,
    modifyReputation,
    chooseAllegiance,
    canAccessFaction,
    getPlayerPerks,
    initializePlayerFactions,
    FACTION_PERKS,
    REP_THRESHOLDS
};

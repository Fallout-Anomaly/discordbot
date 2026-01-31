// Import inside functions to avoid circular dependency issues
const getDb = () => require('./EconomyDB');
const { error } = require('./Console');

// Hostility states for faction relationships
const HOSTILITY_STATES = {
    NEUTRAL: 0,
    SUSPICIOUS: 1,
    HOSTILE: 2,
    KOS: 3 // Kill on Sight
};

// Automatic hostility on allegiance choice (faction A joins → faction B becomes hostile)
const FACTION_ENEMIES = {
    brotherhood: ['institute'],
    institute: ['brotherhood', 'railroad'],
    minutemen: ['railroad'],
    railroad: ['institute', 'minutemen'],
    raiders: ['brotherhood', 'minutemen', 'wastelanders'],
    wastelanders: ['raiders'],
    smugglers: ['brotherhood', 'institute', 'minutemen', 'railroad'],
    mercenaries: [], // Mercenaries work for anyone
    syndicate: ['brotherhood', 'institute', 'minutemen', 'railroad']
};

// Territory locations with faction control benefits
const TERRITORIES = {
    cambridge_pd: {
        name: 'Cambridge Police Station',
        emoji: '🚓',
        default_faction: 'brotherhood',
        passive_income: 50, // caps/day
        buff_type: 'weapon_durability', // or 'xp_bonus', 'loot_bonus', 'combat_bonus'
        buff_value: 0.15
    },
    the_institute: {
        name: 'The Institute',
        emoji: '🤖',
        default_faction: 'institute',
        passive_income: 75,
        buff_type: 'energy_weapon_bonus',
        buff_value: 0.2
    },
    railroad_hq: {
        name: 'The Railroad',
        emoji: '🚆',
        default_faction: 'railroad',
        passive_income: 60,
        buff_type: 'stealth_bonus',
        buff_value: 0.15
    },
    the_castle: {
        name: 'The Castle',
        emoji: '🇺🇸',
        default_faction: 'minutemen',
        passive_income: 80,
        buff_type: 'settlement_income',
        buff_value: 0.25
    },
    corvega: {
        name: 'Corvega Assembly Plant',
        emoji: '💀',
        default_faction: 'raiders',
        passive_income: 40,
        buff_type: 'loot_bonus',
        buff_value: 0.2
    },
    vault_81: {
        name: 'Vault 81',
        emoji: '🔴',
        default_faction: 'wastelanders',
        passive_income: 55,
        buff_type: 'xp_bonus',
        buff_value: 0.1
    }
};

// Rank unlock thresholds
const RANK_UNLOCKS = {
    Outsider: { can_access_quests: true, can_access_recruit_quests: true, can_claim_territory: false, daily_cap_bonus: 0 },
    Neutral: { can_access_quests: true, can_access_recruit_quests: true, can_claim_territory: false, daily_cap_bonus: 0 },
    Ally: { can_access_quests: true, can_claim_territory: false, daily_cap_bonus: 5 },
    Veteran: { can_access_quests: true, can_claim_territory: true, daily_cap_bonus: 10, unlock_tier_2_quests: true },
    Champion: { can_access_quests: true, can_claim_territory: true, daily_cap_bonus: 15, unlock_tier_3_quests: true, can_command_faction: true }
};

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
    Recruit: -75,
    Neutral: -50,
    Ally: 0,
    Veteran: 50,
    Champion: 80
};

// Get player's faction standings
async function getPlayerFactionStats(userId) {
    const db = getDb();
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
    const db = getDb();
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
    if (rep >= REP_THRESHOLDS.Recruit) return 'Recruit';
    return 'Outsider';
}

// Modify player reputation
async function modifyReputation(userId, factionId, amount, _source = 'quest') {
    const db = getDb();
    if (amount === 0) return { success: true, gained: 0, oldRep: 0, newRep: 0 };
    
    const stats = await getPlayerFactionStats(userId);
    const currentRep = stats[factionId]?.reputation || 0;
    const now = Date.now();
    const dailyMs = 24 * 60 * 60 * 1000;
    const dayStart = now - (now % dailyMs);
    const oldRank = stats[factionId]?.rank || 'Outsider';

    return new Promise((resolve, reject) => {
        // Use IMMEDIATE transaction for bulletproof atomicity (locks database immediately)
        db.serialize(() => {
            db.run('BEGIN IMMEDIATE TRANSACTION');

            // Check daily limit INSIDE transaction (atomic read)
            // Exclude special sources (admin, allegiance_choice) from daily cap
            db.get(
                `SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) as total 
                 FROM faction_rep_log 
                 WHERE user_id = ? AND faction_id = ? AND timestamp >= ?
                 AND source NOT IN ('admin', 'allegiance_choice')`,
                [userId, factionId, dayStart],
                (err, row) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                    }

                    const dailyRepEarned = row?.total || 0;
                    const dailyCap = 10;

                    // Skip daily cap check for admin commands
                    if (_source !== 'admin' && dailyRepEarned >= dailyCap) {
                        db.run('ROLLBACK');
                        return resolve({ 
                            reputation: currentRep, 
                            rank: oldRank,
                            delta: 0,
                            throttled: true,
                            reason: `Daily reputation cap reached for ${factionId}. Try again tomorrow.`
                        });
                    }

                    // Calculate actual cap based on actual daily total (bypass for admin)
                    const actualCap = _source === 'admin' ? amount : Math.min(amount, dailyCap - dailyRepEarned);
                    const actualNewRep = Math.max(-100, Math.min(100, currentRep + actualCap));
                    const actualNewRank = getRankFromRep(actualNewRep);
                    const actualRankChanged = oldRank !== actualNewRank;

                    // Log the reputation gain
                    db.run(
                        `INSERT INTO faction_rep_log (user_id, faction_id, delta, source, timestamp) VALUES (?, ?, ?, ?, ?)`,
                        [userId, factionId, actualCap, _source, now],
                        (logErr) => {
                            if (logErr) {
                                error('Rep log error:', logErr.message);
                                db.run('ROLLBACK');
                                return reject(logErr);
                            }
                        }
                    );

                    db.run(
                        `INSERT INTO player_factions (user_id, faction_id, reputation, rank, last_rep_gain) 
                         VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, faction_id) 
                         DO UPDATE SET reputation = ?, rank = ?, last_rep_gain = ?`,
                        [userId, factionId, actualNewRep, actualNewRank, now, actualNewRep, actualNewRank, now],
                        (updateErr) => {
                            if (updateErr) {
                                error('Player faction update error:', updateErr.message);
                                db.run('ROLLBACK');
                                return reject(updateErr);
                            }

                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    error('Transaction commit error:', commitErr.message);
                                    return reject(commitErr);
                                }

                                resolve({ 
                                    reputation: actualNewRep, 
                                    rank: actualNewRank,
                                    oldRank,
                                    delta: actualCap,
                                    rankChanged: actualRankChanged,
                                    throttled: actualCap < amount
                                });
                            });
                        }
                    );
                }
            );
        });
    });
}

// Choose allegiance at level 10+ - triggers automatic hostility
async function chooseAllegiance(userId, factionId, userLevel) {
    const db = getDb();
    if (userLevel < 10) {
        return { success: false, reason: 'You must be level 10 to choose an allegiance.' };
    }

    const allegiance = await getPlayerAllegiance(userId);
    if (allegiance?.allegiance_locked) {
        // Already locked - prevent type switching
        const newFaction = await new Promise((resolve) => {
            db.get('SELECT type FROM factions WHERE id = ?', [factionId], (err, row) => resolve(row));
        });
        
        const oldFaction = await new Promise((resolve) => {
            db.get('SELECT type FROM factions WHERE id = ?', [allegiance.faction_id], (err, row) => resolve(row));
        });
        
        if (newFaction?.type !== oldFaction?.type) {
            return { success: false, reason: 'Your allegiance type cannot be changed. You are locked in.' };
        }
        
        return { success: false, reason: 'Your allegiance is already locked in.' };
    }

    const faction = await new Promise((resolve) => {
        db.get('SELECT type FROM factions WHERE id = ?', [factionId], (err, row) => resolve(row));
    });

    if (!faction) {
        return { success: false, reason: 'Faction not found.' };
    }

    // PHASE 2: Set automatic hostilities based on faction enemies
    const enemies = FACTION_ENEMIES[factionId] || [];

    return new Promise((resolve) => {
        db.run(
            `INSERT INTO player_allegiance (user_id, faction_id, allegiance_locked) 
             VALUES (?, ?, 1) ON CONFLICT(user_id) 
             DO UPDATE SET faction_id = ?, allegiance_locked = 1`,
            [userId, factionId, factionId],
            async () => {
                // Set enemy factions as hostile
                for (const enemyId of enemies) {
                    await setHostility(userId, enemyId, HOSTILITY_STATES.HOSTILE, `Enemy of ${factionId}`);
                }

                // Grant initial reputation boost when choosing allegiance (25 rep = Ally rank)
                await modifyReputation(userId, factionId, 25, 'allegiance_choice');
                
                resolve({
                    success: true,
                    message: `Allegiance locked to ${factionId}. You have been promoted to **Ally** rank! Your choices matter now.`,
                    enemies_marked_hostile: enemies.length
                });
            }
        );
    });
}

// Check if can access faction content
async function canAccessFaction(userId, targetFactionId) {
    const db = getDb();
    const allegiance = await getPlayerAllegiance(userId);
    const targetFaction = await new Promise((resolve) => {
        db.get('SELECT type FROM factions WHERE id = ?', [targetFactionId], (err, row) => resolve(row));
    });

    if (!allegiance?.faction_id) {
        // Pre-allegiance: can access anything
        return true;
    }

    // Check if target faction is HOSTILE (KOS factions are blocked)
    const hostility = await getHostility(userId, targetFactionId);
    if (hostility.hostility_state === HOSTILITY_STATES.KOS) {
        return false;  // Can't interact with KOS factions
    }

    // Check FACTION_ENEMIES list for specific hostility
    const playerFactionEnemies = FACTION_ENEMIES[allegiance.faction_id] || [];
    if (playerFactionEnemies.includes(targetFactionId)) {
        return false;  // Can't interact with enemy factions
    }

    // Define lawful factions that refuse black-market dealings
    const lawfulFactions = ['brotherhood', 'institute', 'minutemen', 'railroad', 'wastelanders'];

    // Only LAWFUL factions are blocked from black-market
    // Raiders (major criminal faction) CAN access black-market
    if (targetFaction?.type === 'black-market' && lawfulFactions.includes(allegiance.faction_id)) {
        return false;
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
    const db = getDb();
    return new Promise((resolve) => {
        // Dynamically fetch all faction IDs from database
        db.all('SELECT id FROM factions', (err, rows) => {
            const factionIds = (rows || []).map(row => row.id);
            
            // If no factions exist, resolve immediately to prevent hang
            if (factionIds.length === 0) return resolve();
            
            let completed = 0;

            factionIds.forEach(factionId => {
                db.run(
                    `INSERT OR IGNORE INTO player_factions (user_id, faction_id, reputation, rank) 
                     VALUES (?, ?, -100, 'Outsider')`,
                    [userId, factionId],
                    (err) => {
                        if (err) error(`Failed to init faction for user ${userId}:`, err.message);
                        completed++;
                        if (completed === factionIds.length) resolve();
                    }
                );
            });
        });
    });
}

// Set hostility state (for Phase 2: hit squads, ambushes)
async function setHostility(userId, factionId, state, reason = '') {
    const db = getDb();
    return new Promise((resolve) => {
        db.run(
            `INSERT INTO faction_hostility (user_id, faction_id, hostility_state, reason, timestamp) 
             VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, faction_id) 
             DO UPDATE SET hostility_state = ?, reason = ?, timestamp = ?`,
            [userId, factionId, state, reason, Date.now(), state, reason, Date.now()],
            () => resolve({ success: true, state, faction: factionId })
        );
    });
}

// Get hostility status
async function getHostility(userId, factionId) {
    const db = getDb();
    return new Promise((resolve) => {
        db.get(
            `SELECT hostility_state, reason FROM faction_hostility 
             WHERE user_id = ? AND faction_id = ?`,
            [userId, factionId],
            (err, row) => resolve(row || { hostility_state: HOSTILITY_STATES.NEUTRAL, reason: '' })
        );
    });
}

// Get all hostile factions for player
async function getHostileFactions(userId) {
    const db = getDb();
    return new Promise((resolve) => {
        db.all(
            `SELECT fh.faction_id, fh.hostility_state, f.name, f.emoji 
             FROM faction_hostility fh
             JOIN factions f ON fh.faction_id = f.id
             WHERE fh.user_id = ? AND fh.hostility_state > 0
             ORDER BY fh.hostility_state DESC`,
            [userId],
            (err, rows) => resolve(rows || [])
        );
    });
}

// PHASE 2: Get territory info
async function getTerritoryControl(userId) {
    const db = getDb();
    const allegiance = await getPlayerAllegiance(userId);
    if (!allegiance?.faction_id) return [];
    return new Promise((resolve) => {
        db.all(`SELECT territory_id, controlling_faction FROM territories WHERE controlling_faction = ?`, [allegiance.faction_id], (err, rows) => resolve(rows || []));
    });
}

// Get passive income from territories
async function getTerritoryIncome(userId) {
    const territories = await getTerritoryControl(userId);
    let income = 0;
    territories.forEach(t => { const territory = TERRITORIES[t.territory_id]; if (territory) income += territory.passive_income; });
    return income;
}

// Get rank-based access level
function getRankAccess(rank) { return RANK_UNLOCKS[rank] || RANK_UNLOCKS.Outsider; }

// Check if player can access faction quests
async function canAccessFactionQuests(userId) {
    const stats = await getPlayerFactionStats(userId);
    const allegiance = await getPlayerAllegiance(userId);
    
    // Allow players without allegiance to access quests (limited to Recruit tier by quest command logic)
    if (!allegiance?.faction_id) return true;
    
    const rankAccess = getRankAccess(stats[allegiance.faction_id]?.rank || 'Outsider');
    return rankAccess.can_access_quests || false;
}

// Check if player can claim/contest territory
async function canClaimTerritory(userId) {
    const stats = await getPlayerFactionStats(userId);
    const allegiance = await getPlayerAllegiance(userId);
    if (!allegiance?.faction_id) return false;
    const rankAccess = getRankAccess(stats[allegiance.faction_id]?.rank || 'Outsider');
    return rankAccess.can_claim_territory || false;
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
    setHostility,
    getHostility,
    getHostileFactions,
    getTerritoryControl,
    getTerritoryIncome,
    getRankAccess,
    canAccessFactionQuests,
    canClaimTerritory,
    FACTION_PERKS,
    REP_THRESHOLDS,
    HOSTILITY_STATES,
    FACTION_ENEMIES,
    TERRITORIES,
    RANK_UNLOCKS
};

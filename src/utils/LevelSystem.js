/**
 * Level System for AnomalyBot
 * Level 1 = 500 XP
 * Level 100 = 50,000 XP (max level)
 * Each level requires an additional 500 XP (500 XP per level)
 */

const MAX_LEVEL = 100;

/**
 * Calculate level from total XP
 * @param {number} totalXp - Total XP earned
 * @returns {number} Current level (capped at 100)
 */
function calculateLevel(totalXp) {
    if (totalXp < 500) return 1;
    return Math.min(MAX_LEVEL, Math.floor(totalXp / 500));
}

/**
 * Calculate XP needed for next level
 * @param {number} totalXp - Total XP earned
 * @returns {number} XP needed to reach next level (0 if max level)
 */
function getXpToNextLevel(totalXp) {
    const currentLevel = calculateLevel(totalXp);
    if (currentLevel >= MAX_LEVEL) return 0;
    
    const xpForNextLevel = (currentLevel + 1) * 500;
    return Math.max(0, xpForNextLevel - totalXp);
}

/**
 * Get XP progress for current level
 * @param {number} totalXp - Total XP earned
 * @returns {object} { current, next, progress, percentage }
 */
function getLevelProgress(totalXp) {
    const currentLevel = calculateLevel(totalXp);
    
    // At max level, show completion
    if (currentLevel >= MAX_LEVEL) {
        return { current: 0, next: 0, progress: 'MAX', percentage: 100 };
    }
    
    const xpForCurrentLevel = currentLevel * 500;
    const xpForNextLevel = (currentLevel + 1) * 500;
    
    const current = totalXp - xpForCurrentLevel;
    const next = xpForNextLevel - xpForCurrentLevel;
    const percentage = Math.floor((current / next) * 100);
    
    return { current, next, progress: `${current}/${next}`, percentage };
}

module.exports = {
    calculateLevel,
    getXpToNextLevel,
    getLevelProgress,
    MAX_LEVEL
};

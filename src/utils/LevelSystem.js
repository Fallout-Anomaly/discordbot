const { LEVEL_SYSTEM } = require('./Constants');
const MAX_LEVEL = LEVEL_SYSTEM.MAX_LEVEL;
const XP_PER_LEVEL = LEVEL_SYSTEM.XP_PER_LEVEL;

/**
 * Calculate level from total XP
 * @param {number} totalXp - Total XP earned
 * @returns {number} Current level (capped at 100)
 */
function calculateLevel(totalXp) {
    if (totalXp < XP_PER_LEVEL) return 1;
    return Math.min(MAX_LEVEL, Math.floor(totalXp / XP_PER_LEVEL));
}

/**
 * Calculate XP needed for next level
 * @param {number} totalXp - Total XP earned
 * @returns {number} XP needed to reach next level (0 if max level)
 */
function getXpToNextLevel(totalXp) {
    const currentLevel = calculateLevel(totalXp);
    if (currentLevel >= MAX_LEVEL) return 0;
    
    const xpForNextLevel = (currentLevel + 1) * XP_PER_LEVEL;
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
    
    // For level 1, start from 0 XP
    const xpForCurrentLevel = currentLevel === 1 ? 0 : currentLevel * XP_PER_LEVEL;
    const xpForNextLevel = (currentLevel + 1) * XP_PER_LEVEL;
    
    const current = totalXp - xpForCurrentLevel;
    const next = xpForNextLevel - xpForCurrentLevel;
    const percentage = Math.floor((current / next) * 100);
    
    return { current, next, progress: `${current}/${next}`, percentage };
}

/**
 * Check if a user leveled up
 * @param {number} oldXp - XP before the action
 * @param {number} newXp - XP after the action
 * @returns {object} { leveledUp: boolean, oldLevel: number, newLevel: number, levelsGained: number }
 */
function checkLevelUp(oldXp, newXp) {
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newXp);
    
    return {
        leveledUp: newLevel > oldLevel,
        oldLevel,
        newLevel,
        levelsGained: Math.max(0, newLevel - oldLevel)
    };
}

module.exports = {
    calculateLevel,
    getXpToNextLevel,
    getLevelProgress,
    checkLevelUp,
    MAX_LEVEL
};

module.exports.QUEST_TEMPLATES = [
    { title: "Clear the Dunwich Borers", description: "Radroach infestation spreading. We need that cleaned out.", objective: "Exterminate the infestation", difficulty: "Easy" },
    { title: "Retrieve Pre-War Tech", description: "An old robotics facility still has valuable tech. Go salvage what you can.", objective: "Collect pre-war artifacts", difficulty: "Medium" },
    { title: "Eliminate Raider Gang", description: "Slavers have been terrorizing settlements. Deal with them.", objective: "Neutralize the raider threat", difficulty: "Hard" },
    { title: "Investigate Missing Supplies", description: "Our supply caravan never returned. Find out what happened.", objective: "Track down the caravan", difficulty: "Medium" },
    { title: "Secure Water Purification", description: "The water pump is failing. We need parts to repair it.", objective: "Gather pump components", difficulty: "Easy" },
    { title: "Scout New Territory", description: "We're expanding. Check out that unexplored sector for threats.", objective: "Survey the area safely", difficulty: "Medium" },
    { title: "Destroy Synth Nest", description: "Institute infiltrators have been spotted. Take them out before they replace us.", objective: "Destroy all Synths", difficulty: "Hard" },
    { title: "Escort the Brahmin", description: "A trader needs help moving stock through super mutant territory.", objective: "Protect the caravan", difficulty: "Medium" }
];

module.exports.LEVEL_SYSTEM = {
    XP_PER_LEVEL: 500,
    MAX_LEVEL: 100
};

module.exports.SCAVENGE_DEFAULTS = {
    LIMIT_NORMAL: 10,
    LIMIT_BOOSTER: 15,
    LIMIT_DONATOR: 20,
    DURATION_NORMAL: 15, // minutes
    DURATION_BOOSTER: 10,
    DURATION_DONATOR: 5
};

module.exports.ROBBERY_MODIFIERS = {
    MIN_BALANCE_REQUIRED: 100,
    BASE_SUCCESS_CHANCE: 0.45,
    POVERTY_BONUS: 0.15,
    WEALTH_PENALTY: 0.10,
    BODYGUARD_PENALTY: 0.30,
    MIN_SUCCESS: 0.10,
    MAX_SUCCESS: 0.85,
    VICTIM_REWARD_PERCENT: 0.05 // 5% of robbery fine goes to victim
};

module.exports.ERROR_MESSAGES = {
    DB_ERROR: "❌ Database error. Please try again later.",
    NO_DATA: "❌ No data found.",
    INVALID_ARGS: "❌ Invalid arguments provided.",
    COOLDOWN: "⏳ You are on cooldown.",
    INSUFFICIENT_FUNDS: "❌ You don't have enough caps."
};

// Shared quest data accessible to both commands and components
// This file contains FACTION_QUESTS and QUEST_ENCOUNTERS used throughout the faction system

// Random quest encounter scenarios with risk/reward mechanics
const QUEST_ENCOUNTERS = [
    {
        title: "Wasteland Ambush",
        description: "You're ambushed by raiders while on patrol!",
        situation: "A gang of raiders emerges from the ruins, weapons drawn. You must act fast.",
        options: {
            attack: { label: "⚔️ Attack", difficulty: 0.4, multiplier: 2.0, failMessage: "You were overwhelmed and had to retreat!" },
            sneak: { label: "🕵️ Sneak", difficulty: 0.3, multiplier: 1.0, failMessage: "They spotted you before you could act." },
            talk: { label: "🗣️ Negotiate", difficulty: 0.2, multiplier: 0.5, failMessage: "They weren't interested in talking." }
        }
    },
    {
        title: "Merchant Crisis",
        description: "A desperate merchant needs your help!",
        situation: "A merchant convoy is under attack by mutants. Time to prove your worth.",
        options: {
            attack: { label: "⚔️ Fight Together", difficulty: 0.4, multiplier: 2.0, failMessage: "You both had to retreat from the mutant horde." },
            sneak: { label: "🕵️ Flank Attack", difficulty: 0.3, multiplier: 1.0, failMessage: "Your flanking maneuver didn't work as planned." },
            talk: { label: "🗣️ Distract Them", difficulty: 0.2, multiplier: 0.5, failMessage: "The creatures were too focused on hunting." }
        }
    },
    {
        title: "Suspicious Activity",
        description: "You discover something unusual in your patrol zone.",
        situation: "Strange tracks and an abandoned supply cache. What do you do?",
        options: {
            attack: { label: "⚔️ Investigate Aggressively", difficulty: 0.4, multiplier: 2.0, failMessage: "You triggered a trap and barely escaped." },
            sneak: { label: "🕵️ Sneak Around", difficulty: 0.3, multiplier: 1.0, failMessage: "Someone was already watching from the shadows." },
            talk: { label: "🗣️ Call for Backup", difficulty: 0.2, multiplier: 0.5, failMessage: "By the time backup arrived, whoever was here was gone." }
        }
    },
    {
        title: "Faction Dispute",
        description: "You encounter a rival faction group.",
        situation: "Tensions are high as you meet members from a rival faction. How do you handle it?",
        options: {
            attack: { label: "⚔️ Start a Fight", difficulty: 0.4, multiplier: 2.0, failMessage: "They outnumbered you and forced you to retreat." },
            sneak: { label: "🕵️ Slip Away", difficulty: 0.3, multiplier: 1.0, failMessage: "They spotted you trying to avoid them." },
            talk: { label: "🗣️ Talk It Out", difficulty: 0.2, multiplier: 0.5, failMessage: "They weren't in the mood for conversation." }
        }
    },
    {
        title: "Unexpected Opportunity",
        description: "Fortune smiles upon you this day!",
        situation: "You stumble upon an unguarded cache of valuable supplies. How do you exploit this?",
        options: {
            attack: { label: "⚔️ Take It All", difficulty: 0.4, multiplier: 2.0, failMessage: "The area was more dangerous than it looked." },
            sneak: { label: "🕵️ Carefully Gather", difficulty: 0.3, multiplier: 1.0, failMessage: "You couldn't carry everything without being noticed." },
            talk: { label: "🗣️ Report It", difficulty: 0.2, multiplier: 0.5, failMessage: "Someone else found it first." }
        }
    }
];

// Quest definitions per faction
const FACTION_QUESTS = {
    brotherhood: [
        {
            id: 'bos_recruit_training',
            name: 'Recruit Training',
            description: 'Prove your worth in basic combat drills',
            reward: { caps: 50, rep: 5, xp: 30 },
            rank: 'Recruit',
            duration: 300000,
            type: 'training'
        },
        {
            id: 'bos_patrol',
            name: 'Brotherhood Patrol',
            description: 'Scout the wasteland for tech and threats',
            reward: { caps: 150, rep: 15, xp: 100 },
            rank: 'Ally',
            type: 'exploration'
        },
        {
            id: 'bos_scribe_work',
            name: 'Scribe\'s Record',
            description: 'Catalog technology finds for the Brotherhood archives',
            reward: { caps: 100, rep: 10, xp: 75 },
            rank: 'Ally',
            type: 'collection'
        },
        {
            id: 'bos_radiation_cleanse',
            name: 'Radiation Cleanse',
            description: 'Clear radioactive zones to protect the Brotherhood',
            reward: { caps: 200, rep: 20, xp: 150 },
            rank: 'Veteran',
            type: 'combat'
        }
    ],
    institute: [
        {
            id: 'inst_recruit_analysis',
            name: 'Data Analysis',
            description: 'Analyze sample data for Institute research',
            reward: { caps: 60, rep: 5, xp: 35 },
            rank: 'Recruit',
            duration: 300000,
            type: 'research'
        },
        {
            id: 'inst_synth_retrieval',
            name: 'Synth Retrieval',
            description: 'Recover escaped synths from the Commonwealth',
            reward: { caps: 180, rep: 15, xp: 120 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'inst_component_scavenging',
            name: 'Component Scavenging',
            description: 'Gather advanced components for Institute experiments',
            reward: { caps: 120, rep: 10, xp: 80 },
            rank: 'Ally',
            type: 'collection'
        },
        {
            id: 'inst_espionage',
            name: 'Espionage Mission',
            description: 'Infiltrate and gather intelligence on rival factions',
            reward: { caps: 250, rep: 25, xp: 200 },
            rank: 'Veteran',
            type: 'stealth'
        }
    ],
    minutemen: [
        {
            id: 'mm_recruit_assistance',
            name: 'Settlement Assistance',
            description: 'Help repair basic structures in a settlement',
            reward: { caps: 55, rep: 5, xp: 32 },
            rank: 'Recruit',
            duration: 300000,
            type: 'support'
        },
        {
            id: 'mm_settlement_aid',
            name: 'Settlement Aid',
            description: 'Provide supplies and defense to struggling settlements',
            reward: { caps: 140, rep: 12, xp: 90 },
            rank: 'Ally',
            type: 'support'
        },
        {
            id: 'mm_caravan_escort',
            name: 'Caravan Escort',
            description: 'Protect merchant caravans traveling the Commonwealth',
            reward: { caps: 160, rep: 14, xp: 110 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'mm_restore_liberty',
            name: 'Restore Liberty',
            description: 'Reclaim settlements from hostile forces',
            reward: { caps: 220, rep: 22, xp: 180 },
            rank: 'Veteran',
            type: 'combat'
        }
    ],
    railroad: [
        {
            id: 'rr_recruit_courier',
            name: 'Courier Run',
            description: 'Deliver encoded messages through the Railroad network',
            reward: { caps: 65, rep: 5, xp: 38 },
            rank: 'Recruit',
            duration: 300000,
            type: 'delivery'
        },
        {
            id: 'rr_rescue_synth',
            name: 'Synth Rescue',
            description: 'Liberate enslaved synths from Institute control',
            reward: { caps: 170, rep: 16, xp: 130 },
            rank: 'Ally',
            type: 'stealth'
        },
        {
            id: 'rr_underground_network',
            name: 'Underground Network',
            description: 'Establish safe houses for synth refugees',
            reward: { caps: 130, rep: 11, xp: 85 },
            rank: 'Ally',
            type: 'support'
        },
        {
            id: 'rr_sabotage',
            name: 'Sabotage Mission',
            description: 'Disrupt Institute operations across the Commonwealth',
            reward: { caps: 240, rep: 23, xp: 190 },
            rank: 'Veteran',
            type: 'stealth'
        }
    ],
    raiders: [
        {
            id: 'raider_recruit_shakedown',
            name: 'Shake Down',
            description: 'Intimidate a small merchant for caps',
            reward: { caps: 70, rep: 5, xp: 40 },
            rank: 'Recruit',
            duration: 300000,
            type: 'intimidation'
        },
        {
            id: 'raider_raid',
            name: 'The Raid',
            description: 'Lead a raiding party against settlements and traders',
            reward: { caps: 200, rep: 18, xp: 140 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'raider_intimidate',
            name: 'Intimidation Job',
            description: 'Extort protection money from wasteland merchants',
            reward: { caps: 150, rep: 13, xp: 100 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'raider_gang_war',
            name: 'Gang War',
            description: 'Assault rival raider gangs to expand Raider territory',
            reward: { caps: 260, rep: 25, xp: 200 },
            rank: 'Veteran',
            type: 'combat'
        }
    ],
    wastelanders: [
        {
            id: 'wast_recruit_scavenge',
            name: 'Scavenge Run',
            description: 'Gather basic supplies for the community',
            reward: { caps: 45, rep: 5, xp: 28 },
            rank: 'Recruit',
            duration: 300000,
            type: 'gathering'
        },
        {
            id: 'wast_water_supply',
            name: 'Water Supply Run',
            description: 'Deliver clean water to Wastelander settlements',
            reward: { caps: 120, rep: 10, xp: 75 },
            rank: 'Ally',
            type: 'support'
        },
        {
            id: 'wast_hunting',
            name: 'Hunting Expedition',
            description: 'Hunt irradiated creatures for food and materials',
            reward: { caps: 140, rep: 12, xp: 95 },
            rank: 'Ally',
            type: 'combat'
        },
        {
            id: 'wast_raider_defense',
            name: 'Raider Defense',
            description: 'Defend Wastelander settlements from Raider attacks',
            reward: { caps: 210, rep: 20, xp: 160 },
            rank: 'Veteran',
            type: 'combat'
        }
    ]
};

module.exports = {
    FACTION_QUESTS,
    QUEST_ENCOUNTERS
};

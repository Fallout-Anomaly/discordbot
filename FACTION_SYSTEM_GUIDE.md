# Faction System Player Guide

## Quick Start

### 1. Join a Faction (Level 10+)
Use `/faction choose <faction>` at **level 10 or higher** to select your allegiance. This choice is **permanent** and unlocks faction-specific benefits.

**Available Factions:**
- **Lawful (6 factions):** Brotherhood of Steel, Institute, Minutemen, Railroad, Raiders, Independent Wastelanders
- **Black-Market (3 factions):** Smugglers, Mercenaries, Wasteland Syndicate

You can only join ONE faction. Lawful and black-market factions are mutually exclusive.

---

## Reputation & Ranks

### How Reputation Works
- **Gain rep:** Complete faction quests, help your faction
- **Range:** -100 to +100 per faction
- **Daily Cap:** +10 reputation per day per faction (prevents grinding exploits)
- **Display:** Use `/faction status` to see all faction standings

### Rank Progression
As you gain reputation, your rank improves:

| Rank | Rep Threshold | Perks | Unlocks |
|------|---------------|-------|---------|
| **Outsider** | < -100 | None | None |
| **Neutral** | -50 to -49 | None | None |
| **Ally** | 0 to 49 | Faction perks begin | Faction quests |
| **Veteran** | 50 to 79 | Improved perks | Territory claims |
| **Champion** | 80+ | Max perks | Command faction |

### Faction Perks
Each rank grants unique bonuses:
- **Weapon Durability** (Brotherhood): Weapons last 15% longer
- **Energy Weapon Bonus** (Institute): Energy weapons deal 20% more damage
- **Stealth Bonus** (Railroad): Stealth actions 15% more effective
- **Settlement Income** (Minutemen): Settlement income +25%
- **Loot Bonus** (Raiders): Loot 20% more valuable
- **XP Bonus** (Wastelanders): Gain 10% more experience
- **Black Market Access** (Smugglers/Mercenaries/Syndicate): Access to exclusive items

---

## Faction Quests

### Accessing Quests
- **Requirement:** Ally rank (0+ reputation)
- **Command:** `/faction-quest list` → shows available quests
- **Tiers:** Ally quests (100-180 caps) and Veteran quests (200-260 caps)

### Quest Types
- **Exploration:** Scout territories for resources
- **Collection:** Gather items for faction
- **Combat:** Fight enemies for the faction
- **Stealth:** Infiltration missions
- **Support:** Aid settlements or refugees

### Completing Quests
1. `/faction-quest list` - See available quests
2. `/faction-quest accept <quest-id>` - Accept a quest
3. Complete the quest objective in-game
4. `/faction-quest complete <quest-id>` - Claim rewards (caps + rep + XP)

---

## Territory Control

### What Are Territories?
6 strategic locations across the Commonwealth that factions control:

| Territory | Controlling Faction | Income/Day | Buff |
|-----------|-------------------|-----------|------|
| 🏢 Cambridge PD | Brotherhood | 50 caps | Weapon Durability +15% |
| 🔬 The Institute | Institute | 75 caps | Energy Weapon +20% |
| 🚆 Railroad HQ | Railroad | 60 caps | Stealth +15% |
| 🏰 The Castle | Minutemen | 80 caps | Settlement Income +25% |
| 💀 Corvega Assembly | Raiders | 40 caps | Loot Bonus +20% |
| 🏚️ Vault 81 | Wastelanders | 55 caps | XP Bonus +10% |

### Claiming Territories
- **Requirement:** Veteran rank (50+ reputation)
- **Command:** `/territory claim <territory>`
- **Effect:** Your faction gains passive income daily
- **Competition:** Territories start unclaimed; factions that claim them first control the passive income

### Territory Commands
- `/territory list` - See all territories and controllers
- `/territory income` - Check your faction's daily passive income

---

## Hostility & Faction Relationships

### Automatic Enemies
When you join a faction, certain factions automatically become **HOSTILE**:

| Your Faction | Becomes Hostile To |
|-------------|-------------------|
| Brotherhood | Institute |
| Institute | Brotherhood, Railroad |
| Railroad | Institute, Minutemen |
| Minutemen | Railroad |
| Raiders | Brotherhood, Minutemen, Wastelanders |
| Wastelanders | Raiders |
| Any Lawful | All Black-Market |
| Any Black-Market | All Lawful |

**Effect:** You cannot trade, quest, or interact with hostile factions.

### Checking Hostility
Use `/faction status` to see all hostile factions (marked with ⚔️ icon).

---

## Faction Status Command

Use `/faction status` to view:
- **Your Allegiance:** Current faction choice
- **All Standings:** Rep/rank in all 9 factions
- **Active Perks:** Bonuses from your current rank
- **Hostile Factions:** Factions you can't interact with
- **Territory Income:** Passive caps from controlled territories

---

## Strategic Tips

### Choosing Your Faction
- **Brotherhood:** Best for combat builds (weapon durability)
- **Institute:** Energy weapon specialists (synths)
- **Minutemen:** Settlement builders (passive income buff)
- **Railroad:** Stealth players (infiltration bonuses)
- **Raiders:** Aggressive players (loot bonuses)
- **Wastelanders:** Balanced/XP-focused (experience buff)
- **Black-Market:** High-risk, exclusive items

### Maximizing Income
- Gain Veteran rank to unlock territory claiming
- Claim territories your faction can control
- Each territory adds passive daily caps (40-80/day)
- Combine with other income sources (quests, daily rewards, etc.)

### Avoiding Hostility
- Remember your faction's enemies BEFORE joining
- Some factions (Minutemen, Wastelanders) have fewer enemies
- Black-market factions are hostile to ALL lawful factions (risky)

### Progression Path
1. **Level 10:** Choose allegiance
2. **0 Rep:** Reach Ally, unlock quests
3. **50 Rep:** Reach Veteran, unlock territories
4. **80 Rep:** Reach Champion, unlock faction commands
5. **Daily:** Complete quests for passive income

---

## FAQ

**Q: Can I switch factions?**
A: No. Your allegiance is permanent once chosen at level 10.

**Q: How do I gain rep faster?**
A: Complete faction quests (best rep/effort ratio) or help your faction members in combat.

**Q: What happens if I lose reputation?**
A: You rank down and lose perks, but you don't lose your allegiance.

**Q: Can multiple factions control the same territory?**
A: No. One faction controls each territory (or none if unclaimed).

**Q: Do territories generate income automatically?**
A: Yes, you'll see "Territory Income" in your daily reward summary.

**Q: What are black-market factions?**
A: Criminal organizations with exclusive items/perks but hostile to all lawful factions.

**Q: Can I see other players' faction standings?**
A: Not yet, but may be added in future updates.

---

## Command Reference

| Command | Description |
|---------|-------------|
| `/faction choose <faction>` | Lock your allegiance (Lvl 10+) |
| `/faction status` | View all standings, perks, income |
| `/faction-quest list` | See available quests (Ally+) |
| `/faction-quest accept <id>` | Accept a quest |
| `/faction-quest complete <id>` | Complete & claim rewards |
| `/territory list` | See all territories |
| `/territory income` | Check daily passive income |
| `/territory claim <territory>` | Claim uncontrolled territory (Veteran+) |

---

**Last Updated:** Phase 2 Implementation
**Status:** All systems active and balanced

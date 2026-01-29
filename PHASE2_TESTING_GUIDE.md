# Phase 2 Implementation Guide - Testing & Deployment

## New Commands Added

### 1. `/territory` Command
**Location:** `src/commands/RPG/slashcommand-territory.js`

**Subcommands:**
- `/territory list` - Shows all 6 territories and their controlling factions
- `/territory income` - Shows passive caps earned from controlled territories (Ally+ only)
- `/territory claim <territory>` - Claim an uncontrolled territory (Veteran+ only)

**Usage:**
```
/territory list
→ Shows territory control map

/territory income
→ Shows: "Daily Income: +50 caps"

/territory claim cambridge_pd
→ Adds Cambridge PD to faction control
→ Awards +5 reputation
→ Adds passive income to daily rewards
```

---

### 2. `/faction-quest` Command
**Location:** `src/commands/RPG/slashcommand-faction-quest.js`

**Subcommands:**
- `/faction-quest list` - Shows available quests for your rank (Ally+ only)
- `/faction-quest accept <quest>` - Accept a quest
- `/faction-quest complete <quest>` - Mark quest complete and claim rewards

**Usage:**
```
/faction-quest list
→ Shows available quests by faction
→ Shows locked quests with rank requirements

/faction-quest accept bos_patrol
→ Confirms quest accepted
→ Shows reward breakdown

/faction-quest complete bos_patrol
→ Awards: 150 caps, +15 rep, +100 XP
```

---

## Testing Checklist

### Core System Tests

- [ ] **Allegiance + Hostility**
  ```
  1. Player joins Brotherhood with /faction choose
  2. Check /faction status → Institute should show as HOSTILE
  3. Verify faction_hostility table has entry with hostility_state=2
  ```

- [ ] **Territory Display**
  ```
  1. Run /territory list
  2. Verify all 6 territories show
  3. Verify income values display correctly (40-80 caps)
  4. Check buff types display (weapon_durability, energy_weapon_bonus, etc.)
  ```

- [ ] **Territory Income Calculation**
  ```
  1. Player claims Cambridge PD (/territory claim cambridge_pd)
  2. Run /territory income
  3. Verify shows 50 caps (can verify in DB with: 
     SELECT territory_id, controlling_faction FROM territories WHERE territory_id='cambridge_pd')
  4. Claim second territory and verify sum increases
  ```

- [ ] **Rank Gating**
  ```
  1. New player (rank Outsider) tries /territory claim
     → Should show: "You need Veteran rank or higher"
  2. New player (rank Outsider) tries /faction-quest list
     → Should show: "You need Ally rank or higher"
  3. Player at Ally rank tries /faction-quest list
     → Should show all Ally-tier quests
  4. Player at Veteran rank tries /faction-quest list
     → Should show both Ally and Veteran quests
  ```

- [ ] **Quest System**
  ```
  1. Player at Ally rank runs /faction-quest list
  2. Try /faction-quest accept bos_patrol
  3. Try /faction-quest complete bos_patrol
  4. Verify player received: 150 caps + 15 rep
  5. Check /faction status → rep should increase by 15
  ```

### Database Verification

```sql
-- Check auto-hostility creation
SELECT * FROM faction_hostility WHERE user_id='<user_id>';
-- Should show multiple entries with hostility_state=2

-- Check territory claims
SELECT * FROM territories WHERE controlling_faction IS NOT NULL;
-- Should show any claimed territories

-- Check reputation changes
SELECT reputation FROM player_factions WHERE user_id='<user_id>';
-- Should match visible reputation in /faction status
```

---

## Integration with Daily Systems (NEXT)

Once Phase 2 commands are tested, integrate into daily tasks:

### Territory Income Collection
```javascript
// In daily reward distribution:
const income = await FactionManager.getTerritoryIncome(userId);
if (income > 0) {
    await addCapsReward(userId, income, 'Territory Income');
}
```

### Territory Income Notifications
```
[Daily Reward Summary]
Economy: +50 caps (daily stipend)
Territory Income: +60 caps (Railroad HQ + other territories)
Economy: +150 caps (from quests)
```

### Territory Contests (Future)
When multiple factions claim same territory, trigger:
- War announcement
- Combat event
- Territory changes hands on win
- Rep changes for both factions

---

## File Structure Reference

```
src/
├── commands/RPG/
│   ├── slashcommand-territory.js (NEW)
│   ├── slashcommand-faction-quest.js (NEW)
│   └── slashcommand-faction.js (UPDATED)
├── utils/
│   ├── FactionManager.js (UPDATED - Phase 2 functions)
│   └── EconomyDB.js (UPDATED - new tables)
```

---

## Constants Quick Reference

### TERRITORIES Map (6 total)
```javascript
{
  cambridge_pd: { name: '🏢 Cambridge Police Department', passive_income: 50, ... },
  the_institute: { name: '🔬 The Institute', passive_income: 75, ... },
  railroad_hq: { name: '🚂 Railroad HQ', passive_income: 60, ... },
  the_castle: { name: '🏰 The Castle', passive_income: 80, ... },
  corvega: { name: '💀 Corvega Assembly', passive_income: 40, ... },
  vault_81: { name: '🏚️ Vault 81', passive_income: 55, ... }
}
```

### RANK_UNLOCKS Gates
```javascript
Ally: { can_access_quests: true, can_claim_territory: false }
Veteran: { can_access_quests: true, can_claim_territory: true }
Champion: { can_access_quests: true, can_claim_territory: true }
```

### Faction Quest Types
- **Exploration** - Patrol territories
- **Collection** - Gather resources
- **Combat** - Fight enemies
- **Stealth** - Infiltration missions
- **Support** - Aid settlements/refugees

---

## Troubleshooting

### "/territory claim" shows "Requires Veteran rank"
**Expected behavior** - Players need to reach Veteran rank in faction first
```
Solution: Gain reputation to reach Veteran rank (50+ rep)
```

### "/faction-quest list" is empty
**Possible causes:**
1. Player not in a faction → Run `/faction choose`
2. Rank below Ally → Gain reputation to Ally rank
3. Quest ID mismatch → Check FACTION_QUESTS constant

### Territory income doesn't increase after claiming
**Check:**
```
1. Is territory actually claimed? (/territory list)
2. Is controlling_faction updated in territories table?
3. Try: getTerritoryIncome(userId) function call
```

### Hostility not showing in /faction status
**Check:**
1. Player has allegiance locked
2. Check faction_hostility table for entries
3. Verify auto-hostility logic ran on allegiance choice

---

## Phase 2 Implementation Status

✅ **Complete:**
- Territory system (list, income, claim)
- Faction quest system (list, accept, complete)
- Rank unlock gating
- Auto-hostility on allegiance
- Database schema
- Helper functions

⏳ **In Progress:**
- Daily income distribution
- Quest progress tracking

🔄 **Next Phase (Phase 3):**
- Territory contests/war mechanics
- Hit squad/ambush events
- Allegiance switching cooldowns
- Faction events

---

**Ready for testing!** Run through the checklist above and verify all systems work correctly.

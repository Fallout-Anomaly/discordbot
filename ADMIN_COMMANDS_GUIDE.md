# Admin Commands Guide

This guide documents all developer/admin commands available in the bot. These commands are restricted to bot developers only.

## User Management

### `/add-stat-points` - Award SPECIAL Points
**Purpose:** Grant perk points to a user directly  
**Usage:** `/add-stat-points user:@User amount:5`

**Parameters:**
- `user` (required): Target Discord user
- `amount` (required): Number of perk points to add (-100 to +100)

**Effects:**
- Adds perk points directly to user's account
- Updates stat_points in database
- Sends DM notification to user showing how many points they received
- Shows current level and new total in the DM

**Notes:**
- Can use negative amounts to remove points
- User receives notification via DM
- Useful for corrections or special rewards

---

### `/add-level` - Modify User Levels
**Purpose:** Set or add levels to a user  
**Usage:** `/add-level user:@User levels:5` (add mode) or `/add-level user:@User levels:50 mode:set` (set mode)

**Parameters:**
- `user` (required): Target Discord user
- `levels` (required): Number of levels to add/set (-100 to +100)
- `mode` (optional): Either "add" (default) or "set"

**Effects:**
- **Add mode:** Adds levels to current level (e.g., level 5 + 5 = level 10)
- **Set mode:** Sets exact level (e.g., sets to level 50 regardless of current)
- Automatically calculates and sets correct XP for target level
- Sends DM notification to user
- WARNING: Sends note that admin-granted levels don't give SPECIAL points

**Notes:**
- Cannot set below level 1
- XP calculation: `level * 1200 XP`
- Display shows before/after stats
- Level changes do NOT grant SPECIAL points to users

**Example:**
- `/add-level user:@Player levels:5` → Current level 10 becomes level 15
- `/add-level user:@Player levels:50 mode:set` → Player becomes level 50 (no matter current level)
- `/add-level user:@Player levels:-3` → Current level 10 becomes level 7

---

### `/sync-levels` - Repair Stale Level Data
**Purpose:** Update all user level columns to match their actual XP-calculated levels  
**Usage:** `/sync-levels` or `/sync-levels preview:true`

**Parameters:**
- `preview` (optional): Show changes without applying (default: false)

**What it does:**
1. Scans all users in database
2. Compares stored `level` column vs calculated level from XP
3. Updates mismatched levels
4. Shows top 10 biggest discrepancies

**Output:**
- Total users scanned
- Number to update
- Number already correct
- Top 10 mismatches (sorted by largest difference)

**Notes:**
- Run with `preview:true` first to see changes
- Run without preview to apply changes
- Fixes issue where old `level` column shows outdated data
- Essential after detecting level calculation bugs

**Example Use Case:** 
If a player shows as "Level 11" in database but their XP only calculates to "Level 5", this command will fix it.

---

## Faction Management

### `/add-reputation` - Modify Faction Reputation
**Purpose:** Add or remove faction reputation for a user  
**Usage:** `/add-reputation user:@User faction:brotherhood amount:25`

**Parameters:**
- `user` (required): Target Discord user
- `faction` (required): Choose from 9 factions:
  - ⚔️ Brotherhood of Steel
  - 🤖 Institute
  - 🇺🇸 Minutemen
  - 🚆 Railroad
  - 💀 Raiders
  - 🏜️ Wastelanders
  - 🏴 Smugglers
  - 🔫 Mercenaries
  - 💼 Syndicate
- `amount` (required): Rep to add/remove (-100 to +100)

**Effects:**
- Modifies faction reputation directly
- Bypasses daily reputation caps (admin privilege)
- Shows rank changes if applicable
- Sends DM notification to user
- Updates player_factions table
- Logs change to faction_rep_log

**Notes:**
- Can use negative amounts to remove rep
- Automatically promotes/demotes to appropriate rank
- Bypasses 10 rep/day limit for normal players
- User receives DM with before/after info

**Example:**
- `/add-reputation user:@Player faction:brotherhood amount:25` → +25 rep to Brotherhood (might promote rank)
- `/add-reputation user:@Player faction:railroad amount:-10` → -10 rep to Railroad

---

### `/reset-faction` - Remove Faction Allegiance
**Purpose:** Reset a user's faction allegiance and optionally their reputation  
**Usage:** `/reset-faction user:@User` or `/reset-faction user:@User keep_reputation:true`

**Parameters:**
- `user` (required): Target Discord user
- `keep_reputation` (optional): Keep rep with all factions (default: false)

**What it does:**
1. Deletes faction allegiance (unlocks them from faction choice)
2. Clears all faction hostilities
3. Optionally resets reputation to 0 (Outsider) or keeps current rep
4. Sends DM notification to user

**Effects:**
- User can choose a new faction (if Level 10+)
- Removes all hostile faction relationships
- Option to preserve or reset reputation

**Notes:**
- User will receive DM notification
- Shows previous faction and rank info
- Useful for:
  - Fixing stuck allegiances
  - Allowing faction restarts
  - Correcting mistakes
  - Testing faction systems

**Example:**
- `/reset-faction user:@Player` → Remove faction, reset all rep to 0
- `/reset-faction user:@Player keep_reputation:true` → Remove faction but keep their rep with all factions

---

## Database & Utility Commands

### `/give-caps` - Award Currency
**Purpose:** Give caps to a user  
**Usage:** `/give-caps user:@User amount:1000`

**Notes:**
- Direct currency award
- Updates balance in database
- Can be negative to remove caps

---

### `/report` - Player Report System
**Purpose:** Allow players to report rule violations  
**Usage:** Player runs: `/report @User Reason`

**Notes:**
- Alerts staff team privately
- Creates ticket for investigation
- Include user mention and clear reason

---

## Common Admin Tasks

### Task: Fix a player's level after XP bug
1. Check their actual XP with `/balance` or database query
2. Use `/add-level user:@Player levels:X mode:set` to set correct level
3. OR use `/sync-levels preview:true` to check all users, then `/sync-levels` to apply

### Task: Manually progress a player through faction content
1. Use `/add-level user:@Player levels:10 mode:set` to get them to level 10
2. Use `/add-reputation user:@Player faction:brotherhood amount:60` to reach Veteran rank
3. Player can now claim territories and access tier-2 quests

### Task: Reset a player's faction choice
1. Use `/reset-faction user:@Player keep_reputation:true`
2. Player can now choose a different faction at their next login
3. They keep their reputation from before but lose allegiance lock

### Task: Award perk points for special event/reward
1. Use `/add-stat-points user:@Player amount:5`
2. Player receives DM with point details
3. They can spend points in `/build` command

---

## Important Notes

- **All commands send DM notifications** to affected users (where applicable)
- **Daily caps bypassed** for admin reputation changes
- **Database changes are immediate** - no confirmation step
- **Commands are ephemeral** - only visible to the admin who ran them
- **All actions are logged** in appropriate database tables

---

## Troubleshooting Admin Commands

**"Failed to modify reputation: undefined"**
- This was a bug in earlier versions - check if bot is updated
- `modifyReputation` should return proper status object

**"User not found in database"**
- User needs to use at least one command to create database record
- Have them run `/balance` or `/profile` first

**Player shows wrong level after level sync**
- Run `/sync-levels preview:true` to verify correct calculation
- Check XP values: `level = floor(xp / 1200)`
- Report if calculation differs


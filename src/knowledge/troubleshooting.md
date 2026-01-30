# Troubleshooting Guide

## 🚨 Common Error Messages & Installation Issues

### "Could Not Download MOD"
- **Fix**: Manually download the specific file from Nexus Mods and place it into your **Wabbajack Download Folder**.
- **Reason**: Nexus servers might be busy, or the file was momentarily unavailable.
- **Check**: [Nexus Mods Status](https://nexusmods.statuspage.io/)

### "Mod Is Not a Whitelisted Download"
- **Fix**: The modlist version you are installing might be outdated, or the mod author updated the file. Wait for a modlist update or check Discord for a workaround.

### "Missing Game Files"
- **Fix**: Verify your game files in Steam. Ensure you have the **Next-Gen Update** installed (Wabbajack handles the downgrade automatically, but needs the base files).

### "Wabbajack Could Not Find My Game Folder"
- **Fix**: Launch Fallout 4 normally via Steam **once** to generate registry keys.
- **Note**: Pirated copies are **not supported**.

### "Antivirus Flagging Files"
- **Fix**: Add an **Exclusion** for your entire Modlist Installation folder in Windows Defender/Antivirus.
- **Reason**: Modding tools (like older dlls) are often false-flagged. Wabbajack downloads are safe.

---

## 📺 Visual & Display Fixes (Resolution Issues)

### Screen in Upper Left / Boxed Display / Refracted
This is the most common issue for 1440p+ or Ultrawide monitors. Follow these steps in order:

1.  **Disable Third-Party Software**: Turn off Medal, Nvidia GeForce Experience Overlay, Discord Overlay, etc.
2.  **Verify Native Resolution**: Ensure your monitor is set to its native resolution in Windows.
3.  **BethINI Fix**:
    *   Close Mod Organizer 2.
    *   Run `Tools/BethINI/BethINI.exe` (inside your install folder) as Administrator.
    *   Set your correct resolution (e.g., 2560x1440) in the "Basic" tab.
    *   Click **Save and Exit**.
4.  **INI Verification**:
    *   Open MO2 -> INI Editor (Puzzle piece icon) -> `Fallout4Prefs.ini`.
    *   Ensure **only one** is set to 1: `bFullscreen=1` OR `bBorderless=1` (usually Borderless is best).
5.  **DPI Scaling Override (Last Resort)**:
    *   Go to `Stock Game Folder` -> Right-click `Fallout4.exe` -> Properties.
    *   Compatibility Tab -> "Change High DPI settings".
    *   Check "**High DPI Scaling Override**" and set to **Application**.

---

## 💥 Crashes & Freezes

### Initial Startup / Main Menu
- **Main Menu Delay**: It is normal for the main menu to lag for 10-30 seconds while scripts initialize.
- **Stuck in Main Menu**: If you cannot click anything, wait 5 minutes. If still stuck, use the "Pre-Made Save" available in Discord.
- **Crash on Startup**:
    *   **Overlays**: Disable Steam Overlay, Discord Overlay, Medal, etc.
    *   **Page File**: Ensure you have a **20GB+ Page File** set on your drive (see `install-faq.md`).
    *   **Weapon Debris**: Turn **OFF** Weapon Debris in the launcher options (Critical for Nvidia cards).

### Gameplay Crashes
- **Post-Character Creation Freeze**: After making your character, the game WILL freeze for 1-3 minutes. **DO NOT CLOSE IT**. This is scripts setting up everything.
- **Falling Through Vault Floor**: Do **NOT** enable "Uneducated Shooter" mod until *after* you leave Vault 111.

---

## 🐛 Gameplay Bugs
- **Naked Raiders**: Known issue with Merc Veteran armor. Patches are being worked on.
- **Stuck in Animation**: Open console (`~`) and type `PushActorAway player 1` to break the animation lock.

## 🔗 Getting Support
If these steps don't help, please submit a bug report:
[Fallout Anomaly Bug Reports](https://falloutanomaly.fillout.com/bugreports)

# Troubleshooting

## Initial Startup Issues
- **MCM/Pip-Boy Freeze**: When you first pick up your Pip-Boy or open the MCM in the vault, the game may freeze or take a long time to respond. This is normal; dozens of scripts are firing off at once. Wait a minute or two for them to finish.
- **Missing Jump/Buttons**: If your controls aren't working right after starting, try restarting the game. Some scripts only finish loading after you exit Vault 111.

## Visual & Performance
- **Stuttering**: If you have high FPS but see stuttering, it may be a VRAM bottleneck. 
- **Wabbajack Errors**: Most "Fallout 76" or "meshes.ba2" errors are false positives or temporary metadata issues. Refer to `install-faq.md` for the full fix.
- **External Drives**: Ensure your game is installed on an internal SSD to avoid major performance hits.
- **MCM/Pip-Boy Freeze**: When you first pick up your Pip-Boy or open the MCM in the vault, the game may freeze for 1-2 minutes. This is normal script initialization.
- **Post-Character Freeze**: The game will save and freeze for a few minutes after character creation. **Wait and do not force close the game.**

## Visual & Display Fixes
- **Screen in Upper Left / Boxed Display**:
    1. **Disable Overlays**: Disable Discord, Steam, Medal, etc.
    2. **BethINI**: Close MO2. Run `BethINI.exe` as admin. Set correct resolution and click Save.
    3. **INI Check**: In MO2, ensure `Fallout4Prefs.ini` has either `bFullscreen=1` or `bBorderless=1`, but not both.
    4. **DPI Override**: Right-click `Fallout4.exe` in your **Stock Folder** -> Properties -> Compatibility -> Change High DPI settings -> Check "High DPI Scaling Override" -> Set to **Application**.

## Common Bugs & Fixes
- **Falling Through Vault Floor**: This is caused by the "Uneducated Shooter" mod. **Only enable this mod after you leave the vault.**
- **Stuck in Main Menu**: Often caused by slow script loads. Wait at least 5 minutes. If it persists, use one of the pre-made save files provided in the Discord.
- **Naked Raiders**: This is a known issue with the Merc Veteran armor. Eizer's Robco patches help minimize this.
- **Stuck in Animation**: Use the console command `PushActorAway player 1` to break locks.

## Bug Reports
- Use the official bug report form: [Fallout Anomaly Bug Reports](https://falloutanomaly.fillout.com/bugreports)

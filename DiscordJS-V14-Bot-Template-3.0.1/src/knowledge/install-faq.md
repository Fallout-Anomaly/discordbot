# Wabbajack & Installation FAQ

## Critical Prerequisites
- **Steam Version Only**: Only the Steam version of Fallout 4 is supported. Update to the latest "Next-Gen" version (1.10.980); Wabbajack will handle the downgrade to 1.10.163 automatically.
- **Visual C++ & .NET**: Ensure you have installed [Microsoft Visual C++ AIO](https://github.com/abbodi1406/vcredist/releases) and [.NET Framework 4.6.2 & 5.0](https://dotnet.microsoft.com/en-us/download/dotnet-framework).
- **Page File**: Configure at least a **16GB Page File** on your SSD to prevent out-of-memory crashes.
- **Launch Vanilla Once**: You must launch the vanilla game once through Steam to set registry keys before using Wabbajack.

## Common Download & Install Errors
- **Antivirus Interference**: Add a folder exclusion for your entire Fallout Anomaly installation folder to prevent AV from deleting critical DLLs.
- **Disable Overlays**: Steam, Discord, Medal, and OBS overlays cause immediate crashes. Disable them before launching.
- **ENB Download Fail**: If Wabbajack fails to download the ENB, download it manually from [enbdev.com](http://enbdev.com/mod_fallout4_v0501.htm) and place the zip (DO NOT EXTRACT) into your Wabbajack **Downloads** folder.
- **False Positive: "Fallout 76" Error**: Safe to ignore.

## Installation Best Practices
- **Internal SSD Required**: 350GB of SSD space is required. External drives cause extreme stuttering and crashes.
- **Updating**: To update, run Wabbajack and point it to your existing folders. It will only download the updated files (Delta update).

## Technical Initial Setup
- **MCM Initialization**: The first launch involves dozens of scripts firing. Your game will likely freeze for 1-2 minutes when you first open the MCM or pick up the Pip-Boy. **Be patient.**
- **Post-Character Freeze**: The game may appear to freeze after you finish creating your character. This is normal script initialization; wait it out.

# WodUp to PushPress Export - Files Summary

## Your Personal Export (Already Complete!)

Your data has been exported to `wodup-export/` directory:

### Ready for PushPress Import:
- **`workouts.csv`** (274 KB) - Upload this to PushPress Train!

### For Your Records:
- `summary.txt` - Your fitness journey overview
- `strength-lifts.csv` - All max lifts by movement
- `benchmark-wods.csv` - Benchmark WOD times
- `all-workouts.csv` - Complete workout log
- `wodup-report.json` - Structured data
- `timeline-raw.json` - Raw WodUp data
- `PUSHPRESS-IMPORT-GUIDE.md` - Import instructions
- `README.md` - File descriptions

## Files to Share with Gym Mates

These 4 files help others export their own data:

1. **`wodup-exporter-public.js`** (26 KB)
   - Main export script
   - Detailed inline documentation
   - Helpful error messages

2. **`WODUP-EXPORT-INSTRUCTIONS.md`** (6.4 KB)
   - Complete step-by-step guide
   - Screenshots descriptions
   - Troubleshooting section

3. **`QUICK-START.txt`** (1.8 KB)
   - Simple quick reference
   - Perfect for less technical people

4. **`share-with-gym.txt`** (1.5 KB)
   - How to distribute the files
   - Sample message for group chat
   - Support tips

## What Changed from Original Script

The public version (`wodup-exporter-public.js`) now:
- ✅ Generates PushPress-compatible `workouts.csv`
- ✅ Includes all 11 required PushPress columns
- ✅ Formats dates as YYYYMMDD
- ✅ Maps workout types to score_type (time/reps/weight)
- ✅ Extracts set details for strength workouts
- ✅ Preserves all notes and PR flags

## PushPress Import Format

The `workouts.csv` file has these columns:

1. **date** - YYYYMMDD format (e.g., 20251128)
2. **title** - Workout name
3. **description** - Full workout description
4. **best_result_raw** - Numeric score for sorting
5. **best_result_display** - Human-readable score (e.g., "6:26")
6. **score_type** - time, reps, or weight
7. **barbell_lift** - true for strength workouts
8. **set_details** - "5x365lbs, 5x385lbs, ..." for strength
9. **notes** - Your personal workout notes
10. **rx_or_scaled** - rx or scaled
11. **pr** - true or false

## Next Steps

### For You:
1. Review your `wodup-export/summary.txt` 
2. Upload `wodup-export/workouts.csv` to PushPress
3. Verify your data imported correctly

### For Your Gym:
1. Create a shared folder (Google Drive/Dropbox)
2. Upload the 3 shareable files:
   - wodup-exporter-public.js
   - WODUP-EXPORT-INSTRUCTIONS.md
   - QUICK-START.txt
3. Share in your gym's group chat
4. Help people who get stuck!

## Important Reminders

- Session tokens expire - people need fresh ones from their browser
- Each person needs their own user ID
- The script only reads data, never modifies anything
- All data stays local on their computer
- PushPress only shows 50 most recent workouts in timeline view

## Sample Message for Your Gym

"Hey Override fam! 👋

Before we switch to PushPress, I built a tool to export all your WodUp data - 
every workout, every PR, every max lift - so you can import it into PushPress!

It takes about 5 minutes and you'll have your complete fitness history backed up.

Download these files and follow the QUICK-START guide:
[Your shared folder link]

Questions? Ask me at the gym!

- Chris"

---

Created: November 28, 2025
For: CrossFit Override gym migration

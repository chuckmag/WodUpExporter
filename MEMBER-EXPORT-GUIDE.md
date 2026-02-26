# WodUp Member Export Tool (With Consent)

## Purpose

This script allows you to export PUBLIC workout data for a gym member **who has given you explicit permission**. This is useful when:
- A member is not tech-savvy and asks for help
- You want to batch-export for multiple consenting members
- The member prefers you handle the export process

## Important: Consent Required

**Before using this tool:**
1. Get explicit verbal or written permission from the member
2. Explain what data will be exported (all their public workout results)
3. Keep a record of who gave permission and when
4. Only export data for members who have consented

**This tool only accesses PUBLIC data** - the same data visible on gym leaderboards to anyone logged into WodUp.

## How It Works

The script:
1. Uses YOUR session token to access the gym's public leaderboards
2. Fetches all WODs from the gym (from your timeline)
3. For each WOD, gets the public leaderboard results
4. Filters to only the specified member's results
5. Generates a PushPress-compatible import file

## Usage

### Quick Run

```bash
SESSION_TOKEN="your_token_here" node wodup-member-export.js bryanash
```

Replace `bryanash` with the member's WodUp username.

### Find a Member's Username

1. Go to WodUp and find one of their workout results
2. Click on their name
3. Look at the URL: `wodup.com/users/USERNAME`
4. Or check the @username in their profile

## Output Files

The script creates 3 files in `OverrideMemberExports/`:

1. **`[Name]OverrideImport.csv`** - PushPress import file
   - Ready to upload to PushPress Train
   - Contains all public workout results
   - Properly formatted dates (YYYYMMDD)

2. **`[Name]-summary.txt`** - Export summary
   - Total workouts found
   - Date range
   - Consent documentation
   - Next steps

3. **`[Name]-raw-data.json`** - Raw data backup
   - Complete data in JSON format
   - For reference or debugging

## What Gets Exported

**✅ Included:**
- All publicly posted workout results
- Workout names and descriptions
- Scores (times, reps, weights)
- Personal notes the member added
- RX/Scaled status
- PR flags
- Set details for strength workouts

**❌ Not Included:**
- Private/hidden workouts
- Workouts the member didn't post publicly
- Social interactions (comments/likes)
- Personal profile information

## Performance

- Processes approximately **3-5 WODs per second** (with rate limiting)
- For 2 years of data (~600 WODs): **2-3 minutes**
- Shows progress every 10 WODs

## Limitations

**Limited to public data only:**
- If a member sets workouts to private, those won't be exported
- This is by design - respects member privacy settings

**Date range limitation:**
- Only checks WODs that appear in YOUR timeline
- If the member joined before you, older workouts won't be found
- Solution: Adjust `startDate` in CONFIG to go further back

**May miss some workouts:**
- If the member logged a workout on a date/WOD you didn't attend
- Only WODs from your timeline are checked

## Batch Export for Multiple Members

To export for multiple members with permission:

```bash
# Create a list of usernames
for username in bryanash alyssamiller kateschilling; do
  echo "Exporting for $username..."
  SESSION_TOKEN="your_token" node wodup-member-export.js $username
  sleep 5  # Wait between exports
done
```

## Consent Record Template

Keep a record of permissions:

```
WODUP EXPORT CONSENT LOG
========================

Member: Bryan Ash (@bryanash)
Permission granted: November 28, 2025
Method: Verbal consent in person at gym
Purpose: Export WodUp data for PushPress migration
Exported by: Chris Magrane
Export date: November 28, 2025

Member: [Next member name]
Permission granted: [Date]
...
```

## Ethics & Best Practices

**DO:**
- ✅ Get explicit permission before exporting
- ✅ Explain what data will be exported
- ✅ Keep records of who consented
- ✅ Only access public leaderboard data
- ✅ Delete data after providing it to the member

**DON'T:**
- ❌ Export without permission (even if data is public)
- ❌ Share exported data with anyone except the member
- ❌ Keep copies after giving it to the member
- ❌ Use the data for any other purpose

## Troubleshooting

### "No public results found"
- Check the username is spelled correctly
- Member may have privacy settings on
- Member may not have posted publicly
- Try a more recent date range

### Script is slow
- This is normal - it checks hundreds of WODs
- Rate limiting prevents API overload
- Be patient - it will complete!

### Some workouts seem missing
- Member may have set some to private
- You may need to extend the date range
- Some workouts may be from WODs you didn't attend

## Example Output

```
Member: Bryan Ash (@bryanash)
Found 543 public workout results

Files created:
  ✓ OverrideMemberExports/BryanAshOverrideImport.csv
  ✓ OverrideMemberExports/BryanAsh-summary.txt
  ✓ OverrideMemberExports/BryanAsh-raw-data.json
```

---

**Created by:** Chris Magrane
**Date:** November 2025
**Purpose:** CrossFit Override member data export with consent

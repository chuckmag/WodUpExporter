# WodUp Data Exporter

Export your complete WodUp workout history before switching to PushPress!

## What This Does

This script downloads all your workout data from WodUp including:
- Complete workout history with all results and notes
- Strength training max lifts for every movement
- Benchmark WOD times (Fran, Grace, Murph, Jackie, Nancy, etc.)
- All your personal records (PRs)
- Detailed workout notes and scaling information
- **PushPress-ready import file** (workouts.csv)

Perfect for backing up your fitness journey or migrating to PushPress!

## Requirements

- **Node.js** installed on your computer ([Download here](https://nodejs.org/))
- A **WodUp account** with workout history
- 5-10 minutes of your time

## Step-by-Step Instructions

### Step 1: Download the Script

Download the `wodup-exporter-public.js` file to your computer.

### Step 2: Get Your Session Token

This is like a temporary password that lets the script access your data.

**Method A - Using Application Tab (Easiest):**
1. Open [WodUp](https://www.wodup.com) in your web browser
2. Log in to your account
3. Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac) to open Developer Tools
4. Click the **"Application"** tab (Chrome) or **"Storage"** tab (Firefox)
5. In the left sidebar, expand **"Cookies"** and click on `https://www.wodup.com`
6. Find the cookie named **`session_token`**
7. **Copy the entire Value** (it's a long string starting with `SFMyNTY...`)

**Method B - Using Network Tab:**
1. Open [WodUp](https://www.wodup.com) in your browser and log in
2. Press **F12** (or **Cmd+Option+I** on Mac) to open Developer Tools
3. Click the **"Network"** tab
4. Refresh your timeline page
5. Click on any request that says **"graphql"**
6. Look in **"Request Headers"** for the **"Cookie"** header
7. Find `session_token=` and copy everything after the `=` until the next `;`

**Example session token:**
```
SFMyNTY.g2gDbQAAACBpgL2g_gWlY65znwoeZevMylpwWm1NSKel_bQSYV4qYW4GAAEMx3uVAWIu_geA.C1OiByo7GptqfhxlVnLWL4Hfy1T5HNzZlt4fXDoQPLQ
```

### Step 3: Get Your User ID

1. While still on your WodUp timeline with Developer Tools open
2. Go to the **"Network"** tab
3. Find a request to **"graphql"** (look for one that says "TimelineFetchMore")
4. Click on it and select the **"Response"** tab
5. Look for `"currentUser"` → `"id"` - this is your user ID (usually a 5-6 digit number)

**Example:** `"id": "111225"`

### Step 4: Configure the Script

Open `wodup-exporter-public.js` in a text editor and find the **CONFIG** section (around line 120).

Update these three values:

```javascript
const CONFIG = {
  userId: '111225',  // ← CHANGE THIS to your user ID from Step 3
  startDate: '2023-10-01',  // ← CHANGE THIS to when you started at your gym
  endDate: '2025-11-28',  // ← CHANGE THIS to today's date
  sessionToken: process.env.SESSION_TOKEN,  // ← Leave this as-is
  // ... rest of config
};
```

### Step 5: Run the Script

Open Terminal (Mac) or Command Prompt (Windows), navigate to where you saved the script, and run:

```bash
SESSION_TOKEN="paste_your_session_token_here" node wodup-exporter-public.js
```

**Replace `paste_your_session_token_here`** with your actual session token from Step 2.

**Example:**
```bash
SESSION_TOKEN="SFMyNTY.g2gDbQAAACBpgL2g_gWlY65znwoeZevMylpwWm1NSKel_bQSYV4qYW4GAAEMx3uVAWIu_geA.C1OiByo7GptqfhxlVnLWL4Hfy1T5HNzZlt4fXDoQPLQ" node wodup-exporter-public.js
```

**Note for Windows users:** Use this format instead:
```cmd
set SESSION_TOKEN=paste_your_session_token_here
node wodup-exporter-public.js
```

### Step 6: Find Your Exported Data

The script will create a `wodup-export/` folder with these files:

- **`workouts.csv`** ⭐ **IMPORT THIS INTO PUSHPRESS!** ⭐
- **`summary.txt`** - Quick overview of your stats
- **`strength-lifts.csv`** - All your max lifts (open in Excel/Google Sheets)
- **`benchmark-wods.csv`** - Benchmark WOD times
- **`all-workouts.csv`** - Complete workout log
- **`wodup-report.json`** - Full processed data
- **`timeline-raw.json`** - Complete raw data from WodUp

### Step 7: Import to PushPress

1. Log in to your PushPress Train account
2. Navigate to Settings → Import Workout History
3. Upload the **`workouts.csv`** file
4. Follow the PushPress import wizard
5. Done! Your entire workout history is now in PushPress

## What You'll See

The script will show progress like this:

```
============================================================
WodUp Timeline Data Exporter
============================================================
Starting data fetch from 2025-11-28 back to 2023-10-01

Fetching page 1 (2025-10-29 to 2025-11-28)...
  Found 31 days of data

Fetching page 2 (2025-09-29 to 2025-10-28)...
  Found 30 days of data

...

✓ Fetched 789 total days of data across 27 pages
✓ Saved raw timeline data
✓ Saved processed report
✓ Saved CSV files

SUMMARY
-------
Total Workouts: 1735
Total PRs: 179
...

✅ Export complete!
```

## Troubleshooting

### "SESSION_TOKEN environment variable not set"
You forgot to provide your session token. Follow Step 5 carefully.

### "GraphQL query failed" or errors about authentication
Your session token has expired. Go back to Step 2 and get a fresh token.

### Script runs but exports 0 workouts
- Double-check your **user ID** is correct (Step 3)
- Verify your **date range** matches when you actually have workouts logged
- Your session token might be expired

### "No data in this range" for all pages
Your user ID is probably wrong. Follow Step 3 to get the correct one.

## Security Notes

- Your session token is like a temporary password - **don't share it publicly**
- Session tokens expire after a few months
- This script only **reads** your data, it never modifies anything
- All data stays on your computer - nothing is uploaded anywhere

## What's Next?

Once you have your data exported:

1. **Review the summary.txt** to see your fitness journey at a glance
2. **Open the CSV files** in Excel/Google Sheets to explore your data
3. **Check PushPress documentation** for their import API format
4. **Transform the CSV data** to match PushPress requirements

The CSV files are already in a universal format that should be easy to import into most fitness tracking platforms.

## Need Help?

Common issues and solutions:

**Q: How long does this take?**
A: About 30-45 seconds per year of data (due to API rate limiting)

**Q: Can I run this multiple times?**
A: Yes! It will overwrite the previous export each time.

**Q: Will this work if I leave my gym?**
A: Yes, as long as your WodUp account is still active.

**Q: What if WodUp changes their API?**
A: The script might need updates. Contact the person who shared this with you.

**Q: Can I export someone else's data?**
A: No - the session token only works for the logged-in user's data.

---

**Created by:** Chris Magrane
**Date:** November 2025
**Purpose:** CrossFit Override gym migration to PushPress

#!/usr/bin/env node

/**
 * ========================================
 * WodUp Member Export (With Consent)
 * ========================================
 *
 * This script exports PUBLIC workout data for a specific gym member
 * who has granted explicit permission for their data to be exported.
 *
 * IMPORTANT CONSENT REQUIREMENT:
 * - You MUST have explicit permission from the member before running this
 * - This script only accesses publicly posted workout results
 * - Keep a record of who gave you permission and when
 *
 * ========================================
 * HOW IT WORKS
 * ========================================
 *
 * 1. Uses your session token to access the gym's public leaderboards
 * 2. Finds all WODs from your own timeline (date range)
 * 3. For each WOD, fetches the public leaderboard results
 * 4. Filters to only the specified member's results
 * 5. Generates a PushPress-compatible import file
 *
 * ========================================
 * USAGE
 * ========================================
 *
 * SESSION_TOKEN="your_token" node wodup-member-export.js bryanash
 *
 * Or edit the CONFIG below to set:
 * - targetUsername: The member's WodUp username
 * - sessionToken: Your session token
 * - startDate/endDate: Date range to search
 *
 * ========================================
 */

const https = require('https');
const fs = require('fs');

// Configuration
const CONFIG = {
  // Target member's username (the person who gave you permission)
  targetUsername: process.argv[2] || 'bryanash',  // ← CHANGE THIS or pass as argument

  // Your session token (needed to access public leaderboards)
  sessionToken: process.env.SESSION_TOKEN,

  // Date range (should match the WODs you have in your timeline)
  startDate: '2023-10-01',
  endDate: '2025-11-28',

  // Your own user ID (to fetch the list of WODs)
  myUserId: '111225',

  // API config
  apiUrl: 'www.wodup.com',
  outputDir: './OverrideMemberExports'
};

// GraphQL Queries
const TIMELINE_QUERY = `
query TimelineFetchMore($startDate: Date!, $endDate: Date!) {
  currentUser {
    id
    activityTimeline(startDate: $startDate, endDate: $endDate) {
      id
      date
      completedWodsOccursOnDate {
        id
        name
        occursOn
        wodComponents {
          id
          prefix
          workout {
            id
            name
            description
            type
          }
        }
      }
    }
  }
}
`;

const WOD_RESULTS_QUERY = `
query WodDetailResults($wodId: ID!) {
  wod(id: $wodId) {
    id
    occursOn
    name
    publishAt
    wodComponents {
      id
      prefix
      workout {
        id
        type
        name
        description
        details
        movementData: movements {
          id
          name
          slug
          category
        }
      }
    }
    results {
      id
      userId
      description
      doneOn
      doneAt
      type
      pr
      prAmount
      notes
      scaling
      perceivedExertion
      score
      details
      wodComponentId
      user {
        id
        name
        username
      }
    }
  }
}
`;

function makeGraphQLRequest(operation, query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      operationName: operation,
      query: query,
      variables: variables
    });

    const options = {
      hostname: CONFIG.apiUrl,
      path: `/api/graphql?op=${operation}`,
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'cookie': `session_token=${CONFIG.sessionToken}`,
        'wodup-version': '1.0',
        'Referer': 'https://www.wodup.com/feed/following'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (error) {
          reject(new Error(`Failed to parse: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getMyTimeline() {
  console.log('Fetching your timeline to get list of WODs...\n');

  const allWods = [];
  const startDate = new Date(CONFIG.startDate);
  const endDate = new Date(CONFIG.endDate);
  let currentEndDate = new Date(endDate);

  while (currentEndDate >= startDate) {
    const chunkStartDate = new Date(currentEndDate);
    chunkStartDate.setDate(chunkStartDate.getDate() - 29);
    const actualStartDate = chunkStartDate < startDate ? startDate : chunkStartDate;

    const response = await makeGraphQLRequest('TimelineFetchMore', TIMELINE_QUERY, {
      startDate: actualStartDate.toISOString().split('T')[0],
      endDate: currentEndDate.toISOString().split('T')[0]
    });

    if (response.errors) {
      throw new Error('Failed to fetch timeline');
    }

    const timeline = response.data?.currentUser?.activityTimeline || [];
    timeline.forEach(day => {
      day.completedWodsOccursOnDate?.forEach(wod => {
        allWods.push({
          id: wod.id,
          date: wod.occursOn,
          name: wod.name,
          components: wod.wodComponents
        });
      });
    });

    currentEndDate = new Date(actualStartDate);
    currentEndDate.setDate(currentEndDate.getDate() - 1);

    if (actualStartDate <= startDate) break;

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`✓ Found ${allWods.length} WODs in date range\n`);
  return allWods;
}

async function getMemberResultsForWod(wodId) {
  const response = await makeGraphQLRequest('WodDetailResults', WOD_RESULTS_QUERY, {
    wodId: wodId
  });

  if (response.errors) {
    console.error(`  Error fetching WOD ${wodId}:`, response.errors);
    return null;
  }

  const wod = response.data?.wod;
  if (!wod) return null;

  // Filter to only target member's results
  const memberResults = (wod.results || []).filter(r =>
    r.user?.username === CONFIG.targetUsername
  );

  return {
    wod: wod,
    memberResults: memberResults
  };
}

async function fetchAllMemberResults(wods) {
  console.log(`Fetching ${CONFIG.targetUsername}'s results from ${wods.length} WODs...\n`);

  const allResults = [];
  let foundCount = 0;

  for (let i = 0; i < wods.length; i++) {
    const wod = wods[i];

    if (i % 10 === 0) {
      console.log(`Progress: ${i}/${wods.length} WODs checked, ${foundCount} results found`);
    }

    try {
      const data = await getMemberResultsForWod(wod.id);

      if (data && data.memberResults.length > 0) {
        data.memberResults.forEach(result => {
          allResults.push({
            wod: data.wod,
            result: result,
            wodComponents: data.wod.wodComponents
          });
        });
        foundCount += data.memberResults.length;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`  Error with WOD ${wod.id}:`, error.message);
    }
  }

  console.log(`\n✓ Found ${allResults.length} total results for ${CONFIG.targetUsername}\n`);
  return allResults;
}

function generatePushPressCSV(memberData, memberName) {
  const pushPressCSV = [
    'date,title,description,best_result_raw,best_result_display,score_type,barbell_lift,set_details,notes,rx_or_scaled,pr'
  ];

  memberData.forEach(({ wod, result, wodComponents }) => {
    // Skip warm-ups
    if (result.type === 'WarmUpResult') return;

    // Date in YYYYMMDD format
    const dateFormatted = result.doneOn.replace(/-/g, '');

    // Find the workout component for this result
    const component = wodComponents?.find(c => c.id === result.wodComponentId);
    const workout = component?.workout;

    // Determine score type and values
    let scoreType = '';
    let bestResultRaw = '';
    let bestResultDisplay = result.description || '';
    let barbellLift = '';
    let setDetails = '';

    if (result.type === 'StrengthResult') {
      scoreType = 'weight';
      barbellLift = 'true';

      if (result.details?.sets) {
        const sets = result.details.sets;
        setDetails = sets.map(s => `${s.reps}x${s.load}${s.loadUnit}`).join(', ');
        const maxWeight = Math.max(...sets.map(s => s.load || 0));
        bestResultRaw = maxWeight.toString();
        bestResultDisplay = result.description || `${maxWeight} lbs`;
      }
    } else if (result.type === 'ForTimeResult') {
      scoreType = 'time';
      bestResultRaw = Math.abs(result.score || 0).toString();
      bestResultDisplay = result.description || '';
    } else if (result.type === 'AmrapResult' || result.type === 'GenericResult') {
      if (result.details?.reps) {
        scoreType = 'reps';
        bestResultRaw = result.details.reps.toString();
        bestResultDisplay = result.description || `${result.details.reps} reps`;
      } else if (result.details?.weight) {
        scoreType = 'weight';
        bestResultRaw = result.details.weight.toString();
        bestResultDisplay = result.description || `${result.details.weight} ${result.details.weightUnit || 'lbs'}`;
      } else {
        scoreType = 'reps';
        bestResultRaw = Math.abs(result.score || 0).toString();
        bestResultDisplay = result.description || '';
      }
    }

    // workout.description is the component name (e.g., "Front Squat + Back Squat 1.5 Reps")
    // workout.details.description is the detailed instructions
    const title = (workout?.description || workout?.details?.name || wod.name || 'Workout').replace(/"/g, '""').replace(/\n/g, ' ');
    const description = (workout?.details?.description || workout?.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const notes = (result.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const rxScaled = result.scaling === 'rx' || result.scaling === 'rxplus' ? 'rx' : 'scaled';
    const isPR = result.pr ? 'true' : 'false';

    pushPressCSV.push([
      dateFormatted,
      `"${title}"`,
      `"${description}"`,
      bestResultRaw,
      `"${bestResultDisplay}"`,
      scoreType,
      barbellLift,
      `"${setDetails}"`,
      `"${notes}"`,
      rxScaled,
      isPR
    ].join(','));
  });

  return pushPressCSV.join('\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('WodUp Member Export (With Consent)');
  console.log('='.repeat(60));
  console.log(`\nTarget Member: ${CONFIG.targetUsername}`);
  console.log(`Date Range: ${CONFIG.startDate} to ${CONFIG.endDate}\n`);

  // Validate
  if (!CONFIG.sessionToken) {
    console.error('❌ SESSION_TOKEN not set\n');
    console.log('Run: SESSION_TOKEN="your_token" node wodup-member-export.js username\n');
    process.exit(1);
  }

  if (!CONFIG.targetUsername) {
    console.error('❌ Target username not specified\n');
    console.log('Run: SESSION_TOKEN="your_token" node wodup-member-export.js bryanash\n');
    process.exit(1);
  }

  console.log('⚠️  CONSENT REMINDER:');
  console.log('   You must have explicit permission from this member');
  console.log('   to export their workout data.\n');
  console.log('   Press Ctrl+C to cancel if you do not have permission.\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    // Create output directory
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir);
    }

    // Step 1: Get list of all WODs from your timeline
    const wods = await getMyTimeline();

    // Step 2: Fetch member's public results from each WOD
    const memberData = await fetchAllMemberResults(wods);

    if (memberData.length === 0) {
      console.log(`\n⚠️  No public results found for ${CONFIG.targetUsername}`);
      console.log('   Possible reasons:');
      console.log('   - Username is incorrect');
      console.log('   - Member has not posted any public results');
      console.log('   - Member joined after the date range\n');
      process.exit(0);
    }

    // Step 3: Get member's full name
    const memberName = memberData[0].result.user.name;
    const memberFullName = memberName.replace(/\s+/g, '');

    console.log(`Member: ${memberName} (@${CONFIG.targetUsername})`);
    console.log(`Found ${memberData.length} public workout results\n`);

    // Step 4: Generate PushPress CSV
    const csvContent = generatePushPressCSV(memberData, memberName);
    const filename = `${CONFIG.outputDir}/${memberFullName}OverrideImport.csv`;

    fs.writeFileSync(filename, csvContent);

    // Step 5: Save raw data for reference
    const rawFilename = `${CONFIG.outputDir}/${memberFullName}-raw-data.json`;
    fs.writeFileSync(rawFilename, JSON.stringify(memberData, null, 2));

    // Step 6: Generate summary
    const summary = generateMemberSummary(memberData, memberName);
    const summaryFilename = `${CONFIG.outputDir}/${memberFullName}-summary.txt`;
    fs.writeFileSync(summaryFilename, summary);

    console.log('='.repeat(60));
    console.log('EXPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`\nMember: ${memberName} (@${CONFIG.targetUsername})`);
    console.log(`Total Workouts: ${memberData.length}`);
    console.log(`\nFiles created:`);
    console.log(`  ✓ ${filename}`);
    console.log(`  ✓ ${summaryFilename}`);
    console.log(`  ✓ ${rawFilename}`);
    console.log(`\nThe ${memberFullName}OverrideImport.csv file is ready to import into PushPress!\n`);

    console.log(summary);

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function generateMemberSummary(memberData, memberName) {
  const workouts = memberData.map(d => d.result);

  const summary = {
    totalWorkouts: workouts.length,
    dateRange: {
      start: workouts[workouts.length - 1]?.doneOn || 'N/A',
      end: workouts[0]?.doneOn || 'N/A'
    },
    totalPRs: workouts.filter(r => r.pr).length,
    rxWorkouts: workouts.filter(r => r.scaling === 'rx' || r.scaling === 'rxplus').length,
    workoutTypes: {
      strength: workouts.filter(r => r.type === 'StrengthResult').length,
      forTime: workouts.filter(r => r.type === 'ForTimeResult').length,
      amrap: workouts.filter(r => r.type === 'GenericResult' || r.type === 'AmrapResult').length
    }
  };

  let text = `WodUp Export for ${memberName}
Username: @${CONFIG.targetUsername}
Date Range: ${summary.dateRange.start} to ${summary.dateRange.end}

OVERVIEW
--------
Total Public Workouts: ${summary.totalWorkouts}
Total PRs: ${summary.totalPRs}
RX Workouts: ${summary.rxWorkouts}

WORKOUT TYPES
-------------
Strength Sessions: ${summary.workoutTypes.strength}
For Time WODs: ${summary.workoutTypes.forTime}
AMRAP/Generic: ${summary.workoutTypes.amrap}

CONSENT RECORD
--------------
This export was created with explicit permission from ${memberName}.
Date of export: ${new Date().toISOString().split('T')[0]}
Exported by: Chris Magrane
Purpose: Migration from WodUp to PushPress Train

DATA SOURCE
-----------
All data was collected from WodUp's public leaderboards.
Only publicly posted workout results are included.
Private/hidden workouts are not accessible and not included.

NEXT STEPS
----------
1. Share the ${memberName.replace(/\s+/g, '')}OverrideImport.csv file with ${memberName}
2. They can upload it to PushPress Train → Settings → Import Workout History
3. Their workout history will be imported!
`;

  return text;
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

#!/usr/bin/env node

/**
 * WodUp Timeline Data Exporter
 * Fetches complete workout history from WodUp GraphQL API
 *
 * Usage:
 *   1. Get your session token from browser (see instructions below)
 *   2. Run: SESSION_TOKEN="your_token_here" node wodup-exporter.js
 */

const https = require('https');
const fs = require('fs');

// Configuration
const CONFIG = {
  userId: '111225',
  startDate: '2023-10-01',
  endDate: '2025-11-28',
  apiUrl: 'www.wodup.com',
  apiPath: '/api/graphql?op=TimelineFetchMore',
  sessionToken: process.env.SESSION_TOKEN,
  outputDir: './wodup-export'
};

// GraphQL Query - exact query from WodUp (simplified for our needs)
const TIMELINE_QUERY = `
query TimelineFetchMore($startDate: Date!, $endDate: Date!) {
  currentUser {
    id
    activityTimeline(startDate: $startDate, endDate: $endDate) {
      id
      userId
      date
      completedWodsOccursOnDate {
        id
        name
        occursOn
        publishAt
        classType {
          id
          name
          color
        }
        gym {
          id
          name
          slug
          timeZone
          unitDefaults
        }
        results(isExtraWork: false, currentUser: true) {
          id
          type
          wodComponentId
          pr
          prAmount
          notes
          description
          doneOn
          doneAt
          scaling
          userId
          gymId
          workoutId
          wodId
          competitionScoreId
          workoutSessionId
          socialObjectId
          status
          perceivedExertion
          prefix
          details
          sessionOrder
          isAlternating
          score
          tieBreak
          timeZone
          likesCount
          commentsCount
          partnersCount
          movementIds
        }
        wodComponents {
          id
          prefix
          rowOrder
          name
          preInstructions
          postInstructions
          notes
          notesForCoaches
          resultsCount
          partners
          hidden
          isAlternating
          wodId
          level
          workout {
            id
            type
            name
            details
            description
            officialInstructions
            movementData: movements {
              id
              name
              slug
              category
              hasReps
              hasLoad
              hasDistance
              hasDuration
              hasHeight
              hasCalories
              hasPower
              isComplex
            }
          }
        }
      }
      completedWodsOccursOnDifferentDate {
        id
        name
        occursOn
      }
      posts {
        id
        title
        message
        createdAt
        occursOn
      }
    }
  }
}
`;

// Helper to make GraphQL requests
function makeGraphQLRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query: query,
      variables: variables
    });

    const options = {
      hostname: CONFIG.apiUrl,
      path: CONFIG.apiPath,
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'cookie': `_ga=GA1.2.1182897076.1726487070; session_token=${CONFIG.sessionToken}`,
        'wodup-version': '1.0',
        'Referer': 'https://www.wodup.com/timeline',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Fetch all timeline data with pagination
async function fetchAllTimelineData() {
  const allData = [];
  const startDate = new Date(CONFIG.startDate);
  const endDate = new Date(CONFIG.endDate);
  let currentEndDate = new Date(endDate);
  let pageCount = 0;

  console.log(`Starting data fetch from ${CONFIG.endDate} back to ${CONFIG.startDate}`);
  console.log(`Using session token: ${CONFIG.sessionToken ? '***' + CONFIG.sessionToken.slice(-8) : 'NOT SET'}`);

  // Fetch in chunks of ~30 days at a time
  while (currentEndDate >= startDate) {
    pageCount++;

    // Calculate start date for this chunk (30 days back or until CONFIG.startDate)
    const chunkStartDate = new Date(currentEndDate);
    chunkStartDate.setDate(chunkStartDate.getDate() - 29);

    const actualStartDate = chunkStartDate < startDate ? startDate : chunkStartDate;

    console.log(`\nFetching page ${pageCount} (${actualStartDate.toISOString().split('T')[0]} to ${currentEndDate.toISOString().split('T')[0]})...`);

    try {
      const response = await makeGraphQLRequest(TIMELINE_QUERY, {
        startDate: actualStartDate.toISOString().split('T')[0],
        endDate: currentEndDate.toISOString().split('T')[0]
      });

      if (response.errors) {
        console.error('GraphQL errors:', response.errors);
        throw new Error('GraphQL query failed');
      }

      const timeline = response.data?.currentUser?.activityTimeline || [];

      if (timeline.length === 0) {
        console.log('  No data in this range');
      } else {
        console.log(`  Found ${timeline.length} days of data`);
        allData.push(...timeline);
      }

      // Move to next chunk
      currentEndDate = new Date(actualStartDate);
      currentEndDate.setDate(currentEndDate.getDate() - 1);

      // Stop if we've reached the start date
      if (actualStartDate <= startDate) {
        break;
      }

      // Rate limiting - be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Error fetching page ${pageCount}:`, error.message);
      throw error;
    }
  }

  console.log(`\n✓ Fetched ${allData.length} total days of data across ${pageCount} pages`);
  return allData;
}

// Extract strength PRs and max lifts
function extractStrengthResults(timelineData) {
  const strengthResults = [];
  const maxLiftsByMovement = {};

  // Movement ID mapping (from your example data)
  const movementNames = {
    '2': 'Back Squat',
    '3': 'Deadlift',
    '6': 'Pull-Up',
    '36': 'Barbell Thruster',
    '39': 'Row',
    '61': 'Barbell Bench Press'
  };

  timelineData.forEach(day => {
    day.completedWodsOccursOnDate?.forEach(wod => {
      wod.results?.forEach(result => {
        if (result.type === 'StrengthResult' && result.details?.sets) {
          result.details.sets.forEach(set => {
            // Try to get movement name from workout details or use mapping
            let movementName = movementNames[set.movementId] ||
                              wod.wodComponents?.find(c => c.id === result.wodComponentId)?.workout?.description?.match(/\b\w+\s+\w+\b/)?.[0] ||
                              `Movement ${set.movementId}`;

            const lift = {
              date: result.doneOn,
              movement: movementName,
              movementId: set.movementId,
              weight: set.load,
              weightUnit: set.loadUnit,
              reps: set.reps,
              isPR: result.pr,
              notes: result.notes,
              wodName: wod.wodComponents?.find(c => c.id === result.wodComponentId)?.workout?.name ||
                       wod.wodComponents?.find(c => c.id === result.wodComponentId)?.workout?.description
            };

            strengthResults.push(lift);

            // Track max lifts per movement
            const key = `${set.movementId}_${set.reps}rep`;
            if (!maxLiftsByMovement[key] || set.load > maxLiftsByMovement[key].weight) {
              maxLiftsByMovement[key] = lift;
            }
          });
        }
      });
    });
  });

  return { strengthResults, maxLiftsByMovement };
}

// Extract benchmark WOD results
function extractBenchmarkResults(timelineData) {
  const benchmarkWods = [
    'Fran', 'Grace', 'Isabel', 'Jackie', 'Karen', 'Lynne', 'Nancy',
    'Amanda', 'Annie', 'Chelsea', 'Cindy', 'Diane', 'Elizabeth', 'Eva',
    'Helen', 'Kelly', 'Mary', 'Murph', 'The Chief', 'Fight Gone Bad'
  ];

  const benchmarkResults = [];

  timelineData.forEach(day => {
    day.completedWodsOccursOnDate?.forEach(wod => {
      wod.wodComponents?.forEach(component => {
        const workoutName = component.workout?.name;

        if (workoutName && benchmarkWods.some(b => workoutName.includes(b))) {
          const result = wod.results?.find(r => r.wodComponentId === component.id);

          if (result) {
            benchmarkResults.push({
              date: result.doneOn,
              benchmark: workoutName,
              type: result.type,
              score: result.description,
              rawScore: result.score,
              scaling: result.scaling,
              isPR: result.pr,
              prAmount: result.prAmount,
              notes: result.notes,
              perceivedExertion: result.perceivedExertion,
              details: result.details
            });
          }
        }
      });
    });
  });

  return benchmarkResults;
}

// Extract all workout results
function extractAllResults(timelineData) {
  const allResults = [];

  timelineData.forEach(day => {
    day.completedWodsOccursOnDate?.forEach(wod => {
      wod.results?.forEach(result => {
        const component = wod.wodComponents?.find(c => c.id === result.wodComponentId);

        // workout.description is the component name (e.g., "Front Squat + Back Squat 1.5 Reps")
        // workout.details.description is the detailed instructions
        // workout.details.name is sometimes also the name
        const workoutName = component?.workout?.description ||
                           component?.workout?.details?.name ||
                           component?.workout?.name ||
                           '';

        const workoutDescription = component?.workout?.details?.description || '';

        allResults.push({
          date: result.doneOn,
          resultId: result.id,
          type: result.type,
          workoutName: workoutName,
          workoutDescription: workoutDescription,
          workoutType: component?.workout?.type,
          componentPrefix: component?.prefix,
          score: result.description,
          rawScore: result.score,
          scaling: result.scaling,
          isPR: result.pr,
          prAmount: result.prAmount,
          notes: result.notes,
          perceivedExertion: result.perceivedExertion,
          details: result.details,
          workoutDetails: component?.workout?.details
        });
      });
    });
  });

  return allResults;
}

// Generate summary statistics
function generateSummary(data) {
  const { strengthResults, benchmarkResults, allResults } = data;

  const summary = {
    totalWorkouts: allResults.length,
    dateRange: {
      start: allResults[allResults.length - 1]?.date || 'N/A',
      end: allResults[0]?.date || 'N/A'
    },
    totalPRs: allResults.filter(r => r.isPR).length,
    strengthLifts: {
      total: strengthResults.length,
      uniqueMovements: new Set(strengthResults.map(r => r.movement)).size
    },
    benchmarkWods: {
      total: benchmarkResults.length,
      uniqueBenchmarks: new Set(benchmarkResults.map(r => r.benchmark)).size
    },
    workoutTypes: {
      strength: allResults.filter(r => r.type === 'StrengthResult').length,
      forTime: allResults.filter(r => r.type === 'ForTimeResult').length,
      amrap: allResults.filter(r => r.type === 'GenericResult').length,
      warmup: allResults.filter(r => r.type === 'WarmUpResult').length
    },
    rxWorkouts: allResults.filter(r => r.scaling === 'rx').length,
    averagePerceivedExertion: (
      allResults
        .filter(r => r.perceivedExertion > 0)
        .reduce((sum, r) => sum + r.perceivedExertion, 0) /
      allResults.filter(r => r.perceivedExertion > 0).length
    ).toFixed(2)
  };

  return summary;
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('WodUp Timeline Data Exporter');
  console.log('='.repeat(60));

  // Validate session token
  if (!CONFIG.sessionToken) {
    console.error('\n❌ ERROR: SESSION_TOKEN environment variable not set\n');
    console.log('To get your session token:');
    console.log('1. Open WodUp in your browser and log in');
    console.log('2. Open Developer Tools (F12 or Cmd+Option+I)');
    console.log('3. Go to Network tab');
    console.log('4. Refresh the timeline page');
    console.log('5. Find a request to "graphql"');
    console.log('6. Look in Request Headers for "Cookie" header');
    console.log('7. Copy the "session=..." value\n');
    console.log('Then run:');
    console.log('  SESSION_TOKEN="your_token_here" node wodup-exporter.js\n');
    process.exit(1);
  }

  try {
    // Create output directory
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir);
    }

    // Fetch all timeline data
    const timelineData = await fetchAllTimelineData();

    // Save raw timeline data
    const rawDataPath = `${CONFIG.outputDir}/timeline-raw.json`;
    fs.writeFileSync(rawDataPath, JSON.stringify(timelineData, null, 2));
    console.log(`\n✓ Saved raw timeline data to ${rawDataPath}`);

    // Extract and process data
    console.log('\nProcessing workout data...');

    const { strengthResults, maxLiftsByMovement } = extractStrengthResults(timelineData);
    const benchmarkResults = extractBenchmarkResults(timelineData);
    const allResults = extractAllResults(timelineData);

    // Generate summary
    const summary = generateSummary({ strengthResults, benchmarkResults, allResults });

    // Save processed data
    const processedData = {
      summary,
      maxLifts: Object.values(maxLiftsByMovement).sort((a, b) =>
        a.movement.localeCompare(b.movement)
      ),
      benchmarkPRs: benchmarkResults
        .filter(r => r.isPR)
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
      allBenchmarks: benchmarkResults
        .sort((a, b) => a.benchmark.localeCompare(b.benchmark) || new Date(b.date) - new Date(a.date)),
      allStrengthLifts: strengthResults
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
      allWorkouts: allResults
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    const processedPath = `${CONFIG.outputDir}/wodup-report.json`;
    fs.writeFileSync(processedPath, JSON.stringify(processedData, null, 2));
    console.log(`✓ Saved processed report to ${processedPath}`);

    // Generate human-readable summary
    const summaryPath = `${CONFIG.outputDir}/summary.txt`;
    const summaryText = generateTextSummary(processedData);
    fs.writeFileSync(summaryPath, summaryText);
    console.log(`✓ Saved summary to ${summaryPath}`);

    // Generate CSV for easy import
    generateCSVs(processedData);

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(summaryText);
    console.log('='.repeat(60));
    console.log('\n✅ Export complete! Check the ./wodup-export directory for all files.\n');

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Generate human-readable text summary
function generateTextSummary(data) {
  const { summary, maxLifts, benchmarkPRs } = data;

  let text = `WodUp Workout History Summary
User: Chris Magrane (ID: ${CONFIG.userId})
Date Range: ${summary.dateRange.start} to ${summary.dateRange.end}

OVERVIEW
--------
Total Workouts: ${summary.totalWorkouts}
Total PRs: ${summary.totalPRs}
RX Workouts: ${summary.rxWorkouts}
Average Perceived Exertion: ${summary.averagePerceivedExertion}/5

WORKOUT TYPES
-------------
Strength Sessions: ${summary.workoutTypes.strength}
For Time WODs: ${summary.workoutTypes.forTime}
AMRAP/Generic: ${summary.workoutTypes.amrap}
Warm Ups: ${summary.workoutTypes.warmup}

MAX LIFTS (by movement)
-----------------------
`;

  maxLifts.forEach(lift => {
    text += `${lift.movement} (${lift.reps} reps): ${lift.weight} ${lift.weightUnit} - ${lift.date}\n`;
  });

  text += `\nBENCHMARK WOD PRs
-----------------\n`;

  if (benchmarkPRs.length > 0) {
    benchmarkPRs.forEach(pr => {
      text += `${pr.benchmark}: ${pr.score} (${pr.scaling}) - ${pr.date}\n`;
      if (pr.notes) {
        text += `  Notes: ${pr.notes}\n`;
      }
    });
  } else {
    text += 'No benchmark PRs recorded\n';
  }

  text += `\nSTRENGTH LIFTS SUMMARY
----------------------
Total Lifts Recorded: ${summary.strengthLifts.total}
Unique Movements: ${summary.strengthLifts.uniqueMovements}

BENCHMARK WODS
--------------
Total Benchmark Attempts: ${summary.benchmarkWods.total}
Unique Benchmarks: ${summary.benchmarkWods.uniqueBenchmarks}
`;

  return text;
}

// Generate CSV files for easy import
function generateCSVs(data) {
  // Strength lifts CSV
  const strengthCSV = [
    'Date,Movement,Weight,Weight Unit,Reps,Is PR,Notes,WOD Name'
  ];

  data.allStrengthLifts.forEach(lift => {
    strengthCSV.push([
      lift.date,
      `"${lift.movement}"`,
      lift.weight,
      lift.weightUnit,
      lift.reps,
      lift.isPR,
      `"${(lift.notes || '').replace(/"/g, '""')}"`,
      `"${(lift.wodName || '').replace(/"/g, '""')}"`
    ].join(','));
  });

  fs.writeFileSync(
    `${CONFIG.outputDir}/strength-lifts.csv`,
    strengthCSV.join('\n')
  );
  console.log(`✓ Saved strength lifts CSV to ${CONFIG.outputDir}/strength-lifts.csv`);

  // Benchmark WODs CSV
  const benchmarkCSV = [
    'Date,Benchmark,Score,Scaling,Is PR,PR Amount,Perceived Exertion,Notes'
  ];

  data.allBenchmarks.forEach(bm => {
    benchmarkCSV.push([
      bm.date,
      `"${bm.benchmark}"`,
      `"${bm.score}"`,
      bm.scaling,
      bm.isPR,
      bm.prAmount || '',
      bm.perceivedExertion,
      `"${(bm.notes || '').replace(/"/g, '""')}"`
    ].join(','));
  });

  fs.writeFileSync(
    `${CONFIG.outputDir}/benchmark-wods.csv`,
    benchmarkCSV.join('\n')
  );
  console.log(`✓ Saved benchmark WODs CSV to ${CONFIG.outputDir}/benchmark-wods.csv`);

  // All workouts CSV
  const workoutsCSV = [
    'Date,Prefix,Workout Type,Workout Name,Description,Score,Scaling,Is PR,Perceived Exertion,Notes'
  ];

  data.allWorkouts
    .filter(w => w.type !== 'WarmUpResult')
    .forEach(workout => {
      workoutsCSV.push([
        workout.date,
        workout.componentPrefix || '',
        workout.workoutType || workout.type,
        `"${(workout.workoutName || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(workout.workoutDescription || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(workout.score || '').replace(/\n/g, ' ')}"`,
        workout.scaling,
        workout.isPR,
        workout.perceivedExertion,
        `"${(workout.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
      ].join(','));
    });

  fs.writeFileSync(
    `${CONFIG.outputDir}/all-workouts.csv`,
    workoutsCSV.join('\n')
  );
  console.log(`✓ Saved all workouts CSV to ${CONFIG.outputDir}/all-workouts.csv`);

  // PushPress-compatible CSV (workouts.csv)
  generatePushPressCSV(data);
}

// Generate PushPress-compatible workouts.csv
// Format based on: https://help.pushpress.com/en/articles/9058468
function generatePushPressCSV(data) {
  const pushPressCSV = [
    'date,title,description,best_result_raw,best_result_display,score_type,barbell_lift,set_details,notes,rx_or_scaled,pr'
  ];

  data.allWorkouts
    .filter(w => w.type !== 'WarmUpResult')
    .forEach(workout => {
      // Convert date to YYYYMMDD format (PushPress requirement)
      const dateFormatted = workout.date.replace(/-/g, '');

      // Determine score type based on workout type
      let scoreType = '';
      let bestResultRaw = '';
      let bestResultDisplay = workout.score || '';
      let barbellLift = '';
      let setDetails = '';

      if (workout.type === 'StrengthResult') {
        scoreType = 'weight';
        barbellLift = 'true';

        // Extract set details from details object if available
        if (workout.details?.sets) {
          const sets = workout.details.sets;
          setDetails = sets.map(s => `${s.reps}x${s.load}${s.loadUnit}`).join(', ');

          // Find max weight for best_result_raw
          const maxWeight = Math.max(...sets.map(s => s.load || 0));
          bestResultRaw = maxWeight.toString();
          bestResultDisplay = workout.score || `${maxWeight} lbs`;
        }
      } else if (workout.type === 'ForTimeResult') {
        scoreType = 'time';
        bestResultRaw = Math.abs(workout.rawScore || 0).toString();
        bestResultDisplay = workout.score || '';
      } else if (workout.type === 'GenericResult') {
        // Could be AMRAP (reps) or other
        if (workout.details?.reps) {
          scoreType = 'reps';
          bestResultRaw = workout.details.reps.toString();
          bestResultDisplay = workout.score || `${workout.details.reps} reps`;
        } else if (workout.details?.weight) {
          scoreType = 'weight';
          bestResultRaw = workout.details.weight.toString();
          bestResultDisplay = workout.score || `${workout.details.weight} ${workout.details.weightUnit || 'lbs'}`;
        } else {
          scoreType = 'reps';
          bestResultRaw = Math.abs(workout.rawScore || 0).toString();
          bestResultDisplay = workout.score || '';
        }
      }

      // Clean description and title
      // workoutName is the component name (e.g., "Front Squat + Back Squat")
      // workoutDescription is the detailed instructions
      const title = (workout.workoutName || 'Workout').replace(/"/g, '""').replace(/\n/g, ' ');
      const description = (workout.workoutDescription || workout.workoutName || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const notes = (workout.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');

      // rx_or_scaled mapping
      const rxScaled = workout.scaling === 'rx' ? 'rx' : 'scaled';

      // pr boolean
      const isPR = workout.isPR ? 'true' : 'false';

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

  fs.writeFileSync(
    `${CONFIG.outputDir}/workouts.csv`,
    pushPressCSV.join('\n')
  );
  console.log(`✓ Saved PushPress import file to ${CONFIG.outputDir}/workouts.csv`);
  console.log(`  → This file is ready to import directly into PushPress Train!`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchAllTimelineData, extractStrengthResults, extractBenchmarkResults };

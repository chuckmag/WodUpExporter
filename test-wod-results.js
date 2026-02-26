const https = require('https');

const SESSION_TOKEN = process.env.SESSION_TOKEN;

const WOD_RESULTS_QUERY = `
query WodDetailResults($wodId: ID!) {
  wod(id: $wodId) {
    id
    occursOn
    name
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
      user {
        id
        name
        username
      }
    }
  }
}
`;

function makeGraphQLRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      operationName: 'WodDetailResults',
      query: query,
      variables: variables
    });

    const options = {
      hostname: 'www.wodup.com',
      path: '/api/graphql?op=WodDetailResults',
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'cookie': `session_token=${SESSION_TOKEN}`,
        'wodup-version': '1.0',
        'Referer': 'https://www.wodup.com/gyms/crossfit-override/wods/4531586'
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

async function testWodResults() {
  console.log('Testing WodDetailResults API for WOD 4531586...\n');

  const response = await makeGraphQLRequest(WOD_RESULTS_QUERY, {
    wodId: '4531586'
  });

  if (response.errors) {
    console.error('Errors:', response.errors);
    return;
  }

  const results = response.data?.wod?.results || [];
  console.log(`Found ${results.length} results for this WOD\n`);

  const uniqueUsers = new Map();
  results.forEach(r => {
    if (r.user) {
      uniqueUsers.set(r.userId, r.user.name);
    }
  });

  console.log(`Unique users: ${uniqueUsers.size}\n`);
  Array.from(uniqueUsers.entries()).slice(0, 10).forEach(([id, name]) => {
    console.log(`  - ${name} (ID: ${id})`);
  });

  // Find bryanash
  const bryanResult = results.find(r => r.user?.username === 'bryanash');
  if (bryanResult) {
    console.log('\nFound Bryan Ash result:');
    console.log(JSON.stringify(bryanResult, null, 2));
  }
}

testWodResults().catch(console.error);

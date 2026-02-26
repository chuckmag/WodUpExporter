const https = require('https');

const SESSION_TOKEN = process.env.SESSION_TOKEN;

const NEWSFEED_QUERY = `
query NewsFeed($scope: String!, $offset: Int, $limit: Int) {
  currentUser {
    id
    username
    newsFeedV1(scope: $scope, offset: $offset, limit: $limit) {
      id
      user {
        id
        name
        username
      }
      wod {
        id
        occursOn
        name
      }
      results {
        id
        userId
        description
        doneOn
        type
        pr
        notes
        scaling
      }
    }
  }
}
`;

function makeGraphQLRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      operationName: 'NewsFeed',
      query: query,
      variables: variables
    });

    const options = {
      hostname: 'www.wodup.com',
      path: '/api/graphql?op=NewsFeed',
      method: 'POST',
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'cookie': `session_token=${SESSION_TOKEN}`,
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

async function testNewsFeed() {
  console.log('Testing NewsFeed API...\n');

  const response = await makeGraphQLRequest(NEWSFEED_QUERY, {
    scope: 'following',
    offset: 0,
    limit: 20
  });

  if (response.errors) {
    console.error('Errors:', response.errors);
    return;
  }

  const sessions = response.data?.currentUser?.newsFeedV1 || [];
  console.log(`Found ${sessions.length} workout sessions\n`);

  const uniqueUsers = new Set();
  sessions.forEach(s => {
    if (s.user) {
      uniqueUsers.add(JSON.stringify({ id: s.user.id, name: s.user.name }));
    }
  });

  console.log(`Unique users in feed: ${uniqueUsers.size}\n`);
  console.log('Users:');
  Array.from(uniqueUsers).slice(0, 10).forEach(u => console.log('  -', JSON.parse(u).name));

  console.log('\nSample session:');
  if (sessions[0]) {
    console.log(JSON.stringify(sessions[0], null, 2));
  }
}

testNewsFeed().catch(console.error);

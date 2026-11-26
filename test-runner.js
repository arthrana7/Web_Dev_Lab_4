/**
 * Comprehensive Automated Test Runner for Lab 4
 */
require('dotenv').config();
const http = require('http');
const { io } = require('socket.io-client');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5000';

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let reqBody = null;

    if (body) {
      reqBody = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (reqBody) {
      req.write(reqBody);
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('\n--- Starting Comprehensive Test Suite ---');

  const timestamp = Date.now();
  const user1Email = `aditi_${timestamp}@example.com`;
  const user2Email = `rohan_${timestamp}@example.com`;

  // 1. Signup Aditi
  const signup1 = await request('POST', '/api/auth/signup', {}, {
    username: `aditi_${timestamp}`,
    email: user1Email,
    password: 'Password123'
  });
  assert(signup1.status === 201, `Signup user 1 returned 201 Created (got ${signup1.status})`);
  assert(signup1.data.message === 'User registered', 'Response message is "User registered"');
  assert(signup1.data.id && signup1.data.username && signup1.data.email, 'Response contains id, username, email');
  assert(!signup1.data.password, 'Password hash is NOT returned');

  // 2. Duplicate Signup -> 409
  const dupSignup = await request('POST', '/api/auth/signup', {}, {
    username: `aditi_${timestamp}`,
    email: user1Email,
    password: 'Password123'
  });
  assert(dupSignup.status === 409, `Duplicate signup returned 409 Conflict (got ${dupSignup.status})`);

  // 3. Short Password -> 400
  const shortPass = await request('POST', '/api/auth/signup', {}, {
    username: `short_${timestamp}`,
    email: `short_${timestamp}@example.com`,
    password: '123'
  });
  assert(shortPass.status === 400, `Short password returned 400 Bad Request (got ${shortPass.status})`);

  // 4. Login Aditi
  const login1 = await request('POST', '/api/auth/login', {}, {
    email: user1Email,
    password: 'Password123'
  });
  assert(login1.status === 200, `Login user 1 returned 200 OK (got ${login1.status})`);
  assert(login1.data.message === 'Login successful', 'Response message is "Login successful"');
  assert(typeof login1.data.token === 'string', 'Login returns valid token string');
  assert(
    login1.headers['set-cookie'] &&
    login1.headers['set-cookie'].some((c) => c.includes('token=') && c.includes('HttpOnly')),
    'Login sets httpOnly cookie named "token"'
  );

  const token1 = login1.data.token;
  const cookieHeader1 = login1.headers['set-cookie'][0];

  // 5. Invalid Login credentials -> 401
  const badLogin = await request('POST', '/api/auth/login', {}, {
    email: user1Email,
    password: 'WrongPassword'
  });
  assert(badLogin.status === 401, `Bad credentials returned 401 Unauthorized (got ${badLogin.status})`);
  assert(badLogin.data.message === 'Invalid credentials', 'Message is "Invalid credentials"');

  // 6. Get Profile with Bearer token
  const profileRes = await request('GET', '/api/profile', {
    Authorization: `Bearer ${token1}`
  });
  assert(profileRes.status === 200, `GET /api/profile returned 200 (got ${profileRes.status})`);
  assert(profileRes.data.email === user1Email, 'Profile email matches');
  assert(!profileRes.data.password, 'Profile excludes password field');

  // 7. Notes WITHOUT token -> 403 "No token provided"
  const notesNoToken = await request('GET', '/api/notes');
  assert(notesNoToken.status === 403, `GET /api/notes without token returned 403 (got ${notesNoToken.status})`);
  assert(notesNoToken.data.message === 'No token provided', 'Message is "No token provided"');

  // 8. Notes with Invalid token -> 401 "Invalid or expired token"
  const notesBadToken = await request('GET', '/api/notes', {
    Authorization: 'Bearer invalid.jwt.string'
  });
  assert(notesBadToken.status === 401, `GET /api/notes with bad token returned 401 (got ${notesBadToken.status})`);
  assert(notesBadToken.data.message === 'Invalid or expired token', 'Message is "Invalid or expired token"');

  // 9. Notes with Cookie token (Manual cookie parser test)
  const notesWithCookie = await request('GET', '/api/notes', {
    Cookie: cookieHeader1
  });
  assert(notesWithCookie.status === 200, `GET /api/notes with Cookie returned 200 (got ${notesWithCookie.status})`);
  assert(Array.isArray(notesWithCookie.data), 'Notes response is an array');

  // 10. Create Note 1
  const createNote1 = await request('POST', '/api/notes', {
    Authorization: `Bearer ${token1}`
  }, {
    title: 'Note One',
    content: 'Content of Note One'
  });
  assert(createNote1.status === 201, `Create note 1 returned 201 (got ${createNote1.status})`);
  assert(createNote1.data.title === 'Note One', 'Note title verified');
  assert(createNote1.data.content === 'Content of Note One', 'Note content verified');
  assert(createNote1.data._id && createNote1.data.owner, 'Note has _id and owner');
  const note1Id = createNote1.data._id;

  // 11. Create Note 2
  const createNote2 = await request('POST', '/api/notes', {
    Authorization: `Bearer ${token1}`
  }, {
    title: 'Note Two',
    content: 'Content of Note Two'
  });
  assert(createNote2.status === 201, `Create note 2 returned 201 (got ${createNote2.status})`);

  // 12. Get Notes -> should return 2 notes for User 1
  const getNotes = await request('GET', '/api/notes', {
    Authorization: `Bearer ${token1}`
  });
  assert(getNotes.status === 200, `GET /api/notes returned 200`);
  assert(getNotes.data.length >= 2, `User 1 notes list contains created notes (count: ${getNotes.data.length})`);

  // 13. Get Single Note by ID
  const getSingleNote = await request('GET', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${token1}`
  });
  assert(getSingleNote.status === 200, `GET /api/notes/:id returned 200`);
  assert(getSingleNote.data.title === 'Note One', 'Single note title verified');

  // 14. Update Note 1
  const updateNote = await request('PUT', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${token1}`
  }, {
    title: 'Note One Updated',
    content: 'Updated content'
  });
  assert(updateNote.status === 200, `PUT /api/notes/:id returned 200`);
  assert(updateNote.data.title === 'Note One Updated', 'Updated title verified');

  // 15. Create User 2 (Rohan)
  const signup2 = await request('POST', '/api/auth/signup', {}, {
    username: `rohan_${timestamp}`,
    email: user2Email,
    password: 'Password123'
  });
  assert(signup2.status === 201, `Signup user 2 returned 201`);

  const login2 = await request('POST', '/api/auth/login', {}, {
    email: user2Email,
    password: 'Password123'
  });
  assert(login2.status === 200, `Login user 2 returned 200`);
  const token2 = login2.data.token;

  // 16. User 2 trying to access User 1's note -> 403
  const user2Access = await request('GET', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${token2}`
  });
  assert(user2Access.status === 403, `User 2 accessing User 1 note returned 403 (got ${user2Access.status})`);

  const user2Update = await request('PUT', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${token2}`
  }, { title: 'Hacked' });
  assert(user2Update.status === 403, `User 2 updating User 1 note returned 403`);

  const user2Delete = await request('DELETE', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${token2}`
  });
  assert(user2Delete.status === 403, `User 2 deleting User 1 note returned 403`);

  // 17. Admin Endpoint before promotion -> 403
  const adminBefore = await request('GET', '/api/admin/users', {
    Authorization: `Bearer ${token1}`
  });
  assert(adminBefore.status === 403, `Non-admin accessing /api/admin/users returned 403 (got ${adminBefore.status})`);

  // 18. Promote User 1 to admin using makeAdmin.js script
  console.log(`Running scripts/makeAdmin.js for ${user1Email}...`);
  execSync(`node scripts/makeAdmin.js "${user1Email}"`, { stdio: 'inherit' });

  // Re-login User 1 to get token with role "admin"
  const loginAdmin = await request('POST', '/api/auth/login', {}, {
    email: user1Email,
    password: 'Password123'
  });
  const adminToken = loginAdmin.data.token;

  // Access admin endpoint with admin token -> 200
  const adminAfter = await request('GET', '/api/admin/users', {
    Authorization: `Bearer ${adminToken}`
  });
  assert(adminAfter.status === 200, `Admin accessing /api/admin/users returned 200 (got ${adminAfter.status})`);
  assert(Array.isArray(adminAfter.data), 'Admin users list is an array');

  // Admin can view all notes
  const adminNotes = await request('GET', '/api/notes', {
    Authorization: `Bearer ${adminToken}`
  });
  assert(adminNotes.status === 200, `Admin accessing /api/notes returned 200`);

  // 19. Real-Time Chat Verification between Client 1 and Client 2
  console.log('\n--- Testing Socket.io Real-Time Chat ---');
  await new Promise((resolve, reject) => {
    let aditiReceived = false;
    let rohanReceived = false;

    // Connect socket 1 (Aditi)
    const socket1 = io(BASE_URL, {
      auth: { token: adminToken },
      transports: ['websocket']
    });

    // Connect socket 2 (Rohan)
    const socket2 = io(BASE_URL, {
      auth: { token: token2 },
      transports: ['websocket']
    });

    socket1.on('connect', () => {
      socket1.emit('joinRoom', 'general');
    });

    socket2.on('connect', () => {
      socket2.emit('joinRoom', 'general');

      setTimeout(() => {
        // Aditi sends message
        socket1.emit('chatMessage', {
          room: 'general',
          text: 'Hey team, backend is ready'
        });
      }, 300);
    });

    socket2.on('message', (msg) => {
      if (msg.text === 'Hey team, backend is ready') {
        rohanReceived = true;
        // Rohan responds
        socket2.emit('chatMessage', {
          room: 'general',
          text: 'Testing chat now...'
        });
      }
    });

    socket1.on('message', (msg) => {
      if (msg.text === 'Testing chat now...') {
        aditiReceived = true;
      }

      if (aditiReceived && rohanReceived) {
        assert(true, 'Real-time chat messages successfully exchanged between 2 clients');
        socket1.disconnect();
        socket2.disconnect();
        resolve();
      }
    });

    socket1.on('connect_error', (err) => reject(new Error('Socket 1 connect error: ' + err.message)));
    socket2.on('connect_error', (err) => reject(new Error('Socket 2 connect error: ' + err.message)));

    setTimeout(() => {
      if (!aditiReceived || !rohanReceived) {
        socket1.disconnect();
        socket2.disconnect();
        reject(new Error(`Chat timeout: Aditi received=${aditiReceived}, Rohan received=${rohanReceived}`));
      }
    }, 5000);
  });

  // 20. Delete Note 1 (Owner Only)
  const deleteRes = await request('DELETE', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${adminToken}`
  });
  assert(deleteRes.status === 200, `DELETE /api/notes/:id returned 200`);
  assert(deleteRes.data.message === 'Note deleted', 'Response is "Note deleted"');

  // Verify it's deleted
  const getDeleted = await request('GET', `/api/notes/${note1Id}`, {
    Authorization: `Bearer ${adminToken}`
  });
  assert(getDeleted.status === 404, `GET deleted note returned 404`);

  // 21. Logout
  const logoutRes = await request('POST', '/api/auth/logout');
  assert(logoutRes.status === 200, `Logout returned 200`);
  assert(logoutRes.data.message === 'Logged out', 'Response is "Logged out"');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

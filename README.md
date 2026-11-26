# Lab 4: Secure Connect and Communication Platform (Web Dev III)

A complete, production-ready, security-focused web platform built from scratch with Node.js, Express, MongoDB (Mongoose), JSON Web Tokens (JWT), bcrypt, and real-time Socket.io communication.

---

## Features

- **Custom Authentication & Password Security**:
  - Secure user registration with input validation (password minimum 6 characters, unique username and email).
  - Password hashing with `bcrypt` (10 salt rounds).
  - JWT token issuance with payload `{ id, role }`.
  - Dual-token retrieval: supports both `Authorization: Bearer <token>` and manual httpOnly cookie parsing (`cookie-parser` is intentionally not used).
  - Secure logout endpoint clearing the cookie.

- **Role-Based Access Control (RBAC)**:
  - Role management with `user` and `admin` roles.
  - Safe admin promotion CLI tool (`node scripts/makeAdmin.js <email>`).
  - Protected admin routes for user oversight.

- **Secure Personal Notes API**:
  - Full CRUD with strict ownership verification.
  - Regular users can only see, retrieve, update, and delete their own notes.
  - Admins can view all notes across users.

- **Real-Time Chat with Socket.io & Message Persistence**:
  - Socket.io connection authenticated via JWT handshake auth or cookie fallback.
  - Room-based communication (default: `general`).
  - MongoDB persistence of all chat messages.
  - Real-time events: `joinRoom`, `chatMessage`, `leaveRoom`, `message`, `systemMessage`, `roomUsers`.
  - Automatic retrieval of the last 20 messages on room join.
  - Exact console logging format compliant with lab specifications.

- **Decoupled Node EventEmitter (appEvents)**:
  - Shared singleton `appEvents` emitting:
    - `user:registered` -> logs `[event] user:registered -> <username>`
    - `user:loggedIn` -> logs `[event] user:loggedIn -> <username>`
    - `note:created` -> logs `[event] note:created -> <title> by <owner>`
    - `chat:message` -> logs counter of total messages processed

---

## Project Structure

```text
secure-connect/
├── server.js            # Entry point: Express app + HTTP server + Socket.io + listeners
├── .env                 # Environment secrets
├── .env.example         # Example environment template
├── .gitignore           # Git ignore for node_modules and .env
├── package.json         # Project metadata and scripts
├── api-tests.http       # REST Client test suite for all endpoints
├── config/
│   └── db.js            # Mongoose connection logic
├── models/
│   ├── User.js          # User schema (username, email, password hash, role)
│   ├── Note.js          # Note schema (title, content, owner ref, timestamps)
│   └── Message.js       # Message schema (room, username, text, timestamps)
├── middleware/
│   └── auth.js          # verifyToken (header + manual cookie) & authorizeRoles
├── routes/
│   ├── auth.js          # /api/auth (signup, login, logout)
│   ├── notes.js         # /api/notes (protected CRUD notes)
│   └── admin.js         # /api/admin (protected admin routes)
├── sockets/
│   └── chat.js          # Socket.io auth middleware & event handlers
├── events/
│   └── appEvents.js     # Singleton Node EventEmitter instance
├── scripts/
│   └── makeAdmin.js     # One-time CLI tool to grant admin role
├── public/
│   └── chat.html        # Interactive chat test client (Plain HTML + JS)
└── README.md            # Comprehensive documentation
```

---

## Environment Variables (.env)

| Variable | Description | Example Value |
|---|---|---|
| `PORT` | Port for the HTTP and WebSocket server | `5000` |
| `MONGO_URI` | MongoDB connection connection string | `mongodb://127.0.0.1:27017/secure_connect` |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens | `<random_hex_string>` |
| `JWT_EXPIRES_IN` | Token lifespan | `1h` |

---

## Setup & Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and secret key if needed
   ```

3. **Ensure MongoDB is Running**:
   ```bash
   # Make sure MongoDB is active on 127.0.0.1:27017
   mongod --config /opt/homebrew/etc/mongod.conf
   ```

4. **Start the Application**:
   - Production mode:
     ```bash
     npm start
     ```
   - Development mode with nodemon:
     ```bash
     npm run dev
     ```

---

## API Endpoints Reference

### 1. Authentication (`/api/auth`)

#### `POST /api/auth/signup`
- **Body**:
  ```json
  {
    "username": "aditi",
    "email": "aditi@example.com",
    "password": "Password123"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "User registered",
    "id": "6745f617a941...",
    "username": "aditi",
    "email": "aditi@example.com"
  }
  ```

#### `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "aditi@example.com",
    "password": "Password123"
  }
  ```
- **Response (200 OK)**:
  Sets `token` httpOnly cookie and returns:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```

#### `POST /api/auth/logout`
- **Response (200 OK)**:
  Clears the `token` httpOnly cookie.
  ```json
  {
    "message": "Logged out"
  }
  ```

---

### 2. Profile & Admin

#### `GET /api/profile` (Protected)
- **Headers**: `Authorization: Bearer <token>` or httpOnly cookie
- **Response (200 OK)**: Returns the user document without password.

#### `GET /api/admin/users` (Protected, Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**: Returns all registered users (excluding password hashes).

**Promote a user to Admin**:
```bash
node scripts/makeAdmin.js aditi@example.com
```

---

### 3. Secure Notes API (`/api/notes`)

All routes require `verifyToken`.

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `POST` | `/api/notes` | Create a new note `{ "title": "...", "content": "..." }` | `201 Created` |
| `GET` | `/api/notes` | Get all notes belonging to the logged-in user | `200 OK` |
| `GET` | `/api/notes/:id` | Get single note (Owner or Admin) | `200 OK` / `403` / `404` |
| `PUT` | `/api/notes/:id` | Update note title/content (Owner only) | `200 OK` / `403` / `404` |
| `DELETE` | `/api/notes/:id` | Delete note (Owner only) | `200 OK` / `403` / `404` |

---

## Real-Time Chat (Socket.io)

Connect to the Socket.io server with:
```javascript
const socket = io({
  auth: { token: "<your_jwt_token>" }
});
```

### Client -> Server Events
- `joinRoom` (`roomName`): Join a specific room (default `"general"`). Automatically returns the last 20 messages of that room.
- `chatMessage` (`{ room, text }`): Sends a message to the specified room.
- `leaveRoom` (`roomName`): Leaves a room.

### Server -> Client Events
- `message` (`{ room, username, text, time }`): Broadcasts chat messages to room members.
- `messageHistory` (`[{ room, username, text, time }, ...]`): Sent to client upon joining a room.
- `systemMessage` (`{ room, text, time }`): System announcements (user joined/left).
- `roomUsers` (`{ room, users }`): Updated list of active usernames currently in the room.

### Server Console Log Specification
Server outputs match the exact requirements:
```text
[server] listening on http://localhost:5000
User connected: <socket.id>
<socket.id> joined room general
[general] Aditi: Hey team, backend is ready
[general] Rohan: Testing chat now...
User disconnected: <socket.id>
```

---

## Testing

1. **Automated Verification Script**:
   A comprehensive test script verifies all endpoints and Socket.io communication:
   ```bash
   node test-server.js
   ```

2. **REST Client (`api-tests.http`)**:
   Open `api-tests.http` with the VS Code REST Client extension to execute sequential requests.

3. **Interactive Web Client**:
   Navigate to [http://localhost:5000](http://localhost:5000) to use the chat client with live authentication, room switching, and message exchange.

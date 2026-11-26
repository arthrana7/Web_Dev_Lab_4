# Secure Connect

This is my Lab 4 web development project. It has a Node.js API for signing up, logging in, and managing notes. Signed-in users get a token, and the API checks that token before showing private data or creating notes. The project also includes a small Socket.IO chat.

## Run it on your computer

You’ll need Node.js and MongoDB running. From this folder:

1. Install the packages with `npm install`.
2. Add a `.env` file with your MongoDB connection and a private JWT secret:

   ```env
   PORT=3000
   MONGO_URI=mongodb://127.0.0.1:27017/secure-connect
   JWT_SECRET=put-a-long-random-secret-here
   ```

3. Start the server with `npm start`.
4. Open `http://127.0.0.1:3000` to see the chat page.

Keep `.env` private; don’t upload your real database URL or JWT secret.

## Try the API in Postman

Import [`postman/secure-connect.postman_collection.json`](postman/secure-connect.postman_collection.json). The collection uses `http://127.0.0.1:3000` by default. Start with Signup, then Login; the collection saves the login token for the requests that need it. Create Note saves its ID for the later note requests.

The Admin request needs an admin account. To promote an account, run `node scripts/makeAdmin.js your-email@example.com` from this folder, then log in again.

## Screenshots

These are the Postman results from running the API locally:

| What it shows | Result |
| --- | --- |
| [Signup](ScreenShots/SIGNUP.png) | Account created |
| [Profile](ScreenShots/PROFILE.png) | Signed-in user details |
| [Notes without a token](ScreenShots/NOTOKEN.png) | Access denied as expected |
| [Create a note](ScreenShots/NOTES.png) | Note created |
| [All notes](ScreenShots/ALLNOTES.png) | Notes list returned |
| [Get one note](ScreenShots/GETNOTE.png) | Note returned |
| [Delete a note](ScreenShots/DELETE.png) | Note deleted |
| [Logout](ScreenShots/LOGOUT.png) | Logged out |

The chat uses Socket.IO, so it isn’t included in the REST Postman collection.
